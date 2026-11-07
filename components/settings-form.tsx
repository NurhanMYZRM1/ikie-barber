"use client";
// Profile and local preferences share one validated save; financial records are never rewritten.
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/admin/settings-actions";
import { settingsSchema, validationFields } from "@/lib/validation";
import type { Shop, ActionResult } from "@/lib/types";
import { Feedback, FieldError } from "./feedback";
import { useT } from "./lang";

export function SettingsForm({ shop }: { shop: Shop }) {
  const t = useT();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="card space-y-6 p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const input = Object.fromEntries(new FormData(event.currentTarget));
        const parsed = settingsSchema.safeParse(input);
        if (!parsed.success) {
          setResult({
            ok: false,
            message: "Check the highlighted fields.",
            fields: validationFields(parsed.error),
          });
          return;
        }
        startTransition(async () => {
          try {
            setResult(await saveSettings(parsed.data));
          } catch {
            setResult({
              ok: false,
              message: "Couldn’t save. Check your connection and try again.",
            });
          }
        });
      }}
    >
      <div>
        <h2 className="font-semibold">{t("Shop profile")}</h2>
        <p className="mt-2 text-sm text-muted">{t("A familiar face for your neighbourhood.")}</p>
      </div>
      <label>
        {t("Shop name")}
        <input name="name" required maxLength={80} defaultValue={shop.name} />
        <FieldError message={result?.fields?.name} />
      </label>
      <label>
        {t("Short description")}
        <textarea name="description" rows={3} maxLength={300} defaultValue={shop.description} />
        <FieldError message={result?.fields?.description} />
      </label>
      <label>
        {t("Logo image URL (optional)")}
        <input
          name="logo_url"
          type="url"
          placeholder="https://…"
          defaultValue={shop.logo_url}
          aria-describedby="logo-help"
        />
        <span id="logo-help" className="mt-2 block text-xs font-normal text-muted">
          {t("Shown in your shop page header. Leave blank to use the Ikie Barber logo.")}
        </span>
        <FieldError message={result?.fields?.logo_url} />
      </label>
      <label>
        {t("Address")}
        <textarea name="address" rows={2} maxLength={300} defaultValue={shop.address} />
        <FieldError message={result?.fields?.address} />
      </label>
      <label>
        {t("Google Maps link")}
        <input
          name="maps_url"
          type="url"
          placeholder="https://maps.google.com/…"
          defaultValue={shop.maps_url}
        />
        <FieldError message={result?.fields?.maps_url} />
      </label>
      <label>
        {t("Phone / WhatsApp number")}
        <input
          name="whatsapp_number"
          type="tel"
          inputMode="tel"
          placeholder="60123456789"
          defaultValue={shop.whatsapp_number}
        />
        <span className="mt-2 block text-xs font-normal text-muted">
          {t("Include country code, with digits only. No +, spaces, or dashes.")}
        </span>
        <FieldError message={result?.fields?.whatsapp_number} />
      </label>
      <label>
        {t("Instagram link (optional)")}
        <input name="instagram_url" type="url" defaultValue={shop.instagram_url} />
        <FieldError message={result?.fields?.instagram_url} />
      </label>
      <div className="border-t border-line pt-6">
        <h2 className="mb-5 font-semibold">{t("Local preferences")}</h2>
        <div className="space-y-5">
          <label>
            {t("Shop timezone")}
            <input name="timezone" list="timezones" defaultValue={shop.timezone} required />
            <datalist id="timezones">
              <option value="Asia/Kuala_Lumpur" />
              <option value="Asia/Singapore" />
              <option value="Asia/Jakarta" />
              <option value="Europe/London" />
              <option value="America/New_York" />
              <option value="Australia/Sydney" />
            </datalist>
            <FieldError message={result?.fields?.timezone} />
          </label>
          <label>
            {t("Currency")}
            <select name="currency" defaultValue={shop.currency}>
              <option value="MYR">{t("MYR — Malaysian ringgit (RM)")}</option>
              <option value="SGD">{t("SGD — Singapore dollar")}</option>
              <option value="USD">{t("USD — US dollar")}</option>
              <option value="GBP">{t("GBP — British pound")}</option>
              <option value="EUR">{t("EUR — Euro")}</option>
              <option value="AUD">{t("AUD — Australian dollar")}</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-muted">
            {t(
              "Choose these before your first entry. Changing timezone affects new entries only. Changing currency relabels all amounts; it does not convert them.",
            )}
          </p>
        </div>
      </div>
      <Feedback result={result} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("Saving…") : t("Save shop details")}
      </button>
    </form>
  );
}
