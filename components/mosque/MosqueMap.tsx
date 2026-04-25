"use client";

import dynamic from "next/dynamic";

const LeafletMapInner = dynamic(() => import("./LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" aria-hidden />
  ),
});

interface Props {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
  className?: string;
}

export function MosqueMap(props: Props) {
  return <LeafletMapInner {...props} />;
}
