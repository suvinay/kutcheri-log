import type { Song } from '../types';
import {
  getRagamByKey,
  getComposerByKey,
  getSongAugLinks,
  getSourceById,
} from '../services/songDb';
import { SourceLinks } from './SourceLinks';

interface Props {
  song: Song;
  onClose: () => void;
  onShowRagam?: (ragamKey: string) => void;
  onShowComposer?: (composerKey: string) => void;
}

export function SongDetail({ song, onClose, onShowRagam, onShowComposer }: Props) {
  const ragam = getRagamByKey(song.ragam_key);
  const composer = getComposerByKey(song.composer_key);
  const augLinks = getSongAugLinks(song.id);
  const resolvedSources = augLinks
    .map(link => ({ link, source: getSourceById(link.source_id) }))
    .filter(s => s.source);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-stone-100 px-4 py-3 flex justify-between items-center z-10">
          <h2 className="text-stone-800 font-mono text-sm font-medium truncate">{song.names[0]}</h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Metadata grid */}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-stone-400 text-xs w-16 shrink-0 pt-0.5">Ragam</span>
              <span
                className={`text-stone-700 font-mono text-xs ${onShowRagam && ragam ? 'cursor-pointer hover:text-stone-900 underline decoration-stone-200' : ''}`}
                onClick={() => onShowRagam && ragam && onShowRagam(song.ragam_key)}
              >
                {song.ragam}
              </span>
            </div>
            {song.talam && (
              <div className="flex gap-2">
                <span className="text-stone-400 text-xs w-16 shrink-0 pt-0.5">Talam</span>
                <span className="text-stone-700 font-mono text-xs">{song.talam}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-stone-400 text-xs w-16 shrink-0 pt-0.5">Composer</span>
              <span
                className={`text-stone-700 text-xs ${onShowComposer && composer ? 'cursor-pointer hover:text-stone-900 underline decoration-stone-200' : ''}`}
                onClick={() => onShowComposer && composer && onShowComposer(song.composer_key)}
              >
                {song.composer}
              </span>
            </div>
            {song.language && (
              <div className="flex gap-2">
                <span className="text-stone-400 text-xs w-16 shrink-0 pt-0.5">Language</span>
                <span className="text-stone-700 text-xs">{song.language}</span>
              </div>
            )}
          </div>

          {/* Pallavi */}
          {song.pallavi && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-1">Pallavi</h3>
              <p className="text-stone-600 text-sm font-mono leading-relaxed">{song.pallavi}</p>
            </div>
          )}

          {/* Name variants */}
          {song.names.length > 1 && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-1">Also known as</h3>
              <p className="text-stone-500 text-xs font-mono">{song.names.slice(1).join(', ')}</p>
            </div>
          )}

          {/* Existing lyric/notation links */}
          {song.links.length > 0 && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-1">Lyrics & Notation</h3>
              <SourceLinks links={song.links} />
            </div>
          )}

          {/* Augmentation source links */}
          {resolvedSources.length > 0 && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-2">References</h3>
              <ul className="space-y-2">
                {resolvedSources.map(({ link, source }) => (
                  <li key={link.source_id} className="text-sm">
                    <a
                      href={source!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-600 hover:text-stone-800 underline decoration-stone-200 hover:decoration-stone-400 underline-offset-2 text-xs"
                    >
                      {link.label || source!.site}
                    </a>
                    {source!.summary && (
                      <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">{source!.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ragam info */}
          {ragam && (
            <div className="border-t border-stone-100 pt-4">
              <h3 className="text-stone-400 text-xs font-medium mb-2">
                Ragam: {ragam.name}
                {onShowRagam && (
                  <button
                    onClick={() => onShowRagam(song.ragam_key)}
                    className="text-stone-400 hover:text-stone-600 ml-2 underline text-[11px]"
                  >
                    view all songs →
                  </button>
                )}
              </h3>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-stone-400">Arohana </span>
                  <span className="text-stone-600 font-mono">{ragam.arohana}</span>
                </div>
                <div>
                  <span className="text-stone-400">Avarohana </span>
                  <span className="text-stone-600 font-mono">{ragam.avarohana}</span>
                </div>
              </div>
              {ragam.summary && (
                <p className="text-stone-500 text-xs mt-2 leading-relaxed">{ragam.summary}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
