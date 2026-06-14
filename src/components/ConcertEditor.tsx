import { useState } from 'react';
import type { Concert, ConcertItem, Artist } from '../types';
import { ConcertHeader } from './ConcertHeader';
import { SongSearch } from './SongSearch';
import { Setlist } from './Setlist';
import { ExportModal } from './ExportModal';
import { publishConcert } from '../services/githubPublish';

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
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [publishError, setPublishError] = useState('');

  const handlePublish = async () => {
    setPublishing(true);
    setPublishStatus('idle');
    setPublishError('');
    try {
      await publishConcert(concert);
      setPublishStatus('success');
      setTimeout(() => setPublishStatus('idle'), 3000);
    } catch (e) {
      setPublishStatus('error');
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-stone-900 px-4 py-6 max-w-xl mx-auto pb-20 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-600 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-sm"
        >
          ← Back
        </button>
        <div className="flex gap-2 mr-12">
          <button
            onClick={handlePublish}
            disabled={publishing || concert.items.length === 0}
            className={`px-3 py-2 rounded-lg min-h-[44px] text-sm transition-colors ${
              publishStatus === 'success'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : publishStatus === 'error'
                ? 'bg-red-50 text-[var(--color-brand)] border border-red-200'
                : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white disabled:opacity-30'
            }`}
          >
            {publishing ? 'Publishing…' : publishStatus === 'success' ? 'Published!' : publishStatus === 'error' ? 'Failed' : 'Publish'}
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="border border-stone-200 hover:border-stone-300 text-stone-500 hover:text-stone-700 px-3 py-2 rounded-lg min-h-[44px] text-sm transition-colors"
          >
            Share
          </button>
        </div>
      </header>

      {publishError && (
        <p className="text-[var(--color-brand)] text-xs mb-4 -mt-2">{publishError}</p>
      )}

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
