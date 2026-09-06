// Mapeamento com Leaflet, Traçado ao Vivo e Rota Gradiente
class PedalMap {
  constructor() {
    this.liveMap = null;
    this.summaryMap = null;
    this.livePolyline = null;
    this.cyclistMarker = null;
    this.isFollowRider = true;
    this.livePoints = [];

    // Mapa de resumo pós-treino
    this.summaryLayers = [];
    this.scrubMarker = null;
  }

  // --- MAPA AO VIVO (GRAVADOR) ---

  initLiveMap(containerId = 'live-map') {
    if (this.liveMap) return this.liveMap;

    // Posição inicial padrão (Brasil / SP ou coordenada neutra antes do primeiro GPS)
    const initialLat = -23.5874;
    const initialLng = -46.6576;

    this.liveMap = L.map(containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView([initialLat, initialLng], 15);

    // Mapa escuro moderno usando OpenStreetMap (gratuito, sem API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.liveMap);

    // Polyline do trajeto ao vivo com brilho laranja Strava
    this.livePolyline = L.polyline([], {
      color: '#fc4c02',
      weight: 6,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.liveMap);

    // Marcador customizado do ciclista com pulso
    const cyclistIcon = L.divIcon({
      className: 'cyclist-live-marker',
      html: `
        <div class="radar-pulse"></div>
        <div class="rider-dot">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.cyclistMarker = L.marker([initialLat, initialLng], { icon: cyclistIcon }).addTo(this.liveMap);

    // Se o usuário arrastar o mapa manualmente, desativa o auto-follow temporariamente
    this.liveMap.on('dragstart', () => {
      this.isFollowRider = false;
      const btn = document.getElementById('btn-recenter');
      if (btn) btn.classList.remove('active');
    });

    // Centralizar imediatamente na posição real do usuário
    this.centerOnUserLocation();

    return this.liveMap;
  }

  // Centraliza o mapa na localização real do usuário via GPS do dispositivo
  centerOnUserLocation() {
    if (!navigator.geolocation || !this.liveMap) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Mover mapa para a localização real
        this.liveMap.setView([lat, lng], 16, { animate: true });

        // Posicionar o marcador do ciclista no local real
        if (this.cyclistMarker) {
          this.cyclistMarker.setLatLng([lat, lng]);
        }
      },
      (err) => {
        console.warn('Não foi possível obter localização inicial:', err.message);
        // Mantém a posição padrão (SP) se o GPS falhar
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  updateLivePosition(point) {
    if (!this.liveMap || !point) return;

    const latLng = [point.lat, point.lng];
    this.livePoints.push(latLng);

    // Atualizar polyline
    this.livePolyline.setLatLngs(this.livePoints);

    // Atualizar posição e rotação do marcador do ciclista
    if (this.cyclistMarker) {
      this.cyclistMarker.setLatLng(latLng);

      // Calcular rotação se houver ponto anterior
      if (this.livePoints.length > 1) {
        const prev = this.livePoints[this.livePoints.length - 2];
        const angle = this._calculateBearing(prev[0], prev[1], point.lat, point.lng);
        const iconEl = this.cyclistMarker.getElement();
        if (iconEl) {
          const riderDot = iconEl.querySelector('.rider-dot');
          if (riderDot) riderDot.style.transform = `rotate(${angle}deg)`;
        }
      }
    }

    // Auto-centralizar se o modo seguir estiver ativado
    if (this.isFollowRider) {
      this.liveMap.panTo(latLng, { animate: true, duration: 0.8 });
    }
  }

  recenterLive() {
    this.isFollowRider = true;
    const btn = document.getElementById('btn-recenter');
    if (btn) btn.classList.add('active');

    if (this.livePoints.length > 0) {
      const last = this.livePoints[this.livePoints.length - 1];
      this.liveMap.setView(last, 16, { animate: true });
    } else {
      // Se ainda não começou a gravar, volta para a localização real do usuário
      this.centerOnUserLocation();
    }
  }

  clearLive() {
    this.livePoints = [];
    if (this.livePolyline) this.livePolyline.setLatLngs([]);
  }

  // --- MAPA DE RESUMO PÓS-TREINO (ESTILO STRAVA COM GRADIENTE) ---

  initSummaryMap(containerId = 'summary-map', points = []) {
    if (this.summaryMap) {
      this.summaryMap.remove();
      this.summaryMap = null;
    }

    if (!points || points.length === 0) return;

    this.summaryMap = L.map(containerId, {
      zoomControl: false,
      attributionControl: false
    });

    // Mapa usando OpenStreetMap (gratuito, sem API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.summaryMap);

    // Desenhar segmentos coloridos por velocidade (Verde = Rápido, Laranja = Médio, Vermelho = Lento)
    this._renderSpeedGradientSegments(points);

    // Marcador de Início
    const startPt = points[0];
    const startIcon = L.divIcon({
      className: 'route-pin-start',
      html: '<div class="pin-inner start">A</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    L.marker([startPt.lat, startPt.lng], { icon: startIcon }).addTo(this.summaryMap);

    // Marcador de Chegada
    const endPt = points[points.length - 1];
    const endIcon = L.divIcon({
      className: 'route-pin-end',
      html: '<div class="pin-inner end">🏁</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    L.marker([endPt.lat, endPt.lng], { icon: endIcon }).addTo(this.summaryMap);

    // Ajustar zoom para enquadrar todo o percurso perfeitamente
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    this.summaryMap.fitBounds(bounds, { padding: [30, 30] });

    // Marcador de scrub da altimetria
    const scrubIcon = L.divIcon({
      className: 'scrub-sync-marker',
      html: '<div class="scrub-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.scrubMarker = L.marker([startPt.lat, startPt.lng], { icon: scrubIcon, opacity: 0 }).addTo(this.summaryMap);

    // Forçar recálculo de dimensões do mapa após renderização do modal
    setTimeout(() => {
      if (this.summaryMap) this.summaryMap.invalidateSize();
    }, 200);
  }

  setScrubPosition(lat, lng) {
    if (!this.summaryMap || !this.scrubMarker) return;
    this.scrubMarker.setLatLng([lat, lng]);
    this.scrubMarker.setOpacity(1);
  }

  hideScrubPosition() {
    if (this.scrubMarker) this.scrubMarker.setOpacity(0);
  }

  _renderSpeedGradientSegments(points) {
    if (points.length < 2) return;

    // Calcular velocidade máxima e mínima para normalizar cores
    const speeds = points.map(p => p.speed || 0);
    const minSpd = Math.min(...speeds, 5);
    const maxSpd = Math.max(...speeds, 35);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const avgSpd = ((p1.speed || 0) + (p2.speed || 0)) / 2;

      // Interpolação de cor (Lento = #ff3b30, Médio = #fc4c02, Rápido = #00e676)
      const color = this._getSpeedColor(avgSpd, minSpd, maxSpd);

      L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
        color: color,
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.summaryMap);
    }
  }

  _getSpeedColor(spd, minSpd, maxSpd) {
    const ratio = Math.max(0, Math.min(1, (spd - minSpd) / (maxSpd - minSpd || 1)));
    if (ratio < 0.5) {
      // De vermelho (#ff3b30) até laranja (#fc4c02)
      return ratio < 0.25 ? '#ff3b30' : '#fc4c02';
    } else {
      // De laranja (#fc4c02) até verde neon (#00e676)
      return ratio > 0.75 ? '#00e676' : '#ffb300';
    }
  }

  _calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
    const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
              Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
}

window.pedalMap = new PedalMap();
