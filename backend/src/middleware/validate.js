import { badRequest } from '../utils/httpError.js'

export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {}
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source] ?? {})
      if (!result.success) {
        const details = result.error.issues.map(issue => ({ field: issue.path.join('.') || source, message: issue.message }))
        return next(badRequest(`Invalid request: ${details[0].field} - ${details[0].message}`, details))
      }
      req.valid[source] = result.data
    }
    next()
  }
}
