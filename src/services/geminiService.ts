import type { SongMetadata } from '../types';

const SYSTEM_PROMPT = `You are an expert in Carnatic classical music. When given a partial song name, phrase, ragam, or any identifying information, identify the kriti and return its metadata as a JSON object with exactly these fields: name (canonical transliterated name), ragam, talam, composer, language, pallavi (opening line if known), confidence ("high" | "medium" | "low"). Return only the JSON object, no explanation.`;

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function identifySong(
  query: string,
  apiKey: string,
): Promise<SongMetadata> {
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: query }] }],
      generationConfig: { maxOutputTokens: 300 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse Gemini response as JSON');
  }

  return JSON.parse(jsonMatch[0]) as SongMetadata;
}

export async function identifyFromAudio(
  _blob: Blob,
): Promise<SongMetadata> {
  throw new Error('NotImplementedError: Audio identification coming soon');
}
