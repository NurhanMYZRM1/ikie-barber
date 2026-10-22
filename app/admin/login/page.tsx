import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { isConfigured } from "@/lib/supabase/config";
import { getT } from "@/lib/lang";
import { LanguageSwitch } from "@/components/lang";

export const dynamic = "force-dynamic";
// Not linked from the public page; the owner bookmarks /admin.
export default async function LoginPage() {
  const t = await getT();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Brand />
        <LanguageSwitch />
      </div>
      <h1 className="page-title">{t("Owner login")}</h1>
      <p className="mb-8 mt-2 text-sm text-muted">{t("Bookings, hours and earnings.")}</p>
      <LoginForm configured={isConfigured()} />
    </main>
  );
}
