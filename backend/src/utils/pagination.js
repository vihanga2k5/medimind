import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}

export function pageWindow({ page, limit }) {
  return { skip: (page - 1) * limit, limit }
}

export function paginated(data, total, { page, limit }) {
  return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}

export function sortFrom(value, allowed, fallback) {
  const field = (value || fallback).replace(/^-/, '')
  if (!allowed.includes(field)) return sortFrom(fallback, allowed, fallback)
  return { [field]: (value || fallback).startsWith('-') ? -1 : 1, _id: 1 }
}
