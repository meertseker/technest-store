import { render } from "@react-email/render"
import { createElement, type ComponentType } from "react"
import * as collectionReminder from "./templates/collection-reminder"
import * as orderCancelled from "./templates/order-cancelled"
import * as orderConfirmation from "./templates/order-confirmation"
import * as orderDispatched from "./templates/order-dispatched"
import * as passwordReset from "./templates/password-reset"
import * as paymentFailed from "./templates/payment-failed"
import * as readyForCollection from "./templates/ready-for-collection"
import * as refundIssued from "./templates/refund-issued"
import * as returnReceived from "./templates/return-received"
import * as shopNewOrder from "./templates/shop-new-order"
import * as welcome from "./templates/welcome"

export type * from "./order-types"
export { todaysHours } from "./brand"

type Template<D> = { subject: (data: D) => string; Email: ComponentType<D> }

// Template ids must match docs/contracts/emails.md.
const templates = {
  welcome,
  "order-confirmation": orderConfirmation,
  "shop-new-order": shopNewOrder,
  "password-reset": passwordReset,
  "order-dispatched": orderDispatched,
  "order-cancelled": orderCancelled,
  "refund-issued": refundIssued,
  "return-received": returnReceived,
  "ready-for-collection": readyForCollection,
  "collection-reminder": collectionReminder,
  "payment-failed": paymentFailed,
} satisfies Record<string, Template<any>>

export type TemplateId = keyof typeof templates
export type RenderedEmail = { subject: string; html: string; text: string }

export const templateIds = Object.keys(templates) as TemplateId[]

export function hasTemplate(id: string): id is TemplateId {
  return Object.prototype.hasOwnProperty.call(templates, id)
}

export async function renderEmail(id: TemplateId, data: Record<string, unknown>): Promise<RenderedEmail> {
  if (!hasTemplate(id)) {
    throw new Error(`Unknown email template "${id}"`)
  }
  const t = templates[id] as Template<Record<string, unknown>>
  const element = createElement(t.Email, data)
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { subject: t.subject(data), html, text }
}
