import { z } from 'zod'

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id')
export const idParams = z.object({ id: objectId })

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
