import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930030238 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "technest_setting" drop constraint if exists "technest_setting_key_unique";`);
    this.addSql(`create table if not exists "technest_setting" ("id" text not null, "key" text not null, "value" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "technest_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_technest_setting_deleted_at" ON "technest_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_technest_setting_key_unique" ON "technest_setting" ("key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "technest_setting" cascade;`);
  }

}
