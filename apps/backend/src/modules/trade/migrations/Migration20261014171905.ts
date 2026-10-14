import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261014171905 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "trade_application" drop constraint if exists "trade_application_status_check";`);

    this.addSql(`alter table if exists "trade_application" add constraint "trade_application_status_check" check("status" in ('pending', 'approved', 'rejected', 'revoked'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "trade_application" drop constraint if exists "trade_application_status_check";`);

    this.addSql(`alter table if exists "trade_application" add constraint "trade_application_status_check" check("status" in ('pending', 'approved', 'rejected'));`);
  }

}
