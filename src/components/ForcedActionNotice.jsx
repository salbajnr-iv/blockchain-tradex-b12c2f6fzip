import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Banner shown at the top of forced-action pages (KYC renewal, password reset)
 * when the user was redirected by AccountStateGate via `?forced=1`.
 */
export default function ForcedActionNotice({ kind }) {
  const [searchParams] = useSearchParams();
  if (searchParams.get('forced') !== '1') return null;

  const copy = kind === 'kyc'
    ? {
        title: 'Identity re-verification required',
        body: 'Our compliance team has flagged your account for renewed identity verification. You can keep using support and account settings, but trading, deposits, and withdrawals are paused until you complete this step.',
      }
    : {
        title: 'Password reset required',
        body: 'For your security, an admin has required you to reset your password before continuing. Please choose a new password below.',
      };

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3"
    >
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-amber-200">{copy.title}</p>
        <p className="text-xs text-amber-100/80 leading-relaxed">{copy.body}</p>
      </div>
    </div>
  );
}
