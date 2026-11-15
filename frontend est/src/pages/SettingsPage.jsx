import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, SlidersHorizontal } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useLiveData } from '../context/LiveDataContext';
import { Panel, inputCls, Button } from '../components/ui';
import { api } from '../lib/api';

export default function SettingsPage() {
  const { prefs, update, playSound } = useNotifications();
  const { crossings } = useLiveData();
  const [server, setServer] = useState(null);
  useEffect(() => { api.settings().then(setServer).catch(() => {}); }, []);
  const toggle = (n) => update({ watched: prefs.watched.includes(n) ? prefs.watched.filter((x) => x !== n) : [...prefs.watched, n].sort() });

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-slate-400">Personal preferences are stored in this browser. Server prediction thresholds can be changed by an administrator.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="My crossings & alerts" icon={Settings}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 text-slate-300">Crossings to watch (notifications are only sent for these)</div>
              <div className="grid grid-cols-2 gap-2">
                {crossings.map((c) => (
                  <label key={c.number} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${prefs.watched.includes(c.number) ? 'border-sky-500/60 bg-sky-500/10' : 'border-slate-700'}`}>
                    <input type="checkbox" checked={prefs.watched.includes(c.number)} onChange={() => toggle(c.number)} />Phatak {c.number} <span className="text-xs text-slate-500">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block">Advance warning threshold (minutes)
              <input type="number" min="1" max="60" className={`${inputCls} mt-1`} value={prefs.warningMinutes} onChange={(e) => update({ warningMinutes: Math.min(60, Math.max(1, Number(e.target.value) || 10)) })} />
            </label>
            <label className="flex items-center justify-between">Audio alerts<input type="checkbox" checked={prefs.sound} onChange={(e) => update({ sound: e.target.checked })} /></label>
            <label className="block">Volume<input type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="w-full" /></label>
            <Button onClick={() => playSound('warning', true)}>Test sound</Button>
            <p className="text-xs text-slate-500">Browser notification permission and alert severities are on the <Link to="/alerts" className="text-sky-300">Alerts</Link> page.</p>
          </div>
        </Panel>
        <Panel title="Server prediction thresholds (read-only)" icon={SlidersHorizontal} actions={<Link to="/admin" className="text-xs text-sky-300 hover:underline">Edit as admin</Link>}>
          {!server ? <div className="text-sm text-slate-500">Loading…</div> : (
            <>
              <p className="mb-2 text-xs text-amber-200/80">{server.note}</p>
              <table className="w-full text-xs">
                <tbody>{server.thresholds.map((t) => <tr key={t.key} className="border-t border-white/5"><td className="py-1.5 pr-2 text-slate-300" title={t.description}>{t.key}</td><td className="text-right font-mono">{t.value}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
