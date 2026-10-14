import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261014171906 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "technest_reference" drop constraint if exists "technest_reference_key_unique";`);
    this.addSql(`create table if not exists "technest_reference" ("id" text not null, "key" text not null, "value" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "technest_reference_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_technest_reference_deleted_at" ON "technest_reference" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_technest_reference_key_unique" ON "technest_reference" ("key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "technest_reference" cascade;`);
  }

}
