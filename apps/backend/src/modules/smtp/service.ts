import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import nodemailer, { type Transporter } from "nodemailer"

export type SmtpOptions = {
  host: string
  port: number | string
  secure?: boolean | string
  user?: string
  pass?: string
  from: string
  reply_to?: string
  /** Raw nodemailer transport options; overrides host/port/auth when set. */
  transport?: Record<string, unknown>
}

type InjectedDependencies = { logger: Logger }

/**
 * Email channel provider for the Notification module. Sends through any SMTP
 * server: Mailpit in dev, our docker-mailserver in production, or a paid relay
 * by changing SMTP_* env vars only.
 */
class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  protected logger_: Logger
  protected options_: SmtpOptions
  protected transporter_: Transporter

  static validateOptions(options: Record<string, unknown>) {
    for (const key of ["host", "port", "from"]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `smtp notification provider: option "${key}" is required`
        )
      }
    }
  }

  constructor({ logger }: InjectedDependencies, options: SmtpOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.transporter_ = nodemailer.createTransport(
      (options.transport ?? {
        host: options.host,
        port: Number(options.port),
        secure: options.secure === true || options.secure === "true",
        auth: options.user ? { user: options.user, pass: options.pass } : undefined,
      }) as any
    )
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const content = notification.content
    if (!content?.subject || !(content.html || content.text)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `smtp notification provider: no rendered content for template "${notification.template}"`
      )
    }

    const info = await this.transporter_.sendMail({
      from: notification.from || this.options_.from,
      replyTo: this.options_.reply_to || undefined,
      to: notification.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    })

    // Template and message id only: never the recipient, subject or body (PII).
    this.logger_.info(`smtp: sent template=${notification.template} message_id=${info.messageId}`)
    return { id: info.messageId }
  }
}

export default SmtpNotificationService
