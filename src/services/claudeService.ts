import type { SongMetadata } from '../types';

const SYSTEM_PROMPT = `You are an expert in Carnatic classical music. When given a partial song name, phrase, ragam, or any identifying information, identify the kriti and return its metadata as a JSON object with exactly these fields: name (canonical transliterated name), ragam, talam, composer, language, pallavi (opening line if known), confidence ("high" | "medium" | "low"). Return only the JSON object, no explanation.`;

export async function identifySong(
  query: string,
  apiKey: string,
): Promise<SongMetadata> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse Claude response as JSON');
  }

  return JSON.parse(jsonMatch[0]) as SongMetadata;
}

export async function identifyFromAudio(
  _blob: Blob,
): Promise<SongMetadata> {
  throw new Error('NotImplementedError: Audio identification coming soon');
}
