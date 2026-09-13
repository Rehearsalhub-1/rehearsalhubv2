/**
 * Formats lyrics or rehearsal guidelines HTML so that react-native-render-html
 * preserves line breaks, bold headers, and section spacing without tweaking or collapsing lines.
 */
export function formatLyricsHtml(raw: any): string {
  if (!raw) return '';
  let str = typeof raw === 'string' ? raw : JSON.stringify(raw);
  str = str.trim();

  // 1. Decode &nbsp; entities to clean whitespace
  str = str.replace(/&nbsp;/gi, ' ');

  // 2. Convert markdown bold and italic markers
  str = str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>');

  // 3. Normalize CRLF to LF
  str = str.replace(/\r\n/g, '\n');

  // 4. Preserve line breaks
  if (/<(div|p|br|strong|b)[^>]*>/i.test(str)) {
    // Has HTML structure: preserve HTML and turn any loose raw newlines into <br>
    str = str
      .replace(/(<\/div>|<\/p>|<br\s*\/?>)\s*\n/gi, '$1')
      .replace(/\n\s*(<div|<p)/gi, '$1')
      .replace(/\n/g, '<br>');
  } else {
    // Pure plain text: replace double newlines with paragraph break and single with <br>
    str = str
      .replace(/\n\s*\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  return str;
}
