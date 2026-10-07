const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The UTF-8 bytes of a text, without TextEncoder so the package needs no DOM or Node types. */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000)
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63),
      );
  }
  return bytes;
}

/** Base64 of the UTF-8 form of a text. */
export function toBase64(text: string): string {
  const b = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    out += i + 1 < b.length ? ALPHABET[(n >> 6) & 63]! : '=';
    out += i + 2 < b.length ? ALPHABET[n & 63]! : '=';
  }
  return out;
}

/** The text a base64 string holds, read as UTF-8; invalid bytes become U+FFFD. */
export function fromBase64(data: string): string {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of data) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) continue;
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i]!;
    const len =
      b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0;
    if (len === 0 || i + len > bytes.length) {
      out += '�';
      i++;
      continue;
    }
    let c = len === 1 ? b : b & (0xff >> (len + 1));
    for (let k = 1; k < len; k++) c = (c << 6) | (bytes[i + k]! & 63);
    out += String.fromCodePoint(c);
    i += len;
  }
  return out;
}
