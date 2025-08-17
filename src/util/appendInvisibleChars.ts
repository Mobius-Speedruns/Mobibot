export function appendInvisibleChars(str: string): string {
  const invisibleSeq = '\u200B';
  return str + invisibleSeq;
}
