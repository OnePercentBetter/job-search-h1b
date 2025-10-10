import jwt from 'jsonwebtoken'

export interface SupabaseJwtPayload extends jwt.JwtPayload {
  sub: string
  email?: string
  exp?: number
  iat?: number
}

function getJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is required for authentication')
  }
  return secret
}

/**
 * Extracts the bearer token from an Authorization header.
 */
export function extractBearerToken(header?: string | null) {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) {
    return null
  }
  return value.trim()
}

/**
 * Verifies a Supabase JWT access token and returns its payload.
 */
export function verifySupabaseAccessToken(token: string): SupabaseJwtPayload {
  const secret = getJwtSecret()
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  })
  if (typeof payload === 'string') {
    throw new Error('Unexpected JWT payload')
  }
  if (!payload.sub) {
    throw new Error('JWT payload missing sub claim')
  }
  return payload as SupabaseJwtPayload
}
