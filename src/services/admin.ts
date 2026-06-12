const ADMIN_HASH = import.meta.env.VITE_ADMIN_HASH || '';
const SESSION_KEY = 'kutcheri-admin';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!ADMIN_HASH) return false;
  const hash = await sha256(password);
  if (hash === ADMIN_HASH) {
    sessionStorage.setItem(SESSION_KEY, '1');
    return true;
  }
  return false;
}

export function isAdmin(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
