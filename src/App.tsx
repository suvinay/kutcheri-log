import { useState, useEffect, useCallback } from 'react';
import type { Concert } from './types';
import { initDb } from './services/songDb';
import { isAdmin } from './services/admin';
import { useConcerts } from './hooks/useConcerts';
import { ConcertList } from './components/ConcertList';
import { ConcertEditor } from './components/ConcertEditor';
import { Settings } from './components/Settings';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [admin, setAdmin] = useState(isAdmin());

  const {
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
  } = useConcerts();

  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    if (activeConcert) {
      const updated = concerts.find(c => c.id === activeConcert.id);
      if (updated) setActiveConcert(updated);
    }
  }, [concerts, activeConcert]);

  const handleAdminChange = useCallback(() => {
    setAdmin(isAdmin());
  }, []);

  if (!dbReady || loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (activeConcert) {
    return (
      <ConcertEditor
        concert={activeConcert}
        onBack={() => setActiveConcert(null)}
        onUpdate={updateConcert}
        onAddItem={item => addItem(activeConcert.id, item)}
        onUpdateItem={item => updateItem(activeConcert.id, item)}
        onDeleteItem={itemId => deleteItem(activeConcert.id, itemId)}
        onReorderItems={items => reorderItems(activeConcert.id, items)}
        onUpdateArtists={artists => updateArtists(activeConcert.id, artists)}
      />
    );
  }

  return (
    <>
      <ConcertList
        concerts={concerts}
        onSelect={setActiveConcert}
        onNew={async () => {
          const c = await createConcert();
          setActiveConcert(c);
        }}
        onDelete={admin ? deleteConcert : undefined}
      />
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 right-4 bg-white hover:bg-stone-50 text-stone-300 hover:text-stone-500 w-10 h-10 rounded-full flex items-center justify-center border border-stone-200 shadow-sm text-sm"
        title="Settings"
      >
        ⚙
      </button>
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onAdminChange={handleAdminChange}
        />
      )}
    </>
  );
}
