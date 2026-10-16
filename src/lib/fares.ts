import type { CategoryId, TicketType } from "./types";

export type Zone = {
  id: string;
  to: number;
  single: number;
  daily: number;
  monthly: number;
  yearly: number;
};

/** Službeni cjenik KaŽu IDE BUS, kazup.hr — cijene karata. */
export const ZONES: Zone[] = [
  { id: "I", to: 5, single: 1, daily: 1.5, monthly: 40, yearly: 384 },
  { id: "II", to: 10, single: 1.5, daily: 2.5, monthly: 60, yearly: 576 },
  { id: "III", to: 15, single: 2, daily: 3.5, monthly: 80, yearly: 768 },
  { id: "IV", to: 20, single: 2.5, daily: 4.5, monthly: 90, yearly: 864 },
  { id: "V", to: 25, single: 3, daily: 5, monthly: 100, yearly: 960 },
  { id: "VI", to: 30, single: 3.5, daily: 5.5, monthly: 110, yearly: 1056 },
  { id: "VII", to: 35, single: 4, daily: 6, monthly: 115, yearly: 1152 },
  { id: "VIII", to: 55, single: 5.5, daily: 6.5, monthly: 136, yearly: 1536 },
  { id: "IX", to: 75, single: 6.5, daily: 8, monthly: 170, yearly: 1970 },
];

export const TICKET_TYPES: { id: TicketType; label: string; hint: string }[] = [
  { id: "jednokratna", label: "Jednokratna", hint: "Jedna vožnja. Subvencija se ne primjenjuje." },
  { id: "dnevna", label: "Dnevna", hint: "Vožnje tog dana u zoni. Turist ima pravo na 3 besplatne." },
  { id: "mjesecna", label: "Mjesečna", hint: "Subvencija vrijedi za ovu kartu." },
  { id: "godisnja", label: "Godišnja", hint: "Subvencija vrijedi za ovu kartu." },
];

export const CATEGORIES: {
  id: CategoryId;
  label: string;
  percent: number;
  pass: boolean;
}[] = [
  { id: "puni", label: "Bez popusta", percent: 0, pass: false },
  { id: "ucenik", label: "Učenici", percent: 100, pass: true },
  { id: "student", label: "Studenti", percent: 50, pass: true },
  { id: "65", label: "Osobe starije od 65 godina", percent: 100, pass: true },
  { id: "invaliditet", label: "Osobe s invaliditetom", percent: 100, pass: true },
  { id: "nezaposleni", label: "Nezaposlene osobe", percent: 30, pass: true },
  { id: "socijalno", label: "Socijalno ugrožene osobe", percent: 50, pass: true },
  { id: "turist", label: "Turisti s boravkom (eVisitor)", percent: 100, pass: false },
];

export function zoneForKm(km: number): { zone: Zone; overMax: boolean } {
  const safe = Math.max(km, 0.1);
  const zone = ZONES.find((item) => safe <= item.to) ?? ZONES[ZONES.length - 1];
  return { zone, overMax: km > 75 };
}

export function basePrice(zone: Zone, type: TicketType): number {
  if (type === "jednokratna") return zone.single;
  if (type === "dnevna") return zone.daily;
  if (type === "mjesecna") return zone.monthly;
  return zone.yearly;
}

export function money(value: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function quoteFare(input: {
  km: number;
  ticketType: TicketType;
  category: CategoryId;
  touristDailyUsed: number;
}) {
  const { zone, overMax } = zoneForKm(input.km);
  const base = basePrice(zone, input.ticketType);
  const category = CATEGORIES.find((item) => item.id === input.category) ?? CATEGORIES[0];
  let percent = 0;
  let note = "Puna cijena za odabranu zonu.";

  if (input.ticketType === "mjesecna" || input.ticketType === "godisnja") {
    if (category.pass && category.percent > 0) {
      percent = category.percent;
      note =
        percent === 100
          ? "Karta je u cijelosti subvencionirana."
          : `Subvencija ${percent}% na ${input.ticketType === "mjesecna" ? "mjesečnu" : "godišnju"} kartu.`;
    } else if (input.category === "turist") {
      note = "Turistička povlastica vrijedi za dnevnu kartu, ne za mjesečnu ili godišnju.";
    } else {
      note = "Bez subvencije. Odabrana je puna cijena.";
    }
  } else if (input.ticketType === "dnevna" && input.category === "turist") {
    if (input.touristDailyUsed >= 3) {
      percent = 0;
      note = "Tri besplatne dnevne karte za ovaj boravak su već iskorištene.";
    } else {
      percent = 100;
      note = `Besplatna dnevna karta ${input.touristDailyUsed + 1} od 3.`;
    }
  } else if (input.ticketType === "jednokratna" && category.percent > 0) {
    note = "Subvencija se ne obračunava na jednokratnu kartu. Vrijedi za mjesečne i godišnje.";
  } else if (input.ticketType === "dnevna" && category.percent > 0 && input.category !== "turist") {
    note = "Subvencija se ne obračunava na dnevnu kartu, osim za turiste (3 dnevne).";
  }

  const price = Math.round(base * (1 - percent / 100) * 100) / 100;
  return { zone, overMax, base, percent, price, note, category };
}

export type SalesPoint = {
  id: string;
  place: string;
  address: string;
  hours: string;
  lat: number;
  lng: number;
};

export const SALES_POINTS: SalesPoint[] = [
  {
    id: "at-karlovac",
    place: "Karlovac · Autotransport",
    address: "Prilaz Većeslava Holjevca 2",
    hours: "Radnim danom 5:30–15:30. Prva subota u mjesecu 7:00–12:00.",
    lat: 45.488406,
    lng: 15.550189,
  },
  {
    id: "arriva-karlovac",
    place: "Karlovac · Arriva",
    address: "Prilaz Većeslava Holjevca 2",
    hours: "Radnim danom 5:30–21:00. Kartomat za jednokratne i dnevne karte radi 0–24.",
    lat: 45.48815230992074,
    lng: 15.55044368257112,
  },
  {
    id: "ogulin",
    place: "Ogulin",
    address: "Trg dr. Franje Tuđmana 2",
    hours: "Radnim danom 7:00–15:00. Kartomat radi 0–24.",
    lat: 45.265846,
    lng: 15.230807,
  },
  {
    id: "slunj",
    place: "Slunj",
    address: "Trg dr. Franje Tuđmana 1a",
    hours: "Radnim danom 6:00–14:00.",
    lat: 45.114747,
    lng: 15.585741,
  },
];
