import { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronRight, Eye, MessageSquare, Flag, Trash2, Plus, Settings2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  useQARecords, useQARecord, useUpdateQARecord, useRerunQAFlags,
  useQARules, useUpsertQARule, useDeleteQARule,
} from '@/hooks/use-qa';
import { useVideo } from '@/hooks/use-videos';
import { cn } from '@/lib/cn';
import type { QARecord, QAStatus, QARule, FlaggedSegment, FlagSeverity, AutomatedFlag, QARuleType } from '@velox/shared';

const STATUS_TABS: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: '', label: 'All', icon: <Shield className="w-3.5 h-3.5" /> },
  { value: 'pending', label: 'Pending', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'in_review', label: 'In Review', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'approved', label: 'Approved', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { value: 'rejected', label: 'Rejected', icon: <XCircle className="w-3.5 h-3.5" /> },
];

const SEVERITY_COLORS: Record<FlagSeverity, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  medium: { bg: 'bg-velox-amber-muted', text: 'text-velox-amber', border: 'border-velox-amber/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-velox-red-muted', text: 'text-velox-red', border: 'border-velox-red/30' },
};

const QA_STATUS_COLORS: Record<QAStatus, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-velox-amber-muted', text: 'text-velox-amber', dot: 'bg-velox-amber' },
  in_review: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  approved: { bg: 'bg-velox-green-muted', text: 'text-velox-green', dot: 'bg-velox-green' },
  rejected: { bg: 'bg-velox-red-muted', text: 'text-velox-red', dot: 'bg-velox-red' },
};

const RULE_TYPES: { value: QARuleType; label: string; description: string }[] = [
  { value: 'keyword_blacklist', label: 'Keyword Blacklist', description: 'Flag segments containing specific keywords' },
  { value: 'profanity_filter', label: 'Profanity Filter', description: 'Detect profanity in transcript' },
  { value: 'repeated_phrase', label: 'Repeated Phrase', description: 'Detect unnaturally repeated phrases' },
  { value: 'low_confidence', label: 'Low Confidence', description: 'Flag low transcription confidence segments' },
  { value: 'silence_detection', label: 'Silence Detection', description: 'Detect long silence gaps' },
];

export function QAPage() {
  const [activeTab, setActiveTab] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showRules, setShowRules] = useState(false);

  const { data: recordsData, isLoading } = useQARecords(activeTab || undefined);
  const records = recordsData?.data || [];

  return (
    <div>
      <PageHeader
        title="Quality Assurance"
        description="Review and approve video content before publishing"
        actions={
          <button
            onClick={() => setShowRules(!showRules)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              showRules
                ? 'bg-velox-accent text-velox-bg'
                : 'bg-velox-surface border border-velox-border text-velox-text-secondary hover:text-velox-text-primary'
            )}
          >
            <Settings2 className="w-4 h-4" />
            {showRules ? 'Back to Queue' : 'Rules Config'}
          </button>
        }
      />

      {showRules ? (
        <RulesConfigPanel />
      ) : (
        <div className="flex gap-6">
          {/* Left panel — queue */}
          <div className="w-80 shrink-0 space-y-4">
            {/* Status tabs */}
            <div className="flex gap-1 bg-velox-surface rounded-lg p-1 border border-velox-border">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setActiveTab(tab.value); setSelectedId(undefined); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded transition-colors',
                    activeTab === tab.value
                      ? 'bg-velox-accent/10 text-velox-accent'
                      : 'text-velox-text-muted hover:text-velox-text-secondary'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Record list */}
            <div className="space-y-2">
              {isLoading && (
                <div className="text-center py-8 text-xs text-velox-text-muted">Loading...</div>
              )}
              {!isLoading && records.length === 0 && (
                <div className="text-center py-8 text-xs text-velox-text-muted">
                  No QA records {activeTab ? `with status "${activeTab}"` : 'yet'}
                </div>
              )}
              {records.map((record) => (
                <QARecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedId === record.id}
                  onClick={() => setSelectedId(record.id)}
                />
              ))}
            </div>
          </div>

          {/* Right panel — detail */}
          <div className="flex-1 min-w-0">
            {selectedId ? (
              <QADetailPanel id={selectedId} />
            ) : (
              <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
                <Shield className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
                <p className="text-sm text-velox-text-secondary">Select a QA record to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── QA Record Card ──────────────────────────────────────────────────

function QARecordCard({ record, isSelected, onClick }: {
  record: QARecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  const flagCount = record.automatedFlags.length + record.flaggedSegments.length;
  const unresolvedManual = record.flaggedSegments.filter((f) => !f.resolved).length;
  const statusColor = QA_STATUS_COLORS[record.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-velox-surface rounded-xl border p-3 transition-colors',
        isSelected ? 'border-velox-accent/50' : 'border-velox-border hover:border-velox-border-light'
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-velox-text-muted truncate">
          {record.videoId.slice(0, 12)}...
        </span>
        <ChevronRight className="w-4 h-4 text-velox-text-muted shrink-0" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider',
          statusColor.bg, statusColor.text
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColor.dot)} />
          {record.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-velox-text-muted">
        {record.automatedFlags.length > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-velox-amber" />
            {record.automatedFlags.length} auto
          </span>
        )}
        {unresolvedManual > 0 && (
          <span className="flex items-center gap-1">
            <Flag className="w-3 h-3 text-velox-red" />
            {unresolvedManual} manual
          </span>
        )}
        {flagCount === 0 && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-velox-green" />
            Clean
          </span>
        )}
        <span className="ml-auto">{new Date(record.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

// ── QA Detail Panel ─────────────────────────────────────────────────

function QADetailPanel({ id }: { id: string }) {
  const { data: recordData } = useQARecord(id);
  const record = recordData?.data;
  const updateRecord = useUpdateQARecord();
  const rerunFlags = useRerunQAFlags();
  const [notes, setNotes] = useState('');
  const [newFlagNote, setNewFlagNote] = useState('');
  const [newFlagSeverity, setNewFlagSeverity] = useState<FlagSeverity>('medium');
  const [newFlagStart, setNewFlagStart] = useState('');
  const [newFlagEnd, setNewFlagEnd] = useState('');

  if (!record) return null;

  const handleApprove = () => {
    updateRecord.mutate({ id: record.id, status: 'approved', transcriptNotes: notes || record.transcriptNotes });
  };

  const handleReject = () => {
    updateRecord.mutate({ id: record.id, status: 'rejected', transcriptNotes: notes || record.transcriptNotes });
  };

  const handleStartReview = () => {
    updateRecord.mutate({ id: record.id, status: 'in_review' });
  };

  const handleAddManualFlag = () => {
    if (!newFlagNote || !newFlagStart || !newFlagEnd) return;
    const newFlag: FlaggedSegment = {
      startTime: parseFloat(newFlagStart),
      endTime: parseFloat(newFlagEnd),
      note: newFlagNote,
      severity: newFlagSeverity,
      resolved: false,
    };
    updateRecord.mutate({
      id: record.id,
      flaggedSegments: [...record.flaggedSegments, newFlag],
    });
    setNewFlagNote('');
    setNewFlagStart('');
    setNewFlagEnd('');
  };

  const handleResolveFlag = (index: number) => {
    const updated = [...record.flaggedSegments];
    updated[index] = { ...updated[index], resolved: true, resolvedAt: new Date().toISOString() };
    updateRecord.mutate({ id: record.id, flaggedSegments: updated });
  };

  const statusColor = QA_STATUS_COLORS[record.status];
  const highSeverityCount = [...record.automatedFlags, ...record.flaggedSegments]
    .filter((f) => f.severity === 'high' || f.severity === 'critical').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider',
            statusColor.bg, statusColor.text
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColor.dot)} />
            {record.status.replace('_', ' ')}
          </span>
          <span className="text-xs font-mono text-velox-text-muted">Video: {record.videoId.slice(0, 16)}...</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => rerunFlags.mutate(record.id)}
            disabled={rerunFlags.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-velox-surface border border-velox-border rounded-lg hover:border-velox-border-light transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', rerunFlags.isPending && 'animate-spin')} />
            Re-run Flags
          </button>
          {record.status === 'pending' && (
            <button
              onClick={handleStartReview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Start Review
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {(record.automatedFlags.length > 0 || record.flaggedSegments.length > 0) && (
        <div className="flex gap-3">
          <div className="flex-1 bg-velox-surface rounded-lg border border-velox-border p-3 text-center">
            <div className="text-2xl font-semibold text-velox-amber">{record.automatedFlags.length}</div>
            <div className="text-[10px] text-velox-text-muted uppercase tracking-wider mt-0.5">Auto Flags</div>
          </div>
          <div className="flex-1 bg-velox-surface rounded-lg border border-velox-border p-3 text-center">
            <div className="text-2xl font-semibold text-velox-red">{record.flaggedSegments.filter((f) => !f.resolved).length}</div>
            <div className="text-[10px] text-velox-text-muted uppercase tracking-wider mt-0.5">Manual Flags</div>
          </div>
          <div className="flex-1 bg-velox-surface rounded-lg border border-velox-border p-3 text-center">
            <div className={cn('text-2xl font-semibold', highSeverityCount > 0 ? 'text-velox-red' : 'text-velox-green')}>
              {highSeverityCount}
            </div>
            <div className="text-[10px] text-velox-text-muted uppercase tracking-wider mt-0.5">High / Critical</div>
          </div>
        </div>
      )}

      {/* Automated Flags */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
        <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Automated Flags ({record.automatedFlags.length})
        </h3>
        {record.automatedFlags.length === 0 ? (
          <p className="text-sm text-velox-text-muted text-center py-4">No automated flags detected</p>
        ) : (
          <div className="space-y-2">
            {record.automatedFlags.map((flag, idx) => (
              <AutoFlagRow key={idx} flag={flag} />
            ))}
          </div>
        )}
      </div>

      {/* Manual Flags */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
        <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
          <Flag className="w-3.5 h-3.5" />
          Manual Flags ({record.flaggedSegments.length})
        </h3>
        {record.flaggedSegments.length > 0 && (
          <div className="space-y-2">
            {record.flaggedSegments.map((flag, idx) => (
              <ManualFlagRow key={idx} flag={flag} index={idx} onResolve={() => handleResolveFlag(idx)} />
            ))}
          </div>
        )}
        {/* Add manual flag form */}
        <div className="bg-velox-bg rounded-lg p-3 space-y-2">
          <div className="text-[10px] font-mono text-velox-text-muted uppercase tracking-wider">Add Manual Flag</div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={newFlagStart}
              onChange={(e) => setNewFlagStart(e.target.value)}
              placeholder="Start (s)"
              className="w-24 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-velox-accent"
            />
            <input
              type="number"
              step="0.1"
              value={newFlagEnd}
              onChange={(e) => setNewFlagEnd(e.target.value)}
              placeholder="End (s)"
              className="w-24 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-velox-accent"
            />
            <select
              value={newFlagSeverity}
              onChange={(e) => setNewFlagSeverity(e.target.value as FlagSeverity)}
              className="bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs focus:outline-none focus:border-velox-accent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFlagNote}
              onChange={(e) => setNewFlagNote(e.target.value)}
              placeholder="Describe the issue..."
              className="flex-1 bg-velox-surface border border-velox-border rounded px-2 py-1 text-xs focus:outline-none focus:border-velox-accent"
            />
            <button
              onClick={handleAddManualFlag}
              className="px-3 py-1 bg-velox-accent text-velox-bg text-xs rounded hover:bg-velox-accent-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reviewer Notes */}
      <div className="bg-velox-surface rounded-xl border border-velox-border p-4 space-y-3">
        <h3 className="text-xs font-mono text-velox-text-muted uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" />
          Reviewer Notes
        </h3>
        <textarea
          value={notes || record.transcriptNotes || ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this review..."
          rows={3}
          className="w-full bg-velox-bg border border-velox-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-velox-accent"
        />
        {notes && notes !== record.transcriptNotes && (
          <button
            onClick={() => updateRecord.mutate({ id: record.id, transcriptNotes: notes })}
            className="text-xs text-velox-accent hover:underline"
          >
            Save Notes
          </button>
        )}
      </div>

      {/* Action buttons */}
      {(record.status === 'pending' || record.status === 'in_review') && (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={updateRecord.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-velox-green/10 text-velox-green text-sm font-medium rounded-lg hover:bg-velox-green/20 border border-velox-green/20 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={updateRecord.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-velox-red/10 text-velox-red text-sm font-medium rounded-lg hover:bg-velox-red/20 border border-velox-red/20 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {record.reviewedAt && (
        <div className="text-xs text-velox-text-muted text-center">
          Reviewed {new Date(record.reviewedAt).toLocaleString()}
          {record.reviewedBy && ` by ${record.reviewedBy}`}
        </div>
      )}
    </div>
  );
}

// ── Flag Row Components ─────────────────────────────────────────────

function AutoFlagRow({ flag }: { flag: AutomatedFlag }) {
  const sc = SEVERITY_COLORS[flag.severity];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg p-2.5 border', sc.bg, sc.border)}>
      <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', sc.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-[10px] font-mono uppercase tracking-wider', sc.text)}>{flag.severity}</span>
          <span className="text-[10px] text-velox-text-muted">{flag.ruleName}</span>
        </div>
        <p className="text-xs">{flag.description}</p>
        <span className="text-[10px] font-mono text-velox-text-muted mt-0.5 block">
          {formatTime(flag.startTime)} — {formatTime(flag.endTime)}
        </span>
      </div>
    </div>
  );
}

function ManualFlagRow({ flag, index, onResolve }: {
  flag: FlaggedSegment;
  index: number;
  onResolve: () => void;
}) {
  const sc = SEVERITY_COLORS[flag.severity];
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg p-2.5 border',
      flag.resolved ? 'bg-velox-bg border-velox-border opacity-60' : `${sc.bg} ${sc.border}`
    )}>
      <Flag className={cn('w-4 h-4 shrink-0 mt-0.5', flag.resolved ? 'text-velox-text-muted' : sc.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-[10px] font-mono uppercase tracking-wider', flag.resolved ? 'text-velox-text-muted' : sc.text)}>
            {flag.severity}
          </span>
          {flag.resolved && (
            <span className="text-[10px] text-velox-green font-mono uppercase">Resolved</span>
          )}
        </div>
        <p className={cn('text-xs', flag.resolved && 'line-through')}>{flag.note}</p>
        <span className="text-[10px] font-mono text-velox-text-muted mt-0.5 block">
          {formatTime(flag.startTime)} — {formatTime(flag.endTime)}
        </span>
      </div>
      {!flag.resolved && (
        <button
          onClick={onResolve}
          className="text-velox-text-muted hover:text-velox-green transition-colors"
          title="Mark as resolved"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Rules Configuration ─────────────────────────────────────────────

function RulesConfigPanel() {
  const { data: rulesData } = useQARules();
  const upsertRule = useUpsertQARule();
  const deleteRule = useDeleteQARule();
  const rules = rulesData?.data || [];

  const [editingRule, setEditingRule] = useState<Partial<QARule> | null>(null);

  const handleSaveRule = () => {
    if (!editingRule?.name || !editingRule?.type) return;
    upsertRule.mutate({
      ...editingRule,
      name: editingRule.name,
      type: editingRule.type as QARuleType,
      enabled: editingRule.enabled ?? true,
      severity: (editingRule.severity || 'medium') as string,
      config: editingRule.config || {},
    }, {
      onSuccess: () => setEditingRule(null),
    });
  };

  const handleNewRule = () => {
    setEditingRule({ name: '', type: 'keyword_blacklist', enabled: true, severity: 'medium', config: {} });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">QA Flagging Rules</h2>
        <button
          onClick={handleNewRule}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-velox-accent text-velox-bg text-xs font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Rule
        </button>
      </div>

      {/* Edit / Create form */}
      {editingRule && (
        <div className="bg-velox-surface rounded-xl border border-velox-accent/30 p-4 space-y-3">
          <input
            type="text"
            value={editingRule.name || ''}
            onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
            placeholder="Rule name"
            className="w-full bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm focus:outline-none focus:border-velox-accent"
          />
          <div className="flex gap-3">
            <select
              value={editingRule.type || 'keyword_blacklist'}
              onChange={(e) => setEditingRule({ ...editingRule, type: e.target.value as QARuleType, config: {} })}
              className="flex-1 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm focus:outline-none focus:border-velox-accent"
            >
              {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              value={editingRule.severity || 'medium'}
              onChange={(e) => setEditingRule({ ...editingRule, severity: e.target.value as FlagSeverity })}
              className="w-32 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm focus:outline-none focus:border-velox-accent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Rule-specific config */}
          <RuleConfigEditor
            type={(editingRule.type || 'keyword_blacklist') as QARuleType}
            config={editingRule.config || {}}
            onChange={(config) => setEditingRule({ ...editingRule, config })}
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingRule.enabled ?? true}
                onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                className="accent-velox-accent"
              />
              Enabled
            </label>
            <div className="flex-1" />
            <button onClick={() => setEditingRule(null)} className="px-3 py-1.5 text-xs text-velox-text-muted hover:text-velox-text-primary">
              Cancel
            </button>
            <button onClick={handleSaveRule} className="px-4 py-1.5 bg-velox-accent text-velox-bg text-xs font-medium rounded hover:bg-velox-accent-hover transition-colors">
              Save Rule
            </button>
          </div>
        </div>
      )}

      {/* Existing rules */}
      <div className="space-y-2">
        {rules.length === 0 && !editingRule && (
          <div className="bg-velox-surface rounded-xl border border-velox-border p-8 text-center">
            <Settings2 className="w-8 h-8 text-velox-text-muted mx-auto mb-2" />
            <p className="text-sm text-velox-text-muted">No QA rules configured yet</p>
          </div>
        )}
        {rules.map((rule) => {
          const sc = SEVERITY_COLORS[rule.severity];
          const ruleType = RULE_TYPES.find((t) => t.value === rule.type);
          return (
            <div
              key={rule.id}
              className={cn(
                'bg-velox-surface rounded-xl border p-4 transition-colors',
                rule.enabled ? 'border-velox-border' : 'border-velox-border opacity-50'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full', rule.enabled ? 'bg-velox-green' : 'bg-velox-text-muted')} />
                  <div>
                    <div className="text-sm font-medium">{rule.name}</div>
                    <div className="text-[10px] text-velox-text-muted">{ruleType?.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-mono uppercase px-2 py-0.5 rounded', sc.bg, sc.text)}>
                    {rule.severity}
                  </span>
                  <button
                    onClick={() => setEditingRule({ ...rule })}
                    className="p-1.5 text-velox-text-muted hover:text-velox-text-primary transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this rule?')) deleteRule.mutate(rule.id); }}
                    className="p-1.5 text-velox-text-muted hover:text-velox-red transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Rule Config Editor ──────────────────────────────────────────────

function RuleConfigEditor({ type, config, onChange }: {
  type: QARuleType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (type) {
    case 'keyword_blacklist':
      return (
        <div>
          <label className="text-xs text-velox-text-muted block mb-1">Keywords (comma-separated)</label>
          <input
            type="text"
            value={((config.keywords as string[]) || []).join(', ')}
            onChange={(e) => onChange({ ...config, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="e.g. competitor, banned-word"
            className="w-full bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
          />
        </div>
      );

    case 'profanity_filter':
      return (
        <div>
          <label className="text-xs text-velox-text-muted block mb-1">Custom word list (comma-separated, or leave empty for defaults)</label>
          <input
            type="text"
            value={((config.words as string[]) || []).join(', ')}
            onChange={(e) => onChange({ ...config, words: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="Leave empty for default profanity list"
            className="w-full bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
          />
        </div>
      );

    case 'low_confidence':
      return (
        <div>
          <label className="text-xs text-velox-text-muted block mb-1">Confidence threshold (0-1)</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={(config.threshold as number) || 0.7}
            onChange={(e) => onChange({ ...config, threshold: parseFloat(e.target.value) })}
            className="w-32 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
          />
        </div>
      );

    case 'silence_detection':
      return (
        <div>
          <label className="text-xs text-velox-text-muted block mb-1">Minimum silence gap (seconds)</label>
          <input
            type="number"
            step="1"
            min="1"
            value={(config.minGapSeconds as number) || 5}
            onChange={(e) => onChange({ ...config, minGapSeconds: parseInt(e.target.value) })}
            className="w-32 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
          />
        </div>
      );

    case 'repeated_phrase':
      return (
        <div className="flex gap-3">
          <div>
            <label className="text-xs text-velox-text-muted block mb-1">Min repeats</label>
            <input
              type="number"
              min="2"
              value={(config.minRepeats as number) || 3}
              onChange={(e) => onChange({ ...config, minRepeats: parseInt(e.target.value) })}
              className="w-24 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
            />
          </div>
          <div>
            <label className="text-xs text-velox-text-muted block mb-1">Min words in phrase</label>
            <input
              type="number"
              min="2"
              value={(config.minWords as number) || 3}
              onChange={(e) => onChange({ ...config, minWords: parseInt(e.target.value) })}
              className="w-24 bg-velox-bg border border-velox-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-velox-accent"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
