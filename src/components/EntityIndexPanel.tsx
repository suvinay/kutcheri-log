import { useState, useMemo } from 'react';
import type { Ragam, Composer, Song } from '../types';
import {
  getAllRagams,
  getAllComposers,
  getAllSongs,
  searchRagams,
  searchComposers,
  searchSongs,
  getRagamByKey,
  getComposerByKey,
} from '../services/songDb';
import { EntityDetail } from './EntityDetail';
import { SongDetail } from './SongDetail';
import { SourceLinks } from './SourceLinks';

interface Props {
  onClose: () => void;
  onSelectSongForAdd?: (song: Song) => void;
}

type Tab = 'songs' | 'ragam' | 'composer' | 'credits';

const SOURCES = [
  { name: 'Karnatik.com', url: 'https://www.karnatik.com/', desc: 'Comprehensive database of Carnatic kritis with lyrics, ragam, talam, and composer data.' },
  { name: 'Shivkumar.org', url: 'https://www.shivkumar.org/music/', desc: 'Carnatic music krithi audio archive with notations, audio lessons, and detailed metadata.' },
  { name: 'SwathiThirunal.in', url: 'https://www.swathithirunal.in/', desc: 'Complete catalogue of Maharaja Swathi Thirunal\'s compositions with audio recordings.' },
  { name: 'Thyagaraja Vaibhavam', url: 'https://thyagaraja-vaibhavam.blogspot.com/', desc: 'Detailed analysis and transliterations of Tyagaraja\'s kritis with word-by-word meanings.' },
  { name: 'Guru Guha Vaibhavam', url: 'https://guru-guha.blogspot.com/', desc: 'Comprehensive resource for Muttuswami Dikshitar\'s compositions with multi-script transliterations.' },
  { name: 'Anuradha Mahesh', url: 'https://anuradhamahesh.wordpress.com/', desc: 'Blog exploring Carnatic music ragas, compositions, and concert experiences.' },
  { name: 'Brain Drain (kpjayan)', url: 'https://kpjayan.wordpress.com/', desc: 'Concert reviews, lecture-demonstrations, and Carnatic music commentary.' },
  { name: 'Carnatic Connection', url: 'https://carnaticconnection.wordpress.com/', desc: 'Per-raga and per-kriti analysis of Carnatic music.' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/', desc: 'Encyclopedic references for ragas and composers (CC BY-SA).' },
];

export function EntityIndexPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('songs');
  const [query, setQuery] = useState('');
  const [selectedRagam, setSelectedRagam] = useState<Ragam | null>(null);
  const [selectedComposer, setSelectedComposer] = useState<Composer | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  const allRagams = useMemo(() => getAllRagams().sort((a, b) => a.name.localeCompare(b.name)), []);
  const allComposers = useMemo(() => getAllComposers().sort((a, b) => b.song_count - a.song_count), []);
  const totalSongs = useMemo(() => getAllSongs().length, []);

  const filteredRagams = useMemo(() => {
    if (!query.trim()) return allRagams;
    return searchRagams(query, 50);
  }, [query, allRagams]);

  const filteredComposers = useMemo(() => {
    if (!query.trim()) return allComposers;
    return searchComposers(query, 50);
  }, [query, allComposers]);

  const filteredSongs = useMemo(() => {
    if (!query.trim()) return [];
    return searchSongs(query, 50);
  }, [query]);

  const handleShowRagam = (ragamKey: string) => {
    setSelectedSong(null);
    setSelectedComposer(null);
    const r = getRagamByKey(ragamKey);
    if (r) setSelectedRagam(r);
  };

  const handleShowComposer = (composerKey: string) => {
    setSelectedSong(null);
    setSelectedRagam(null);
    const c = getComposerByKey(composerKey);
    if (c) setSelectedComposer(c);
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'songs', label: 'Songs', count: totalSongs },
    { key: 'ragam', label: 'Ragams', count: allRagams.length },
    { key: 'composer', label: 'Composers', count: allComposers.length },
    { key: 'credits', label: 'Credits' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-40 shadow-xl flex flex-col">
        {/* Header */}
        <div className="border-b border-stone-100 px-4 py-3 flex items-center justify-between">
          <h2 className="text-stone-800 font-medium text-sm">Index</h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-4 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              data-tab={t.key}
              onClick={() => { setTab(t.key); setQuery(''); }}
              className={`px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[var(--color-brand)] text-stone-800'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* Search (not for credits) */}
        {tab !== 'credits' && (
          <div className="px-4 py-2 border-b border-stone-50">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${tab === 'songs' ? 'songs' : tab === 'ragam' ? 'ragams' : 'composers'}…`}
              className="w-full bg-stone-50 text-stone-800 rounded-lg px-3 py-2 text-sm border border-stone-100 focus:border-stone-300 focus:outline-none placeholder-stone-300 font-mono"
            />
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'songs' && (
            <>
              {!query.trim() ? (
                <div className="text-center py-12 text-stone-300 text-sm px-4">
                  Type to search across {totalSongs.toLocaleString()} songs by name, ragam, or composer.
                </div>
              ) : (
                <ul className="divide-y divide-stone-50">
                  {filteredSongs.map(song => (
                    <li
                      key={song.id}
                      onClick={() => setSelectedSong(song)}
                      className="px-4 py-3 hover:bg-stone-50 cursor-pointer transition-colors"
                    >
                      <div className="font-mono text-stone-700 text-sm">{song.names[0]}</div>
                      <div className="flex gap-3 text-[11px] text-stone-400 mt-0.5">
                        <span>{song.ragam}</span>
                        {song.talam && <span>{song.talam}</span>}
                        <span>{song.composer}</span>
                      </div>
                      <SourceLinks links={song.links} className="mt-0.5" />
                    </li>
                  ))}
                  {filteredSongs.length === 0 && query.trim().length >= 2 && (
                    <li className="px-4 py-8 text-center text-stone-300 text-sm">No matches</li>
                  )}
                </ul>
              )}
            </>
          )}

          {tab === 'ragam' && (
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
                  {ragam.summary && (
                    <p className="text-stone-300 text-[11px] mt-1 line-clamp-1">{ragam.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab === 'composer' && (
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
                  {composer.summary && (
                    <p className="text-stone-300 text-[11px] mt-1 line-clamp-1">{composer.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab === 'credits' && (
            <div className="p-4 space-y-6">
              <p className="text-stone-500 text-sm leading-relaxed">
                Kutcheri Log's song database was built from the following sources.
                We are grateful to these creators for making Carnatic music information accessible.
              </p>
              <ul className="space-y-4">
                {SOURCES.map(source => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-700 text-sm font-medium hover:text-stone-900 underline decoration-stone-200 hover:decoration-stone-400 underline-offset-2"
                    >
                      {source.name}
                    </a>
                    <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">{source.desc}</p>
                  </li>
                ))}
              </ul>
              <p className="text-stone-300 text-xs pt-4 border-t border-stone-100">
                All source content is referenced via links and original-wording summaries.
                No verbatim text is stored except Wikipedia content (CC BY-SA, with attribution).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail views */}
      {selectedSong && (
        <SongDetail
          song={selectedSong}
          onClose={() => setSelectedSong(null)}
          onShowRagam={handleShowRagam}
          onShowComposer={handleShowComposer}
        />
      )}
      {selectedRagam && (
        <EntityDetail
          type="ragam"
          ragam={selectedRagam}
          onClose={() => setSelectedRagam(null)}
          onSelectSong={song => { setSelectedRagam(null); setSelectedSong(song); }}
          onShowRagam={handleShowRagam}
        />
      )}
      {selectedComposer && (
        <EntityDetail
          type="composer"
          composer={selectedComposer}
          onClose={() => setSelectedComposer(null)}
          onSelectSong={song => { setSelectedComposer(null); setSelectedSong(song); }}
          onShowRagam={handleShowRagam}
        />
      )}
    </>
  );
}
