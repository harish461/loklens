import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_footage_upload_status" AS ENUM('uploading', 'uploaded', 'failed', 'deleted');
  CREATE TYPE "public"."enum_footage_orientation" AS ENUM('landscape', 'vertical', 'square');
  CREATE TYPE "public"."enum_youtube_posts_post_type" AS ENUM('video', 'short');
  CREATE TYPE "public"."enum_youtube_posts_privacy_status" AS ENUM('public', 'unlisted', 'private');
  CREATE TYPE "public"."enum_youtube_posts_status" AS ENUM('draft', 'pending_review', 'approved', 'uploading', 'processing', 'scheduled', 'published', 'failed', 'cancelled');
  CREATE TYPE "public"."enum_youtube_post_events_type" AS ENUM('created', 'submitted', 'rejected', 'approved', 'upload_started', 'chunk', 'uploaded', 'thumbnail_set', 'processed', 'scheduled', 'published', 'failed', 'retried', 'cancelled');
  CREATE TYPE "public"."enum_youtube_settings_default_privacy" AS ENUM('public', 'unlisted', 'private');
  CREATE TABLE "footage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"notes" varchar,
  	"location_id" integer,
  	"category_id" integer,
  	"rights_confirmed" boolean DEFAULT false,
  	"credit" varchar,
  	"upload_status" "enum_footage_upload_status" DEFAULT 'uploading' NOT NULL,
  	"storage_prefix" varchar,
  	"bucket" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"size_bytes" numeric,
  	"segment_bytes" numeric,
  	"segment_count" numeric,
  	"duration_seconds" numeric,
  	"width" numeric,
  	"height" numeric,
  	"orientation" "enum_footage_orientation",
  	"locked_at" timestamp(3) with time zone,
  	"retain_until" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "youtube_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_type" "enum_youtube_posts_post_type" DEFAULT 'video' NOT NULL,
  	"footage_id" integer,
  	"article_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"category_id" varchar DEFAULT '25',
  	"default_language" varchar DEFAULT 'hi',
  	"thumbnail_id" integer,
  	"privacy_status" "enum_youtube_posts_privacy_status" DEFAULT 'unlisted' NOT NULL,
  	"publish_at" timestamp(3) with time zone,
  	"notify_subscribers" boolean DEFAULT true,
  	"made_for_kids" boolean DEFAULT false,
  	"contains_synthetic_media" boolean DEFAULT false,
  	"status" "enum_youtube_posts_status" DEFAULT 'draft' NOT NULL,
  	"review_note" varchar,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"approved_hash" varchar,
  	"youtube_video_id" varchar,
  	"youtube_url" varchar,
  	"upload_session_uri" varchar,
  	"bytes_uploaded" numeric DEFAULT 0,
  	"lease_until" timestamp(3) with time zone,
  	"attempts" numeric DEFAULT 0,
  	"last_error" varchar,
  	"upload_started_at" timestamp(3) with time zone,
  	"published_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "youtube_posts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "youtube_post_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_id" integer,
  	"type" "enum_youtube_post_events_type" NOT NULL,
  	"actor_id" integer,
  	"detail" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "youtube_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"daily_upload_limit" numeric DEFAULT 20,
  	"max_footage_m_b" numeric DEFAULT 2048,
  	"footage_retention_days" numeric DEFAULT 30,
  	"default_privacy" "enum_youtube_settings_default_privacy" DEFAULT 'unlisted',
  	"require_thumbnail_for_videos" boolean DEFAULT true,
  	"channel_title" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "youtube_settings_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "footage_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "youtube_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "youtube_post_events_id" integer;
  ALTER TABLE "footage" ADD CONSTRAINT "footage_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "footage" ADD CONSTRAINT "footage_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "footage" ADD CONSTRAINT "footage_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_footage_id_footage_id_fk" FOREIGN KEY ("footage_id") REFERENCES "public"."footage"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts" ADD CONSTRAINT "youtube_posts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_posts_texts" ADD CONSTRAINT "youtube_posts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."youtube_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "youtube_post_events" ADD CONSTRAINT "youtube_post_events_post_id_youtube_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."youtube_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_post_events" ADD CONSTRAINT "youtube_post_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "youtube_settings_texts" ADD CONSTRAINT "youtube_settings_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."youtube_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "footage_location_idx" ON "footage" USING btree ("location_id");
  CREATE INDEX "footage_category_idx" ON "footage" USING btree ("category_id");
  CREATE INDEX "footage_upload_status_idx" ON "footage" USING btree ("upload_status");
  CREATE UNIQUE INDEX "footage_storage_prefix_idx" ON "footage" USING btree ("storage_prefix");
  CREATE INDEX "footage_retain_until_idx" ON "footage" USING btree ("retain_until");
  CREATE INDEX "footage_created_by_idx" ON "footage" USING btree ("created_by_id");
  CREATE INDEX "footage_updated_at_idx" ON "footage" USING btree ("updated_at");
  CREATE INDEX "footage_created_at_idx" ON "footage" USING btree ("created_at");
  CREATE INDEX "youtube_posts_footage_idx" ON "youtube_posts" USING btree ("footage_id");
  CREATE INDEX "youtube_posts_article_idx" ON "youtube_posts" USING btree ("article_id");
  CREATE INDEX "youtube_posts_thumbnail_idx" ON "youtube_posts" USING btree ("thumbnail_id");
  CREATE INDEX "youtube_posts_status_idx" ON "youtube_posts" USING btree ("status");
  CREATE INDEX "youtube_posts_submitted_by_idx" ON "youtube_posts" USING btree ("submitted_by_id");
  CREATE INDEX "youtube_posts_approved_by_idx" ON "youtube_posts" USING btree ("approved_by_id");
  CREATE UNIQUE INDEX "youtube_posts_youtube_video_id_idx" ON "youtube_posts" USING btree ("youtube_video_id");
  CREATE INDEX "youtube_posts_published_at_idx" ON "youtube_posts" USING btree ("published_at");
  CREATE INDEX "youtube_posts_created_by_idx" ON "youtube_posts" USING btree ("created_by_id");
  CREATE INDEX "youtube_posts_updated_at_idx" ON "youtube_posts" USING btree ("updated_at");
  CREATE INDEX "youtube_posts_created_at_idx" ON "youtube_posts" USING btree ("created_at");
  CREATE INDEX "youtube_posts_texts_order_parent" ON "youtube_posts_texts" USING btree ("order","parent_id");
  CREATE INDEX "youtube_post_events_post_idx" ON "youtube_post_events" USING btree ("post_id");
  CREATE INDEX "youtube_post_events_type_idx" ON "youtube_post_events" USING btree ("type");
  CREATE INDEX "youtube_post_events_actor_idx" ON "youtube_post_events" USING btree ("actor_id");
  CREATE INDEX "youtube_post_events_updated_at_idx" ON "youtube_post_events" USING btree ("updated_at");
  CREATE INDEX "youtube_post_events_created_at_idx" ON "youtube_post_events" USING btree ("created_at");
  CREATE INDEX "youtube_settings_texts_order_parent" ON "youtube_settings_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_footage_fk" FOREIGN KEY ("footage_id") REFERENCES "public"."footage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_youtube_posts_fk" FOREIGN KEY ("youtube_posts_id") REFERENCES "public"."youtube_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_youtube_post_events_fk" FOREIGN KEY ("youtube_post_events_id") REFERENCES "public"."youtube_post_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_footage_id_idx" ON "payload_locked_documents_rels" USING btree ("footage_id");
  CREATE INDEX "payload_locked_documents_rels_youtube_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("youtube_posts_id");
  CREATE INDEX "payload_locked_documents_rels_youtube_post_events_id_idx" ON "payload_locked_documents_rels" USING btree ("youtube_post_events_id");`)

  // Supabase serves the public schema over its REST API: every new table gets Row Level Security with no
  // policies, so the anon/authenticated API roles see nothing. Payload connects as the table owner, which RLS
  // does not restrict (see 20261127_081621_enable_rls_public_tables).
  await db.execute(sql`
  ALTER TABLE "footage" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_posts" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_posts_texts" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_post_events" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_settings" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_settings_texts" ENABLE ROW LEVEL SECURITY;`)
}

// Down was reordered by hand: the generated version dropped the tables (CASCADE removes the
// payload_locked_documents_rels foreign keys) and then failed dropping those same constraints. Dropping the
// columns also drops their constraints and indexes. RLS needs no DISABLE: the tables are dropped.
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "footage_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "youtube_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "youtube_post_events_id";
  DROP TABLE "youtube_post_events" CASCADE;
  DROP TABLE "youtube_posts_texts" CASCADE;
  DROP TABLE "youtube_posts" CASCADE;
  DROP TABLE "footage" CASCADE;
  DROP TABLE "youtube_settings_texts" CASCADE;
  DROP TABLE "youtube_settings" CASCADE;
  DROP TYPE "public"."enum_footage_upload_status";
  DROP TYPE "public"."enum_footage_orientation";
  DROP TYPE "public"."enum_youtube_posts_post_type";
  DROP TYPE "public"."enum_youtube_posts_privacy_status";
  DROP TYPE "public"."enum_youtube_posts_status";
  DROP TYPE "public"."enum_youtube_post_events_type";
  DROP TYPE "public"."enum_youtube_settings_default_privacy";`)
}
