import type { Concert } from '../types';

export function concertToMarkdown(concert: Concert): string {
  const date = concert.date
    ? new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const lines: string[] = ['# Concert Log', ''];
  if (date) lines.push(`**Date:** ${date}`);
  if (concert.venue) lines.push(`**Venue:** ${concert.venue}`);
  if (concert.organization) lines.push(`**Organization:** ${concert.organization}`);
  if (concert.logged_by) lines.push(`**Logged by:** ${concert.logged_by}`);

  if (concert.artists.length > 0) {
    lines.push('', '**Artists:**');
    for (const a of concert.artists) {
      lines.push(`- ${a.role}: ${a.name}`);
    }
  }

  lines.push('', '---', '');

  if (concert.items.length > 0) {
    lines.push('| # | Kriti | Ragam | Talam | Composer | Notes |');
    lines.push('|---|-------|-------|-------|----------|-------|');

    for (const item of concert.items) {
      const name =
        item.links && item.links.length > 0
          ? `[${item.kriti_name}](${item.links[0].url})`
          : item.kriti_name;
      const uncertain = item.uncertain ? ' (?)' : '';
      lines.push(
        `| ${item.position} | ${name}${uncertain} | ${item.ragam} | ${item.talam} | ${item.composer} | ${item.notes} |`,
      );
    }
  }

  lines.push('', '---');
  if (concert.notes) {
    lines.push('', `**Notes:** ${concert.notes}`);
  }
  lines.push('*Logged with [Kutcheri Log](https://suvinay.github.io/kutcheri-log/)*');

  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
