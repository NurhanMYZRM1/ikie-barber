// Next.js shows this during navigation while a server page loads its database data.
import { getT } from "@/lib/lang";

export default async function Loading() {
  const t = await getT();
  return (
    <main
      id="main"
      aria-busy="true"
      aria-label={t("Loading")}
      className="mx-auto max-w-4xl space-y-5 p-6"
    >
      <p className="text-muted">{t("Loading your shop…")}</p>
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-28 animate-pulse rounded-lg bg-ink/5" />
      ))}
    </main>
  );
}
