import { notFound } from 'next/navigation'

/**
 * Catch-all for unknown URLs with 3+ segments (/a/b/c, /pradesh/foo-1/extra). Without it they fall
 * through to Next's built-in English 404, because the app has two root layouts. Calling notFound()
 * here renders the Hindi (site)/not-found.tsx inside the site layout with a 404 status.
 * More specific routes (/admin, /api, /tag/…, /{category}/page/{n}) and /_next + public files are
 * matched before this one.
 */
export default function CatchAll(): never {
  notFound()
}
