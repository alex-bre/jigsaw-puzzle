/**
 * Makes a hard-wrapped plain-text file (a licence, the third-party notices) readable on a phone.
 *
 * Licence files are wrapped at 70–80 columns, which on a narrow screen breaks every line a second
 * time. A line long enough to have been wrapped is joined with the next one, unless the next line
 * starts a new item (indented, a bullet, "1.", "(a)", "a)"). Short lines such as headings,
 * "Copyright …" or "Licence: MIT" stay on their own, and lines of dashes become paragraph breaks.
 */
const WRAPPED = 50;
const NEW_ITEM = /^(\s|[-*•]\s|\d+\.\s|\(?[a-z0-9]{1,3}\)\s)/i;
const RULE = /^\s*[-=_]{10,}\s*$/;

export function reflow(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let joinNext = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (RULE.test(line)) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      joinNext = false;
      continue;
    }
    if (line === '') {
      if (out.length && out[out.length - 1] !== '') out.push('');
      joinNext = false;
      continue;
    }
    if (joinNext && !NEW_ITEM.test(line)) out[out.length - 1] += ` ${line.trim()}`;
    else out.push(line);
    joinNext = line.length >= WRAPPED;
  }
  while (out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
