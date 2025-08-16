export function appendInvisibleChar(str: string): string {
  const invisibleChar = '\u200B'; // Zero-width space
  return str + invisibleChar;
}
