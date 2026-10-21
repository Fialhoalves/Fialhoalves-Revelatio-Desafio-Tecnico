import { useState } from 'react'
import type { TaskStats } from '../types'
import { Odometer } from './Odometer'

function Card({ label, value, tone, index }: { label: string; value: number; tone: string; index: number }) {
  return (
    <div className="animate-rise rounded-md border border-white/12 bg-white/4 p-3 sm:p-4" style={{ animationDelay: `${index * 70}ms` }}>
      <p className="text-xs text-white/60">{label}</p>
      <p className={`mt-1.5 text-4xl tracking-[-0.04em] sm:mt-3 sm:text-5xl ${tone}`}>
        <Odometer value={value} />
      </p>
    </div>
  )
}

export function StatsCards({ stats, onSelectOwner }: { stats: TaskStats; onSelectOwner?: (ownerId: number) => void }) {
  // No celular o resumo por usuário começa recolhido para o quadro aparecer sem tanta rolagem.
  const [showOwners, setShowOwners] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  return (
    <section aria-label="Resumo das tarefas" className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
        <Card index={0} label="Total" value={stats.total} tone="text-white" />
        <Card index={1} label="Pendentes" value={stats.by_status.PENDING} tone="text-amber-300" />
        <Card index={2} label="Em andamento" value={stats.by_status.IN_PROGRESS} tone="text-sky-300" />
        <Card index={3} label="Concluídas" value={stats.by_status.DONE} tone="text-emerald-300" />
        <Card index={4} label="Atrasadas" value={stats.overdue} tone="text-red-300" />
      </div>

      {stats.by_owner && stats.by_owner.length > 0 && (
        <div className="animate-rise overflow-x-auto rounded-md border border-white/12 bg-white/4" style={{ animationDelay: '350ms' }}>
          <table className="w-full text-left text-sm">
            <caption className="text-left text-base">
              <button
                type="button"
                aria-expanded={showOwners}
                onClick={() => setShowOwners((value) => !value)}
                className="flex min-h-11 w-full items-center justify-between px-4 pt-2 text-left md:min-h-0 md:pt-4"
              >
                Por usuário
                <span aria-hidden="true" className="text-white/60 md:hidden">
                  {showOwners ? '−' : '+'}
                </span>
              </button>
            </caption>
            <thead className={`text-xs text-white/60 ${showOwners ? '' : 'hidden'}`}>
              <tr>
                <th className="px-4 py-3 font-normal">Usuário</th>
                <th className="px-4 py-3 font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Pendentes</th>
                <th className="px-4 py-3 font-normal">Em andamento</th>
                <th className="px-4 py-3 font-normal">Concluídas</th>
              </tr>
            </thead>
            <tbody className={showOwners ? '' : 'hidden'}>
              {stats.by_owner.map((owner) => (
                <tr key={owner.owner_id} className="border-t border-white/8">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectOwner?.(owner.owner_id)}
                      aria-label={`Ver tarefas de ${owner.owner_name}`}
                      className="min-h-11 text-left underline-offset-4 hover:underline md:min-h-0"
                    >
                      {owner.owner_name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">{owner.total}</td>
                  <td className="px-4 py-2.5 text-white/70">{owner.by_status.PENDING}</td>
                  <td className="px-4 py-2.5 text-white/70">{owner.by_status.IN_PROGRESS}</td>
                  <td className="px-4 py-2.5 text-white/70">{owner.by_status.DONE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
