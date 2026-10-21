import { attachmentsApi } from '../api/endpoints'
import type { Attachment } from '../types'

/** Baixa o anexo via fetch autenticado e dispara o download no navegador. */
export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const blob = await attachmentsApi.fetchFile(attachment.id, false)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.original_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function isImage(attachment: Attachment): boolean {
  return attachment.content_type.startsWith('image/')
}

export function isPdf(attachment: Attachment): boolean {
  return attachment.content_type === 'application/pdf'
}

export function isText(attachment: Attachment): boolean {
  return attachment.content_type === 'text/plain' || attachment.content_type === 'text/csv'
}

export function isPreviewable(attachment: Attachment): boolean {
  return isImage(attachment) || isPdf(attachment) || isText(attachment)
}
