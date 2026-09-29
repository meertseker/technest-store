const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

/** 1447 -> "£14.47" */
export const formatPence = (pence: number) => gbp.format(pence / 100)
