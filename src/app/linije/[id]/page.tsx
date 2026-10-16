import { Suspense } from "react";
import { LineView } from "@/components/line-view";

export default async function LinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Učitavam liniju…</p>}>
      <LineView id={decodeURIComponent(id)} />
    </Suspense>
  );
}
