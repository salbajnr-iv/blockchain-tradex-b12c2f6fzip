import { useEffect, useState } from 'react';
import {
  getAllAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} from '@/lib/api/userControls';
import { Megaphone, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';

const SEVERITIES = ['info', 'success', 'warning', 'critical'];

export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ title: '', body: '', severity: 'info' });

  const load = async () => {
    setLoading(true);
    try { setItems(await getAllAnnouncements()); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    try {
      await createAnnouncement(draft);
      setDraft({ title: '', body: '', severity: 'info' });
      toast.success('Announcement created');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggle = async (a) => {
    try {
      await updateAnnouncement(a.id, { active: !a.active });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try { await deleteAnnouncement(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="text-emerald-500" size={20} />
          <h1 className="text-xl sm:text-2xl font-bold">Announcements</h1>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Create new banner</h2>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Body (optional)" rows={3} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
        <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })} className="px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
          {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div>
          <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500">
            <Plus size={14} /> Publish
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-sm text-gray-500">No announcements yet.</div>}
        {items.map((a) => (
          <div key={a.id} className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
            a.active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 opacity-70'
          }`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{a.title}</h3>
                <span className={`px-2 py-0.5 rounded text-xs uppercase font-medium ${SEV_CLR[a.severity] || ''}`}>{a.severity}</span>
              </div>
              {a.body && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{a.body}</p>}
              <p className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={a.active} onChange={() => handleToggle(a)} />
                Active
              </label>
              <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SEV_CLR = {
  info:     'bg-blue-500/15 text-blue-400',
  success:  'bg-emerald-500/15 text-emerald-400',
  warning:  'bg-amber-500/15 text-amber-400',
  critical: 'bg-red-500/15 text-red-400',
};
