import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer"
import { hasTemplate, renderEmail } from "@technest/emails"

export type SmtpOptions = {
  host: string
  port: number | string
  secure?: boolean | string
  user?: string
  pass?: string
  from: string
  reply_to?: string
  /** Refuse to send unless STARTTLS succeeds (production on port 587). */
  require_tls?: boolean | string
  /** Raw nodemailer transport options; overrides host/port/auth when set. */
  transport?: Record<string, unknown>
}

type InjectedDependencies = { logger: Logger }

// Exactly one plain address: no display name, lists, groups or line breaks.
const ADDRESS_PART = String.raw`[^\s@<>,;:"'()\[\]\\]+`
const SINGLE_ADDRESS = new RegExp(`^${ADDRESS_PART}@${ADDRESS_PART}\\.${ADDRESS_PART}$`)

const isTrue = (v: unknown) => v === true || v === "true"

const isSet = (v: unknown) => typeof v === "string" && v.trim() !== ""

/**
 * How long one send may wait on the server. Nodemailer's own defaults (2 min
 * to connect, 30 s for the greeting, 10 min of silence) would hold up the
 * event worker, and every order behind it, when the server hangs.
 */
export const SMTP_TIMEOUTS = {
  dnsTimeout: 10_000,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
}

/**
 * Email channel provider for the Notification module. Sends through any SMTP
 * server: Mailpit in dev, Resend in production, or any other SMTP relay
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
    // A login with half its details connects fine and then fails every send,
    // so refuse to start instead. Production always logs in (dev's Mailpit doesn't).
    const user = isSet(options.user)
    const pass = isSet(options.pass)
    const loginRequired = process.env.NODE_ENV === "production" && !options.transport
    if ((pass || loginRequired) && !user) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'smtp notification provider: option "user" (SMTP_USER) is required'
      )
    }
    if (user && !pass) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'smtp notification provider: option "pass" (SMTP_PASS) is required when a user is set'
      )
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
        secure: isTrue(options.secure),
        requireTLS: !isTrue(options.secure) && isTrue(options.require_tls),
        auth: options.user ? { user: options.user, pass: options.pass } : undefined,
        ...SMTP_TIMEOUTS,
      }) as any
    )
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const content =
      notification.content?.subject || !hasTemplate(notification.template)
        ? notification.content
        : await renderEmail(notification.template, notification.data ?? {})
    if (!content?.subject || !(content.html || content.text)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `smtp notification provider: no rendered content for template "${notification.template}"`
      )
    }

    if (!SINGLE_ADDRESS.test(notification.to)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `smtp notification provider: recipient must be exactly one email address (template "${notification.template}")`
      )
    }

    const info = await this.sendMail_(notification.template, {
      from: notification.from || this.options_.from,
      replyTo: this.options_.reply_to || undefined,
      to: notification.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: notification.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        encoding: "base64",
        contentType: a.content_type,
        contentDisposition: a.disposition as "attachment" | "inline" | undefined,
        cid: a.id,
      })),
      // Never let message fields pull in local files or URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    })

    // Template and message id only: never the recipient, subject or body (PII).
    this.logger_.info(`smtp: sent template=${notification.template} message_id=${info.messageId}`)
    return { id: info.messageId }
  }

  // SMTP errors often echo the recipient (e.g. "550 <jane@x.com> rejected"), and
  // Medusa logs and stores error messages. Rethrow a PII-free error instead.
  protected async sendMail_(template: string, message: SendMailOptions) {
    try {
      return await this.transporter_.sendMail(message)
    } catch (e) {
      const err = e as { code?: string; responseCode?: number; command?: string }
      const summary =
        `smtp: send failed template=${template} code=${err.code ?? "unknown"}` +
        ` response_code=${err.responseCode ?? "-"} command=${err.command ?? "-"}`
      this.logger_.error(summary)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, summary)
    }
  }
}

export default SmtpNotificationService
