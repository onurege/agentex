"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2 } from "lucide-react";
import type { UserRole } from "@/lib/config/roles";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  deletedAt?: string | null;
  groupId: string | null;
  groupName: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
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
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(true);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as UserRole,
    active: true,
  });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupDraft, setGroupDraft] = useState("");

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) return;
      const data = (await res.json()) as GroupRow[];
      setGroups(data);
    } catch {
      // non-fatal — group select will be empty
    }
  }, []);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupDraft.trim();
    if (name.length === 0) return;
    setPendingFor("group-create");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          kind: "error",
          message:
            body.error === "name_taken"
              ? "Bu isimde bir grup zaten var."
              : "Grup oluşturulamadı.",
        });
        return;
      }
      setGroups((g) => [...g, body as GroupRow].sort((a, b) => a.name.localeCompare(b.name)));
      setGroupDraft("");
      setToast({ kind: "success", message: "Grup oluşturuldu." });
    } catch {
      setToast({ kind: "error", message: "Ağ hatası — grup oluşturulamadı." });
    } finally {
      setPendingFor(null);
    }
  }

  async function deleteGroup(id: string) {
    setPendingFor(`group-${id}`);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setToast({ kind: "error", message: "Grup silinemedi." });
        return;
      }
      setGroups((g) => g.filter((x) => x.id !== id));
      // Users that were in this group are now ungrouped — refetch.
      void fetchUsers();
      setToast({ kind: "success", message: "Grup silindi." });
    } catch {
      setToast({ kind: "error", message: "Ağ hatası — grup silinemedi." });
    } finally {
      setPendingFor(null);
    }
  }

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
    void fetchGroups();
  }, [fetchUsers, fetchGroups]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingFor("create");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ kind: "error", message: userErrorMessage(body.error, "Kullanıcı oluşturulamadı.") });
        return;
      }
      setUsers((rows) => [...rows, body as UserRow]);
      setCreateForm({ name: "", email: "", password: "", role: "user", active: true });
      setToast({ kind: "success", message: "Kullanıcı oluşturuldu." });
    } catch {
      setToast({ kind: "error", message: "Ağ hatası — kullanıcı oluşturulamadı." });
    } finally {
      setPendingFor(null);
    }
  }

  const updateUser = useCallback(
    async (
      userId: string,
      patch: Partial<Pick<UserRow, "role" | "active" | "name">> & {
        password?: string;
        groupId?: string | null;
      },
    ) => {
      const previous = users;
      setUsers((rows) =>
        rows.map((u) => {
          if (u.id !== userId) return u;
          const next = { ...u, ...patch };
          if (patch.groupId !== undefined) {
            next.groupId = patch.groupId;
            next.groupName =
              patch.groupId === null
                ? null
                : groups.find((g) => g.id === patch.groupId)?.name ?? u.groupName;
          }
          return next;
        }),
      );
      setPendingFor(userId);

      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUsers(previous);
          setToast({ kind: "error", message: userErrorMessage(body.error, "Kullanıcı güncellenemedi.") });
          return;
        }
        setToast({ kind: "success", message: "Kullanıcı güncellendi." });
      } catch {
        setUsers(previous);
        setToast({ kind: "error", message: "Ağ hatası — kullanıcı güncellenemedi." });
      } finally {
        setPendingFor(null);
      }
    },
    [users, groups],
  );

  async function deleteUser(userId: string) {
    const previous = users;
    setPendingFor(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ kind: "error", message: userErrorMessage(body.error, "Kullanıcı silinemedi.") });
        return;
      }
      setUsers((rows) => rows.filter((u) => u.id !== userId));
      setToast({ kind: "success", message: "Kullanıcı silindi." });
    } catch {
      setUsers(previous);
      setToast({ kind: "error", message: "Ağ hatası — kullanıcı silinemedi." });
    } finally {
      setPendingFor(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Kullanıcılar</h1>
          <p className="text-lg text-text-secondary">
            Super admin kullanıcı ekleyebilir, yetkilendirebilir, pasife alabilir ve silebilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-accent-secondary"
        >
          <Plus size={16} />
          Yeni Kullanıcı
        </button>
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

      <section className="mb-8 rounded-2xl border border-workspace-border bg-workspace-surface p-6 shadow-soft">
        <div className="mb-4">
          <h2 className="font-display text-xl font-bold text-text-primary">Gruplar</h2>
          <p className="text-sm text-text-secondary">
            Aynı gruptaki kullanıcılar birbirinin Boardroom run&apos;larını ve
            sözleşme indirmelerini görür (read-only). Edit/sil sadece sahibinde.
          </p>
        </div>
        <form
          onSubmit={createGroup}
          className="mb-4 flex items-center gap-2"
        >
          <input
            value={groupDraft}
            onChange={(e) => setGroupDraft(e.target.value)}
            placeholder="Yeni grup adı (örn: 'Hukuk Departmanı')"
            className="h-10 flex-1 rounded-xl border border-workspace-border bg-workspace-bg px-4 text-sm text-text-primary outline-none focus:border-accent-primary/50"
          />
          <button
            type="submit"
            disabled={
              pendingFor === "group-create" || groupDraft.trim().length === 0
            }
            className="h-10 rounded-xl bg-accent-primary px-4 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-50"
          >
            {pendingFor === "group-create" ? "Ekleniyor..." : "Grup ekle"}
          </button>
        </form>
        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">Henüz grup yok.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-2 rounded-full border border-workspace-border bg-workspace-bg px-3 py-1.5"
              >
                <span className="text-sm font-medium text-text-primary">
                  {g.name}
                </span>
                <span className="text-[12px] text-text-muted">
                  · {g.memberCount} üye
                </span>
                <button
                  type="button"
                  onClick={() => void deleteGroup(g.id)}
                  disabled={pendingFor === `group-${g.id}`}
                  className="text-xs font-semibold text-accent-danger hover:underline disabled:opacity-40"
                  aria-label={`${g.name} grubunu sil`}
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <form
          onSubmit={createUser}
          className="mb-8 rounded-2xl border border-workspace-border bg-workspace-surface p-6 shadow-soft"
        >
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-text-primary">Kullanıcı ekle</h2>
            <p className="text-sm text-text-secondary">
              Google girişi kapalıdır; kullanıcılar e-posta ve geçici şifre ile açılır.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr_1fr_180px_120px]">
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
              placeholder="Ad Soyad"
              className="h-12 rounded-xl border border-workspace-border bg-workspace-bg px-4 text-sm text-text-primary outline-none focus:border-accent-primary/50"
            />
            <input
              value={createForm.email}
              onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))}
              type="email"
              required
              placeholder="eposta@firma.com"
              className="h-12 rounded-xl border border-workspace-border bg-workspace-bg px-4 text-sm text-text-primary outline-none focus:border-accent-primary/50"
            />
            <input
              value={createForm.password}
              onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))}
              type="password"
              required
              minLength={10}
              placeholder="Geçici şifre"
              className="h-12 rounded-xl border border-workspace-border bg-workspace-bg px-4 text-sm text-text-primary outline-none focus:border-accent-primary/50"
            />
            <select
              value={createForm.role}
              onChange={(event) => setCreateForm((form) => ({ ...form, role: event.target.value as UserRole }))}
              className="h-12 rounded-xl border border-workspace-border bg-workspace-bg px-4 text-sm text-text-primary outline-none focus:border-accent-primary/50"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pendingFor === "create"}
              className="h-12 rounded-xl bg-accent-primary px-4 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-50"
            >
              {pendingFor === "create" ? "Ekleniyor..." : "Ekle"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-workspace-border bg-workspace-surface">
        <div className="grid grid-cols-[1.1fr_1.4fr_140px_140px_100px_160px_110px_120px] gap-4 border-b border-workspace-border bg-workspace-elevated/50 px-6 py-4">
          {["Kullanıcı", "Email", "Grup", "Rol", "Aktif", "Şifre", "Katılma", "İşlem"].map((col) => (
            <span key={col} className="text-[13px] font-semibold uppercase tracking-wide text-text-muted">
              {col}
            </span>
          ))}
        </div>

        {loading && <div className="px-6 py-10 text-center text-text-muted">Yükleniyor…</div>}
        {error && !loading && <div className="px-6 py-10 text-center text-accent-danger">{error}</div>}
        {!loading && !error && users.length === 0 && (
          <div className="px-6 py-10 text-center text-text-muted">Henüz kullanıcı yok.</div>
        )}

        {!loading &&
          !error &&
          users.map((u) => {
            const isSelf = u.id === callerId;
            const isPending = pendingFor === u.id;
            const passwordDraft = passwordDrafts[u.id] ?? "";

            return (
              <div
                key={u.id}
                className="grid grid-cols-[1.1fr_1.4fr_140px_140px_100px_160px_110px_120px] items-center gap-4 border-b border-workspace-border/30 px-6 py-4"
              >
                <input
                  value={u.name ?? ""}
                  onChange={(event) =>
                    setUsers((rows) => rows.map((row) => (row.id === u.id ? { ...row, name: event.target.value } : row)))
                  }
                  onBlur={(event) => void updateUser(u.id, { name: event.target.value })}
                  disabled={isPending}
                  placeholder="—"
                  className="h-10 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-base font-medium text-text-primary outline-none hover:border-workspace-border focus:border-accent-primary/40"
                />
                <span className="truncate text-base text-text-secondary">
                  {u.email}
                  {isSelf && <span className="ml-2 text-[12px] font-medium text-accent-primary">(siz)</span>}
                </span>

                <select
                  value={u.groupId ?? ""}
                  onChange={(event) =>
                    void updateUser(u.id, {
                      groupId: event.target.value === "" ? null : event.target.value,
                    })
                  }
                  disabled={isPending}
                  className={`rounded-lg border border-workspace-border bg-workspace-bg px-2 py-1 text-[13px] text-text-primary outline-none focus:border-accent-primary/40 ${
                    isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                  aria-label="Grup ataması"
                >
                  <option value="">— grupsuz —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <select
                  value={u.role}
                  onChange={(event) => void updateUser(u.id, { role: event.target.value as UserRole })}
                  disabled={isSelf || isPending}
                  className={`rounded-full border border-workspace-border px-2.5 py-1 text-[13px] font-semibold outline-none ${ROLE_BADGE_STYLE[u.role]} ${
                    isSelf || isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void updateUser(u.id, { active: !u.active })}
                  disabled={isSelf || isPending}
                  className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                    u.active ? "bg-accent-success/10 text-accent-success" : "bg-workspace-elevated text-text-muted"
                  } ${isSelf || isPending ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {u.active ? "Aktif" : "Pasif"}
                </button>

                <div className="flex items-center gap-2">
                  <input
                    value={passwordDraft}
                    onChange={(event) => setPasswordDrafts((drafts) => ({ ...drafts, [u.id]: event.target.value }))}
                    type="password"
                    minLength={10}
                    placeholder="Yeni şifre"
                    className="h-9 w-28 rounded-lg border border-workspace-border bg-workspace-bg px-2 text-xs outline-none focus:border-accent-primary/40"
                  />
                  <button
                    type="button"
                    disabled={isPending || passwordDraft.length < 10}
                    onClick={() => {
                      void updateUser(u.id, { password: passwordDraft });
                      setPasswordDrafts((drafts) => ({ ...drafts, [u.id]: "" }));
                    }}
                    className="text-xs font-semibold text-accent-primary disabled:text-text-muted"
                  >
                    Kaydet
                  </button>
                </div>

                <span className="text-[13px] text-text-muted">{formatDate(u.createdAt)}</span>

                {confirmDeleteId === u.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void deleteUser(u.id)}
                      className="text-xs font-semibold text-accent-danger"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-semibold text-text-muted"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSelf || isPending}
                    onClick={() => setConfirmDeleteId(u.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    Sil
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function userErrorMessage(error: unknown, fallback: string): string {
  if (error === "email_taken") return "Bu e-posta ile aktif bir kullanıcı var.";
  if (error === "weak_password") return "Şifre en az 10 karakter olmalı.";
  if (error === "invalid_email") return "Geçerli bir e-posta girin.";
  if (error === "last_super_admin") return "En az bir aktif super admin kalmalı.";
  if (error === "cannot_change_own_role") return "Kendi rolünüzü değiştiremezsiniz.";
  if (error === "cannot_delete_self") return "Kendi kullanıcınızı silemezsiniz.";
  return fallback;
}
