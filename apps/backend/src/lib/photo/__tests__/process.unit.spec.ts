const prepareOriginal = jest.fn()
const renderProductPhoto = jest.fn()
jest.mock("../render", () => ({
  ...jest.requireActual("../render"),
  prepareOriginal: (...a: unknown[]) => prepareOriginal(...a),
  renderProductPhoto: (...a: unknown[]) => renderProductPhoto(...a),
}))

import { cutOutAndRender } from "../process"

const flush = () => new Promise((r) => setImmediate(r))

describe("cutOutAndRender", () => {
  beforeEach(() => {
    prepareOriginal.mockReset().mockImplementation(async (b: Buffer) => ({ width: 1000, height: 1000, workerInput: b }))
    renderProductPhoto.mockReset().mockResolvedValue({ webp: Buffer.from("w"), avif: Buffer.from("a"), width: 10, height: 10 })
  })

  it("does not hold the photo lock while the background-removal call is out on the network", async () => {
    const calls: string[] = []
    const pending: (() => void)[] = []
    const removeBackground = jest.fn((input: Buffer) => {
      calls.push(input.toString())
      return new Promise<{ png: Buffer; model: "birefnet-general" }>((resolve) =>
        pending.push(() => resolve({ png: Buffer.from("cut"), model: "birefnet-general" }))
      )
    })

    const first = cutOutAndRender(Buffer.from("one"), removeBackground)
    const second = cutOutAndRender(Buffer.from("two"), removeBackground)
    for (let i = 0; i < 5; i++) await flush()

    // The first call is still waiting; the second upload is already at its own call.
    expect(calls).toEqual(["one", "two"])
    pending.forEach((done) => done())
    const [a, b] = await Promise.all([first, second])
    expect(a.cutout.model).toBe("birefnet-general")
    expect(b.rendered.width).toBe(10)
    expect(renderProductPhoto).toHaveBeenCalledTimes(2)
  })

  it("still renders one photo at a time", async () => {
    let active = 0
    let most = 0
    renderProductPhoto.mockImplementation(async () => {
      active++
      most = Math.max(most, active)
      await flush()
      active--
      return { webp: Buffer.from("w"), avif: Buffer.from("a"), width: 10, height: 10 }
    })
    const removeBackground = async () => ({ png: Buffer.from("cut"), model: "birefnet-general" as const })
    await Promise.all([1, 2, 3].map((n) => cutOutAndRender(Buffer.from(String(n)), removeBackground)))
    expect(most).toBe(1)
  })
})
