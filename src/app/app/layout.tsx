/**
 * App layout — authenticated shell under /app. Both Stage Experience
 * and Control Room live here. Theme (light/dark) is resolved at the
 * root via next-themes; this wrapper only paints the workspace
 * background + ink color so it honors whichever theme is active.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-workspace-bg text-text-primary">
      {children}
    </div>
  );
}
