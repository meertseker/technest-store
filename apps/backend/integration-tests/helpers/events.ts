import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

type Message = { name: string; data: unknown }

/** Spies on the event bus; `emitted(name)` returns the payloads emitted under that name. */
export function spyOnEvents(container: MedusaContainer) {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const spy = jest.spyOn(eventBus, "emit")
  const emitted = (name: string) =>
    spy.mock.calls
      .flatMap(([messages]) => (Array.isArray(messages) ? messages : [messages]) as Message[])
      .filter((m) => m?.name === name)
      .map((m) => m.data)
  return { spy, emitted }
}
