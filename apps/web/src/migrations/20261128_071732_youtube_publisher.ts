import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'youtubePublish' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'youtubePublish' BEFORE 'schedulePublish';
  ALTER TABLE "youtube_posts" ADD COLUMN "next_check_at" timestamp(3) with time zone;
  ALTER TABLE "youtube_posts" ADD COLUMN "thumbnail_set_at" timestamp(3) with time zone;
  CREATE INDEX "youtube_posts_upload_started_at_idx" ON "youtube_posts" USING btree ("upload_started_at");
  CREATE INDEX "youtube_posts_next_check_at_idx" ON "youtube_posts" USING btree ("next_check_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Rows with the removed slug would make the type change fail (added by hand).
  await db.execute(sql`
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'youtubePublish';
  DELETE FROM "payload_jobs" WHERE "task_slug" = 'youtubePublish';`)
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'expireBreaking', 'pushArticlePublish', 'pushSend', 'pushReceipts', 'footageRetention', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'expireBreaking', 'pushArticlePublish', 'pushSend', 'pushReceipts', 'footageRetention', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "youtube_posts_upload_started_at_idx";
  DROP INDEX "youtube_posts_next_check_at_idx";
  ALTER TABLE "youtube_posts" DROP COLUMN "next_check_at";
  ALTER TABLE "youtube_posts" DROP COLUMN "thumbnail_set_at";`)
}
