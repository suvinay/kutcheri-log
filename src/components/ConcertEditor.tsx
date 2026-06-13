import { useState } from 'react';
import type { Concert, ConcertItem, Artist } from '../types';
import { ConcertHeader } from './ConcertHeader';
import { SongSearch } from './SongSearch';
import { Setlist } from './Setlist';
import { ExportModal } from './ExportModal';

interface Props {
  concert: Concert;
  onBack: () => void;
  onUpdate: (concert: Concert) => void;
  onAddItem: (item: Omit<ConcertItem, 'id' | 'position'>) => void;
  onUpdateItem: (item: ConcertItem) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItems: (items: ConcertItem[]) => void;
  onUpdateArtists: (artists: Artist[]) => void;
}

export function ConcertEditor({
  concert,
  onBack,
  onUpdate,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onUpdateArtists,
}: Props) {
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 px-4 py-6 max-w-xl mx-auto pb-20 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-600 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-sm"
        >
          ← Back
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="border border-stone-200 hover:border-stone-300 text-stone-500 hover:text-stone-700 px-4 py-2 rounded-lg min-h-[44px] text-sm transition-colors mr-12"
        >
          Export
        </button>
      </header>

      <ConcertHeader
        concert={concert}
        onUpdate={onUpdate}
        onUpdateArtists={onUpdateArtists}
      />

      <SongSearch onAdd={onAddItem} />

      <Setlist
        items={concert.items}
        onReorder={onReorderItems}
        onUpdate={onUpdateItem}
        onDelete={onDeleteItem}
      />

      {showExport && (
        <ExportModal concert={concert} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
