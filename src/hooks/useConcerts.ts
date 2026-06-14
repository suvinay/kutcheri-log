import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Concert, ConcertItem, Artist } from '../types';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import type { StorageProvider } from '../storage/StorageProvider';
import { fetchPublishedConcerts, publishConcertToSheet, isSheetsConfigured } from '../services/sheetSync';

const storage: StorageProvider = new LocalStorageProvider();

function mergeConcerts(published: Concert[], local: Concert[]): Concert[] {
  const byId = new Map<string, Concert>();
  for (const c of published) byId.set(c.id, c);
  for (const c of local) byId.set(c.id, c);
  return Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function useConcerts() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchPublishedConcerts().catch(() => [] as Concert[]),
      storage.loadConcerts(),
    ]).then(([published, local]) => {
      setConcerts(mergeConcerts(published, local));
      setLoading(false);
    });
  }, []);

  const syncToSheet = useCallback(async (concert: Concert) => {
    if (!isSheetsConfigured()) return;
    try {
      await publishConcertToSheet(concert);
      setSyncError('');
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    }
  }, []);

  const createConcert = useCallback(async (): Promise<Concert> => {
    const concert: Concert = {
      id: uuidv4(),
      date: new Date().toISOString().slice(0, 10),
      venue: '',
      organization: '',
      artists: [{ role: 'Vocal', name: '' }],
      items: [],
      notes: '',
      logged_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.saveConcert(concert);
    setConcerts(prev => [concert, ...prev]);
    return concert;
  }, []);

  const updateConcert = useCallback(async (concert: Concert) => {
    const updated = { ...concert, updated_at: new Date().toISOString() };
    await storage.saveConcert(updated);
    setConcerts(prev =>
      prev.map(c => (c.id === updated.id ? updated : c))
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
    syncToSheet(updated);
    return updated;
  }, [syncToSheet]);

  const deleteConcert = useCallback(async (id: string) => {
    await storage.deleteConcert(id);
    setConcerts(prev => prev.filter(c => c.id !== id));
  }, []);

  const addItem = useCallback(
    async (concertId: string, item: Omit<ConcertItem, 'id' | 'position'>) => {
      const concert = concerts.find(c => c.id === concertId);
      if (!concert) return;
      const newItem: ConcertItem = {
        ...item,
        id: uuidv4(),
        position: concert.items.length + 1,
      };
      const updated = {
        ...concert,
        items: [...concert.items, newItem],
        updated_at: new Date().toISOString(),
      };
      await storage.saveConcert(updated);
      setConcerts(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      syncToSheet(updated);
      return updated;
    },
    [concerts, syncToSheet],
  );

  const updateItem = useCallback(
    async (concertId: string, item: ConcertItem) => {
      const concert = concerts.find(c => c.id === concertId);
      if (!concert) return;
      const updated = {
        ...concert,
        items: concert.items.map(i => (i.id === item.id ? item : i)),
        updated_at: new Date().toISOString(),
      };
      await storage.saveConcert(updated);
      setConcerts(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      syncToSheet(updated);
      return updated;
    },
    [concerts, syncToSheet],
  );

  const deleteItem = useCallback(
    async (concertId: string, itemId: string) => {
      const concert = concerts.find(c => c.id === concertId);
      if (!concert) return;
      const items = concert.items
        .filter(i => i.id !== itemId)
        .map((i, idx) => ({ ...i, position: idx + 1 }));
      const updated = {
        ...concert,
        items,
        updated_at: new Date().toISOString(),
      };
      await storage.saveConcert(updated);
      setConcerts(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      syncToSheet(updated);
      return updated;
    },
    [concerts, syncToSheet],
  );

  const reorderItems = useCallback(
    async (concertId: string, items: ConcertItem[]) => {
      const concert = concerts.find(c => c.id === concertId);
      if (!concert) return;
      const reordered = items.map((item, idx) => ({
        ...item,
        position: idx + 1,
      }));
      const updated = {
        ...concert,
        items: reordered,
        updated_at: new Date().toISOString(),
      };
      await storage.saveConcert(updated);
      setConcerts(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      return updated;
    },
    [concerts],
  );

  const updateArtists = useCallback(
    async (concertId: string, artists: Artist[]) => {
      const concert = concerts.find(c => c.id === concertId);
      if (!concert) return;
      const updated = {
        ...concert,
        artists,
        updated_at: new Date().toISOString(),
      };
      await storage.saveConcert(updated);
      setConcerts(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      return updated;
    },
    [concerts],
  );

  return {
    concerts,
    loading,
    syncError,
    createConcert,
    updateConcert,
    deleteConcert,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    updateArtists,
  };
}
