"use client";
// One item at a time, like the hours editor: short forms on a phone, and a save never
// overwrites another row. New items get their id here, so a retried save is recognised.
import { useState, useTransition } from "react";
import type { z } from "zod";
import { ChevronDown, Plus } from "lucide-react";
import { saveArea, saveCharge, saveService } from "@/app/admin/services-actions";
import { areaSchema, chargeSchema, serviceSchema, validationFields } from "@/lib/validation";
import { formatMoney } from "@/lib/money";
import { newId } from "@/lib/id";
import type { ActionResult, Area, Catalog, ExtraCharge, Service } from "@/lib/types";
import { Feedback, FieldError } from "./feedback";
import { useLang, useT } from "./lang";
import { chargeRule } from "./price-list";

type Save = (input: unknown, editing: boolean) => Promise<ActionResult>;
const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function Item({
  label,
  detail,
  hidden,
  fresh,
  schema,
  save,
  read,
  children,
}: {
  label: string;
  detail: string;
  hidden: boolean;
  fresh: boolean;
  schema: z.ZodType;
  save: Save;
  read: (form: FormData) => unknown;
  children: (result: ActionResult | null) => React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(fresh);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3 px-5 text-left"
      >
        <span className="min-w-0 flex-1 font-medium">
          {label}
          {hidden && <span className="ml-2 text-xs font-normal text-muted">{t("Hidden")}</span>}
        </span>
        <span className="text-right text-sm text-muted tabular-nums">{detail}</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <form
          className="space-y-5 px-5 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            const input = read(new FormData(event.currentTarget));
            const parsed = schema.safeParse(input);
            if (!parsed.success) {
              setResult({
                ok: false,
                message: "Check the highlighted fields.",
                fields: validationFields(parsed.error),
              });
              return;
            }
            // The raw input goes to the server, which validates it again.
            startTransition(async () => {
              try {
                const response = await save(input, !fresh);
                setResult(response);
                if (response.ok && !fresh) setOpen(false);
              } catch {
                setResult({
                  ok: false,
                  message: "Couldn’t save. Check your connection and try again.",
                });
              }
            });
          }}
        >
          {children(result)}
          <Feedback result={result} />
          <button disabled={pending} className="btn-primary w-full">
            {pending ? t("Saving…") : t("Save")}
          </button>
        </form>
      )}
    </div>
  );
}

function Shown({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function ServiceItem({
  service,
  areas,
  currency,
  fresh,
}: {
  service: Service;
  areas: Area[];
  currency: string;
  fresh: boolean;
}) {
  const t = useT();
  const money = (amount: number) => formatMoney(amount, currency);
  const price = (name: string, label: string, value: number | null | undefined) => (
    <label key={name}>
      {label}
      <input
        name={name}
        inputMode="decimal"
        placeholder={t("Not offered")}
        defaultValue={text(value)}
      />
    </label>
  );
  return (
    <Item
      label={service.name || t("New service")}
      detail={[
        t("{minutes} min", { minutes: service.duration_minutes }),
        service.shop_price !== null && money(service.shop_price),
      ]
        .filter(Boolean)
        .join(" · ")}
      hidden={!service.is_active}
      fresh={fresh}
      schema={serviceSchema}
      save={saveService}
      read={(form) => ({
        id: service.id,
        sort_order: service.sort_order,
        name: form.get("name"),
        description: form.get("description"),
        duration_minutes: form.get("duration_minutes"),
        is_active: form.get("is_active") === "on",
        shop_price: form.get("shop_price"),
        university_price: form.get("university_price"),
        area_prices: Object.fromEntries(
          areas.map((area) => [area.id, form.get(`area-${area.id}`)]),
        ),
      })}
    >
      {(result) => (
        <>
          <label>
            {t("Service name")}
            <input name="name" required maxLength={80} defaultValue={service.name} />
            <FieldError message={result?.fields?.name} />
          </label>
          <label>
            {t("Description")} <span className="font-normal text-muted">{t("(optional)")}</span>
            <input name="description" maxLength={200} defaultValue={service.description} />
          </label>
          <label>
            {t("Length (minutes)")}
            <input
              name="duration_minutes"
              type="number"
              min={5}
              max={480}
              step={5}
              required
              defaultValue={service.duration_minutes}
            />
            <FieldError message={result?.fields?.duration_minutes} />
          </label>
          <Shown name="is_active" label={t("Shown to customers")} checked={service.is_active} />
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("Prices ({currency})", { currency })}
            </legend>
            <p className="text-xs text-muted">
              {t("Leave a price blank where you don’t offer this service.")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {price("shop_price", t("At the shop"), service.shop_price)}
              {price("university_price", t("Uni visits"), service.university_price)}
              {areas.map((area) =>
                price(
                  `area-${area.id}`,
                  t("{area} house call", { area: area.name }),
                  service.area_prices[area.id],
                ),
              )}
            </div>
            <FieldError
              message={
                result?.fields?.shop_price ??
                result?.fields?.university_price ??
                result?.fields?.area_prices
              }
            />
          </fieldset>
        </>
      )}
    </Item>
  );
}

function AreaItem({ area, fresh }: { area: Area; fresh: boolean }) {
  const t = useT();
  return (
    <Item
      label={area.name || t("New area")}
      detail=""
      hidden={!area.is_active}
      fresh={fresh}
      schema={areaSchema}
      save={saveArea}
      read={(form) => ({
        id: area.id,
        sort_order: area.sort_order,
        name: form.get("name"),
        is_active: form.get("is_active") === "on",
      })}
    >
      {(result) => (
        <>
          <label>
            {t("Area name")}
            <input name="name" required maxLength={60} defaultValue={area.name} />
            <FieldError message={result?.fields?.name} />
          </label>
          <Shown name="is_active" label={t("Offer house calls here")} checked={area.is_active} />
          {fresh && (
            <p className="text-xs text-muted">
              {t("Then set each service’s price for this area above.")}
            </p>
          )}
        </>
      )}
    </Item>
  );
}

function ChargeItem({
  charge,
  currency,
  fresh,
}: {
  charge: ExtraCharge;
  currency: string;
  fresh: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [rule, setRule] = useState(
    charge.starts_from ? "from" : charge.notice_hours ? "notice" : "none",
  );
  return (
    <Item
      label={charge.label || t("New charge")}
      detail={`+${formatMoney(charge.amount, currency)} · ${chargeRule(charge, lang)}`}
      hidden={!charge.is_active}
      fresh={fresh}
      schema={chargeSchema}
      save={saveCharge}
      read={(form) => ({
        id: charge.id,
        sort_order: charge.sort_order,
        label: form.get("label"),
        amount: form.get("amount"),
        rule,
        starts_from: form.get("starts_from") ?? "",
        notice_hours: form.get("notice_hours") ?? "",
        is_active: form.get("is_active") === "on",
      })}
    >
      {(result) => (
        <>
          <label>
            {t("Label")}
            <input name="label" required maxLength={80} defaultValue={charge.label} />
            <FieldError message={result?.fields?.label} />
          </label>
          <label>
            {t("Amount ({currency})", { currency })}
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={text(charge.amount || null)}
            />
            <FieldError message={result?.fields?.amount} />
          </label>
          <label>
            {t("When it applies")}
            <select value={rule} onChange={(event) => setRule(event.target.value)}>
              <option value="none">{t("Not added online: arranged on WhatsApp")}</option>
              <option value="from">{t("Appointments starting from a time")}</option>
              <option value="notice">{t("Bookings made at short notice")}</option>
            </select>
          </label>
          {rule === "from" && (
            <label>
              {t("Starting from")}
              <input
                name="starts_from"
                type="time"
                step={900}
                required
                defaultValue={charge.starts_from?.slice(0, 5) ?? "23:00"}
              />
              <FieldError message={result?.fields?.starts_from} />
            </label>
          )}
          {rule === "notice" && (
            <label>
              {t("Booked less than this many hours ahead")}
              <input
                name="notice_hours"
                type="number"
                min={1}
                max={168}
                required
                defaultValue={charge.notice_hours ?? 3}
              />
              <FieldError message={result?.fields?.notice_hours} />
            </label>
          )}
          <p className="text-xs text-muted">
            {t("Customers see the charge and the new total before they book.")}
          </p>
          <Shown name="is_active" label={t("Active")} checked={charge.is_active} />
        </>
      )}
    </Item>
  );
}

function Section({
  title,
  add,
  onAdd,
  children,
}: {
  title: string;
  add: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onAdd} className="btn px-3 text-sm text-accent">
          <Plus size={16} aria-hidden="true" /> {add}
        </button>
      </div>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

export function CatalogEditor({ catalog, currency }: { catalog: Catalog; currency: string }) {
  const t = useT();
  // Unsaved new items; each disappears once the saved row arrives from the server.
  const [fresh, setFresh] = useState<{ service: string[]; area: string[]; charge: string[] }>({
    service: [],
    area: [],
    charge: [],
  });
  const add = (type: keyof typeof fresh) =>
    setFresh({ ...fresh, [type]: [...fresh[type], newId()] });
  const saved = (type: keyof typeof fresh, rows: { id: string }[]) =>
    fresh[type].filter((id) => !rows.some((row) => row.id === id));
  const key = (row: object) => JSON.stringify(row);
  return (
    <div className="space-y-8">
      <Section title={t("Services")} add={t("Add a service")} onAdd={() => add("service")}>
        {catalog.services.map((service) => (
          <ServiceItem
            key={key(service)}
            service={service}
            areas={catalog.areas}
            currency={currency}
            fresh={false}
          />
        ))}
        {saved("service", catalog.services).map((id) => (
          <ServiceItem
            key={id}
            fresh
            areas={catalog.areas}
            currency={currency}
            service={{
              id,
              name: "",
              description: "",
              duration_minutes: 30,
              shop_price: null,
              university_price: null,
              area_prices: {},
              is_active: true,
              sort_order: catalog.services.length,
            }}
          />
        ))}
      </Section>
      <Section title={t("House-call areas")} add={t("Add an area")} onAdd={() => add("area")}>
        {catalog.areas.map((area) => (
          <AreaItem key={key(area)} area={area} fresh={false} />
        ))}
        {saved("area", catalog.areas).map((id) => (
          <AreaItem
            key={id}
            fresh
            area={{ id, name: "", is_active: true, sort_order: catalog.areas.length }}
          />
        ))}
      </Section>
      <Section title={t("Extra charges")} add={t("Add a charge")} onAdd={() => add("charge")}>
        {catalog.extras.map((charge) => (
          <ChargeItem key={key(charge)} charge={charge} currency={currency} fresh={false} />
        ))}
        {saved("charge", catalog.extras).map((id) => (
          <ChargeItem
            key={id}
            fresh
            currency={currency}
            charge={{
              id,
              label: "",
              amount: 0,
              starts_from: null,
              notice_hours: null,
              is_active: true,
              sort_order: catalog.extras.length,
            }}
          />
        ))}
      </Section>
    </div>
  );
}
