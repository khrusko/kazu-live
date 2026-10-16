export type DayType = "radni" | "subota" | "nedjelja";

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  precision: string;
};

export type RouteStop = {
  stopId: string;
  km: number;
};

export type Trip = {
  id: string;
  day: DayType;
  times: (string | null)[];
};

export type Direction = {
  id: string;
  name: string;
  label: string;
  stops: RouteStop[];
  trips: Trip[];
  geometry: [number, number][];
};

export type Line = {
  id: string;
  code: string;
  name: string;
  group: string;
  color: string;
  validFrom: string | null;
  sourcePdf: string;
  directions: Direction[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  lineIds: string[];
  severity: "info" | "warning" | "change";
  publishedAt: string;
};

export type TicketType = "jednokratna" | "dnevna" | "mjesecna" | "godisnja";

export type CategoryId =
  | "puni"
  | "ucenik"
  | "student"
  | "65"
  | "invaliditet"
  | "nezaposleni"
  | "socijalno"
  | "turist";

export type Ticket = {
  id: string;
  userId: string;
  lineId: string;
  directionId: string;
  originStopId: string;
  destinationStopId: string;
  originName: string;
  destinationName: string;
  lineCode: string;
  km: number;
  zone: string;
  ticketType: TicketType;
  category: CategoryId;
  basePrice: number;
  discountPercent: number;
  price: number;
  status: "izdano";
  createdAt: string;
  payment: "placeholder";
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  category: CategoryId;
  favoriteLineIds: string[];
  favoriteStopIds: string[];
};

export type UserRecord = PublicUser & {
  passwordHash: string;
};

export type Network = {
  version: number;
  updatedAt: string;
  note: string;
  source: string;
  stops: Stop[];
  lines: Line[];
  announcements: Announcement[];
};
