"use client";

import { AuthProvider } from "@/lib/auth-context";
import { InvestorProvider } from "@/lib/investor-context";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider googleClientId={googleClientId || undefined}>
      <InvestorProvider>{children}</InvestorProvider>
    </AuthProvider>
  );
}
