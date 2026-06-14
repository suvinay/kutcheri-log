import type { Concert } from '../types';

const SHEETS_URL = import.meta.env.VITE_SHEETS_URL || '';

export function isSheetsConfigured(): boolean {
  return SHEETS_URL.length > 0;
}

export async function fetchPublishedConcerts(): Promise<Concert[]> {
  if (!SHEETS_URL) return [];
  try {
    const resp = await fetch(SHEETS_URL);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.concerts || []) as Concert[];
  } catch {
    return [];
  }
}

export async function publishConcertToSheet(concert: Concert): Promise<void> {
  if (!SHEETS_URL) throw new Error('Sheet sync not configured.');
  const resp = await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'save', concert }),
  });
  if (!resp.ok) {
    throw new Error(`Sync failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
}

export async function deleteConcertFromSheet(concertId: string): Promise<void> {
  if (!SHEETS_URL) return;
  await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'delete', concertId }),
  });
}
