import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { adminCoachesApi, resolveMediaUrl, type AdminCoachRecord } from '../lib/api';
import { useTheme } from '../components/providers/ThemeProvider';

function formatDocumentLabel(coach: Pick<AdminCoachRecord, 'verification_document_type' | 'document_url' | 'coach_document_url'>) {
  const hasDocument = Boolean(coach.document_url || coach.coach_document_url);

  switch (coach.verification_document_type) {
    case 'AADHAAR_CARD':
      return 'Aadhaar Card';
    case 'CV_RESUME':
      return 'CV';
    case 'DEGREE_CERTIFICATE':
      return 'Degree';
    default:
      return hasDocument ? 'Uploaded Document' : 'Not Provided';
  }
}

function resolveCoachDocumentUrl(coach: Pick<AdminCoachRecord, 'document_url' | 'coach_document_url'>) {
  if (coach.document_url) return resolveMediaUrl(coach.document_url);
  if (!coach.coach_document_url) return '';
  if (coach.coach_document_url.startsWith('http://') || coach.coach_document_url.startsWith('https://')) {
    return coach.coach_document_url;
  }
  if (coach.coach_document_url.startsWith('/static/')) {
    return resolveMediaUrl(coach.coach_document_url);
  }
  const filename = coach.coach_document_url.split(/[\\/]/).pop();
  return filename ? resolveMediaUrl(`/static/coach_documents/${filename}`) : '';
}

function getDocumentButtonState(coach: Pick<AdminCoachRecord, 'document_url' | 'coach_document_url'>) {
  return Boolean(resolveCoachDocumentUrl(coach));
}

export default function VerifiedCoachesPage() {
  const { isDark } = useTheme();
  const [coaches, setCoaches] = useState<AdminCoachRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCoach, setSelectedCoach] = useState<AdminCoachRecord | null>(null);

  const perPage = 10;

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadVerifiedCoaches();
    }, 250);

    return () => clearTimeout(timeout);
  }, [page, search]);

  async function loadVerifiedCoaches() {
    setLoading(true);
    try {
      const { data } = await adminCoachesApi.verified({ search, page, perPage });
      setCoaches(data.coaches || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Failed to load verified coaches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDocumentDownload(coach: AdminCoachRecord) {
    const documentUrl = resolveCoachDocumentUrl(coach);

    if (documentUrl) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const response = await adminCoachesApi.downloadDocument(coach.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${coach.name}_document`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download coach document:', error);
      alert('Failed to download document');
    }
  }

  async function handleRemoveVerification(coach: AdminCoachRecord) {
    if (!confirm(`Remove verification for ${coach.name}?`)) return;

    try {
      await adminCoachesApi.removeVerification(coach.id);
      await loadVerifiedCoaches();
    } catch (error) {
      console.error('Failed to remove verification:', error);
      alert('Failed to remove verification');
    }
  }

  const tableCardClass = isDark
    ? 'glass border-white/20'
    : 'bg-white/90 border-slate-200 shadow-xl';
  const rowClass = isDark
    ? 'border-white/10 hover:bg-white/5'
    : 'border-slate-200 hover:bg-slate-50';
  const mutedText = isDark ? 'text-white/60' : 'text-slate-600';

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(page - 3, 0), Math.max(page - 3, 0) + 5),
    [page, totalPages]
  );

  return (
    <div className="space-y-8 text-slate-900 dark:text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl border p-6 ${tableCardClass}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Verified Coaches ({total})</h1>
            <p className={`mt-2 text-sm ${mutedText}`}>Approved coach accounts across the platform</p>
          </div>

          <div className="relative w-full max-w-md">
            <i className={`fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}></i>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search coach by name or email"
              className={`w-full rounded-2xl border py-3 pl-11 pr-4 focus:outline-none ${
                isDark
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-white/40'
                  : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`overflow-hidden rounded-3xl border ${tableCardClass}`}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500"></div>
          </div>
        ) : coaches.length === 0 ? (
          <div className="py-16 text-center">
            <i className="fas fa-user-check mb-4 text-5xl text-green-400"></i>
            <h2 className="text-2xl font-bold">No verified coaches found</h2>
            <p className={`mt-2 text-sm ${mutedText}`}>Try a different search or approve coaches from Coach Approvals.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={isDark ? 'bg-white/5 text-white/60' : 'bg-slate-50 text-slate-600'}>
                  <tr>
                    <th className="px-5 py-4 font-semibold">Coach Name</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Phone Number</th>
                    <th className="px-5 py-4 font-semibold">Organization / Team</th>
                    <th className="px-5 py-4 font-semibold">Document</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Date Approved</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coaches.map((coach) => (
                    <tr key={coach.id} className={`border-t transition-colors ${rowClass}`}>
                      <td className="px-5 py-4 font-medium">{coach.name}</td>
                      <td className={`px-5 py-4 ${mutedText}`}>{coach.email}</td>
                      <td className={`px-5 py-4 ${mutedText}`}>{coach.phone || 'N/A'}</td>
                      <td className={`px-5 py-4 ${mutedText}`}>{coach.team || 'N/A'}</td>
                      <td className={`px-5 py-4 ${mutedText}`}>{formatDocumentLabel(coach)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
                          <span className="h-2 w-2 rounded-full bg-green-400"></span>
                          Verified
                        </span>
                      </td>
                      <td className={`px-5 py-4 ${mutedText}`}>
                        {coach.verification_approved_at ? new Date(coach.verification_approved_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedCoach(coach)}
                            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                              isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => void handleDocumentDownload(coach)}
                            disabled={!getDocumentButtonState(coach)}
                            className="rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View Uploaded Document
                          </button>
                          <button
                            onClick={() => void handleRemoveVerification(coach)}
                            className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
                          >
                            Remove Verification
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`flex flex-col gap-4 border-t px-5 py-4 md:flex-row md:items-center md:justify-between ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <p className={`text-sm ${mutedText}`}>
                Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total} verified coaches
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Previous
                </button>
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      page === pageNumber
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                        : isDark
                          ? 'bg-white/10 hover:bg-white/15'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      {selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-lg rounded-3xl border p-6 ${tableCardClass}`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedCoach.name}</h2>
                <p className={`mt-1 text-sm ${mutedText}`}>Verified coach profile</p>
              </div>
              <button
                onClick={() => setSelectedCoach(null)}
                className={`rounded-lg px-3 py-2 ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedText}`}>Email</p>
                <p className="mt-1 font-medium">{selectedCoach.email}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedText}`}>Phone Number</p>
                <p className="mt-1 font-medium">{selectedCoach.phone || 'N/A'}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedText}`}>Organization / Team</p>
                <p className="mt-1 font-medium">{selectedCoach.team || 'N/A'}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedText}`}>Verification Document Type</p>
                <p className="mt-1 font-medium">{formatDocumentLabel(selectedCoach)}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedText}`}>Date Approved</p>
                <p className="mt-1 font-medium">
                  {selectedCoach.verification_approved_at ? new Date(selectedCoach.verification_approved_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
