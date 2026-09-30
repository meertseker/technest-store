import { ArrowLeft } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { DetailRow, PageLoading, TAP } from "../../../components/shop-ui"
import { sdk } from "../../../lib/client"
import { errorMessage, formatDateTime, timeAgo } from "../../../lib/format"
import { REPAIR_STATUSES, RepairBooking, RepairBookingStatus } from "../../../lib/types"
import { REPAIR_STATUS_COLORS, REPAIR_STATUS_HINTS, REPAIR_STATUS_LABELS } from "../shared"

// One repair booking: contact details, status and staff notes (docs/contracts/repairs.md).

const NOTES_MAX = 5000

type Response = { repair_booking: RepairBooking }
type UpdateBody = { status?: RepairBookingStatus; notes?: string | null }

const RepairBookingPage = () => {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const key = ["repair-bookings", "detail", id]
  const [notes, setNotes] = useState("")

  const { data, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => sdk.client.fetch<Response>(`/admin/repair-bookings/${id}`),
  })
  const booking = data?.repair_booking
  const savedNotes = booking?.notes ?? ""

  useEffect(() => setNotes(savedNotes), [savedNotes])

  const update = useMutation({
    mutationFn: (body: UpdateBody) =>
      sdk.client.fetch<Response>(`/admin/repair-bookings/${id}`, { method: "POST", body }),
    onSuccess: (res, body) => {
      queryClient.setQueryData(key, res)
      queryClient.invalidateQueries({ queryKey: ["repair-bookings", "list"] })
      toast.success(
        body.status
          ? `Marked as ${REPAIR_STATUS_LABELS[body.status].toLowerCase()}.`
          : "Notes saved."
      )
    },
  })

  if (isLoading) {
    return (
      <Container className="p-0">
        <PageLoading />
      </Container>
    )
  }
  if (isError || !booking) {
    return (
      <Container className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <BackLink />
        <Alert variant="error" role="alert">
          {errorMessage(error, "This booking could not be loaded.")}
        </Alert>
      </Container>
    )
  }

  const notesChanged = notes.trim() !== savedNotes.trim()
  const pendingStatus = update.isPending ? update.variables?.status : undefined

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level="h1" className="break-words">
            {booking.device}
          </Heading>
          <Badge color={REPAIR_STATUS_COLORS[booking.status]}>
            {REPAIR_STATUS_LABELS[booking.status]}
          </Badge>
        </div>
        <Text size="large" className="text-ui-fg-subtle">
          Sent {formatDateTime(booking.created_at)} ({timeAgo(booking.created_at)})
        </Text>
      </div>

      <dl className="divide-y">
        <DetailRow label="Name">{booking.name}</DetailRow>
        <DetailRow label="Phone">
          <a
            href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}
            className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center underline"
          >
            {booking.phone}
          </a>
        </DetailRow>
        <DetailRow label="Email">
          <a
            href={`mailto:${booking.email}`}
            className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center break-all underline"
          >
            {booking.email}
          </a>
        </DetailRow>
        <DetailRow label="Device">{booking.device}</DetailRow>
        <DetailRow label="What's wrong">
          <Text size="large" className="whitespace-pre-wrap">
            {booking.fault}
          </Text>
        </DetailRow>
        <DetailRow label="Best time to call">{booking.preferred_time}</DetailRow>
      </dl>

      <section className="flex flex-col gap-3 px-4 py-4 md:px-6" aria-labelledby="repair-status">
        <Heading level="h2" id="repair-status">
          Status
        </Heading>
        {update.isError && (
          <Alert variant="error" role="alert">
            {errorMessage(update.error)}
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Status">
          {REPAIR_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="large"
              variant={booking.status === s ? "primary" : "secondary"}
              aria-pressed={booking.status === s}
              className={`${TAP} h-auto w-full flex-col items-start gap-0 py-2 text-left`}
              onClick={() => booking.status !== s && update.mutate({ status: s })}
              isLoading={pendingStatus === s}
              disabled={update.isPending}
            >
              <span className="txt-compact-large-plus">{REPAIR_STATUS_LABELS[s]}</span>
              <span className="txt-compact-small font-normal opacity-80">
                {REPAIR_STATUS_HINTS[s]}
              </span>
            </Button>
          ))}
        </div>
      </section>

      <form
        className="flex flex-col gap-3 px-4 py-4 md:px-6"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate({ notes: notes.trim() ? notes.trim() : null })
        }}
      >
        <Label htmlFor="repair-notes" size="base" weight="plus">
          Staff notes
        </Label>
        <Text size="large" id="repair-notes-hint" className="text-ui-fg-subtle">
          Only staff see these, e.g. the price you quoted or the booked-in time.
        </Text>
        <Textarea
          id="repair-notes"
          rows={5}
          className="text-base"
          maxLength={NOTES_MAX}
          aria-describedby="repair-notes-hint"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          type="submit"
          size="large"
          variant="secondary"
          className={`${TAP} w-full self-start sm:w-auto`}
          disabled={!notesChanged || update.isPending}
          isLoading={update.isPending && update.variables?.notes !== undefined}
        >
          Save notes
        </Button>
      </form>
    </Container>
  )
}

function BackLink() {
  return (
    <Link
      to="/repair-bookings"
      className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center gap-1 self-start"
    >
      <ArrowLeft />
      All repair bookings
    </Link>
  )
}

export const handle = {
  breadcrumb: () => "Repair booking",
}

export default RepairBookingPage
