import { useEffect, useState } from 'react';
import { getAllKycSubmissions, getKycDocumentUrls, adminReviewKyc } from '@/lib/api/admin';
import { toast } from '@/lib/toast';
import { CheckCircle, XCircle, RefreshCw, Search, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  under_review: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/15 text-red-600 dark:text-red-400',
  more_info_needed: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
};

function DocImage({ label, url }) {
  if (!url) return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500 dark:text-gray-500">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Not provided</p>
    </div>
  );
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500">{label}</p>
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={label}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-cover max-h-36 hover:opacity-90 transition-opacity"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </a>
    </div>
  );
}

function KycDetailModal({ submission, onApprove, onReject, onMoreInfo, onClose }) {
  const [docUrls, setDocUrls] = useState({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [moreInfoReason, setMoreInfoReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showMoreInfoForm, setShowMoreInfoForm] = useState(false);

  useEffect(() => {
    getKycDocumentUrls(submission)
      .then(setDocUrls)
      .finally(() => setLoadingUrls(false));
  }, [submission]);

  const handleApprove = async () => {
    setActionLoading(true);
    await onApprove(submission.id);
    setActionLoading(false);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    await onReject(submission.id, rejectReason.trim());
    setActionLoading(false);
  };

  const handleMoreInfo = async (e) => {
    e.preventDefault();
    if (!moreInfoReason.trim()) return;
    setActionLoading(true);
    await onMoreInfo(submission.id, moreInfoReason.trim());
    setActionLoading(false);
  };

  const user = submission.users;
  const isPending = ['pending', 'under_review'].includes(submission.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/70 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">KYC Submission</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.full_name || user?.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Personal Info */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Personal Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Full Name', `${submission.legal_first_name || ''} ${submission.legal_last_name || ''}`.trim()],
                ['Date of Birth', submission.date_of_birth || '—'],
                ['Nationality', submission.nationality || '—'],
                ['Country', submission.country || '—'],
                ['Address', [submission.address_line1, submission.address_line2, submission.city, submission.postal_code].filter(Boolean).join(', ') || '—'],
                ['Tier', submission.tier || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-gray-400 dark:text-gray-500 text-xs">{k}</p>
                  <p className="text-gray-900 dark:text-white mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Document Info */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Document</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Type', submission.document_type || '—'],
                ['Number', submission.document_number || '—'],
                ['Country', submission.document_country || '—'],
                ['Expiry', submission.document_expiry || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-gray-400 dark:text-gray-500 text-xs">{k}</p>
                  <p className="text-gray-900 dark:text-white mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Documents */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Uploaded Documents</h4>
            {loadingUrls ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <DocImage label="ID Front" url={docUrls.id_document_path} />
                <DocImage label="ID Back" url={docUrls.id_back_path} />
                <DocImage label="Selfie" url={docUrls.selfie_path} />
                <DocImage label="Proof of Address" url={docUrls.proof_of_address_path} />
              </div>
            )}
          </section>

          {/* Reviewer Notes */}
          {submission.reviewer_notes && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Reviewer Notes</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">{submission.reviewer_notes}</p>
            </section>
          )}

          {/* Actions */}
          {isPending && (
            <section className="border-t border-gray-200 dark:border-gray-800 pt-4">
              {!showRejectForm && !showMoreInfoForm ? (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <CheckCircle size={15} />
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <XCircle size={15} />
                    Reject
                  </button>
                  <button
                    onClick={() => setShowMoreInfoForm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    More Info Needed
                  </button>
                </div>
              ) : showRejectForm ? (
                <form onSubmit={handleReject} className="space-y-3">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    required
                    placeholder="Explain the reason for rejection..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                  />
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="submit"
                      disabled={!rejectReason.trim() || actionLoading}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleMoreInfo} className="space-y-3">
                  <label className="block text-sm text-gray-600 dark:text-gray-400">
                    What information is needed? <span className="text-orange-500">*</span>
                  </label>
                  <textarea
                    value={moreInfoReason}
                    onChange={(e) => setMoreInfoReason(e.target.value)}
                    rows={3}
                    required
                    placeholder="Specify what additional information or documents are required..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                  />
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="submit"
                      disabled={!moreInfoReason.trim() || actionLoading}
                      className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                    >
                      {actionLoading ? 'Sending...' : 'Request More Info'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMoreInfoForm(false)}
                      className="px-5 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile KYC card
function KycCard({ s, onReview }) {
  const user = s.users;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-gray-900 dark:text-white font-medium text-sm">{user?.full_name || user?.username || '—'}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">{user?.email || '—'}</p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize shrink-0 ${STATUS_COLORS[s.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
          {(s.status || '').replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Tier: <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{s.tier || '—'}</span></span>
        <span>Doc: <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{s.document_type || '—'}</span></span>
        <span>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}</span>
      </div>
      <button
        onClick={() => onReview(s)}
        className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg transition-colors"
      >
        <Eye size={13} />
        Review Submission
      </button>
    </div>
  );
}

export default function AdminKyc() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllKycSubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSubmissions(); }, []);

  const handleApprove = async (submissionId) => {
    setActionLoading(submissionId);
    try {
      await adminReviewKyc(submissionId, 'approved');
      toast.success('KYC submission approved');
      setSelected(null);
      await loadSubmissions();
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (submissionId, notes) => {
    setActionLoading(submissionId);
    try {
      await adminReviewKyc(submissionId, 'rejected', notes);
      toast.success('KYC submission rejected');
      setSelected(null);
      await loadSubmissions();
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoreInfo = async (submissionId, notes) => {
    setActionLoading(submissionId);
    try {
      await adminReviewKyc(submissionId, 'more_info_needed', notes);
      toast.success('More information requested from user');
      setSelected(null);
      await loadSubmissions();
    } catch (err) {
      toast.error(err.message || 'Failed to update submission');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = submissions.filter((s) => {
    const user = s.users;
    const matchesSearch =
      !search ||
      (user?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (user?.full_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">KYC Review</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Review identity verification submissions</p>
        </div>
        <button
          onClick={loadSubmissions}
          disabled={loading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="more_info_needed">More Info Needed</option>
        </select>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-40" />
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-56" />
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">No KYC submissions found.</div>
        ) : (
          filtered.map((s) => (
            <KycCard key={s.id} s={s} onReview={setSelected} />
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Submitted', 'User', 'Tier', 'Document', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500">No KYC submissions found.</td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const user = s.users;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(s.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-900 dark:text-white font-medium">{user?.full_name || user?.username || '—'}</p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs">{user?.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 capitalize">{s.tier || '—'}</td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400 capitalize">{s.document_type || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[s.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                          {(s.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelected(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg transition-colors"
                        >
                          <Eye size={12} />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <KycDetailModal
          submission={selected}
          onApprove={handleApprove}
          onReject={handleReject}
          onMoreInfo={handleMoreInfo}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
