import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_push_on_publish" AS ENUM('auto', 'send', 'skip');
  CREATE TYPE "public"."enum__articles_v_version_push_on_publish" AS ENUM('auto', 'send', 'skip');
  CREATE TYPE "public"."enum_push_devices_platform" AS ENUM('android', 'ios');
  CREATE TYPE "public"."enum_push_notifications_type" AS ENUM('article', 'breaking', 'general');
  CREATE TYPE "public"."enum_push_notifications_audience" AS ENUM('all', 'breaking', 'category');
  CREATE TYPE "public"."enum_push_notifications_source" AS ENUM('manual', 'publish');
  CREATE TYPE "public"."enum_push_notifications_status" AS ENUM('scheduled', 'queued', 'sending', 'sent', 'failed', 'cancelled');
  CREATE TYPE "public"."enum_push_deliveries_status" AS ENUM('accepted', 'ticket_error', 'receipt_ok', 'receipt_error');
  CREATE TYPE "public"."enum_push_events_type" AS ENUM('opened');
  CREATE TABLE "push_devices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"app_user_id" integer,
  	"platform" "enum_push_devices_platform" NOT NULL,
  	"device_id" varchar,
  	"app_version" varchar,
  	"active" boolean DEFAULT true,
  	"deactivated_reason" varchar,
  	"last_seen_at" timestamp(3) with time zone,
  	"preferences_enabled" boolean DEFAULT true,
  	"preferences_breaking" boolean DEFAULT true,
  	"preferences_general" boolean DEFAULT true,
  	"preferences_muted_categories" jsonb DEFAULT '[]'::jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"image_url" varchar,
  	"type" "enum_push_notifications_type" NOT NULL,
  	"audience" "enum_push_notifications_audience" DEFAULT 'all' NOT NULL,
  	"category_id" integer,
  	"article_id" integer,
  	"source" "enum_push_notifications_source" DEFAULT 'manual' NOT NULL,
  	"dedupe_key" varchar,
  	"status" "enum_push_notifications_status" DEFAULT 'queued' NOT NULL,
  	"scheduled_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"cursor" numeric DEFAULT 0,
  	"error" varchar,
  	"targeted" numeric DEFAULT 0,
  	"accepted" numeric DEFAULT 0,
  	"failed" numeric DEFAULT 0,
  	"handed_over" numeric DEFAULT 0,
  	"receipt_failed" numeric DEFAULT 0,
  	"opened" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_deliveries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notification_id" integer NOT NULL,
  	"device_id" integer NOT NULL,
  	"ticket_id" varchar,
  	"status" "enum_push_deliveries_status" NOT NULL,
  	"error_code" varchar,
  	"error_message" varchar,
  	"receipt_checked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notification_id" integer NOT NULL,
  	"device_id" integer,
  	"app_user_id" integer,
  	"type" "enum_push_events_type" DEFAULT 'opened' NOT NULL,
  	"dedupe_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "push_on_publish" "enum_articles_push_on_publish" DEFAULT 'auto';
  ALTER TABLE "_articles_v" ADD COLUMN "version_push_on_publish" "enum__articles_v_version_push_on_publish" DEFAULT 'auto';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_devices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_notifications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_deliveries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_events_id" integer;
  ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_push_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."push_notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_device_id_push_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_devices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_events" ADD CONSTRAINT "push_events_notification_id_push_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."push_notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_events" ADD CONSTRAINT "push_events_device_id_push_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_devices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_events" ADD CONSTRAINT "push_events_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "push_devices_token_idx" ON "push_devices" USING btree ("token");
  CREATE INDEX "push_devices_app_user_idx" ON "push_devices" USING btree ("app_user_id");
  CREATE INDEX "push_devices_active_idx" ON "push_devices" USING btree ("active");
  CREATE INDEX "push_devices_updated_at_idx" ON "push_devices" USING btree ("updated_at");
  CREATE INDEX "push_devices_created_at_idx" ON "push_devices" USING btree ("created_at");
  CREATE INDEX "push_notifications_type_idx" ON "push_notifications" USING btree ("type");
  CREATE INDEX "push_notifications_category_idx" ON "push_notifications" USING btree ("category_id");
  CREATE INDEX "push_notifications_article_idx" ON "push_notifications" USING btree ("article_id");
  CREATE UNIQUE INDEX "push_notifications_dedupe_key_idx" ON "push_notifications" USING btree ("dedupe_key");
  CREATE INDEX "push_notifications_status_idx" ON "push_notifications" USING btree ("status");
  CREATE INDEX "push_notifications_sent_at_idx" ON "push_notifications" USING btree ("sent_at");
  CREATE INDEX "push_notifications_created_by_idx" ON "push_notifications" USING btree ("created_by_id");
  CREATE INDEX "push_notifications_updated_at_idx" ON "push_notifications" USING btree ("updated_at");
  CREATE INDEX "push_notifications_created_at_idx" ON "push_notifications" USING btree ("created_at");
  CREATE INDEX "push_deliveries_notification_idx" ON "push_deliveries" USING btree ("notification_id");
  CREATE INDEX "push_deliveries_device_idx" ON "push_deliveries" USING btree ("device_id");
  CREATE INDEX "push_deliveries_ticket_id_idx" ON "push_deliveries" USING btree ("ticket_id");
  CREATE INDEX "push_deliveries_status_idx" ON "push_deliveries" USING btree ("status");
  CREATE INDEX "push_deliveries_updated_at_idx" ON "push_deliveries" USING btree ("updated_at");
  CREATE INDEX "push_deliveries_created_at_idx" ON "push_deliveries" USING btree ("created_at");
  CREATE INDEX "push_events_notification_idx" ON "push_events" USING btree ("notification_id");
  CREATE INDEX "push_events_device_idx" ON "push_events" USING btree ("device_id");
  CREATE INDEX "push_events_app_user_idx" ON "push_events" USING btree ("app_user_id");
  CREATE UNIQUE INDEX "push_events_dedupe_key_idx" ON "push_events" USING btree ("dedupe_key");
  CREATE INDEX "push_events_updated_at_idx" ON "push_events" USING btree ("updated_at");
  CREATE INDEX "push_events_created_at_idx" ON "push_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_devices_fk" FOREIGN KEY ("push_devices_id") REFERENCES "public"."push_devices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_notifications_fk" FOREIGN KEY ("push_notifications_id") REFERENCES "public"."push_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_deliveries_fk" FOREIGN KEY ("push_deliveries_id") REFERENCES "public"."push_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_events_fk" FOREIGN KEY ("push_events_id") REFERENCES "public"."push_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_push_devices_id_idx" ON "payload_locked_documents_rels" USING btree ("push_devices_id");
  CREATE INDEX "payload_locked_documents_rels_push_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("push_notifications_id");
  CREATE INDEX "payload_locked_documents_rels_push_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("push_deliveries_id");
  CREATE INDEX "payload_locked_documents_rels_push_events_id_idx" ON "payload_locked_documents_rels" USING btree ("push_events_id");`)

  // Supabase exposes the public schema through its REST API. With RLS on and no policies, those roles see
  // nothing; Payload connects as the table owner and is not affected. (Added by hand; Payload does not emit it.)
  await db.execute(sql`
  ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_notifications" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_deliveries" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_events" ENABLE ROW LEVEL SECURITY;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "push_devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_deliveries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "push_devices" CASCADE;
  DROP TABLE "push_notifications" CASCADE;
  DROP TABLE "push_deliveries" CASCADE;
  DROP TABLE "push_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_devices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_notifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_deliveries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_push_devices_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_notifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_deliveries_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_events_id_idx";
  ALTER TABLE "articles" DROP COLUMN "push_on_publish";
  ALTER TABLE "_articles_v" DROP COLUMN "version_push_on_publish";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_devices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_notifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_deliveries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_events_id";
  DROP TYPE "public"."enum_articles_push_on_publish";
  DROP TYPE "public"."enum__articles_v_version_push_on_publish";
  DROP TYPE "public"."enum_push_devices_platform";
  DROP TYPE "public"."enum_push_notifications_type";
  DROP TYPE "public"."enum_push_notifications_audience";
  DROP TYPE "public"."enum_push_notifications_source";
  DROP TYPE "public"."enum_push_notifications_status";
  DROP TYPE "public"."enum_push_deliveries_status";
  DROP TYPE "public"."enum_push_events_type";`)
}
