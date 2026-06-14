import { v4 as uuidv4 } from 'uuid';
import type { Song, SongLink } from '../types';

const STORAGE_KEY = 'kutcheri-user-songs';

function normalizeRagamKey(ragam: string): string {
  let s = ragam.toLowerCase().trim();
  s = s.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u');
  s = s.replace(/th/g, 't').replace(/dh/g, 'd');
  return s.replace(/[^a-z0-9]/g, '');
}

function composerKey(composer: string): string {
  let s = composer.toLowerCase().trim();
  s = s.replace(/[^a-z0-9\s]/g, '');
  return s.replace(/\s+/g, '-').replace(/^-|-$/g, '');
}

export function loadUserSongs(): Song[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveUserSong(fields: {
  name: string;
  ragam: string;
  talam: string;
  composer: string;
  language: string;
  links: SongLink[];
}): Song {
  const song: Song = {
    id: `user-${uuidv4().slice(0, 8)}`,
    names: [fields.name],
    ragam: fields.ragam,
    ragam_key: normalizeRagamKey(fields.ragam),
    talam: fields.talam,
    composer: fields.composer,
    composer_key: composerKey(fields.composer),
    language: fields.language,
    pallavi: '',
    links: fields.links,
    tags: ['user-entered'],
  };

  const existing = loadUserSongs();
  existing.push(song);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return song;
}

export function deleteUserSong(id: string): void {
  const songs = loadUserSongs().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}
