/** Letters allowed in `new RegExp(pattern, flags)` across supported engines. */
export const REGEX_FLAG_CHARS = 'dgimsuvy' as const;

export const COMMON_REGEX_FLAGS = [
  { id: 'i', label: 'i', title: 'Ignore case' },
  { id: 'm', label: 'm', title: 'Multiline — ^ and $ match line edges' },
  { id: 's', label: 's', title: 'Dotall — . matches newlines' },
] as const;

export const normalizeRegexFlags = (raw: string): string =>
  [...raw.toLowerCase()]
    .filter((c) => (REGEX_FLAG_CHARS as string).includes(c))
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .join('');

export type CompiledRegex =
  | { ok: true; regex: RegExp; source: string; flags: string; usedDelimiter: boolean }
  | { ok: false; error: string; usedDelimiter: boolean };

/** Delimiter form `/pat/flags` uses only embedded flags; otherwise uses `extraFlags`. */
export const compileRegex = (str: string, extraFlags: string): CompiledRegex => {
  const match = str.match(/^([\/~@;%#'])(.*?)\1([a-z]*)$/i);
  const usedDelimiter = Boolean(match);

  try {
    if (match) {
      const flags = normalizeRegexFlags(match[3] ?? '');
      const source = match[2] ?? '';
      return { ok: true, regex: new RegExp(source, flags), source, flags, usedDelimiter: true };
    }
    const flags = normalizeRegexFlags(extraFlags);
    return { ok: true, regex: new RegExp(str, flags), source: str, flags, usedDelimiter: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, usedDelimiter };
  }
};

export const toggleRegexFlag = (flags: string, flag: string): string => {
  const set = new Set(normalizeRegexFlags(flags));
  if (set.has(flag)) set.delete(flag);
  else set.add(flag);
  return [...set].sort().join('');
};
