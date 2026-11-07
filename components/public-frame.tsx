import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitch } from "./lang";
import { translate, type Lang } from "@/lib/i18n";
import type { PublicShop } from "@/lib/types";

// Header and footer shared by the shop page and the uni visits page.
export function PublicHeader({
  shop,
  lang,
  preview,
}: {
  shop: PublicShop;
  lang: Lang;
  preview: boolean;
}) {
  return (
    <>
      {preview && (
        <div className="bg-accent px-5 py-2.5 text-center text-xs text-on-accent">
          {translate(lang, "Sample shop preview · Connect Supabase to make it yours.")}
        </div>
      )}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-8">
        <Link
          className="min-w-0 flex-1"
          href="/"
          aria-label={translate(lang, "{name} home", { name: shop.name })}
        >
          <Brand name={shop.name} src={shop.logo_url} />
        </Link>
        <LanguageSwitch />
      </header>
    </>
  );
}
export function PublicFooter({ shop }: { shop: PublicShop }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line py-6 text-xs text-muted">
      <span>{shop.name}</span>
      <span className="flex flex-wrap gap-x-4">
        {shop.whatsapp_number && (
          <a
            href={`https://wa.me/${shop.whatsapp_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 underline-offset-2 hover:underline"
          >
            WhatsApp <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        )}
        {shop.instagram_url && (
          <a
            href={shop.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
          >
            Instagram
          </a>
        )}
      </span>
    </footer>
  );
}
