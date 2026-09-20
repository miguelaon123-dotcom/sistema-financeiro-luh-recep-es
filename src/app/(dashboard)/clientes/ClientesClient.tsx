'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Users, Phone, Mail, FileText, Trash2, Pencil, X, Check } from 'lucide-react'
import { createContact, updateContact, deleteContact } from './actions'
import { useConfirm } from '@/components/ConfirmDialog'

interface Contact {
  id: string
  name: string
  type: 'client' | 'supplier'
  email?: string | null
  phone?: string | null
  document?: string | null
  address?: string | null
  notes?: string | null
  created_at: string
}

export function ClientesClient({
  contacts,
  initialOpenModal = false,
}: {
  contacts: Contact[]
  initialOpenModal?: boolean
}) {
  const router = useRouter()
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts)

  useEffect(() => {
    setLocalContacts(contacts)
  }, [contacts])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'client' | 'supplier'>('all')
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  const filteredContacts = localContacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.document && c.document.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm))

    const matchesType = filterType === 'all' || c.type === filterType
    return matchesSearch && matchesType
  })

  const clientsCount = localContacts.filter((c) => c.type === 'client').length
  const suppliersCount = localContacts.filter((c) => c.type === 'supplier').length

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingContact ? await updateContact(formData) : await createContact(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsModalOpen(false)
        setEditingContact(null)
        form.reset()
        router.refresh()
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    confirm(`Deseja realmente remover o contato "${name}"?`).then(ok => {
      if (!ok) return
      setDeletingId(id)
      setLocalContacts((prev) => prev.filter((c) => c.id !== id))
      startTransition(async () => {
        await deleteContact(id)
        setDeletingId(null)
        router.refresh()
      })
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Clientes & Fornecedores</h1>
          <p className="text-sm text-[#6e6e73]">Gestão centralizada de contatos, clientes de eventos e parceiros.</p>
        </div>
        <div>
          <button
            onClick={() => {
              setErrorMessage(null)
              setIsModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>Novo Contato</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Total de Contatos</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">{contacts.length}</p>
          <span className="mt-1 block text-xs text-[#86868b]">Cadastrados na base</span>
        </div>
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0071e3]">Clientes de Eventos</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#0071e3]">{clientsCount}</p>
          <span className="mt-1 block text-xs text-[#86868b]">Contratos e locações</span>
        </div>
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#b8860b]">Fornecedores Parceiros</span>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#b8860b]">{suppliersCount}</p>
          <span className="mt-1 block text-xs text-[#86868b]">Itens, serviços e alimentação</span>
        </div>
      </div>

      {/* Contacts Table Container */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#f2f2f7] p-4 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, documento ou telefone..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterType === 'all' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Todos ({contacts.length})
            </button>
            <button
              onClick={() => setFilterType('client')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterType === 'client' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Clientes ({clientsCount})
            </button>
            <button
              onClick={() => setFilterType('supplier')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterType === 'supplier' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Fornecedores ({suppliersCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1d1d1f]">
            <thead className="bg-[#f9f9fb] text-xs font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Nome</th>
                <th className="px-5 py-3.5 font-medium">Tipo</th>
                <th className="px-5 py-3.5 font-medium">Contato</th>
                <th className="px-5 py-3.5 font-medium">Documento</th>
                <th className="px-5 py-3.5 font-medium">Endereço</th>
                <th className="px-5 py-3.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f7]">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-[#fbfbfd] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#1d1d1f]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[#f2f2f7] flex items-center justify-center font-semibold text-xs text-[#1d1d1f]">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{c.name}</span>
                          {c.notes && <p className="text-[11px] text-[#86868b] line-clamp-1">{c.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.type === 'client'
                            ? 'bg-[#ebf4fe] text-[#0071e3]'
                            : 'bg-[#fff8e6] text-[#b8860b]'
                        }`}
                      >
                        {c.type === 'client' ? 'Cliente' : 'Fornecedor'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6e6e73]">
                      <div className="space-y-1">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-[#1d1d1f]">
                            <Phone size={12} className="text-[#86868b]" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-[#6e6e73]">
                            <Mail size={12} className="text-[#86868b]" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span>—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[#6e6e73]">
                      {c.document || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6e6e73]">
                      {c.address || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setErrorMessage(null)
                            setEditingContact(c)
                            setIsModalOpen(true)
                          }}
                          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Editar contato"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deletingId === c.id}
                          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                          title="Remover contato"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#86868b]">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="h-8 w-8 mb-2 text-[#86868b] stroke-[1.5]" />
                      <p className="text-sm font-medium text-[#1d1d1f]">Nenhum contato encontrado</p>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-3 text-xs font-semibold text-[#1d1d1f] hover:underline cursor-pointer"
                      >
                        + Cadastrar novo contato
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Contato / Editar Contato */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">
                  {editingContact ? 'Editar Contato' : 'Novo Contato'}
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  {editingContact
                    ? 'Atualize as informações do cliente ou fornecedor parceiro.'
                    : 'Cadastre um cliente de evento ou fornecedor parceiro.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingContact(null)
                }}
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

            <form
              key={editingContact?.id || 'new-contact'}
              onSubmit={handleSubmit}
              className="mt-5 space-y-4"
            >
              {editingContact && <input type="hidden" name="id" value={editingContact.id} />}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Tipo de Contato *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="type"
                      value="client"
                      defaultChecked={editingContact ? editingContact.type === 'client' : true}
                      className="accent-[#1d1d1f]"
                    />
                    <span>Cliente</span>
                  </label>
                  <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="type"
                      value="supplier"
                      defaultChecked={editingContact ? editingContact.type === 'supplier' : false}
                      className="accent-[#1d1d1f]"
                    />
                    <span>Fornecedor</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome Completo / Razão Social *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingContact?.name || ''}
                  placeholder="Ex: Maria Clara Silva ou Buffet Delícias"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingContact?.phone || ''}
                    placeholder="(83) 99999-9999"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingContact?.email || ''}
                    placeholder="cliente@email.com"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    name="document"
                    defaultValue={editingContact?.document || ''}
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={editingContact?.address || ''}
                    placeholder="Rua, Número, Bairro"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Observações Internas
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingContact?.notes || ''}
                  placeholder="Informações adicionais, preferências, histórico..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingContact(null)
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending
                    ? 'Salvando...'
                    : editingContact
                    ? 'Salvar Alterações'
                    : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
