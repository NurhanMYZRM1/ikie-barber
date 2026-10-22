// Waze and Google Maps both search the address; a pinned Google Maps link wins for Google.
export function directions(address?: string | null, mapsUrl?: string) {
  const place = encodeURIComponent(address ?? "");
  const google = mapsUrl || (address && `https://www.google.com/maps/search/?api=1&query=${place}`);
  return [
    ["Waze", address && `https://waze.com/ul?q=${place}&navigate=yes`],
    ["Google Maps", google],
  ].filter((link): link is [string, string] => Boolean(link[1]));
}
