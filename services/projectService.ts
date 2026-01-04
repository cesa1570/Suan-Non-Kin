
/**
 * Project Storage Service
 * Uses IndexedDB to store project states, including large base64 audio and video data.
 */

const DB_NAME = 'AutoShortsStudioDB';
const STORE_PROJECTS = 'projects';
const STORE_QUEUE = 'youtube_queue';
const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
  });
};

const sanitizeForIDB = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof AudioBuffer !== 'undefined' && obj instanceof AudioBuffer) return undefined;
  if (typeof HTMLImageElement !== 'undefined' && obj instanceof HTMLImageElement) return undefined;
  if (typeof HTMLVideoElement !== 'undefined' && obj instanceof HTMLVideoElement) return undefined;
  if (typeof MediaStream !== 'undefined' && obj instanceof MediaStream) return undefined;
  if (obj instanceof Blob || obj instanceof File) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForIDB(item)).filter(item => item !== undefined);
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = sanitizeForIDB(obj[key]);
      if (value !== undefined) sanitized[key] = value;
    }
  }
  return sanitized;
};

export interface ProjectData {
  id: string;
  type: 'shorts' | 'long' | 'podcast';
  title: string;
  topic: string;
  lastUpdated: number;
  config: any;
  script: any;
}

export interface YoutubeQueueItem {
  id: string;
  projectId: string;
  projectType: 'shorts' | 'long' | 'podcast';
  videoBlob?: Blob; 
  metadata: {
    title: string;
    description: string;
    tags: string[];
    privacy_status: 'public' | 'private' | 'unlisted';
    publish_at?: string;
  };
  status: 'pending' | 'waiting' | 'generating' | 'rendering' | 'uploading' | 'completed' | 'error' | 'failed';
  error?: string;
  progress: number;
  system_note: string;
  addedAt: number;
  queued_at: string;
}

/**
 * Validates metadata constraints for YouTube upload
 */
export const validateYoutubeMetadata = (title: string, description: string, tags: string[]) => {
  const issues: string[] = [];
  if (title.length > 100) issues.push("Title exceeds 100 characters");
  if (description.length > 5000) issues.push("Description exceeds 5000 characters");
  
  return {
    isValid: issues.length === 0,
    note: `Title length valid (${title.length}/100). Tags count: ${tags.length}.`,
    issues
  };
};

export const saveProject = async (project: ProjectData): Promise<void> => {
  const db = await openDB();
  const safeProject = sanitizeForIDB(project);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.put(safeProject);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getProject = async (id: string): Promise<ProjectData | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const listProjects = async (type?: string): Promise<ProjectData[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.getAll();
    request.onsuccess = () => {
      let results = request.result as ProjectData[];
      if (type) results = results.filter(p => p.type === type);
      resolve(results.sort((a, b) => b.lastUpdated - a.lastUpdated));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const addToQueue = async (item: YoutubeQueueItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getQueue = async (): Promise<YoutubeQueueItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a: any, b: any) => a.addedAt - b.addedAt));
    request.onerror = () => reject(request.error);
  });
};

export const removeFromQueue = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateQueueItem = async (id: string, updates: Partial<YoutubeQueueItem>): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_QUEUE);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        const updatedItem = { ...item, ...updates };
        const putRequest = store.put(updatedItem);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject("Item not found");
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const exportProjectToJson = (project: ProjectData) => {
  const safeProject = sanitizeForIDB(project);
  const blob = new Blob([JSON.stringify(safeProject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.replace(/\s+/g, '_')}_project.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Exports all data from IndexedDB to a single JSON file.
 */
export const exportAllData = async () => {
  const projects = await listProjects();
  const queue = await getQueue();
  
  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    system: "AutoShorts AI Studio",
    data: {
      projects,
      youtube_queue: queue
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autoshorts_studio_full_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
