import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ConcertItem } from '../types';
import { SourceLinks } from './SourceLinks';

interface Props {
  item: ConcertItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (item: ConcertItem) => void;
  onDelete: () => void;
  onShowRagam: (name: string) => void;
}

export function SetlistItem({ item, expanded, onToggle, onUpdate, onDelete, onShowRagam }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="border-b border-stone-100 last:border-b-0">
      <div className="flex items-center">
        <button
          {...attributes}
          {...listeners}
          className="px-1 py-3 text-stone-300 hover:text-stone-400 cursor-grab active:cursor-grabbing min-w-[28px] min-h-[44px] flex items-center justify-center touch-none text-xs"
        >
          ⠿
        </button>

        <button
          onClick={onToggle}
          className="flex-1 py-3 pr-3 text-left min-h-[44px] flex items-center gap-3"
        >
          <span className="text-stone-300 text-xs font-mono w-4 text-right shrink-0">
            {item.position}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-stone-800 text-sm">
              {item.kriti_name}
            </span>
            {item.uncertain && (
              <span className="text-red-400 text-xs ml-1">(?)</span>
            )}
            <div className="flex gap-3 text-xs text-stone-400 mt-0.5">
              <span
                className="cursor-pointer hover:text-stone-600"
                onClick={e => {
                  e.stopPropagation();
                  if (item.ragam) onShowRagam(item.ragam);
                }}
              >
                {item.ragam}
              </span>
              {item.talam && <span>{item.talam}</span>}
              <span className="truncate">{item.composer}</span>
            </div>
            {item.links?.length > 0 && (
              <div className="mt-0.5">
                <SourceLinks links={item.links} />
              </div>
            )}
            {item.notes && (
              <div className="text-stone-300 text-xs mt-0.5 truncate italic">
                {item.notes}
              </div>
            )}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-stone-100 ml-7">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-stone-400 text-xs font-medium">Kriti Name</label>
              <input
                type="text"
                value={item.kriti_name}
                onChange={e => onUpdate({ ...item, kriti_name: e.target.value })}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Ragam</label>
              <input
                type="text"
                value={item.ragam}
                onChange={e => onUpdate({ ...item, ragam: e.target.value })}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Talam</label>
              <input
                type="text"
                value={item.talam}
                onChange={e => onUpdate({ ...item, talam: e.target.value })}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Composer</label>
              <input
                type="text"
                value={item.composer}
                onChange={e => onUpdate({ ...item, composer: e.target.value })}
                className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs font-medium">Type</label>
              <select
                value={item.type}
                onChange={e => onUpdate({ ...item, type: e.target.value as ConcertItem['type'] })}
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
              value={item.notes}
              onChange={e => onUpdate({ ...item, notes: e.target.value })}
              className="w-full bg-white text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none placeholder-stone-300 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-stone-500 text-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={item.uncertain}
                onChange={e => onUpdate({ ...item, uncertain: e.target.checked })}
                className="w-4 h-4 rounded border-stone-300 accent-stone-600"
              />
              Uncertain (?)
            </label>
            <button
              onClick={onDelete}
              className="text-stone-400 hover:text-red-500 text-sm min-h-[44px] px-3"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
