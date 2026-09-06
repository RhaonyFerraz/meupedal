// Módulo da Garagem da Bike (Controle automático de desgaste de componentes)
class BikeGarage {
  constructor() {
    this.bikes = [];
    this.activeBikeId = null;
  }

  async init() {
    this.bikes = await window.meuPedalDB.getAllBikes();
    const settings = await window.meuPedalDB.getSetting('appSettings');
    this.activeBikeId = (settings && settings.activeBikeId) || (this.bikes[0] ? this.bikes[0].id : null);
    this.renderGarage();
  }

  getActiveBike() {
    return this.bikes.find(b => b.id === this.activeBikeId) || this.bikes[0] || null;
  }

  async setActiveBike(bikeId) {
    this.activeBikeId = bikeId;
    const settings = (await window.meuPedalDB.getSetting('appSettings')) || {};
    settings.activeBikeId = bikeId;
    await window.meuPedalDB.saveSetting('appSettings', settings);
    this.renderGarage();
  }

  async addBike(name, type = 'road', initialKm = 0) {
    const id = 'bike-' + Date.now();
    const newBike = {
      id,
      name: name || 'Nova Bicicleta',
      type: type,
      totalKm: Number(initialKm) || 0,
      components: {
        chain: { name: 'Corrente de Transmissão', currentKm: Number(initialKm) || 0, maxKm: 3000, lastReplaced: new Date().toISOString() },
        frontTire: { name: 'Pneu Dianteiro', currentKm: Number(initialKm) || 0, maxKm: 4500, lastReplaced: new Date().toISOString() },
        rearTire: { name: 'Pneu Traseiro', currentKm: Number(initialKm) || 0, maxKm: 3200, lastReplaced: new Date().toISOString() },
        brakePads: { name: 'Pastilhas de Freio', currentKm: Number(initialKm) || 0, maxKm: 2500, lastReplaced: new Date().toISOString() },
        cables: { name: 'Cabos & Conduítes', currentKm: Number(initialKm) || 0, maxKm: 5000, lastReplaced: new Date().toISOString() }
      }
    };

    await window.meuPedalDB.saveBike(newBike);
    this.bikes.push(newBike);
    if (!this.activeBikeId) {
      await this.setActiveBike(id);
    } else {
      this.renderGarage();
    }
    return newBike;
  }

  async replaceComponent(bikeId, componentKey) {
    const bike = this.bikes.find(b => b.id === bikeId);
    if (!bike || !bike.components[componentKey]) return;

    bike.components[componentKey].currentKm = 0;
    bike.components[componentKey].lastReplaced = new Date().toISOString();

    await window.meuPedalDB.saveBike(bike);
    this.renderGarage();
  }

  async deleteBike(bikeId) {
    if (this.bikes.length <= 1) {
      alert('Você precisa manter pelo menos uma bicicleta na garagem.');
      return;
    }

    if (confirm('Deseja realmente remover esta bicicleta da sua garagem?')) {
      await window.meuPedalDB.deleteBike(bikeId);
      this.bikes = this.bikes.filter(b => b.id !== bikeId);
      if (this.activeBikeId === bikeId) {
        this.activeBikeId = this.bikes[0].id;
      }
      this.renderGarage();
    }
  }

  renderGarage() {
    const container = document.getElementById('garage-bikes-list');
    if (!container) return;

    if (this.bikes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Nenhuma bike cadastrada na garagem.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.bikes.map(bike => {
      const isActive = bike.id === this.activeBikeId;
      const typeLabel = { road: 'Speed / Estrada', mtb: 'Mountain Bike', gravel: 'Gravel', urban: 'Urbana' }[bike.type] || 'Bicicleta';

      // Gerar HTML de cada componente
      let compHtml = '';
      if (bike.components) {
        for (const [key, comp] of Object.entries(bike.components)) {
          const pct = Math.min(100, Math.round((comp.currentKm / comp.maxKm) * 100));
          const remainingKm = Math.max(0, comp.maxKm - comp.currentKm);
          
          let statusColor = '#00e676';
          let statusText = 'Em dia';
          if (pct >= 100) {
            statusColor = '#ff3b30';
            statusText = 'Troca Urgente!';
          } else if (pct >= 80) {
            statusColor = '#fc4c02';
            statusText = 'Atenção';
          } else if (pct >= 60) {
            statusColor = '#ffb300';
            statusText = 'Desgaste médio';
          }

          compHtml += `
            <div class="component-card">
              <div class="comp-header">
                <span class="comp-name">${comp.name}</span>
                <span class="comp-badge" style="background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44;">
                  ${statusText}
                </span>
              </div>
              
              <div class="comp-bar-wrapper">
                <div class="comp-bar-fill" style="width: ${pct}%; background-color: ${statusColor};"></div>
              </div>

              <div class="comp-stats">
                <span>${comp.currentKm.toFixed(0)} km rodados (${pct}%)</span>
                <span>Restam: ${remainingKm.toFixed(0)} km</span>
              </div>

              <div class="comp-actions">
                <button class="btn-sm btn-subtle" onclick="window.bikeGarage.replaceComponent('${bike.id}', '${key}')">
                  🔄 Marcar como Trocada
                </button>
              </div>
            </div>
          `;
        }
      }

      return `
        <div class="bike-card ${isActive ? 'active-bike' : ''}">
          <div class="bike-card-header">
            <div>
              <div class="bike-title-row">
                <h3 class="bike-name">${bike.name}</h3>
                ${isActive ? '<span class="active-tag">BIKE ATIVA</span>' : ''}
              </div>
              <p class="bike-type">${typeLabel} • <strong>${bike.totalKm.toFixed(1)} km totais</strong></p>
            </div>
            <div class="bike-header-actions">
              ${!isActive ? `<button class="btn-sm btn-primary" onclick="window.bikeGarage.setActiveBike('${bike.id}')">Selecionar</button>` : ''}
              <button class="btn-icon-danger" onclick="window.bikeGarage.deleteBike('${bike.id}')" title="Excluir bike">🗑️</button>
            </div>
          </div>

          <div class="components-grid">
            ${compHtml}
          </div>
        </div>
      `;
    }).join('');
  }
}

window.bikeGarage = new BikeGarage();
