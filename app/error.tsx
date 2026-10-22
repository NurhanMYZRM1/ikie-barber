"use client";
// Hide raw database errors from visitors, but always provide a way to retry.
import { useT } from "@/components/lang";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useT();
  return (
    <main id="main" className="mx-auto max-w-md p-8">
      <h1 className="page-title">{t("This page couldn’t load")}</h1>
      <p className="my-5 text-muted">
        {t(
          "Please check your connection and try again. If you’re setting up the shop, check the Supabase steps in the README.",
        )}
      </p>
      <button onClick={reset} className="btn-primary">
        {t("Try again")}
      </button>
    </main>
  );
}
