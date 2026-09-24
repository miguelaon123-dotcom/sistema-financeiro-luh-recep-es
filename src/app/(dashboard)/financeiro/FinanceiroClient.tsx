'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Pencil,
  X,
  Calendar,
  DollarSign,
  User,
  PartyPopper,
  Receipt,
  Wallet,
  Landmark,
  Info,
  Check,
  UtensilsCrossed,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  createTransaction,
  updateTransaction,
  updateTransactionStatus,
  deleteTransaction,
  adjustCashBalance,
} from './actions'
import { Caixinha } from '../caixinhas/actions'
import { CaixinhasFinanceiras } from '@/components/CaixinhasFinanceiras'
import { useConfirm } from '@/components/ConfirmDialog'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  status: 'pending' | 'paid' | 'late' | 'canceled'
  description: string
  due_date: string
  paid_date?: string | null
  contacts?: { id: string; name: string } | null
  events?: { id: string; title: string } | null
}

export function FinanceiroClient({
  transactions,
  contacts,
  events,
  initialAction,
  initialTab = 'extrato',
  caixinhas = [],
}: {
  transactions: Transaction[]
  contacts: { id: string; name: string }[]
  events: { id: string; title: string }[]
  initialAction?: string
  initialTab?: string
  caixinhas?: Caixinha[]
}) {
  const router = useRouter()
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(transactions)

  useEffect(() => {
    setLocalTransactions(transactions)
  }, [transactions])

  const [activeTab, setActiveTab] = useState<'extrato' | 'caixinhas'>(
    initialTab === 'caixinhas' ? 'caixinhas' : 'extrato'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [modalType, setModalType] = useState<'income' | 'expense' | null>(
    initialAction === 'nova-receita'
      ? 'income'
      : initialAction === 'nova-despesa'
      ? 'expense'
      : null
  )
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Estado para Ajustar Saldo Real Bancário
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(initialAction === 'ajustar-saldo')
  const [targetBalanceInput, setTargetBalanceInput] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // Meses e Anos para Filtros de Período
  const MONTH_NAMES = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ]

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear()
    const yearsSet = new Set<string>()
    yearsSet.add(String(currentY))
    yearsSet.add(String(currentY - 1))
    yearsSet.add(String(currentY + 1))
    localTransactions.forEach((tx) => {
      const d = (tx.status === 'paid' && tx.paid_date ? tx.paid_date : tx.due_date) || ''
      if (d) {
        const y = d.split('-')[0]
        if (y && !isNaN(Number(y)) && y.length === 4) yearsSet.add(y)
      }
    })
    return Array.from(yearsSet).sort()
  }, [localTransactions])

  const now = new Date()
  const currentYearStr = String(now.getFullYear())
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0')
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthYearStr = String(nextMonthDate.getFullYear())
  const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, '0')

  const isCurrentMonthSelected =
    selectedMonth === currentMonthStr && selectedYear === currentYearStr
  const isNextMonthSelected =
    selectedMonth === nextMonthStr && selectedYear === nextMonthYearStr

  // Cálculos dinâmicos
  const pendingIncome = localTransactions
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const pendingExpense = localTransactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const totalReceived = localTransactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const totalPaid = localTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const cashBalance = totalReceived - totalPaid
  const totalInCaixinhas = (caixinhas || []).reduce((acc, c) => acc + Number(c.current_balance || 0), 0)
  const freeCashBalance = Math.max(0, cashBalance - totalInCaixinhas)

  // Filtragem e Ordenação Inteligente
  const filteredTransactions = useMemo(() => {
    return localTransactions
      .filter((tx) => {
        const matchesSearch =
          tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.contacts?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.events?.title?.toLowerCase().includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false

        // Filtro por Mês e Ano
        const effectiveDate = (tx.status === 'paid' && tx.paid_date ? tx.paid_date : tx.due_date) || ''
        const parts = effectiveDate.split('-')
        const txYear = parts[0]
        const txMonth = parts[1]

        if (selectedMonth !== 'all' && txMonth !== selectedMonth) return false
        if (selectedYear !== 'all' && txYear !== selectedYear) return false

        if (filterStatus === 'all') return true
        if (filterStatus === 'income') return tx.type === 'income'
        if (filterStatus === 'expense') return tx.type === 'expense'
        if (filterStatus === 'tasting') return tx.description?.toLowerCase().includes('degustação')
        if (filterStatus === 'pending') return tx.status === 'pending'
        if (filterStatus === 'paid') return tx.status === 'paid'
        return true
      })
      .sort((a, b) => {
        const dateA = (a.status === 'paid' && a.paid_date ? a.paid_date : a.due_date) || ''
        const dateB = (b.status === 'paid' && b.paid_date ? b.paid_date : b.due_date) || ''
        return dateB.localeCompare(dateA)
      })
  }, [localTransactions, searchTerm, filterStatus, selectedMonth, selectedYear])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingTx
        ? await updateTransaction(formData)
        : await createTransaction(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setModalType(null)
        setEditingTx(null)
        form.reset()
        router.refresh()
      }
    })
  }

  const handleAdjustSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAdjustError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await adjustCashBalance(formData)
      if (res?.error) {
        setAdjustError(res.error)
      } else {
        setIsAdjustModalOpen(false)
        router.refresh()
      }
    })
  }

  const handleTogglePaid = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid'
    // Otimista
    setLocalTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus as any } : t))
    )
    setActionLoadingId(id)
    startTransition(async () => {
      const res = await updateTransactionStatus(id, nextStatus)
      if (res?.error) alert(res.error)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  const handleDelete = (id: string, desc: string) => {
    confirm(`Deseja realmente remover a transação "${desc}"?`).then(ok => {
      if (!ok) return
      setLocalTransactions((prev) => prev.filter((t) => t.id !== id))
      setActionLoadingId(id)
      startTransition(async () => {
        await deleteTransaction(id)
        setActionLoadingId(null)
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Financeiro</h1>
          <p className="text-sm text-[#6e6e73]">
            Controle de fluxo de caixa, caixinhas e movimentações da Luh Recepções.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setAdjustError(null)
              setTargetBalanceInput(cashBalance !== 0 ? String(cashBalance) : '')
              setAdjustNotes('')
              setIsAdjustModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all border border-[#d2d2d7] cursor-pointer shadow-2xs"
          >
            <Landmark size={15} className="text-[#0071e3]" />
            <span>Ajustar Saldo Bancário</span>
          </button>
          <button
            onClick={() => {
              setErrorMessage(null)
              setModalType('income')
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#e8f8ee] px-3.5 py-2 text-xs font-semibold text-[#1a7f37] hover:bg-[#d5f3df] transition-all border border-[#b4e8c7] cursor-pointer"
          >
            <ArrowUpCircle size={15} strokeWidth={2.2} />
            <span>Nova Receita</span>
          </button>
          <button
            onClick={() => {
              setErrorMessage(null)
              setModalType('expense')
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#feeceb] px-3.5 py-2 text-xs font-semibold text-[#cf222e] hover:bg-[#fcd7d5] transition-all border border-[#f8b4b1] cursor-pointer"
          >
            <ArrowDownCircle size={15} strokeWidth={2.2} />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Consolidados */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Saldo Real em Caixa */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
                Saldo em Caixa (Real)
              </span>
              <div className="rounded-xl bg-[#e8f8ee] p-1.5 text-[#1a7f37]">
                <Wallet size={16} />
              </div>
            </div>
            <p
              className={`mt-2 text-2xl font-bold tracking-tight ${
                cashBalance >= 0 ? 'text-[#1d1d1f]' : 'text-[#cf222e]'
              }`}
            >
              R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              Recebido ({totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}) − Pago ({totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setAdjustError(null)
                setTargetBalanceInput(cashBalance !== 0 ? String(cashBalance) : '')
                setAdjustNotes('')
                setIsAdjustModalOpen(true)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071e3] hover:text-[#0051a8] transition-colors cursor-pointer"
              title="Ajustar saldo para conciliar com o extrato real da conta bancária"
            >
              <Landmark size={13} />
              <span>Ajustar Saldo Real</span>
            </button>
          </div>
        </div>

        {/* 2. Saldo Livre */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1a7f37]">
              Saldo Livre
            </span>
            <span className="rounded-md bg-[#e8f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#1a7f37]">
              Disponível
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1a7f37]">
            R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Saldo em Caixa − Caixinhas
          </span>
        </div>

        {/* 3. Caixinhas */}
        <div
          onClick={() => setActiveTab('caixinhas')}
          className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs hover:border-[#1d1d1f]/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
              Em Caixinhas
            </span>
            <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-bold text-[#1d1d1f]">
              {caixinhas.length} ativas
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R$ {totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">Reservas separadas →</span>
        </div>

        {/* 4. A Receber (Pendente) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#b8860b]">
              A Receber (Futuro)
            </span>
            <span className="rounded-md bg-[#fff8e6] px-1.5 py-0.5 text-[10px] font-bold text-[#b8860b]">
              Pendente
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#b8860b]">
            R$ {pendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">Contratos e locações pendentes</span>
        </div>

        {/* 5. A Pagar (Pendente) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#cf222e]">
              A Pagar (Futuro)
            </span>
            <span className="rounded-md bg-[#feeceb] px-1.5 py-0.5 text-[10px] font-bold text-[#cf222e]">
              Pendente
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#cf222e]">
            R$ {pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">Fornecedores e custos fixos</span>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex items-center gap-2 border-b border-[#f2f2f7] pb-3">
        <button
          onClick={() => setActiveTab('extrato')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'extrato'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'bg-white text-[#6e6e73] hover:text-[#1d1d1f] border border-[#e5e5ea]'
          }`}
        >
          <Receipt size={14} />
          <span>Extrato de Lançamentos ({transactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('caixinhas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'caixinhas'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'bg-white text-[#6e6e73] hover:text-[#1d1d1f] border border-[#e5e5ea]'
          }`}
        >
          <Wallet size={14} />
          <span>Caixinhas ({caixinhas.length})</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      {activeTab === 'caixinhas' ? (
        <CaixinhasFinanceiras
          initialCaixinhas={caixinhas}
          totalCashBalance={totalReceived - totalPaid}
        />
      ) : (
        /* Transactions Table Section */
        <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#f2f2f7] p-4 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição, cliente, evento ou degustação..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Filtros em abas */}
          <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto">
            {[
              { label: 'Todos', val: 'all' },
              { label: 'Receitas', val: 'income' },
              { label: 'Despesas', val: 'expense' },
              { label: '🍽️ Degustações', val: 'tasting' },
              { label: 'Pendentes', val: 'pending' },
              { label: 'Pagos', val: 'paid' },
            ].map((tab) => (
              <button
                key={tab.val}
                onClick={() => setFilterStatus(tab.val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  filterStatus === tab.val
                    ? 'bg-white text-[#1d1d1f] shadow-xs'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de Filtros de Período (Mês e Ano) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#fbfbfd] border-b border-[#f2f2f7]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#b8860b]" />
              Período:
            </span>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs text-[#1d1d1f] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Meses</option>
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs text-[#1d1d1f] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Anos</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonthStr)
                setSelectedYear(currentYearStr)
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                isCurrentMonthSelected
                  ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                  : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f]'
              }`}
            >
              Este Mês
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(nextMonthStr)
                setSelectedYear(nextMonthYearStr)
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                isNextMonthSelected
                  ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                  : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f]'
              }`}
            >
              Próximo Mês
            </button>

            {(selectedMonth !== 'all' || selectedYear !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('all')
                  setSelectedYear('all')
                }}
                className="px-2 py-1 text-xs font-medium text-[#cf222e] hover:bg-[#feeceb] rounded-lg transition-all cursor-pointer"
              >
                Limpar Período
              </button>
            )}
          </div>

          <span className="text-xs text-[#86868b]">
            Exibindo <strong>{filteredTransactions.length}</strong> de {localTransactions.length} lançamentos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1d1d1f]">
            <thead className="bg-[#f9f9fb] text-xs font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Vencimento</th>
                <th className="px-5 py-3.5 font-medium">Descrição</th>
                <th className="px-5 py-3.5 font-medium">Contato</th>
                <th className="px-5 py-3.5 font-medium">Evento</th>
                <th className="px-5 py-3.5 font-medium text-right">Valor (R$)</th>
                <th className="px-5 py-3.5 font-medium text-center">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f7]">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#fbfbfd] transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-[#6e6e73]">
                      {tx.status === 'paid' && tx.paid_date ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-[#1d1d1f]">
                            {new Date(tx.paid_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] text-[#1a7f37] font-medium">Pago</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-xs text-[#6e6e73]">
                            {new Date(tx.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] text-[#b8860b]">Vencimento</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[#1d1d1f]">
                      {tx.description ? tx.description.replace(/\s*\[[0-9a-fA-F-]+\]/, '') : 'Sem descrição'}
                    </td>
                    <td className="px-5 py-3.5 text-[#6e6e73]">{tx.contacts?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-[#1d1d1f] font-medium">
                      {tx.events?.title ? (
                        tx.events.title
                      ) : tx.description?.toLowerCase().includes('degustação') ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ebf4fe] text-[#0071e3]">
                          🍽️ Degustação
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right font-semibold whitespace-nowrap ${
                        tx.type === 'income' ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'} R${' '}
                      {Math.abs(Number(tx.amount)).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleTogglePaid(tx.id, tx.status)}
                        disabled={actionLoadingId === tx.id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition-transform hover:scale-105 ${
                          tx.status === 'paid'
                            ? 'bg-[#e8f8ee] text-[#1a7f37]'
                            : tx.status === 'pending'
                            ? 'bg-[#fff8e6] text-[#b8860b]'
                            : tx.status === 'late'
                            ? 'bg-[#feeceb] text-[#cf222e]'
                            : 'bg-[#f5f5f7] text-[#6e6e73]'
                        }`}
                        title="Clique para alternar entre Pago e Pendente"
                      >
                        {tx.status === 'paid' && <CheckCircle2 size={12} />}
                        {tx.status === 'paid'
                          ? 'Pago'
                          : tx.status === 'pending'
                          ? 'Pendente'
                          : tx.status === 'late'
                          ? 'Atrasado'
                          : 'Cancelado'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleTogglePaid(tx.id, tx.status)}
                          disabled={actionLoadingId === tx.id}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            tx.status === 'paid'
                              ? 'text-[#86868b] hover:bg-[#f5f5f7]'
                              : 'text-[#1a7f37] bg-[#e8f8ee] hover:bg-[#d5f3df] font-semibold'
                          }`}
                        >
                          {tx.status === 'paid' ? 'Reabrir' : 'Dar Baixa'}
                        </button>
                        <button
                          onClick={() => {
                            setErrorMessage(null)
                            setEditingTx(tx)
                            setModalType(tx.type)
                          }}
                          className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Editar lançamento"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id, tx.description)}
                          disabled={actionLoadingId === tx.id}
                          className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#86868b]">
                    Nenhuma transação financeira encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal Nova Receita / Nova Despesa / Editar */}
      {modalType && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                {modalType === 'income' ? (
                  <div className="rounded-xl bg-[#e8f8ee] p-2 text-[#1a7f37]">
                    <ArrowUpCircle size={20} />
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#feeceb] p-2 text-[#cf222e]">
                    <ArrowDownCircle size={20} />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    {editingTx
                      ? modalType === 'income'
                        ? 'Editar Receita'
                        : 'Editar Despesa'
                      : modalType === 'income'
                      ? 'Nova Receita'
                      : 'Nova Despesa'}
                  </h3>
                  <p className="text-xs text-[#6e6e73]">
                    {editingTx
                      ? 'Atualize as informações do lançamento e confirme.'
                      : modalType === 'income'
                      ? 'Lançamento de entrada no caixa ou contrato de evento.'
                      : 'Lançamento de pagamento a fornecedor ou custo operacional.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalType(null)
                  setEditingTx(null)
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
              key={editingTx?.id || 'new-tx'}
              onSubmit={handleSubmit}
              className="mt-5 space-y-4"
            >
              <input type="hidden" name="type" value={modalType} />
              {editingTx && <input type="hidden" name="id" value={editingTx.id} />}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  defaultValue={editingTx?.description || ''}
                  placeholder={
                    modalType === 'income'
                      ? 'Ex: Entrada Contrato Casamento Juliana'
                      : 'Ex: Compra de Taças ou Pagamento DJ'
                  }
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Valor Total (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    required
                    defaultValue={editingTx ? Math.abs(Number(editingTx.amount)) : ''}
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
                    defaultValue={
                      editingTx?.due_date
                        ? editingTx.due_date
                        : new Date().toISOString().split('T')[0]
                    }
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Contato / Cliente Vinculado
                  </label>
                  <select
                    name="contact_id"
                    defaultValue={editingTx?.contacts?.id || ''}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  >
                    <option value="">Nenhum contato selecionado</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Evento Vinculado
                  </label>
                  <select
                    name="event_id"
                    defaultValue={editingTx?.events?.id || ''}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  >
                    <option value="">Nenhum evento vinculado</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="status"
                      value="pending"
                      defaultChecked={editingTx ? editingTx.status === 'pending' : true}
                      className="accent-[#1d1d1f]"
                    />
                    <span>Pendente</span>
                  </label>
                  <label className="flex items-center justify-center gap-2 p-2 rounded-xl border border-[#e5e5ea] text-xs font-medium cursor-pointer has-checked:border-[#1d1d1f] has-checked:bg-[#f5f5f7]">
                    <input
                      type="radio"
                      name="status"
                      value="paid"
                      defaultChecked={editingTx ? editingTx.status === 'paid' : false}
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
                    setModalType(null)
                    setEditingTx(null)
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-white transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                    modalType === 'income'
                      ? 'bg-[#1a7f37] hover:bg-[#15662c]'
                      : 'bg-[#cf222e] hover:bg-[#a41a24]'
                  }`}
                >
                  {isPending
                    ? 'Gravando...'
                    : editingTx
                    ? 'Salvar Alterações'
                    : modalType === 'income'
                    ? 'Salvar Receita'
                    : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Saldo Real da Conta Bancária */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-[#ebf4fe] p-2 text-[#0071e3]">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f]">
                    Ajustar Saldo Real da Conta
                  </h3>
                  <p className="text-xs text-[#86868b]">
                    Concilie o caixa com o saldo que existe no seu banco hoje
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {adjustError && (
              <div className="mt-4 p-3 rounded-xl bg-[#fff2f0] border border-[#ffccc7] text-xs text-[#cf222e] font-medium">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 mt-4">
              {/* Card Comparativo */}
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6e73]">Saldo atual registrado no sistema:</span>
                  <strong className="text-[#1d1d1f] font-mono text-sm">
                    R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <p className="text-[11px] text-[#86868b] leading-relaxed pt-1 border-t border-[#e5e5ea]">
                  💡 <strong>Por que usar?</strong> Se antes do sistema o financeiro estava desorganizado ou valores foram gastos sem lançamento, basta informar o saldo real da sua conta bancária para alinhar tudo automaticamente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Saldo Real Atual na Conta do Banco (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#86868b]">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    name="target_balance"
                    required
                    value={targetBalanceInput}
                    onChange={(e) => setTargetBalanceInput(e.target.value)}
                    placeholder="Ex: 500.00 ou 0.00"
                    className="w-full rounded-xl border border-[#d2d2d7] bg-[#fbfbfd] py-2.5 pl-10 pr-3 text-sm font-bold text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white focus:outline-hidden transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Cálculo do Impacto em Tempo Real */}
              {targetBalanceInput !== '' && !isNaN(Number(targetBalanceInput.replace(',', '.'))) && (
                (() => {
                  const targetNum = Number(targetBalanceInput.replace(',', '.'))
                  const diff = Number((targetNum - cashBalance).toFixed(2))
                  return (
                    <div
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        diff > 0
                          ? 'bg-[#e8f8ee] border-[#b4e8c7] text-[#1a7f37]'
                          : diff < 0
                          ? 'bg-[#fff8e6] border-[#ffe58f] text-[#946200]'
                          : 'bg-[#f5f5f7] border-[#e5e5ea] text-[#6e6e73]'
                      }`}
                    >
                      {diff > 0 ? (
                        <>
                          📈 <strong>Aumento de Saldo:</strong> Será registrado um ajuste de entrada de{' '}
                          <strong>R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
                          (Saldo Inicial/Aporte) para igualar ao banco.
                        </>
                      ) : diff < 0 ? (
                        <>
                          📉 <strong>Acerto de Gastos Anteriores:</strong> Será registrado um ajuste de saída de{' '}
                          <strong>R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
                          referente a dinheiro gasto no passado sem lançamento.
                        </>
                      ) : (
                        <>
                          ✅ O saldo já está exatamente no mesmo valor do banco (R${' '}
                          {targetNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                        </>
                      )}
                    </div>
                  )
                })()
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Observação / Motivo (Opcional)
                </label>
                <input
                  type="text"
                  name="notes"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Ex: Conciliação inicial - gastos anteriores desorganizados"
                  className="w-full rounded-xl border border-[#d2d2d7] bg-[#fbfbfd] px-3.5 py-2 text-xs text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white focus:outline-hidden transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || targetBalanceInput === ''}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0071e3] hover:bg-[#0051a8] px-5 py-2 text-xs font-semibold text-white transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : 'Confirmar Saldo Real'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

