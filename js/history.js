// Histórico de Treinos, Feed Estilo Strava, Estatísticas Semanais/Mensais e PRs
class ActivityHistory {
  constructor() {
    this.activities = [];
    this.prs = {};
  }

  async init() {
    await this.refresh();
  }

  async refresh() {
    this.activities = await window.meuPedalDB.getAllActivities();
    await this.computeAndSavePRs();
    this.renderStats();
    this.renderPRs();
    this.renderFeed();
  }

  // --- CÁLCULO DE ESTATÍSTICAS DA SEMANA E MÊS ---

  getStats() {
    const now = new Date();
    
    // Início da semana (Segunda-feira)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Início do mês
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekStats = { distanceKm: 0, count: 0, elevationM: 0, durationSec: 0 };
    const monthStats = { distanceKm: 0, count: 0, elevationM: 0, durationSec: 0 };

    for (const act of this.activities) {
      const actDate = new Date(act.date);
      const dist = act.distanceKm || 0;
      const elev = act.elevationGainM || 0;
      const dur = act.movingDurationSec || 0;

      if (actDate >= startOfWeek) {
        weekStats.distanceKm += dist;
        weekStats.count += 1;
        weekStats.elevationM += elev;
        weekStats.durationSec += dur;
      }

      if (actDate >= startOfMonth) {
        monthStats.distanceKm += dist;
        monthStats.count += 1;
        monthStats.elevationM += elev;
        monthStats.durationSec += dur;
      }
    }

    return { weekStats, monthStats };
  }

  // --- CÁLCULO DE RECORDES PESSOAIS (PRs) ---

  async computeAndSavePRs() {
    if (this.activities.length === 0) {
      this.prs = {};
      return;
    }

    let longest = { val: 0, act: null };
    let fastest = { val: 0, act: null };
    let highest = { val: 0, act: null };
    let longestTime = { val: 0, act: null };

    for (const act of this.activities) {
      if ((act.distanceKm || 0) > longest.val) {
        longest = { val: act.distanceKm, act };
      }
      if ((act.maxSpeedKmH || 0) > fastest.val) {
        fastest = { val: act.maxSpeedKmH, act };
      }
      if ((act.elevationGainM || 0) > highest.val) {
        highest = { val: act.elevationGainM, act };
      }
      if ((act.movingDurationSec || 0) > longestTime.val) {
        longestTime = { val: act.movingDurationSec, act };
      }
    }

    this.prs = {
      longestRide: longest.act ? { distanceKm: longest.val, title: longest.act.title, date: longest.act.date } : null,
      maxSpeed: fastest.act ? { speedKmH: fastest.val, title: fastest.act.title, date: fastest.act.date } : null,
      maxElevation: highest.act ? { elevationM: highest.val, title: highest.act.title, date: highest.act.date } : null,
      longestDuration: longestTime.act ? { durationSec: longestTime.val, title: longestTime.act.title, date: longestTime.act.date } : null
    };
  }

  // --- RENDERIZAÇÃO ---

  renderStats() {
    const { weekStats, monthStats } = this.getStats();

    const weekKmEl = document.getElementById('stat-week-km');
    const weekCountEl = document.getElementById('stat-week-count');
    const weekElevEl = document.getElementById('stat-week-elev');

    const monthKmEl = document.getElementById('stat-month-km');
    const monthCountEl = document.getElementById('stat-month-count');
    const monthElevEl = document.getElementById('stat-month-elev');

    if (weekKmEl) weekKmEl.innerText = weekStats.distanceKm.toFixed(1);
    if (weekCountEl) weekCountEl.innerText = `${weekStats.count} pedais`;
    if (weekElevEl) weekElevEl.innerText = `${Math.round(weekStats.elevationM)}m subida`;

    if (monthKmEl) monthKmEl.innerText = monthStats.distanceKm.toFixed(1);
    if (monthCountEl) monthCountEl.innerText = `${monthStats.count} pedais`;
    if (monthElevEl) monthElevEl.innerText = `${Math.round(monthStats.elevationM)}m subida`;
  }

  renderPRs() {
    const prContainer = document.getElementById('prs-container');
    if (!prContainer) return;

    const prs = this.prs;
    const formatDur = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    prContainer.innerHTML = `
      <div class="pr-card">
        <div class="pr-icon">🏆</div>
        <div class="pr-info">
          <span class="pr-label">Pedal Mais Longo</span>
          <strong class="pr-value">${prs.longestRide ? `${prs.longestRide.distanceKm.toFixed(1)} km` : '--'}</strong>
          <span class="pr-sub">${prs.longestRide ? prs.longestRide.title : 'Sem registro'}</span>
        </div>
      </div>

      <div class="pr-card">
        <div class="pr-icon">⚡</div>
        <div class="pr-info">
          <span class="pr-label">Maior Vel. Máxima</span>
          <strong class="pr-value">${prs.maxSpeed ? `${prs.maxSpeed.speedKmH.toFixed(1)} km/h` : '--'}</strong>
          <span class="pr-sub">${prs.maxSpeed ? prs.maxSpeed.title : 'Sem registro'}</span>
        </div>
      </div>

      <div class="pr-card">
        <div class="pr-icon">⛰️</div>
        <div class="pr-info">
          <span class="pr-label">Maior Altimetria</span>
          <strong class="pr-value">${prs.maxElevation ? `${Math.round(prs.maxElevation.elevationM)} m` : '--'}</strong>
          <span class="pr-sub">${prs.maxElevation ? prs.maxElevation.title : 'Sem registro'}</span>
        </div>
      </div>

      <div class="pr-card">
        <div class="pr-icon">⏱️</div>
        <div class="pr-info">
          <span class="pr-label">Maior Tempo no Selim</span>
          <strong class="pr-value">${prs.longestDuration ? formatDur(prs.longestDuration.durationSec) : '--'}</strong>
          <span class="pr-sub">${prs.longestDuration ? prs.longestDuration.title : 'Sem registro'}</span>
        </div>
      </div>
    `;
  }

  renderFeed() {
    const container = document.getElementById('activities-feed');
    if (!container) return;

    if (this.activities.length === 0) {
      container.innerHTML = `
        <div class="empty-feed">
          <div class="empty-icon">🚴‍♂️</div>
          <h3>Nenhum pedal gravado ainda</h3>
          <p>Ligue o gravador, suba na bicicleta e registre seus primeiros quilômetros!</p>
          <button class="btn-primary" onclick="window.app.navigateTo('record')">
            Iniciar Primeiro Pedal
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.activities.map(act => {
      const dateFormatted = this._formatDate(act.date);
      const movingTimeFormatted = this._formatDuration(act.movingDurationSec || 0);
      const miniSvg = this._generateMiniSvgPath(act.points || []);

      return `
        <article class="feed-card" data-id="${act.id}">
          <header class="feed-card-header">
            <div class="user-avatar-badge">🚴</div>
            <div class="feed-title-meta">
              <h3 class="feed-card-title">${this._escape(act.title || 'Pedal')}</h3>
              <div class="feed-card-subtitle">
                <span>${dateFormatted}</span>
                ${act.bikeName ? ` • <span class="bike-badge">🚲 ${this._escape(act.bikeName)}</span>` : ''}
              </div>
            </div>
            <button class="btn-icon-more" onclick="window.activityHistory.openActivityDetail(${act.id})" title="Ver detalhes completos">
              🔍
            </button>
          </header>

          ${act.photo ? `
            <div class="feed-photo-wrapper">
              <img src="${act.photo}" alt="Foto do pedal" class="feed-photo" loading="lazy" />
            </div>
          ` : ''}

          <!-- Miniatura do Traçado GPS -->
          ${miniSvg ? `
            <div class="feed-route-preview" onclick="window.activityHistory.openActivityDetail(${act.id})">
              ${miniSvg}
            </div>
          ` : ''}

          <!-- Grid de Métricas do Card -->
          <div class="feed-metrics-grid">
            <div class="feed-metric">
              <span class="m-label">Distância</span>
              <span class="m-val">${(act.distanceKm || 0).toFixed(1)} <small>km</small></span>
            </div>

            <div class="feed-metric">
              <span class="m-label">Tempo</span>
              <span class="m-val">${movingTimeFormatted}</span>
            </div>

            <div class="feed-metric">
              <span class="m-label">Elev. Ganha</span>
              <span class="m-val">${Math.round(act.elevationGainM || 0)} <small>m</small></span>
            </div>

            <div class="feed-metric">
              <span class="m-label">Vel. Média</span>
              <span class="m-val">${(act.avgSpeedKmH || 0).toFixed(1)} <small>km/h</small></span>
            </div>
          </div>

          <footer class="feed-card-footer">
            <button class="btn-action-sm" onclick="window.activityHistory.exportGPX(${act.id})">
              📥 Baixar .GPX
            </button>
            <button class="btn-action-sm" onclick="window.activityHistory.openActivityDetail(${act.id})">
              📊 Ver Altimetria
            </button>
            <button class="btn-action-sm btn-danger-subtle" onclick="window.activityHistory.deleteRide(${act.id})" title="Excluir">
              🗑️
            </button>
          </footer>
        </article>
      `;
    }).join('');
  }

  async openActivityDetail(id) {
    const act = await window.meuPedalDB.getActivityById(id);
    if (!act) return;

    window.app.showActivityDetailModal(act);
  }

  async exportGPX(id) {
    const act = await window.meuPedalDB.getActivityById(id);
    if (!act) return;
    window.gpxExporter.download(act);
  }

  async deleteRide(id) {
    if (confirm('Deseja realmente apagar este pedal do seu histórico?')) {
      await window.meuPedalDB.deleteActivity(id);
      await this.refresh();
    }
  }

  // Gera uma miniatura SVG rápida a partir dos pontos de GPS
  _generateMiniSvgPath(points) {
    if (!points || points.length < 2) return '';

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    const width = 300;
    const height = 90;
    const padding = 12;

    const pathData = points.map((p, i) => {
      const x = padding + ((p.lng - minLng) / lngSpan) * (width - 2 * padding);
      // Inverter Y porque latitude maior fica em cima
      const y = height - padding - ((p.lat - minLat) / latSpan) * (height - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="mini-route-svg">
        <path d="${pathData}" fill="none" stroke="#fc4c02" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  _formatDate(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('pt-BR', options);
  }

  _formatDuration(sec) {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  _escape(str) {
    return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.activityHistory = new ActivityHistory();
