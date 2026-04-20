"use client";

import { useSession } from "next-auth/react";
import { getPermissions, type UserPermissions } from "@/lib/config/roles";

interface PermissionGateProps {
  /** Permission key to check */
  require: keyof UserPermissions;
  /** Content shown when permission is granted */
  children: React.ReactNode;
  /** Content shown when permission is denied (defaults to access-denied message) */
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user has the required permission.
 * Use this inside Control Room pages to gate super_admin-only sections.
 */
export function PermissionGate({ require, children, fallback }: PermissionGateProps) {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-text-muted">Yükleniyor...</p>
      </div>
    );
  }

  if (!permissions[require]) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md px-6">
          <p className="text-2xl font-semibold text-text-primary mb-3">
            Erişim Engellendi
          </p>
          <p className="text-lg text-text-secondary">
            Bu alana erişim yetkiniz bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
