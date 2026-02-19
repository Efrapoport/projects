import type { Metadata } from "next";
import "./globals.css";
import { InvestorProvider } from "@/lib/investor-context";

export const metadata: Metadata = {
  title: "Salesforce First-Admin Radar",
  description:
    "Track companies hiring their first Salesforce admin, developer, or engineer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <InvestorProvider>{children}</InvestorProvider>
      </body>
    </html>
  );
}
