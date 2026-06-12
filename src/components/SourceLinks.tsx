import type { SongLink } from '../types';

interface Props {
  links: SongLink[];
  className?: string;
}

export function SourceLinks({ links, className = '' }: Props) {
  if (!links.length) return null;

  return (
    <span className={`inline-flex gap-2 flex-wrap ${className}`}>
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[11px] text-stone-400 hover:text-stone-600 underline decoration-stone-200 hover:decoration-stone-400 underline-offset-2"
        >
          {link.label}
        </a>
      ))}
    </span>
  );
}
