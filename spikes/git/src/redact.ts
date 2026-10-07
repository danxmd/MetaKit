/**
 * Tokens are typed in at runtime and live only in memory. Everything that is logged or shown
 * goes through here first, so a token cannot leak into the page, the console or a test report.
 */
export class Redactor {
  private readonly secrets = new Set<string>();

  add(secret: string): void {
    // Very short values would mask ordinary words.
    if (secret.length >= 6) this.secrets.add(secret);
  }

  clean(text: string): string {
    let out = text;
    for (const secret of this.secrets)
      out = out.split(secret).join('[token hidden]');
    // Common token shapes, in case a different token appears in an error body.
    return out
      .replace(/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, '[token hidden]')
      .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[token hidden]')
      .replace(/\bglpat-[A-Za-z0-9_-]{16,}\b/g, '[token hidden]');
  }
}
