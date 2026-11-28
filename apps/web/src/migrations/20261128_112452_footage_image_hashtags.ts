import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "footage_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "footage" ADD COLUMN "image_id" integer;
  ALTER TABLE "footage_texts" ADD CONSTRAINT "footage_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "footage_texts_order_parent" ON "footage_texts" USING btree ("order","parent_id");
  ALTER TABLE "footage" ADD CONSTRAINT "footage_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "footage_image_idx" ON "footage" USING btree ("image_id");`)

  // New table: Row Level Security on, no policies (Supabase REST API sees nothing; Payload owns the table).
  await db.execute(sql`ALTER TABLE "footage_texts" ENABLE ROW LEVEL SECURITY;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "footage_texts" CASCADE;
  ALTER TABLE "footage" DROP COLUMN "image_id";`)
}
