import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

type Message = { name: string; data: unknown }

const asList = (messages: unknown) =>
  (Array.isArray(messages) ? messages : [messages]) as Message[]

/**
 * Spies on the event bus.
 * - `emitted(name)` returns the payloads emitted under that name.
 * - `failNext(name)` makes the next emit that carries `name` reject, so the
 *   workflow step emitting it fails and earlier steps compensate. Other emits
 *   (e.g. the module services' own events) pass through untouched.
 */
export function spyOnEvents(container: MedusaContainer) {
  const eventBus = container.resolve(Modules.EVENT_BUS)
  const original = eventBus.emit.bind(eventBus)
  let failing: string | null = null
  const spy = jest.spyOn(eventBus, "emit").mockImplementation((async (
    messages: unknown,
    options?: unknown
  ) => {
    if (failing && asList(messages).some((m) => m?.name === failing)) {
      failing = null
      throw new Error("event bus down")
    }
    return original(messages as never, options as never)
  }) as never)
  const emitted = (name: string) =>
    spy.mock.calls
      .flatMap(([messages]) => asList(messages))
      .filter((m) => m?.name === name)
      .map((m) => m.data)
  const failNext = (name: string) => {
    failing = name
  }
  return { spy, emitted, failNext }
}
