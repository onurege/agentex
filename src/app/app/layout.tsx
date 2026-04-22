/**
 * App layout — scopes workspace styles (dark theme) to the authenticated
 * app surface. Both Stage Experience and Control Room live under /app.
 *
 * Stage pages use StageLayout (with TopBar + ProgressBar).
 * Panel pages use ControlRoomLayout (with Sidebar).
 * This layout only provides the dark theme wrapper.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden dark bg-workspace-bg text-text-primary">
      {children}
    </div>
  );
}
