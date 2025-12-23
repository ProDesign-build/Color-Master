export interface Swatch {
  id?: number;
  name: string;
  hex: string;
  createdAt: number;
}

export interface Pigment {
  id: string;
  name: string;
  ratio: number;
}

export interface Formula {
  id?: number;
  name: string;
  batchSize: number;
  unit: 'ml' | 'g';
  ratioMode: 'percentage' | 'parts';
  pigments: Pigment[];
  createdAt: number;
}

export type ViewState = 'analyze' | 'preview' | 'mix' | 'library';