// Strips MongoDB operator keys such as $gt or dotted paths from user input.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('$') && !key.includes('.')).map(([key, item]) => [key, clean(item)]))
  }
  return value
}

export function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body)
  Object.defineProperty(req, 'query', { value: clean(req.query), writable: true, configurable: true, enumerable: true })
  next()
}
