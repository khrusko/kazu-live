import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politika privatnosti · Sizel",
  description: "Kako Sizel obrađuje podatke na neslužbenoj stranici autobusnih linija Karlovačke županije.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="text-sm text-muted-foreground">Zadnje ažuriranje: 16. listopada 2026.</p>
      <h1 className="font-display mt-1 text-4xl">Politika privatnosti</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ovo je neslužbena stranica tvrtke Sizel o autobusnim linijama Karlovačke županije. Nismo povezani s Karlovačkom županijom, Autotransportom, Arrivom ni drugim prijevoznikom. Vozni red je prepisan iz javno objavljenih rasporeda i može odstupati od prometa na cesti.
      </p>

      <h2 className="mt-8 text-xl font-medium">1. Voditelj obrade</h2>
      <p className="mt-2 text-sm">
        Voditelj obrade osobnih podataka je Sizel (u daljnjem tekstu: „mi”). Za pitanja o zaštiti podataka javite se na{" "}
        <a className="text-primary" href="mailto:info@sizel.eu">info@sizel.eu</a>.
      </p>

      <h2 className="mt-8 text-xl font-medium">2. Koje podatke obrađujemo</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
        <li>Račun, ako ga otvorite: ime, e-mail, hash lozinke i omiljene linije. Pravna osnova je privola i izvršenje zahtjeva da stranica pamti vaš profil.</li>
        <li>Lokaciju uređaja čitamo samo u vašem pregledniku da predložimo najbliže stajalište. Tu koordinatu ne šaljemo na naš poslužitelj.</li>
        <li>Nužni kolačić sesije ako ste prijavljeni, te lokalnu pohranu za privolu o kolačićima, omiljene linije i viđene obavijesti.</li>
      </ul>
      <p className="mt-2 text-sm">Ne prodajemo podatke i ne koristimo ih za oglašavanje.</p>

      <h2 className="mt-8 text-xl font-medium">3. Kolačići</h2>
      <p className="mt-2 text-sm">
        Stranica radi i ako prihvatite samo nužne kolačiće. Sesija prijave drži vas ulogiranima. Odabir o kolačićima pamtimo lokalno da vam se traka ne prikazuje pri svakom otvaranju. Analitičke kolačiće na ovoj stranici ne postavljamo.
      </p>

      <h2 className="mt-8 text-xl font-medium">4. Dijeljenje s trećim stranama</h2>
      <p className="mt-2 text-sm">
        Pločice karte dolaze s OpenStreetMapa, a satelitski prikaz s Esri World Imagery. Ti poslužitelji vide IP adresu u trenutku učitavanja karte. Osim toga podatke s računa ne prosljeđujemo trećima u marketinške svrhe.
      </p>

      <h2 className="mt-8 text-xl font-medium">5. Pohrana</h2>
      <p className="mt-2 text-sm">
        Podatke računa držimo dok račun postoji ili dok ne zatražite brisanje. Na hostingu bez trajnog diska račun se može izgubiti pri novom pokretanju poslužitelja. Kolačić sesije traje do 14 dana.
      </p>

      <h2 className="mt-8 text-xl font-medium">6. Vaša prava</h2>
      <p className="mt-2 text-sm">Sukladno Općoj uredbi o zaštiti podataka (GDPR) imate pravo na:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>pristup podacima koje imamo o vama</li>
        <li>ispravak netočnih podataka</li>
        <li>brisanje</li>
        <li>ograničenje obrade</li>
        <li>prigovor</li>
        <li>prenosivost</li>
      </ul>
      <p className="mt-2 text-sm">
        Za ostvarivanje prava pišite na <a className="text-primary" href="mailto:info@sizel.eu">info@sizel.eu</a>.
      </p>

      <h2 className="mt-8 text-xl font-medium">7. Nadzorno tijelo</h2>
      <p className="mt-2 text-sm">
        Ako smatrate da obrada nije u skladu s propisima, možete se obratiti Agenciji za zaštitu osobnih podataka (AZOP), Ulica Metela Ožegovića 16, HR – 10 000 Zagreb, telefon +385 1 4609-000, e-mail azop@azop.hr.
      </p>

      <p className="mt-8 text-sm">
        <Link href="/" className="text-primary">Natrag na vožnju</Link>
      </p>
    </main>
  );
}
