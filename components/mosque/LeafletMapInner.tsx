"use client";

import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
  className?: string;
}

// Avoids the SSR-incompatible imports at module top-level by lazy-importing inside useEffect.
export default function LeafletMapInner({ lat, lng, label, zoom = 15, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — Leaflet's types don't include this CSS path import
      await import("leaflet/dist/leaflet.css");
      if (!mounted || !containerRef.current) return;
      // Default marker icon paths break with Webpack/Turbopack; use CDN icons.
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41],
      });
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      if (label) marker.bindTooltip(label);
      mapRef.current = map;
      cleanup = () => map.remove();
    })();
    return () => {
      mounted = false;
      if (cleanup) cleanup();
      mapRef.current = null;
    };
  }, [lat, lng, zoom, label]);

  return <div ref={containerRef} className={className ?? "h-[300px] w-full rounded-lg overflow-hidden"} />;
}
