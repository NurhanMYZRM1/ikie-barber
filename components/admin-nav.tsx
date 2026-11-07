"use client";
// One set of links becomes bottom tabs on phones and a sidebar on larger screens.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CalendarCheck,
  Clock3,
  ChartNoAxesColumn,
  Settings2,
  GraduationCap,
  Scissors,
} from "lucide-react";
import { useT } from "./lang";

// Five tabs fill a phone's bottom bar; the last two show in the desktop sidebar only and
// are linked from Bookings and Settings on phones.
const tabs = [
  { href: "/admin", label: "Home", icon: House },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/hours", label: "Hours", icon: Clock3 },
  { href: "/admin/history", label: "History", icon: ChartNoAxesColumn },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
  { href: "/admin/visits", label: "Uni visits", icon: GraduationCap, wide: true },
  { href: "/admin/services", label: "Services & prices", icon: Scissors, wide: true },
];
export function AdminNav() {
  const path = usePathname();
  const current = (href: string) =>
    href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`);
  const t = useT();
  return (
    <nav
      aria-label={t("Owner navigation")}
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:static lg:mt-10 lg:flex-col lg:gap-2 lg:border-0 lg:bg-transparent lg:pb-0"
    >
      {tabs.map(({ href, label, icon: Icon, wide }) => (
        <Link
          key={href}
          href={href}
          aria-current={current(href) ? "page" : undefined}
          className={`${wide ? "hidden lg:flex" : "flex"} min-h-16 min-w-16 flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-4 lg:text-sm ${current(href) ? "bg-accent/10 font-semibold text-ink" : "text-muted hover:bg-ink/5"}`}
        >
          <Icon size={20} strokeWidth={1.7} />
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
