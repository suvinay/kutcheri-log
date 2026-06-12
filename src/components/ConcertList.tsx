import type { Concert } from '../types';

interface Props {
  concerts: Concert[];
  onSelect: (concert: Concert) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
}

export function ConcertList({ concerts, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 px-4 py-8 max-w-xl mx-auto font-sans">
      <header className="mb-10">
        <h1 className="text-2xl font-light tracking-tight text-stone-800">
          Kutcheri Log
        </h1>
        <p className="text-stone-400 text-sm mt-1">Concert setlist logger</p>
      </header>

      <button
        onClick={onNew}
        className="w-full border border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-800 px-4 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors mb-8"
      >
        + New Concert
      </button>

      {concerts.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p>No concerts logged yet.</p>
        </div>
      ) : (
        <>
          <h2 className="text-stone-400 text-xs font-medium mb-3">Recently Logged</h2>
          <ul className="divide-y divide-stone-100">
            {concerts.map(concert => (
              <li
                key={concert.id}
                className="py-4 hover:bg-stone-100/50 -mx-3 px-3 rounded-lg cursor-pointer transition-colors"
                onClick={() => onSelect(concert)}
              >
                <div className="flex justify-between items-start w-full">
                  <div className="flex-1 min-w-0">
                    <div className="text-stone-400 font-mono text-xs tracking-wide">
                      {concert.date || 'No date'}
                    </div>
                    <div className="text-stone-800 mt-1 font-medium truncate">
                      {concert.artists
                        .filter(a => a.name)
                        .map(a => a.name)
                        .join(', ') || 'No artists'}
                    </div>
                    <div className="text-stone-400 text-sm mt-0.5 truncate">
                      {concert.venue || 'No venue'}
                      {concert.items.length > 0 && (
                        <span className="text-stone-300 ml-2">
                          · {concert.items.length} item{concert.items.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {onDelete && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('Delete this concert?')) onDelete(concert.id);
                      }}
                      className="text-stone-300 hover:text-red-400 p-2 ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
