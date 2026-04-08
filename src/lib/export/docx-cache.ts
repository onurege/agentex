// ============================================================
// DOCX File Cache — stores original uploaded DOCX for patching
// ============================================================
//
// Module-level cache for the raw ArrayBuffer of the last uploaded
// DOCX file. Used by the in-place patching export to modify the
// original document structure.
//
// Not stored in Zustand because ArrayBuffer is large and not
// JSON-serializable. Cleared on new upload or workspace reset.
// ============================================================

let _cachedBuffer: ArrayBuffer | null = null;
let _cachedFileName: string | null = null;

export function cacheDocxBuffer(buffer: ArrayBuffer, fileName: string): void {
  _cachedBuffer = buffer;
  _cachedFileName = fileName;
}

export function getCachedDocxBuffer(): {
  buffer: ArrayBuffer;
  fileName: string;
} | null {
  if (_cachedBuffer && _cachedFileName) {
    return { buffer: _cachedBuffer, fileName: _cachedFileName };
  }
  return null;
}

export function clearDocxCache(): void {
  _cachedBuffer = null;
  _cachedFileName = null;
}
