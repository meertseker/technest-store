import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930013451 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_attributes" ("id" text not null, "connector_a" text null, "connector_b" text null, "wattage" real null, "cable_length_m" real null, "platform" text[] not null default '{}', "is_addon_item" boolean not null default false, "safety_marking" text check ("safety_marking" in ('UKCA', 'CE', 'none')) not null default 'none', "warranty_months" integer null, "reorder_level" integer not null default 3, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_attributes_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_attributes_deleted_at" ON "product_attributes" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_attributes" cascade;`);
  }

}
