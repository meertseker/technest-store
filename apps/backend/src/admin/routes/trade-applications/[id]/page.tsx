import { ArrowLeft } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ConfirmDialog, DetailRow, PageLoading, TAP } from "../../../components/shop-ui"
import { sdk } from "../../../lib/client"
import { errorMessage, formatDateTime } from "../../../lib/format"
import type { TradeApplication } from "../../../lib/types"
import { BUSINESS_TYPE_LABELS, TRADE_STATUS_COLORS, TRADE_STATUS_LABELS } from "../shared"

// One trade application, with Approve / Reject (docs/contracts/trade.md).
// The shop's "new trade application" email links here: /app/trade-applications/:id

const REASON_MAX = 1000

type Response = { trade_application: TradeApplication }

const TradeApplicationPage = () => {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const key = ["trade-applications", "detail", id]

  const { data, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => sdk.client.fetch<Response>(`/admin/trade-applications/${id}`),
  })

  const onDone = (res: Response) => {
    queryClient.setQueryData(key, res)
    queryClient.invalidateQueries({ queryKey: ["trade-applications"] })
  }

  const approve = useMutation({
    mutationFn: () =>
      sdk.client.fetch<Response>(`/admin/trade-applications/${id}/approve`, {
        method: "POST",
        body: {},
      }),
    onSuccess: (res) => {
      onDone(res)
      toast.success(`${res.trade_application.company_name} approved.`)
    },
  })

  const reject = useMutation({
    mutationFn: (text: string) =>
      sdk.client.fetch<Response>(`/admin/trade-applications/${id}/reject`, {
        method: "POST",
        body: { reason: text },
      }),
    onSuccess: (res) => {
      onDone(res)
      setRejecting(false)
      setReason("")
      toast.success(`${res.trade_application.company_name} rejected.`)
    },
  })

  const submitReject = () => {
    const text = reason.trim()
    if (!text) {
      setReasonError("Write a reason. The customer will see it in their email.")
      return
    }
    reject.mutate(text)
  }

  if (isLoading) return <Container className="p-0"><PageLoading /></Container>
  if (isError || !data) {
    return (
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <BackLink />
        <Alert variant="error" role="alert">
          {errorMessage(error, "This application could not be loaded.")}
        </Alert>
      </Container>
    )
  }

  const app = data.trade_application
  const busy = approve.isPending || reject.isPending

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level="h1" className="break-words">
            {app.company_name}
          </Heading>
          <Badge color={TRADE_STATUS_COLORS[app.status]}>{TRADE_STATUS_LABELS[app.status]}</Badge>
        </div>
        <Text size="large" className="text-ui-fg-subtle">
          Applied {formatDateTime(app.created_at)}
          {app.status !== "pending" && ` · Decided ${formatDateTime(app.updated_at)}`}
        </Text>
      </div>

      <dl className="divide-y">
        <DetailRow label="Business type">{BUSINESS_TYPE_LABELS[app.business_type]}</DetailRow>
        <DetailRow label="VAT number">{app.vat_number ?? "Not given"}</DetailRow>
        <DetailRow label="Companies House number">
          {app.companies_house_number ? (
            <a
              href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(app.companies_house_number)}`}
              target="_blank"
              rel="noreferrer"
              className="txt-large text-ui-fg-interactive underline"
            >
              {app.companies_house_number} (check on Companies House)
            </a>
          ) : (
            "Not given"
          )}
        </DetailRow>
        <DetailRow label="Contact">{app.contact.name}</DetailRow>
        <DetailRow label="Phone">
          <a href={`tel:${app.contact.phone.replace(/[^\d+]/g, "")}`} className="txt-large text-ui-fg-interactive underline">
            {app.contact.phone}
          </a>
        </DetailRow>
        <DetailRow label="Email">
          <a href={`mailto:${app.contact.email}`} className="txt-large text-ui-fg-interactive break-all underline">
            {app.contact.email}
          </a>
        </DetailRow>
        <DetailRow label="Customer account">
          <Link to={`/customers/${app.customer_id}`} className="txt-large text-ui-fg-interactive underline">
            Open customer
          </Link>
        </DetailRow>
        {app.status === "rejected" && (
          <DetailRow label="Reason given">{app.reason ?? "-"}</DetailRow>
        )}
      </dl>

      {app.status === "pending" ? (
        <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
          {approve.isError && (
            <Alert variant="error" role="alert">
              {errorMessage(approve.error)}
            </Alert>
          )}
          <Text size="large" className="text-ui-fg-subtle">
            The customer gets an email either way.
          </Text>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="large"
              className={`${TAP} w-full sm:w-auto`}
              onClick={() => setConfirmApprove(true)}
              isLoading={approve.isPending}
              disabled={busy}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="large"
              variant="secondary"
              className={`${TAP} w-full sm:w-auto`}
              onClick={() => {
                reject.reset()
                setReasonError(null)
                setRejecting(true)
              }}
              disabled={busy}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 md:px-6">
          <Alert variant={app.status === "approved" ? "success" : "info"}>
            {app.status === "approved"
              ? "Approved. This customer sees trade prices when logged in."
              : "Rejected. The customer can send a new application."}
          </Alert>
        </div>
      )}

      <ConfirmDialog
        open={confirmApprove}
        title={`Approve ${app.company_name}?`}
        description="They will see trade prices when they log in, and we'll email them to say so."
        confirmText="Approve"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => {
          setConfirmApprove(false)
          approve.mutate()
        }}
      />

      <Drawer open={rejecting} onOpenChange={(o) => !busy && setRejecting(o)}>
        <Drawer.Content>
          <form
            className="flex h-full flex-col overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault()
              submitReject()
            }}
          >
            <Drawer.Header>
              <Drawer.Title>Reject {app.company_name}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="flex flex-1 flex-col gap-y-3 overflow-auto p-4">
              {reject.isError && (
                <Alert variant="error" role="alert">
                  {errorMessage(reject.error)}
                </Alert>
              )}
              <Label htmlFor="reject-reason" size="base" weight="plus">
                Reason
              </Label>
              <Text size="large" id="reject-reason-hint" className="text-ui-fg-subtle">
                The customer sees this in their email, so keep it polite and say what they can do,
                e.g. "We couldn't find your company on Companies House. Please check the number and
                apply again."
              </Text>
              <Textarea
                id="reject-reason"
                rows={6}
                className="text-base"
                maxLength={REASON_MAX}
                value={reason}
                aria-invalid={!!reasonError}
                aria-describedby={`reject-reason-hint${reasonError ? " reject-reason-error" : ""}`}
                onChange={(e) => {
                  setReason(e.target.value)
                  setReasonError(null)
                }}
              />
              <Text size="small" className="text-ui-fg-muted">
                {reason.length}/{REASON_MAX}
              </Text>
              {reasonError && (
                <Text size="large" id="reject-reason-error" className="text-ui-fg-error" role="alert">
                  {reasonError}
                </Text>
              )}
            </Drawer.Body>
            <Drawer.Footer>
              <div className="flex w-full items-center justify-end gap-x-2">
                <Drawer.Close asChild>
                  <Button type="button" variant="secondary" className={TAP} disabled={busy}>
                    Cancel
                  </Button>
                </Drawer.Close>
                <Button type="submit" variant="danger" className={TAP} isLoading={reject.isPending}>
                  Reject and email
                </Button>
              </div>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

function BackLink() {
  return (
    <Link
      to="/trade-applications"
      className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center gap-1 self-start"
    >
      <ArrowLeft />
      All trade applications
    </Link>
  )
}

export const handle = {
  breadcrumb: () => "Trade application",
}

export default TradeApplicationPage
