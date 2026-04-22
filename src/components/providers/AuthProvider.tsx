"use client";

import { SessionProvider } from "next-auth/react";
import { SessionActorBridge } from "./SessionActorBridge";
import { CustomAgentHydrator } from "./CustomAgentHydrator";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionActorBridge />
      <CustomAgentHydrator />
      {children}
    </SessionProvider>
  );
}
