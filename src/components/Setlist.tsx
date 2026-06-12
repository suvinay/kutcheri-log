import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ConcertItem } from '../types';
import { SetlistItem } from './SetlistItem';
import { RagamInfo } from './RagamInfo';

interface Props {
  items: ConcertItem[];
  onReorder: (items: ConcertItem[]) => void;
  onUpdate: (item: ConcertItem) => void;
  onDelete: (itemId: string) => void;
}

export function Setlist({ items, onReorder, onUpdate, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRagam, setShowRagam] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<{ item: ConcertItem; timer: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered);
  };

  const handleDelete = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (undoItem) clearTimeout(undoItem.timer);

    const timer = window.setTimeout(() => {
      setUndoItem(null);
    }, 4000);

    setUndoItem({ item, timer });
    onDelete(itemId);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    clearTimeout(undoItem.timer);
    const restored = [...items];
    const pos = Math.min(undoItem.item.position - 1, restored.length);
    restored.splice(pos, 0, undoItem.item);
    onReorder(restored);
    setUndoItem(null);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-stone-300 text-sm">
        No items yet. Search and add songs above.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-stone-400 text-xs font-medium mb-2">
        Setlist · {items.length}
      </h3>

      <div className="border border-stone-200 rounded-lg bg-white">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {items.map(item => (
                <SetlistItem
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onUpdate={onUpdate}
                  onDelete={() => handleDelete(item.id)}
                  onShowRagam={setShowRagam}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {undoItem && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-stone-800 text-white rounded-lg p-3 flex justify-between items-center shadow-lg z-40">
          <span className="text-sm">Deleted "{undoItem.item.kriti_name}"</span>
          <button
            onClick={handleUndo}
            className="text-stone-300 hover:text-white font-medium text-sm min-h-[44px] px-3"
          >
            Undo
          </button>
        </div>
      )}

      {showRagam && (
        <RagamInfo ragamName={showRagam} onClose={() => setShowRagam(null)} />
      )}
    </div>
  );
}
