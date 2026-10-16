"use client";

import { useParams } from "next/navigation";
import { LineView } from "@/components/line-view";

export default function LinePage() {
  const params = useParams<{ id: string }>();
  return <LineView id={decodeURIComponent(params.id)} />;
}
