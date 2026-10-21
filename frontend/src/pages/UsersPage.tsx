import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/endpoints'
import { AppHeader } from '../components/AppHeader'
import { Alert, Badge, Spinner } from '../components/ui'
import { errorMessage } from '../lib/errors'

export default function UsersPage() {
  const users = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6 pb-16">
        <h2 className="animate-rise text-4xl tracking-[-0.04em] sm:text-5xl">Usuários</h2>

        {users.isPending && <Spinner className="mx-auto mt-10 block size-8" />}
        {users.isError && <Alert>{errorMessage(users.error)}</Alert>}

        {users.data && (
          <div className="animate-rise overflow-x-auto rounded-md border border-white/12 bg-white/4">
            <table className="w-full text-left text-sm">
              <caption className="px-4 pt-4 text-left text-base">
                {users.data.length} {users.data.length === 1 ? 'usuário' : 'usuários'}
              </caption>
              <thead className="text-xs text-white/60">
                <tr>
                  <th className="px-4 py-3 font-normal">Nome</th>
                  <th className="hidden px-4 py-3 font-normal sm:table-cell">E-mail</th>
                  <th className="px-4 py-3 font-normal">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id} className="border-t border-white/8">
                    <td className="px-4 py-3">
                      {user.name}
                      {/* No celular o e-mail desce para baixo do nome, para o perfil caber na tela. */}
                      <span className="block break-all text-xs text-white/60 sm:hidden">{user.email}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-white/70 sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={user.role === 'ADMIN' ? 'indigo' : 'slate'}>{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
