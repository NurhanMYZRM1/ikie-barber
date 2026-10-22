import type { Metadata, Viewport } from "next";
import { Oswald } from "next/font/google";
import { LangProvider } from "@/components/lang";
import { getLang, getT } from "@/lib/lang";
import "./globals.css";

// Condensed headings echo the shop's poster. next/font self-hosts it at build time.
const display = Oswald({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: `Ikie Barber — ${t("Good hair. Good mood. Anywhere.")}`,
    description: t(
      "Barber at the shop or house call in Putrajaya, Cyberjaya and Bangi. Book a time online.",
    ),
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Shared document shell; every page has a keyboard-accessible skip link.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = await getT();
  return (
    <html lang={lang} className={display.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:p-4"
        >
          {t("Skip to content")}
        </a>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
