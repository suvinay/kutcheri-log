import type { Concert } from '../types';

const REPO_OWNER = 'suvinay';
const REPO_NAME = 'kutcheri-log';
const FILE_PATH = 'src/data/concerts.json';
const BRANCH = 'main';

interface GitHubFile {
  sha: string;
  content: string;
}

async function getFile(token: string): Promise<GitHubFile | null> {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } },
  );
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();
  return { sha: data.sha, content: atob(data.content.replace(/\n/g, '')) };
}

async function putFile(token: string, content: string, sha: string | null, message: string): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${resp.status}`);
  }
}

export async function publishConcert(concert: Concert): Promise<void> {
  const token = localStorage.getItem('github-pat');
  if (!token) throw new Error('Set your GitHub token in Settings first.');

  const file = await getFile(token);
  let existing: Concert[] = [];
  if (file) {
    try {
      existing = JSON.parse(file.content);
    } catch {
      existing = [];
    }
  }

  const idx = existing.findIndex(c => c.id === concert.id);
  if (idx >= 0) {
    existing[idx] = concert;
  } else {
    existing.push(concert);
  }

  existing.sort((a, b) => b.date.localeCompare(a.date));

  const content = JSON.stringify(existing, null, 2) + '\n';
  const artistNames = concert.artists.filter(a => a.name).map(a => a.name).join(', ');
  const message = idx >= 0
    ? `Update concert: ${concert.date} — ${artistNames}`
    : `Add concert: ${concert.date} — ${artistNames}`;

  await putFile(token, content, file?.sha ?? null, message);
}

export async function publishAllConcerts(concerts: Concert[]): Promise<void> {
  const token = localStorage.getItem('github-pat');
  if (!token) throw new Error('Set your GitHub token in Settings first.');

  const file = await getFile(token);
  const sorted = [...concerts].sort((a, b) => b.date.localeCompare(a.date));
  const content = JSON.stringify(sorted, null, 2) + '\n';

  await putFile(token, content, file?.sha ?? null, `Publish ${concerts.length} concerts`);
}
