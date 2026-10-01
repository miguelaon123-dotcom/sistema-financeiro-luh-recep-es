'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
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
  TrendingUp,
  TrendingDown,
  Percent,
  Sparkles,
  ArrowRight,
  BarChart3,
  PieChart,
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
  events?: { id: string; title: string; event_date?: string } | null
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
  const [localCaixinhas, setLocalCaixinhas] = useState<Caixinha[]>(caixinhas)

  useEffect(() => {
    setLocalTransactions(transactions)
  }, [transactions])

  useEffect(() => {
    setLocalCaixinhas(caixinhas)
  }, [caixinhas])

  const [activeTab, setActiveTab] = useState<'extrato' | 'caixinhas'>(
    initialTab === 'caixinhas' ? 'caixinhas' : 'extrato'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [dateFilterMode, setDateFilterMode] = useState<'due' | 'event'>('event')
  const [modalType, setModalType] = useState<'income' | 'expense' | null>(
    initialAction === 'nova-receita'
      ? 'income'
      : initialAction === 'nova-despesa'
      ? 'expense'
      : null
  )
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [modalStatus, setModalStatus] = useState<'pending' | 'paid'>('pending')
  const [modalAmount, setModalAmount] = useState<string>('')
  const [modalInstallments, setModalInstallments] = useState<number>(1)
  const [modalPaidInstallments, setModalPaidInstallments] = useState<number>(0)
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Estado para Ajustar Saldo Real Bancário (sempre inicia fechado para não abrir pop-up ao atualizar a página)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [targetBalanceInput, setTargetBalanceInput] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // Limpa qualquer parâmetro action da URL para que atualizações de página (F5) não reabram pop-ups indesejados
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('action=')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('action')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
    }
  }, [])

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

  // Resolução inteligente da data de competência da transação
  const getTransactionDate = (tx: Transaction) => {
    // Se a transação estiver ligada a um evento:
    // Tanto no modo Evento quanto no modo Vencimento, os recebimentos e quitações do evento
    // pertencem ao mês da festa (ou à data do evento), para que as parcelas que já quitaram
    // apareçam juntas das parcelas a receber no mesmo fechamento mensal!
    if (tx.events?.event_date) {
      if (dateFilterMode === 'due' && tx.due_date && tx.status === 'pending') {
        return tx.due_date
      }
      return tx.events.event_date
    }
    // Para despesas avulsas e custos operacionais:
    if (dateFilterMode === 'due') {
      return tx.due_date || tx.paid_date || ''
    }
    return (tx.status === 'paid' && tx.paid_date ? tx.paid_date : tx.due_date) || tx.due_date || ''
  }

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear()
    const yearsSet = new Set<string>()
    yearsSet.add(String(currentY))
    yearsSet.add(String(currentY - 1))
    yearsSet.add(String(currentY + 1))
    localTransactions.forEach((tx) => {
      const d = getTransactionDate(tx)
      if (d) {
        const y = d.split('-')[0]
        if (y && !isNaN(Number(y)) && y.length === 4) yearsSet.add(y)
      }
    })
    return Array.from(yearsSet).sort()
  }, [localTransactions, dateFilterMode])

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

  // Período Selecionado
  const isPeriodFiltered = selectedMonth !== 'all' || selectedYear !== 'all'
  const selectedMonthObj = MONTH_NAMES.find((m) => m.value === selectedMonth)
  const periodLabel =
    selectedMonth !== 'all'
      ? `${selectedMonthObj?.label || selectedMonth} de ${selectedYear !== 'all' ? selectedYear : currentYearStr}`
      : selectedYear !== 'all'
      ? `Ano de ${selectedYear}`
      : 'Todos os Meses'

  // Transações pertencentes ao período selecionado
  const periodTransactions = useMemo(() => {
    return localTransactions.filter((tx) => {
      const effectiveDate = getTransactionDate(tx)
      const parts = effectiveDate.split('-')
      const txYear = parts[0]
      const txMonth = parts[1]

      if (selectedMonth !== 'all' && txMonth !== selectedMonth) return false
      if (selectedYear !== 'all' && txYear !== selectedYear) return false
      return true
    })
  }, [localTransactions, selectedMonth, selectedYear, dateFilterMode])

  // Métricas do Período Selecionado (Mês/Ano)
  const periodReceived = periodTransactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const periodPaid = periodTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const periodPendingIncome = periodTransactions
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const periodPendingExpense = periodTransactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  // Rendimento Atual / Lucro Realizado (O que já entrou menos o que já saiu no período)
  const periodProfit = periodReceived - periodPaid
  const periodProfitMargin = periodReceived > 0 ? (periodProfit / periodReceived) * 100 : 0

  // Fechamento Total Projetado do Mês (Considerando o que ainda vai entrar e sair)
  const periodProjectedIncome = periodReceived + periodPendingIncome
  const periodProjectedExpense = periodPaid + periodPendingExpense
  const periodProjectedProfit = periodProjectedIncome - periodProjectedExpense
  const periodProjectedProfitMargin =
    periodProjectedIncome > 0 ? (periodProjectedProfit / periodProjectedIncome) * 100 : 0

  // Taxa de liquidação / contas quitadas no mês
  const periodPaidTxsCount = periodTransactions.filter((t) => t.status === 'paid').length
  const periodTotalTxsCount = periodTransactions.length
  const periodCompletionRate =
    periodTotalTxsCount > 0 ? Math.round((periodPaidTxsCount / periodTotalTxsCount) * 100) : 100

  // Métricas Globais (Acumulado Total em Caixa Real)
  const totalReceived = localTransactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const totalPaid = localTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const cashBalance = totalReceived - totalPaid
  const totalInCaixinhas = (localCaixinhas || []).reduce((acc, c) => acc + Number(c.current_balance || 0), 0)
  // O saldo em conta bancária (cashBalance) já é o saldo livre, pois as caixinhas já foram retiradas
  const freeCashBalance = cashBalance

  const pendingIncomeAll = localTransactions
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const pendingExpenseAll = localTransactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  // Filtragem e Ordenação Inteligente
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()

    return localTransactions
      .filter((tx) => {
        if (term) {
          const descMatch = (tx.description || '').toLowerCase().includes(term)
          const contactMatch = (tx.contacts?.name || '').toLowerCase().includes(term)
          const eventMatch = (tx.events?.title || '').toLowerCase().includes(term)
          const amountMatch = String(tx.amount || '').includes(term) || String(Math.abs(Number(tx.amount || 0))).includes(term)
          const dateMatch = (tx.due_date || '').includes(term) || (tx.paid_date || '').includes(term)

          if (!descMatch && !contactMatch && !eventMatch && !amountMatch && !dateMatch) {
            return false
          }
        }

        // Filtro por Mês e Ano usando getTransactionDate
        const effectiveDate = getTransactionDate(tx)
        const parts = effectiveDate.split('-')
        const txYear = parts[0]
        const txMonth = parts[1]

        if (selectedMonth !== 'all' && txMonth !== selectedMonth) return false
        if (selectedYear !== 'all' && txYear !== selectedYear) return false

        if (filterStatus === 'all') return true
        if (filterStatus === 'income') return tx.type === 'income'
        if (filterStatus === 'expense') return tx.type === 'expense'
        if (filterStatus === 'tasting') {
          const desc = (tx.description || '').toLowerCase()
          const event = (tx.events?.title || '').toLowerCase()
          return desc.includes('degust') || event.includes('degust')
        }
        if (filterStatus === 'pending') return tx.status === 'pending'
        if (filterStatus === 'paid') return tx.status === 'paid'
        return true
      })
      .sort((a, b) => {
        const dateA = getTransactionDate(a)
        const dateB = getTransactionDate(b)
        return dateB.localeCompare(dateA)
      })
  }, [localTransactions, searchTerm, filterStatus, selectedMonth, selectedYear, dateFilterMode])

  // Totais dos Lançamentos Filtrados pela Busca e Abas (Soma do que o usuário está buscando)
  const filteredMetrics = useMemo(() => {
    let incomeTotal = 0
    let expenseTotal = 0
    let pendingIncome = 0
    let pendingExpense = 0
    let paidIncome = 0
    let paidExpense = 0

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount || 0)
      if (tx.type === 'income') {
        incomeTotal += amt
        if (tx.status === 'paid') paidIncome += amt
        else if (tx.status === 'pending') pendingIncome += amt
      } else {
        expenseTotal += amt
        if (tx.status === 'paid') paidExpense += amt
        else if (tx.status === 'pending') pendingExpense += amt
      }
    }

    const netTotal = incomeTotal - expenseTotal
    const paidNet = paidIncome - paidExpense
    const pendingNet = pendingIncome - pendingExpense

    return {
      count: filteredTransactions.length,
      incomeTotal,
      expenseTotal,
      netTotal,
      paidIncome,
      paidExpense,
      paidNet,
      pendingIncome,
      pendingExpense,
      pendingNet,
    }
  }, [filteredTransactions])

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

  const closeAdjustModal = () => {
    setIsAdjustModalOpen(false)
    setAdjustError(null)
    if (typeof window !== 'undefined' && window.location.search.includes('action=')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('action')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
    }
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
        closeAdjustModal()
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
              setTargetBalanceInput(freeCashBalance !== 0 ? String(freeCashBalance) : '')
              setAdjustNotes('')
              setIsAdjustModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all border border-[#d2d2d7] cursor-pointer shadow-2xs"
          >
            <Landmark size={15} className="text-[#0071e3]" />
            <span>Ajustar Saldo da Conta</span>
          </button>
          <button
            onClick={() => {
              setErrorMessage(null)
              setEditingTx(null)
              setModalStatus('pending')
              setModalAmount('')
              setModalInstallments(1)
              setModalPaidInstallments(0)
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
              setEditingTx(null)
              setModalStatus('pending')
              setModalAmount('')
              setModalInstallments(1)
              setModalPaidInstallments(0)
              setModalType('expense')
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#feeceb] px-3.5 py-2 text-xs font-semibold text-[#cf222e] hover:bg-[#fcd7d5] transition-all border border-[#f8b4b1] cursor-pointer"
          >
            <ArrowDownCircle size={15} strokeWidth={2.2} />
            <span>Nova Despesa</span>
          </button>
          <Link
            href="/fornecedores?action=nova-conta"
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs cursor-pointer"
          >
            <Receipt size={14} />
            <span>Lançar Boleto / Conta</span>
          </Link>
        </div>
      </div>

      {/* BARRA DE FILTRO POR MÊS E PERÍODO */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1d1d1f]">
              <Calendar className="h-4 w-4 text-[#b8860b]" />
              <span>Filtrar Mês do Fechamento:</span>
            </div>

            {/* Select Mês */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] font-semibold focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] cursor-pointer shadow-2xs"
            >
              <option value="all">📅 Todos os Meses</option>
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Select Ano */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] font-semibold focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] cursor-pointer shadow-2xs"
            >
              <option value="all">Todos os Anos</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            {isPeriodFiltered && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('all')
                  setSelectedYear('all')
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#cf222e] hover:bg-[#feeceb] rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#fcd7d5]"
              >
                Limpar Filtro
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo: Por Data de Vencimento/Quitação (Caixa) vs Mês da Festa (Evento) */}
            <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDateFilterMode('event')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  dateFilterMode === 'event'
                    ? 'bg-white text-[#1d1d1f] shadow-xs'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
                title="Agrupa pelo mês da festa/evento (Recomendado para contratos de buffet)"
              >
                🎉 Mês do Evento (Festas)
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('due')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  dateFilterMode === 'due'
                    ? 'bg-white text-[#1d1d1f] shadow-xs'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
                title="Agrupa pela data de vencimento / quitação da parcela"
              >
                📅 Vencimento / Quitação (Caixa)
              </button>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                isPeriodFiltered
                  ? 'bg-[#e8f8ee] text-[#1a7f37] border-[#b4e8c7]'
                  : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]'
              }`}
            >
              <Filter size={12} />
              <span>{isPeriodFiltered ? `Filtrando: ${periodLabel}` : 'Exibindo: Todos os Meses'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards Consolidados (Dinâmicos por Mês) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Saldo em Caixa (Livre) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
                Saldo em Caixa (Livre)
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
              R${' '}
              {cashBalance.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              {isPeriodFiltered
                ? `Entradas pagas no mês: R$ ${periodReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'Disponível na conta para uso imediato'}
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
              <span>Ajustar Saldo da Conta</span>
            </button>
          </div>
        </div>

        {/* 2. Em Caixinhas / Rendimento do Mês */}
        <div
          onClick={() => setActiveTab('caixinhas')}
          className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs hover:border-[#1d1d1f]/40 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                {isPeriodFiltered ? 'Rendimento do Mês' : 'Em Caixinhas'}
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  isPeriodFiltered
                    ? periodProfit >= 0
                      ? 'bg-[#e8f8ee] text-[#1a7f37]'
                      : 'bg-[#feeceb] text-[#cf222e]'
                    : 'bg-[#f5f5f7] text-[#1d1d1f]'
                }`}
              >
                {isPeriodFiltered
                  ? `${periodProfit >= 0 ? '+' : ''}${periodProfitMargin.toFixed(1)}% de lucro`
                  : `${localCaixinhas.length} ativas`}
              </span>
            </div>
            <p
              className={`mt-2 text-2xl font-bold tracking-tight ${
                isPeriodFiltered
                  ? periodProfit >= 0
                    ? 'text-[#1a7f37]'
                    : 'text-[#cf222e]'
                  : 'text-[#1d1d1f]'
              }`}
            >
              R${' '}
              {(isPeriodFiltered ? periodProfit : totalInCaixinhas).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              {isPeriodFiltered
                ? `Lucro líquido realizado no período`
                : 'Reservas financeiras separadas →'}
            </span>
          </div>

          {isPeriodFiltered ? (
            <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex flex-col gap-1 text-[11px] text-[#6e6e73]">
              <div className="flex items-center justify-between">
                <span>Margem Atual:</span>
                <strong className={periodProfit >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'}>
                  {periodProfitMargin.toFixed(1)}%
                </strong>
              </div>
              <div className="flex items-center justify-between text-[#b8860b]">
                <span>Ao fechar contas:</span>
                <strong>{periodProjectedProfitMargin.toFixed(1)}%</strong>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex items-center justify-between text-xs text-[#0071e3] font-semibold">
              <span>Ver caixinhas</span>
              <ArrowRight size={12} />
            </div>
          )}
        </div>

        {/* 3. Patrimônio Total da Empresa / Guardado em Caixinhas no Mês */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
                {isPeriodFiltered ? 'Guardado em Caixinhas' : 'Patrimônio Total'}
              </span>
              <span className="rounded-md bg-[#e8f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#1a7f37]">
                {isPeriodFiltered ? `${localCaixinhas.length} ativas` : 'Conta + Caixas'}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#1d1d1f]">
              R${' '}
              {(isPeriodFiltered ? totalInCaixinhas : cashBalance + totalInCaixinhas).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              {isPeriodFiltered
                ? 'Reservas e metas ativas'
                : `Conta (R$ ${cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}) + Caixinhas (R$ ${totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})`}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] text-[11px] text-[#86868b]">
            <span>{isPeriodFiltered ? 'Total guardado' : 'Total acumulado da empresa'}</span>
          </div>
        </div>

        {/* 4. A Receber (no Mês ou Total) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#b8860b]">
                {isPeriodFiltered ? 'A Receber no Mês' : 'A Receber (Futuro)'}
              </span>
              <span className="rounded-md bg-[#fff8e6] px-1.5 py-0.5 text-[10px] font-bold text-[#b8860b]">
                Pendente
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#b8860b]">
              R${' '}
              {(isPeriodFiltered ? periodPendingIncome : pendingIncomeAll).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              {isPeriodFiltered
                ? `Vencimentos previstos em ${periodLabel}`
                : 'Contratos e locações pendentes'}
            </span>
          </div>

          {isPeriodFiltered && (
            <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex items-center justify-between text-xs text-[#86868b]">
              <span>Prev. Total:</span>
              <strong className="text-[#1d1d1f]">
                R$ {periodProjectedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          )}
        </div>

        {/* 5. A Pagar (no Mês ou Total) */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#cf222e]">
                {isPeriodFiltered ? 'A Pagar no Mês' : 'A Pagar (Futuro)'}
              </span>
              <span className="rounded-md bg-[#feeceb] px-1.5 py-0.5 text-[10px] font-bold text-[#cf222e]">
                Pendente
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-[#cf222e]">
              R${' '}
              {(isPeriodFiltered ? periodPendingExpense : pendingExpenseAll).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="mt-1 block text-xs text-[#86868b]">
              {isPeriodFiltered
                ? `Custos a vencer em ${periodLabel}`
                : 'Fornecedores e custos fixos'}
            </span>
          </div>

          {isPeriodFiltered && (
            <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex items-center justify-between text-xs text-[#86868b]">
              <span>Custo Total:</span>
              <strong className="text-[#1d1d1f]">
                R$ {periodProjectedExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          )}
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
          <span>Caixinhas ({localCaixinhas.length})</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      {activeTab === 'caixinhas' ? (
        <CaixinhasFinanceiras
          initialCaixinhas={localCaixinhas}
          totalCashBalance={totalReceived - totalPaid}
          onCaixinhasChange={setLocalCaixinhas}
        />
      ) : (
        /* Transactions Table Section */
        <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#f2f2f7] p-4 gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por gasolina, mercado, cliente, fornecedor..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-9 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#86868b] hover:bg-[#e5e5ea] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X size={15} />
              </button>
            )}
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

        {/* Card de Destaque com a Soma Total quando há pesquisa digitada (ex: gasolina) */}
        {searchTerm ? (
          <div className="mx-4 my-3 p-3.5 rounded-2xl bg-[#f5f5f7] border border-[#d2d2d7] flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#1d1d1f] p-2 text-white shadow-2xs">
                <Search size={16} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#1d1d1f]">
                    Busca: &ldquo;{searchTerm}&rdquo;
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#d2d2d7] text-[#1d1d1f]">
                    {filteredMetrics.count} {filteredMetrics.count === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}
                  </span>
                  <span className="text-[11px] text-[#6e6e73]">
                    Período: <strong>{periodLabel}</strong>
                  </span>
                </div>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Soma de todos os lançamentos encontrados na busca.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {filteredMetrics.expenseTotal > 0 && (
                <div className="rounded-xl bg-white px-3.5 py-1.5 border border-[#f8b4b1] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#cf222e] uppercase block">Total Gasto (Despesas)</span>
                  <span className="text-sm font-extrabold text-[#cf222e]">
                    R$ {filteredMetrics.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {filteredMetrics.incomeTotal > 0 && (
                <div className="rounded-xl bg-white px-3.5 py-1.5 border border-[#b4e8c7] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#1a7f37] uppercase block">Total Recebido (Receitas)</span>
                  <span className="text-sm font-extrabold text-[#1a7f37]">
                    R$ {filteredMetrics.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {filteredMetrics.expenseTotal > 0 && filteredMetrics.incomeTotal > 0 && (
                <div className="rounded-xl bg-white px-3.5 py-1.5 border border-[#d2d2d7] shadow-2xs">
                  <span className="text-[10px] font-semibold text-[#6e6e73] uppercase block">Saldo da Busca</span>
                  <span className={`text-sm font-extrabold ${filteredMetrics.netTotal >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'}`}>
                    R$ {filteredMetrics.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white border border-transparent hover:border-[#d2d2d7] transition-all cursor-pointer"
              >
                Limpar busca
              </button>
            </div>
          </div>
        ) : null}

        {/* Barra de Status e Informações do Período no Extrato com Somas Totais */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#fbfbfd] border-b border-[#f2f2f7]">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#1d1d1f]">
            <div className="flex items-center gap-1.5 font-semibold">
              <Receipt size={14} className="text-[#0071e3]" />
              <span>Extrato: <strong>{periodLabel}</strong></span>
            </div>
            <span className="text-[#d1d1d6]">•</span>
            <span className="text-[#6e6e73]">
              Aba: <strong className="text-[#1d1d1f]">{
                filterStatus === 'all' ? 'Todos' :
                filterStatus === 'income' ? 'Receitas' :
                filterStatus === 'expense' ? 'Despesas' :
                filterStatus === 'tasting' ? 'Degustações' :
                filterStatus === 'pending' ? 'Pendentes' : 'Pagos'
              }</strong>
            </span>
            <span className="text-[#d1d1d6]">•</span>
            <span className="text-[#6e6e73]">
              <strong>{filteredMetrics.count}</strong> de {localTransactions.length} lançamentos
            </span>
          </div>

          {/* Valores Totais Somados da Visualização Atual */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            {filterStatus === 'expense' ? (
              <span className="text-[#cf222e] bg-[#feeceb] px-2.5 py-1 rounded-lg border border-[#f8b4b1]">
                Total de Despesas: R$ {filteredMetrics.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : filterStatus === 'income' ? (
              <span className="text-[#1a7f37] bg-[#e8f8ee] px-2.5 py-1 rounded-lg border border-[#b4e8c7]">
                Total de Receitas: R$ {filteredMetrics.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : filterStatus === 'tasting' ? (
              <span className="text-[#1d1d1f] bg-[#f5f5f7] px-2.5 py-1 rounded-lg border border-[#d2d2d7]">
                Total Degustações: R$ {(filteredMetrics.incomeTotal + filteredMetrics.expenseTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : filterStatus === 'pending' ? (
              <div className="flex items-center gap-2">
                <span className="text-[#b8860b] bg-[#fff8e6] px-2.5 py-1 rounded-lg border border-[#fbe4a0]">
                  A Receber: R$ {filteredMetrics.pendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[#cf222e] bg-[#feeceb] px-2.5 py-1 rounded-lg border border-[#f8b4b1]">
                  A Pagar: R$ {filteredMetrics.pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : filterStatus === 'paid' ? (
              <div className="flex items-center gap-2">
                <span className="text-[#1a7f37] bg-[#e8f8ee] px-2.5 py-1 rounded-lg border border-[#b4e8c7]">
                  Recebido: R$ {filteredMetrics.paidIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[#cf222e] bg-[#feeceb] px-2.5 py-1 rounded-lg border border-[#f8b4b1]">
                  Pago: R$ {filteredMetrics.paidExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[#1a7f37]">
                  Receitas: R$ {filteredMetrics.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[#cf222e]">
                  Despesas: R$ {filteredMetrics.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`px-2 py-0.5 rounded-lg border ${filteredMetrics.netTotal >= 0 ? 'bg-[#e8f8ee] text-[#1a7f37] border-[#b4e8c7]' : 'bg-[#feeceb] text-[#cf222e] border-[#f8b4b1]'}`}>
                  Líquido: R$ {filteredMetrics.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
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
                            setModalStatus(tx.status === 'paid' ? 'paid' : 'pending')
                            setModalAmount(String(Math.abs(Number(tx.amount))))
                            setModalInstallments(1)
                            setModalPaidInstallments(0)
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
            {filteredTransactions.length > 0 && (
              <tfoot className="bg-[#f9f9fb] border-t-2 border-[#e5e5ea]">
                <tr>
                  <td colSpan={4} className="px-5 py-3.5 text-left text-xs font-bold text-[#1d1d1f]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="uppercase tracking-wider">Soma Total</span>
                      <span className="font-normal text-[#6e6e73]">
                        ({filteredMetrics.count} {filteredMetrics.count === 1 ? 'item' : 'itens'}
                        {searchTerm ? ` para "${searchTerm}"` : ''})
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {filterStatus === 'expense' ? (
                      <span className="text-sm font-extrabold text-[#cf222e]">
                        - R$ {filteredMetrics.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : filterStatus === 'income' ? (
                      <span className="text-sm font-extrabold text-[#1a7f37]">
                        + R$ {filteredMetrics.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : filterStatus === 'tasting' ? (
                      <span className="text-sm font-extrabold text-[#1d1d1f]">
                        R$ {(filteredMetrics.incomeTotal + filteredMetrics.expenseTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <div className="flex flex-col items-end">
                        {filteredMetrics.expenseTotal > 0 && (
                          <span className="text-xs font-semibold text-[#cf222e]">
                            Despesas: R$ {filteredMetrics.expenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {filteredMetrics.incomeTotal > 0 && (
                          <span className="text-xs font-semibold text-[#1a7f37]">
                            Receitas: R$ {filteredMetrics.incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        <span className={`text-sm font-extrabold ${filteredMetrics.netTotal >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'}`}>
                          Líquido: R$ {filteredMetrics.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
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
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    {!editingTx && modalInstallments > 1
                      ? 'Vencimento (1ª Parcela) *'
                      : 'Data de Vencimento *'}
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
                    {modalType === 'expense' ? 'Fornecedor' : 'Cliente'}
                  </label>
                  <select
                    name="contact_id"
                    defaultValue={editingTx?.contacts?.id || ''}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all font-medium"
                  >
                    <option value="">{modalType === 'expense' ? 'Fornecedor Avulso (Sem cadastro)' : 'Cliente Avulso (Sem cadastro)'}</option>
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

              {/* Condição de Pagamento e Status (100% Padrão dropdown, sem nenhum detalhe branco) */}
              {!editingTx ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                      Condição de Pagamento
                    </label>
                    <select
                      name="installments"
                      value={modalInstallments}
                      onChange={(e) => {
                        const count = Number(e.target.value)
                        setModalInstallments(count)
                        if (modalPaidInstallments > count) {
                          setModalPaidInstallments(count)
                        }
                      }}
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all font-medium"
                    >
                      <option value="1">À vista (1x Parcela única)</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>
                          Parcelado em {n}x
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalInstallments === 1 ? (
                    <div>
                      <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                        Status do Pagamento
                      </label>
                      <select
                        name="status"
                        value={modalStatus}
                        onChange={(e) => setModalStatus(e.target.value as 'pending' | 'paid')}
                        className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all font-medium"
                      >
                        <option value="pending">Pendente (A receber / A pagar)</option>
                        <option value="paid">Já Liquidado (Pago)</option>
                      </select>
                      <input
                        type="hidden"
                        name="paid_installments"
                        value={modalStatus === 'paid' ? '1' : '0'}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                        Parcelas Já Pagas
                      </label>
                      <select
                        name="paid_installments"
                        value={modalPaidInstallments}
                        onChange={(e) => setModalPaidInstallments(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all font-medium"
                      >
                        <option value="0">0 parcelas pagas (Todas pendentes)</option>
                        {Array.from({ length: modalInstallments }, (_, idx) => idx + 1).map((n) => (
                          <option key={n} value={n}>
                            {n === modalInstallments
                              ? `${n} de ${modalInstallments} (Todas quitadas)`
                              : `${n} de ${modalInstallments} ${n === 1 ? 'já paga' : 'já pagas'}`}
                          </option>
                        ))}
                      </select>
                      <input
                        type="hidden"
                        name="status"
                        value={modalPaidInstallments === modalInstallments ? 'paid' : 'pending'}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Status do Lançamento
                  </label>
                  <select
                    name="status"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as 'pending' | 'paid')}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all font-medium"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Já Liquidado (Pago)</option>
                  </select>
                </div>
              )}

              {/* Resumo quando parcelado */}
              {!editingTx && modalInstallments > 1 && Number(modalAmount) > 0 && (
                <div className="rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-3 text-xs text-[#1d1d1f] space-y-1">
                  <div className="font-semibold text-[#1d1d1f] flex items-center justify-between">
                    <span>
                      {modalInstallments}x de R${' '}
                      {((parseFloat(modalAmount) || 0) / modalInstallments).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[#6e6e73]">
                      Total: R${' '}
                      {(parseFloat(modalAmount) || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-[#6e6e73]">
                    {modalPaidInstallments === 0 ? (
                      `Todas as ${modalInstallments} parcelas mensais serão criadas como Pendentes.`
                    ) : modalPaidInstallments === modalInstallments ? (
                      <span className="text-[#1a7f37] font-medium">
                        Todas as ${modalInstallments} parcelas mensais serão criadas como Já Pagas.
                      </span>
                    ) : (
                      <>
                        <span className="text-[#1a7f37] font-medium">
                          {modalPaidInstallments}{' '}
                          {modalPaidInstallments === 1 ? 'parcela criada como Paga' : 'parcelas criadas como Pagas'}
                        </span>{' '}
                        e{' '}
                        <span className="text-[#b8860b] font-medium">
                          {modalInstallments - modalPaidInstallments} parcela(s) pendente(s)
                        </span>{' '}
                        nos meses subsequentes.
                      </>
                    )}
                  </p>
                </div>
              )}

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
                onClick={closeAdjustModal}
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
              <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6e73]">Saldo atual na Conta (Livre):</span>
                  <strong className="text-[#1a7f37] font-mono text-sm">
                    R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-[#86868b] text-[11px]">
                  <span>Guardado em Caixinhas:</span>
                  <span className="font-mono">
                    R$ {totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#86868b] text-[11px] pt-1 border-t border-[#e5e5ea]">
                  <span>Patrimônio Total da Empresa:</span>
                  <span className="font-mono font-semibold text-[#1d1d1f]">
                    R$ {(cashBalance + totalInCaixinhas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-[#86868b] leading-relaxed pt-1 border-t border-[#e5e5ea]">
                  💡 <strong>Como funciona:</strong> Digite o saldo que aparece hoje no aplicativo do seu banco (conta corrente). O sistema ajustará para igualar ao banco.
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
                          (Saldo Inicial/Aporte) para igualar o saldo da conta ao banco.
                        </>
                      ) : diff < 0 ? (
                        <>
                          📉 <strong>Acerto de Gastos Anteriores:</strong> Será registrado um ajuste de saída de{' '}
                          <strong>R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{' '}
                          referente a dinheiro gasto no passado sem lançamento.
                        </>
                      ) : (
                        <>
                          ✅ O saldo da conta já está exatamente no mesmo valor do banco (R${' '}
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
                  onClick={closeAdjustModal}
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

