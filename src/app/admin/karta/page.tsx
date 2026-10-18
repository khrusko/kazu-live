"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/admin-road-editor").then((mod) => mod.AdminRoadEditor), {
  ssr: false,
  loading: () => <p className="p-8 text-sm">Učitavam kartu…</p>,
});

export default function AdminMapPage() {
  return (
    <div className="h-full">
      <Editor />
    </div>
  );
}
