// Gerenciador de Rastreamento GPS, Métricas, Auto-Pausa, WakeLock e Simulador
class PedalTracker {
  constructor() {
    this.state = 'STOPPED'; // 'STOPPED', 'RECORDING', 'PAUSED_MANUAL', 'PAUSED_AUTO'
    this.watchId = null;
    this.wakeLock = null;

    // Métricas
    this.distanceKm = 0.0;
    this.currentSpeedKmH = 0.0;
    this.maxSpeedKmH = 0.0;
    this.avgSpeedKmH = 0.0;
    this.elevationGainM = 0.0;
    this.elevationLossM = 0.0;
    this.calories = 0;

    // Tempos
    this.startTime = null;
    this.totalDurationSec = 0;
    this.movingDurationSec = 0;
    this.timerInterval = null;

    // Pontos do trajeto
    this.points = []; // [{ lat, lng, alt, speed, time, distance }]
    this.lastPosition = null;
    this.lastElevation = null;

    // Configurações de Auto-Pausa
    this.autoPauseEnabled = true;
    this.autoPauseSpeedThreshold = 2.5; // km/h
    this.lowSpeedCount = 0;
    this.lowSpeedMaxTicks = 3; // ~3 segundos abaixo de 2.5 km/h para pausar

    // Dados do ciclista
    this.cyclistWeightKg = 75;

    // Callbacks de atualização
    this.onUpdate = null; // func({ metrics, currentPoint, state })
    this.onMilestone = null;
  }

  // --- CONTROLE DE GRAVAÇÃO ---

  async start() {
    this.reset();
    this.state = 'RECORDING';
    this.startTime = Date.now();

    // Iniciar cronômetro
    this.timerInterval = setInterval(() => this._tickTimer(), 1000);

    // Ativar Wake Lock (tela acesa no guidão)
    await this._requestWakeLock();

    // Iniciar rastreamento GPS real
    this._startGeolocation();

    if (window.audioCoach) {
      window.audioCoach.reset();
      window.audioCoach.speakStart();
    }

    this._notifyUpdate();
  }

  pause(isManual = true) {
    if (this.state !== 'RECORDING') return;

    this.state = isManual ? 'PAUSED_MANUAL' : 'PAUSED_AUTO';
    this.currentSpeedKmH = 0;

    if (window.audioCoach && !isManual) {
      window.audioCoach.speakAutoPause();
    }

    this._notifyUpdate();
  }

  resume() {
    if (this.state !== 'PAUSED_MANUAL' && this.state !== 'PAUSED_AUTO') return;

    const wasAuto = this.state === 'PAUSED_AUTO';
    this.state = 'RECORDING';
    this.lowSpeedCount = 0;

    if (window.audioCoach && wasAuto) {
      window.audioCoach.speakAutoResume();
    }

    this._notifyUpdate();
  }

  stop() {
    this.state = 'STOPPED';

    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);

    this._releaseWakeLock();

    // Gerar resumo final
    const finalData = {
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      distanceKm: Number(this.distanceKm.toFixed(2)),
      movingDurationSec: Math.round(this.movingDurationSec),
      totalDurationSec: Math.round(this.totalDurationSec),
      avgSpeedKmH: Number(this.avgSpeedKmH.toFixed(1)),
      maxSpeedKmH: Number(this.maxSpeedKmH.toFixed(1)),
      elevationGainM: Math.round(this.elevationGainM),
      elevationLossM: Math.round(this.elevationLossM),
      calories: Math.round(this.calories),
      points: [...this.points]
    };

    if (window.audioCoach) {
      window.audioCoach.speakFinish(this.distanceKm, this.movingDurationSec, this.avgSpeedKmH);
    }

    this._notifyUpdate();
    return finalData;
  }

  reset() {
    this.distanceKm = 0.0;
    this.currentSpeedKmH = 0.0;
    this.maxSpeedKmH = 0.0;
    this.avgSpeedKmH = 0.0;
    this.elevationGainM = 0.0;
    this.elevationLossM = 0.0;
    this.calories = 0;
    this.totalDurationSec = 0;
    this.movingDurationSec = 0;
    this.points = [];
    this.lastPosition = null;
    this.lastElevation = null;
    this.lowSpeedCount = 0;
  }

  // --- CRONÔMETRO E MÉTRICAS ---

  _tickTimer() {
    this.totalDurationSec++;

    if (this.state === 'RECORDING') {
      this.movingDurationSec++;
      
      // Calcular calorias acumuladas
      this._calculateCalories();

      // Recalcular velocidade média
      if (this.movingDurationSec > 0 && this.distanceKm > 0) {
        this.avgSpeedKmH = (this.distanceKm / (this.movingDurationSec / 3600));
      }

      // Checar marcos para o Áudio Coach
      if (window.audioCoach) {
        window.audioCoach.checkDistanceMilestone(this.distanceKm, this.movingDurationSec, this.avgSpeedKmH);
      }
    }

    this._notifyUpdate();
  }

  _calculateCalories() {
    // MET por faixa de velocidade em ciclismo
    let met = 4.0;
    const speed = this.currentSpeedKmH;
    if (speed >= 30) met = 12.0;
    else if (speed >= 25) met = 10.0;
    else if (speed >= 20) met = 8.0;
    else if (speed >= 16) met = 6.0;
    else met = 4.0;

    // Calorias = MET * Peso (kg) * Tempo (horas) + bônus de elevação
    const hours = this.movingDurationSec / 3600;
    const baseCal = met * this.cyclistWeightKg * hours;
    const elevCal = (this.elevationGainM * this.cyclistWeightKg * 9.81) / 4184 / 0.22; // Eficiência mecânica humana ~22%
    this.calories = Math.round(baseCal + elevCal);
  }

  // --- PROCESSAMENTO DE PONTOS GPS ---

  _processNewPosition(lat, lng, alt, speedMs, timestamp) {
    if (this.state === 'STOPPED') return;

    let speedKmH = 0;
    if (speedMs !== null && speedMs !== undefined && !isNaN(speedMs) && speedMs >= 0) {
      speedKmH = speedMs * 3.6;
    }

    // Se temos ponto anterior, calcular distância real
    if (this.lastPosition) {
      const deltaDist = this._haversineDistance(
        this.lastPosition.lat, this.lastPosition.lng,
        lat, lng
      );

      const deltaTimeSec = (timestamp - this.lastPosition.time) / 1000;

      // Se velocidade do GPS não estava disponível, calcular por delta/tempo
      if (speedKmH <= 0 && deltaTimeSec > 0 && deltaDist > 0.002) {
        speedKmH = (deltaDist / (deltaTimeSec / 3600));
      }

      // Filtro de ruído: se velocidade instantânea for irreal (> 90 km/h), descarta o pulo
      if (speedKmH > 90) return;

      // Auto-pausa inteligente
      if (this.autoPauseEnabled) {
        if (speedKmH < this.autoPauseSpeedThreshold) {
          this.lowSpeedCount++;
          if (this.lowSpeedCount >= this.lowSpeedMaxTicks && this.state === 'RECORDING') {
            this.pause(false); // Pausa automática
          }
        } else {
          this.lowSpeedCount = 0;
          if (this.state === 'PAUSED_AUTO') {
            this.resume(); // Retomada automática
          }
        }
      }

      // Somar distância apenas se estiver gravando
      if (this.state === 'RECORDING') {
        // Filtrar pequenos tremores de GPS estático (< 3 metros)
        if (deltaDist > 0.003 || speedKmH >= 3.0) {
          this.distanceKm += deltaDist;

          // Altimetria acumulada
          if (alt !== null && alt !== undefined && !isNaN(alt)) {
            if (this.lastElevation !== null) {
              const altDelta = alt - this.lastElevation;
              // Filtro de ruído vertical (mínimo 0.8m)
              if (altDelta > 0.8) {
                this.elevationGainM += altDelta;
                this.lastElevation = alt;
              } else if (altDelta < -0.8) {
                this.elevationLossM += Math.abs(altDelta);
                this.lastElevation = alt;
              }
            } else {
              this.lastElevation = alt;
            }
          }
        }
      }
    } else {
      if (alt !== null && !isNaN(alt)) this.lastElevation = alt;
    }

    // Atualizar velocidade atual
    this.currentSpeedKmH = speedKmH;
    if (speedKmH > this.maxSpeedKmH && speedKmH < 90) {
      this.maxSpeedKmH = speedKmH;
    }

    const point = {
      lat,
      lng,
      alt: alt || 0,
      speed: Number(speedKmH.toFixed(1)),
      time: timestamp,
      distance: Number(this.distanceKm.toFixed(3))
    };

    this.points.push(point);
    this.lastPosition = point;

    this._notifyUpdate(point);
  }

  // --- GEOLOCATION REAL ---

  _startGeolocation() {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this._processNewPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.altitude,
          pos.coords.speed,
          pos.timestamp || Date.now()
        );
      },
      (err) => {
        console.warn('Erro GPS:', err.message);
      },
      options
    );
  }

  // --- UTILITÁRIOS ---

  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async _requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {
        console.warn('Wake Lock não pôde ser ativado:', err);
      }
    }
  }

  _releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  _notifyUpdate(currentPoint = null) {
    if (this.onUpdate) {
      this.onUpdate({
        state: this.state,
        currentPoint,
        metrics: {
          distanceKm: this.distanceKm,
          currentSpeedKmH: this.currentSpeedKmH,
          avgSpeedKmH: this.avgSpeedKmH,
          maxSpeedKmH: this.maxSpeedKmH,
          elevationGainM: this.elevationGainM,
          calories: this.calories,
          totalDurationSec: this.totalDurationSec,
          movingDurationSec: this.movingDurationSec
        }
      });
    }
  }
}

window.pedalTracker = new PedalTracker();
