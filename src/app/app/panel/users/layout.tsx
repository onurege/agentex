import { requireServerPermission } from "@/lib/server-auth";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canViewUsers");
  return <>{children}</>;
}
