import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Concert, ConcertItem, Artist } from '../types';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import type { StorageProvider } from '../storage/StorageProvider';

const storage: StorageProvider = new LocalStorageProvider();

export function useConcerts() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.loadConcerts().then(c => {
      setConcerts(c.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    });
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
    return updated;
  }, []);

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
      return updated;
    },
    [concerts],
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
      return updated;
    },
    [concerts],
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
      return updated;
    },
    [concerts],
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
