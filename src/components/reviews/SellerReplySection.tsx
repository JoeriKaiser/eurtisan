import { useQueryClient } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { ReportSellerReplyDialog } from '#/components/reviews/ReportSellerReplyDialog'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Textarea } from '#/components/ui/textarea'
import {
  createSellerReply,
  deleteSellerReply,
  reportSellerReply,
  updateSellerReply,
} from '#/lib/reviews'
import type { ProductReviewsResult, ReviewReportReason } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

type SellerReply = NonNullable<ProductReviewsResult['reviews'][number]['sellerReply']>

type ReplyAction = 'create' | 'update' | 'delete' | null

export interface SellerReplySectionProps {
  productId: string
  reviewId: string
  reply: SellerReply | null
  canReply: boolean
}

function formatReplyDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function SellerReplySection({
  productId,
  reviewId,
  reply,
  canReply,
}: SellerReplySectionProps) {
  const queryClient = useQueryClient()
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null)
  const [body, setBody] = useState(reply?.body ?? '')
  const [action, setAction] = useState<ReplyAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reported, setReported] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editorId = useId()
  const editorHintId = useId()

  const refreshReviews = async () => {
    await queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] })
  }

  const focusSection = () => {
    requestAnimationFrame(() => sectionRef.current?.focus())
  }

  const openCreate = () => {
    setActionError(null)
    setSuccess(null)
    setBody('')
    setEditorMode('create')
  }

  const openEdit = () => {
    if (!reply) return
    setActionError(null)
    setSuccess(null)
    setBody(reply.body)
    setEditorMode('edit')
  }

  const closeEditor = () => {
    const mode = editorMode
    setEditorMode(null)
    setActionError(null)
    requestAnimationFrame(() => {
      if (mode === 'edit') editButtonRef.current?.focus()
      else createButtonRef.current?.focus()
    })
  }

  const saveReply = async () => {
    const trimmedBody = body.trim()
    if (!trimmedBody || trimmedBody.length > 2000 || action || !editorMode) return

    const nextAction = editorMode === 'create' ? 'create' : 'update'
    setAction(nextAction)
    setActionError(null)
    setSuccess(null)
    try {
      if (nextAction === 'create') {
        await createSellerReply({ data: { reviewId, body: trimmedBody } })
      } else if (reply) {
        await updateSellerReply({ data: { replyId: reply.id, body: trimmedBody } })
      }
      await refreshReviews()
      setEditorMode(null)
      setSuccess(
        nextAction === 'create' ? m.seller_reply_create_success() : m.seller_reply_update_success(),
      )
      focusSection()
    } catch {
      setActionError(
        nextAction === 'create' ? m.seller_reply_create_error() : m.seller_reply_update_error(),
      )
    } finally {
      setAction(null)
    }
  }

  const removeReply = async () => {
    if (!reply || action) return
    setAction('delete')
    setActionError(null)
    setSuccess(null)
    try {
      await deleteSellerReply({ data: { replyId: reply.id } })
      await refreshReviews()
      setDeleteOpen(false)
      setSuccess(m.seller_reply_delete_success())
      focusSection()
    } catch {
      setActionError(m.seller_reply_delete_error())
    } finally {
      setAction(null)
    }
  }

  const submitReport = async (reason: ReviewReportReason, details: string | null) => {
    if (!reply) return
    setReportBusy(true)
    setReportError(null)
    try {
      await reportSellerReply({ data: { replyId: reply.id, reason, details } })
      await refreshReviews()
      setSuccess(m.seller_reply_report_success())
      setReported(true)
      setReportOpen(false)
    } catch {
      setReportError(m.seller_reply_report_error())
    } finally {
      setReportBusy(false)
    }
  }

  if (!reply && !canReply) return null

  const trimmedLength = body.trim().length
  const editorBusy = action === 'create' || action === 'update'
  const canSave = trimmedLength > 0 && trimmedLength <= 2000 && !editorBusy
  const wasEdited =
    reply && new Date(reply.updatedAt).getTime() > new Date(reply.createdAt).getTime()

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className='mt-4 rounded-xl border border-border-subtle bg-bg-inset px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
      aria-label={m.seller_reply_region_label()}
    >
      {reply && (
        <div>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.seller_reply_official_label()}
              </p>
              <p className='mt-0.5 text-xs text-text-muted'>
                {m.seller_reply_by({ sellerName: reply.sellerName })}
                {' · '}
                <time dateTime={new Date(reply.createdAt).toISOString()}>
                  {formatReplyDate(reply.createdAt)}
                </time>
                {wasEdited ? ` · ${m.seller_reply_edited()}` : null}
              </p>
            </div>

            {reply.canReport && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={reported}
                onClick={() => {
                  setReportError(null)
                  setSuccess(null)
                  setReportOpen(true)
                }}
                aria-label={
                  reported ? m.seller_reply_report_success() : m.seller_reply_report_button()
                }
                title={reported ? m.seller_reply_report_success() : m.seller_reply_report_button()}
              >
                <Flag size={14} aria-hidden='true' />
                {reported ? m.seller_reply_reported_button() : m.seller_reply_report_button()}
              </Button>
            )}
          </div>

          {editorMode !== 'edit' && (
            <p className='mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary'>
              {reply.body}
            </p>
          )}

          {reply.canManage && editorMode !== 'edit' && (
            <div className='mt-3 flex flex-wrap gap-2'>
              <Button
                ref={editButtonRef}
                type='button'
                variant='secondary'
                size='sm'
                onClick={openEdit}
              >
                {m.seller_reply_edit_button()}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setActionError(null)
                  setSuccess(null)
                  setDeleteOpen(true)
                }}
              >
                {m.seller_reply_delete_button()}
              </Button>
            </div>
          )}
        </div>
      )}

      {!reply && editorMode !== 'create' && (
        <div>
          <p className='text-sm text-text-secondary'>{m.seller_reply_owner_prompt()}</p>
          <Button
            ref={createButtonRef}
            type='button'
            variant='secondary'
            size='sm'
            className='mt-3'
            onClick={openCreate}
          >
            {m.seller_reply_create_button()}
          </Button>
        </div>
      )}

      {editorMode && (
        <form
          className={reply ? 'mt-3' : ''}
          onSubmit={(event) => {
            event.preventDefault()
            void saveReply()
          }}
        >
          <label htmlFor={editorId} className='text-sm font-medium text-text-primary'>
            {editorMode === 'create' ? m.seller_reply_create_label() : m.seller_reply_edit_label()}
          </label>
          <Textarea
            id={editorId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={2000}
            disabled={editorBusy}
            className='mt-1'
            aria-describedby={editorHintId}
            autoFocus
          />
          <p id={editorHintId} className='mt-1 text-xs text-text-muted'>
            {m.seller_reply_body_hint({ count: body.length })}
          </p>
          {actionError && (
            <p className='mt-2 text-sm text-error' role='alert'>
              {actionError}
            </p>
          )}
          <div className='mt-3 flex flex-wrap gap-2'>
            <Button type='submit' size='sm' isLoading={editorBusy} disabled={!canSave}>
              {editorMode === 'create'
                ? m.seller_reply_publish_button()
                : m.seller_reply_save_button()}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={editorBusy}
              onClick={closeEditor}
            >
              {m.confirm_dialog_cancel()}
            </Button>
          </div>
        </form>
      )}

      {actionError && !editorMode && (
        <p className='mt-3 text-sm text-error' role='alert'>
          {actionError}
        </p>
      )}
      {success && (
        <p className='mt-3 text-sm text-success' role='status' aria-live='polite'>
          {success}
        </p>
      )}

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && action !== 'delete') {
            setDeleteOpen(false)
            setActionError(null)
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-md p-6'>
            <DialogTitle>{m.seller_reply_delete_title()}</DialogTitle>
            <DialogDescription>{m.seller_reply_delete_description()}</DialogDescription>
            {actionError && (
              <p className='mt-3 text-sm text-error' role='alert'>
                {actionError}
              </p>
            )}
            <div className='mt-6 flex justify-end gap-2'>
              <Button
                type='button'
                variant='secondary'
                disabled={action === 'delete'}
                onClick={() => setDeleteOpen(false)}
              >
                {m.confirm_dialog_cancel()}
              </Button>
              <Button
                type='button'
                variant='danger'
                isLoading={action === 'delete'}
                onClick={() => void removeReply()}
              >
                {m.seller_reply_delete_confirm()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      {reply && (
        <ReportSellerReplyDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          busy={reportBusy}
          error={reportError}
          onSubmit={(reason, details) => void submitReport(reason, details)}
        />
      )}
    </section>
  )
}
