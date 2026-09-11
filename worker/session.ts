/**
 * Sessions as a signed cookie. No session table to read on every request, and
 * no third party in the login path.
 */
const enc = new TextEncoder();

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface SessionData { uid: string; email: string; name?: string; exp: number }

export async function signSession(data: SessionData, secret: string) {
  const body = b64url(enc.encode(JSON.stringify(data)));
  const sig = b64url(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${sig}`;
}

export async function readSession(token: string | null, secret: string): Promise<SessionData | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(body));
  if (!ok) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionData;
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

export const cookieFrom = (header: string | null, name: string) => {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
};

export const SESSION_COOKIE = 'fde_session';
export const SESSION_DAYS = 30;

export const setCookie = (value: string, maxAgeSec: number) =>
  `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
