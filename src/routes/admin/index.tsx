import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  type AdminUserRow,
  banAdminUserFn,
  deleteAdminUserFn,
  listAdminUsersFn,
  unbanAdminUserFn,
} from '@/lib/admin-server'
import { confirm } from '@/lib/confirm'

export const Route = createFileRoute('/admin/')({
  loader: () => listAdminUsersFn(),
  component: AdminUsersPage,
})

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function AdminUsersPage() {
  const initial = Route.useLoaderData()
  const [users, setUsers] = useState<AdminUserRow[]>(initial)
  const [pending, setPending] = useState<string | null>(null)

  async function reload() {
    const rows = await listAdminUsersFn()
    setUsers(rows)
  }

  async function handleBan(userId: string, currentlyBanned: boolean) {
    setPending(userId)
    if (currentlyBanned) {
      await unbanAdminUserFn({ data: { userId } })
    } else {
      await banAdminUserFn({ data: { userId } })
    }
    await reload()
    setPending(null)
  }

  async function handleDelete(userId: string, name: string) {
    const ok = await confirm(
      `Deletar permanentemente o usuário "${name}" e todos os dados? Esta ação não pode ser desfeita.`,
    )
    if (!ok) return
    setPending(userId)
    await deleteAdminUserFn({ data: { userId } })
    await reload()
    setPending(null)
  }

  const totalUsers = users.length
  const bannedUsers = users.filter((u) => u.banned).length
  const totalHoldings = users.reduce((s, u) => s + u.holdingsCount, 0)
  const totalInvestments = users.reduce((s, u) => s + u.investmentsCount, 0)

  return (
    <main>
      <div className="mb-8">
        <p className="mb-1 font-label text-xs font-semibold uppercase tracking-[0.2em] text-outline">
          Admin
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
          Usuários
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Gerencie contas e visualize dados dos usuários da plataforma.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Usuários', value: totalUsers, icon: 'group' },
          { label: 'Bloqueados', value: bannedUsers, icon: 'block' },
          { label: 'Investimentos', value: totalInvestments, icon: 'payments' },
          { label: 'Posições', value: totalHoldings, icon: 'pie_chart' },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-5"
          >
            <span className="material-symbols-outlined text-xl leading-none text-outline">
              {icon}
            </span>
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-outline">
              {label}
            </p>
            <p className="font-headline text-3xl font-extrabold text-on-surface">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container-low">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              {['Usuário', 'Criado em', 'Último acesso', 'Tipos', 'Investimentos', 'Posições', 'Status', 'Ações'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-label text-xs font-semibold uppercase tracking-wider text-outline"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-outline-variant/10 transition-colors last:border-0 hover:bg-surface-container ${u.banned ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-on-surface">{u.name}</p>
                  <p className="text-xs text-outline">{u.email}</p>
                  {u.role === 'admin' && (
                    <span className="mt-0.5 inline-block rounded-full bg-primary-container px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-primary">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-outline">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3 text-outline">{fmt(u.lastSeen)}</td>
                <td className="px-4 py-3 tabular-nums text-on-surface">{u.typesCount}</td>
                <td className="px-4 py-3 tabular-nums text-on-surface">{u.investmentsCount}</td>
                <td className="px-4 py-3 tabular-nums text-on-surface">{u.holdingsCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider ${
                      u.banned
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-secondary-container text-on-secondary-container'
                    }`}
                  >
                    {u.banned ? 'bloqueado' : 'ativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBan(u.id, u.banned)}
                        disabled={pending === u.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-label text-xs font-semibold transition-opacity disabled:opacity-50 ${
                          u.banned
                            ? 'bg-secondary-container text-on-secondary-container hover:opacity-80'
                            : 'bg-error-container text-on-error-container hover:opacity-80'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm leading-none">
                          {u.banned ? 'lock_open' : 'block'}
                        </span>
                        {u.banned ? 'Desbloquear' : 'Bloquear'}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        disabled={pending === u.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-error px-2.5 py-1.5 font-label text-xs font-semibold text-on-error transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">
                          delete
                        </span>
                        Deletar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
