import React, { useState, useEffect, useCallback } from 'react';
import { getInfractions, dismissInfraction } from '../api/infractions';
import { getCompanies } from '../api/companies';
import { useAuth } from '../components/AuthContext';

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  tiktok: 'bg-cyan-400',
  x: 'bg-gray-400',
};

const PLATFORMS = ['all', 'instagram', 'facebook', 'tiktok', 'x'];

function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform?.toLowerCase()] || 'bg-slate-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold text-slate-900 uppercase ${color}`}>
      {platform}
    </span>
  );
}

function ConfidenceBadge({ value }) {
  const pct = value != null ? Math.round(value * (value <= 1 ? 100 : 1)) : null;
  if (pct == null) return <span className="text-slate-500">--</span>;
  const color = pct > 90 ? 'text-green-400' : pct > 70 ? 'text-amber-400' : 'text-red-400';
  return <span className={`font-heading font-semibold ${color}`}>{pct}%</span>;
}

function ConfidenceBar({ value }) {
  const pct = value != null ? Math.round(value * (value <= 1 ? 100 : 1)) : 0;
  const barColor = pct > 90 ? 'bg-green-400' : pct > 70 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="w-full bg-slate-700 rounded-full h-2.5">
      <div className={`h-2.5 rounded-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ImagePlaceholder() {
  return (
    <div className="w-full h-64 bg-slate-700 rounded-lg flex items-center justify-center text-slate-500">
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    </div>
  );
}

export default function InfractionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Filter state
  const [companyId, setCompanyId] = useState('');
  const [platform, setPlatform] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dismissed, setDismissed] = useState('all');

  // Data state
  const [companies, setCompanies] = useState([]);
  const [infractions, setInfractions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drawer state
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissing, setDismissing] = useState(false);

  // Fetch companies on mount
  useEffect(() => {
    getCompanies()
      .then((data) => setCompanies(Array.isArray(data) ? data : data?.data || []))
      .catch(() => setCompanies([]));
  }, []);

  // Fetch infractions
  const fetchInfractions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (companyId) params.company_id = companyId;
      if (platform && platform !== 'all') params.platform = platform;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (dismissed === 'active') params.dismissed = 'false';
      else if (dismissed === 'dismissed') params.dismissed = 'true';

      const res = await getInfractions(params);
      const items = Array.isArray(res) ? res : res?.data || [];
      setInfractions(items);
      setTotalPages(res?.total_pages || res?.totalPages || Math.max(1, Math.ceil((res?.total || items.length) / 20)));
    } catch (err) {
      setError(err?.message || 'Failed to load infractions');
      setInfractions([]);
    } finally {
      setLoading(false);
    }
  }, [page, companyId, platform, startDate, endDate, dismissed]);

  useEffect(() => {
    fetchInfractions();
  }, [fetchInfractions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [companyId, platform, startDate, endDate, dismissed]);

  // Open drawer
  function openDrawer(infraction) {
    setSelected(infraction);
    setDismissReason('');
    setDrawerOpen(true);
  }

  // Close drawer
  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelected(null), 300);
  }

  // Dismiss handler
  async function handleDismiss() {
    if (!selected || !dismissReason.trim()) return;
    setDismissing(true);
    try {
      await dismissInfraction(selected.id, dismissReason.trim());
      setInfractions((prev) =>
        prev.map((inf) => (inf.id === selected.id ? { ...inf, dismissed: true, dismissed_reason: dismissReason.trim() } : inf))
      );
      setSelected((prev) => (prev ? { ...prev, dismissed: true, dismissed_reason: dismissReason.trim() } : prev));
    } catch (err) {
      setError(err?.message || 'Failed to dismiss infraction');
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold text-slate-100">Infractions</h1>

      {/* Filters Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Company */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Dismissed Toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">Status</label>
            <select
              value={dismissed}
              onChange={(e) => setDismissed(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 font-heading text-xs uppercase">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">IP Types</th>
                <th className="px-4 py-3 text-right">Confidence</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent" />
                  </td>
                </tr>
              ) : infractions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">No infractions found</td>
                </tr>
              ) : (
                infractions.map((inf) => (
                  <tr
                    key={inf.id}
                    onClick={() => openDrawer(inf)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {formatDate(inf.detected_at || inf.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{inf.company_name || inf.company || '--'}</td>
                    <td className="px-4 py-3">
                      <PlatformBadge platform={inf.platform} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(inf.ip_types || inf.detected_ips || []).map((tag, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded-full text-[10px] font-heading uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ConfidenceBadge value={inf.confidence} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inf.dismissed ? (
                        <span className="px-2 py-0.5 bg-slate-600 text-slate-400 rounded-full text-[10px] font-heading uppercase">
                          Dismissed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full text-[10px] font-heading uppercase">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && infractions.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 bg-slate-700 text-slate-200 text-sm rounded-lg font-heading hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400 font-heading">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-slate-700 text-slate-200 text-sm rounded-lg font-heading hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selected && (
          <div className="h-full flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-heading text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Infraction Details
              </h2>
              <button
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Thumbnail */}
              {selected.thumbnail_url || selected.image_url ? (
                <img
                  src={selected.thumbnail_url || selected.image_url}
                  alt="Post content"
                  className="w-full h-64 object-cover rounded-lg bg-slate-700"
                />
              ) : (
                <ImagePlaceholder />
              )}

              {/* Caption */}
              {(selected.caption || selected.text) && (
                <div>
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Caption</label>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-800 rounded-lg p-3">
                    {selected.caption || selected.text}
                  </p>
                </div>
              )}

              {/* IP Types */}
              {(selected.ip_types || selected.detected_ips || []).length > 0 && (
                <div>
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Detected IP Types</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.ip_types || selected.detected_ips || []).map((tag, j) => (
                      <span key={j} className="px-2 py-1 bg-slate-700 text-slate-200 rounded-full text-xs font-heading">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider">Confidence</label>
                  <ConfidenceBadge value={selected.confidence} />
                </div>
                <ConfidenceBar value={selected.confidence} />
              </div>

              {/* Original Post Link */}
              {(selected.post_url || selected.url) && (
                <div>
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Original Post</label>
                  <a
                    href={selected.post_url || selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>View on {selected.platform || 'platform'}</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Analysis Notes */}
              {(selected.analysis_notes || selected.notes) && (
                <div>
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Analysis Notes</label>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-800 rounded-lg p-3">
                    {selected.analysis_notes || selected.notes}
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Status</label>
                {selected.dismissed ? (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <span className="px-2 py-0.5 bg-slate-600 text-slate-400 rounded-full text-[10px] font-heading uppercase">
                      Dismissed
                    </span>
                    {selected.dismissed_reason && (
                      <p className="text-sm text-slate-400 mt-2">{selected.dismissed_reason}</p>
                    )}
                  </div>
                ) : (
                  <span className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full text-[10px] font-heading uppercase">
                    Active
                  </span>
                )}
              </div>

              {/* Dismiss (admin only, active only) */}
              {isAdmin && !selected.dismissed && (
                <div className="border-t border-slate-700 pt-5">
                  <label className="text-[10px] font-heading text-slate-400 uppercase tracking-wider block mb-1.5">Dismiss Infraction</label>
                  <textarea
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    rows={3}
                    placeholder="Enter reason for dismissal..."
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500 resize-none"
                  />
                  <button
                    onClick={handleDismiss}
                    disabled={dismissing || !dismissReason.trim()}
                    className="mt-2 w-full px-4 py-2 bg-amber-500 text-slate-900 text-sm font-heading font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {dismissing ? 'Dismissing...' : 'Dismiss'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
