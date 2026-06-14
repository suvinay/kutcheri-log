export interface SongLink {
  label: string;
  url: string;
}

export interface Song {
  id: string;
  names: string[];
  ragam: string;
  ragam_key: string;
  talam: string;
  composer: string;
  composer_key: string;
  language: string;
  pallavi: string;
  links: SongLink[];
  tags: string[];
}

export interface Ragam {
  key: string;
  name: string;
  aliases: string[];
  arohana: string;
  avarohana: string;
  parent_mela?: number;
  mela_number?: number;
  janaka_or_janya: 'melakarta' | 'janya';
  summary: string | null;
  summary_source_ids: string[];
}

export interface Composer {
  key: string;
  name: string;
  aliases: string[];
  period: string | null;
  tradition: string | null;
  song_count: number;
  summary: string | null;
  summary_source_ids: string[];
}

export interface PageRecord {
  id: string;
  url: string;
  site: string;
  title: string;
  category: string;
  summary: string;
  ragas: string[];
  composers: string[];
  kritis: { song_id: string | null; name: string; note: string }[];
  keywords: string[];
  license: 'cc-by-sa' | 'all-rights-reserved' | 'unknown';
  stored_text: string | null;
  content_hash: string;
  fetched_at: string;
}

export interface AugSourceLink {
  source_id: string;
  label: string;
  category: string;
}

export interface Augmentations {
  sources: PageRecord[];
  song_links: Record<string, AugSourceLink[]>;
  ragam_links: Record<string, AugSourceLink[]>;
  composer_links: Record<string, AugSourceLink[]>;
}

export interface Concert {
  id: string;
  date: string;
  venue: string;
  organization: string;
  artists: Artist[];
  items: ConcertItem[];
  notes: string;
  logged_by: string;
  device_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Artist {
  role: string;
  name: string;
}

export interface ConcertItem {
  id: string;
  position: number;
  type: 'kriti' | 'RTP' | 'tillana' | 'viruttam' | 'mangalam' | 'other';
  song_id: string | null;
  kriti_name: string;
  ragam: string;
  talam: string;
  composer: string;
  language: string;
  links: SongLink[];
  notes: string;
  uncertain: boolean;
}

export interface SongMetadata {
  name: string;
  ragam: string;
  talam: string;
  composer: string;
  language: string;
  pallavi: string;
  confidence: 'high' | 'medium' | 'low';
}
