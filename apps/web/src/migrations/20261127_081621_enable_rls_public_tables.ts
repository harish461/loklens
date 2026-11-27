import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Turns on Row Level Security for every table in the public schema that the app's database role owns.
 *
 * Why: Supabase serves the public schema through its REST API (PostgREST). Without RLS, anyone with the
 * project's public anon key could read tables such as `users` (password hashes), `app_users` and sessions.
 * With RLS on and no policies, those API roles see nothing.
 *
 * Why it does not affect the site: Payload connects as the owner of these tables, and Postgres does not apply
 * RLS to a table's owner (we never use FORCE ROW LEVEL SECURITY). The push tables have run this way in
 * production since 2026-11-27.
 *
 * Tables owned by another role (for example created by hand in the Supabase dashboard) are skipped instead of
 * failing the deploy; they are listed in the log so they can be checked separately.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const res = (await db.execute(sql`
    SELECT c.relname AS name, c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) = current_user AS owned
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    ORDER BY c.relname`)) as { rows: { name: string; rls: boolean; owned: boolean }[] }

  const toEnable = res.rows.filter((t) => t.owned && !t.rls).map((t) => t.name)
  const notOwned = res.rows.filter((t) => !t.owned && !t.rls).map((t) => t.name)

  for (const name of toEnable) {
    await db.execute(sql`ALTER TABLE ${sql.identifier(name)} ENABLE ROW LEVEL SECURITY`)
  }
  payload.logger.info(`[rls] enabled on ${toEnable.length} table(s); already on: ${res.rows.filter((t) => t.rls).length}`)
  if (notOwned.length) {
    payload.logger.warn(`[rls] not owned by the app role, left unchanged (check in Supabase): ${notOwned.join(', ')}`)
  }
}

/** Down is a no-op on purpose: turning RLS off again would re-expose the tables through Supabase's REST API. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
