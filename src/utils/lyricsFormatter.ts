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

  // If text contains escaped HTML tags (&lt;div&gt;, &lt;b&gt;), unescape them so renderer parses them as tags
  if (/&lt;(div|p|br|b|strong|span|i|em)[^&]*&gt;/i.test(str)) {
    str = str
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&');
  }

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

/**
 * Strips all HTML tags and unescapes entities to return clean, readable plain text.
 * Perfect for snippet previews, comparisons, and metadata rows so raw tags are never shown.
 */
export function stripHtml(raw: any): string {
  if (!raw) return '';
  let str = typeof raw === 'string' ? raw : String(raw);

  // If text contains escaped tags, unescape first so we strip them
  if (/&lt;[^&]+&gt;/i.test(str)) {
    str = str
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  return str
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

