import Dexie, { type Table } from 'dexie';
import { Swatch, Formula } from './types';

// The LeatherDB class extends Dexie to define the database schema and provide type safety for swatches and formulas.
export class LeatherDB extends Dexie {
  swatches!: Table<Swatch, number>;
  formulas!: Table<Formula, number>;

  constructor() {
    // Initialize Dexie with the database name
    super('LeatherMasterDB');

    // Define the database schema.
    // The version method is used to manage schema changes and migrations.
    // Fix: cast this to any to avoid type error where 'version' is not recognized on LeatherDB type
    (this as any).version(1).stores({
      swatches: '++id, name, createdAt',
      formulas: '++id, name, createdAt'
    });

    // Version 2: Add 'hex' index to swatches to allow querying by color (duplicate detection)
    (this as any).version(2).stores({
      swatches: '++id, name, hex, createdAt'
    });
  }
}

export const db = new LeatherDB();