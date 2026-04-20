import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  const user = session.user as { id?: string; email?: string; name?: string; image?: string };
  return {
    id: user.id ?? user.email ?? "",
    email: user.email ?? "",
    name: user.name,
    image: user.image,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
