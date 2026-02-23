"use client";

import { SessionProvider } from "next-auth/react";
import { InvestorProvider } from "@/lib/investor-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <InvestorProvider>{children}</InvestorProvider>
    </SessionProvider>
  );
}
