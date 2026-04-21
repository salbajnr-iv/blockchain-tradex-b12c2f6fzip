import { useEffect, useState } from 'react';
import { getMyAdminMessages, markMessageRead } from '@/lib/api/userControls';
import { Mail, MailOpen } from 'lucide-react';

export default function AdminMessages() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems(await getMyAdminMessages()); } catch { /* noop */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleClick = async (m) => {
    if (!m.read_at) {
      await markMessageRead(m.id);
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Mail className="text-emerald-500" /> Messages from BlockTrade
      </h1>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-gray-500">No messages yet.</p>
      )}
      <div className="space-y-2">
        {items.map((m) => (
          <button key={m.id} onClick={() => handleClick(m)} className={`w-full text-left rounded-lg border p-4 transition ${
            m.read_at
              ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
              : 'border-emerald-500/40 bg-emerald-500/5'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {m.read_at ? <MailOpen size={14} className="text-gray-500" /> : <Mail size={14} className="text-emerald-500" />}
              <h3 className="font-semibold text-sm">{m.subject || 'Message'}</h3>
              <span className="ml-auto text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
