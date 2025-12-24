import Dexie, { type Table } from 'dexie';
import { Swatch, Formula } from './types';

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
 * Helper to download via blob (Fallback method)
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
 * Perform Auto-Backup.
 * Tries to overwrite existing file handle if available (Chrome/Edge Desktop).
 * Falls back to downloading a new file if not.
 */
export const performAutoBackup = async () => {
  try {
    const jsonStr = await createBackupJSON();
    
    // 1. Check for stored File Handle (FileSystem Access API)
    // Only supported in secure contexts and modern browsers
    if ('showSaveFilePicker' in window) {
        const record = await db.meta.get('backupHandle');
        if (record && record.handle) {
            const handle = record.handle as FileSystemFileHandle;
            
            // 2. Try to write to handle
            try {
                // Check permissions - if we are in a user gesture (save button click), we can request it.
                // If not, this might fail or prompt.
                const options = { mode: 'readwrite' };
                // @ts-ignore
                if ((await handle.queryPermission(options)) !== 'granted') {
                    // @ts-ignore
                    if ((await handle.requestPermission(options)) !== 'granted') {
                        throw new Error("Permission denied");
                    }
                }

                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                console.log("Auto-backup overwritten successfully.");
                return true;
            } catch (err) {
                console.warn("File System Access write failed (handle might be stale or permission denied), falling back to download.", err);
                // If handle is bad, maybe clear it? For now, just fallback.
            }
        }
    }

    // 3. Fallback: Download new file
    downloadBackupBlob(jsonStr);
    return true;

  } catch (err) {
    console.error("Backup generation failed", err);
    return false;
  }
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
 * Setup File Handle for Auto-Backup
 */
export const setupBackupHandle = async () => {
    if (!('showSaveFilePicker' in window)) {
        throw new Error("Your browser does not support file overwriting. Auto-backup will create new files.");
    }
    
    const opts = {
        suggestedName: 'ColourMaster_AutoBackup.json',
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
 * Manually trigger download (Export)
 */
export const triggerBackupDownload = async () => {
    try {
        const json = await createBackupJSON();
        downloadBackupBlob(json);
        return true;
    } catch(e) { return false; }
};
