"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/fares";
import { useKazu } from "@/components/providers";
import type { CategoryId } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useKazu();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState<CategoryId>("puni");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registracija nije uspjela.");
      setUser(data.user);
      toast.success("Račun je otvoren.");
      router.push("/racun");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="font-display text-4xl">Registracija</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kategorija popusta ovdje je samo podsjetnik. Pravo na subvenciju i dalje se dokazuje na blagajni ili kroz službeni zahtjev.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <Label htmlFor="name">Ime i prezime</Label>
          <Input id="name" className="mt-1 h-9" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" className="mt-1 h-9" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Lozinka</Label>
          <Input id="password" type="password" className="mt-1 h-9" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </div>
        <div>
          <Label htmlFor="category">Kategorija</Label>
          <select
            id="category"
            className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryId)}
          >
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? "Otvaram račun…" : "Otvori račun"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Već imaš račun? <Link href="/prijava" className="text-primary">Prijava</Link>
      </p>
    </div>
  );
}
