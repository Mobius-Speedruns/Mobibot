export function getFlag(code: string): string {
  const upper = code.toUpperCase();
  return Array.from(upper)
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
}
