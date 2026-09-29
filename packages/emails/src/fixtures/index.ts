import type { TemplateId } from "../index"

// Sample data for the local preview. Keep one entry per template.
export const fixtures: Record<TemplateId, Record<string, unknown>> = {
  welcome: { first_name: "Sam" },
}
