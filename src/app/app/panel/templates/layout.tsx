import { requireServerPermission } from "@/lib/server-auth";

export default async function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canManageOwnAgents");
  return <>{children}</>;
}
