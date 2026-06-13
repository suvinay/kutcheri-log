import { useState } from 'react';
import type { Concert } from '../types';
import { concertToMarkdown, copyToClipboard } from '../services/exportService';

interface Props {
  concert: Concert;
  onClose: () => void;
}

export function ExportModal({ concert, onClose }: Props) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const markdown = concertToMarkdown(concert);

  const shareUrl = `${window.location.origin}${window.location.pathname}?concert=${concert.id}`;

  const handleCopyMarkdown = async () => {
    await copyToClipboard(markdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopyLink = async () => {
    await copyToClipboard(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col border border-stone-200 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-stone-100">
          <h2 className="text-stone-800 font-medium text-sm">Share</h2>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Share link */}
        <div className="px-4 pt-4">
          <label className="text-stone-400 text-xs font-medium">Shareable Link</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-stone-50 text-stone-600 rounded-lg px-3 py-2 text-xs font-mono border border-stone-100 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] transition-colors ${
                copiedLink
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {copiedLink ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Markdown preview */}
        <div className="px-4 pt-4">
          <label className="text-stone-400 text-xs font-medium">Markdown</label>
        </div>
        <pre className="flex-1 overflow-auto px-4 py-2 text-stone-500 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-48">
          {markdown}
        </pre>

        <div className="p-4 border-t border-stone-100">
          <button
            onClick={handleCopyMarkdown}
            className={`w-full py-3 rounded-lg min-h-[44px] text-sm font-medium transition-all ${
              copiedMd
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'border border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-800 active:scale-[0.98]'
            }`}
          >
            {copiedMd ? 'Copied!' : 'Copy markdown'}
          </button>
        </div>
      </div>
    </div>
  );
}
