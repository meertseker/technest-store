import "server-only"
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

// The same for every visitor; a change in the admin shows within a minute.
const SHARED = { revalidate: 60, tags: ["categories"] }

export const listCategories = async (query?: Record<string, unknown>) => {
  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next: SHARED,
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next: SHARED,
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
