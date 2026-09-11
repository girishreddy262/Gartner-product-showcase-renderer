import React, { useEffect, useState } from 'react';
import { useAuth, loadMe } from '../store/me';

/**
 * Nothing renders until identity is known. A read-only user still sees the
 * editor; they simply cannot save, and the API refuses writes regardless of
 * what the client allows.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  useEffect(() => { void loadMe(); }, []);

  if (auth.status === 'loading') {
    return <div className="gate"><div className="gate-card"><p className="hint">Checking your access…</p></div></div>;
  }

  if (auth.status === 'signed_in') return <>{children}</>;

  const [{ err, reason, invite }] = useState(() => {
    const params = new URLSearchParams(location.search);
    const read = {
      err: params.get('error'),
      reason: params.get('reason'),
      invite: params.get('invite') || '',
    };
    if (read.err) {
      // Consume it. Otherwise reloading this URL keeps showing an old failure
      // long after whatever caused it was fixed.
      params.delete('error');
      params.delete('reason');
      const q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
    }
    return read;
  });

  const signIn = () => {
    const u = new URL('/auth/google', location.origin);
    if (invite) u.searchParams.set('invite', invite);
    u.searchParams.set('next', location.pathname + location.search);
    location.href = u.toString();
  };
  const retry = () => location.reload();

  return (
    <div className="gate">
      <div className="gate-card">
        {auth.status === 'signed_out' && (
          <>
            <h1>Make a video</h1>
            <p className="hint">
              Record or upload, edit with a script instead of a timeline, and export.
              {invite ? ' Your invitation is ready.' : ''}
            </p>
            {err === 'invite_only' && (
              <p className="hint" style={{ color: 'var(--danger)' }}>
                {reason || 'This is invite only at the moment.'}
              </p>
            )}
            {err === 'email_unverified' && (
              <p className="hint" style={{ color: 'var(--danger)' }}>
                That Google account has an unverified email address.
              </p>
            )}
            {err === 'sign_in_failed' && (
              <p className="hint" style={{ color: 'var(--danger)' }}>Sign-in did not complete. Try again.</p>
            )}
            <button className="btn btn-primary" onClick={signIn}>Continue with Google</button>
            <p className="hint gate-fine">
              Free to start, no card. You get 20 minutes of export, 5 minutes of avatar
              video and 50 images.
            </p>
          </>
        )}
        {auth.status === 'not_a_member' && (
          <>
            <h1>No access yet</h1>
            <p className="hint">{auth.message}</p>
            <p className="hint">Ask a workspace owner to add you, then reload.</p>
            <button className="act" onClick={retry}>Try again</button>
          </>
        )}
        {auth.status === 'error' && (
          <>
            <h1>Something went wrong</h1>
            <p className="hint">{auth.message}</p>
            <button className="act" onClick={retry}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
};
