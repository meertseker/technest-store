import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930013417 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "repair_booking" ("id" text not null, "name" text not null, "phone" text not null, "email" text not null, "device" text not null, "device_id" text null, "fault" text not null, "preferred_time" text not null, "status" text check ("status" in ('new', 'booked', 'done')) not null default 'new', "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "repair_booking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_repair_booking_deleted_at" ON "repair_booking" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_repair_booking_status" ON "repair_booking" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "repair_booking" cascade;`);
  }

}
