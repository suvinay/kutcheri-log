import { useState, useMemo } from 'react';
import type { Ragam, Composer, Song } from '../types';
import { getAllRagams, getAllComposers, searchRagams, searchComposers } from '../services/songDb';
import { EntityDetail } from './EntityDetail';

interface Props {
  onClose: () => void;
  onSelectSong?: (song: Song) => void;
}

type Tab = 'ragam' | 'composer';

export function EntityIndexPanel({ onClose, onSelectSong }: Props) {
  const [tab, setTab] = useState<Tab>('ragam');
  const [query, setQuery] = useState('');
  const [selectedRagam, setSelectedRagam] = useState<Ragam | null>(null);
  const [selectedComposer, setSelectedComposer] = useState<Composer | null>(null);

  const allRagams = useMemo(() => getAllRagams().sort((a, b) => a.name.localeCompare(b.name)), []);
  const allComposers = useMemo(
    () => getAllComposers().sort((a, b) => b.song_count - a.song_count),
    [],
  );

  const filteredRagams = useMemo(() => {
    if (!query.trim()) return allRagams;
    return searchRagams(query, 50);
  }, [query, allRagams]);

  const filteredComposers = useMemo(() => {
    if (!query.trim()) return allComposers;
    return searchComposers(query, 50);
  }, [query, allComposers]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-40 shadow-xl flex flex-col">
        {/* Header */}
        <div className="border-b border-stone-100 px-4 py-3 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => { setTab('ragam'); setQuery(''); }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === 'ragam' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Ragams ({allRagams.length})
            </button>
            <button
              onClick={() => { setTab('composer'); setQuery(''); }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === 'composer' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Composers ({allComposers.length})
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-stone-50">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab === 'ragam' ? 'ragams' : 'composers'}…`}
            className="w-full bg-stone-50 text-stone-800 rounded-lg px-3 py-2 text-sm border border-stone-100 focus:border-stone-300 focus:outline-none placeholder-stone-300 font-mono"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'ragam' ? (
            <ul className="divide-y divide-stone-50">
              {filteredRagams.map(ragam => (
                <li
                  key={ragam.key}
                  onClick={() => setSelectedRagam(ragam)}
                  className="px-4 py-3 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <div className="font-mono text-stone-700 text-sm">{ragam.name}</div>
                  <div className="flex gap-3 text-[11px] text-stone-400 mt-0.5">
                    <span className="capitalize">{ragam.janaka_or_janya}</span>
                    {ragam.mela_number && <span>#{ragam.mela_number}</span>}
                    {ragam.parent_mela && ragam.janaka_or_janya === 'janya' && (
                      <span>parent #{ragam.parent_mela}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-stone-50">
              {filteredComposers.map(composer => (
                <li
                  key={composer.key}
                  onClick={() => setSelectedComposer(composer)}
                  className="px-4 py-3 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <div className="text-stone-700 text-sm">{composer.name}</div>
                  <div className="flex gap-3 text-[11px] text-stone-400 mt-0.5">
                    <span>{composer.song_count} songs</span>
                    {composer.tradition && <span>{composer.tradition}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Detail views */}
      {selectedRagam && (
        <EntityDetail
          type="ragam"
          ragam={selectedRagam}
          onClose={() => setSelectedRagam(null)}
          onSelectSong={onSelectSong}
        />
      )}
      {selectedComposer && (
        <EntityDetail
          type="composer"
          composer={selectedComposer}
          onClose={() => setSelectedComposer(null)}
          onSelectSong={onSelectSong}
          onShowRagam={name => {
            setSelectedComposer(null);
            const r = getAllRagams().find(r => r.name.toLowerCase() === name.toLowerCase());
            if (r) setSelectedRagam(r);
          }}
        />
      )}
    </>
  );
}
