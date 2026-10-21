import type { TaskStats } from '../types'

function Card({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

export function StatsCards({ stats }: { stats: TaskStats }) {
  return (
    <section aria-label="Resumo das tarefas" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card label="Total" value={stats.total} tone="text-slate-900" />
        <Card label="Pendentes" value={stats.by_status.PENDING} tone="text-amber-600" />
        <Card label="Em andamento" value={stats.by_status.IN_PROGRESS} tone="text-blue-600" />
        <Card label="Concluídas" value={stats.by_status.DONE} tone="text-emerald-600" />
        <Card label="Atrasadas" value={stats.overdue} tone="text-red-600" />
      </div>

      {stats.by_owner && stats.by_owner.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="px-4 pt-3 text-left text-sm font-semibold">Por usuário</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Usuário</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Pendentes</th>
                <th className="px-4 py-2 font-medium">Em andamento</th>
                <th className="px-4 py-2 font-medium">Concluídas</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_owner.map((owner) => (
                <tr key={owner.owner_id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{owner.owner_name}</td>
                  <td className="px-4 py-2">{owner.total}</td>
                  <td className="px-4 py-2">{owner.by_status.PENDING}</td>
                  <td className="px-4 py-2">{owner.by_status.IN_PROGRESS}</td>
                  <td className="px-4 py-2">{owner.by_status.DONE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
