import { useEffect, useState } from 'react'
import { attachmentsApi } from '../api/endpoints'
import { downloadAttachment, isImage, isPdf, isPreviewable, isText } from '../lib/download'
import { errorMessage } from '../lib/errors'
import { formatSize } from '../lib/format'
import type { Attachment } from '../types'
import { Alert, Button, Modal, Spinner } from './ui'
import { useToast } from './Toast'

// Textos longos são cortados na tela; o arquivo completo continua disponível para download.
const MAX_TEXT_CHARS = 20000

export function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const toast = useToast()
  const previewable = isPreviewable(attachment)
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!previewable) return
    let objectUrl: string | null = null
    let cancelled = false
    attachmentsApi
      .fetchFile(attachment.id, true)
      .then(async (blob) => {
        if (cancelled) return
        if (isText(attachment)) {
          setText((await blob.text()).slice(0, MAX_TEXT_CHARS))
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, previewable])

  const download = () => downloadAttachment(attachment).catch((err) => toast.error(errorMessage(err)))
  const loading = previewable && !error && url === null && text === null

  return (
    <Modal title={attachment.original_name} onClose={onClose} size="lg">
      <div className="flex min-h-48 items-center justify-center rounded-md bg-white/6">
        {error && (
          <div className="p-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {loading && <Spinner />}
        {url && isImage(attachment) && (
          <img src={url} alt={attachment.original_name} className="max-h-[65vh] max-w-full object-contain" />
        )}
        {url && isPdf(attachment) && (
          <iframe src={url} title={attachment.original_name} className="h-[65vh] w-full rounded-md bg-white" />
        )}
        {text !== null && (
          <pre className="max-h-[65vh] w-full overflow-auto whitespace-pre-wrap break-words p-4 text-left font-mono text-xs text-white/80">
            {text || 'Arquivo vazio.'}
          </pre>
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
