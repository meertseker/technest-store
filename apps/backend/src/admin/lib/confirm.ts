/**
 * Click handler for a confirm button that sits inside a Radix alert dialog
 * (Medusa's Prompt.Action). Radix closes the dialog after the click unless the
 * handler calls preventDefault(), so a confirm handler that returns false (a
 * field still needs fixing) keeps the dialog, and its error message, on screen.
 */
export function confirmClick(onConfirm: () => boolean | void) {
  return (event: { preventDefault(): void }) => {
    if (onConfirm() === false) event.preventDefault()
  }
}
