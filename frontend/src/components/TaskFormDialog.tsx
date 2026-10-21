import { useState, type FormEvent } from 'react'
import { attachmentsApi, tasksApi } from '../api/endpoints'
import { downloadAttachment, isPreviewable } from '../lib/download'
import { ApiError, errorMessage, fieldErrors } from '../lib/errors'
import { ACCEPTED_TYPES, checkFile, formatSize, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import type { Attachment, Priority, Task, TaskInput, TaskStatus } from '../types'
import { AttachmentPreview } from './AttachmentPreview'
import { useToast } from './Toast'
import { Alert, Button, Field, inputClass, Modal, Spinner } from './ui'

interface Props {
  task: Task | null
  onClose: () => void
  onChanged: () => void
}

export function TaskFormDialog({ task, onClose, onChanged }: Props) {
  const toast = useToast()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [files, setFiles] = useState<File[]>([])
  const [fileProblems, setFileProblems] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments ?? [])
  const [confirmingRemoval, setConfirmingRemoval] = useState<number | null>(null)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pickFiles = (selected: FileList | null) => {
    if (!selected) return
    const accepted: File[] = []
    const problems: string[] = []
    for (const file of Array.from(selected)) {
      const problem = checkFile(file)
      if (problem) problems.push(problem)
      else accepted.push(file)
    }
    setFiles((current) => [...current, ...accepted])
    setFileProblems(problems)
  }

  const removeAttachment = async (attachment: Attachment) => {
    try {
      await attachmentsApi.remove(attachment.id)
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
      setConfirmingRemoval(null)
      onChanged()
    } catch (error) {
      toast.error(errorMessage(error))
      if (error instanceof ApiError && error.code === 'ATTACHMENT_NOT_FOUND') {
        setAttachments((current) => current.filter((item) => item.id !== attachment.id))
        onChanged()
      }
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setSubmitting(true)

    const payload: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      status,
      priority,
    }

    try {
      const saved = task ? await tasksApi.update(task.id, payload) : await tasksApi.create(payload)

      // A tarefa já está salva: falha em um arquivo não desfaz o restante.
      const failures: string[] = []
      for (const file of files) {
        try {
          await attachmentsApi.upload(saved.id, file)
        } catch (error) {
          failures.push(`${file.name}: ${errorMessage(error)}`)
        }
      }

      onChanged()
      if (failures.length > 0) {
        toast.error(`Tarefa salva, mas alguns arquivos não foram enviados. ${failures.join(' ')} Abra a tarefa para tentar de novo.`)
      } else {
        toast.success(task ? 'Tarefa atualizada.' : 'Tarefa criada.')
      }
      onClose()
    } catch (error) {
      setErrors(fieldErrors(error))
      setFormError(errorMessage(error))
      if (error instanceof ApiError && error.code === 'TASK_NOT_FOUND') {
        onChanged()
        onClose()
        toast.error(errorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {formError && <Alert>{formError}</Alert>}

          <Field label="Título" error={errors.title}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              autoFocus
              className={inputClass}
            />
          </Field>

          <Field label="Descrição" error={errors.description}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={5000}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Prazo" error={errors.due_date}>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Status" error={errors.status}>
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className={inputClass}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade" error={errors.priority}>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className={inputClass}>
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {attachments.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Anexos da tarefa</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {attachment.original_name} <span className="text-xs text-slate-500">({formatSize(attachment.size)})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          isPreviewable(attachment)
                            ? setPreview(attachment)
                            : downloadAttachment(attachment).catch((error) => toast.error(errorMessage(error)))
                        }
                      >
                        {isPreviewable(attachment) ? 'Visualizar' : 'Baixar'}
                      </Button>
                      {confirmingRemoval === attachment.id ? (
                        <>
                          <Button type="button" variant="danger" onClick={() => removeAttachment(attachment)}>
                            Confirmar
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setConfirmingRemoval(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setConfirmingRemoval(attachment.id)}
                        >
                          Remover
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Field label="Adicionar anexos" hint="Imagens, PDF, TXT, CSV, Word ou Excel. Até 10 MB por arquivo.">
              <input
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(event) => {
                  pickFiles(event.target.files)
                  event.target.value = ''
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </Field>
            {fileProblems.length > 0 && (
              <ul role="alert" className="mt-2 space-y-0.5 text-xs text-red-600">
                {fileProblems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                    <span className="truncate">
                      {file.name} <span className="text-xs text-slate-500">({formatSize(file.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="ml-2 text-xs font-medium text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting && <Spinner className="size-4 border-white/40 border-t-white" />}
              {task ? 'Salvar alterações' : 'Criar tarefa'}
            </Button>
          </div>
        </form>
      </Modal>

      {preview && <AttachmentPreview attachment={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
