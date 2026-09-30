import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { batchLinkProductsToCategoryWorkflow } from "@medusajs/medusa/core-flows"
import { assertProductsPublishableStep } from "./steps/assert-products-publishable"

export type LinkProductsToCategoryWorkflowInput = {
  /** The category id. */
  id: string
  add?: string[]
  remove?: string[]
}

/**
 * The admin category page's "add/remove products" with the publish guard
 * (the native batchLinkProductsToCategoryWorkflow has no hook). Runs the
 * native workflow, then checks the added products; a failure compensates the
 * native step, so the products leave the category again.
 */
export const linkProductsToCategoryWorkflow = createWorkflow(
  "link-products-to-category",
  function (input: LinkProductsToCategoryWorkflowInput) {
    batchLinkProductsToCategoryWorkflow.runAsStep({ input })

    const addedIds = transform({ input }, ({ input }) => input.add ?? [])
    assertProductsPublishableStep(addedIds)

    return new WorkflowResponse(addedIds)
  }
)
