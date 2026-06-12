import type { Concert } from '../types';
import type { StorageProvider } from './StorageProvider';

const CONCERTS_KEY = 'carnatic-log-concerts';

export class LocalStorageProvider implements StorageProvider {
  async loadConcerts(): Promise<Concert[]> {
    const raw = localStorage.getItem(CONCERTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async saveConcert(concert: Concert): Promise<void> {
    const concerts = await this.loadConcerts();
    const idx = concerts.findIndex(c => c.id === concert.id);
    if (idx >= 0) {
      concerts[idx] = concert;
    } else {
      concerts.push(concert);
    }
    localStorage.setItem(CONCERTS_KEY, JSON.stringify(concerts));
  }

  async deleteConcert(id: string): Promise<void> {
    const concerts = await this.loadConcerts();
    const filtered = concerts.filter(c => c.id !== id);
    localStorage.setItem(CONCERTS_KEY, JSON.stringify(filtered));
  }
}
