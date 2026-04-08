// ============================================================
// Domain Types — Multi-Agent Contract Review Workspace
// ============================================================

// --- Agent Identity ---

export type AgentId =
  | "chief-agent"
  | "legal-counsel"
  | "finance-director"
  | "tax-advisor"
  | "sales-director"
  | "product-director";

export type AgentRole =
  | "chief"
  | "legal"
  | "finance"
  | "tax"
  | "sales"
  | "product";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  shortName: string;
  role: AgentRole;
  title: string;
  avatar: string;      // emoji or icon key
  color: string;       // tailwind color key for agent.{role}
  description: string;
  expertise: string[];
}

// --- Agent Orchestration States ---

export type AgentState =
  | "idle"
  | "waiting"
  | "reading"
  | "analyzing"
  | "debating"
  | "proposing-edit"
  | "synthesizing"
  | "done";

export interface AgentRuntime {
  agentId: AgentId;
  state: AgentState;
  progress: number;    // 0-100
  startedAt?: number;
}

// --- Document & Context ---

export interface UploadedDocument {
  id: string;
  name: string;
  type: "pdf" | "docx" | "txt";
  size: number;        // bytes
  uploadedAt: string;
  pageCount?: number;
  summary?: string;
}

export interface BusinessContext {
  notes: string[];
  industry?: string;
  dealType?: string;
}

// --- Canvas Nodes ---

export type CanvasNodeType = "chief" | "expert" | "document" | "context";

export interface CanvasAgentNode {
  id: string;
  type: CanvasNodeType;
  agentId?: AgentId;
  position: { x: number; y: number };
}

// --- Chief Agent Recommendations ---

export interface ChiefRecommendation {
  documentType: string;
  riskCategories: RiskCategory[];
  recommendedAgents: AgentId[];
  rationale: string;
}

export interface RiskCategory {
  name: string;
  severity: "high" | "medium" | "low";
  description: string;
}

// --- Analysis Outputs ---

export type FindingSeverity = "critical" | "warning" | "info" | "positive";
export type FindingCategory = "critical-issue" | "missing-risky" | "sufficient-positive";

export interface Finding {
  id: string;
  agentId: AgentId;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  clause?: string;
  section?: string;
}

export interface CorrectionRequest {
  id: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  finding: string;
  correction: string;
  priority: "high" | "medium" | "low";
}

export interface Disagreement {
  id: string;
  agentAId: AgentId;
  agentBId: AgentId;
  topic: string;
  positionA: string;
  positionB: string;
  resolution?: string;
  resolvedBy?: AgentId;
}

export interface RevisionSuggestion {
  id: string;
  agentId: AgentId;
  section: string;
  currentText: string;
  suggestedText: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

export interface ManagerSummary {
  overallAssessment: string;
  contractHealthScore: number;   // 0-100
  keyFindings: string[];
  recommendedActions: string[];
  riskLevel: "high" | "medium" | "low";
}

export interface DiscussionSummary {
  totalFindings: number;
  criticalIssues: number;
  disagreements: number;
  consensusPoints: string[];
  debateHighlights: string[];
}

// --- Live Activity Stream ---

export interface ActivityEvent {
  id: string;
  timestamp: number;
  agentId: AgentId;
  type: "state-change" | "finding" | "disagreement" | "synthesis" | "complete";
  message: string;
  detail?: string;
}

// --- Orchestration Phase ---

export type OrchestrationPhase =
  | "idle"
  | "initializing"
  | "reading"
  | "analyzing"
  | "debating"
  | "synthesizing"
  | "complete";

// --- Demo Scenario ---

export interface DemoScenario {
  id: string;
  name: string;
  shortName: string;
  description: string;
  emoji: string;
  document: UploadedDocument;
  businessContext: BusinessContext;
  chiefRecommendation: ChiefRecommendation;
  findings: Finding[];
  correctionRequests: CorrectionRequest[];
  disagreements: Disagreement[];
  revisionSuggestions: RevisionSuggestion[];
}

// --- Document Input Source ---

/**
 * Tracks how the current document entered the system.
 * Used by UI and engine to distinguish scenario-seeded data from uploads.
 */
export type InputSource =
  | { type: "scenario"; scenarioId: string }
  | { type: "upload"; fileName: string };

// --- Review Job ---

export type ReviewJobStatus =
  | "setup"
  | "ready"
  | "running"
  | "complete";

export interface ReviewJob {
  id: string;
  title: string;
  status: ReviewJobStatus;
  activeScenarioId: string | null;
  /** Original document metadata (backward-compatible) */
  document?: UploadedDocument;
  /** Normalized parsed document from ingestion layer (forward-looking) */
  parsedDocument?: import("./ingestion/types").ParsedDocument;
  /** How the document entered the system */
  inputSource?: InputSource;
  businessContext: BusinessContext;
  chiefRecommendation?: ChiefRecommendation;
  selectedAgents: AgentId[];
  canvasNodes: CanvasAgentNode[];
  orchestrationPhase: OrchestrationPhase;
  agentRuntimes: Record<AgentId, AgentRuntime>;
  findings: Finding[];
  correctionRequests: CorrectionRequest[];
  disagreements: Disagreement[];
  revisionSuggestions: RevisionSuggestion[];
  managerSummary?: ManagerSummary;
  discussionSummary?: DiscussionSummary;
  activityStream: ActivityEvent[];
}
