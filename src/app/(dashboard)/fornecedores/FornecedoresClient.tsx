'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
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
  ChevronLeft,
  ChevronRight,
  QrCode,
  Copy,
  Check,
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
  initialTab = 'fornecedores',
}: {
  suppliers: Supplier[]
  transactions: SupplierTransaction[]
  events: { id: string; title: string }[]
  caixinhas?: Caixinha[]
  initialAction?: string
  initialTab?: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'fornecedores' | 'contas'>(
    initialTab === 'contas' ? 'contas' : 'fornecedores'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  // Filtros de Período (Mês, Ano e Dia)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('')

  // Modais
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers)
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null)

  useEffect(() => {
    setLocalSuppliers(suppliers)
  }, [suppliers])

  const [supplierModalOpen, setSupplierModalOpen] = useState(initialAction === 'novo-fornecedor')
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [billModalOpen, setBillModalOpen] = useState(initialAction === 'nova-conta')
  const [selectedSupplierForBill, setSelectedSupplierForBill] = useState<string>('')

  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Formatadores visuais
  const formatPhone = (phone?: string | null) => {
    if (!phone) return ''
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
    }
    return phone
  }

  const formatDoc = (doc?: string | null) => {
    if (!doc) return ''
    const clean = doc.replace(/\D/g, '')
    if (clean.length === 14) {
      return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`
    }
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
    }
    return doc
  }

  // Filtrar apenas despesas ligadas a fornecedores
  const supplierTxs = transactions.filter((t) => t.type === 'expense')

  // Cálculos consolidados
  const pendingBills = supplierTxs.filter((t) => t.status === 'pending')
  const totalPendingAmount = pendingBills.reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const paidBills = supplierTxs.filter((t) => t.status === 'paid')
  const totalPaidAmount = paidBills.reduce((acc, t) => acc + Number(t.amount || 0), 0)

  // Lista de Meses
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

  // Anos disponíveis dinamicamente com base nas contas
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear()
    const yearsSet = new Set<string>()
    yearsSet.add(String(currentY))
    yearsSet.add(String(currentY - 1))
    yearsSet.add(String(currentY + 1))

    supplierTxs.forEach((t) => {
      const d = t.due_date || t.paid_date
      if (d) {
        const y = d.split('T')[0].split('-')[0]
        if (y && !isNaN(Number(y)) && y.length === 4) {
          yearsSet.add(y)
        }
      }
    })

    return Array.from(yearsSet).sort()
  }, [supplierTxs])

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const tomorrowObj = new Date()
  tomorrowObj.setDate(tomorrowObj.getDate() + 1)
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0]

  const currentYearStr = String(now.getFullYear())
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0')

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthYearStr = String(nextMonthDate.getFullYear())
  const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, '0')

  const isCurrentMonthSelected =
    !selectedDateFilter &&
    selectedMonth === currentMonthStr &&
    selectedYear === currentYearStr

  const isNextMonthSelected =
    !selectedDateFilter &&
    selectedMonth === nextMonthStr &&
    selectedYear === nextMonthYearStr

  const hasActiveDateFilter =
    Boolean(selectedDateFilter) || selectedMonth !== 'all' || selectedYear !== 'all'

  // Manipuladores de Filtros de Período
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    if (selectedDateFilter) setSelectedDateFilter('')
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    if (selectedDateFilter) setSelectedDateFilter('')
  }

  const handleSelectCurrentMonth = () => {
    setSelectedYear(currentYearStr)
    setSelectedMonth(currentMonthStr)
    setSelectedDateFilter('')
  }

  const handleSelectNextMonth = () => {
    setSelectedYear(nextMonthYearStr)
    setSelectedMonth(nextMonthStr)
    setSelectedDateFilter('')
  }

  const handleNavigateMonth = (direction: -1 | 1) => {
    const yr = selectedYear !== 'all' ? parseInt(selectedYear, 10) : now.getFullYear()
    const mo = selectedMonth !== 'all' ? parseInt(selectedMonth, 10) - 1 : now.getMonth()
    const target = new Date(yr, mo + direction, 1)
    setSelectedYear(String(target.getFullYear()))
    setSelectedMonth(String(target.getMonth() + 1).padStart(2, '0'))
    setSelectedDateFilter('')
  }

  const handleDayChange = (val: string) => {
    setSelectedDateFilter(val)
    if (val) {
      const parts = val.split('-')
      if (parts.length >= 2) {
        setSelectedYear(parts[0])
        setSelectedMonth(parts[1])
      }
    }
  }

  const handleSelectToday = () => {
    setSelectedDateFilter(todayStr)
    const parts = todayStr.split('-')
    setSelectedYear(parts[0])
    setSelectedMonth(parts[1])
  }

  const handleSelectTomorrow = () => {
    setSelectedDateFilter(tomorrowStr)
    const parts = tomorrowStr.split('-')
    setSelectedYear(parts[0])
    setSelectedMonth(parts[1])
  }

  const handleNavigateDay = (direction: -1 | 1) => {
    if (!selectedDateFilter) return
    const d = new Date(selectedDateFilter + 'T00:00:00')
    d.setDate(d.getDate() + direction)
    const newStr = d.toISOString().split('T')[0]
    handleDayChange(newStr)
  }

  const handleClearDayOnly = () => {
    setSelectedDateFilter('')
  }

  const handleClearDateFilters = () => {
    setSelectedDateFilter('')
    setSelectedMonth('all')
    setSelectedYear('all')
  }

  const periodLabel = useMemo(() => {
    if (selectedDateFilter) {
      return `em ${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('pt-BR')}`
    }
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      const mName = MONTH_NAMES.find((m) => m.value === selectedMonth)?.label
      return `em ${mName} de ${selectedYear}`
    }
    if (selectedMonth !== 'all' && selectedYear === 'all') {
      const mName = MONTH_NAMES.find((m) => m.value === selectedMonth)?.label
      return `em ${mName}`
    }
    if (selectedMonth === 'all' && selectedYear !== 'all') {
      return `em ${selectedYear}`
    }
    return 'no total'
  }, [selectedDateFilter, selectedMonth, selectedYear])

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

    // Filtro por Data (vencimento ou pagamento)
    const rawDate = tx.due_date || tx.paid_date || ''
    const txDate = rawDate.split('T')[0]
    const parts = txDate.split('-')
    const txYear = parts[0]
    const txMonth = parts[1]

    if (selectedDateFilter && txDate !== selectedDateFilter) return false
    if (selectedMonth !== 'all' && txMonth !== selectedMonth) return false
    if (selectedYear !== 'all' && txYear !== selectedYear) return false

    return true
  })

  const filteredBillsTotal = useMemo(() => {
    return filteredBills.reduce((acc, t) => acc + Number(t.amount || 0), 0)
  }, [filteredBills])

  // Filtragem do catálogo de fornecedores
  const filteredSuppliers = localSuppliers.filter((s) => {
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
        if (res?.supplier) {
          if (editingSupplier) {
            setLocalSuppliers((prev) =>
              prev.map((s) => (s.id === res.supplier.id ? res.supplier : s))
            )
          } else {
            setLocalSuppliers((prev) => [res.supplier, ...prev])
          }
        }
        setSupplierModalOpen(false)
        setEditingSupplier(null)
        setActiveTab('fornecedores') // Garante que a tela mude imediatamente para a aba de fornecedores
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
        setLocalSuppliers((prev) => prev.filter((s) => s.id !== id))
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

      {/* 3 KPI Cards Rápidos e Visuais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 1. Fornecedores Cadastrados */}
        <div
          onClick={() => setActiveTab('fornecedores')}
          className={`rounded-2xl border p-5 transition-all cursor-pointer shadow-xs ${
            activeTab === 'fornecedores'
              ? 'border-[#f59e0b] bg-gradient-to-br from-[#fffdf5] to-[#fef3c7] ring-2 ring-[#f59e0b]/30 shadow-sm'
              : 'border-[#fed7aa] bg-gradient-to-br from-[#fffdfa] to-[#fff7ed] hover:border-[#f59e0b]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
              Fornecedores Parceiros
            </span>
            <span className="rounded-full bg-[#fde68a] px-2 py-0.5 text-xs font-bold text-[#92400e]">
              {localSuppliers.length} ativos
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#b45309]">
            {localSuppliers.length}
          </p>
          <span className="mt-1 block text-xs text-[#b45309]/80 font-medium">
            Clique para ver a lista visual de parceiros
          </span>
        </div>

        {/* 2. A Pagar a Fornecedores (Pendente) */}
        <div
          onClick={() => {
            setStatusFilter('pending')
            setActiveTab('contas')
          }}
          className={`rounded-2xl border p-5 transition-all cursor-pointer shadow-xs ${
            activeTab === 'contas' && statusFilter === 'pending'
              ? 'border-[#cf222e] bg-white ring-2 ring-[#cf222e]/10'
              : 'border-[#e5e5ea] bg-white hover:border-[#cf222e]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#cf222e]">
              A Pagar (Pendente)
            </span>
            <span className="rounded-full bg-[#feeceb] px-2 py-0.5 text-[11px] font-bold text-[#cf222e]">
              {pendingBills.length} {pendingBills.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#cf222e]">
            R$ {totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Boletos e notas de insumos a liquidar
          </span>
        </div>

        {/* 3. Total Já Pago */}
        <div
          onClick={() => {
            setStatusFilter('paid')
            setActiveTab('contas')
          }}
          className={`rounded-2xl border p-5 transition-all cursor-pointer shadow-xs ${
            activeTab === 'contas' && statusFilter === 'paid'
              ? 'border-[#1a7f37] bg-white ring-2 ring-[#1a7f37]/10'
              : 'border-[#e5e5ea] bg-white hover:border-[#1a7f37]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1a7f37]">
              Total Já Pago
            </span>
            <span className="rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[11px] font-bold text-[#1a7f37]">
              {paidBills.length} pagos
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#1a7f37]">
            R$ {totalPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-[#86868b]">
            Histórico quitado a fornecedores
          </span>
        </div>
      </div>

      {/* Abas de Navegação (Fornecedores primeiro por padrão!) */}
      <div className="flex items-center gap-2 border-b border-[#f2f2f7] pb-3">
        <button
          onClick={() => setActiveTab('fornecedores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'fornecedores'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
          }`}
        >
          <Building2 size={16} />
          <span>👥 Fornecedores Cadastrados ({localSuppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('contas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'contas'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
          }`}
        >
          <DollarSign size={16} />
          <span>📄 Todas as Contas & Boletos a Pagar ({supplierTxs.length})</span>
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
                {localSuppliers.map((s) => (
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

          {/* Destaque Visual do Fornecedor Filtrado */}
          {supplierFilter !== 'all' && (() => {
            const activeSupp = localSuppliers.find((s) => s.id === supplierFilter)
            if (!activeSupp) return null
            const suppPending = supplierTxs.filter((t) => t.contact_id === activeSupp.id && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount || 0), 0)
            const cleanPh = activeSupp.phone ? activeSupp.phone.replace(/\D/g, '') : ''
            const pix = activeSupp.document || (activeSupp.notes?.startsWith('Chave PIX: ') ? activeSupp.notes.replace('Chave PIX: ', '') : null)

            return (
              <div className="rounded-2xl border border-[#fed7aa] bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-xs ring-2 ring-[#fde68a]">
                    {activeSupp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-[#78350f]">{activeSupp.name}</h4>
                      <button
                        onClick={() => setSupplierFilter('all')}
                        className="text-[11px] font-bold text-[#b45309] hover:underline cursor-pointer bg-[#fde68a] px-2 py-0.5 rounded-full"
                      >
                        (Mostrar todos)
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#92400e] mt-1.5 flex-wrap">
                      {activeSupp.phone && (
                        <span className="flex items-center gap-1 font-semibold text-[#1f2937] bg-white/70 px-2 py-0.5 rounded-lg border border-[#fde68a]">
                          <Phone size={12} className="text-[#1a7f37]" />
                          {formatPhone(activeSupp.phone)}
                        </span>
                      )}
                      {cleanPh.length >= 10 && (
                        <a
                          href={`https://wa.me/55${cleanPh}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:opacity-90 bg-[#16a34a] px-2.5 py-1 rounded-lg shadow-2xs"
                        >
                          <MessageCircle size={12} />
                          WhatsApp
                        </a>
                      )}
                      {pix && (
                        <span className="flex items-center gap-1.5 bg-[#eff6ff] px-2.5 py-1 rounded-lg border border-[#bfdbfe] text-[#1e40af]">
                          <QrCode size={12} className="text-[#2563eb]" />
                          PIX: <strong className="font-mono text-[#1e40af]">{formatDoc(pix)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-bold text-[#86868b] block uppercase">Pendente</span>
                    <span className="font-bold text-sm text-[#cf222e]">
                      R$ {suppPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setErrorMessage(null)
                      setSelectedSupplierForBill(activeSupp.id)
                      setBillModalOpen(true)
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Lançar Conta</span>
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Barra de Filtros de Período (Mês, Ano e Dia) - Padrão Degustação & Eventos */}
          <div className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-3.5 shadow-2xs">
            {/* Linha Principal: Mês, Ano e Atalhos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#d97706]" />
                  Período:
                </span>

                {/* Seletor de Mês */}
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] font-medium focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer hover:border-[#86868b]"
                  title="Filtrar por Mês"
                >
                  <option value="all">Todos os Meses</option>
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                {/* Seletor de Ano */}
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] font-medium focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer hover:border-[#86868b]"
                  title="Filtrar por Ano"
                >
                  <option value="all">Todos os Anos</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                {/* Navegação Rápida de Mês */}
                {selectedMonth !== 'all' && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNavigateMonth(-1)}
                      className="p-1.5 text-xs font-medium rounded-lg border border-[#d1d1d6] bg-white text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                      title="Mês anterior"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateMonth(1)}
                      className="p-1.5 text-xs font-medium rounded-lg border border-[#d1d1d6] bg-white text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                      title="Próximo mês"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                <div className="hidden sm:block h-4 w-px bg-[#e5e5ea]" />

                <button
                  type="button"
                  onClick={handleSelectCurrentMonth}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isCurrentMonthSelected
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                      : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Este Mês
                </button>

                <button
                  type="button"
                  onClick={handleSelectNextMonth}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isNextMonthSelected
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                      : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Próximo Mês
                </button>
              </div>

              {/* Contador / Resumo */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                    hasActiveDateFilter
                      ? filteredBills.length > 0
                        ? 'bg-[#e8f8ee] border-[#1a7f37]/30 text-[#1a7f37]'
                        : 'bg-[#fff8e6] border-[#b8860b]/30 text-[#b8860b]'
                      : 'bg-white border-[#e5e5ea] text-[#6e6e73]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasActiveDateFilter
                        ? filteredBills.length > 0
                          ? 'bg-[#1a7f37]'
                          : 'bg-[#b8860b]'
                        : 'bg-[#86868b]'
                    }`}
                  />
                  <strong>{filteredBills.length}</strong>{' '}
                  {filteredBills.length === 1 ? 'conta' : 'contas'}{' '}
                  {periodLabel}
                  {filteredBills.length > 0 && (
                    <span className="font-bold ml-1 text-[#1d1d1f]">
                      (R$ {filteredBillsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </span>
                  )}
                </span>

                {hasActiveDateFilter && (
                  <button
                    type="button"
                    onClick={handleClearDateFilters}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-[#feeceb] text-[#cf222e] hover:bg-[#fdd8d5] transition-all cursor-pointer flex items-center gap-1"
                    title="Limpar todos os filtros de data"
                  >
                    <X size={13} />
                    <span className="hidden sm:inline">Limpar Filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Linha Secundária: Dia Específico */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#f0f0f4]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#6e6e73] flex items-center gap-1 font-medium">
                  <Clock className="h-3 w-3 text-[#86868b]" />
                  Dia específico:
                </span>

                <input
                  type="date"
                  value={selectedDateFilter}
                  onChange={(e) => handleDayChange(e.target.value)}
                  className="rounded-xl border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs text-[#1d1d1f] font-medium focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer hover:border-[#86868b]"
                  title="Selecione um dia específico"
                />

                <button
                  type="button"
                  onClick={handleSelectToday}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    selectedDateFilter === todayStr
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                      : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Hoje
                </button>

                <button
                  type="button"
                  onClick={handleSelectTomorrow}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    selectedDateFilter === tomorrowStr
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                      : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Amanhã
                </button>

                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={handleClearDayOnly}
                    className="px-2 py-1 text-xs font-medium rounded-lg text-[#0071e3] hover:bg-[#ebf4fe] transition-all cursor-pointer"
                    title="Ver todo o mês selecionado"
                  >
                    Ver mês completo
                  </button>
                )}
              </div>

              {selectedDateFilter && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleNavigateDay(-1)}
                    className="px-2 py-0.5 text-xs font-medium rounded-lg border border-[#d1d1d6] bg-white text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                    title="Ver dia anterior"
                  >
                    ◀ Dia anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateDay(1)}
                    className="px-2 py-0.5 text-xs font-medium rounded-lg border border-[#d1d1d6] bg-white text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                    title="Ver próximo dia"
                  >
                    Próximo dia ▶
                  </button>
                </div>
              )}
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
                        {supplierFilter !== 'all' ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-sm text-[#1d1d1f]">
                              Nenhuma conta encontrada para este fornecedor.
                            </p>
                            <p className="text-xs text-[#86868b]">
                              O fornecedor está cadastrado, mas ainda não possui nenhum boleto ou nota pendente.
                            </p>
                            <button
                              onClick={() => {
                                setErrorMessage(null)
                                setSelectedSupplierForBill(supplierFilter)
                                setBillModalOpen(true)
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>Lançar Primeira Conta</span>
                            </button>
                          </div>
                        ) : (
                          'Nenhuma conta ou boleto de fornecedor encontrado.'
                        )}
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
                const pixKey = s.document || (s.notes?.startsWith('Chave PIX: ') ? s.notes.replace('Chave PIX: ', '') : null)
                const otherNotes = s.notes && !s.notes.startsWith('Chave PIX: ') ? s.notes : null

                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-[#fed7aa] bg-gradient-to-b from-[#fffefc] to-[#fff7ed] p-5 shadow-xs hover:border-[#f59e0b] hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#d97706]" />
                    <div>
                      {/* Topo do Card com Avatar e Nome */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs ring-2 ring-[#fde68a]">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-[#78350f] truncate" title={s.name}>
                              {s.name}
                            </h3>
                            <span className="text-[11px] block mt-0.5">
                              {sPending > 0 ? (
                                <span className="font-bold text-[#cf222e] bg-[#feeceb] px-2 py-0.5 rounded-full inline-block">
                                  R$ {sPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a pagar
                                </span>
                              ) : (
                                <span className="font-semibold text-[#1a7f37] bg-[#e8f8ee] px-2 py-0.5 rounded-full inline-block">
                                  ✓ Sem pendências
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setErrorMessage(null)
                              setEditingSupplier(s)
                              setSupplierModalOpen(true)
                            }}
                            className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#fed7aa]/50 hover:text-[#78350f] transition-colors cursor-pointer"
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
                      <div className="space-y-2.5 text-xs text-[#6e6e73] mb-4">
                        {s.phone && (
                          <div className="flex items-center justify-between bg-[#f0fdf4] p-2 rounded-xl border border-[#bbf7d0]">
                            <span className="flex items-center gap-1.5 font-semibold text-[#166534]">
                              <Phone size={13} className="text-[#16a34a]" />
                              <span>{formatPhone(s.phone)}</span>
                            </span>
                            {cleanPhone.length >= 10 && (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:opacity-90 bg-[#16a34a] px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                              >
                                <MessageCircle size={13} />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}

                        {/* Chave PIX com botão de copiar em um clique */}
                        {pixKey && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#eff6ff] border border-[#bfdbfe] text-xs">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <QrCode size={14} className="text-[#2563eb] shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-[#1d4ed8] block uppercase">Chave PIX:</span>
                                <span className="font-mono text-xs font-bold text-[#1e40af] truncate block" title={pixKey}>
                                  {formatDoc(pixKey)}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pixKey)
                                setCopiedPixId(s.id)
                                setTimeout(() => setCopiedPixId(null), 2000)
                              }}
                              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                                copiedPixId === s.id
                                  ? 'bg-[#16a34a] text-white'
                                  : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                              }`}
                              title="Copiar Chave PIX"
                            >
                              {copiedPixId === s.id ? (
                                <>
                                  <Check size={12} className="text-white" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} className="text-white" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {s.email && (
                          <div className="flex items-center gap-1.5 text-[#92400e] px-1 font-medium">
                            <Mail size={13} className="text-[#b45309]" />
                            <span className="truncate">{s.email}</span>
                          </div>
                        )}

                        {otherNotes && (
                          <div className="p-2.5 bg-[#fefce8] rounded-xl border border-[#fef08a] text-[11px] text-[#713f12]">
                            <span className="font-bold block text-[#854d0e] text-[10px] uppercase">Observações:</span>
                            <span>{otherNotes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumo Financeiro & Ações */}
                    <div className="pt-3 border-t border-[#fed7aa]/50 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-[#fff8e6] rounded-xl border border-[#fee4a6]">
                          <span className="text-[10px] font-bold text-[#b8860b] block uppercase">Pendente</span>
                          <span className="font-bold text-xs text-[#b8860b]">
                            R$ {sPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-2 bg-[#e8f8ee] rounded-xl border border-[#b4e8c7]">
                          <span className="text-[10px] font-bold text-[#1a7f37] block uppercase">Já Pago</span>
                          <span className="font-bold text-xs text-[#1a7f37]">
                            R$ {sPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setErrorMessage(null)
                            setSelectedSupplierForBill(s.id)
                            setBillModalOpen(true)
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] py-2.5 text-xs font-bold text-white transition-all shadow-xs cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>+ Lançar Boleto</span>
                        </button>

                        <button
                          onClick={() => {
                            setSupplierFilter(s.id)
                            setActiveTab('contas')
                          }}
                          className="flex items-center justify-center gap-1 rounded-xl bg-[#fef3c7] hover:bg-[#fde68a] border border-[#fde68a] px-3 py-2.5 text-xs font-bold text-[#92400e] transition-colors cursor-pointer"
                          title="Ver histórico de contas"
                        >
                          <span>Contas ({sTxs.length})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="col-span-full rounded-2xl border border-[#e5e5ea] bg-white p-12 text-center text-[#86868b]">
                Nenhum fornecedor encontrado para esta busca.
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

              {/* 1. Nome do Fornecedor */}
              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1.5">
                  Nome do Fornecedor / Empresa *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  autoFocus
                  defaultValue={editingSupplier?.name || ''}
                  placeholder="Ex: DJ Marcos, Buffet Requinte, Distribuidora Prime..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              {/* 2. Telefone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                  <Phone size={13} className="text-[#1a7f37]" />
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={editingSupplier?.phone || ''}
                  placeholder="(81) 99999-9999"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              {/* 3. Chave PIX */}
              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <QrCode size={13} className="text-[#0071e3]" />
                    Chave PIX
                  </span>
                  <span className="text-[11px] font-normal text-[#86868b]">CPF, CNPJ, Celular, E-mail ou Aleatória</span>
                </label>
                <input
                  type="text"
                  name="pix"
                  defaultValue={
                    editingSupplier?.document ||
                    (editingSupplier?.notes?.startsWith('Chave PIX: ')
                      ? editingSupplier.notes.replace('Chave PIX: ', '')
                      : '')
                  }
                  placeholder="Ex: 81999999999 ou financeiro@email.com ou 00.000.000/0001-00"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-sm font-medium text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              {/* 4. Observações Opcionais */}
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                  Observações adicionais (opcional)
                </label>
                <input
                  type="text"
                  name="notes"
                  defaultValue={
                    editingSupplier?.notes?.startsWith('Chave PIX: ') ? '' : (editingSupplier?.notes || '')
                  }
                  placeholder="Ex: Banco Santander / Falar com Carlos"
                  className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:bg-white focus:outline-none transition-all"
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
                  className="rounded-xl bg-[#1d1d1f] hover:bg-black text-white px-5 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Salvando...' : editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
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
                  {localSuppliers.map((s) => (
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


    </div>
  )
}
