import type { Concert } from '../types';

interface Props {
  concerts: Concert[];
  onSelect: (concert: Concert) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
}

export function ConcertList({ concerts, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="min-h-screen bg-white text-stone-900 px-4 py-8 max-w-xl mx-auto font-sans">
      {/* Hero */}
      <header className="mb-10 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[var(--color-brand)] rounded-lg flex items-center justify-center">
            <span className="text-white text-lg font-bold tracking-tight">K</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Kutcheri Log
          </h1>
        </div>

        <p className="text-stone-800 text-lg font-light">
          Log<span className="text-[var(--color-brand)] mx-1.5">·</span>Share<span className="text-[var(--color-brand)] mx-1.5">·</span>Discover
        </p>

        <p className="text-stone-400 text-sm mt-3 leading-relaxed max-w-md">
          Log Carnatic kutcheris. Share as markdown for your own notes, or share
          a link here. Quick index of popular Carnatic songs, ragams &amp;
          compositions sourced from the web.{' '}
          <button
            onClick={() => {
              const hamburger = document.querySelector<HTMLButtonElement>('[title="Index"]');
              hamburger?.click();
              setTimeout(() => {
                const creditsTab = document.querySelector<HTMLButtonElement>('[data-tab="credits"]');
                creditsTab?.click();
              }, 100);
            }}
            className="text-[var(--color-brand)] hover:text-[var(--color-brand)] underline underline-offset-2"
          >
            View credits
          </button>
        </p>
      </header>

      <button
        onClick={onNew}
        className="w-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white px-4 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors mb-10 active:scale-[0.98] transition-transform"
      >
        + New Concert
      </button>

      {concerts.length === 0 ? (
        <div className="text-center py-16 text-stone-300">
          <p>No concerts logged yet.</p>
        </div>
      ) : (
        <>
          <h2 className="text-stone-400 text-xs font-medium mb-1">Recently Logged</h2>
          <p className="text-stone-300 text-xs mb-4">Click any to view details</p>
          <ul className="divide-y divide-stone-100">
            {concerts.map(concert => (
              <li
                key={concert.id}
                className="py-4 hover:bg-stone-50 -mx-3 px-3 rounded-lg cursor-pointer transition-colors"
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
                      className="text-stone-300 hover:text-[var(--color-brand)] p-2 ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
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
