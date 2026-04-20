import { requireServerPermission } from "@/lib/server-auth";

export default async function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canViewAudit");
  return <>{children}</>;
}
