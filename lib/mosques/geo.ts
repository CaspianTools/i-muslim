import { distanceBetween, geohashForLocation, geohashQueryBounds } from "geofire-common";
import type { Mosque } from "@/types/mosque";

export function geohashFor(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]);
}

export function geohashBoundsFor(lat: number, lng: number, radiusKm: number): Array<[string, string]> {
  return geohashQueryBounds([lat, lng], radiusKm * 1000);
}

export function sortByDistance(
  mosques: Mosque[],
  origin: { lat: number; lng: number },
): Mosque[] {
  return [...mosques].sort(
    (a, b) => distanceKm(origin, a.location) - distanceKm(origin, b.location),
  );
}

export function filterWithinRadius(
  mosques: Mosque[],
  origin: { lat: number; lng: number },
  radiusKm: number,
): Mosque[] {
  return mosques.filter((m) => distanceKm(origin, m.location) <= radiusKm);
}

export function parseNearParam(raw: string | undefined): { lat: number; lng: number; radiusKm: number } | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length < 2) return null;
  const [lat, lng, radius] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) return null;
  const radiusKm = Number.isFinite(radius) && radius! > 0 ? Math.min(radius!, 200) : 10;
  return { lat: lat!, lng: lng!, radiusKm };
}

export function formatNearParam(lat: number, lng: number, radiusKm: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)},${radiusKm}`;
}
