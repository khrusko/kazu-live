"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useKazu } from "@/components/providers";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useKazu();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prijava nije uspjela.");
      setUser(data.user);
      toast.success(`Bok, ${data.user.name.split(" ")[0]}.`);
      router.push(params.get("next") || (data.user.role === "admin" ? "/admin" : "/racun"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="font-display text-4xl">Prijava</h1>
      <p className="mt-2 text-sm text-muted-foreground">Račun treba za karte, favorite na svim uređajima i dispečerski unos.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" className="mt-1 h-9" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Lozinka</Label>
          <Input id="password" type="password" className="mt-1 h-9" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? "Prijavljujem…" : "Prijavi se"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Nemaš račun? <Link href="/registracija" className="text-primary">Registracija</Link>
      </p>
      <div className="mt-6 rounded-2xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <p>Dispečer: admin@kazide.hr / KazuAdmin2026</p>
        <p>Putnik: ana@kazide.hr / Putnik2026</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
