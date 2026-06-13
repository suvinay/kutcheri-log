import Fuse from 'fuse.js';
import type { Song, Ragam, Composer, Augmentations, PageRecord, AugSourceLink } from '../types';

let songDb: Song[] = [];
let ragamDb: Ragam[] = [];
let composerDb: Composer[] = [];
let augmentations: Augmentations = { sources: [], song_links: {}, ragam_links: {}, composer_links: {} };

// Searchable wrappers with normalized fields for transliteration-aware fuzzy search
interface SearchableSong extends Song { _normalized_names: string[]; _normalized_ragam: string; _normalized_composer: string; }
interface SearchableRagam extends Ragam { _normalized_name: string; _normalized_aliases: string[]; }
interface SearchableComposer extends Composer { _normalized_name: string; _normalized_aliases: string[]; }

let songFuse: Fuse<SearchableSong> | null = null;
let ragamFuse: Fuse<SearchableRagam> | null = null;
let composerFuse: Fuse<SearchableComposer> | null = null;

let ragamToSongs: Map<string, Song[]> = new Map();
let composerToSongs: Map<string, Song[]> = new Map();
let sourceById: Map<string, PageRecord> = new Map();

/**
 * Normalize a string for transliteration-aware search.
 * Collapses common Carnatic transliteration variants so that
 * "thyagaraja", "tyaagaraaja", "Thyaagaraja" all map to the same form.
 */
function normalizeForSearch(s: string): string {
  let n = s.toLowerCase().trim();
  // Collapse long vowels
  n = n.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ii/g, 'i').replace(/uu/g, 'u');
  // Collapse aspirated consonants
  n = n.replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b');
  n = n.replace(/sh/g, 's').replace(/ch/g, 'c').replace(/kh/g, 'k');
  n = n.replace(/gh/g, 'g').replace(/ph/g, 'p').replace(/jh/g, 'j');
  // Common equivalences
  n = n.replace(/ks/g, 'x').replace(/x/g, 'ks');
  n = n.replace(/w/g, 'v');
  // Remove non-alphanumeric (keep spaces for multi-word matching)
  n = n.replace(/[^a-z0-9 ]/g, '');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

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

  // Build searchable songs with normalized fields
  const searchableSongs: SearchableSong[] = songDb.map(song => ({
    ...song,
    _normalized_names: song.names.map(normalizeForSearch),
    _normalized_ragam: normalizeForSearch(song.ragam),
    _normalized_composer: normalizeForSearch(song.composer),
  }));

  songFuse = new Fuse(searchableSongs, {
    keys: [
      { name: 'names', weight: 3 },
      { name: '_normalized_names', weight: 3 },
      { name: 'ragam', weight: 1.5 },
      { name: '_normalized_ragam', weight: 1.5 },
      { name: 'composer', weight: 1 },
      { name: '_normalized_composer', weight: 1 },
      { name: 'pallavi', weight: 0.8 },
    ],
    threshold: 0.35,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });

  // Build searchable ragams
  const searchableRagams: SearchableRagam[] = ragamDb.map(ragam => ({
    ...ragam,
    _normalized_name: normalizeForSearch(ragam.name),
    _normalized_aliases: (ragam.aliases || []).map(normalizeForSearch),
  }));

  ragamFuse = new Fuse(searchableRagams, {
    keys: [
      { name: 'name', weight: 3 },
      { name: '_normalized_name', weight: 3 },
      { name: 'aliases', weight: 2 },
      { name: '_normalized_aliases', weight: 2 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
  });

  // Build searchable composers
  const searchableComposers: SearchableComposer[] = composerDb.map(composer => ({
    ...composer,
    _normalized_name: normalizeForSearch(composer.name),
    _normalized_aliases: (composer.aliases || []).map(normalizeForSearch),
  }));

  composerFuse = new Fuse(searchableComposers, {
    keys: [
      { name: 'name', weight: 3 },
      { name: '_normalized_name', weight: 3 },
      { name: 'aliases', weight: 2 },
      { name: '_normalized_aliases', weight: 2 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
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
  const normalizedQuery = normalizeForSearch(query);
  // Search with both original and normalized query, dedup by id
  const results1 = songFuse.search(query, { limit });
  const results2 = normalizedQuery !== query.toLowerCase().trim()
    ? songFuse.search(normalizedQuery, { limit })
    : [];
  const seen = new Set<string>();
  const combined: Song[] = [];
  for (const r of [...results1, ...results2]) {
    if (!seen.has(r.item.id)) {
      seen.add(r.item.id);
      combined.push(r.item);
    }
  }
  return combined.slice(0, limit);
}

export function searchRagams(query: string, limit = 10): Ragam[] {
  if (!ragamFuse || !query.trim()) return [];
  const normalizedQuery = normalizeForSearch(query);
  const results1 = ragamFuse.search(query, { limit });
  const results2 = normalizedQuery !== query.toLowerCase().trim()
    ? ragamFuse.search(normalizedQuery, { limit })
    : [];
  const seen = new Set<string>();
  const combined: Ragam[] = [];
  for (const r of [...results1, ...results2]) {
    if (!seen.has(r.item.key)) {
      seen.add(r.item.key);
      combined.push(r.item);
    }
  }
  return combined.slice(0, limit);
}

export function searchComposers(query: string, limit = 10): Composer[] {
  if (!composerFuse || !query.trim()) return [];
  const normalizedQuery = normalizeForSearch(query);
  const results1 = composerFuse.search(query, { limit });
  const results2 = normalizedQuery !== query.toLowerCase().trim()
    ? composerFuse.search(normalizedQuery, { limit })
    : [];
  const seen = new Set<string>();
  const combined: Composer[] = [];
  for (const r of [...results1, ...results2]) {
    if (!seen.has(r.item.key)) {
      seen.add(r.item.key);
      combined.push(r.item);
    }
  }
  return combined.slice(0, limit);
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
