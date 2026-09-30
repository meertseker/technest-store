/**
 * Radio dot drawn inside a Headless UI <Radio> option (payment, shipping).
 * Purely visual: the option itself carries role="radio", its name and focus, so
 * this must not be a second interactive element (axe nested-interactive /
 * button-name / target-size on /checkout).
 */
const Radio = ({ checked, 'data-testid': dataTestId }: { checked: boolean, 'data-testid'?: string }) => {
  return (
    <span
      aria-hidden
      data-state={checked ? "checked" : "unchecked"}
      className="group relative flex h-5 w-5 shrink-0 items-center justify-center"
      data-testid={dataTestId || 'radio-button'}
    >
      <span className="shadow-borders-base group-hover:shadow-borders-strong-with-shadow bg-ui-bg-base group-data-[state=checked]:bg-ui-bg-interactive group-data-[state=checked]:shadow-borders-interactive flex h-[14px] w-[14px] items-center justify-center rounded-full transition-all">
        {checked && (
          <span className="bg-ui-bg-base shadow-details-contrast-on-bg-interactive rounded-full h-1.5 w-1.5" />
        )}
      </span>
    </span>
  )
}

export default Radio
