'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Pencil,
  X,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  FileText,
  Building2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  MessageCircle,
} from 'lucide-react'
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createSupplierExpense,
  paySupplierExpense,
  deleteSupplierExpense,
} from './actions'
import { depositToCaixinha, withdrawFromCaixinha, Caixinha } from '../caixinhas/actions'
import { useConfirm } from '@/components/ConfirmDialog'

interface Supplier {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  document?: string | null
  address?: string | null
  notes?: string | null
  created_at?: string
}

interface SupplierTransaction {
  id: string
  amount: number
  type: 'expense' | 'income'
  status: 'pending' | 'paid' | 'late' | 'canceled'
  description: string
  due_date: string
  paid_date?: string | null
  contact_id?: string | null
  event_id?: string | null
  contacts?: { id: string; name: string } | null
  events?: { id: string; title: string } | null
}

export function FornecedoresClient({
  suppliers,
  transactions,
  events,
  caixinhas,
  initialAction,
  initialTab = 'contas',
}: {
  suppliers: Supplier[]
  transactions: SupplierTransaction[]
  events: { id: string; title: string }[]
  caixinhas: Caixinha[]
  initialAction?: string
  initialTab?: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'contas' | 'fornecedores'>(
    initialTab === 'fornecedores' ? 'fornecedores' : 'contas'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  // Modais
  const [supplierModalOpen, setSupplierModalOpen] = useState(initialAction === 'novo-fornecedor')
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [billModalOpen, setBillModalOpen] = useState(initialAction === 'nova-conta')
  const [selectedSupplierForBill, setSelectedSupplierForBill] = useState<string>('')
  const [caixinhaModalOpen, setCaixinhaModalOpen] = useState(false)
  const [caixinhaActionType, setCaixinhaActionType] = useState<'deposit' | 'withdraw'>('deposit')

  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Caixa de Fornecedores
  const fornecedorCaixinha = caixinhas.find((c) => c.category === 'fornecedores' || c.name.toLowerCase().includes('fornecedor')) || {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Caixa de Fornecedores',
    current_balance: 0,
    target_balance: 5000,
    category: 'fornecedores',
    color: '#d97706',
    icon: 'truck',
  }

  // Filtrar apenas despesas ligadas a fornecedores (ou despesas operacionais)
  const supplierTxs = transactions.filter((t) => t.type === 'expense')

  // Cálculos consolidados
  const pendingBills = supplierTxs.filter((t) => t.status === 'pending')
  const totalPendingAmount = pendingBills.reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const paidBills = supplierTxs.filter((t) => t.status === 'paid')
  const totalPaidAmount = paidBills.reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const caixinhaBalance = Number(fornecedorCaixinha.current_balance || 0)
  const coveragePercent = totalPendingAmount > 0 ? Math.min(100, Math.round((caixinhaBalance / totalPendingAmount) * 100)) : 100
  const isFullyCovered = caixinhaBalance >= totalPendingAmount && totalPendingAmount > 0

  // Filtragem da tabela de contas
  const filteredBills = supplierTxs.filter((tx) => {
    const matchesSearch =
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.contacts?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.events?.title?.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (statusFilter === 'pending' && tx.status !== 'pending') return false
    if (statusFilter === 'paid' && tx.status !== 'paid') return false
    if (supplierFilter !== 'all' && tx.contact_id !== supplierFilter) return false

    return true
  })

  // Filtragem do catálogo de fornecedores
  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase()
    return (
      s.name.toLowerCase().includes(term) ||
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      (s.document && s.document.toLowerCase().includes(term)) ||
      (s.notes && s.notes.toLowerCase().includes(term))
    )
  })

  // Handlers
  const handleSaveSupplier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = editingSupplier
        ? await updateSupplier(formData)
        : await createSupplier(formData)

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setSupplierModalOpen(false)
        setEditingSupplier(null)
        setSuccessMessage('Fornecedor salvo com sucesso!')
        setTimeout(() => setSuccessMessage(null), 3000)
        router.refresh()
      }
    })
  }

  const handleDeleteSupplier = (id: string, name: string) => {
    confirm(`Deseja realmente remover o fornecedor "${name}"?`).then(async (ok) => {
      if (!ok) return
      setActionLoadingId(id)
      startTransition(async () => {
        const res = await deleteSupplier(id)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleSaveBill = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createSupplierExpense(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setBillModalOpen(false)
        setSelectedSupplierForBill('')
        setSuccessMessage('Conta/Boleto de fornecedor lançado com sucesso!')
        setTimeout(() => setSuccessMessage(null), 3000)
        router.refresh()
      }
    })
  }

  const handlePayBill = (id: string, desc: string, amount: number) => {
    confirm(`Confirmar o pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente a "${desc}"?`).then(async (ok) => {
      if (!ok) return
      setActionLoadingId(id)
      startTransition(async () => {
        const res = await paySupplierExpense(id)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleDeleteBill = (id: string, desc: string) => {
    confirm(`Deseja realmente excluir o lançamento de conta "${desc}"?`).then(async (ok) => {
      if (!ok) return
      setActionLoadingId(id)
      startTransition(async () => {
        const res = await deleteSupplierExpense(id)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleCaixinhaMovement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    formData.append('id', fornecedorCaixinha.id)

    startTransition(async () => {
      const res =
        caixinhaActionType === 'deposit'
          ? await depositToCaixinha(formData)
          : await withdrawFromCaixinha(formData)

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setCaixinhaModalOpen(false)
        setSuccessMessage(
          caixinhaActionType === 'deposit'
            ? 'Valor guardado no Caixa de Fornecedores com sucesso!'
            : 'Valor resgatado do Caixa de Fornecedores com sucesso!'
        )
        setTimeout(() => setSuccessMessage(null), 3000)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-[#d97706]" />
            <span>Fornecedores & Contas a Pagar</span>
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Gestão de parceiros, controle de boletos a pagar e reserva no Caixa de Fornecedores.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setErrorMessage(null)
              setSelectedSupplierForBill('')
              setBillModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#d97706] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#b45309] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Lançar Conta / Boleto</span>
          </button>

          <button
            onClick={() => {
              setErrorMessage(null)
              setEditingSupplier(null)
              setSupplierModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Building2 size={15} strokeWidth={2} />
            <span>Novo Fornecedor</span>
          </button>
        </div>
      </div>

      {/* Mensagens de Sucesso */}
      {successMessage && (
        <div className="rounded-xl border border-[#b4e8c7] bg-[#e8f8ee] p-3 text-xs font-medium text-[#1a7f37] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Cards & Caixa Especial de Fornecedores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. A Pagar a Fornecedores (Pendente) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#cf222e]">
              A Pagar (Pendente)
            </span>
            <span className="rounded-md bg-[#feeceb] px-1.5 py-0.5 text-[10px] font-bold text-[#cf222e]">
              {pendingBills.length} {pendingBills.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#cf222e]">
            R$ {totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Boletos e compras a liquidar
          </span>
        </div>

        {/* 2. Caixa Especial de Fornecedores (Reserva) */}
        <div className="rounded-2xl border-2 border-[#d97706]/30 bg-gradient-to-br from-[#fffdfa] to-[#fff8ee] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="rounded-lg bg-[#fef3c7] p-1 text-[#d97706]">
                <Truck size={14} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
                Caixa de Fornecedores
              </span>
            </div>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isFullyCovered
                  ? 'bg-[#e8f8ee] text-[#1a7f37]'
                  : caixinhaBalance > 0
                  ? 'bg-[#fef3c7] text-[#b45309]'
                  : 'bg-[#feeceb] text-[#cf222e]'
              }`}
            >
              {isFullyCovered ? '✓ 100% Coberto' : `${coveragePercent}% Coberto`}
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R$ {caixinhaBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#6e6e73]">
              {totalPendingAmount > 0
                ? isFullyCovered
                  ? 'Saldo suficiente para todos os boletos'
                  : `Faltam R$ ${(Math.max(0, totalPendingAmount - caixinhaBalance)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'Nenhum boleto pendente'}
            </span>
            <button
              onClick={() => {
                setErrorMessage(null)
                setCaixinhaActionType('deposit')
                setCaixinhaModalOpen(true)
              }}
              className="rounded-lg bg-[#d97706] hover:bg-[#b45309] text-white px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
            >
              + Guardar
            </button>
          </div>
        </div>

        {/* 3. Total Já Pago */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1a7f37]">
              Total Já Pago
            </span>
            <span className="rounded-md bg-[#e8f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#1a7f37]">
              {paidBills.length} liquidados
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1a7f37]">
            R$ {totalPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Histórico quitado a fornecedores
          </span>
        </div>

        {/* 4. Fornecedores Cadastrados */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
              Parceiros Ativos
            </span>
            <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-bold text-[#1d1d1f]">
              {suppliers.length}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            {suppliers.length} {suppliers.length === 1 ? 'Fornecedor' : 'Fornecedores'}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Bebidas, buffet, materiais e serviços
          </span>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex items-center gap-2 border-b border-[#f2f2f7] pb-3">
        <button
          onClick={() => setActiveTab('contas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'contas'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
          }`}
        >
          <DollarSign size={15} />
          <span>Contas & Boletos a Pagar ({supplierTxs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fornecedores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'fornecedores'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
          }`}
        >
          <Building2 size={15} />
          <span>Catálogo de Fornecedores ({suppliers.length})</span>
        </button>
      </div>

      {/* ABA 1: CONTAS & BOLETOS A PAGAR */}
      {activeTab === 'contas' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#e5e5ea] shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" size={15} />
              <input
                type="text"
                placeholder="Buscar por descrição ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-[#f5f5f7] border border-transparent rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {/* Filtro por Fornecedor */}
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-[#f5f5f7] border border-transparent rounded-xl px-3 py-1.5 text-xs text-[#1d1d1f] focus:border-[#1d1d1f] focus:bg-white focus:outline-none transition-all"
              >
                <option value="all">Todos os Fornecedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Filtro por Status */}
              <div className="flex rounded-xl bg-[#f5f5f7] p-0.5 border border-[#e5e5ea]">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-[#1d1d1f] shadow-2xs' : 'text-[#6e6e73]'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-white text-[#cf222e] shadow-2xs'
                      : 'text-[#6e6e73]'
                  }`}
                >
                  Pendentes
                </button>
                <button
                  onClick={() => setStatusFilter('paid')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'paid'
                      ? 'bg-white text-[#1a7f37] shadow-2xs'
                      : 'text-[#6e6e73]'
                  }`}
                >
                  Pagas
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Contas */}
          <div className="overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#f2f2f7] bg-[#fbfbfd] text-[#86868b] uppercase tracking-wider font-semibold">
                    <th className="px-5 py-3.5">Fornecedor</th>
                    <th className="px-5 py-3.5">Descrição / Nota</th>
                    <th className="px-5 py-3.5">Vencimento</th>
                    <th className="px-5 py-3.5 text-right">Valor</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {filteredBills.length > 0 ? (
                    filteredBills.map((tx) => {
                      const isPaid = tx.status === 'paid'
                      const isLate = !isPaid && tx.due_date < new Date().toISOString().split('T')[0]
                      const supplierName = tx.contacts?.name || 'Fornecedor Avulso'

                      return (
                        <tr key={tx.id} className="hover:bg-[#f9f9fb] transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-[#1d1d1f]">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-[#86868b]" />
                              <span>{supplierName}</span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-[#1d1d1f]">
                            <div>
                              <span>{tx.description}</span>
                              {tx.events?.title && (
                                <span className="block text-[11px] text-[#0071e3]">
                                  Festa: {tx.events.title}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-[#6e6e73]">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-[#86868b]" />
                              <span>
                                {new Date(tx.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-right font-bold text-[#cf222e]">
                            - R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-[#e8f8ee] text-[#1a7f37]'
                                  : isLate
                                  ? 'bg-[#feeceb] text-[#cf222e]'
                                  : 'bg-[#fff8e6] text-[#b8860b]'
                              }`}
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 size={11} />
                                  Pago
                                </>
                              ) : isLate ? (
                                <>
                                  <AlertCircle size={11} />
                                  Vencido
                                </>
                              ) : (
                                <>
                                  <Clock size={11} />
                                  Pendente
                                </>
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isPaid ? (
                                <button
                                  onClick={() => handlePayBill(tx.id, tx.description, Number(tx.amount))}
                                  disabled={actionLoadingId === tx.id}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#e8f8ee] hover:bg-[#d5f3df] text-[#1a7f37] px-2.5 py-1 font-semibold text-[11px] transition-all cursor-pointer"
                                  title="Marcar conta como paga"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Pagar Boleto</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#86868b]">Quitado</span>
                              )}

                              <button
                                onClick={() => handleDeleteBill(tx.id, tx.description)}
                                disabled={actionLoadingId === tx.id}
                                className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[#86868b]">
                        Nenhuma conta ou boleto de fornecedor encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: CATÁLOGO DE FORNECEDORES */}
      {activeTab === 'fornecedores' && (
        <div className="space-y-4">
          {/* Barra de Busca */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#e5e5ea] shadow-xs">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" size={15} />
              <input
                type="text"
                placeholder="Buscar por nome, telefone, CNPJ ou especialidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-[#f5f5f7] border border-transparent rounded-xl text-xs text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Grid de Cards de Fornecedores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((s) => {
                const sTxs = supplierTxs.filter((t) => t.contact_id === s.id)
                const sPending = sTxs.filter((t) => t.status === 'pending').reduce((acc, t) => acc + Number(t.amount || 0), 0)
                const sPaid = sTxs.filter((t) => t.status === 'paid').reduce((acc, t) => acc + Number(t.amount || 0), 0)

                const cleanPhone = s.phone ? s.phone.replace(/\D/g, '') : ''

                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs hover:border-[#1d1d1f]/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-bold text-base text-[#1d1d1f]">{s.name}</h3>
                          {s.document && (
                            <span className="text-[11px] text-[#86868b] block">
                              Doc/CNPJ: {s.document}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setErrorMessage(null)
                              setEditingSupplier(s)
                              setSupplierModalOpen(true)
                            }}
                            className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                            title="Editar fornecedor"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(s.id, s.name)}
                            className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer"
                            title="Excluir fornecedor"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Informações de Contato e Chave PIX */}
                      <div className="space-y-1.5 text-xs text-[#6e6e73] mb-4">
                        {s.phone && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Phone size={13} className="text-[#86868b]" />
                              <span>{s.phone}</span>
                            </span>
                            {cleanPhone.length >= 10 && (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a7f37] hover:underline bg-[#e8f8ee] px-2 py-0.5 rounded"
                              >
                                <MessageCircle size={12} />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}

                        {s.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail size={13} className="text-[#86868b]" />
                            <span className="truncate">{s.email}</span>
                          </div>
                        )}

                        {s.notes && (
                          <div className="mt-2 p-2 bg-[#fbfbfd] rounded-xl border border-[#f2f2f7] text-[11px] text-[#1d1d1f]">
                            <span className="font-bold block text-[#86868b] text-[10px] uppercase">PIX / Dados / Observações:</span>
                            <span>{s.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumo Financeiro do Fornecedor */}
                    <div className="pt-3 border-t border-[#f2f2f7]">
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="p-2 bg-[#fff8e6] rounded-xl border border-[#fee4a6]">
                          <span className="text-[10px] font-bold text-[#b8860b] block uppercase">Pendente</span>
                          <span className="font-bold text-[#b8860b]">
                            R$ {sPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-2 bg-[#e8f8ee] rounded-xl border border-[#b4e8c7]">
                          <span className="text-[10px] font-bold text-[#1a7f37] block uppercase">Já Pago</span>
                          <span className="font-bold text-[#1a7f37]">
                            R$ {sPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setErrorMessage(null)
                          setSelectedSupplierForBill(s.id)
                          setBillModalOpen(true)
                        }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e5e5ea] py-2 text-xs font-semibold text-[#1d1d1f] transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Lançar Conta para {s.name.split(' ')[0]}</span>
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="col-span-full rounded-2xl border border-[#e5e5ea] bg-white p-12 text-center text-[#86868b]">
                Nenhum fornecedor cadastrado ainda. Clique em "+ Novo Fornecedor" para adicionar parceiros de bebidas, louças, buffet ou iluminação.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRAR / EDITAR FORNECEDOR */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[#fff8ee] p-2 text-[#d97706]">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                  </h3>
                  <p className="text-xs text-[#6e6e73]">
                    Cadastro de empresa parceira, contato e chave PIX.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSupplierModalOpen(false)
                  setEditingSupplier(null)
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

            <form onSubmit={handleSaveSupplier} className="mt-4 space-y-4">
              {editingSupplier && <input type="hidden" name="id" value={editingSupplier.id} />}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome ou Razão Social *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingSupplier?.name || ''}
                  placeholder="Ex: Distribuidora de Bebidas Prime ou Floricultura Rosa Real"
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
                    defaultValue={editingSupplier?.phone || ''}
                    placeholder="(81) 99999-9999"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    CNPJ / CPF
                  </label>
                  <input
                    type="text"
                    name="document"
                    defaultValue={editingSupplier?.document || ''}
                    placeholder="00.000.000/0001-00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  E-mail de Contato
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingSupplier?.email || ''}
                  placeholder="financeiro@fornecedor.com.br"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Chave PIX / Dados Bancários / Observações
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={editingSupplier?.notes || ''}
                  placeholder="Ex: Chave PIX CNPJ: 12.345.678/0001-90 (Banco Santander) / Falar com Carlos"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setSupplierModalOpen(false)
                    setEditingSupplier(null)
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white px-5 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Gravando...' : editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LANÇAR CONTA / BOLETO A PAGAR */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[#feeceb] p-2 text-[#cf222e]">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">Lançar Conta / Boleto</h3>
                  <p className="text-xs text-[#6e6e73]">
                    Registre uma despesa ou nota fiscal a pagar ao fornecedor.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setBillModalOpen(false)
                  setSelectedSupplierForBill('')
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

            <form onSubmit={handleSaveBill} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Fornecedor *
                </label>
                <select
                  name="supplier_id"
                  required
                  defaultValue={selectedSupplierForBill}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Descrição da Conta / Boleto / Insumo *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="Ex: Compra de 50 caixas de cerveja e refrigerante"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Valor a Pagar (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    required
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Vincular a Evento / Festa (Opcional)
                </label>
                <select
                  name="event_id"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="">Nenhum evento vinculado (Despesa Geral/Fixa)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Status Inicial
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="status"
                      value="pending"
                      defaultChecked
                      className="accent-[#1d1d1f]"
                    />
                    <span>A Pagar (Pendente)</span>
                  </label>
                  <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="status"
                      value="paid"
                      className="accent-[#1d1d1f]"
                    />
                    <span>Já Liquidado (Pago)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setBillModalOpen(false)
                    setSelectedSupplierForBill('')
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#cf222e] hover:bg-[#a41a24] text-white px-5 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Lançando...' : 'Gravar Conta a Pagar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MOVIMENTAR CAIXA DE FORNECEDORES */}
      {caixinhaModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[#fff8ee] p-2 text-[#d97706]">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    {caixinhaActionType === 'deposit'
                      ? 'Guardar no Caixa de Fornecedores'
                      : 'Resgatar do Caixa de Fornecedores'}
                  </h3>
                  <p className="text-xs text-[#6e6e73]">
                    Saldo Atual Reservado: R${' '}
                    {caixinhaBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCaixinhaModalOpen(false)}
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

            <form onSubmit={handleCaixinhaMovement} className="mt-4 space-y-4">
              <div className="flex rounded-xl bg-[#f5f5f7] p-1 border border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={() => setCaixinhaActionType('deposit')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    caixinhaActionType === 'deposit'
                      ? 'bg-white text-[#d97706] shadow-2xs'
                      : 'text-[#6e6e73]'
                  }`}
                >
                  + Guardar / Reservar
                </button>
                <button
                  type="button"
                  onClick={() => setCaixinhaActionType('withdraw')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    caixinhaActionType === 'withdraw'
                      ? 'bg-white text-[#1d1d1f] shadow-2xs'
                      : 'text-[#6e6e73]'
                  }`}
                >
                  - Resgatar para Conta
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Valor da Movimentação (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="amount"
                  required
                  placeholder="0,00"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setCaixinhaModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white px-5 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Processando...' : 'Confirmar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
