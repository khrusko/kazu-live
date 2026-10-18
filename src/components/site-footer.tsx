import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="shrink-0 border-t bg-background px-3 py-1 text-[11px] leading-tight text-muted-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p>Autobusne linije Karlovačke županije. Neslužbena stranica, nepovezana s Karlovačkom županijom.</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <a className="text-primary" href="mailto:info@sizel.eu">
            info@sizel.eu
          </a>
          <Link href="/prijedlog" className="text-primary">
            Prijedlog stajališta
          </Link>
          <Link href="/privatnost" className="text-primary">
            Privatnost
          </Link>
          <span>2026 Sizel. j.d.o.o Sva prava pridržana.</span>
        </p>
      </div>
    </footer>
  );
}
