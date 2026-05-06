import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canReadRun,
  forbidden,
  getAuthUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

// GET /api/runs/[runId]/original
// Streams the original (unredlined) DOCX uploaded for this run. Group
// members get the same read access as the redline endpoint — required
// for transparency in shared workspaces.
export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const run = await prisma.boardRun.findUnique({
    where: { id: params.runId },
    select: {
      userId: true,
      groupId: true,
      deletedAt: true,
      documentName: true,
      documentType: true,
    },
  });
  if (!run || run.deletedAt) return notFound("Run not found");
  if (!canReadRun(user, run)) return forbidden();

  const artifact = await prisma.documentArtifact.findUnique({
    where: { runId: params.runId },
    select: { originalDocxBuffer: true },
  });
  if (!artifact?.originalDocxBuffer) {
    return notFound("Original document not stored for this run");
  }

  const body = Buffer.isBuffer(artifact.originalDocxBuffer)
    ? artifact.originalDocxBuffer
    : Buffer.from(artifact.originalDocxBuffer);

  // Strip any '-redline-vN' suffix that crept in from prior re-uploads
  // and append a clean -original tag so the downloaded file is easy to
  // distinguish in the user's filesystem.
  const cleanBase = run.documentName
    .replace(/\.docx$/i, "")
    .replace(/-redline-v\d+$/i, "");
  const fileName = `${cleanBase}-original.docx`;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        fileName,
      )}`,
      "Cache-Control": "private, no-store",
    },
  });
}
