"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/lib/config/roles";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "user", label: "Kullanıcı" },
  { value: "authorized_user", label: "Yetkili" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  user: "text-text-muted bg-workspace-elevated",
  authorized_user: "text-accent-info bg-accent-info/10",
  super_admin: "text-accent-primary bg-accent-primary/10",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function UsersPage() {
  const { data: session } = useSession();
  const callerId = session?.user?.id;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pendingRoleFor, setPendingRoleFor] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        setError("Kullanıcılar yüklenemedi.");
        return;
      }
      const data = (await res.json()) as UserRow[];
      setUsers(data);
    } catch {
      setError("Ağ hatası — kullanıcılar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleRoleChange = useCallback(
    async (userId: string, newRole: UserRole) => {
      const previous = users;
      // Optimistic update
      setUsers((rows) => rows.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setPendingRoleFor(userId);

      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setUsers(previous); // rollback
          if (body.error === "last_super_admin") {
            setToast({ kind: "error", message: "En az bir süper yönetici kalmalı." });
          } else if (body.error === "cannot_change_own_role") {
            setToast({ kind: "error", message: "Kendi rolünüzü değiştiremezsiniz." });
          } else {
            setToast({ kind: "error", message: "Rol değiştirilemedi." });
          }
          return;
        }

        setToast({ kind: "success", message: "Rol güncellendi." });
      } catch {
        setUsers(previous);
        setToast({ kind: "error", message: "Ağ hatası — rol değiştirilemedi." });
      } finally {
        setPendingRoleFor(null);
      }
    },
    [users],
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Users</h1>
        <p className="text-lg text-text-secondary">
          Kullanıcı yönetimi ve panel erişim kontrolü.
        </p>
      </div>

      {toast && (
        <div
          className={`mb-6 rounded-xl p-4 border ${
            toast.kind === "success"
              ? "bg-accent-success/10 border-accent-success/30 text-accent-success"
              : "bg-accent-danger/10 border-accent-danger/30 text-accent-danger"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="rounded-xl bg-workspace-surface border border-workspace-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1.5fr_160px_90px_120px] gap-4 px-6 py-4 border-b border-workspace-border bg-workspace-elevated/50">
          {["Kullanıcı", "Email", "Rol", "Aktif", "Katılma"].map((col) => (
            <span
              key={col}
              className="text-[13px] font-semibold text-text-muted uppercase tracking-wide"
            >
              {col}
            </span>
          ))}
        </div>

        {loading && (
          <div className="px-6 py-10 text-center text-text-muted">Yükleniyor…</div>
        )}

        {error && !loading && (
          <div className="px-6 py-10 text-center text-accent-danger">{error}</div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="px-6 py-10 text-center text-text-muted">
            Henüz kullanıcı yok.
          </div>
        )}

        {!loading &&
          !error &&
          users.map((u) => {
            const isSelf = u.id === callerId;
            const isPending = pendingRoleFor === u.id;

            return (
              <div
                key={u.id}
                className="grid grid-cols-[1fr_1.5fr_160px_90px_120px] gap-4 px-6 py-4 border-b border-workspace-border/30 items-center"
              >
                <span className="text-base font-medium text-text-primary truncate">
                  {u.name ?? "—"}
                </span>
                <span className="text-base text-text-secondary truncate">
                  {u.email}
                  {isSelf && (
                    <span className="ml-2 text-[12px] font-medium text-accent-primary">
                      (siz)
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    disabled={isSelf || isPending}
                    title={isSelf ? "Kendi rolünüzü değiştiremezsiniz" : undefined}
                    className={`
                      text-[13px] font-semibold px-2.5 py-1 rounded-full border outline-none
                      ${ROLE_BADGE_STYLE[u.role]}
                      ${isSelf || isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-workspace-elevated"}
                      border-workspace-border
                    `}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <span
                  className={`text-[13px] font-medium ${
                    u.active ? "text-accent-success" : "text-text-muted"
                  }`}
                >
                  {u.active ? "Evet" : "Hayır"}
                </span>

                <span className="text-[13px] text-text-muted">
                  {formatDate(u.createdAt)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
