// Keep shop details and mobile sign-out together in the Settings tab.
import Link from "next/link";
import { LogOut, ArrowUpRight } from "lucide-react";
import { getOwnerShop } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { logout } from "@/app/admin/actions";
import { getT } from "@/lib/lang";

export default async function SettingsPage() {
  const { shop } = await getOwnerShop();
  const t = await getT();
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="page-title">{t("Shop settings")}</h1>
        <p className="mt-3 text-sm text-muted">{t("These details appear on your public page.")}</p>
      </header>
      <SettingsForm shop={shop} />
      <div className="space-y-3 border-t border-line pt-6">
        <Link href="/" target="_blank" className="btn-secondary w-full">
          {t("View your shop")}
          <ArrowUpRight size={16} />
        </Link>
        <form action={logout}>
          <button className="btn w-full text-muted">
            <LogOut size={17} />
            {t("Sign out")}
          </button>
        </form>
      </div>
    </div>
  );
}
