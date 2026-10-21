import { useEffect, useState } from 'react'
import { attachmentsApi } from '../api/endpoints'
import { downloadAttachment, isImage, isPdf, isPreviewable } from '../lib/download'
import { errorMessage } from '../lib/errors'
import { formatSize } from '../lib/format'
import type { Attachment } from '../types'
import { Alert, Button, Modal, Spinner } from './ui'
import { useToast } from './Toast'

export function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const toast = useToast()
  const previewable = isPreviewable(attachment)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!previewable) return
    let objectUrl: string | null = null
    let cancelled = false
    attachmentsApi
      .fetchFile(attachment.id, true)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id, previewable])

  const download = () => downloadAttachment(attachment).catch((err) => toast.error(errorMessage(err)))

  return (
    <Modal title={attachment.original_name} onClose={onClose} size="lg">
      <div className="flex min-h-48 items-center justify-center rounded-md bg-white/6">
        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {!error && previewable && !url && <Spinner />}
        {url && isImage(attachment) && (
          <img src={url} alt={attachment.original_name} className="max-h-[65vh] max-w-full object-contain" />
        )}
        {url && isPdf(attachment) && (
          <iframe src={url} title={attachment.original_name} className="h-[65vh] w-full rounded-md bg-white" />
        )}
        {!previewable && (
          <p className="p-6 text-center text-sm text-white/60">
            Este tipo de arquivo não tem pré-visualização. Faça o download para abrir.
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-white/60">{formatSize(attachment.size)}</span>
        <Button onClick={download}>Baixar arquivo</Button>
      </div>
    </Modal>
  )
}
