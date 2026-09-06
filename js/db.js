// IndexedDB Wrapper para o MeuPedal
class MeuPedalDB {
  constructor() {
    this.dbName = 'MeuPedalDatabase';
    this.version = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tabela de atividades / pedais
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
          actStore.createIndex('date', 'date', { unique: false });
          actStore.createIndex('distanceKm', 'distanceKm', { unique: false });
        }

        // Tabela da Garagem (Bikes e peças)
        if (!db.objectStoreNames.contains('bikes')) {
          db.createObjectStore('bikes', { keyPath: 'id' });
        }

        // Tabela de Recordes Pessoais (PRs)
        if (!db.objectStoreNames.contains('prs')) {
          db.createObjectStore('prs', { keyPath: 'key' });
        }

        // Configurações do usuário
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this._seedDefaults();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Erro ao abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async _seedDefaults() {
    // Verificar se existe bike padrão
    const bikes = await this.getAllBikes();
    if (bikes.length === 0) {
      await this.saveBike({
        id: 'bike-default',
        name: 'Minha Bicicleta Principal',
        type: 'road',
        isDefault: true,
        totalKm: 0,
        components: {
          chain: { name: 'Corrente', currentKm: 0, maxKm: 3000, lastReplaced: new Date().toISOString() },
          frontTire: { name: 'Pneu Dianteiro', currentKm: 0, maxKm: 4500, lastReplaced: new Date().toISOString() },
          rearTire: { name: 'Pneu Traseiro', currentKm: 0, maxKm: 3200, lastReplaced: new Date().toISOString() },
          brakePads: { name: 'Pastilhas de Freio', currentKm: 0, maxKm: 2500, lastReplaced: new Date().toISOString() },
          cables: { name: 'Cabos & Conduítes', currentKm: 0, maxKm: 5000, lastReplaced: new Date().toISOString() }
        }
      });
    }

    // Configurações padrão
    const settings = await this.getSetting('appSettings');
    if (!settings) {
      await this.saveSetting('appSettings', {
        audioCoachEnabled: true,
        audioIntervalKm: 1,
        autoPauseEnabled: true,
        autoPauseSpeedKmH: 2.5,
        cyclistWeightKg: 75,
        bikeWeightKg: 10,
        activeBikeId: 'bike-default'
      });
    }
  }

  // --- ATIVIDADES ---
  async saveActivity(activity) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['activities'], 'readwrite');
      const store = tx.objectStore('activities');
      if (!activity.date) activity.date = new Date().toISOString();
      const req = store.put(activity);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllActivities() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['activities'], 'readonly');
      const store = tx.objectStore('activities');
      const req = store.getAll();
      req.onsuccess = () => {
        // Ordenar do mais recente para o mais antigo
        const list = req.result || [];
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getActivityById(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['activities'], 'readonly');
      const store = tx.objectStore('activities');
      const req = store.get(Number(id) || id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteActivity(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['activities'], 'readwrite');
      const store = tx.objectStore('activities');
      const req = store.delete(Number(id) || id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- BIKES / GARAGEM ---
  async getAllBikes() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['bikes'], 'readonly');
      const store = tx.objectStore('bikes');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getBike(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['bikes'], 'readonly');
      const store = tx.objectStore('bikes');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBike(bike) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['bikes'], 'readwrite');
      const store = tx.objectStore('bikes');
      const req = store.put(bike);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteBike(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['bikes'], 'readwrite');
      const store = tx.objectStore('bikes');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Debitar quilometragem na bike e componentes
  async addDistanceToBike(bikeId, distanceKm) {
    if (!bikeId) return;
    const bike = await this.getBike(bikeId);
    if (!bike) return;

    bike.totalKm = Number(((bike.totalKm || 0) + distanceKm).toFixed(2));
    if (bike.components) {
      for (const key of Object.keys(bike.components)) {
        const comp = bike.components[key];
        comp.currentKm = Number(((comp.currentKm || 0) + distanceKm).toFixed(2));
      }
    }
    await this.saveBike(bike);
    return bike;
  }

  // --- RECORDES PESSOAIS (PRs) ---
  async getPRs() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['prs'], 'readonly');
      const store = tx.objectStore('prs');
      const req = store.getAll();
      req.onsuccess = () => {
        const map = {};
        (req.result || []).forEach(item => map[item.key] = item);
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updatePR(key, value, activityId, meta = {}) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['prs'], 'readwrite');
      const store = tx.objectStore('prs');
      const req = store.put({
        key,
        value,
        activityId,
        date: new Date().toISOString(),
        ...meta
      });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- CONFIGURAÇÕES ---
  async getSetting(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['settings'], 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['settings'], 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}

// Singleton global
window.meuPedalDB = new MeuPedalDB();
