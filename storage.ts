
import { Project } from './types';

const DB_NAME = 'VeoContinuityDB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllProjects = async (): Promise<Project[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveAllProjects = async (projects: Project[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear and rewrite to sync with state array
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      if (projects.length === 0) {
        resolve();
        return;
      }

      let completed = 0;
      projects.forEach((project) => {
        const addRequest = store.add(project);
        addRequest.onsuccess = () => {
          completed++;
          if (completed === projects.length) resolve();
        };
        addRequest.onerror = () => reject(addRequest.error);
      });
    };
    
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};
