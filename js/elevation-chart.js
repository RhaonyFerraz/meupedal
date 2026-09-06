// Gráfico de Altimetria Interativo com Canvas
class ElevationChart {
  constructor(canvasId = 'elevation-canvas') {
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.hoverIndex = null;
    this.onScrub = null; // func(point)
  }

  init(points = []) {
    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.points = points;
    this.hoverIndex = null;

    this._setupResize();
    this._setupInteractions();
    this.render();
  }

  _setupResize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = (rect.width || 340) * dpr;
    this.canvas.height = 140 * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width || 340;
    this.height = 140;
  }

  _setupInteractions() {
    const handleMove = (clientX) => {
      if (!this.points || this.points.length < 2) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / this.width));
      const idx = Math.round(ratio * (this.points.length - 1));

      this.hoverIndex = idx;
      this.render();

      const pt = this.points[idx];
      if (this.onScrub && pt) {
        this.onScrub(pt);
      }
    };

    const handleLeave = () => {
      this.hoverIndex = null;
      this.render();
      if (window.pedalMap) window.pedalMap.hideScrubPosition();
      const tooltip = document.getElementById('elevation-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    this.canvas.onmousemove = (e) => handleMove(e.clientX);
    this.canvas.onmouseleave = handleLeave;

    this.canvas.ontouchmove = (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };
    this.canvas.ontouchend = handleLeave;
  }

  render() {
    if (!this.ctx || !this.points || this.points.length < 2) {
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Sem dados de altimetria disponíveis', this.width / 2, this.height / 2);
      }
      return;
    }

    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const alts = this.points.map(p => p.alt || 0);
    const minAlt = Math.floor(Math.min(...alts) - 2);
    const maxAlt = Math.ceil(Math.max(...alts) + 5);
    const altRange = Math.max(15, maxAlt - minAlt);

    const paddingBottom = 22;
    const paddingTop = 15;
    const chartH = h - paddingBottom - paddingTop;

    // Gradiente esportivo verde vivo translúcido
    const gradient = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.45)');
    gradient.addColorStop(0.7, 'rgba(0, 230, 118, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    // Iniciar traçado de relevo
    ctx.beginPath();
    const firstY = h - paddingBottom - ((alts[0] - minAlt) / altRange) * chartH;
    ctx.moveTo(0, firstY);

    for (let i = 1; i < this.points.length; i++) {
      const x = (i / (this.points.length - 1)) * w;
      const y = h - paddingBottom - ((alts[i] - minAlt) / altRange) * chartH;
      ctx.lineTo(x, y);
    }

    // Fechar polígono para preenchimento de gradiente
    ctx.lineTo(w, h - paddingBottom);
    ctx.lineTo(0, h - paddingBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Linha superior destacada (Stroke)
    ctx.beginPath();
    ctx.moveTo(0, firstY);
    for (let i = 1; i < this.points.length; i++) {
      const x = (i / (this.points.length - 1)) * w;
      const y = h - paddingBottom - ((alts[i] - minAlt) / altRange) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Linha de base
    ctx.beginPath();
    ctx.moveTo(0, h - paddingBottom);
    ctx.lineTo(w, h - paddingBottom);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rótulos de altitude mínima e máxima
    ctx.fillStyle = '#8e8e93';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${minAlt} m`, 6, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`${maxAlt} m`, w - 6, paddingTop + 2);

    // Linha e indicador de scrub quando o usuário passa o dedo/mouse
    if (this.hoverIndex !== null && this.points[this.hoverIndex]) {
      const pt = this.points[this.hoverIndex];
      const hx = (this.hoverIndex / (this.points.length - 1)) * w;
      const hy = h - paddingBottom - ((pt.alt - minAlt) / altRange) * chartH;

      // Linha vertical
      ctx.beginPath();
      ctx.moveTo(hx, paddingTop);
      ctx.lineTo(hx, h - paddingBottom);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ponto na curva
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Atualizar tooltip flutuante
      const tooltip = document.getElementById('elevation-tooltip');
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <strong>${Math.round(pt.alt)}m</strong> alt | 
          <span>${pt.distance ? pt.distance.toFixed(1) : 0} km</span> | 
          <span style="color: #00e676;">${pt.speed ? pt.speed.toFixed(1) : 0} km/h</span>
        `;
      }
    }
  }
}

window.elevationChart = new ElevationChart();
