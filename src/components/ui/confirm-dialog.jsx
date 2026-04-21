import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';

/**
 * Promise-based replacement for window.confirm() and window.prompt().
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: 'Delete?', description: '…', tone: 'danger' });
 *   if (!ok) return;
 *
 *   const reason = await confirm({
 *     title: 'Freeze account',
 *     description: 'Provide a reason for the audit log.',
 *     input: { placeholder: 'Reason', required: true },
 *   });
 *   if (reason === null) return;        // user cancelled
 *   await freezeUser(id, reason);
 */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [value, setValue] = useState('');
  const resolverRef = useRef(null);
  const inputRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setValue(opts.input?.defaultValue || '');
      setState({
        title: opts.title || 'Are you sure?',
        description: opts.description || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        tone: opts.tone || 'default', // 'default' | 'danger' | 'warning'
        input: opts.input || null,
      });
      // Focus the input after the dialog mounts.
      if (opts.input) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    });
  }, []);

  const handleResolve = (result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
    setValue('');
  };

  const handleConfirm = () => {
    if (state?.input) {
      const trimmed = value.trim();
      if (state.input.required && !trimmed) {
        inputRef.current?.focus();
        return;
      }
      handleResolve(trimmed);
    } else {
      handleResolve(true);
    }
  };

  const handleCancel = () => handleResolve(state?.input ? null : false);

  const tone = state?.tone || 'default';
  const Icon = tone === 'danger' ? ShieldAlert : tone === 'warning' ? AlertTriangle : Info;
  const iconColor =
    tone === 'danger' ? 'text-red-500' : tone === 'warning' ? 'text-amber-500' : 'text-emerald-500';
  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-400 text-black'
      : 'bg-emerald-600 hover:bg-emerald-500 text-white';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        {state && (
          <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${iconColor}`} />
                {state.title}
              </AlertDialogTitle>
              {state.description && (
                <AlertDialogDescription className="whitespace-pre-line">
                  {state.description}
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>

            {state.input && (
              <div className="pt-1">
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                  placeholder={state.input.placeholder || ''}
                  type={state.input.type || 'text'}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {state.input.hint && (
                  <p className="mt-1.5 text-xs text-gray-500">{state.input.hint}</p>
                )}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancel}>{state.cancelText}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} className={confirmClass}>
                {state.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful degradation if a developer forgets to wrap with the provider.
    return (opts = {}) => {
      if (opts.input) {
        const v = window.prompt(opts.title || 'Confirm', opts.input.defaultValue || '');
        if (v === null) return Promise.resolve(null);
        return Promise.resolve(opts.input.required && !v.trim() ? null : v.trim());
      }
      return Promise.resolve(window.confirm(opts.title || 'Are you sure?'));
    };
  }
  return ctx;
}
