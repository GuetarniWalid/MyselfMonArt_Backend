/**
 * Converts a string to a URL/filename-safe slug.
 *
 * The naive approach — `.normalize('NFD').replace(/[̀-ͯ]/g, '')` —
 * does NOT decompose typographic ligatures like Œ, Æ, ß. The result is that
 * `Œuvre` becomes `uvre` (the Œ is silently dropped by the alphanumeric
 * filter that runs afterwards) instead of the expected `oeuvre`. This caused
 * at least one product handle in production to be silently truncated
 * (`uvre-murale-calligraphie-arabe-harmonie-spirituelle` instead of
 * `oeuvre-murale-...`).
 *
 * We pre-translate the known French/Latin ligatures BEFORE normalizing,
 * so the alphanumeric filter never has to deal with them.
 */
export function toSlug(input: string): string {
  return (
    input
      // Translate ligatures and special letters that NFD doesn't decompose.
      .replace(/Œ/g, 'Oe')
      .replace(/œ/g, 'oe')
      .replace(/Æ/g, 'Ae')
      .replace(/æ/g, 'ae')
      .replace(/ß/g, 'ss')
      // Normalize unicode to decompose accented characters (é → e + ́).
      .normalize('NFD')
      // Remove diacritics (combining characters).
      .replace(/[̀-ͯ]/g, '')
      // Lowercase.
      .toLowerCase()
      // Replace spaces, underscores and other separators with hyphens.
      .replace(/[\s_]+/g, '-')
      // Remove any character that's not a-z, 0-9, or hyphen.
      .replace(/[^a-z0-9-]/g, '')
      // Collapse multiple hyphens into one.
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens.
      .replace(/^-+|-+$/g, '')
  )
}
