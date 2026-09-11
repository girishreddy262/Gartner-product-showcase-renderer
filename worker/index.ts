/**
 * The only API surface. The browser never talks to S3, ElevenLabs, OpenAI or
 * the render service directly, so no vendor key ever reaches the client and
 * there is no CORS to configure: everything is same-origin.
 */
import { readSession, signSession, cookieFrom, setCookie, SESSION_COOKIE, SESSION_DAYS } from './session';
import {
  resolveAccount, reserve, refund, allUsage, setQuota, checkInvite, CAN_EDIT,
  type Account, type Metric,
} from './accounts';

type Fetcher = { fetch: (req: Request) => Promise<Response> };

export interface Env {
  ASSETS: Fetcher;
  /**
   * Service bindings. Cloudflare BLOCKS worker-to-worker calls made over
   * workers.dev URLs (error code 1042), so every proxy must go through a
   * binding instead of fetch(). The URL vars below are only a fallback for
   * local development.
   */
  API_SVC?: Fetcher;
  VOX_SVC?: Fetcher;
  /** Existing worker that presigns S3 and triggers Remotion renders. */
  FLOWDEMO_API: string;
  /** Existing voice worker (ElevenLabs STT and TTS). */
  VOX_API: string;
  /** D1, where projects live. */
  DB?: D1Database;
  /** Google OAuth. Create the credentials in Google Cloud Console. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Signs session cookies. Any long random string. */
  SESSION_SECRET?: string;
  /** Email domains that join the shared company workspace. */
  COMPANY_DOMAINS?: string;
  /** 'invite' or 'open'. Ship as 'invite', flip when ready. */
  SIGNUP_MODE?: string;
  /** JSON array of ready-made avatars. See /api/stock-avatars. */
  STOCK_AVATARS?: string;
  /** Local development only. Never set in production. */
  DEV_EMAIL?: string;
  /** 'fal' (hosted, nothing to run) or 'heygem' (your own GPU box). */
  LIPSYNC_PROVIDER?: string;
  FAL_KEY?: string;
  /** Cloudflare Tunnel hostname for the GPU box, plus its shared secret. */
  HEYGEM_URL?: string;
  HEYGEM_SECRET?: string;
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

/** Read as text first so a non-JSON upstream reply cannot throw a parse error. */
async function passthru(r: Response, label: string) {
  const t = await r.text();
  try {
    return json(JSON.parse(t), r.status);
  } catch {
    return json({ error: `${label} returned ${r.status}`, detail: t.slice(0, 300) }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    const API = env.FLOWDEMO_API || 'https://flowdemo-api.girishreddy262.workers.dev';
    const VOX = env.VOX_API || 'https://voxscript-worker.girishreddy262.workers.dev';

    /**
     * Call a sibling worker. Uses the service binding when one is configured,
     * which is direct, free and immune to the 1042 same-zone block; falls back
     * to a plain fetch only when no binding exists.
     */
    const call = (svc: Fetcher | undefined, base: string, path: string, init?: RequestInit) => {
      const target = base + path;
      const req = new Request(target, init);
      return svc ? svc.fetch(req) : fetch(req);
    };
    const callApi = (path: string, init?: RequestInit) => call(env.API_SVC, API, path, init);
    const callVox = (path: string, init?: RequestInit) => call(env.VOX_SVC, VOX, path, init);

    try {
      /*
       * Everything under /api requires a verified identity. Without this the
       * endpoints are open to anyone with the URL: they cannot read the keys,
       * but they can SPEND them.
       */
      const secret = env.SESSION_SECRET || 'dev-only-secret';
      const redirectUri = `${url.origin}/auth/callback`;

      /* ---- sign in with Google ---- */
      if (p === '/auth/google') {
        if (!env.GOOGLE_CLIENT_ID) return json({ error: 'sign-in is not configured' }, 501);
        const state = crypto.randomUUID();
        const invite = url.searchParams.get('invite') || '';
        const next = url.searchParams.get('next') || '/';
        const g = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        g.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
        g.searchParams.set('redirect_uri', redirectUri);
        g.searchParams.set('response_type', 'code');
        g.searchParams.set('scope', 'openid email profile');
        g.searchParams.set('state', state);
        g.searchParams.set('prompt', 'select_account');
        return new Response(null, {
          status: 302,
          headers: {
            location: g.toString(),
            // state, the invite code and the return path ride along in a short
            // cookie so the callback can verify and resume.
            'set-cookie': `fde_oauth=${state}|${encodeURIComponent(invite)}|${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      }

      if (p === '/auth/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const raw = cookieFrom(request.headers.get('cookie'), 'fde_oauth');
        const [wantState, invite, next] = (raw || '').split('|');
        if (!code || !state || state !== wantState) {
          return Response.redirect(`${url.origin}/?error=sign_in_failed`, 302);
        }

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: env.GOOGLE_CLIENT_ID || '',
            client_secret: env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: redirectUri, grant_type: 'authorization_code',
          }),
        });
        if (!tokenRes.ok) return Response.redirect(`${url.origin}/?error=sign_in_failed`, 302);
        const tok = await tokenRes.json() as { access_token?: string };

        const profRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { authorization: `Bearer ${tok.access_token}` },
        });
        if (!profRes.ok) return Response.redirect(`${url.origin}/?error=sign_in_failed`, 302);
        const prof = await profRes.json() as { sub: string; email: string; name?: string; email_verified?: boolean };

        // An unverified Google address is not proof of anything.
        if (!prof.email || prof.email_verified === false) {
          return Response.redirect(`${url.origin}/?error=email_unverified`, 302);
        }

        // Closed ONLY when explicitly set to invite. Anything else, including a
        // missing value or a database error, lets the person in: locking users
        // out because of a config typo is worse than an unexpected signup.
        if (env.DB && (env.SIGNUP_MODE || 'open').trim().toLowerCase() === 'invite') {
          try {
            const g = await checkInvite(
              env.DB, prof.email.toLowerCase(), decodeURIComponent(invite || '') || null,
              'invite', env.COMPANY_DOMAINS || ''
            );
            if (!g.ok) {
              return Response.redirect(`${url.origin}/?error=invite_only&reason=${encodeURIComponent(g.reason)}`, 302);
            }
          } catch { /* a broken gate must not become a locked door */ }
        }

        const session = await signSession({
          uid: prof.sub, email: prof.email.toLowerCase(), name: prof.name,
          exp: Date.now() + SESSION_DAYS * 86400_000,
        }, secret);

        return new Response(null, {
          status: 302,
          headers: {
            location: decodeURIComponent(next || '/') || '/',
            'set-cookie': setCookie(session, SESSION_DAYS * 86400),
          },
        });
      }

      if (p === '/auth/logout') {
        return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': setCookie('', 0) } });
      }

      /* ---- identity for everything under /api ---- */
      let acct: Account | null = null;

      if (p.startsWith('/api/')) {
        let s = await readSession(cookieFrom(request.headers.get('cookie'), SESSION_COOKIE), secret);
        if (!s && env.DEV_EMAIL) s = { uid: 'dev', email: env.DEV_EMAIL, name: 'Developer', exp: Date.now() + 86400_000 };
        if (!s) return json({ error: 'not signed in', code: 'unauthenticated' }, 401);
        if (!env.DB) return json({ error: 'no database bound', code: 'no_db' }, 501);
        acct = await resolveAccount(env.DB, s, env.COMPANY_DOMAINS || '');
      }

      const needsEdit = () => (acct ? CAN_EDIT.includes(acct.role) : false);
      const workspaceId = acct?.workspaceId || 'ws_default';
      const me = acct;

      /** Refuse a paid call that would exceed the plan, before making it. */
      const gate = async (metric: Metric, amount: number) => {
        if (!env.DB || !acct) return null;
        const r = await reserve(env.DB, acct.workspaceId, acct.plan, metric, amount);
        if (r.ok) return null;
        return json({
          error: 'you have used up this allowance', code: 'quota_exceeded',
          metric, used: r.used, allowed: r.allowed,
        }, 429);
      };

      if (p === '/api/me') {
        const { results } = await env.DB!.prepare(
          'SELECT email, name, role, last_seen_at FROM member WHERE workspace_id = ? ORDER BY created_at'
        ).bind(workspaceId).all();
        return json({
          email: acct!.email, name: acct!.name || acct!.email.split('@')[0],
          role: acct!.role, workspaceId, kind: acct!.kind, plan: acct!.plan,
          members: results || [],
          usage: await allUsage(env.DB!, workspaceId, acct!.plan),
        });
      }

      /* ---- presigned upload for a media file ---- */
      if (p === '/api/upload-url') {
        if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
        const key = url.searchParams.get('key');
        const ct = url.searchParams.get('contentType') || 'application/octet-stream';
        if (!key || key.includes('..')) return json({ error: 'bad key' }, 400);
        const r = await callApi(`/s3-upload-url?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(ct)}`);
        return passthru(r, 'upload service');
      }

      /* ---- signed read URL, since the media bucket is private ---- */
      if (p === '/api/media-url') {
        const key = url.searchParams.get('key');
        if (!key) return json({ error: 'key required' }, 400);
        const r = await callApi(`/s3-get-url?key=${encodeURIComponent(key)}`);
        return passthru(r, 'media service');
      }

      /* ---- start a render ---- */
      if (p === '/api/render' && request.method === 'POST') {
        if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
        const body = await request.text();
        const secs = (() => { try { return Math.ceil((JSON.parse(body).durationMs || 0) / 1000); } catch { return 0; } })();
        const denied = await gate('render_seconds', secs);
        if (denied) return denied;
        const r = await callApi('/trigger-render', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body,
        });
        return passthru(r, 'render service');
      }

      /* ---- poll a render ---- */
      if (p === '/api/render-status') {
        const id = url.searchParams.get('id') || '';
        const bucket = url.searchParams.get('bucket') || '';
        const r = await callApi(`/render-status?id=${encodeURIComponent(id)}&bucket=${encodeURIComponent(bucket)}`);
        return passthru(r, 'render service');
      }

      /* ---- transcription ---- */
      if (p === '/api/transcribe' && request.method === 'POST') {
        const body = await request.text();
        const r = await callVox('/vox/transcribe', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body,
        });
        return passthru(r, 'voice service');
      }

      /* ---- ready-made avatars, if this deployment has any ---- */
      if (p === '/api/stock-avatars') {
        // Set STOCK_AVATARS to a JSON array in wrangler.toml, or leave it unset.
        // No faces ship by default: stock avatars need a licence covering the
        // likeness of a real person, which is a rights question, not a build one.
        try {
          return json({ avatars: env.STOCK_AVATARS ? JSON.parse(env.STOCK_AVATARS) : [] });
        } catch {
          return json({ avatars: [], error: 'STOCK_AVATARS is not valid JSON' });
        }
      }

      /* ---- tidy a script with the language model on the voice worker ---- */
      if (p === '/api/clean' && request.method === 'POST') {
        if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
        const r = await callVox('/vox/clean', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text(),
        });
        return passthru(r, 'voice service');
      }

      /* ---- text to speech, returns audio bytes ---- */
      if (p === '/api/tts' && request.method === 'POST') {
        if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
        const body = await request.text();
        const chars = (() => { try { return String(JSON.parse(body).text || '').length; } catch { return 0; } })();
        const denied = await gate('tts_chars', chars);
        if (denied) return denied;
        const r = await callVox('/vox/tts', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body,
        });
        if (!r.ok) {
          if (env.DB && acct) await refund(env.DB, acct.workspaceId, acct.plan, 'tts_chars', chars);
          return passthru(r, 'voice service');
        }
        return new Response(r.body, {
          status: 200,
          headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
        });
      }

      if (p === '/api/voices') {
        const r = await callVox('/vox/voices');
        return passthru(r, 'voice service');
      }

      /*
       * Lip-sync. One interface, two possible engines. The editor never knows
       * which ran, so moving from rented to owned GPU is one variable.
       * Files are passed as signed URLs: bytes never cross the Worker, which
       * has neither the CPU budget nor the memory for video.
       */
      if (p === '/api/lipsync' && request.method === 'POST') {
        if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
        const body = await request.json() as { videoUrl?: string; audioUrl?: string; seconds?: number };
        /*
         * Reserve what this job will actually use.
         *
         * This used to reserve a 40 second minimum per call, so eight
         * ten-second paragraphs consumed 320 seconds of a 300 second
         * allowance and the ninth was refused. fal bills per second of
         * output, and output length equals the narration, so the honest
         * figure is the narration length.
         */
        const want = Math.max(1, Math.ceil(body.seconds || 0));
        if (!body.seconds) {
          return json({ error: 'the length of the narration is required', code: 'seconds_required' }, 400);
        }
        const denied = await gate('lipsync_seconds', want);
        if (denied) return denied;
        if (!body.videoUrl || !body.audioUrl) return json({ error: 'videoUrl and audioUrl are required' }, 400);
        const provider = env.LIPSYNC_PROVIDER || 'fal';

        if (provider === 'heygem') {
          if (!env.HEYGEM_URL) return json({ error: 'HEYGEM_URL is not set' }, 501);
          const code = crypto.randomUUID();
          const r = await fetch(`${env.HEYGEM_URL}/easy/submit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-secret': env.HEYGEM_SECRET || '' },
            body: JSON.stringify({ code, video_url: body.videoUrl, audio_url: body.audioUrl }),
          });
          if (!r.ok) return passthru(r, 'lipsync service');
          return json({ jobId: code, provider: 'heygem' });
        }

        if (!env.FAL_KEY) return json({ error: 'FAL_KEY is not set' }, 501);
        const r = await fetch('https://queue.fal.run/fal-ai/latentsync', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Key ${env.FAL_KEY}` },
          body: JSON.stringify({
            video_url: body.videoUrl,
            audio_url: body.audioUrl,
            // Narration is usually longer than the take it is spoken over.
            // Without this the model runs out of picture and the tail is blank.
            loop_mode: 'loop',
          }),
        });
        if (!r.ok) {
          // Nothing ran, so nothing should be charged against the allowance.
          if (env.DB && acct) await refund(env.DB, acct.workspaceId, acct.plan, 'lipsync_seconds', want);
          return passthru(r, 'lipsync service');
        }
        const d = await r.json() as { request_id?: string; status_url?: string; response_url?: string };
        if (!d.request_id) {
          if (env.DB && acct) await refund(env.DB, acct.workspaceId, acct.plan, 'lipsync_seconds', want);
          return json({ error: 'the lip-sync service did not return a job id' }, 502);
        }
        // Hand back the URLs fal gave us. Rebuilding them by hand breaks the
        // moment a model is namespaced differently from its endpoint id.
        return json({
          jobId: d.request_id, provider: 'fal',
          statusUrl: d.status_url || null, resultUrl: d.response_url || null,
        });
      }

      if (p === '/api/lipsync-status') {
        const id = url.searchParams.get('id') || '';
        const provider = env.LIPSYNC_PROVIDER || 'fal';
        if (!id) return json({ error: 'id required' }, 400);

        if (provider === 'heygem') {
          const r = await fetch(`${env.HEYGEM_URL}/easy/query?code=${encodeURIComponent(id)}`, {
            headers: { 'x-secret': env.HEYGEM_SECRET || '' },
          });
          if (!r.ok) return passthru(r, 'lipsync service');
          const d = await r.json() as { status?: string; progress?: number; result?: string; msg?: string };
          return json({
            done: d.status === 'success' || d.status === 'completed',
            failed: d.status === 'failed' || d.status === 'error',
            progress: (d.progress ?? 0) / 100,
            url: d.result || '',
            error: d.msg || '',
            queueDepth: null,
          });
        }

        // Only fal's own hosts, so a caller cannot point this at anything else.
        const safe = (u: string | null) => (u && /^https:\/\/[a-z0-9.-]*fal\.run\//.test(u) ? u : null);
        const statusUrl = safe(url.searchParams.get('statusUrl'))
          || `https://queue.fal.run/fal-ai/latentsync/requests/${encodeURIComponent(id)}/status`;
        const resultUrl = safe(url.searchParams.get('resultUrl'))
          || `https://queue.fal.run/fal-ai/latentsync/requests/${encodeURIComponent(id)}`;

        const r = await fetch(statusUrl, { headers: { authorization: `Key ${env.FAL_KEY || ''}` } });
        if (!r.ok) return passthru(r, 'lipsync service');
        const d = await r.json() as { status?: string; queue_position?: number };
        const state = (d.status || '').toUpperCase();

        if (state !== 'COMPLETED' && state !== 'OK') {
          return json({
            done: false,
            failed: state === 'FAILED' || state === 'ERROR',
            error: state === 'FAILED' || state === 'ERROR' ? 'the lip-sync job failed' : '',
            progress: state === 'IN_PROGRESS' ? 0.5 : 0.1,
            queueDepth: d.queue_position ?? null,
          });
        }

        const rr = await fetch(resultUrl, { headers: { authorization: `Key ${env.FAL_KEY || ''}` } });
        const res = await rr.json() as { video?: { url?: string }; url?: string; detail?: unknown };
        const out = res.video?.url || res.url || '';
        // A finished job with no video is a failure, not a black clip.
        if (!out) {
          return json({
            done: false, failed: true, progress: 1,
            error: 'the lip-sync job finished without producing a video, usually because no face was found in the clip',
          });
        }
        return json({ done: true, failed: false, progress: 1, url: out });
      }

      /** Prepare a face model from the consent/idle clip. HeyGem does this
       *  explicitly; fal has no prepare step, so it is a no-op there. */
      if (p === '/api/avatar-prepare' && request.method === 'POST') {
        const provider = env.LIPSYNC_PROVIDER || 'fal';
        if (provider !== 'heygem') return json({ ready: true, modelRef: null, note: 'no prepare step needed' });
        const body = await request.text();
        const r = await fetch(`${env.HEYGEM_URL}/easy/prepare`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-secret': env.HEYGEM_SECRET || '' },
          body,
        });
        return passthru(r, 'lipsync service');
      }

      /* ---- projects ---- */
      if (p.startsWith('/api/projects')) {
        if (!env.DB) return json({ error: 'no database bound', code: 'no_db' }, 501);
        const id = p.split('/')[3];
        const ws = workspaceId;
        const who = me!.email;

        if (request.method === 'GET' && !id) {
          const folder = url.searchParams.get('folder');
          const q = url.searchParams.get('q');
          let sql = `SELECT id, name, folder, state, owner_email, updated_at, updated_by, duration_ms, thumb, rev
                     FROM project WHERE workspace_id = ?`;
          const args: unknown[] = [ws];
          if (folder) { sql += ' AND folder = ?'; args.push(folder); }
          if (q) { sql += ' AND name LIKE ?'; args.push(`%${q}%`); }
          sql += ' ORDER BY updated_at DESC LIMIT 200';
          const { results } = await env.DB.prepare(sql).bind(...args).all();
          return json({ projects: results || [] });
        }

        if (request.method === 'GET' && id) {
          const row = await env.DB.prepare(
            'SELECT id, name, folder, state, rev, updated_at, updated_by, doc FROM project WHERE id = ? AND workspace_id = ?'
          ).bind(id, ws).first();
          if (!row) return json({ error: 'not found' }, 404);
          return json({
            id: row.id, name: row.name, folder: row.folder, state: row.state,
            rev: row.rev, updatedAt: row.updated_at, updatedBy: row.updated_by,
            doc: JSON.parse(String(row.doc)),
          });
        }

        if (request.method === 'PUT' && id) {
          if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
          const body = await request.json() as {
            name?: string; folder?: string; state?: string;
            doc?: unknown; rev?: number; durationMs?: number; thumb?: string;
          };
          const docText = JSON.stringify(body.doc ?? {});
          if (docText.length > 6 * 1024 * 1024) return json({ error: 'project is too large to save' }, 413);
          const now = Date.now();

          const existing = await env.DB.prepare(
            'SELECT rev FROM project WHERE id = ? AND workspace_id = ?'
          ).bind(id, ws).first<{ rev: number }>();

          if (!existing) {
            await env.DB.prepare(
              `INSERT INTO project (id, workspace_id, folder, name, state, owner_email, updated_by,
                                    created_at, updated_at, rev, duration_ms, thumb, doc)
               VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)`
            ).bind(
              id, ws, body.folder ?? null, body.name || 'Untitled', body.state || 'draft',
              who, who, now, now, body.durationMs ?? 0, body.thumb ?? null, docText
            ).run();
            return json({ ok: true, rev: 1, updatedAt: now });
          }

          // Refuse a save built on a stale copy rather than silently clobbering.
          if (typeof body.rev === 'number' && body.rev !== existing.rev) {
            return json({ error: 'conflict', code: 'stale_rev', serverRev: existing.rev }, 409);
          }

          const rev = existing.rev + 1;
          await env.DB.prepare(
            `UPDATE project SET name = ?, folder = ?, state = ?, updated_by = ?,
                    updated_at = ?, rev = ?, duration_ms = ?, thumb = ?, doc = ?
             WHERE id = ? AND workspace_id = ?`
          ).bind(
            body.name || 'Untitled', body.folder ?? null, body.state || 'draft', who,
            now, rev, body.durationMs ?? 0, body.thumb ?? null, docText, id, ws
          ).run();
          return json({ ok: true, rev, updatedAt: now });
        }

        if (request.method === 'DELETE' && id) {
          if (!needsEdit()) return json({ error: 'you have view-only access', code: 'read_only' }, 403);
          await env.DB.prepare('DELETE FROM project WHERE id = ? AND workspace_id = ?').bind(id, ws).run();
          return json({ ok: true });
        }

        return json({ error: 'method not allowed' }, 405);
      }

      /* ---- invites, for the owner ---- */
      if (p === '/api/invites' && env.DB && acct) {
        if (acct.role !== 'owner' && acct.role !== 'admin') {
          return json({ error: 'only an owner can manage invitations', code: 'forbidden' }, 403);
        }
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT code, email, note, max_uses, used, expires_at FROM invite ORDER BY created_at DESC LIMIT 100'
          ).all();
          return json({ invites: results || [], signupMode: env.SIGNUP_MODE || 'open' });
        }
        if (request.method === 'POST') {
          const b = await request.json() as { email?: string; note?: string; maxUses?: number; days?: number };
          const code = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
          await env.DB.prepare(
            'INSERT INTO invite (code, email, note, max_uses, used, created_by, created_at, expires_at) VALUES (?,?,?,?,0,?,?,?)'
          ).bind(
            code, b.email?.toLowerCase() || null, b.note || null, b.maxUses ?? 1,
            acct.email, Date.now(), b.days ? Date.now() + b.days * 86400_000 : null
          ).run();
          return json({ ok: true, code, link: `${url.origin}/?invite=${code}` });
        }
      }

      /* ---- what is left of the allowance ---- */
      if (p === '/api/usage' && env.DB && acct) {
        if (request.method === 'POST') {
          if (acct.role !== 'owner' && acct.role !== 'admin') {
            return json({ error: 'only an owner can change limits', code: 'forbidden' }, 403);
          }
          const b = await request.json() as { metric?: Metric; allowed?: number };
          if (!b.metric || typeof b.allowed !== 'number') {
            return json({ error: 'metric and allowed are required' }, 400);
          }
          await setQuota(env.DB, acct.workspaceId, b.metric, Math.max(0, b.allowed));
        }
        return json({
          plan: acct.plan,
          usage: await allUsage(env.DB, acct.workspaceId, acct.plan),
        });
      }

      if (p === '/api/diag') {
        const probe = async (name: string, fn: () => Promise<Response>) => {
          try {
            const r = await fn();
            const t = (await r.text()).slice(0, 120);
            return { name, status: r.status, ok: r.ok, sample: t };
          } catch (e) { return { name, status: 0, ok: false, sample: String((e as Error).message) }; }
        };
        return json({
          bindings: { api: !!env.API_SVC, vox: !!env.VOX_SVC },
          checks: [
            await probe('upload', () => callApi('/s3-upload-url?key=probe.txt&contentType=text/plain')),
            await probe('voices', () => callVox('/vox/voices')),
          ],
        });
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: String((e as Error)?.message || e) }, 500);
    }
  },
};
