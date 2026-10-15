import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * One attributes row per product, enforced by the database.
 *
 * The product <-> productAttributes link is one-to-one, but the table Medusa
 * generates for a link only has a composite primary key (product_id,
 * product_attributes_id) and plain indexes, so a write that bypasses the
 * per-product lock (an import racing a save) could link a second row.
 *
 * The link sync that runs on every `db:migrate` compares the table with the
 * definition Medusa generates and drops indexes it does not know, but it
 * compares its own partial indexes by name only. So instead of adding an index
 * of our own (which the next sync would drop), Medusa's index on product_id is
 * rebuilt as a UNIQUE index under the same name and with the same
 * `WHERE deleted_at IS NULL`: the sync sees nothing to change, and a deleted
 * (soft-deleted) link does not block a new one.
 */

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`

/** The table Medusa generated for the product <-> productAttributes link. */
export async function productAttributesLinkTable(container: MedusaContainer): Promise<string> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { rows } = await pg.raw(
    `select table_name from link_module_migrations
      where link_descriptor->>'fromModule' = 'product'
        and lower(link_descriptor->>'toModule') = 'productattributes'`
  )
  if (rows.length !== 1) {
    throw new Error("The product attributes link table was not found; run the link sync first.")
  }
  return rows[0].table_name as string
}

/**
 * Makes the link's product_id index unique. Existing duplicates (more than one
 * live link for a product) are resolved first by soft-deleting every link but
 * the oldest; nothing is hard-deleted. Safe to run again: a unique index is
 * left alone.
 */
export async function ensureOneAttributesRowPerProduct(
  container: MedusaContainer
): Promise<{ changed: boolean; duplicates_removed: number }> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const table = await productAttributesLinkTable(container)

  const { rows: indexes } = await pg.raw(
    `select indexname, indexdef from pg_indexes
      where schemaname = current_schema() and tablename = ? and indexname like 'IDX\\_product\\_id\\_%'`,
    [table]
  )
  if (indexes.length !== 1) {
    throw new Error(`Expected one product_id index on ${table}, found ${indexes.length}.`)
  }
  const { indexname, indexdef } = indexes[0] as { indexname: string; indexdef: string }
  if (/^CREATE UNIQUE INDEX/i.test(indexdef)) {
    return { changed: false, duplicates_removed: 0 }
  }

  let duplicates = 0
  await pg.transaction(async (trx) => {
    const result = await trx.raw(
      `update ${quote(table)} set deleted_at = now()
        where id in (
          select id from (
            select id, row_number() over (partition by product_id order by created_at, id) as n
              from ${quote(table)} where deleted_at is null
          ) ranked where n > 1
        )`
    )
    duplicates = result.rowCount ?? 0
    await trx.raw(`drop index ${quote(indexname)}`)
    await trx.raw(
      `create unique index ${quote(indexname)} on ${quote(table)} ("product_id") where deleted_at is null`
    )
  })
  if (duplicates) {
    logger.warn(
      `product attributes: ${duplicates} extra attributes link(s) found; kept the oldest per product, soft-deleted the rest`
    )
  }
  return { changed: true, duplicates_removed: duplicates }
}
