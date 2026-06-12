import { getRagamByName } from '../services/songDb';

interface Props {
  ragamName: string;
  onClose: () => void;
}

export function RagamInfo({ ragamName, onClose }: Props) {
  const ragam = getRagamByName(ragamName);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up" onClick={onClose}>
      <div
        className="bg-white border-t border-stone-200 rounded-t-2xl p-5 max-w-xl mx-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-stone-800 font-mono text-base font-medium">{ragamName}</h3>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-2"
          >
            ×
          </button>
        </div>

        {ragam ? (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-stone-400 text-xs font-medium">Arohana </span>
              <span className="text-stone-700 font-mono">{ragam.arohana}</span>
            </div>
            <div>
              <span className="text-stone-400 text-xs font-medium">Avarohana </span>
              <span className="text-stone-700 font-mono">{ragam.avarohana}</span>
            </div>
            <div className="flex gap-6 pt-1">
              {ragam.mela_number && (
                <div>
                  <span className="text-stone-400 text-xs">Melakarta </span>
                  <span className="text-stone-600 text-xs">#{ragam.mela_number}</span>
                </div>
              )}
              {ragam.parent_mela && ragam.janaka_or_janya === 'janya' && (
                <div>
                  <span className="text-stone-400 text-xs">Parent </span>
                  <span className="text-stone-600 text-xs">#{ragam.parent_mela}</span>
                </div>
              )}
              <div>
                <span className="text-stone-400 text-xs">Type </span>
                <span className="text-stone-600 text-xs capitalize">{ragam.janaka_or_janya}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-stone-400 text-sm">Ragam not found in database.</p>
        )}
      </div>
    </div>
  );
}
