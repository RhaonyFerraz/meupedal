// Funções Globais para o HUD (resposta instantânea no toque e clique)
window.minimizeHudDashboard = function(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const hudDashboard = document.getElementById('hud-metrics-dashboard');
  const btnRestore = document.getElementById('btn-restore-dashboard');
  if (hudDashboard) hudDashboard.classList.add('minimized');
  if (btnRestore) btnRestore.style.display = 'flex';
};

window.restoreHudDashboard = function(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const hudDashboard = document.getElementById('hud-metrics-dashboard');
  const btnRestore = document.getElementById('btn-restore-dashboard');
  if (hudDashboard) hudDashboard.classList.remove('minimized');
  if (btnRestore) btnRestore.style.display = 'none';
};

// Função Global para Abrir/Fechar a Barra de Menu Inferior no Gravador
window.toggleBottomMenu = function(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const bottomNav = document.querySelector('.bottom-nav');
  const btnToggle = document.getElementById('btn-toggle-menu');
  if (bottomNav) {
    const isRevealed = bottomNav.classList.toggle('revealed');
    document.body.classList.toggle('menu-revealed', isRevealed);
    if (btnToggle) {
      btnToggle.classList.toggle('active', isRevealed);
    }
  }
};

// Controlador Principal do Aplicativo MeuPedal
class App {
  constructor() {
    this.currentTab = 'record';
    this.currentCompletedRide = null;
    this.photoDataUrl = null;
    this.deferredPrompt = null;
    this._recordTabEnteredAt = null; // timestamp quando NAVEGOU para a aba de gravação (null = já estava lá)
  }

  async init() {
    document.body.className = 'in-tab-record';

    // Inicializar banco de dados
    await window.meuPedalDB.init();

    // Inicializar garagem e histórico
    await window.bikeGarage.init();
    await window.activityHistory.init();

    // Inicializar mapa ao vivo do gravador
    window.pedalMap.initLiveMap('live-map');

    // Carregar configurações salvas
    await this._loadSettings();

    // Registrar eventos de interface
    this._bindEvents();

    // Escutar eventos do rastreador
    this._bindTrackerEvents();

    // PWA Install prompt listener
    this._setupPWAInstall();

    // Fechar menu inferior ao tocar fora dele na tela de gravação (ignora o próprio botão do menu)
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#btn-toggle-menu')) return;
      const bottomNav = document.querySelector('.bottom-nav');
      const btnToggle = document.getElementById('btn-toggle-menu');
      if (this.currentTab === 'record' && bottomNav && bottomNav.classList.contains('revealed')) {
        if (!bottomNav.contains(e.target)) {
          bottomNav.classList.remove('revealed');
          if (btnToggle) btnToggle.classList.remove('active');
        }
      }
    });

    // Checar URL params (ex: ?tab=feed ou ?action=record)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab')) {
      this.navigateTo(urlParams.get('tab'));
    }
  }

  // --- NAVEGAÇÃO ENTRE ABAS ---

  navigateTo(tabName) {
    this.currentTab = tabName;

    // Atualizar classe do body para controlar visibilidade do menu
    document.body.className = `in-tab-${tabName}`;

    // Fechar menu inferior revelado ao voltar para o gravador
    const bottomNav = document.querySelector('.bottom-nav');
    const btnToggle = document.getElementById('btn-toggle-menu');
    if (bottomNav && tabName === 'record') {
      bottomNav.classList.remove('revealed');
      if (btnToggle) btnToggle.classList.remove('active');
    }

    // Atualizar botões da barra de navegação inferior
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    // Atualizar visualização das telas
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `tab-${tabName}`);
    });

    // Se navegou para o gravador, garantir que o mapa recalcule dimensões
    if (tabName === 'record' && window.pedalMap.liveMap) {
      this._recordTabEnteredAt = Date.now(); // marca que ACABOU de navegar para cá
      setTimeout(() => window.pedalMap.liveMap.invalidateSize(), 150);
    }

    // Se navegou para o feed, atualizar dados
    if (tabName === 'feed') {
      window.activityHistory.refresh();
    }

    // Se navegou para garagem, atualizar dados
    if (tabName === 'garage') {
      window.bikeGarage.renderGarage();
    }
  }

  // --- EVENTOS DO GRAVADOR E HUD ---

  _bindTrackerEvents() {
    window.pedalTracker.onUpdate = ({ state, currentPoint, metrics }) => {
      this._updateHUD(state, metrics);

      if (currentPoint) {
        window.pedalMap.updateLivePosition(currentPoint);
      }
    };
  }

  _updateHUD(state, metrics) {
    // Atualizar indicadores de texto do HUD
    const speedEl = document.getElementById('hud-speed');
    const distEl = document.getElementById('hud-distance');
    const timeEl = document.getElementById('hud-moving-time');
    const totalTimeEl = document.getElementById('hud-total-time');
    const elevEl = document.getElementById('hud-elevation');
    const calEl = document.getElementById('hud-calories');
    const avgSpeedEl = document.getElementById('hud-avg-speed');
    const maxSpeedEl = document.getElementById('hud-max-speed');
    const statusPill = document.getElementById('recording-status-pill');

    if (speedEl) speedEl.innerText = metrics.currentSpeedKmH.toFixed(1);
    if (distEl) distEl.innerText = metrics.distanceKm.toFixed(2);
    if (timeEl) timeEl.innerText = this._formatTimer(metrics.movingDurationSec);
    if (totalTimeEl) totalTimeEl.innerText = this._formatTimer(metrics.totalDurationSec);
    if (elevEl) elevEl.innerText = Math.round(metrics.elevationGainM);
    if (calEl) calEl.innerText = Math.round(metrics.calories);
    if (avgSpeedEl) avgSpeedEl.innerText = metrics.avgSpeedKmH.toFixed(1);
    if (maxSpeedEl) maxSpeedEl.innerText = metrics.maxSpeedKmH.toFixed(1);

    // Status visual pulsante (apenas a bolinha com o efeito, sem texto)
    if (statusPill) {
      if (state === 'RECORDING') {
        statusPill.className = 'status-pill recording';
        statusPill.title = 'Gravando';
        statusPill.innerHTML = '<span class="pulse-circle red"></span>';
      } else if (state === 'PAUSED_MANUAL' || state === 'PAUSED_AUTO') {
        statusPill.className = 'status-pill paused';
        statusPill.title = 'Pausado';
        statusPill.innerHTML = '<span class="pulse-circle yellow"></span>';
      } else {
        statusPill.className = 'status-pill stopped';
        statusPill.title = 'Pronto';
        statusPill.innerHTML = '<span class="pulse-circle green"></span>';
      }
    }

    // Alternar visibilidade dos botões de controle
    const btnStart = document.getElementById('btn-start-record');
    const btnPause = document.getElementById('btn-pause-record');
    const btnResume = document.getElementById('btn-resume-record');
    const btnFinish = document.getElementById('btn-finish-record');

    if (state === 'STOPPED') {
      if (btnStart) btnStart.style.display = 'inline-flex';
      if (btnPause) btnPause.style.display = 'none';
      if (btnResume) btnResume.style.display = 'none';
      if (btnFinish) btnFinish.style.display = 'none';
    } else if (state === 'RECORDING') {
      if (btnStart) btnStart.style.display = 'none';
      if (btnPause) btnPause.style.display = 'inline-flex';
      if (btnResume) btnResume.style.display = 'none';
      if (btnFinish) btnFinish.style.display = 'inline-flex';
    } else if (state === 'PAUSED_MANUAL' || state === 'PAUSED_AUTO') {
      if (btnStart) btnStart.style.display = 'none';
      if (btnPause) btnPause.style.display = 'none';
      if (btnResume) btnResume.style.display = 'inline-flex';
      if (btnFinish) btnFinish.style.display = 'inline-flex';
    }
  }

  // --- CONTROLES DE BOTÃO ---

  startRecording() {
    window.pedalMap.clearLive();
    window.pedalTracker.start();
  }

  pauseRecording() {
    window.pedalTracker.pause(true);
  }

  resumeRecording() {
    window.pedalTracker.resume();
  }

  finishRecording() {
    if (window.pedalTracker.distanceKm < 0.05 && window.pedalTracker.points.length < 3) {
      if (!confirm('Este pedal foi muito curto. Deseja finalizar e descartar?')) {
        return;
      }
      window.pedalTracker.stop();
      return;
    }

    const finalData = window.pedalTracker.stop();
    this.showPostRideSummary(finalData);
  }

  // --- TELA DE RESUMO PÓS-TREINO (ESTILO STRAVA) ---

  showPostRideSummary(activityData) {
    this.currentCompletedRide = activityData;
    this.photoDataUrl = null;

    const modal = document.getElementById('post-ride-modal');
    if (!modal) return;

    // Sugerir título padrão com base na hora
    const now = new Date();
    const hour = now.getHours();
    let defaultTitle = 'Giro Noturno no Asfalto 🚴';
    if (hour >= 5 && hour < 12) defaultTitle = 'Giro Matinal 🚴‍♂️';
    else if (hour >= 12 && hour < 18) defaultTitle = 'Pedal da Tarde ☀️';

    const titleInput = document.getElementById('summary-title-input');
    if (titleInput) titleInput.value = defaultTitle;

    // Preencher métricas no modal de resumo
    document.getElementById('sum-dist').innerText = activityData.distanceKm.toFixed(2);
    document.getElementById('sum-time').innerText = this._formatTimer(activityData.movingDurationSec);
    document.getElementById('sum-total-time').innerText = this._formatTimer(activityData.totalDurationSec);
    document.getElementById('sum-avg-speed').innerText = activityData.avgSpeedKmH.toFixed(1);
    document.getElementById('sum-max-speed').innerText = activityData.maxSpeedKmH.toFixed(1);
    document.getElementById('sum-elev').innerText = Math.round(activityData.elevationGainM);
    document.getElementById('sum-cal').innerText = Math.round(activityData.calories);

    // Preencher opções de bike da Garagem
    const bikeSelect = document.getElementById('summary-bike-select');
    if (bikeSelect) {
      const activeBike = window.bikeGarage.getActiveBike();
      bikeSelect.innerHTML = window.bikeGarage.bikes.map(b => `
        <option value="${b.id}" ${activeBike && activeBike.id === b.id ? 'selected' : ''}>
          ${b.name} (${b.type})
        </option>
      `).join('');
    }

    // Resetar preview de foto
    const photoPreview = document.getElementById('summary-photo-preview');
    if (photoPreview) {
      photoPreview.style.display = 'none';
      photoPreview.src = '';
    }

    // Exibir modal
    modal.classList.add('active');

    // Inicializar mapa de resumo com gradiente
    setTimeout(() => {
      window.pedalMap.initSummaryMap('summary-map-container', activityData.points);
      window.elevationChart.init(activityData.points);
      window.elevationChart.onScrub = (pt) => {
        window.pedalMap.setScrubPosition(pt.lat, pt.lng);
      };
    }, 200);
  }

  async saveCompletedRide() {
    if (!this.currentCompletedRide) return;

    const title = document.getElementById('summary-title-input').value.trim() || 'Pedal Concluído';
    const notes = document.getElementById('summary-notes-input').value.trim();
    const bikeSelect = document.getElementById('summary-bike-select');
    const selectedBikeId = bikeSelect ? bikeSelect.value : null;
    const selectedBike = window.bikeGarage.bikes.find(b => b.id === selectedBikeId);

    const activityToSave = {
      ...this.currentCompletedRide,
      title,
      notes,
      bikeId: selectedBikeId,
      bikeName: selectedBike ? selectedBike.name : 'Bicicleta',
      photo: this.photoDataUrl,
      date: new Date().toISOString()
    };

    // Salvar no IndexedDB
    const id = await window.meuPedalDB.saveActivity(activityToSave);

    // Descontar quilômetros automaticamente na Garagem da Bike!
    if (selectedBikeId && activityToSave.distanceKm > 0) {
      await window.meuPedalDB.addDistanceToBike(selectedBikeId, activityToSave.distanceKm);
    }

    // Fechar modal
    this.closePostRideSummary();

    // Navegar para o Feed e atualizar
    this.navigateTo('feed');
    await window.activityHistory.refresh();
  }

  closePostRideSummary() {
    const modal = document.getElementById('post-ride-modal');
    if (modal) modal.classList.remove('active');
    this.currentCompletedRide = null;
    this.photoDataUrl = null;
  }

  exportCurrentGPX() {
    if (!this.currentCompletedRide) return;
    const title = document.getElementById('summary-title-input').value || 'Pedal';
    window.gpxExporter.download({
      ...this.currentCompletedRide,
      title
    });
  }

  // --- MODAL DE DETALHES DE ATIVIDADE ANTERIOR ---

  showActivityDetailModal(activity) {
    const modal = document.getElementById('detail-activity-modal');
    if (!modal) return;

    document.getElementById('det-title').innerText = activity.title || 'Pedal';
    document.getElementById('det-date').innerText = new Date(activity.date).toLocaleString('pt-BR');
    document.getElementById('det-dist').innerText = (activity.distanceKm || 0).toFixed(2);
    document.getElementById('det-time').innerText = this._formatTimer(activity.movingDurationSec || 0);
    document.getElementById('det-avg-speed').innerText = (activity.avgSpeedKmH || 0).toFixed(1);
    document.getElementById('det-max-speed').innerText = (activity.maxSpeedKmH || 0).toFixed(1);
    document.getElementById('det-elev').innerText = Math.round(activity.elevationGainM || 0);
    document.getElementById('det-cal').innerText = Math.round(activity.calories || 0);

    const photoEl = document.getElementById('det-photo');
    if (activity.photo) {
      photoEl.src = activity.photo;
      photoEl.style.display = 'block';
    } else {
      photoEl.style.display = 'none';
    }

    // Configurar botão de baixar GPX do modal
    const btnGpx = document.getElementById('btn-det-gpx');
    if (btnGpx) {
      btnGpx.onclick = () => window.gpxExporter.download(activity);
    }

    modal.classList.add('active');

    setTimeout(() => {
      window.pedalMap.initSummaryMap('detail-map-container', activity.points || []);
      // Inicializar altimetria do modal
      const detailChart = new ElevationChart('detail-elevation-canvas');
      detailChart.init(activity.points || []);
      detailChart.onScrub = (pt) => {
        window.pedalMap.setScrubPosition(pt.lat, pt.lng);
      };
    }, 200);
  }

  closeActivityDetailModal() {
    const modal = document.getElementById('detail-activity-modal');
    if (modal) modal.classList.remove('active');
  }

  // --- EVENTOS E CONFIGURAÇÕES ---

  _bindEvents() {
    // Abas de navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(btn.dataset.tab);
      });
    });

    // Botão recentralizar mapa
    const btnRecenter = document.getElementById('btn-recenter');
    if (btnRecenter) {
      btnRecenter.addEventListener('click', () => {
        window.pedalMap.recenterLive();
      });
    }

    // Botões de controle de gravação
    // Cooldown de 800ms SOMENTE se o usuário veio de outra aba (evita disparo acidental com dedo na tela)
    const btnStart = document.getElementById('btn-start-record');
    if (btnStart) {
      btnStart.onclick = () => {
        // Se _recordTabEnteredAt for null, o usuário já estava na aba → inicia normalmente
        if (this._recordTabEnteredAt !== null) {
          const elapsed = Date.now() - this._recordTabEnteredAt;
          if (elapsed < 800) return; // muito próximo da navegação, ignora
          this._recordTabEnteredAt = null; // depois do cooldown, reseta
        }
        this.startRecording();
      };
    }

    const btnPause = document.getElementById('btn-pause-record');
    if (btnPause) btnPause.onclick = () => this.pauseRecording();

    const btnResume = document.getElementById('btn-resume-record');
    if (btnResume) btnResume.onclick = () => this.resumeRecording();

    const btnFinish = document.getElementById('btn-finish-record');
    if (btnFinish) btnFinish.onclick = () => this.finishRecording();

    // Minimizar e Restaurar painel de métricas do HUD
    const btnMinimize = document.getElementById('btn-minimize-dashboard');
    const btnRestore = document.getElementById('btn-restore-dashboard');

    if (btnMinimize) {
      btnMinimize.addEventListener('pointerdown', (e) => window.minimizeHudDashboard(e));
      btnMinimize.addEventListener('click', (e) => window.minimizeHudDashboard(e));
    }

    if (btnRestore) {
      btnRestore.addEventListener('pointerdown', (e) => window.restoreHudDashboard(e));
      btnRestore.addEventListener('click', (e) => window.restoreHudDashboard(e));
    }

    const btnToggleMenu = document.getElementById('btn-toggle-menu');
    if (btnToggleMenu) {
      btnToggleMenu.addEventListener('pointerdown', (e) => window.toggleBottomMenu(e));
      btnToggleMenu.addEventListener('click', (e) => window.toggleBottomMenu(e));
    }

    // Botões de controle de gravação Pós-Treino
    const photoInput = document.getElementById('summary-photo-input');
    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.photoDataUrl = ev.target.result;
            const preview = document.getElementById('summary-photo-preview');
            if (preview) {
              preview.src = this.photoDataUrl;
              preview.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Modal de adicionar bike na garagem
    const btnNewBike = document.getElementById('btn-add-bike');
    if (btnNewBike) {
      btnNewBike.onclick = () => {
        const modal = document.getElementById('new-bike-modal');
        if (modal) modal.classList.add('active');
      };
    }

    // Formulário de nova bike
    const formNewBike = document.getElementById('form-new-bike');
    if (formNewBike) {
      formNewBike.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-bike-name').value.trim();
        const type = document.getElementById('new-bike-type').value;
        const km = document.getElementById('new-bike-km').value;
        if (name) {
          await window.bikeGarage.addBike(name, type, km);
          document.getElementById('new-bike-modal').classList.remove('active');
          formNewBike.reset();
        }
      };
    }

    // Configurações do Áudio Coach
    const audioToggle = document.getElementById('cfg-audio-toggle');
    if (audioToggle) {
      audioToggle.addEventListener('change', async (e) => {
        window.audioCoach.enabled = e.target.checked;
        await this._saveCurrentSettings();
      });
    }

    const audioInterval = document.getElementById('cfg-audio-interval');
    if (audioInterval) {
      audioInterval.addEventListener('change', async (e) => {
        window.audioCoach.intervalKm = Number(e.target.value) || 1.0;
        await this._saveCurrentSettings();
      });
    }

    const btnTestVoice = document.getElementById('btn-test-voice');
    if (btnTestVoice) {
      btnTestVoice.onclick = () => window.audioCoach.testVoice();
    }

    // Peso do ciclista
    const weightInput = document.getElementById('cfg-cyclist-weight');
    if (weightInput) {
      weightInput.addEventListener('change', async (e) => {
        window.pedalTracker.cyclistWeightKg = Number(e.target.value) || 75;
        await this._saveCurrentSettings();
      });
    }
  }

  async _loadSettings() {
    const settings = (await window.meuPedalDB.getSetting('appSettings')) || {};

    const audioToggle = document.getElementById('cfg-audio-toggle');
    if (audioToggle && settings.audioCoachEnabled !== undefined) {
      audioToggle.checked = settings.audioCoachEnabled;
      window.audioCoach.enabled = settings.audioCoachEnabled;
    }

    const audioInterval = document.getElementById('cfg-audio-interval');
    if (audioInterval && settings.audioIntervalKm) {
      audioInterval.value = settings.audioIntervalKm;
      window.audioCoach.intervalKm = settings.audioIntervalKm;
    }

    const weightInput = document.getElementById('cfg-cyclist-weight');
    if (weightInput && settings.cyclistWeightKg) {
      weightInput.value = settings.cyclistWeightKg;
      window.pedalTracker.cyclistWeightKg = settings.cyclistWeightKg;
    }
  }

  async _saveCurrentSettings() {
    const audioToggle = document.getElementById('cfg-audio-toggle');
    const audioInterval = document.getElementById('cfg-audio-interval');
    const weightInput = document.getElementById('cfg-cyclist-weight');

    const settings = {
      audioCoachEnabled: audioToggle ? audioToggle.checked : true,
      audioIntervalKm: audioInterval ? Number(audioInterval.value) : 1,
      cyclistWeightKg: weightInput ? Number(weightInput.value) : 75,
      activeBikeId: window.bikeGarage.activeBikeId
    };

    await window.meuPedalDB.saveSetting('appSettings', settings);
  }

  // --- PWA INSTALLATION BANNER ---

  _setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'flex';
    });

    const btnInstall = document.getElementById('btn-pwa-install');
    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log(`User response to install: ${outcome}`);
          this.deferredPrompt = null;
          const banner = document.getElementById('pwa-install-banner');
          if (banner) banner.style.display = 'none';
        }
      });
    }
  }

  _formatTimer(totalSec) {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = Math.floor(totalSec % 60);

    const pad = (n) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }
}

// Inicializar quando o DOM carregar
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Falha no registro do Service Worker:', err);
    });
  });
}
