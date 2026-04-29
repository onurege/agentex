export interface LegalResearchSource {
  toolName: string;
  query: string;
  title: string;
  excerpt: string;
  rawText: string;
}

export interface LegalResearchResult {
  enabled: boolean;
  provider: "yargi-mcp";
  endpoint: string;
  queries: string[];
  sources: LegalResearchSource[];
  warnings: string[];
}
