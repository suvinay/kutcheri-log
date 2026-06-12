import type { Concert } from '../types';

export interface StorageProvider {
  loadConcerts(): Promise<Concert[]>;
  saveConcert(concert: Concert): Promise<void>;
  deleteConcert(id: string): Promise<void>;
}
