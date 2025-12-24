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

// Fallback for browsers that don't support overwriting (Mobile/Firefox)
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

export const resetDatabase = async () => {
  return db.transaction('rw', db.swatches, db.formulas, db.meta, async () => {
      await db.swatches.clear();
      await db.formulas.clear();
      await db.meta.clear();
  });
};

export const triggerBackupDownload = async () => {
    try {
        const json = await createBackupJSON();
        downloadBackupBlob(json);
        return true;
    } catch(e) { return false; }
};

// --- MANUAL FILE SYNC (File System Access API) ---

/**
 * 1. Setup/Link a File
 * Call this to pick a file location.
 */
export const linkBackupFile = async () => {
    if (!('showSaveFilePicker' in window)) {
        throw new Error("Your browser does not support file linking. Please use standard download.");
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
 * 2. Perform Manual Overwrite
 * Called when user clicks "Update Backup" in Library.
 */
export const performManualOverwrite = async () => {
    try {
        const jsonStr = await createBackupJSON();

        // A. Check for existing handle
        const record = await db.meta.get('backupHandle');
        
        if (record && record.handle) {
            const handle = record.handle as FileSystemFileHandle;
            
            // Check/Request Permission (User action allows this prompt)
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
            console.log("File overwritten successfully");
            return "overwritten";
        }

        // B. No handle found? Try to create one.
        if ('showSaveFilePicker' in window) {
            const newHandle = await linkBackupFile();
            // @ts-ignore
            const writable = await newHandle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            return "created";
        }

        // C. Fallback to download (Mobile/Safari)
        downloadBackupBlob(jsonStr);
        return "downloaded";

    } catch (e: any) {
        console.error("Backup failed", e);
        // If file access failed, fallback to download so user doesn't lose data
        const jsonStr = await createBackupJSON();
        downloadBackupBlob(jsonStr);
        return "fallback";
    }
};
