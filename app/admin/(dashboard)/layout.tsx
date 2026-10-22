import Link from "next/link";
import { ArrowUpRight, LogOut } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin-nav";
import { logout } from "@/app/admin/actions";
import { getT } from "@/lib/lang";
import { LanguageSwitch } from "@/components/lang";

export const dynamic = "force-dynamic";
// Route group keeps login outside the protected shell without changing /admin URLs.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const t = await getT();
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="border-b border-line px-5 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:bg-surface lg:p-6">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
          <Link href="/admin">
            <Brand />
          </Link>
          <LanguageSwitch />
        </div>
        <AdminNav />
        <div className="mt-auto hidden space-y-3 lg:block">
          <Link href="/" target="_blank" className="btn-secondary w-full">
            {t("View your shop")} <ArrowUpRight size={16} />
          </Link>
          <form action={logout}>
            <button className="btn w-full text-muted">
              <LogOut size={17} />
              {t("Sign out")}
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="mx-auto max-w-6xl px-5 pb-32 pt-8 sm:px-8 lg:py-12">
        {children}
      </main>
    </div>
  );
}
