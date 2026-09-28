import { CERTIFICATION_DOMAINS } from './scenarios.js'

// Short, URL-safe slugs for each certification domain, in the same order
// as CERTIFICATION_DOMAINS (and the backend's DOMAINS list).
const SLUGS = [
  'fire-explosion',
  'gas-confined-space',
  'machinery-loto',
  'electrical-hazard',
  'dust-respiratory',
]

export const ASSESSMENT_DOMAINS = CERTIFICATION_DOMAINS.map((domain, i) => ({
  domain,
  slug: SLUGS[i],
}))

export function domainForSlug(slug) {
  return ASSESSMENT_DOMAINS.find((d) => d.slug === slug)?.domain || null
}

export function slugForDomain(domain) {
  return ASSESSMENT_DOMAINS.find((d) => d.domain === domain)?.slug || null
}
