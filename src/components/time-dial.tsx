"use client";

import { useState } from "react";

const SIZE = 260;
const CENTER = SIZE / 2;
const OUTER = 98;
const INNER = 64;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function spot(step: number, radius: number) {
  const angle = (step / 12) * Math.PI * 2 - Math.PI / 2;
  return {
    left: CENTER + Math.cos(angle) * radius,
    top: CENTER + Math.sin(angle) * radius,
  };
}

function nearestFive(minute: number) {
  const steps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  return steps.reduce((best, item) => (Math.abs(item - minute) < Math.abs(best - minute) ? item : best), 0);
}

function ClockHand({ step, radius }: { step: number; radius: number }) {
  const end = spot(step, radius - 18);
  return (
    <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <line x1={CENTER} y1={CENTER} x2={end.left} y2={end.top} stroke="#0b57d0" strokeWidth="2" />
      <circle cx={CENTER} cy={CENTER} r="4" fill="#0b57d0" />
    </svg>
  );
}

function FaceNumber({
  label,
  step,
  radius,
  selected,
  onPick,
}: {
  label: string;
  step: number;
  radius: number;
  selected: boolean;
  onPick: () => void;
}) {
  const point = spot(step, radius);
  return (
    <button
      type="button"
      className={`absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm ${
        selected ? "bg-[#0b57d0] font-medium text-white" : "text-[#1f1f1f]"
      }`}
      style={{ left: point.left, top: point.top }}
      onClick={onPick}
    >
      {label}
    </button>
  );
}

export function TimeDial({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [mode, setMode] = useState<"hour" | "minute">("hour");

  function openDial() {
    const [rawHour, rawMinute] = value.split(":").map(Number);
    setHour(Number.isFinite(rawHour) ? rawHour % 24 : 0);
    setMinute(nearestFive(Number.isFinite(rawMinute) ? rawMinute : 0));
    setMode("hour");
    setOpen(true);
  }

  const hourStep = hour === 0 || hour === 12 ? 0 : hour > 12 ? hour - 12 : hour;
  const hourRadius = hour === 0 || hour > 12 ? INNER : OUTER;

  return (
    <>
      <button
        type="button"
        className="h-10 rounded-xl border bg-card px-3 text-base tabular-nums"
        onClick={openDial}
        aria-haspopup="dialog"
      >
        {value.slice(0, 5)}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Vrijeme polaska"
            className="w-[min(100%,20rem)] rounded-3xl bg-white p-4 text-[#1f1f1f] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs tracking-wide text-[#444746]">Vrijeme polaska</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                className={`grid h-16 w-[4.5rem] place-items-center rounded-xl font-display text-5xl ${
                  mode === "hour" ? "bg-[#d3e3fd] text-[#0b57d0]" : "bg-[#e8eaed] text-[#1f1f1f]"
                }`}
                onClick={() => setMode("hour")}
              >
                {pad(hour)}
              </button>
              <span className="font-display text-5xl text-[#1f1f1f]">:</span>
              <button
                type="button"
                className={`grid h-16 w-[4.5rem] place-items-center rounded-xl font-display text-5xl ${
                  mode === "minute" ? "bg-[#d3e3fd] text-[#0b57d0]" : "bg-[#e8eaed] text-[#1f1f1f]"
                }`}
                onClick={() => setMode("minute")}
              >
                {pad(minute)}
              </button>
            </div>
            <div className="relative mx-auto mt-4 rounded-full bg-[#e8eaed]" style={{ width: SIZE, height: SIZE }}>
              {mode === "hour" ? (
                <>
                  <ClockHand step={hourStep} radius={hourRadius} />
                  {Array.from({ length: 12 }, (_, index) => {
                    const valueHour = index === 0 ? 12 : index;
                    return (
                      <FaceNumber
                        key={valueHour}
                        label={String(valueHour)}
                        step={index}
                        radius={OUTER}
                        selected={hour === valueHour}
                        onPick={() => {
                          setHour(valueHour);
                          setMode("minute");
                        }}
                      />
                    );
                  })}
                  <FaceNumber
                    label="00"
                    step={0}
                    radius={INNER}
                    selected={hour === 0}
                    onPick={() => {
                      setHour(0);
                      setMode("minute");
                    }}
                  />
                  {Array.from({ length: 11 }, (_, index) => {
                    const valueHour = 13 + index;
                    return (
                      <FaceNumber
                        key={valueHour}
                        label={String(valueHour)}
                        step={index + 1}
                        radius={INNER}
                        selected={hour === valueHour}
                        onPick={() => {
                          setHour(valueHour);
                          setMode("minute");
                        }}
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  <ClockHand step={minute / 5} radius={OUTER} />
                  {Array.from({ length: 12 }, (_, index) => {
                    const valueMinute = index * 5;
                    return (
                      <FaceNumber
                        key={valueMinute}
                        label={pad(valueMinute)}
                        step={index}
                        radius={OUTER}
                        selected={minute === valueMinute}
                        onPick={() => setMinute(valueMinute)}
                      />
                    );
                  })}
                </>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded-full px-3 py-2 text-sm text-[#0b57d0]" onClick={() => setOpen(false)}>
                Odustani
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-2 text-sm font-medium text-[#0b57d0]"
                onClick={() => {
                  onChange(`${pad(hour)}:${pad(minute)}`);
                  setOpen(false);
                }}
              >
                U redu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
