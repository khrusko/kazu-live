# KaŽu Live

Karta, vozni red i priprema online karata za županijske autobuse **KaŽu IDE BUS** u Karlovačkoj županiji.

Službeni rasporedi su i dalje PDF-ovi na [kazup.hr](https://www.kazup.hr/index.php/kazu-ide-bus-vozni-red). Ova aplikacija ih pretvara u kartu: stajališta, iscrtane rute, polasci po danu, obavijesti i administratorski unos koji putnici vide odmah.

## Što radi

- Karta svih 33 linija (A1–A12, B1–B9, B4/5, C1–C3, D1–D4, E1–E4).
- Klik na stajalište otvara sljedeće polaske za današnji dan.
- Autobusi na karti kreću se **prema voznom redu**. To nije GPS. Kad vozila dobiju uređaje, isti sloj može primati stvarne koordinate.
- Obavijesti. Srce na liniji ili stajalištu filtrira zvonce. Bez prijave favorit ostaje u pregledniku, s računom ide na profil.
- Kupnja karte: polazište, odredište, zona po kilometrima, odabir popusta, pa konačna cijena. Online naplata je rezervacija, bez stvarnog plaćanja.
- Admin mijenja polaske i objavljuje obavijest. Karta se osvježava svakih 12 sekundi.

Koordinate stajališta su procijenjene prema nazivu naselja (OpenStreetMap) i kilometraži iz PDF-a. Nisu službeni GPS stupova.

Cjenik i subvencije preuzeti su sa [stranice cijena](https://www.kazup.hr/index.php/kazu-ide-bus-cijene-karata): jednokratna, dnevna, mjesečna i godišnja karta, zone I–IX. Subvencija vrijedi za mjesečne i godišnje karte. Turist s eVisitor boravkom ima tri dnevne karte.

## Pokretanje

```bash
npm install
npm run dev
```

Aplikacija sluša na [http://127.0.0.1:3847](http://127.0.0.1:3847).

## Demo računi

| Uloga | E-mail | Lozinka |
| --- | --- | --- |
| Administrator | admin@kazide.hr | KazuAdmin2026 |
| Putnik | ana@kazide.hr | Putnik2026 |

Ana već prati linije A1 i A3.

Podaci žive u `data/network.json` (početni uvoz) i `data/store.json` (izmjene, računi, karte). `store.json` nastaje pri prvom pokretanju i nije u gitu.

## Napomena o izvoru

Polasci su pročitani iz PDF voznih redova objavljenih na kazup.hr (rujan i listopad 2026., linije A7 i A8 iz datoteka od 7. listopada, D3 s oznakom vrijedi od 12. listopada). Županija je najavila izmjene od 12. listopada i za A1, A3, B2, B3, C1, D2 i D3; ako novi PDF nije bio zakačen na stranicu, u aplikaciji je zadnji objavljeni raspored, a obavijest to kaže. Administrator ga može prepisati u adminu.
