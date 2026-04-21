import { useEffect, useState } from 'react';
import { getActiveAnnouncements } from '@/lib/api/userControls';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';

const ICONS = {
  info: Info, success: CheckCircle, warning: AlertTriangle, critical: AlertCircle,
};
const STYLE = {
  info:     'bg-blue-500/15    text-blue-200    border-blue-500/30',
  success:  'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  warning:  'bg-amber-500/15   text-amber-200   border-amber-500/30',
  critical: 'bg-red-500/15     text-red-200     border-red-500/30',
};

export default function AnnouncementBanner() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissedAnnouncements') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const data = await getActiveAnnouncements();
        if (on) setItems(data);
      } catch { /* noop */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { on = false; clearInterval(id); };
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('dismissedAnnouncements', JSON.stringify(next));
  };

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 md:px-6 py-2">
      {visible.map((a) => {
        const Icon = ICONS[a.severity] || Info;
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${STYLE[a.severity] || STYLE.info}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{a.title}</div>
              {a.body && <div className="text-xs opacity-90 mt-0.5 whitespace-pre-wrap">{a.body}</div>}
            </div>
            <button onClick={() => dismiss(a.id)} className="p-1 rounded hover:bg-black/20"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
