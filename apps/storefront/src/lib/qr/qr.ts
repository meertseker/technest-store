import QRCode from "qrcode"

export type QrMatrix = { size: number; path: string }

/**
 * Encodes text as a QR code and returns one SVG path (1 unit per module),
 * so the poster draws it with a plain <path> and no innerHTML. Level M
 * survives a scuffed or partly covered print.
 */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size } = modules
  let path = ""
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`
    }
  }
  return { size, path }
}
