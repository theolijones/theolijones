import React, { useState, useEffect, useCallback } from 'react';
import { getReports, getReport } from '../api/reports';
import { sendWeeklyReport } from '../api/admin';
import { useAuth } from '../components/AuthContext';

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getReports();
      setReports(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSelectReport = async (report) => {
    if (selectedReport?.id === report.id) {
      setSelectedReport(null);
      setReportDetail(null);
      return;
    }
    setSelectedReport(report);
    setDetailLoading(true);
    try {
      const detail = await getReport(report.id);
      setReportDetail(detail);
    } catch {
      setReportDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSendReport = async () => {
    setSending(true);
    setSendResult(null);
    try {
      await sendWeeklyReport();
      setSendResult({ type: 'success', message: 'Weekly report sent successfully.' });
      fetchReports();
    } catch (err) {
      setSendResult({ type: 'error', message: err.message || 'Failed to send report.' });
    } finally {
      setSending(false);
    }
  };

  const reportData = reportDetail?.report_data || reportDetail?.reportData || reportDetail?.data || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-heading">{error}</p>
        <button
          onClick={fetchReports}
          className="mt-3 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-heading font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-slate-100">Weekly Reports</h1>
        {user?.role === 'admin' && (
          <button
            onClick={handleSendReport}
            disabled={sending}
            className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-heading font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Weekly Report Now'}
          </button>
        )}
      </div>

      {sendResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-heading ${
            sendResult.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {sendResult.message}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 font-heading">No reports generated yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 font-heading text-xs uppercase">
                <th className="px-4 py-3 text-left">Date Range</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <React.Fragment key={report.id}>
                  <tr
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                      selectedReport?.id === report.id ? 'bg-slate-700/40' : ''
                    }`}
                    onClick={() => handleSelectReport(report)}
                  >
                    <td className="px-4 py-3 text-slate-200 font-medium">
                      {formatDate(report.start_date || report.startDate)} &mdash;{' '}
                      {formatDate(report.end_date || report.endDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDateTime(report.created_at || report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-amber-500 font-heading text-xs font-semibold">
                        {selectedReport?.id === report.id ? 'Hide' : 'View'}
                      </span>
                    </td>
                  </tr>

                  {selectedReport?.id === report.id && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 bg-slate-800/50">
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent" />
                          </div>
                        ) : reportData ? (
                          <ReportDetail data={reportData} />
                        ) : (
                          <p className="text-slate-500 text-center py-4 font-heading">
                            No report data available.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportDetail({ data }) {
  const summary = data.summary || data.stats || {};
  const leaderboard = data.leaderboard || data.companyLeaderboard || [];
  const infractions = data.infractions || data.infraction_list || [];

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div>
        <h3 className="font-heading text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-heading text-slate-500 uppercase tracking-wider mb-0.5">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="text-lg font-bold font-heading text-slate-100">{value ?? '--'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      {leaderboard.length > 0 && (
        <div>
          <h3 className="font-heading text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Company Leaderboard
          </h3>
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500 font-heading text-xs uppercase">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-right">Infractions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/30">
                    <td className="px-3 py-2 text-slate-500 font-heading">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-200">{row.company_name || row.name || row.company}</td>
                    <td className="px-3 py-2 text-right text-red-400 font-heading font-semibold">
                      {row.total_infractions ?? row.count ?? row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Infraction List */}
      {infractions.length > 0 && (
        <div>
          <h3 className="font-heading text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Infractions ({infractions.length})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {infractions.map((inf, i) => (
              <div
                key={inf.id || i}
                className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <span className="text-sm text-slate-200 font-medium">
                    {inf.company_name || inf.company}
                  </span>
                  {inf.platform && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-heading font-semibold text-slate-900 uppercase bg-slate-500">
                      {inf.platform}
                    </span>
                  )}
                  {inf.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{inf.description}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatDate(inf.detected_at || inf.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
