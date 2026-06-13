import type { Ragam, Composer, Song, AugSourceLink } from '../types';
import {
  getSongsForRagam,
  getSongsForComposer,
  getRagamAugLinks,
  getComposerAugLinks,
  getSourceById,
} from '../services/songDb';
import { SourceLinks } from './SourceLinks';

interface Props {
  type: 'ragam' | 'composer';
  ragam?: Ragam;
  composer?: Composer;
  onClose: () => void;
  onSelectSong?: (song: Song) => void;
  onShowRagam?: (ragamName: string) => void;
}

export function EntityDetail({ type, ragam, composer, onClose, onSelectSong, onShowRagam }: Props) {
  const entity = type === 'ragam' ? ragam : composer;
  if (!entity) return null;

  const songs = type === 'ragam'
    ? getSongsForRagam(ragam!.key)
    : getSongsForComposer(composer!.key);

  const augLinks: AugSourceLink[] = type === 'ragam'
    ? getRagamAugLinks(ragam!.key)
    : getComposerAugLinks(composer!.key);

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
          <h2 className="text-stone-800 font-medium text-sm truncate">
            {entity.name}
            {type === 'composer' && composer?.tradition && (
              <span className="text-stone-400 font-normal ml-2 text-xs">({composer.tradition})</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Ragam scale info */}
          {type === 'ragam' && ragam && (
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-stone-400 text-xs">Arohana </span>
                <span className="text-stone-700 font-mono text-xs">{ragam.arohana}</span>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Avarohana </span>
                <span className="text-stone-700 font-mono text-xs">{ragam.avarohana}</span>
              </div>
              <div className="flex gap-4 text-xs text-stone-400">
                {ragam.mela_number && <span>Melakarta #{ragam.mela_number}</span>}
                {ragam.parent_mela && ragam.janaka_or_janya === 'janya' && <span>Parent #{ragam.parent_mela}</span>}
                <span className="capitalize">{ragam.janaka_or_janya}</span>
              </div>
            </div>
          )}

          {/* Composer period info */}
          {type === 'composer' && composer?.period && (
            <div className="text-stone-400 text-xs">{composer.period}</div>
          )}

          {/* Summary */}
          {entity.summary && (
            <div>
              <p className="text-stone-600 text-sm leading-relaxed">{entity.summary}</p>
              {entity.summary_source_ids.length > 0 && (
                <p className="text-stone-300 text-xs mt-1">
                  Synthesized from {entity.summary_source_ids.length} source{entity.summary_source_ids.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Augmentation source links */}
          {resolvedSources.length > 0 && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-2">Sources</h3>
              <ul className="space-y-2">
                {resolvedSources.map(({ link, source }) => (
                  <li key={link.source_id} className="text-sm">
                    <a
                      href={source!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-600 hover:text-stone-800 underline decoration-stone-200 hover:decoration-stone-400 underline-offset-2"
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

          {/* Aliases */}
          {entity.aliases.length > 0 && (
            <div>
              <h3 className="text-stone-400 text-xs font-medium mb-1">Also known as</h3>
              <p className="text-stone-500 text-xs font-mono">{entity.aliases.join(', ')}</p>
            </div>
          )}

          {/* Songs list */}
          <div>
            <h3 className="text-stone-400 text-xs font-medium mb-2">
              Songs ({songs.length})
            </h3>
            <ul className="divide-y divide-stone-50 max-h-80 overflow-y-auto">
              {songs.slice(0, 200).map(song => (
                <li
                  key={song.id}
                  className={`py-2 ${onSelectSong ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                  onClick={() => onSelectSong?.(song)}
                >
                  <div className="font-mono text-stone-700 text-xs">{song.names[0]}</div>
                  <div className="flex gap-3 text-[11px] text-stone-400 mt-0.5">
                    {type === 'composer' && song.ragam && (
                      <span
                        className={onShowRagam ? 'cursor-pointer hover:text-stone-600' : ''}
                        onClick={e => { if (onShowRagam) { e.stopPropagation(); onShowRagam(song.ragam); } }}
                      >
                        {song.ragam}
                      </span>
                    )}
                    {type === 'ragam' && song.composer && <span>{song.composer}</span>}
                    {song.talam && <span>{song.talam}</span>}
                  </div>
                  <SourceLinks links={song.links} className="mt-0.5" />
                </li>
              ))}
              {songs.length > 200 && (
                <li className="py-2 text-stone-300 text-xs">…and {songs.length - 200} more</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
