// Minimal types for the part of "qrcode" (MIT) we use; @types/qrcode is not installed.
declare module "qrcode" {
  type BitMatrix = { size: number; get(row: number, col: number): boolean | number }
  const QRCode: {
    create(
      text: string,
      options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" }
    ): { modules: BitMatrix; version: number }
  }
  export default QRCode
}
