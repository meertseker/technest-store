import { confirmClick } from "../confirm"

function clickEvent() {
  return { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
}

describe("confirmClick", () => {
  it("keeps the dialog open when the confirm handler says no (a field still needs fixing)", () => {
    const e = clickEvent()
    confirmClick(() => false)(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it("lets the dialog close when the confirm handler goes ahead", () => {
    const e = clickEvent()
    const onConfirm = jest.fn()
    confirmClick(onConfirm)(e)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(false)
    confirmClick(() => true)(e)
    expect(e.defaultPrevented).toBe(false)
  })
})
