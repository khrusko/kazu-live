"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const Suggest = dynamic(() => import("@/components/suggest-stop").then((mod) => mod.SuggestStop), {
  ssr: false,
  loading: () => <p className="p-8 text-sm">Učitavam kartu…</p>,
});

export default function SuggestPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<p className="p-8 text-sm">Učitavam kartu…</p>}>
        <Suggest />
      </Suspense>
    </div>
  );
}
