/**
 * Serviço de Integração com Firebase Firestore e Histórico em Nuvem
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVIK1h3PFb_4PGAmDiGTNDmggT00uvgsQ",
  authDomain: "koppertcvstopdf.firebaseapp.com",
  projectId: "koppertcvstopdf",
  storageBucket: "koppertcvstopdf.firebasestorage.app",
  messagingSenderId: "69325345987",
  appId: "1:69325345987:web:a05069c195be12dd8cfe76",
  measurementId: "G-SWTLQ7B8TV"
};

export class FirebaseHistoryService {
  constructor() {
    this.app = null;
    this.analytics = null;
    this.db = null;
    this.collectionName = "graficos_historico";
    this.init();
  }

  init() {
    try {
      this.app = initializeApp(firebaseConfig);
      // Analytics só roda em ambiente com window/navegador
      if (typeof window !== 'undefined') {
        try {
          this.analytics = getAnalytics(this.app);
        } catch (e) {
          console.warn('Analytics não inicializado:', e);
        }
      }
      this.db = getFirestore(this.app);
      console.log('Firebase Firestore conectado com sucesso para Koppert.');
    } catch (err) {
      console.error('Erro ao inicializar Firebase:', err);
    }
  }

  /**
   * Salva o gráfico e metadados no Firebase Firestore (com fallback para localStorage)
   */
  async saveChartHistory(record) {
    const dataToSave = {
      filename: record.filename || 'dados_telemetria.csv',
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      totalRows: record.totalRows || 0,
      sensorCount: record.sensors ? record.sensors.length : 0,
      sensorsSummary: (record.sensors || []).map(s => ({
        name: s.name,
        type: s.type,
        unit: s.unit,
        stats: s.stats || null
      })),
      csvData: record.csvRaw ? record.csvRaw.substring(0, 500000) : '' // Limite seguro para Firestore
    };

    // Sempre salva em cache local
    this.saveToLocalCache(dataToSave);

    if (this.db) {
      try {
        const colRef = collection(this.db, this.collectionName);
        const docRef = await addDoc(colRef, dataToSave);
        console.log('Gráfico salvo no Firestore com ID:', docRef.id);
        return { success: true, id: docRef.id, source: 'firestore' };
      } catch (err) {
        console.warn('Não foi possível salvar no Firestore (possível regra de segurança). Salvo localmente.', err);
        return { success: true, id: 'local_' + Date.now(), source: 'local' };
      }
    }

    return { success: true, id: 'local_' + Date.now(), source: 'local' };
  }

  /**
   * Carrega a lista de gráficos salvos
   */
  async loadHistory() {
    const results = [];

    // Tenta carregar do Firestore
    if (this.db) {
      try {
        const colRef = collection(this.db, this.collectionName);
        const q = query(colRef, orderBy("createdAt", "desc"), limit(30));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(docSnap => {
          results.push({
            id: docSnap.id,
            ...docSnap.data(),
            source: 'firestore'
          });
        });
      } catch (err) {
        console.warn('Erro ao carregar do Firestore. Usando cache local.', err);
      }
    }

    // Se Firestore estiver vazio ou falhar, junta com o cache local
    const localItems = this.loadFromLocalCache();
    localItems.forEach(localItem => {
      if (!results.find(r => r.createdAt === localItem.createdAt)) {
        results.push({ ...localItem, source: 'local' });
      }
    });

    // Ordenar por data mais recente
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Deleta um item do histórico
   */
  async deleteItem(id, source = 'firestore') {
    if (source === 'firestore' && this.db && !id.startsWith('local_')) {
      try {
        await deleteDoc(doc(this.db, this.collectionName, id));
      } catch (e) {
        console.warn('Erro ao deletar do Firestore:', e);
      }
    }
    this.deleteFromLocalCache(id);
    return true;
  }

  // Métodos de Cache Local (Offline / Fallback)
  saveToLocalCache(record) {
    try {
      const existing = this.loadFromLocalCache();
      const newRecord = { ...record, id: 'local_' + Date.now() };
      existing.unshift(newRecord);
      // Manter até 20 itens locais
      localStorage.setItem('koppert_charts_history', JSON.stringify(existing.slice(0, 20)));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  }

  loadFromLocalCache() {
    try {
      const data = localStorage.getItem('koppert_charts_history');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  deleteFromLocalCache(id) {
    try {
      let existing = this.loadFromLocalCache();
      existing = existing.filter(item => item.id !== id);
      localStorage.setItem('koppert_charts_history', JSON.stringify(existing));
    } catch (e) {
      console.warn('Erro ao deletar do localStorage:', e);
    }
  }
}
