// GET /api/regulations
//
// Lists Param-relevant regulation items with topic / priority /
// since / search / pagination filters. Joins per-user RegulationRead
// rows so each item carries readAt + pinned for the calling user.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { TOPIC_BY_ID } from "@/lib/regulations/topics";
import type {
  RegulationFeedResponse,
  RegulationItemDTO,
  RegulationPriority,
} from "@/lib/regulations/types";

const VALID_PRIORITIES: ReadonlySet<RegulationPriority> = new Set<RegulationPriority>([
  "critical",
  "high",
  "medium",
  "low",
]);

const PRIORITY_FLOOR_RANK: Record<RegulationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const topicsParam = url.searchParams.get("topics");
  const priorityParam = url.searchParams.get("priority");
  const sinceParam = url.searchParams.get("since");
  const searchParam = url.searchParams.get("search");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
    100,
  );
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const topicFilter = topicsParam
    ? topicsParam
        .split(",")
        .map((s) => s.trim())
        .filter((id) => Boolean(TOPIC_BY_ID[id]))
    : null;

  const priorityFloor: RegulationPriority | null =
    priorityParam && VALID_PRIORITIES.has(priorityParam as RegulationPriority)
      ? (priorityParam as RegulationPriority)
      : null;
  const allowedPriorities = priorityFloor
    ? (Object.keys(PRIORITY_FLOOR_RANK) as RegulationPriority[]).filter(
        (p) => PRIORITY_FLOOR_RANK[p] >= PRIORITY_FLOOR_RANK[priorityFloor],
      )
    : null;

  const sinceDate = sinceParam ? new Date(sinceParam) : null;

  const where: import("@prisma/client").Prisma.RegulationItemWhereInput = {
    ...(topicFilter && topicFilter.length > 0
      ? { topics: { hasSome: topicFilter } }
      : {}),
    ...(allowedPriorities ? { priority: { in: allowedPriorities } } : {}),
    ...(sinceDate && !Number.isNaN(sinceDate.getTime())
      ? { publishedAt: { gte: sinceDate } }
      : {}),
    ...(searchParam && searchParam.trim().length > 0
      ? {
          OR: [
            { title: { contains: searchParam, mode: "insensitive" } },
            { summary: { contains: searchParam, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, latestFetch] = await Promise.all([
    prisma.regulationItem.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      skip: offset,
      take: limit,
      include: {
        reads: {
          where: { userId: user.id },
          select: { readAt: true, pinned: true },
        },
      },
    }),
    prisma.regulationItem.count({ where }),
    prisma.regulationItem.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
  ]);

  const dtos: RegulationItemDTO[] = items.map((item) => {
    const read = item.reads[0];
    return {
      id: item.id,
      source: item.source,
      externalId: item.externalId,
      title: item.title,
      summary: item.summary,
      bodyExcerpt: item.bodyExcerpt,
      url: item.url,
      publishedAt: item.publishedAt.toISOString(),
      fetchedAt: item.fetchedAt.toISOString(),
      topics: item.topics,
      priority: item.priority as RegulationPriority,
      readAt: read?.readAt ? read.readAt.toISOString() : null,
      pinned: Boolean(read?.pinned),
    };
  });

  const response: RegulationFeedResponse = {
    items: dtos,
    total,
    lastScannedAt: latestFetch?.fetchedAt
      ? latestFetch.fetchedAt.toISOString()
      : null,
  };

  return NextResponse.json(response);
}
