import { useState } from 'react';
import type { Concert } from '../types';
import { concertToMarkdown, copyToClipboard } from '../services/exportService';

interface Props {
  concert: Concert;
  onClose: () => void;
}

export function ExportModal({ concert, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const markdown = concertToMarkdown(concert);

  const handleCopy = async () => {
    await copyToClipboard(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col border border-stone-200 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-stone-100">
          <h2 className="text-stone-800 font-medium text-sm">Export Markdown</h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <pre className="flex-1 overflow-auto p-4 text-stone-600 text-xs font-mono whitespace-pre-wrap leading-relaxed">
          {markdown}
        </pre>

        <div className="p-4 border-t border-stone-100">
          <button
            onClick={handleCopy}
            className={`w-full py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${
              copied
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-stone-800 hover:bg-stone-700 text-white active:scale-[0.98]'
            } transition-transform`}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
