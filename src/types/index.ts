export interface Song {
  id: string;
  names: string[];
  ragam: string;
  talam: string;
  composer: string;
  language: string;
  pallavi: string;
  links: SongLink[];
  tags: string[];
}

export interface SongLink {
  label: string;
  url: string;
}

export interface Ragam {
  name: string;
  aliases: string[];
  arohana: string;
  avarohana: string;
  parent_mela?: number;
  mela_number?: number;
  janaka_or_janya: 'melakarta' | 'janya';
}

export interface Concert {
  id: string;
  date: string;
  venue: string;
  organization: string;
  artists: Artist[];
  items: ConcertItem[];
  notes: string;
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
