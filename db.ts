import Dexie, { type Table } from 'dexie';
import { Swatch, Formula } from './types';

// Add this interface to satisfy TypeScript for the File System Access API
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  queryPermission(descriptor: { mode: string }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: string }): Promise<PermissionState>;
}
interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

// The LeatherDB class extends Dexie to define the database schema and provide type safety.
export class LeatherDB extends Dexie {
  swatches!: Table<Swatch, number>;
  formulas!: Table<Formula, number>;
  meta!: Table<any, string>; // Store system config/handles

  constructor() {
    super('LeatherMasterDB');

    (this as any).version(1).stores({
      swatches: '++id, name, createdAt',
      formulas: '++id, name, createdAt'
    });

    (this as any).version(2).stores({
      swatches: '++id, name, hex, createdAt'
    });

    // Version 3: Add meta table for File System Handles
    (this as any).version(3).stores({
      swatches: '++id, name, hex, createdAt',
      formulas: '++id, name, createdAt',
      meta: 'key'
    });
  }
}

export const db = new LeatherDB();

// --- SHARED UTILITIES ---

/**
 * Creates the JSON backup string from current DB data.
 */
const createBackupJSON = async () => {
    const s = await db.swatches.toArray();
    const f = await db.formulas.toArray();
    
    return JSON.stringify({
        version: 1,
        timestamp: new Date().toISOString(),
        source: 'Colour Master',
        data: { swatches: s, formulas: f }
    }, null, 2);
};

/**
 * Helper to download via blob (Fallback method for Manual Exports)
 */
const downloadBackupBlob = (jsonStr: string) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create timestamped filename for fallback
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `ColourMaster_Backup_${dateStr}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Wipes the database completely.
 */
export const resetDatabase = async () => {
  return db.transaction('rw', db.swatches, db.formulas, db.meta, async () => {
      await db.swatches.clear();
      await db.formulas.clear();
      await db.meta.clear();
  });
};

/**
 * Setup File Handle for Auto-Backup (Initial Connection)
 */
export const setupBackupHandle = async () => {
    if (!('showSaveFilePicker' in window)) {
        throw new Error("Your browser does not support file overwriting. Please use manual export.");
    }
    
    const opts = {
        suggestedName: 'ColourMaster_Sync.json',
        types: [{
            description: 'JSON Backup File',
            accept: { 'application/json': ['.json'] },
        }],
    };
    
    // @ts-ignore
    const handle = await window.showSaveFilePicker(opts);
    
    // Store handle in DB
    await db.meta.put({ key: 'backupHandle', handle });
    return handle;
};

/**
 * Manually trigger download (Export) - e.g. for "Save Copy" button
 */
export const triggerBackupDownload = async () => {
    try {
        const json = await createBackupJSON();
        downloadBackupBlob(json);
        return true;
    } catch(e) { return false; }
};

// --- SYNC-TO-DISK STRATEGY (Silent & Safe) ---

/**
 * Run this on App Start to check connection.
 * Returns: 'connected' | 'disconnected' | 'none'
 */
export const checkBackupStatus = async (): Promise<'connected' | 'disconnected' | 'none'> => {
  try {
    const record = await db.meta.get('backupHandle');
    if (!record || !record.handle) return 'none';

    const handle = record.handle as FileSystemFileHandle;
    
    // Check permission state without asking
    // @ts-ignore
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    
    return perm === 'granted' ? 'connected' : 'disconnected';
  } catch (error) {
    return 'none';
  }
};

/**
 * The "Silent" Sync.
 * Call this after every save.
 * Returns true if saved, false if permission needed (show warning).
 */
export const performSilentBackup = async () => {
  try {
    const record = await db.meta.get('backupHandle');
    if (!record || !record.handle) return false; // No file set up yet

    const handle = record.handle as FileSystemFileHandle;
    const jsonStr = await createBackupJSON();

    // 1. Check Permission
    // @ts-ignore
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    
    if (perm === 'granted') {
      // 2. Write Silently (User sees nothing, data is safe)
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      console.log("✔ Silent Backup to Disk Successful");
      return true;
    } else {
      // 3. Permission Lost - Do NOT prompt automatically. Return false to trigger UI warning.
      console.warn("⚠ Backup Permission Lost");
      return false; 
    }
  } catch (err) {
    console.error("Backup failed", err);
    return false;
  }
};

/**
 * Call this when the user clicks the "Reconnect" warning icon.
 * This triggers the browser prompt.
 */
export const reconnectBackup = async () => {
    const record = await db.meta.get('backupHandle');
    if (record && record.handle) {
         const handle = record.handle as FileSystemFileHandle;
         // This WILL trigger the browser prompt because it's inside a click handler
         // @ts-ignore
         await handle.requestPermission({ mode: 'readwrite' });
         return await performSilentBackup(); // Try saving again immediately
    }
    return false;
}
