import Link from "next/link";
import { getT } from "@/lib/lang";

export default async function NotFound() {
  const t = await getT();
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-20">
      <h1 className="page-title">{t("Page not found")}</h1>
      <p className="my-5 text-muted">
        {t("This link may have moved, or the date may not be valid.")}
      </p>
      <Link className="btn-primary" href="/">
        {t("Back to the shop")}
      </Link>
    </main>
  );
}
