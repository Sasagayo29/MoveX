// src/db.js

const DB_NAME = 'MovimexOfflineDB';
const DB_VERSION = 1;

// Inicializa o banco de dados IndexedDB
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Tabela de Itens/Notas
      if (!db.objectStoreNames.contains('itens')) {
        db.createObjectStore('itens', { keyPath: 'id', autoIncrement: true });
      }
      
      // Tabela de Impressoras
      if (!db.objectStoreNames.contains('impressoras')) {
        db.createObjectStore('impressoras', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

// Salva dados baixados do servidor
export const salvarSincronizacao = async (tabela, dados) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tabela, 'readwrite');
    const store = transaction.objectStore(tabela);
    
    // Limpa a tabela antes de salvar os dados novos
    store.clear();
    
    dados.forEach(item => store.add(item));
    
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Busca em todo o banco offline (Impressoras ou Itens)
export const buscarOffline = async (tabela, termo) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tabela, 'readonly');
    const store = transaction.objectStore(tabela);
    const request = store.getAll();

    request.onsuccess = () => {
      const todos = request.result;
      // Filtra localmente usando o campo de busca global que criamos no Python
      const resultados = todos.filter(item => 
        item.busca_global.includes(termo.toUpperCase())
      );
      resolve(resultados);
    };
    
    request.onerror = () => reject(request.error);
  });
};