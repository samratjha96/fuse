/**
 * Storage layer for managing source files using IndexedDB and OPFS
 */

const DB_NAME = 'fuse-editor';
const DB_VERSION = 1;
const STORE_NAME = 'sources';

interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
  createdAt: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Store a file in IndexedDB
 */
export async function storeFile(file: File): Promise<string> {
  if (!db) await initStorage();

  const id = crypto.randomUUID();
  const arrayBuffer = await file.arrayBuffer();

  const storedFile: StoredFile = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    data: arrayBuffer,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(storedFile);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a file from IndexedDB
 */
export async function getFile(id: string): Promise<StoredFile | null> {
  if (!db) await initStorage();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get file data as ArrayBuffer
 */
export async function getFileData(id: string): Promise<ArrayBuffer | null> {
  const file = await getFile(id);
  return file?.data || null;
}

/**
 * Delete a file from IndexedDB
 */
export async function deleteFile(id: string): Promise<void> {
  if (!db) await initStorage();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all stored files
 */
export async function listFiles(): Promise<Omit<StoredFile, 'data'>[]> {
  if (!db) await initStorage();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const files = request.result.map(({ data: _, ...rest }) => rest);
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all stored files
 */
export async function clearStorage(): Promise<void> {
  if (!db) await initStorage();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get storage usage info
 */
export async function getStorageInfo(): Promise<{ used: number; available: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      available: estimate.quota || 0,
    };
  }
  return { used: 0, available: 0 };
}
