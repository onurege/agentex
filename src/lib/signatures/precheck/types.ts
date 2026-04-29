export type PrecheckCheckId =
  | "company_identity"
  | "company_name"
  | "authority_type"
  | "authority_duration"
  | "address_match"
  | "sirku_freshness";

export type PrecheckSeverity = "ok" | "warning" | "critical";

export interface PrecheckCheck {
  id: PrecheckCheckId;
  severity: PrecheckSeverity;
  label: string;
  expected?: string;
  observed?: string;
  message: string;
}

export type AuthorityType = "münferiden" | "müştereken" | "belirsiz";

export interface SirkuExtraction {
  companyName: string | null;
  taxNumber: string | null;
  tradeRegistryNumber: string | null;
  mersisNumber: string | null;
  address: string | null;
  representativeName: string | null;
  representativeIdNumber: string | null;
  authorityType: AuthorityType;
  authorityStart: string | null;
  authorityDurationYears: number | null;
  sirkuDate: string | null;
  rawText: string;
}

export interface PetitionExtraction {
  companyName: string | null;
  taxNumber: string | null;
  tradeRegistryNumber: string | null;
  mersisNumber: string | null;
  address: string | null;
  petitionDate: string | null;
  signatureCount: number;
  rawText: string;
}

export type PrecheckExtractionMode = "regex" | "regex+vision" | "vision_only";

export type PrecheckStatus = "passed" | "warned" | "failed";

export interface PrecheckResult {
  status: PrecheckStatus;
  checks: PrecheckCheck[];
  sirku: SirkuExtraction;
  petition: PetitionExtraction;
  extractionMode: PrecheckExtractionMode;
  generatedAt: string;
}
