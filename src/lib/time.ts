import type { DayType } from "./types";

export const DAY_LABEL: Record<DayType, string> = {
  radni: "Radni dan",
  subota: "Subota",
  nedjelja: "Nedjelja i blagdan",
};

export function zagrebParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zagreb",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekday = parts.weekday;
  const day: DayType = weekday === "Sat" ? "subota" : weekday === "Sun" ? "nedjelja" : "radni";
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    day,
    minutes: hour * 60 + minute,
    clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    dateLabel: `${parts.day}.${parts.month}.`,
  };
}

export function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function showTime(value: string): string {
  return value.replace(/^0(\d)/, "$1");
}

export function formatWait(delta: number): string {
  if (delta <= 0) return "sada";
  if (delta < 60) return `za ${delta} min`;
  const hours = Math.floor(delta / 60);
  const minutes = delta % 60;
  return minutes ? `za ${hours} h ${minutes} min` : `za ${hours} h`;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
