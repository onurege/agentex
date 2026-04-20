import type { PersistenceAdapter } from "./types";

export type PersistenceMode = "local" | "db";

let _adapter: PersistenceAdapter | null = null;

export function getPersistenceMode(): PersistenceMode {
  const mode = process.env.NEXT_PUBLIC_PERSISTENCE_MODE;
  if (mode === "db") return "db";
  return "local";
}

export async function getPersistenceAdapter(): Promise<PersistenceAdapter> {
  if (_adapter) return _adapter;

  const mode = getPersistenceMode();

  if (mode === "db") {
    const { PostgresAdapter } = await import("./postgres-adapter");
    _adapter = new PostgresAdapter();
  } else {
    const { LocalStorageAdapter } = await import("./local-adapter");
    _adapter = new LocalStorageAdapter();
  }

  return _adapter;
}
