import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadRun, getAuthUser, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-auth";

// GET /api/runs/[runId]/redline?generation=N
// Streams the redlined DOCX for the run. Defaults to the latest
// generation; ?generation=N picks a specific version.
export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Read access: owner, same-group, or super_admin.
  const run = await prisma.boardRun.findUnique({
    where: { id: params.runId },
    select: {
      userId: true,
      groupId: true,
      deletedAt: true,
      documentName: true,
    },
  });
  if (!run || run.deletedAt) return notFound("Run not found");
  if (!canReadRun(user, run)) return forbidden();

  const generationParam = req.nextUrl.searchParams.get("generation");

  let artifact;
  if (generationParam !== null) {
    const generation = Number.parseInt(generationParam, 10);
    if (!Number.isFinite(generation) || generation < 1) {
      return badRequest("invalid_generation");
    }
    artifact = await prisma.redlineArtifact.findUnique({
      where: { runId_generation: { runId: params.runId, generation } },
      select: { docxBuffer: true, generation: true, generatedAt: true },
    });
  } else {
    artifact = await prisma.redlineArtifact.findFirst({
      where: { runId: params.runId, isLatest: true },
      orderBy: { generation: "desc" },
      select: { docxBuffer: true, generation: true, generatedAt: true },
    });
  }

  if (!artifact) return notFound("Redline not generated for this run");

  // Filename = <doc>-redline-<YYYY-MM-DD_HH-mm>.docx so multiple runs
  // of the same source document are distinguishable in the filesystem.
  // Strip any '-redline-vN' suffix from the source name so re-uploaded
  // redline DOCXes don't compound the suffix on each pass.
  // Sanitize filename — Word doesn't like special characters in
  // Content-Disposition; keep ASCII fallback and provide UTF-8 filename*.
  const baseName = run.documentName
    .replace(/\.docx$/i, "")
    .replace(/-redline-(?:v\d+|\d{4}-\d{2}-\d{2}_\d{2}-\d{2})$/i, "");
  const stamp = formatRedlineStamp(artifact.generatedAt);
  const fileName = `${baseName}-redline-${stamp}.docx`;
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

  // Bytes field comes back as Uint8Array from Prisma; wrap into Buffer
  // so NextResponse streams it as a binary body.
  const body = Buffer.isBuffer(artifact.docxBuffer)
    ? artifact.docxBuffer
    : Buffer.from(artifact.docxBuffer);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store",
    },
  });
}

// Local timezone (Europe/Istanbul in production) so users see filenames
// matching the run's wall-clock time. UTC would be safer but harder for
// non-technical users to map back to "the run I just did".
function formatRedlineStamp(d: Date): string {
  const tz = "Europe/Istanbul";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}_${get("hour")}-${get("minute")}`;
}
