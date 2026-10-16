import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-[oklch(0.97_0.01_95)] px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pdark text-2xl leading-none text-[oklch(0.34_0.06_168)]">Sizel</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Autobusne linije Karlovačke županije. Neslužbena stranica: nismo povezani s Karlovačkom županijom ni s prijevoznicima.
          </p>
          <a className="mt-2 inline-block text-sm text-primary" href="mailto:info@sizel.eu">
            info@sizel.eu
          </a>
        </div>
        <div className="text-sm sm:text-right">
          <Link href="/privatnost" className="text-primary">
            Politika privatnosti
          </Link>
          <p className="font-pdark mt-2 text-base leading-none">© 2026 Sizel. Sva prava pridržana.</p>
        </div>
      </div>
    </footer>
  );
}
