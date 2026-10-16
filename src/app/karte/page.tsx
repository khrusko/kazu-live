import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Karte · Sizel",
};

export default function TicketsPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="font-display text-4xl">Karte</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Kupovina karata nije dostupna na ovoj stranici. Karte se i dalje kupuju na blagajni prijevoznika.
      </p>
      <Link href="/" className="mt-4 inline-block text-primary">
        Natrag na vožnju
      </Link>
    </main>
  );
}
