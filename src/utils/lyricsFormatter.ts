/**
 * Formats lyrics or rehearsal guidelines HTML so that react-native-render-html
 * preserves line breaks, bold headers, and section spacing without tweaking or collapsing lines.
 */
export function formatLyricsHtml(raw: any): string {
  if (!raw) return '';
  let str = typeof raw === 'string' ? raw : JSON.stringify(raw);
  str = str.trim();

  // 1. Unescape escaped tags if text contains &lt;b&gt; etc.
  if (/&lt;(div|p|br|b|strong|span|i|em)[^&]*&gt;/i.test(str)) {
    str = str
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&');
  }

  // 2. Move any whitespace trapped INSIDE <b> or <strong> outside the tag
  // This prevents HTML renderers from collapsing trailing whitespace inside inline elements.
  str = str
    .replace(/<b([^>]*)>([\s\S]*?)<\/b>/gi, (_, attrs, content) => {
      const leading = content.match(/^\s*/)?.[0] || '';
      const trailing = content.match(/\s*$/)?.[0] || '';
      const core = content.trim();
      return core ? `${leading}<b${attrs}>${core}</b>${trailing}` : content;
    })
    .replace(/<strong([^>]*)>([\s\S]*?)<\/strong>/gi, (_, attrs, content) => {
      const leading = content.match(/^\s*/)?.[0] || '';
      const trailing = content.match(/\s*$/)?.[0] || '';
      const core = content.trim();
      return core ? `${leading}<strong${attrs}>${core}</strong>${trailing}` : content;
    });

  // 2.5 Normalize glued section headers and collapse runaway asterisks
  // Use [ \t]* so we never strip blank lines preceding section headers!
  str = str
    .replace(
      /(^|\n)[ \t]*(?:\*\*)?[ \t]*(VERSE\s*\d*|CHORUS\s*\d*(?:\s*\(.*?\))?|BRIDGE|INTRO|OUTRO|VAMP|PRE-CHORUS\s*\d*|REFRAIN|PAN|CODA|\(x\d+\)|Solo:|All:|Duet:|Call:|Resp:)[ \t]*(?:\*\*)?[ \t]*(\*{2,4}|:)[ \t]*([A-Za-z0-9"“'‘])/gi,
      '$1<strong>$2</strong><br>$4'
    )
    .replace(/\*{4,}/g, '**')
    .replace(/(\*\*[^\n*]+\*\*)[ \t]+([A-Za-z0-9])/g, '$1\n$2');

  // 3. Convert markdown bold and italic markers, keeping spaces outside delimiters
  // Restrict bold to single line boundaries so bold never swallows subsequent verses
  str = str
    .replace(/\*\*([^*\n]+?)\*\*/g, (_, p1) => {
      const leading = p1.match(/^\s*/)?.[0] || '';
      const trailing = p1.match(/\s*$/)?.[0] || '';
      const core = p1.trim();
      return core ? `${leading}<strong>${core}</strong>${trailing}` : p1;
    })
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_, p1) => {
      const leading = p1.match(/^\s*/)?.[0] || '';
      const trailing = p1.match(/\s*$/)?.[0] || '';
      const core = p1.trim();
      return core ? `${leading}<strong>${core}</strong>${trailing}` : p1;
    });

  // 4. Guarantee spaces adjacent to bold/strong tags are not collapsed by react-native-render-html
  str = str
    .replace(/<\/b>(\s+)/gi, '</b>&nbsp;')
    .replace(/<\/strong>(\s+)/gi, '</strong>&nbsp;')
    .replace(/(\s+)<b(\s|>)/gi, '&nbsp;<b$2')
    .replace(/(\s+)<strong(\s|>)/gi, '&nbsp;<strong$2');

  // 5. Normalize CRLF to LF
  str = str.replace(/\r\n/g, '\n');

  // 6. Preserve line breaks
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

