'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Shield,
  UserPlus,
  Trash2,
  CheckCircle,
  XCircle,
  Database,
  Lock,
  X,
  Server,
  Key,
} from 'lucide-react'
import { createUser, toggleUserStatus, deleteUser } from './actions'
import { useConfirm } from '@/components/ConfirmDialog'

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  last_login?: string | null
  created_at: string
}

export function ConfiguracoesClient({
  currentUser,
  users,
}: {
  currentUser: { id: string; name: string; email: string; role: string }
  users: UserItem[]
}) {
  const router = useRouter()
  const [localUsers, setLocalUsers] = useState<UserItem[]>(users)

  useEffect(() => {
    setLocalUsers(users)
  }, [users])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await createUser(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsModalOpen(false)
        form.reset()
        router.refresh()
      }
    })
  }

  const handleToggleStatus = (id: string, active: boolean) => {
    // Otimista
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active: !active } : u))
    )
    setLoadingId(id)
    startTransition(async () => {
      const res = await toggleUserStatus(id, active)
      if (res?.error) alert(res.error)
      setLoadingId(null)
      router.refresh()
    })
  }

  const handleDeleteUser = (id: string, name: string) => {
    confirm(`Tem certeza que deseja excluir permanentemente o usuário "${name}"?`).then(ok => {
      if (!ok) return
      setLocalUsers((prev) => prev.filter((u) => u.id !== id))
      setLoadingId(id)
      startTransition(async () => {
        await deleteUser(id)
        setLoadingId(null)
        router.refresh()
      })
    })
  }

  const isAdmin = currentUser.role === 'admin'

  return (
    <div className="space-y-8 max-w-5xl">
      <ConfirmDialog />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Configurações do Sistema</h1>
        <p className="text-sm text-[#6e6e73]">
          Gestão de contas de acesso, segurança e parâmetros da plataforma ERP.
        </p>
      </div>

      {/* Perfil do Usuário Logado */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#f5f5f7] p-2 text-[#1d1d1f]">
              <User className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">Meu Perfil de Acesso</h2>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#e8f8ee] px-2.5 py-0.5 text-xs font-semibold text-[#1a7f37]">
            Sessão Autenticada
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-[#f9f9fb] border border-[#f2f2f7]">
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Nome</span>
            <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{currentUser.name || 'Usuário'}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#f9f9fb] border border-[#f2f2f7]">
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">E-mail Corporativo</span>
            <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{currentUser.email}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#f9f9fb] border border-[#f2f2f7]">
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Nível de Permissão</span>
            <p className="text-sm font-semibold capitalize text-[#0071e3] mt-0.5">{currentUser.role}</p>
          </div>
        </div>
      </div>

      {/* Gestão de Usuários (Apenas Admin) */}
      {isAdmin && (
        <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-[#f2f2f7] gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#1d1d1f]" />
                <h2 className="text-base font-semibold text-[#1d1d1f]">Usuários do Sistema</h2>
              </div>
              <p className="text-xs text-[#6e6e73] mt-0.5">
                Cadastre e gerencie credenciais dos operadores e equipe da Luh Recepções.
              </p>
            </div>
            <button
              onClick={() => {
                setErrorMessage(null)
                setIsModalOpen(true)
              }}
              className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <UserPlus size={14} strokeWidth={2.2} />
              <span>Novo Usuário</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1d1d1f]">
              <thead className="bg-[#f9f9fb] text-xs font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Nome</th>
                  <th className="px-5 py-3.5 font-medium">E-mail</th>
                  <th className="px-5 py-3.5 font-medium">Cargo / Função</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Último Login</th>
                  <th className="px-5 py-3.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f2f7]">
                {localUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#fbfbfd] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#1d1d1f]">
                      {u.name}
                      {u.id === currentUser.id && (
                        <span className="ml-2 text-[10px] font-semibold bg-[#e8f8ee] text-[#1a7f37] px-2 py-0.5 rounded-full">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6e6e73]">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-lg bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#1d1d1f] capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.active ? 'bg-[#e8f8ee] text-[#1a7f37]' : 'bg-[#feeceb] text-[#cf222e]'
                        }`}
                      >
                        {u.active ? (
                          <>
                            <CheckCircle size={11} /> Ativo
                          </>
                        ) : (
                          <>
                            <XCircle size={11} /> Inativo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#86868b]">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'Nunca'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.id !== currentUser.id && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(u.id, u.active)}
                            disabled={loadingId === u.id}
                            className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] px-2 py-1 rounded-lg hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                          >
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={loadingId === u.id}
                            className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                            title="Remover usuário"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status da Infraestrutura & Banco */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-[#f5f5f7] p-2 text-[#1d1d1f]">
            <Server className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1d1d1f]">Infraestrutura & Segurança</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#f2f2f7] bg-[#f9f9fb]">
            <Database className="h-5 w-5 text-[#34c759] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-[#1d1d1f]">Banco de Dados Supabase (PostgreSQL 16)</p>
              <p className="text-[#6e6e73] mt-0.5">Conectado via Service Role & RLS de isolamento em tempo real.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#f2f2f7] bg-[#f9f9fb]">
            <Lock className="h-5 w-5 text-[#0071e3] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-[#1d1d1f]">Criptografia & Autenticação Customizada</p>
              <p className="text-[#6e6e73] mt-0.5">Senhas criptografadas em BCrypt com 12 salt rounds e JWT seguro.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">Novo Usuário</h3>
                <p className="text-xs text-[#6e6e73]">Crie credenciais de acesso ao ERP Luh Recepções.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: Luciana Oliveira"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  E-mail de Login *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="usuario@luhrecepcoes.com.br"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Senha Provisória *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Perfil de Acesso (Cargo) *
                </label>
                <select
                  name="role"
                  defaultValue="leitura"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="admin">Administrador (Acesso Total)</option>
                  <option value="financeiro">Financeiro (Receitas, Despesas & Contratos)</option>
                  <option value="estoque">Estoque (Mobiliário, Louças & Movimentações)</option>
                  <option value="leitura">Somente Leitura (Consulta Geral)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
