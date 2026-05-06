import { requireServerPermission } from "@/lib/server-auth";

export default async function PanelSignaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Anyone with panel access can see the queue (read-only). Stage-2
  // approve/reject buttons inside the page render only for
  // authorized_user / super_admin; the API enforces the same.
  await requireServerPermission("canAccessPanel");
  return <>{children}</>;
}
