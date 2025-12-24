import Dexie, { type Table } from 'dexie';
import { Swatch, Formula } from './types';

// Interface for File System Access API
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  queryPermission(descriptor: { mode: string }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: string }): Promise<PermissionState>;
}
interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

export class LeatherDB extends Dexie {
  swatches!: Table<Swatch, number>;
  formulas!: Table<Formula, number>;
  meta!: Table<any, string>; 

  constructor() {
    super('LeatherMasterDB');
    (this as any).version(1).stores({ swatches: '++id, name, createdAt', formulas: '++id, name, createdAt' });
    (this as any).version(2).stores({ swatches: '++id, name, hex, createdAt' });
    (this as any).version(3).stores({ swatches: '++id, name, hex, createdAt', formulas: '++id, name, createdAt', meta: 'key' });
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
 * Standard browser download fallback.
 */
const downloadBackupBlob = (jsonStr: string) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
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
 * Action: Export Copy
 * Manually trigger a fresh JSON download.
 */
export const triggerBackupDownload = async () => {
    try {
        const json = await createBackupJSON();
        downloadBackupBlob(json);
        return true;
    } catch(e) { 
        console.error("Export Copy failed", e);
        return false; 
    }
};

// --- MANUAL FILE SYNC LOGIC ---

/**
 * Pick and link a specific file on the user's disk.
 */
export const linkBackupFile = async () => {
    if (!('showSaveFilePicker' in window)) {
        throw new Error("Your browser does not support file linking. Please use Export Copy.");
    }
    
    const opts = {
        suggestedName: 'ColourMaster_Library.json',
        types: [{ description: 'JSON Library File', accept: { 'application/json': ['.json'] } }],
    };
    
    // @ts-ignore
    const handle = await window.showSaveFilePicker(opts);
    await db.meta.put({ key: 'backupHandle', handle });
    return handle;
};

/**
 * Action: Update Backup File
 * Overwrites the linked file or prompts to create one.
 */
export const performManualOverwrite = async () => {
    try {
        const jsonStr = await createBackupJSON();

        // 1. Check for existing handle
        const record = await db.meta.get('backupHandle');
        
        if (record && record.handle) {
            const handle = record.handle as FileSystemFileHandle;
            
            // Verify permission (triggers prompt if necessary)
            // @ts-ignore
            const perm = await handle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                 // @ts-ignore
                 const newPerm = await handle.requestPermission({ mode: 'readwrite' });
                 if (newPerm !== 'granted') throw new Error("Permission denied");
            }

            // Write to existing file
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            console.log("✔ Backup file updated");
            return "overwritten";
        }

        // 2. No handle found? Setup a new one
        if ('showSaveFilePicker' in window) {
            const newHandle = await linkBackupFile();
            // @ts-ignore
            const writable = await newHandle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            return "created";
        }

        // 3. Absolute Fallback (Standard Download)
        downloadBackupBlob(jsonStr);
        return "downloaded";

    } catch (e: any) {
        console.error("Manual Backup failed", e);
        // Fallback to download so user doesn't lose current state if disk write fails
        const jsonStr = await createBackupJSON();
        downloadBackupBlob(jsonStr);
        return "fallback";
    }
};
