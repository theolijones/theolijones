import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSummary, getLeaderboard, getRecent, getTimeline } from '../api/dashboard';

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs font-heading text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-heading ${accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-500' : 'text-slate-100'}`}>
        {value ?? '--'}
      </p>
    </div>
  );
}

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  tiktok: 'bg-cyan-400',
  twitter: 'bg-gray-400',
  x: 'bg-gray-400',
};

function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform?.toLowerCase()] || 'bg-slate-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold text-slate-900 uppercase ${color}`}>
      {platform}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recent, setRecent] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [s, l, r, t] = await Promise.all([
        getSummary().catch(() => null),
        getLeaderboard().catch(() => []),
        getRecent().catch(() => []),
        getTimeline().catch(() => []),
      ]);
      setSummary(s);
      setLeaderboard(Array.isArray(l) ? l : l?.data || []);
      setRecent(Array.isArray(r) ? r : r?.data || []);
      setTimeline(Array.isArray(t) ? t : t?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold text-slate-100">Dashboard</h1>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Infractions" value={summary?.total_infractions} accent="red" />
        <StatCard label="This Week" value={summary?.this_week} accent="amber" />
        <StatCard label="Companies Monitored" value={summary?.companies_monitored} />
        <StatCard label="Accounts Monitored" value={summary?.accounts_monitored} />
      </div>

      {/* Timeline Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h2 className="font-heading text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Infractions — Last 30 Days
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                tickFormatter={(d) => {
                  const date = new Date(d);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                stroke="#475569"
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                stroke="#475569"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#f59e0b' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="font-heading text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Company Leaderboard
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-heading text-xs uppercase">
                  <th className="px-4 py-2.5 text-left w-10">#</th>
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Week</th>
                  <th className="px-4 py-2.5 text-right">Last</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.company_id || i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 font-heading">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-200 font-medium">{row.company_name || row.name}</td>
                    <td className="px-4 py-2.5 text-right text-red-400 font-heading font-semibold">{row.total_infractions ?? row.total}</td>
                    <td className="px-4 py-2.5 text-right text-amber-500 font-heading">{row.this_week ?? row.week}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-xs">{timeAgo(row.last_infraction)}</td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Infractions */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="font-heading text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Recent Infractions
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto">
            {recent.map((item, i) => (
              <div key={item.id || i} className="px-4 py-3 hover:bg-slate-700/30 transition-colors">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-slate-700 overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-200 truncate">{item.company_name || item.company}</span>
                      <PlatformBadge platform={item.platform} />
                      <span className="ml-auto text-xs text-slate-500 flex-shrink-0">{timeAgo(item.detected_at || item.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(item.ip_types || item.detected_ips || []).map((tag, j) => (
                        <span key={j} className="px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded text-[10px] font-heading uppercase">
                          {tag}
                        </span>
                      ))}
                      {item.confidence != null && (
                        <span className="text-xs text-amber-500 font-heading ml-auto">
                          {Math.round(item.confidence * (item.confidence <= 1 ? 100 : 1))}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">No recent infractions</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
