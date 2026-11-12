import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_article_type" AS ENUM('news', 'opinion', 'interview', 'analysis', 'photo_story');
  CREATE TYPE "public"."enum_articles_language" AS ENUM('hi', 'en');
  CREATE TYPE "public"."enum_articles_workflow_status" AS ENUM('draft', 'pending_review', 'rejected', 'published');
  CREATE TYPE "public"."enum__articles_v_version_article_type" AS ENUM('news', 'opinion', 'interview', 'analysis', 'photo_story');
  CREATE TYPE "public"."enum__articles_v_version_language" AS ENUM('hi', 'en');
  CREATE TYPE "public"."enum__articles_v_version_workflow_status" AS ENUM('draft', 'pending_review', 'rejected', 'published');
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  ALTER TABLE "articles" ADD COLUMN "seo_focus_keyword" varchar;
  ALTER TABLE "articles" ADD COLUMN "article_type" "enum_articles_article_type" DEFAULT 'news';
  ALTER TABLE "articles" ADD COLUMN "language" "enum_articles_language" DEFAULT 'hi';
  ALTER TABLE "articles" ADD COLUMN "workflow_status" "enum_articles_workflow_status" DEFAULT 'draft';
  ALTER TABLE "articles" ADD COLUMN "review_note" varchar;
  ALTER TABLE "articles" ADD COLUMN "feature_requested" boolean DEFAULT false;
  ALTER TABLE "articles" ADD COLUMN "submitted_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "reviewed_by_id" integer;
  ALTER TABLE "articles" ADD COLUMN "ever_published" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_seo_focus_keyword" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_article_type" "enum__articles_v_version_article_type" DEFAULT 'news';
  ALTER TABLE "_articles_v" ADD COLUMN "version_language" "enum__articles_v_version_language" DEFAULT 'hi';
  ALTER TABLE "_articles_v" ADD COLUMN "version_workflow_status" "enum__articles_v_version_workflow_status" DEFAULT 'draft';
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_note" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_feature_requested" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_submitted_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_reviewed_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_reviewed_by_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_ever_published" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "can_publish" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "mobile" varchar;
  ALTER TABLE "users" ADD COLUMN "designation" varchar;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_categories_id_idx" ON "users_rels" USING btree ("categories_id");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_workflow_status_idx" ON "articles" USING btree ("workflow_status");
  CREATE INDEX "articles_reviewed_by_idx" ON "articles" USING btree ("reviewed_by_id");
  CREATE INDEX "articles_ever_published_idx" ON "articles" USING btree ("ever_published");
  CREATE INDEX "_articles_v_version_version_workflow_status_idx" ON "_articles_v" USING btree ("version_workflow_status");
  CREATE INDEX "_articles_v_version_version_reviewed_by_idx" ON "_articles_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_articles_v_version_version_ever_published_idx" ON "_articles_v" USING btree ("version_ever_published");
  CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");`)

  // Backfill (hand-written): existing rows get the workflow state that matches their publish state.
  // "Ever published" = live now or any published version in history, so reporters cannot delete them.
  await db.execute(sql`
  UPDATE "articles" a SET
    "workflow_status" = CASE WHEN a."_status" = 'published' THEN 'published'::"enum_articles_workflow_status" ELSE 'draft'::"enum_articles_workflow_status" END,
    "ever_published" = (a."_status" = 'published' OR EXISTS (
      SELECT 1 FROM "_articles_v" v WHERE v."parent_id" = a."id" AND v."version__status" = 'published'
    ));
  UPDATE "_articles_v" v SET
    "version_workflow_status" = CASE WHEN v."version__status" = 'published' THEN 'published'::"enum__articles_v_version_workflow_status" ELSE 'draft'::"enum__articles_v_version_workflow_status" END,
    "version_ever_published" = a."ever_published"
  FROM "articles" a WHERE v."parent_id" = a."id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_rels" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_reviewed_by_id_users_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_reviewed_by_id_users_id_fk";
  
  DROP INDEX "articles_workflow_status_idx";
  DROP INDEX "articles_reviewed_by_idx";
  DROP INDEX "articles_ever_published_idx";
  DROP INDEX "_articles_v_version_version_workflow_status_idx";
  DROP INDEX "_articles_v_version_version_reviewed_by_idx";
  DROP INDEX "_articles_v_version_version_ever_published_idx";
  DROP INDEX "users_is_active_idx";
  ALTER TABLE "articles" DROP COLUMN "seo_focus_keyword";
  ALTER TABLE "articles" DROP COLUMN "article_type";
  ALTER TABLE "articles" DROP COLUMN "language";
  ALTER TABLE "articles" DROP COLUMN "workflow_status";
  ALTER TABLE "articles" DROP COLUMN "review_note";
  ALTER TABLE "articles" DROP COLUMN "feature_requested";
  ALTER TABLE "articles" DROP COLUMN "submitted_at";
  ALTER TABLE "articles" DROP COLUMN "reviewed_at";
  ALTER TABLE "articles" DROP COLUMN "reviewed_by_id";
  ALTER TABLE "articles" DROP COLUMN "ever_published";
  ALTER TABLE "_articles_v" DROP COLUMN "version_seo_focus_keyword";
  ALTER TABLE "_articles_v" DROP COLUMN "version_article_type";
  ALTER TABLE "_articles_v" DROP COLUMN "version_language";
  ALTER TABLE "_articles_v" DROP COLUMN "version_workflow_status";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_note";
  ALTER TABLE "_articles_v" DROP COLUMN "version_feature_requested";
  ALTER TABLE "_articles_v" DROP COLUMN "version_submitted_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_reviewed_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_reviewed_by_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_ever_published";
  ALTER TABLE "users" DROP COLUMN "is_active";
  ALTER TABLE "users" DROP COLUMN "can_publish";
  ALTER TABLE "users" DROP COLUMN "mobile";
  ALTER TABLE "users" DROP COLUMN "designation";
  DROP TYPE "public"."enum_articles_article_type";
  DROP TYPE "public"."enum_articles_language";
  DROP TYPE "public"."enum_articles_workflow_status";
  DROP TYPE "public"."enum__articles_v_version_article_type";
  DROP TYPE "public"."enum__articles_v_version_language";
  DROP TYPE "public"."enum__articles_v_version_workflow_status";`)
}
