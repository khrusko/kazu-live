"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const KEY = "sizel-cookie";

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOpen(localStorage.getItem(KEY) == null);
  }, []);

  if (!mounted || !open) return null;

  function choose(value: "accepted" | "necessary") {
    localStorage.setItem(KEY, value);
    setOpen(false);
  }

  return createPortal(
    <div
      className="sizel-cookie fixed inset-x-0 bottom-11 p-3"
      onWheel={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-card p-4 shadow-xl ring-1 ring-foreground/10 sm:flex-row sm:items-end">
        <p className="text-sm text-muted-foreground">
          Nužni kolačići pamte prijavu i ovaj odabir. Lokacija ostaje u pregledniku i služi za najbliže stajalište. Karta se učitava s OpenStreetMapa, a satelitski prikaz s Geoportala DGU.{" "}
          <Link href="/privatnost" className="text-primary">
            Politika privatnosti
          </Link>
          .
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" className="flex-1 rounded-full bg-muted px-3 py-2 text-sm whitespace-nowrap sm:flex-none" onClick={() => choose("necessary")}>
            Samo nužni
          </button>
          <button type="button" className="flex-1 rounded-full bg-primary px-3 py-2 text-sm whitespace-nowrap text-primary-foreground sm:flex-none" onClick={() => choose("accepted")}>
            U redu
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
