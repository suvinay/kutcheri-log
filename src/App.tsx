import { useState, useEffect, useCallback } from 'react';
import type { Concert } from './types';
import { initDb } from './services/songDb';
import { isAdmin } from './services/admin';
import { getDeviceId } from './services/deviceId';
import { useConcerts } from './hooks/useConcerts';
import { ConcertList } from './components/ConcertList';
import { ConcertEditor } from './components/ConcertEditor';
import { Settings } from './components/Settings';
import { EntityIndexPanel } from './components/EntityIndexPanel';

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [admin, setAdmin] = useState(isAdmin());

  const {
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
  } = useConcerts();

  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  // URL-based concert routing — only on initial load
  const [urlChecked, setUrlChecked] = useState(false);
  useEffect(() => {
    if (!loading && concerts.length > 0 && !urlChecked) {
      setUrlChecked(true);
      const params = new URLSearchParams(window.location.search);
      const concertId = params.get('concert');
      if (concertId) {
        const found = concerts.find(c => c.id === concertId);
        if (found) setActiveConcert(found);
      }
    }
  }, [loading, concerts, urlChecked]);

  // Keep activeConcert in sync with concerts state
  useEffect(() => {
    if (activeConcert) {
      const updated = concerts.find(c => c.id === activeConcert.id);
      if (updated && updated !== activeConcert) setActiveConcert(updated);
    }
  }, [concerts, activeConcert]);

  // Sync URL with active concert
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeConcert) {
      url.searchParams.set('concert', activeConcert.id);
    } else {
      url.searchParams.delete('concert');
    }
    window.history.replaceState({}, '', url.toString());
  }, [activeConcert]);

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

  return (
    <>
      {activeConcert ? (
        <ConcertEditor
          concert={activeConcert}
          editable={admin || activeConcert.device_id === getDeviceId()}
          syncError={syncError}
          onBack={() => setActiveConcert(null)}
          onDiscard={deleteConcert}
          onUpdate={updateConcert}
          onAddItem={item => addItem(activeConcert.id, item)}
          onUpdateItem={item => updateItem(activeConcert.id, item)}
          onDeleteItem={itemId => deleteItem(activeConcert.id, itemId)}
          onReorderItems={items => reorderItems(activeConcert.id, items)}
          onUpdateArtists={artists => updateArtists(activeConcert.id, artists)}
        />
      ) : (
        <ConcertList
          concerts={concerts}
          onSelect={setActiveConcert}
          onNew={async () => {
            const c = await createConcert();
            setActiveConcert(c);
          }}
          onDelete={admin ? deleteConcert : undefined}
        />
      )}

      {/* Global hamburger — always visible */}
      <button
        onClick={() => setShowIndex(true)}
        className="fixed top-4 right-4 bg-white hover:bg-stone-50 text-stone-400 hover:text-stone-700 w-10 h-10 rounded-lg flex items-center justify-center border border-stone-200 shadow-sm z-30"
        title="Index"
      >
        <HamburgerIcon />
      </button>

      {/* Settings gear — bottom right */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 right-4 bg-white hover:bg-stone-50 text-stone-300 hover:text-stone-500 w-10 h-10 rounded-full flex items-center justify-center border border-stone-200 shadow-sm text-sm z-30"
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
      {showIndex && (
        <EntityIndexPanel onClose={() => setShowIndex(false)} />
      )}
    </>
  );
}
