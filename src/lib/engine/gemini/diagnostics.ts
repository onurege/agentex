// ============================================================
// Gemini Diagnostics — observability for Gemini calls
// ============================================================
//
// Lightweight diagnostics for development debugging.
// No external analytics, no database, no production telemetry.
// Just structured console logs and an inspectable report.
// ============================================================

// --- Types ---

/** Diagnostics for a single Gemini API call */
export interface GeminiCallDiagnostics {
  action: string;
  durationMs: number;
  success: boolean;
  fallbackUsed: boolean;
  error?: string;
  normalization: NormalizationReport;
}

/** What happened during output normalization */
export interface NormalizationReport {
  /** Items in the raw Gemini response */
  inputCount: number;
  /** Items after normalization + quality guards */
  outputCount: number;
  /** Items dropped by normalization or quality guards */
  droppedCount: number;
  /** Human-readable notes about adjustments made */
  notes: string[];
}

/** Accumulated diagnostics for an entire analysis run */
export interface AnalysisDiagnostics {
  provider: "gemini" | "mock";
  calls: GeminiCallDiagnostics[];
  timestamp: string;
}

// --- Factory ---

export function createEmptyDiagnostics(
  provider: "gemini" | "mock",
): AnalysisDiagnostics {
  return {
    provider,
    calls: [],
    timestamp: new Date().toISOString(),
  };
}

export function createCallDiagnostics(
  action: string,
): GeminiCallDiagnostics {
  return {
    action,
    durationMs: 0,
    success: false,
    fallbackUsed: false,
    normalization: {
      inputCount: 0,
      outputCount: 0,
      droppedCount: 0,
      notes: [],
    },
  };
}

// --- Logging ---

const LOG_PREFIX = "[Gemini]";

export function logCallResult(diag: GeminiCallDiagnostics): void {
  const status = diag.success
    ? diag.fallbackUsed
      ? "FALLBACK"
      : "OK"
    : "FAILED";

  const normInfo =
    diag.normalization.droppedCount > 0
      ? ` | dropped ${diag.normalization.droppedCount}/${diag.normalization.inputCount}`
      : "";

  console.log(
    `${LOG_PREFIX} ${diag.action} ${status} ${diag.durationMs}ms` +
      ` | ${diag.normalization.outputCount} items${normInfo}`,
  );

  if (diag.normalization.notes.length > 0) {
    diag.normalization.notes.forEach((note) => {
      console.log(`${LOG_PREFIX}   → ${note}`);
    });
  }

  if (diag.error) {
    console.error(`${LOG_PREFIX}   error: ${diag.error}`);
  }
}

export function logAnalysisSummary(diag: AnalysisDiagnostics): void {
  const total = diag.calls.length;
  const succeeded = diag.calls.filter((c) => c.success && !c.fallbackUsed).length;
  const fallbacks = diag.calls.filter((c) => c.fallbackUsed).length;
  const failed = diag.calls.filter((c) => !c.success).length;
  const totalMs = diag.calls.reduce((sum, c) => sum + c.durationMs, 0);

  console.log(
    `${LOG_PREFIX} ── Analysis Complete ──────────────────────`,
  );
  console.log(
    `${LOG_PREFIX} provider=${diag.provider} | ${total} calls | ${totalMs}ms total`,
  );
  console.log(
    `${LOG_PREFIX} ${succeeded} succeeded | ${fallbacks} fallbacks | ${failed} failed`,
  );

  const totalDropped = diag.calls.reduce(
    (sum, c) => sum + c.normalization.droppedCount,
    0,
  );
  if (totalDropped > 0) {
    console.log(
      `${LOG_PREFIX} ${totalDropped} items dropped by quality guards`,
    );
  }
}
