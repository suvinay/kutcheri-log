import { useState, useCallback, useRef, useEffect } from 'react';
import type { Song, ConcertItem, SongLink } from '../types';
import { searchSongs } from '../services/songDb';
import { identifySong } from '../services/geminiService';
import { RagamInfo } from './RagamInfo';
import { SourceLinks } from './SourceLinks';

interface Props {
  onAdd: (item: Omit<ConcertItem, 'id' | 'position'>) => void;
}

type ItemType = ConcertItem['type'];

export function SongSearch({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Partial<ConcertItem> | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [confidence, setConfidence] = useState<string>('');
  const [showRagam, setShowRagam] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback((q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(searchSongs(q));
  }, []);

  const selectSong = (song: Song) => {
    setSelected({
      type: 'kriti',
      song_id: song.id,
      kriti_name: song.names[0],
      ragam: song.ragam,
      talam: song.talam,
      composer: song.composer,
      language: song.language,
      links: song.links,
      notes: '',
      uncertain: false,
    });
    setResults([]);
    setConfidence('');
  };

  const askGemini = async () => {
    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
      setAskError('Set your Gemini API key in Settings first.');
      return;
    }
    setAsking(true);
    setAskError('');
    try {
      const result = await identifySong(query, apiKey);
      setSelected({
        type: 'kriti',
        song_id: null,
        kriti_name: result.name,
        ragam: result.ragam,
        talam: result.talam,
        composer: result.composer,
        language: result.language,
        links: [],
        notes: '',
        uncertain: result.confidence === 'low',
      });
      setConfidence(result.confidence);
      setResults([]);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Failed to identify song');
    } finally {
      setAsking(false);
    }
  };

  const submitItem = () => {
    if (!selected?.kriti_name) return;
    onAdd({
      type: (selected.type as ItemType) || 'kriti',
      song_id: selected.song_id ?? null,
      kriti_name: selected.kriti_name,
      ragam: selected.ragam || '',
      talam: selected.talam || '',
      composer: selected.composer || '',
      language: selected.language || '',
      links: (selected.links as SongLink[]) || [],
      notes: selected.notes || '',
      uncertain: selected.uncertain || false,
    });
    setSelected(null);
    setQuery('');
    setConfidence('');
    inputRef.current?.focus();
  };

  const updateSelected = (field: string, value: string | boolean) => {
    if (!selected) return;
    setSelected({ ...selected, [field]: value });
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="mb-6">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => doSearch(e.target.value)}
        placeholder="Search kriti, ragam, or composer…"
        className="w-full bg-white text-stone-800 rounded-lg px-4 py-3 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none placeholder-stone-300 font-mono text-sm"
      />

      {results.length > 0 && !selected && (
        <ul className="mt-2 border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-64 overflow-y-auto bg-white">
          {results.map(song => (
            <li
              key={song.id}
              onClick={() => selectSong(song)}
              className="px-4 py-3 cursor-pointer hover:bg-stone-50 active:bg-stone-100 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-stone-800 text-sm">{song.names[0]}</span>
                <SourceLinks links={song.links} />
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-stone-400">
                <span
                  className="cursor-pointer hover:text-stone-600"
                  onClick={e => { e.stopPropagation(); setShowRagam(song.ragam); }}
                >
                  {song.ragam}
                </span>
                {song.talam && <span>{song.talam}</span>}
                <span>{song.composer}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && results.length === 0 && !selected && (
        <div className="mt-3 text-center py-4">
          <p className="text-stone-400 text-sm mb-3">No matches in database</p>
          <button
            onClick={askGemini}
            disabled={asking}
            className="border border-stone-200 hover:border-stone-300 disabled:opacity-40 text-stone-600 px-4 py-2 rounded-lg min-h-[44px] text-sm transition-colors"
          >
            {asking ? 'Asking Gemini…' : 'Ask Gemini →'}
          </button>
          {askError && (
            <p className="text-red-500 text-sm mt-2">{askError}</p>
          )}
        </div>
      )}

      {selected && (
        <div className="mt-3 space-y-3 border border-stone-200 rounded-lg p-4 bg-white">
          {confidence && (
            <div className={`text-xs px-2 py-1 rounded inline-block ${
              confidence === 'high' ? 'bg-emerald-50 text-emerald-600' :
              confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
              'bg-red-50 text-red-600'
            }`}>
              Gemini confidence: {confidence}
            </div>
          )}

          {(selected.links as SongLink[])?.length > 0 && (
            <div>
              <label className="text-stone-400 text-xs font-medium">Sources</label>
              <div className="mt-1">
                <SourceLinks links={selected.links as SongLink[]} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-stone-400 text-xs font-medium">Kriti Name</label>
              <input
                type="text"
                value={selected.kriti_name || ''}
                onChange={e => updateSelected('kriti_name', e.target.value)}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Ragam</label>
              <input
                type="text"
                value={selected.ragam || ''}
                onChange={e => updateSelected('ragam', e.target.value)}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Talam</label>
              <input
                type="text"
                value={selected.talam || ''}
                onChange={e => updateSelected('talam', e.target.value)}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Composer</label>
              <input
                type="text"
                value={selected.composer || ''}
                onChange={e => updateSelected('composer', e.target.value)}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Type</label>
              <select
                value={(selected.type as string) || 'kriti'}
                onChange={e => updateSelected('type', e.target.value)}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none text-sm"
              >
                <option value="kriti">Kriti</option>
                <option value="RTP">RTP</option>
                <option value="tillana">Tillana</option>
                <option value="viruttam">Viruttam</option>
                <option value="mangalam">Mangalam</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-stone-400 text-xs font-medium">Notes</label>
            <input
              type="text"
              value={selected.notes || ''}
              onChange={e => updateSelected('notes', e.target.value)}
              placeholder="Performance notes…"
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none placeholder-stone-300 text-sm"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-stone-500 text-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={selected.uncertain || false}
                onChange={e => updateSelected('uncertain', e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 accent-stone-600"
              />
              Uncertain (?)
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={submitItem}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg min-h-[44px] text-sm font-medium active:scale-[0.98] transition-all"
            >
              Add to concert
            </button>
            <button
              onClick={() => { setSelected(null); setConfidence(''); }}
              className="border border-stone-200 hover:border-stone-300 text-stone-500 px-4 py-3 rounded-lg min-h-[44px] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showRagam && (
        <RagamInfo ragamName={showRagam} onClose={() => setShowRagam(null)} />
      )}
    </div>
  );
}
