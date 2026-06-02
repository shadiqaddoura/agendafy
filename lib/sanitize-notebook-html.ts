import sanitizeHtml from 'sanitize-html'

const EMPTY_HTML = '<p><br></p>'

export function sanitizeNotebookHtml(value: unknown): string {
  const raw = typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
  const cleaned = sanitizeHtml(raw, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a'],
    allowedAttributes: {
      a: ['href'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
  }).trim()

  return cleaned || EMPTY_HTML
}
