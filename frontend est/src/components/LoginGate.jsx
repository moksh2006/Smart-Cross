import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Panel, Button, inputCls, ErrorBox, Spinner } from './ui';

/** Renders children only for an authenticated admin. */
export default function LoginGate({ children, title = 'Admin login required', description }) {
  const { isAdmin, checking, login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (checking) return <Spinner />;
  if (isAdmin) return children;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(password); setPassword(''); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-md">
      <Panel title={title} icon={Lock}>
        {description && <p className="mb-3 text-sm text-slate-400">{description}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input type="password" autoComplete="current-password" className={inputCls} placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Admin password" />
          <ErrorBox error={error} />
          <Button type="submit" variant="primary" disabled={busy || !password} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
          <p className="text-xs text-slate-500">The password is set with ADMIN_PASSWORD on the server.</p>
        </form>
      </Panel>
    </div>
  );
}
