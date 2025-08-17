export function appendInvisibleChars(str: string): string {
  const invisibleSeq = '\u2800';
  return invisibleSeq + str;
}
