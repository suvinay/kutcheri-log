import { useState } from 'react';
import type { Concert, Artist } from '../types';

interface Props {
  concert: Concert;
  editable: boolean;
  onUpdate: (concert: Concert) => void;
  onUpdateArtists: (artists: Artist[]) => void;
}

export function ConcertHeader({ concert, editable, onUpdate, onUpdateArtists }: Props) {
  const [expanded, setExpanded] = useState(!concert.venue);

  const updateField = (field: keyof Concert, value: string) => {
    onUpdate({ ...concert, [field]: value });
  };

  const updateArtist = (idx: number, field: keyof Artist, value: string) => {
    const artists = [...concert.artists];
    artists[idx] = { ...artists[idx], [field]: value };
    onUpdateArtists(artists);
  };

  const addArtist = () => {
    onUpdateArtists([...concert.artists, { role: '', name: '' }]);
  };

  const removeArtist = (idx: number) => {
    if (concert.artists.length <= 1) return;
    onUpdateArtists(concert.artists.filter((_, i) => i !== idx));
  };

  const artistSummary = concert.artists.filter(a => a.name).map(a => a.name).join(', ');

  return (
    <div className="border border-stone-200 rounded-lg mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex justify-between items-center min-h-[44px]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-stone-400 font-mono text-xs">{concert.date || 'Set date'}</div>
          <div className="text-stone-800 font-medium truncate">{artistSummary || 'Add artists'}</div>
          {concert.venue && (
            <div className="text-stone-400 text-sm truncate">{concert.venue}</div>
          )}
        </div>
        <span className="text-stone-300 ml-2 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-stone-100">
          <div>
            <label className="text-stone-400 text-xs font-medium">Date</label>
            <input
              type={editable ? 'date' : 'text'}
              value={concert.date}
              onChange={e => editable && updateField('date', e.target.value)}
              readOnly={!editable}
              className={`w-full text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border focus:outline-none ${editable ? 'bg-white border-stone-200 focus:border-stone-400' : 'bg-stone-50 border-stone-100'}`}
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Venue</label>
            <input
              type="text"
              value={concert.venue}
              onChange={e => editable && updateField('venue', e.target.value)}
              readOnly={!editable}
              placeholder={editable ? 'Concert hall, city' : ''}
              className={`w-full text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border focus:outline-none ${editable ? 'bg-white border-stone-200 focus:border-stone-400 placeholder-stone-300' : 'bg-stone-50 border-stone-100'}`}
            />
          </div>
          <div>
            <label className="text-stone-400 text-xs font-medium">Organization</label>
            <input
              type="text"
              value={concert.organization}
              onChange={e => editable && updateField('organization', e.target.value)}
              readOnly={!editable}
              placeholder={editable ? 'Presenting organization' : ''}
              className={`w-full text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border focus:outline-none ${editable ? 'bg-white border-stone-200 focus:border-stone-400 placeholder-stone-300' : 'bg-stone-50 border-stone-100'}`}
            />
          </div>

          <div>
            <label className="text-stone-400 text-xs font-medium">Logged by</label>
            <input
              type="text"
              value={concert.logged_by || ''}
              onChange={e => editable && updateField('logged_by', e.target.value)}
              readOnly={!editable}
              placeholder={editable ? 'Your name (optional)' : ''}
              className={`w-full text-stone-800 rounded-lg px-3 py-2 mt-1 min-h-[44px] border focus:outline-none ${editable ? 'bg-white border-stone-200 focus:border-stone-400 placeholder-stone-300' : 'bg-stone-50 border-stone-100'}`}
            />
          </div>

          <div>
            <label className="text-stone-400 text-xs font-medium">Artists</label>
            <div className="space-y-2 mt-2">
              {concert.artists.map((artist, idx) => (
                <div key={idx} className="flex gap-2">
                  {editable ? (
                    <select
                      value={artist.role}
                      onChange={e => updateArtist(idx, 'role', e.target.value)}
                      className="bg-white text-stone-800 rounded-lg px-2 py-2 min-h-[44px] border border-stone-200 focus:border-stone-400 focus:outline-none w-28 text-sm"
                    >
                      <option value="">Role</option>
                      <option value="Vocal">Vocal</option>
                      <option value="Violin">Violin</option>
                      <option value="Mridangam">Mridangam</option>
                      <option value="Ghatam">Ghatam</option>
                      <option value="Kanjira">Kanjira</option>
                      <option value="Morsing">Morsing</option>
                      <option value="Flute">Flute</option>
                      <option value="Veena">Veena</option>
                      <option value="Chitraveena">Chitraveena</option>
                      <option value="Nadaswaram">Nadaswaram</option>
                      <option value="Tavil">Tavil</option>
                      <option value="Mandolin">Mandolin</option>
                      <option value="Saxophone">Saxophone</option>
                    </select>
                  ) : (
                    <span className="bg-stone-50 text-stone-800 rounded-lg px-2 py-2 min-h-[44px] border border-stone-100 w-28 text-sm flex items-center">
                      {artist.role}
                    </span>
                  )}
                  <input
                    type="text"
                    value={artist.name}
                    onChange={e => editable && updateArtist(idx, 'name', e.target.value)}
                    readOnly={!editable}
                    placeholder={editable ? 'Artist name' : ''}
                    className={`flex-1 text-stone-800 rounded-lg px-3 py-2 min-h-[44px] border focus:outline-none ${editable ? 'bg-white border-stone-200 focus:border-stone-400 placeholder-stone-300' : 'bg-stone-50 border-stone-100'}`}
                  />
                  {editable && concert.artists.length > 1 && (
                    <button
                      onClick={() => removeArtist(idx)}
                      className="text-stone-300 hover:text-[var(--color-brand)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  onClick={addArtist}
                  className="text-stone-400 hover:text-stone-600 text-sm py-2 min-h-[44px]"
                >
                  + Add artist
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
