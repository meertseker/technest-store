import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260929220523 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "device" drop constraint if exists "device_slug_unique";`);
    this.addSql(`create table if not exists "device" ("id" text not null, "brand" text not null, "series" text not null, "model" text not null, "slug" text not null, "aliases" text[] not null default '{}', "type" text check ("type" in ('phone', 'tablet', 'console', 'laptop')) not null, "release_year" integer null, "image_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "device_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_slug_unique" ON "device" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_device_deleted_at" ON "device" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_device_brand_series" ON "device" ("brand", "series") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "device" cascade;`);
  }

}
