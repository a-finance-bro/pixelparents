// Pure, client-safe helpers powering the directory's age-range and "near me"
// radius filters. Kept OUT of lib/directory.ts (which transitively imports
// node:crypto via lib/share) so the client bundle can import them directly.
// lib/directory.ts re-exports these for the server + unit tests.
import { STATE_ABBR } from "@/lib/options";
import { CITY_COORDS, STATE_CENTROIDS, ZIP1_CENTROIDS, type LatLng } from "@/lib/data/us-geo";

// Derive a child's approximate age. Prefers an explicit birthYear (age =
// currentYear − birthYear, for non-OHS kids). Otherwise maps an OHS grade to a
// typical age: kindergarten≈5 and grade N≈N+5, so 1st≈6 … 12th≈17 (and the
// OHS-specific 7th≈12 … 12th≈17). Returns null when neither is available (e.g.
// the "Not an OHS child" grade with no birthYear). Pure — currentYear is passed
// in so it's testable and deterministic.
export function childAge(
  child: { grade?: string | null; birthYear?: number | null },
  currentYear: number,
): number | null {
  if (typeof child.birthYear === "number" && child.birthYear > 0) {
    const age = currentYear - child.birthYear;
    return age >= 0 ? age : null;
  }
  const grade = child.grade?.trim().toLowerCase();
  if (!grade) return null;
  if (grade.startsWith("k")) return 5; // kindergarten
  const n = parseInt(grade, 10); // "9th" → 9, "12th" → 12
  if (Number.isFinite(n) && n >= 1 && n <= 13) return n + 5;
  return null; // "Not an OHS child" and other non-numeric grades
}

// Great-circle distance in miles between two [lat, lng] points (haversine).
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Approximate a [lat, lng] for a free-text location using ONLY the bundled
// static tables (no network). Accepts "City, State" (state as full name or USPS
// abbr) or a 5-digit ZIP. Resolution order: exact city match → state centroid →
// ZIP first-digit region. Returns null when nothing matches. This is a coarse
// approximation by design (see lib/data/us-geo.ts).
export function geocodeLocation(query: string | null | undefined): LatLng | null {
  const raw = query?.trim();
  if (!raw) return null;

  // A bare 5-digit ZIP (optionally +4) → coarse region centroid (last resort).
  const zip = raw.match(/^(\d{5})(?:-\d{4})?$/);
  if (zip) return ZIP1_CENTROIDS[zip[1][0]] ?? null;

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // Normalize the trailing token to a USPS abbr (accept full name or abbr).
  const last = parts[parts.length - 1];
  const lastUpper = last.toUpperCase();
  let abbr: string | null = null;
  if (lastUpper.length === 2 && STATE_CENTROIDS[lastUpper]) {
    abbr = lastUpper;
  } else {
    // Full state name → abbr, matched case-insensitively so "new york",
    // "NEW YORK", and "District of Columbia" all resolve regardless of casing
    // or lowercase connector words.
    const lastLower = last.toLowerCase();
    const fullKey = Object.keys(STATE_ABBR).find(
      (k) => k.toLowerCase() === lastLower,
    );
    abbr = fullKey ? STATE_ABBR[fullKey] : null;
  }
  if (!abbr) return null;

  // Try an exact "city,ST" match when a city precedes the state.
  if (parts.length >= 2) {
    const city = parts.slice(0, -1).join(",").toLowerCase();
    const hit = CITY_COORDS[`${city},${abbr}`];
    if (hit) return hit;
  }
  // Fall back to the state centroid.
  return STATE_CENTROIDS[abbr] ?? null;
}

// A family matches the age-range filter if ANY of its (shown) children's derived
// ages falls in [lower, upper]. `upper >= ageMax` means "ageMax+" (no upper
// bound). Children with a null age (no birthYear and a non-numeric grade) never
// match, so a family that shared no age-derivable children is excluded while the
// filter is active — by design (the UI surfaces this). Pure + testable.
export function familyMatchesAgeRange(
  childAges: (number | null)[],
  lower: number,
  upper: number,
  ageMax: number,
): boolean {
  const hiBound = upper >= ageMax ? Infinity : upper;
  return childAges.some((a) => a != null && a >= lower && a <= hiBound);
}

// A family matches the radius filter if its coordinate is within `miles` of the
// origin. `miles === Infinity` ("Worldwide") matches everyone, including
// families that couldn't be geocoded. Otherwise a null coordinate (location not
// shared, or ungeocodable) is excluded. Pure + testable.
export function familyWithinRadius(
  coords: LatLng | null,
  origin: LatLng,
  miles: number,
): boolean {
  if (miles === Infinity) return true;
  if (!coords) return false;
  return haversineMiles(origin, coords) <= miles;
}
