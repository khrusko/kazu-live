"use client";

import dynamic from "next/dynamic";

const Review = dynamic(() => import("@/components/review-suggestions").then((mod) => mod.ReviewSuggestions), {
  ssr: false,
  loading: () => <p className="p-8 text-sm">Učitavam prijedloge…</p>,
});

export default function ReviewPage() {
  return <Review />;
}
