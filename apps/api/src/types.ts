import type { User } from './db/schema'

/**
 * Shape of the authenticated user stored on the Hono context.
 */
export interface AuthUserContext {
  id: string
  authId: string
  email?: string | null
  userRecord?: User
}

/**
 * Shared Hono environment typing used across routes and middleware.
 */
export type AppEnv = {
  Variables: {
    user?: AuthUserContext
    authError?: string
  }
}

