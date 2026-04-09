/**
 * Resolved for browser builds via `package.json#imports` (`#/db` + `browser`
 * condition). Keeps `pg` out of the client graph; real DB is `src/db/index.ts`.
 */
export const db = null as never
