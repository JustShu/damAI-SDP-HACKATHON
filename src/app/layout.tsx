import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { currentActorOrNull } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Neighbourhood Mediator (prototype)",
  description: "Hackathon prototype with synthetic data. Not affiliated with or endorsed by any property company.",
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
