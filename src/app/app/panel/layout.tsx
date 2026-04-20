import { requireServerPermission } from "@/lib/server-auth";
import { ControlRoomLayout } from "@/components/control-room/ControlRoomLayout";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerPermission("canAccessPanel");
  return <ControlRoomLayout>{children}</ControlRoomLayout>;
}
