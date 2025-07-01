export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  maxRetries: number;
  timeout: number;
  priority: number;
}

export type AgentType = 'document_parser' | 'evidence_extractor' | 'compliance_scorer';

export interface AgentResult {
  agentId: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

export interface DocumentMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
  language: 'ar' | 'en';
  extractedText: string;
  wordCount: number;
  confidence: number;
}

export interface Evidence {
  text: string;
  relevance: number;
  criteriaId: string;
  context: string;
  position: number;
}

export interface ComplianceScore {
  criteriaId: string;
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: Evidence[];
  findings: string;
  recommendations: string[];
  documentContent?: string; // New field for actual document content summary
}

export interface AgentTask {
  id: string;
  type: AgentType;
  input: any;
  priority: number;
  retries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentState {
  id: string;
  status: 'idle' | 'busy' | 'error' | 'stopped';
  currentTask?: AgentTask;
  lastActivity: Date;
  errorCount: number;
}