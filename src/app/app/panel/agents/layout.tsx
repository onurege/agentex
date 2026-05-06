import { requireServerPermission } from "@/lib/server-auth";

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canManageOwnAgents");
  return <>{children}</>;
}
