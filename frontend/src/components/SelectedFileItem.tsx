import { useEffect, useState } from 'react'
import { formatSize } from '../lib/format'
import { Button, Modal } from './ui'

const isImageFile = (file: File) => file.type.startsWith('image/')
const isPdfFile = (file: File) => file.type === 'application/pdf'

function extensionOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].slice(0, 4).toUpperCase() : 'ARQ'
}

/** Arquivo escolhido no formulário e ainda não enviado, com miniatura e visualização para conferência. */
export function SelectedFileItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const previewable = isImageFile(file) || isPdfFile(file)
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!previewable) return
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, previewable])

  return (
    <li className="flex items-center gap-3 rounded-md bg-white/6 p-2 text-sm">
      {url && isImageFile(file) ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Visualizar ${file.name}`} className="shrink-0">
          <img src={url} alt="" className="size-11 rounded-[3px] object-cover" />
        </button>
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-white/16 text-[11px] text-white/60">
          {extensionOf(file.name)}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate">{file.name}</span>
        <span className="text-xs text-white/60">{formatSize(file.size)}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {previewable && url && (
          <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
            Visualizar
          </Button>
        )}
        <Button type="button" variant="danger" onClick={onRemove}>
          Remover
        </Button>
      </span>

      {open && url && (
        <Modal title={file.name} onClose={() => setOpen(false)} size="lg">
          <div className="flex min-h-48 items-center justify-center rounded-md bg-white/6">
            {isImageFile(file) ? (
              <img src={url} alt={file.name} className="max-h-[65vh] max-w-full object-contain" />
            ) : (
              <iframe src={url} title={file.name} className="h-[65vh] w-full rounded-md bg-white" />
            )}
          </div>
          <p className="mt-3 text-xs text-white/60">Arquivo selecionado, ainda não enviado. Ele será anexado ao salvar a tarefa.</p>
        </Modal>
      )}
    </li>
  )
}
