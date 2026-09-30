'use client';
import { useState, useEffect } from 'react';

export default function CopyrightReviewPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetch(`/api/admin/copyright/reports?status=${filter}`)
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setLoading(false); });
  }, [filter]);

  const resolve = async (reportId: string, action: 'strike' | 'dismiss') => {
    await fetch(`/api/admin/copyright/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setReports(prev => prev.filter(r => r.reportId !== reportId));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">🛡️ Copyright Review Queue</h1>
            <p className="text-zinc-400 text-sm mt-1">Flagged content requiring admin review</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-sm font-semibold">
              {reports.filter(r => r.status === 'pending').length} Pending
            </span>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-6">
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {f === 'pending' ? 'Pending' : 'All Reports'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-zinc-500">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-zinc-400">No copyright reports to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => {
              const signals = typeof report.signals === 'string' ? JSON.parse(report.signals) : report.signals;
              const riskColor = report.risk === 'definite' ? 'red' : 'yellow';
              return (
                <div key={report.reportId} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          riskColor === 'red'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {report.risk === 'definite' ? '🚨 DEFINITE' : '⚠️ REVIEW'}
                        </span>
                        <span className="text-zinc-400 text-xs font-mono">{report.videoId}</span>
                        <span className="text-zinc-600 text-xs">{new Date(report.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {signals.map((s: any, i: number) => (
                          <p key={i} className="text-sm text-zinc-300">
                            <span className="text-zinc-500 font-mono text-xs">[{s.code}]</span> {s.detail}
                          </p>
                        ))}
                      </div>
                      {report.duplicateVideoId && (
                        <p className="mt-2 text-xs text-orange-400">Duplicate of: {report.duplicateVideoId}</p>
                      )}
                    </div>
                    {report.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => resolve(report.reportId, 'strike')}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
                        >
                          Strike
                        </button>
                        <button
                          onClick={() => resolve(report.reportId, 'dismiss')}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-all"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {report.status !== 'pending' && (
                      <span className="text-xs text-zinc-500 capitalize">{report.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
