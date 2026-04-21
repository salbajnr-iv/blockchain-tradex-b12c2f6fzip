import { useEffect, useState } from 'react';
import { getActiveAnnouncements } from '@/lib/api/userControls';
import { supabase } from '@/lib/supabaseClient';
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
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, success: 3 };

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

    // Live updates so a new announcement appears immediately for everyone.
    let channel = null;
    try {
      channel = supabase
        .channel('public:announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
        .subscribe();
    } catch { /* noop */ }

    return () => {
      on = false;
      clearInterval(id);
      if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } }
    };
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('dismissedAnnouncements', JSON.stringify(next));
  };

  const sorted = [...items].sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] ?? 99;
    const sb = SEVERITY_RANK[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  // Critical announcements are never dismissable so users can't hide them.
  const visible = sorted.filter((a) => a.severity === 'critical' || !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 md:px-6 py-2">
      {visible.map((a) => {
        const Icon = ICONS[a.severity] || Info;
        const isCritical = a.severity === 'critical';
        return (
          <div
            key={a.id}
            role={isCritical ? 'alert' : 'status'}
            aria-live={isCritical ? 'assertive' : 'polite'}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${STYLE[a.severity] || STYLE.info} ${isCritical ? 'shadow-md ring-1 ring-red-500/40' : ''}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2">
                {a.title}
                {isCritical && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/30 text-red-100">
                    Critical
                  </span>
                )}
              </div>
              {a.body && <div className="text-xs opacity-90 mt-0.5 whitespace-pre-wrap">{a.body}</div>}
            </div>
            {!isCritical && (
              <button
                onClick={() => dismiss(a.id)}
                aria-label="Dismiss announcement"
                className="p-1 rounded hover:bg-black/20"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
