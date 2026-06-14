import { useState, useCallback, useRef, useEffect } from 'react';
import type { Song, ConcertItem, SongLink } from '../types';
import { searchSongs, addSongToIndex } from '../services/songDb';
import { identifySong } from '../services/geminiService';
import { saveUserSong } from '../services/userSongs';
import { RagamInfo } from './RagamInfo';
import { SourceLinks } from './SourceLinks';

interface Props {
  onAdd: (item: Omit<ConcertItem, 'id' | 'position'>) => void;
}

type ItemType = ConcertItem['type'];

interface FormState {
  song_id: string | null;
  kriti_name: string;
  ragam: string;
  talam: string;
  composer: string;
  language: string;
  type: ItemType;
  links: SongLink[];
  notes: string;
  uncertain: boolean;
}

const EMPTY_FORM: FormState = {
  song_id: null, kriti_name: '', ragam: '', talam: '', composer: '',
  language: '', type: 'kriti', links: [], notes: '', uncertain: false,
};

function coreFieldsChanged(form: FormState, original: Partial<FormState>): boolean {
  return form.kriti_name !== (original.kriti_name || '') ||
    form.ragam !== (original.ragam || '') ||
    form.talam !== (original.talam || '') ||
    form.composer !== (original.composer || '') ||
    form.language !== (original.language || '');
}

export function SongSearch({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [originalForm, setOriginalForm] = useState<Partial<FormState>>({});
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [confidence, setConfidence] = useState('');
  const [showRagam, setShowRagam] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [findingSources, setFindingSources] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback((q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setResults(searchSongs(q));
    setShowResults(true);
  }, []);

  const selectSong = (song: Song) => {
    const filled: FormState = {
      song_id: song.id,
      kriti_name: song.names[0],
      ragam: song.ragam,
      talam: song.talam,
      composer: song.composer,
      language: song.language,
      type: 'kriti',
      links: song.links,
      notes: '',
      uncertain: false,
    };
    setForm(filled);
    setOriginalForm({ ...filled });
    setShowResults(false);
    setQuery('');
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
      const searchQuery = query || form.kriti_name;
      const result = await identifySong(searchQuery, apiKey);
      const filled: FormState = {
        song_id: null,
        kriti_name: result.name,
        ragam: result.ragam,
        talam: result.talam,
        composer: result.composer,
        language: result.language,
        type: 'kriti',
        links: [],
        notes: '',
        uncertain: result.confidence === 'low',
      };
      setForm(filled);
      setOriginalForm({ ...filled });
      setConfidence(result.confidence);
      setShowResults(false);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Failed to identify song');
    } finally {
      setAsking(false);
    }
  };

  const findSourcesWithGemini = async () => {
    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey || !form.kriti_name) return;
    setFindingSources(true);
    try {
      const prompt = `Find URLs for the Carnatic kriti "${form.kriti_name}" in ragam ${form.ragam || 'unknown'} by ${form.composer || 'unknown'}. Return ONLY a JSON array of objects: [{"label": "site name", "url": "https://..."}]. Include karnatik.com, sangeethapriya, or any reliable source. Max 3 URLs.`;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300 },
          }),
        },
      );
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const urls: SongLink[] = JSON.parse(match[0]);
          setForm(f => ({ ...f, links: [...f.links, ...urls] }));
        }
      }
    } catch {
      // silently fail
    } finally {
      setFindingSources(false);
    }
  };

  const addSourceUrl = () => {
    if (!sourceUrl.trim()) return;
    try {
      const label = new URL(sourceUrl).hostname.replace('www.', '');
      setForm(f => ({ ...f, links: [...f.links, { label, url: sourceUrl }] }));
      setSourceUrl('');
    } catch {
      // invalid URL
    }
  };

  const removeLink = (idx: number) => {
    setForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }));
  };

  const updateForm = (field: keyof FormState, value: string | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const submitItem = () => {
    if (!form.kriti_name.trim()) return;

    let songId = form.song_id;

    // If no DB match, or user edited core fields → save as user entry
    const isNew = !songId;
    const isEdited = songId && coreFieldsChanged(form, originalForm);

    if (isNew || isEdited) {
      const userSong = saveUserSong({
        name: form.kriti_name,
        ragam: form.ragam,
        talam: form.talam,
        composer: form.composer,
        language: form.language,
        links: form.links,
      });
      addSongToIndex(userSong);
      songId = userSong.id;
    }

    onAdd({
      type: form.type,
      song_id: songId,
      kriti_name: form.kriti_name,
      ragam: form.ragam,
      talam: form.talam,
      composer: form.composer,
      language: form.language,
      links: form.links,
      notes: form.notes,
      uncertain: form.uncertain,
    });

    setForm({ ...EMPTY_FORM });
    setOriginalForm({});
    setQuery('');
    setConfidence('');
    setSourceUrl('');
    inputRef.current?.focus();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasContent = form.kriti_name.trim().length > 0;

  return (
    <div className="mb-6">
      {/* Search bar */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => doSearch(e.target.value)}
          placeholder="Search to autofill, or type below…"
          className="w-full bg-white text-stone-800 rounded-lg px-4 py-3 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none placeholder-stone-300 font-mono text-sm"
        />
        {query.trim().length >= 2 && (
          <button
            onClick={askGemini}
            disabled={asking}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] text-xs disabled:opacity-40 px-2 py-1"
          >
            {asking ? 'Asking…' : 'Ask Gemini'}
          </button>
        )}
      </div>

      {askError && (
        <p className="text-[var(--color-brand)] text-xs mt-1">{askError}</p>
      )}

      {/* Search results dropdown */}
      {showResults && results.length > 0 && (
        <ul className="mt-1 border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-48 overflow-y-auto bg-white shadow-sm">
          {results.map(song => (
            <li
              key={song.id}
              onClick={() => selectSong(song)}
              className="px-4 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-stone-800 text-sm">
                  {song.names[0]}
                  {song.tags?.includes('user-entered') && (
                    <span className="text-[10px] text-stone-300 font-sans ml-1.5">user</span>
                  )}
                </span>
                <SourceLinks links={song.links} />
              </div>
              <div className="flex gap-3 text-[11px] text-stone-400">
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

      {/* Entry form — always visible */}
      <div className="mt-3 border border-stone-200 rounded-lg p-4 bg-white space-y-3">
        {confidence && (
          <div className={`text-xs px-2 py-1 rounded inline-block ${
            confidence === 'high' ? 'bg-emerald-50 text-emerald-600' :
            confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
            'bg-stone-100 text-[var(--color-brand)]'
          }`}>
            Gemini confidence: {confidence}
          </div>
        )}

        {form.song_id && coreFieldsChanged(form, originalForm) && (
          <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Edited — will save as a new entry for review
          </div>
        )}

        {/* Source links */}
        {form.links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.links.map((link, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-stone-50 px-1.5 py-0.5 rounded">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-700 underline decoration-stone-200 underline-offset-2">
                  {link.label}
                </a>
                <button onClick={() => removeLink(i)} className="text-stone-300 hover:text-stone-500">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-stone-400 text-xs font-medium">Kriti Name</label>
            <input
              type="text"
              value={form.kriti_name}
              onChange={e => updateForm('kriti_name', e.target.value)}
              placeholder="Song name"
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm placeholder-stone-300"
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Ragam</label>
            <input
              type="text"
              value={form.ragam}
              onChange={e => updateForm('ragam', e.target.value)}
              placeholder="Ragam"
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm placeholder-stone-300"
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Talam</label>
            <input
              type="text"
              value={form.talam}
              onChange={e => updateForm('talam', e.target.value)}
              placeholder="Talam"
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm placeholder-stone-300"
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Composer</label>
            <input
              type="text"
              value={form.composer}
              onChange={e => updateForm('composer', e.target.value)}
              placeholder="Composer"
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none text-sm placeholder-stone-300"
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Type</label>
            <select
              value={form.type}
              onChange={e => updateForm('type', e.target.value)}
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

        {/* Source URL entry */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-stone-400 text-xs font-medium">Source URL</label>
            {hasContent && (
              <button
                onClick={findSourcesWithGemini}
                disabled={findingSources}
                className="text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] text-xs disabled:opacity-40"
              >
                {findingSources ? 'Finding…' : 'Find with Gemini'}
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <input
              type="url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSourceUrl()}
              placeholder="https://..."
              className="flex-1 bg-white text-stone-800 rounded-lg px-3 py-2 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none text-xs font-mono placeholder-stone-300"
            />
            <button
              onClick={addSourceUrl}
              disabled={!sourceUrl.trim()}
              className="border border-stone-200 hover:border-stone-300 text-stone-500 px-3 rounded-lg min-h-[44px] text-xs disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <label className="text-stone-400 text-xs font-medium">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => updateForm('notes', e.target.value)}
            placeholder="Performance notes…"
            className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none placeholder-stone-300 text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-stone-500 text-sm cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={form.uncertain}
              onChange={e => updateForm('uncertain', e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 accent-stone-600"
            />
            Uncertain (?)
          </label>
        </div>

        <button
          onClick={submitItem}
          disabled={!hasContent}
          className="w-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] disabled:opacity-30 text-white py-3 rounded-lg min-h-[44px] text-sm font-medium active:scale-[0.98] transition-all"
        >
          Add to concert
        </button>
      </div>

      {showRagam && (
        <RagamInfo ragamName={showRagam} onClose={() => setShowRagam(null)} />
      )}
    </div>
  );
}
