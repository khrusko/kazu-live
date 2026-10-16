"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORIES, TICKET_TYPES, money } from "@/lib/fares";
import { useKazu } from "@/components/providers";
import { formatWhen } from "@/lib/time";
import type { CategoryId, Ticket } from "@/lib/types";

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, network, favoriteLineIds, toggleLine, loading } = useKazu();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState<CategoryId>("puni");

  useEffect(() => {
    if (user) setCategory(user.category);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/tickets")
      .then((response) => response.json())
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => setTickets([]));
  }, [user]);

  if (loading) return <p className="p-8 text-sm">Učitavam račun…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Račun</h1>
        <p className="mt-2 text-sm text-muted-foreground">Prijavite se da vidite karte i omiljene linije.</p>
        <Button className="mt-4" size="lg" render={<Link href="/prijava?next=/racun" />}>Prijava</Button>
      </div>
    );
  }

  async function saveCategory() {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "Nije spremljeno.");
      return;
    }
    setUser(data.user);
    toast.success("Kategorija je spremljena.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" onClick={logout}>Odjava</Button>
      </div>

      <section className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-medium">Kategorija popusta</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ne zamjenjuje službeni zahtjev za povlaštenu kartu. Na blagajni se i dalje provjerava dokument.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value as CategoryId)}>
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <Button onClick={saveCategory}>Spremi</Button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-medium">Omiljene linije</h2>
        {favoriteLineIds.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Još nema srca na karti. Obavijesti će onda biti opće.</p>}
        <ul className="mt-2 space-y-1">
          {favoriteLineIds.map((id) => {
            const line = network?.lines.find((item) => item.id === id);
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/linije/${id}`}>{line ? `${line.code} ${line.name}` : id}</Link>
                <button type="button" className="text-xs text-muted-foreground" onClick={() => toggleLine(id)}>
                  Makni
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="font-medium">Izdane karte</h2>
        {tickets.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nema karata. <Link href="/karte" className="text-primary">Kupi prvu</Link>.</p>}
        <ul className="mt-2 space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <p className="font-medium">{ticket.originName} → {ticket.destinationName}</p>
              <p className="text-sm text-muted-foreground">
                {ticket.lineCode} · {TICKET_TYPES.find((item) => item.id === ticket.ticketType)?.label} · zona {ticket.zone} · {money(ticket.price)}
              </p>
              <p className="text-xs text-muted-foreground">{formatWhen(ticket.createdAt)} · {ticket.id} · plaćanje uskoro</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
