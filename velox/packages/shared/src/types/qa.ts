export type QAStatus = 'pending' | 'in_review' | 'approved' | 'rejected';
export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FlaggedSegment {
  startTime: number;
  endTime: number;
  note: string;
  severity: FlagSeverity;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface AutomatedFlag {
  ruleId: string;
  ruleName: string;
  startTime: number;
  endTime: number;
  description: string;
  severity: FlagSeverity;
}

export interface QARecord {
  id: string;
  videoId: string;
  assignedTo?: string;
  status: QAStatus;
  transcriptNotes?: string;
  flaggedSegments: FlaggedSegment[];
  automatedFlags: AutomatedFlag[];
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type QARuleType =
  | 'keyword_blacklist'
  | 'profanity_filter'
  | 'repeated_phrase'
  | 'low_confidence'
  | 'silence_detection';

export interface QARule {
  id: string;
  name: string;
  type: QARuleType;
  enabled: boolean;
  config: Record<string, unknown>;
  severity: FlagSeverity;
  createdAt: string;
  updatedAt: string;
}
