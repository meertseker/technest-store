import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930013000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "trade_application" drop constraint if exists "trade_application_customer_id_unique";`);
    this.addSql(`create table if not exists "trade_application" ("id" text not null, "customer_id" text not null, "company_name" text not null, "vat_number" text null, "companies_house_number" text null, "business_type" text check ("business_type" in ('sole_trader', 'partnership', 'limited_company', 'other')) not null, "contact_name" text not null, "contact_phone" text not null, "contact_email" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "trade_application_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_trade_application_deleted_at" ON "trade_application" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_trade_application_status" ON "trade_application" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_trade_application_customer_id_unique" ON "trade_application" ("customer_id") WHERE status = 'pending' AND deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_trade_application_customer_id_created_at" ON "trade_application" ("customer_id", "created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "trade_application" cascade;`);
  }

}
