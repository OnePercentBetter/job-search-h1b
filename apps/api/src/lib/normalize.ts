/**
 * Normalizes company names so we can perform consistent lookups.
 */
export function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
