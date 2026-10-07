import {
  checkAttributeValue,
  isIsoDate,
  isIsoDateTime,
  isIsoDuration,
  type AttributeDef,
  type ConnectorId,
  type ElementId,
  type Json,
  type ModelCommand,
} from '@metakit-app/core';

export type ParseResult =
  { ok: true; value: Json } | { ok: false; message: string };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Reads a number the way people type it: spaces are ignored and "1,5" means 1.5. */
export function parseNumberText(text: string): number | null {
  let t = text.trim().replace(/\s+/g, '');
  if (/^[+-]?\d*,\d+$/.test(t)) t = t.replace(',', '.');
  if (!NUMBER.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** `d.m.yyyy` to `yyyy-mm-dd`; ISO dates pass through. Null when it is not a real date. */
export function toIsoDate(text: string): string | null {
  const t = text.trim();
  if (isIsoDate(t)) return t;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m === null) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

function problemsMessage(def: AttributeDef, value: Json): string | null {
  const problems = checkAttributeValue(def, value);
  if (problems.length === 0) return null;
  return `This ${problems.map((p) => p.message).join(' and ')}.`;
}

/**
 * Turns text typed into a field into a value. Empty text gives null, which is how the panel
 * clears a value: core's `setAttribute` accepts any JSON, and `isEmptyValue` treats null as
 * "not set" in validation, so a cleared field behaves like one that was never filled in.
 * Values are checked with `checkAttributeValue`; nothing here repeats those rules.
 */
export function parseInput(attr: AttributeDef, text: string): ParseResult {
  const fail = (message: string): ParseResult => ({ ok: false, message });
  const check = (value: Json): ParseResult => {
    const message = problemsMessage(attr, value);
    return message === null ? { ok: true, value } : fail(message);
  };
  switch (attr.type) {
    case 'text':
      // Spaces inside text are the user's own; only a field with nothing in it is "unset".
      return text === '' ? { ok: true, value: null } : check(text);
    case 'integer':
    case 'number': {
      if (text.trim() === '') return { ok: true, value: null };
      const n = parseNumberText(text);
      if (n === null) return fail(`"${text.trim()}" is not a number.`);
      return check(n);
    }
    case 'date': {
      if (text.trim() === '') return { ok: true, value: null };
      const iso = toIsoDate(text);
      return iso === null
        ? fail(`"${text.trim()}" is not a date. Use the form 2026-10-07.`)
        : check(iso);
    }
    case 'date-time': {
      const t = text.trim().replace(/^(\d{4}-\d{2}-\d{2}) (?=\d)/, '$1T');
      if (t === '') return { ok: true, value: null };
      return isIsoDateTime(t)
        ? check(t)
        : fail(
            `"${text.trim()}" is not a date and time. Use the form 2026-10-07T09:30.`,
          );
    }
    case 'duration': {
      const t = text.trim().toUpperCase();
      if (t === '') return { ok: true, value: null };
      return isIsoDuration(t)
        ? check(t)
        : fail(
            `"${text.trim()}" is not a duration. Use the form PT90M or P1DT2H.`,
          );
    }
    case 'link': {
      const t = text.trim();
      return t === '' ? { ok: true, value: null } : check(t);
    }
    default:
      return fail('This attribute is not edited as text.');
  }
}

/**
 * One `setAttribute` command per target; the caller runs them as one batch so they are one undo
 * step. Formula and action attributes get none, because core refuses to set them. Values equal to
 * the stored one are dropped by core itself.
 */
export function editCommands(
  targets: readonly { id: ElementId | ConnectorId }[],
  attr: AttributeDef,
  value: Json,
): ModelCommand[] {
  if (attr.type === 'formula' || attr.type === 'action') return [];
  return targets.map((t) => ({
    type: 'setAttribute',
    target: t.id,
    attr: attr.id,
    value,
  }));
}
