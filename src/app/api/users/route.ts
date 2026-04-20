import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET() {
  const caller = await getAuthUser();
  if (!caller) return unauthorized();
  if (caller.role !== "super_admin") return forbidden();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    })),
  );
}
