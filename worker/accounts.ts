import type { SessionData } from './session';

export type Role = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';
export const CAN_EDIT: Role[] = ['owner', 'admin', 'editor'];

export interface Account {
  uid: string; email: string; name?: string;
  workspaceId: string; role: Role; plan: string; kind: 'company' | 'trial';
}

/** Metered things. Anything that costs money on a third party belongs here. */
export type Metric = 'render_seconds' | 'tts_chars' | 'lipsync_seconds' | 'images';

export const PLAN_LIMITS: Record<string, Record<Metric, number>> = {
  // A trial is capped for its LIFETIME, not per month, so deleting and
  // recreating projects does not reset it.
  //
  // 300 seconds of lip-sync was five minutes of avatar for the life of the
  // account, which ran out during the first real attempt. 1800 is thirty
  // minutes, roughly $9 at fal's rate, which is enough to evaluate the feature.
  trial:   { render_seconds: 1200,  tts_chars: 50000,   lipsync_seconds: 1800, images: 50 },
  team:    { render_seconds: 36000, tts_chars: 2000000, lipsync_seconds: 3600, images: 2000 },
  company: { render_seconds: 216000, tts_chars: 10000000, lipsync_seconds: 21600, images: 20000 },
};

export const periodFor = (plan: string) =>
  plan === 'trial' ? 'all' : new Date().toISOString().slice(0, 7);

/** Find or create the user, their workspace, and their membership. */
export async function resolveAccount(
  db: D1Database, s: SessionData, companyDomains: string
): Promise<Account> {
  const domains = companyDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = s.email.split('@')[1] || '';
  const isCompany = domains.includes(domain);
  const now = Date.now();

  await db.prepare(
    `INSERT INTO app_user (id, email, name, kind, created_at, last_seen_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at, name = COALESCE(excluded.name, name)`
  ).bind(s.uid, s.email, s.name || null, isCompany ? 'company' : 'trial', now, now).run();

  const workspaceId = isCompany ? 'ws_default' : `ws_${s.uid}`;

  if (!isCompany) {
    await db.prepare(
      `INSERT OR IGNORE INTO workspace (id, name, created_at, kind, owner_email, plan)
       VALUES (?,?,?,'trial',?,'trial')`
    ).bind(workspaceId, `${(s.name || s.email.split('@')[0])}'s workspace`, now, s.email).run();
  }

  const existing = await db.prepare('SELECT role FROM member WHERE workspace_id = ? AND email = ?')
    .bind(workspaceId, s.email).first<{ role: Role }>();

  let role: Role;
  if (existing) {
    role = existing.role;
  } else {
    if (isCompany) {
      const c = await db.prepare('SELECT COUNT(*) AS n FROM member WHERE workspace_id = ?')
        .bind(workspaceId).first<{ n: number }>();
      role = (c?.n ?? 0) === 0 ? 'owner' : 'editor';
    } else {
      role = 'owner';
    }
    await db.prepare(
      'INSERT OR IGNORE INTO member (workspace_id, email, name, role, created_at) VALUES (?,?,?,?,?)'
    ).bind(workspaceId, s.email, s.name || null, role, now).run();
  }

  const ws = await db.prepare('SELECT plan FROM workspace WHERE id = ?')
    .bind(workspaceId).first<{ plan: string }>();

  return {
    uid: s.uid, email: s.email, name: s.name,
    workspaceId, role, plan: ws?.plan || (isCompany ? 'company' : 'trial'),
    kind: isCompany ? 'company' : 'trial',
  };
}

/**
 * Per-workspace overrides live in the quota table, so a limit can be raised
 * for one account without redeploying.
 */
export async function setQuota(db: D1Database, ws: string, metric: Metric, allowed: number) {
  await db.prepare(
    'INSERT INTO quota (workspace_id, metric, allowed) VALUES (?,?,?) '
    + 'ON CONFLICT(workspace_id, metric) DO UPDATE SET allowed = excluded.allowed'
  ).bind(ws, metric, allowed).run();
}

export async function limitFor(db: D1Database, ws: string, plan: string, metric: Metric) {
  const override = await db.prepare('SELECT allowed FROM quota WHERE workspace_id = ? AND metric = ?')
    .bind(ws, metric).first<{ allowed: number }>();
  return override?.allowed ?? (PLAN_LIMITS[plan] || PLAN_LIMITS.trial)[metric];
}

export async function usedSoFar(db: D1Database, ws: string, plan: string, metric: Metric) {
  const row = await db.prepare('SELECT used FROM usage WHERE workspace_id = ? AND period = ? AND metric = ?')
    .bind(ws, periodFor(plan), metric).first<{ used: number }>();
  return row?.used ?? 0;
}

/**
 * Reserve BEFORE the paid call. Checking after the fact is not a limit, it is
 * a report of how much was overspent.
 */
export async function reserve(
  db: D1Database, ws: string, plan: string, metric: Metric, amount: number
): Promise<{ ok: true } | { ok: false; used: number; allowed: number }> {
  const allowed = await limitFor(db, ws, plan, metric);
  const used = await usedSoFar(db, ws, plan, metric);
  if (used + amount > allowed) return { ok: false, used, allowed };
  await db.prepare(
    `INSERT INTO usage (workspace_id, period, metric, used, updated_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(workspace_id, period, metric) DO UPDATE SET used = used + ?, updated_at = ?`
  ).bind(ws, periodFor(plan), metric, amount, Date.now(), amount, Date.now()).run();
  return { ok: true };
}

/** Give back a reservation when the call failed. */
export async function refund(db: D1Database, ws: string, plan: string, metric: Metric, amount: number) {
  await db.prepare(
    `UPDATE usage SET used = MAX(0, used - ?), updated_at = ?
     WHERE workspace_id = ? AND period = ? AND metric = ?`
  ).bind(amount, Date.now(), ws, periodFor(plan), metric).run();
}

export async function allUsage(db: D1Database, ws: string, plan: string) {
  const metrics: Metric[] = ['render_seconds', 'tts_chars', 'lipsync_seconds', 'images'];
  const out: Record<string, { used: number; allowed: number }> = {};
  for (const m of metrics) {
    out[m] = { used: await usedSoFar(db, ws, plan, m), allowed: await limitFor(db, ws, plan, m) };
  }
  return out;
}

/** Invite gate. Open mode lets anyone in; invite mode requires a code or a
 *  personal invitation, and company email domains always bypass it. */
export async function checkInvite(
  db: D1Database, email: string, code: string | null, mode: string, companyDomains: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (mode !== 'invite') return { ok: true };
  const domain = email.split('@')[1] || '';
  if (companyDomains.split(',').map((d) => d.trim().toLowerCase()).includes(domain)) return { ok: true };

  const known = await db.prepare('SELECT 1 FROM app_user WHERE email = ?').bind(email).first();
  if (known) return { ok: true };

  const personal = await db.prepare('SELECT code, used, max_uses, expires_at FROM invite WHERE email = ?')
    .bind(email).first<{ code: string; used: number; max_uses: number; expires_at: number | null }>();
  const byCode = code
    ? await db.prepare('SELECT code, used, max_uses, expires_at FROM invite WHERE code = ? AND email IS NULL')
        .bind(code).first<{ code: string; used: number; max_uses: number; expires_at: number | null }>()
    : null;

  const inv = personal || byCode;
  if (!inv) return { ok: false, reason: 'This is invite only at the moment.' };
  if (inv.expires_at && inv.expires_at < Date.now()) return { ok: false, reason: 'That invitation has expired.' };
  if (inv.used >= inv.max_uses) return { ok: false, reason: 'That invitation has already been used.' };

  await db.prepare('UPDATE invite SET used = used + 1 WHERE code = ?').bind(inv.code).run();
  return { ok: true };
}
