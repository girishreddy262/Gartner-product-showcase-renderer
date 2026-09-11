import { useSyncExternalStore } from 'react';

export type Role = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';

export interface Member { email: string; name: string | null; role: Role; last_seen_at: number | null }

export interface Usage { used: number; allowed: number }

export interface Me {
  email: string; name: string; role: Role; workspaceId: string;
  kind: 'company' | 'trial'; plan: string;
  members: Member[];
  usage: Record<string, Usage>;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_in'; me: Me }
  | { status: 'signed_out' }
  | { status: 'not_a_member'; message: string }
  | { status: 'error'; message: string };

let state: AuthState = { status: 'loading' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const getAuth = () => state;
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function loadMe() {
  try {
    const r = await fetch('/api/me');
    const raw = await r.text();
    let d: Record<string, unknown>;
    try { d = JSON.parse(raw); }
    catch { state = { status: 'error', message: 'the sign-in service replied unexpectedly' }; emit(); return; }

    if (r.status === 401) { state = { status: 'signed_out' }; emit(); return; }
    if (r.status === 501) { state = { status: 'error', message: 'the database is not connected yet' }; emit(); return; }
    if (r.status === 403) {
      state = { status: 'not_a_member', message: String(d.error || 'this account is not allowed here') };
      emit(); return;
    }
    if (!r.ok) { state = { status: 'error', message: String(d.error || `sign-in failed (${r.status})`) }; emit(); return; }

    state = { status: 'signed_in', me: d as unknown as Me };
    emit();
  } catch (e) {
    state = { status: 'error', message: String((e as Error).message) };
    emit();
  }
}

/** Only these roles may change anything. */
export const canEdit = (role?: Role) => role === 'owner' || role === 'admin' || role === 'editor';
export const canComment = (role?: Role) => canEdit(role) || role === 'commenter';
