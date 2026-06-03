/**
 * A basic, robust, zero-dependency Markdown-to-HTML converter for Blog Posts.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    // Escape simple HTML characters to prevent XSS (can be enhanced)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (H1-H6)
  html = html.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Images: ![alt](url)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="img-fluid my-3" />');

  // Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Inline Code: `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote class="blockquote border-left pl-3 text-muted">$1</blockquote>');

  // Lists: Unordered and Ordered
  // We process line by line for bullet points
  const lines = html.split('\n');
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Unordered List (- or *)
    if (/^[\-*]\s+(.*)$/.test(line)) {
      if (inOl) {
        lines[i - 1] += '\n</ol>';
        inOl = false;
      }
      const match = line.match(/^[\-*]\s+(.*)$/);
      const content = match ? match[1] : '';
      if (!inUl) {
        lines[i] = '<ul>\n  <li>' + content + '</li>';
        inUl = true;
      } else {
        lines[i] = '  <li>' + content + '</li>';
      }
    }
    // Ordered List (1., 2., etc.)
    else if (/^\d+\.\s+(.*)$/.test(line)) {
      if (inUl) {
        lines[i - 1] += '\n</ul>';
        inUl = false;
      }
      const match = line.match(/^\d+\.\s+(.*)$/);
      const content = match ? match[1] : '';
      if (!inOl) {
        lines[i] = '<ol>\n  <li>' + content + '</li>';
        inOl = true;
      } else {
        lines[i] = '  <li>' + content + '</li>';
      }
    }
    // Plain paragraphs or structural tags
    else {
      if (inUl) {
        lines[i - 1] += '\n</ul>';
        inUl = false;
      }
      if (inOl) {
        lines[i - 1] += '\n</ol>';
        inOl = false;
      }
      // Wrap non-empty lines that aren't already wrapped in block elements with <p>
      if (line.length > 0 && !line.startsWith('<h') && !line.startsWith('<blockquote') && !line.startsWith('<img') && !line.startsWith('<ul') && !line.startsWith('<ol')) {
        lines[i] = '<p>' + line + '</p>';
      }
    }
  }

  // Close lists at end of file if open
  if (inUl) {
    lines[lines.length - 1] += '\n</ul>';
  }
  if (inOl) {
    lines[lines.length - 1] += '\n</ol>';
  }

  return lines.join('\n').replace(/\n\n+/g, '\n');
}
