"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKazu } from "@/components/providers";
import { formatWhen } from "@/lib/time";

export default function AdminNewsPage() {
  const { user, network, loading, refresh } = useKazu();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rows, setRows] = useState<{ lineId: string; severity: "info" | "warning" | "change" }[]>([
    { lineId: "", severity: "info" },
  ]);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="p-8 text-sm">Učitavam…</p>;
  if (!user || user.role !== "admin") return <p className="p-8 text-sm">Samo administrator.</p>;

  async function publish() {
    setBusy(true);
    try {
      const groups = new Map<"info" | "warning" | "change", string[]>();
      for (const row of rows) {
        const list = groups.get(row.severity) ?? [];
        list.push(row.lineId);
        groups.set(row.severity, list);
      }
      for (const [severity, lineIds] of groups) {
        const all = lineIds.some((id) => id === "");
        const response = await fetch("/api/admin/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body,
            severity,
            lineIds: all ? [] : [...new Set(lineIds.filter(Boolean))],
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Obavijest nije objavljena.");
      }
      setTitle("");
      setBody("");
      setRows([{ lineId: "", severity: "info" }]);
      await refresh();
      toast.success("Obavijest je vidljiva putnicima.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">Obavijest</h1>
      <div className="mt-4 space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Naslov" className="h-9" />
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Što se mijenja i od kada" rows={4} />
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <select
                className="h-9 min-w-48 flex-1 rounded-lg border bg-background px-2 text-sm"
                value={row.lineId}
                onChange={(event) =>
                  setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, lineId: event.target.value } : item)))
                }
              >
                <option value="">Sve linije</option>
                {(network?.lines ?? []).map((line) => (
                  <option key={line.id} value={line.id} disabled={rows.some((item, itemIndex) => itemIndex !== index && item.lineId === line.id)}>
                    {line.code} {line.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-lg border bg-background px-2 text-sm"
                value={row.severity}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, severity: event.target.value as typeof row.severity } : item,
                    ),
                  )
                }
              >
                <option value="info">Informacija</option>
                <option value="change">Izmjena reda</option>
                <option value="warning">Upozorenje</option>
              </select>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="h-9 rounded-lg px-2 text-sm text-muted-foreground"
                  onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Ukloni
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full bg-muted text-lg"
          aria-label="Dodaj liniju"
          onClick={() => setRows((current) => [...current, { lineId: "", severity: current[current.length - 1]?.severity ?? "info" }])}
        >
          +
        </button>
        <Button disabled={busy} onClick={publish}>{busy ? "Objavljujem…" : "Objavi"}</Button>
      </div>
      <ul className="mt-6 space-y-2">
        {(network?.announcements ?? []).map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-muted px-3 py-3">
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{formatWhen(item.publishedAt)}</p>
            </div>
            <button type="button" className="text-xs text-destructive" onClick={() => remove(item.id)}>
              Obriši
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
