import Fuse from 'fuse.js';
import type { Song, Ragam } from '../types';

let songDb: Song[] = [];
let ragamDb: Ragam[] = [];
let songFuse: Fuse<Song> | null = null;
let ragamFuse: Fuse<Ragam> | null = null;

export async function initDb() {
  const [songsModule, ragamsModule] = await Promise.all([
    import('../data/songs.json'),
    import('../data/ragams.json'),
  ]);
  songDb = songsModule.default as Song[];
  ragamDb = ragamsModule.default as Ragam[];

  songFuse = new Fuse(songDb, {
    keys: [
      { name: 'names', weight: 3 },
      { name: 'ragam', weight: 1.5 },
      { name: 'composer', weight: 1 },
      { name: 'pallavi', weight: 0.8 },
    ],
    threshold: 0.4,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 2,
  });

  ragamFuse = new Fuse(ragamDb, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'aliases', weight: 2 },
    ],
    threshold: 0.3,
    includeScore: true,
  });
}

export function searchSongs(query: string, limit = 20): Song[] {
  if (!songFuse || !query.trim()) return [];
  return songFuse.search(query, { limit }).map(r => r.item);
}

export function searchRagams(query: string, limit = 10): Ragam[] {
  if (!ragamFuse || !query.trim()) return [];
  return ragamFuse.search(query, { limit }).map(r => r.item);
}

export function getRagamByName(name: string): Ragam | undefined {
  const lower = name.toLowerCase();
  return ragamDb.find(
    r =>
      r.name.toLowerCase() === lower ||
      r.aliases?.some(a => a.toLowerCase() === lower),
  );
}

export function getSongById(id: string): Song | undefined {
  return songDb.find(s => s.id === id);
}

export function getAllSongs(): Song[] {
  return songDb;
}

export function getAllRagams(): Ragam[] {
  return ragamDb;
}
