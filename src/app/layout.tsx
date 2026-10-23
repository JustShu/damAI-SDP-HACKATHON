import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { currentActorOrNull } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DAMAI · Neighbours at peace",
  description: "DAMAI: privacy-first, AI-mediated neighbourhood concerns and urgent help. Prototype with synthetic data; not affiliated with or endorsed by any property company.",
  applicationName: "DAMAI",
  appleWebApp: { capable: true, title: "DAMAI", statusBarStyle: "black-translucent" },
};

// Phone browser chrome matches the DAMAI header; content can use the full screen (notch-safe).
export const viewport: Viewport = {
  themeColor: "#1d1752",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const actor = await currentActorOrNull();
  return (
    <html lang="en" className={`${jakarta.variable} antialiased`}>
      <body className="min-h-dvh font-sans text-[15px] leading-relaxed">
        {actor ? <AppShell actor={actor}>{children}</AppShell> : children}
      </body>
    </html>
  );
}
