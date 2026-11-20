import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_FOLDERS,
  FolderRecord,
  PdfFileRecord,
  TaskRecord,
} from '../types/pdf';

const DB_NAME = 'PdfMakerOfflineDB';
const DB_VERSION = 1;

const STORE_FILES = 'files';
const STORE_FOLDERS = 'folders';
const STORE_TASKS = 'tasks';
const STORE_SETTINGS = 'settings';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const filesStore = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        filesStore.createIndex('folderId', 'folderId', { unique: false });
        filesStore.createIndex('createdAt', 'createdAt', { unique: false });
        filesStore.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        const tasksStore = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        tasksStore.createIndex('startTime', 'startTime', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function txRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const localDb = {
  async initFolders(): Promise<FolderRecord[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_FOLDERS, 'readwrite');
    const store = tx.objectStore(STORE_FOLDERS);
    const existing = await txRequest(store.getAll());
    if (existing.length === 0) {
      for (const folder of DEFAULT_FOLDERS) {
        store.put(folder);
      }
      return [...DEFAULT_FOLDERS];
    }
    return existing.sort((a, b) => a.createdAt - b.createdAt);
  },

  async getFolders(): Promise<FolderRecord[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_FOLDERS, 'readonly');
    const folders = await txRequest(tx.objectStore(STORE_FOLDERS).getAll());
    return folders.sort((a, b) => a.createdAt - b.createdAt);
  },

  async saveFolder(folder: FolderRecord): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_FOLDERS, 'readwrite');
    await txRequest(tx.objectStore(STORE_FOLDERS).put(folder));
  },

  async deleteFolder(folderId: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_FOLDERS, STORE_FILES], 'readwrite');
    tx.objectStore(STORE_FOLDERS).delete(folderId);
    const filesStore = tx.objectStore(STORE_FILES);
    const files: PdfFileRecord[] = await txRequest(filesStore.getAll());
    for (const f of files) {
      if (f.folderId === folderId) {
        f.folderId = 'created';
        filesStore.put(f);
      }
    }
  },

  async getFiles(): Promise<PdfFileRecord[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    const files: PdfFileRecord[] = await txRequest(tx.objectStore(STORE_FILES).getAll());
    return files.sort((a, b) => b.createdAt - a.createdAt);
  },

  async getFile(id: string): Promise<PdfFileRecord | undefined> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    return txRequest(tx.objectStore(STORE_FILES).get(id));
  },

  async saveFile(file: PdfFileRecord): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    await txRequest(tx.objectStore(STORE_FILES).put(file));
  },

  async deleteFile(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    await txRequest(tx.objectStore(STORE_FILES).delete(id));
  },

  async deleteFiles(ids: string[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    for (const id of ids) {
      store.delete(id);
    }
  },

  async getTasks(): Promise<TaskRecord[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_TASKS, 'readonly');
    const tasks: TaskRecord[] = await txRequest(tx.objectStore(STORE_TASKS).getAll());
    return tasks.sort((a, b) => b.startTime - a.startTime);
  },

  async saveTask(task: TaskRecord): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_TASKS, 'readwrite');
    await txRequest(tx.objectStore(STORE_TASKS).put(task));
  },

  async deleteTask(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_TASKS, 'readwrite');
    await txRequest(tx.objectStore(STORE_TASKS).delete(id));
  },

  async clearCompletedTasks(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_TASKS, 'readwrite');
    const store = tx.objectStore(STORE_TASKS);
    const all: TaskRecord[] = await txRequest(store.getAll());
    for (const t of all) {
      if (t.status !== 'processing') {
        store.delete(t.id);
      }
    }
  },

  async getSettings(): Promise<AppSettings> {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const res = await txRequest(tx.objectStore(STORE_SETTINGS).get('app_settings'));
    if (!res) return { ...DEFAULT_APP_SETTINGS };
    const { id: _id, ...rest } = res;
    return { ...DEFAULT_APP_SETTINGS, ...rest };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    await txRequest(tx.objectStore(STORE_SETTINGS).put({ id: 'app_settings', ...settings }));
  },
};

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1)} ${units[i]}`;
}

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
