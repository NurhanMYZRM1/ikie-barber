// The bundled logo is the fallback; Settings can point the public page at another image.
export function Brand({ name = "Ikie Barber", src }: { name?: string; src?: string }) {
  return (
    <span className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-3">
      <img
        src={src || "/logo.png"}
        alt=""
        className="h-12 w-14 shrink-0 rounded-md bg-black object-contain"
      />
      <span className="truncate font-display text-xl font-semibold uppercase tracking-wide">
        {name}
      </span>
    </span>
  );
}
