// ============================================================
// DOCX Buffer Guards — size policy
// ============================================================
//
// Client-safe part: size constants + assertDocxSize. Called during
// parse time on the client and server. TTL cleanup lives in
// docx-guard-server.ts so this file stays pg-free.
// ============================================================

export const MAX_DOCX_BYTES = 10 * 1024 * 1024; // 10 MB

export const DOCX_RETENTION_DAYS = 90;

export class DocxTooLargeError extends Error {
  constructor(actualBytes: number) {
    super(
      `DOCX_TOO_LARGE: ${actualBytes} bytes exceeds limit ${MAX_DOCX_BYTES} bytes`,
    );
    this.name = "DocxTooLargeError";
  }
}

/**
 * Asserts a DOCX buffer is under MAX_DOCX_BYTES. Throws DocxTooLargeError
 * if not. Callers surfacing to the user should translate that to a 413.
 */
export function assertDocxSize(buffer: ArrayBuffer | Uint8Array): void {
  const size = buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length;
  if (size > MAX_DOCX_BYTES) {
    throw new DocxTooLargeError(size);
  }
}
