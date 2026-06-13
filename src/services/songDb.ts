import Fuse from 'fuse.js';
import type { Song, Ragam, Composer, Augmentations, PageRecord, AugSourceLink } from '../types';

let songDb: Song[] = [];
let ragamDb: Ragam[] = [];
let composerDb: Composer[] = [];
let augmentations: Augmentations = { sources: [], song_links: {}, ragam_links: {}, composer_links: {} };

let songFuse: Fuse<Song> | null = null;
let ragamFuse: Fuse<Ragam> | null = null;
let composerFuse: Fuse<Composer> | null = null;

let ragamToSongs: Map<string, Song[]> = new Map();
let composerToSongs: Map<string, Song[]> = new Map();
let sourceById: Map<string, PageRecord> = new Map();

export async function initDb() {
  const [songsModule, ragamsModule, composersModule, augModule] = await Promise.all([
    import('../data/songs.json'),
    import('../data/ragams.json'),
    import('../data/composers.json'),
    import('../data/augmentations.json'),
  ]);
  songDb = songsModule.default as Song[];
  ragamDb = ragamsModule.default as Ragam[];
  composerDb = composersModule.default as Composer[];
  augmentations = augModule.default as unknown as Augmentations;

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

  composerFuse = new Fuse(composerDb, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'aliases', weight: 2 },
    ],
    threshold: 0.3,
    includeScore: true,
  });

  // Build reverse indices
  ragamToSongs = new Map();
  composerToSongs = new Map();
  for (const song of songDb) {
    if (song.ragam_key) {
      const list = ragamToSongs.get(song.ragam_key) || [];
      list.push(song);
      ragamToSongs.set(song.ragam_key, list);
    }
    if (song.composer_key) {
      const list = composerToSongs.get(song.composer_key) || [];
      list.push(song);
      composerToSongs.set(song.composer_key, list);
    }
  }

  // Build source lookup
  sourceById = new Map();
  for (const src of augmentations.sources) {
    sourceById.set(src.id, src);
  }
}

export function searchSongs(query: string, limit = 20): Song[] {
  if (!songFuse || !query.trim()) return [];
  return songFuse.search(query, { limit }).map(r => r.item);
}

export function searchRagams(query: string, limit = 10): Ragam[] {
  if (!ragamFuse || !query.trim()) return [];
  return ragamFuse.search(query, { limit }).map(r => r.item);
}

export function searchComposers(query: string, limit = 10): Composer[] {
  if (!composerFuse || !query.trim()) return [];
  return composerFuse.search(query, { limit }).map(r => r.item);
}

export function getRagamByName(name: string): Ragam | undefined {
  const lower = name.toLowerCase();
  return ragamDb.find(
    r =>
      r.name.toLowerCase() === lower ||
      r.aliases?.some(a => a.toLowerCase() === lower),
  );
}

export function getRagamByKey(key: string): Ragam | undefined {
  return ragamDb.find(r => r.key === key);
}

export function getComposerByKey(key: string): Composer | undefined {
  return composerDb.find(c => c.key === key);
}

export function getSongById(id: string): Song | undefined {
  return songDb.find(s => s.id === id);
}

export function getSongsForRagam(ragamKey: string): Song[] {
  return ragamToSongs.get(ragamKey) || [];
}

export function getSongsForComposer(composerKey: string): Song[] {
  return composerToSongs.get(composerKey) || [];
}

export function getSourceById(id: string): PageRecord | undefined {
  return sourceById.get(id);
}

export function getSongAugLinks(songId: string): AugSourceLink[] {
  return augmentations.song_links[songId] || [];
}

export function getRagamAugLinks(ragamKey: string): AugSourceLink[] {
  return augmentations.ragam_links[ragamKey] || [];
}

export function getComposerAugLinks(composerKey: string): AugSourceLink[] {
  return augmentations.composer_links[composerKey] || [];
}

export function getAllSongs(): Song[] {
  return songDb;
}

export function getAllRagams(): Ragam[] {
  return ragamDb;
}

export function getAllComposers(): Composer[] {
  return composerDb;
}
