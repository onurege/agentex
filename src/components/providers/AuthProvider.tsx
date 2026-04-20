"use client";

import { SessionProvider } from "next-auth/react";
import { SessionActorBridge } from "./SessionActorBridge";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionActorBridge />
      {children}
    </SessionProvider>
  );
}
