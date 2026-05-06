import { requireServerPermission } from "@/lib/server-auth";

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canViewUsers");
  return <>{children}</>;
}
