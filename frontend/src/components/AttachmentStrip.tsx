import { useQuery } from '@tanstack/react-query'
import { attachmentsApi } from '../api/endpoints'
import { isImage } from '../lib/download'
import type { Attachment } from '../types'

// Miniaturas só para imagens pequenas, para o quadro não baixar arquivos grandes sem o usuário pedir.
const MAX_THUMBNAIL_BYTES = 1024 * 1024
const VISIBLE_TILES = 3

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function extensionOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].slice(0, 4).toUpperCase() : 'ARQ'
}

const tileClass =
  'relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-white/16 bg-white/5 text-[11px] text-white/60 transition-colors hover:border-white/50 disabled:cursor-default disabled:hover:border-white/16 md:size-10'

function Tile({ attachment, onPreview }: { attachment: Attachment; onPreview?: (attachment: Attachment) => void }) {
  const showThumbnail = isImage(attachment) && attachment.size <= MAX_THUMBNAIL_BYTES
  const thumbnail = useQuery({
    queryKey: ['thumbnail', attachment.id],
    queryFn: async () => blobToDataUrl(await attachmentsApi.fetchFile(attachment.id, true)),
    enabled: showThumbnail,
    staleTime: Infinity,
  })

  return (
    <button
      type="button"
      data-nodrag
      disabled={!onPreview}
      title={attachment.original_name}
      aria-label={`Visualizar ${attachment.original_name}`}
      onClick={() => onPreview?.(attachment)}
      className={tileClass}
    >
      {thumbnail.data ? (
        <img src={thumbnail.data} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        extensionOf(attachment.original_name)
      )}
    </button>
  )
}

/** Fileira de anexos do cartão: miniatura ou tipo do arquivo, com preview ao clicar. */
export function AttachmentStrip({
  attachments,
  onPreview,
  onMore,
}: {
  attachments: Attachment[]
  onPreview?: (attachment: Attachment) => void
  onMore?: () => void
}) {
  if (attachments.length === 0) return null
  const rest = attachments.length - VISIBLE_TILES

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {attachments.slice(0, VISIBLE_TILES).map((attachment) => (
        <Tile key={attachment.id} attachment={attachment} onPreview={onPreview} />
      ))}
      {rest > 0 && (
        <button
          type="button"
          data-nodrag
          disabled={!onMore}
          onClick={onMore}
          aria-label={`Ver os outros ${rest} anexos`}
          className={tileClass}
        >
          +{rest}
        </button>
      )}
    </div>
  )
}
