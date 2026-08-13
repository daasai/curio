const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'MARK', 'SPAN']);
const ALLOWED_ATTRIBUTES = new Set(['class']);

/**
 * Sanitizes server-authored rich text before it reaches dangerouslySetInnerHTML.
 * Text is preserved, while scripts, event attributes, unsafe URLs and unknown
 * elements are removed rather than trusted because they came from our API.
 */
export function sanitizeStoryHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const visit = (node: Element) => {
    for (const attribute of Array.from(node.attributes)) {
      if (!ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase()) || /^on/i.test(attribute.name) || /javascript:/i.test(attribute.value)) {
        node.removeAttribute(attribute.name);
      }
    }
    for (const child of Array.from(node.children)) visit(child);
    if (!ALLOWED_TAGS.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  };
  for (const child of Array.from(document.body.children)) visit(child);
  return document.body.innerHTML;
}
