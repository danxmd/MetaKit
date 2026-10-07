export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const PATTERN =
  /^P(?!$)(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Splits an ISO 8601 duration into days, hours, minutes and seconds. Weeks count as 7 days.
 * Returns null for text that is not a duration, and for durations with years or months, because
 * those have no fixed length and the panel then shows the raw text instead of four boxes.
 */
export function parseDuration(text: string): DurationParts | null {
  const m = PATTERN.exec(text);
  if (m === null) return null;
  const n = (s: string | undefined): number =>
    s === undefined ? 0 : Number(s);
  return {
    days: n(m[1]) * 7 + n(m[2]),
    hours: n(m[3]),
    minutes: n(m[4]),
    seconds: n(m[5]),
  };
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function secondsText(value: number): string {
  const s = Number.isFinite(value) ? Math.max(0, value) : 0;
  const plain = String(s);
  // Very small or large numbers print with an exponent, which ISO 8601 does not allow.
  return plain.includes('e') ? s.toFixed(9).replace(/\.?0+$/, '') : plain;
}

/**
 * The canonical ISO text for the parts, such as `P1DT2H30M`. Parts are not carried over (90
 * minutes stay `PT90M`). Returns null when everything is zero, which means "unset".
 */
export function formatDuration(parts: Partial<DurationParts>): string | null {
  const days = whole(parts.days ?? 0);
  const hours = whole(parts.hours ?? 0);
  const minutes = whole(parts.minutes ?? 0);
  const seconds = secondsText(parts.seconds ?? 0);
  const hasSeconds = Number(seconds) > 0;
  if (days === 0 && hours === 0 && minutes === 0 && !hasSeconds) return null;
  let out = 'P';
  if (days > 0) out += `${days}D`;
  if (hours > 0 || minutes > 0 || hasSeconds) {
    out += 'T';
    if (hours > 0) out += `${hours}H`;
    if (minutes > 0) out += `${minutes}M`;
    if (hasSeconds) out += `${seconds}S`;
  }
  return out;
}
