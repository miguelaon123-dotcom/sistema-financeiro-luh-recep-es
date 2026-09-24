'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  CalendarPlus,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  CalendarDays,
  Check,
  Ban,
  RotateCcw,
} from 'lucide-react'
import {
  TastingItem,
  createTasting,
  updateTasting,
  updateTastingStatus,
  deleteTasting,
} from './actions'
import { useConfirm } from '@/components/ConfirmDialog'

export function DegustacoesClient({
  tastings,
  initialOpenModal = false,
}: {
  tastings: TastingItem[]
  initialOpenModal?: boolean
}) {
  const router = useRouter()
  const [localTastings, setLocalTastings] = useState<TastingItem[]>(tastings)

  useEffect(() => {
    setLocalTastings(tastings)
  }, [tastings])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal)
  const [editingTasting, setEditingTasting] = useState<TastingItem | null>(null)

  // Campos do Modal
  const [modalTitle, setModalTitle] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalAmount, setModalAmount] = useState('')
  const [modalPeopleCount, setModalPeopleCount] = useState('2')
  const [modalStatus, setModalStatus] = useState<'scheduled' | 'completed' | 'canceled'>('scheduled')

  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => {
    if (editingTasting) {
      setModalTitle(editingTasting.title || '')
      setModalDate(editingTasting.date ? editingTasting.date.split('T')[0] : '')
      setModalAmount(editingTasting.amount ? String(editingTasting.amount) : '')
      setModalPeopleCount(editingTasting.people_count ? String(editingTasting.people_count) : '2')
      setModalStatus(editingTasting.status || 'scheduled')
    } else {
      setModalTitle('')
      setModalDate(new Date().toISOString().split('T')[0])
      setModalAmount('')
      setModalPeopleCount('2')
      setModalStatus('scheduled')
    }
  }, [editingTasting, isModalOpen])

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

  // Anos disponíveis dinamicamente
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear()
    const yearsSet = new Set<string>()
    yearsSet.add(String(currentY))
    yearsSet.add(String(currentY - 1))
    yearsSet.add(String(currentY + 1))

    localTastings.forEach((t) => {
      if (t.date) {
        const y = t.date.split('T')[0].split('-')[0]
        if (y && !isNaN(Number(y)) && y.length === 4) {
          yearsSet.add(y)
        }
      }
    })

    return Array.from(yearsSet).sort()
  }, [localTastings])

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

  // Manipuladores de Filtros
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

  // Filtragem de Degustações
  const filteredTastings = localTastings.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus

    const tDate = t.date ? t.date.split('T')[0] : ''
    const parts = tDate.split('-')
    const tYear = parts[0]
    const tMonth = parts[1]

    const matchesExactDate = !selectedDateFilter || tDate === selectedDateFilter
    const matchesMonth = selectedMonth === 'all' || tMonth === selectedMonth
    const matchesYear = selectedYear === 'all' || tYear === selectedYear

    return matchesSearch && matchesStatus && matchesExactDate && matchesMonth && matchesYear
  })

  // Submit
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingTasting ? await updateTasting(formData) : await createTasting(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsModalOpen(false)
        setEditingTasting(null)
        form.reset()
        router.refresh()
      }
    })
  }

  // Alterar Status
  const handleStatusChange = (id: string, newStatus: 'scheduled' | 'completed' | 'canceled') => {
    setActionLoadingId(id)
    setLocalTastings((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    )
    startTransition(async () => {
      const res = await updateTastingStatus(id, newStatus)
      if (res?.error) alert(res.error)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Excluir
  const handleDelete = (id: string, title: string) => {
    confirm(`Deseja realmente excluir a degustação "${title}"?`).then((ok) => {
      if (!ok) return
      setActionLoadingId(id)
      setLocalTastings((prev) => prev.filter((t) => t.id !== id))
      startTransition(async () => {
        await deleteTasting(id)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Abas Superiores Integradas: Eventos e Degustações */}
      <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-3">
        <Link
          href="/eventos"
          className="px-4 py-2 text-sm font-semibold rounded-xl text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all flex items-center gap-2 cursor-pointer"
        >
          <CalendarDays size={16} />
          <span>Eventos & Festas</span>
        </Link>
        <Link
          href="/degustacoes"
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#1d1d1f] text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <UtensilsCrossed size={16} />
          <span>Degustações</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            Gestão de Degustações
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Agendamento e controle de degustações de cardápio para noivos e clientes.
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              setErrorMessage(null)
              setEditingTasting(null)
              setIsModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <CalendarPlus size={15} strokeWidth={2.2} />
            <span>Nova Degustação</span>
          </button>
        </div>
      </div>

      {/* Container Principal */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
        {/* Barra de Busca e Filtro de Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do cliente..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto">
            {[
              { label: 'Todas', val: 'all' },
              { label: 'Agendadas', val: 'scheduled' },
              { label: 'Realizadas', val: 'completed' },
              { label: 'Canceladas', val: 'canceled' },
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

        {/* Barra de Filtros de Período (Mês, Ano e Dia) */}
        <div className="mb-6 p-4 rounded-2xl bg-[#fbfbfd] border border-[#e5e5ea] space-y-3.5 shadow-2xs">
          {/* Linha Principal: Mês, Ano e Atalhos */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#b8860b]" />
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
                    ? filteredTastings.length > 0
                      ? 'bg-[#e8f8ee] border-[#1a7f37]/30 text-[#1a7f37]'
                      : 'bg-[#fff8e6] border-[#b8860b]/30 text-[#b8860b]'
                    : 'bg-white border-[#e5e5ea] text-[#6e6e73]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasActiveDateFilter
                      ? filteredTastings.length > 0
                        ? 'bg-[#1a7f37]'
                        : 'bg-[#b8860b]'
                      : 'bg-[#86868b]'
                  }`}
                />
                <strong>{filteredTastings.length}</strong>{' '}
                {filteredTastings.length === 1 ? 'degustação' : 'degustações'}{' '}
                {periodLabel}
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

        {/* Grid de Cards de Degustações */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTastings.length > 0 ? (
            filteredTastings.map((tasting) => {
              return (
                <div
                  key={tasting.id}
                  className="group rounded-2xl border border-[#e5e5ea] bg-white p-5 hover:border-[#1d1d1f]/30 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Cabeçalho do Card: Nome e Status */}
                    <div className="flex justify-between items-start mb-3.5 gap-2">
                      <h3 className="font-semibold text-base text-[#1d1d1f] group-hover:text-[#b8860b] transition-colors leading-snug">
                        {tasting.title}
                      </h3>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          tasting.status === 'scheduled'
                            ? 'bg-[#ebf4fe] text-[#0071e3]'
                            : tasting.status === 'completed'
                            ? 'bg-[#e8f8ee] text-[#1a7f37]'
                            : 'bg-[#feeceb] text-[#cf222e]'
                        }`}
                      >
                        {tasting.status === 'scheduled'
                          ? 'Agendada'
                          : tasting.status === 'completed'
                          ? 'Realizada'
                          : 'Cancelada'}
                      </span>
                    </div>

                    {/* Informações: Data e Quantidade de Pessoas */}
                    <div className="space-y-2 text-xs text-[#6e6e73]">
                      <button
                        type="button"
                        onClick={() => {
                          const datePart = tasting.date ? tasting.date.split('T')[0] : ''
                          const parts = datePart.split('-')
                          if (parts.length >= 2) {
                            setSelectedYear(parts[0])
                            setSelectedMonth(parts[1])
                          }
                          setSelectedDateFilter(datePart)
                        }}
                        className="flex items-center gap-2 text-left hover:text-[#1d1d1f] hover:underline cursor-pointer transition-colors group/date"
                        title="Clique para filtrar apenas degustações deste dia"
                      >
                        <Calendar className="h-3.5 w-3.5 text-[#86868b] group-hover/date:text-[#b8860b]" />
                        <span>{new Date(tasting.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        {selectedDateFilter === (tasting.date ? tasting.date.split('T')[0] : '') && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1d1d1f] text-white">
                            Dia filtrado
                          </span>
                        )}
                      </button>

                      <p className="flex items-center gap-2 font-medium text-[#334155]">
                        <Users className="h-3.5 w-3.5 text-[#64748b]" />
                        <span>
                          {tasting.people_count || 1}{' '}
                          {Number(tasting.people_count) === 1 ? 'pessoa' : 'pessoas'}
                        </span>
                      </p>

                      {/* Bloco de Valor */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                          <span className="text-xs text-[#64748b] font-medium flex items-center gap-1">
                            <DollarSign size={14} className="text-[#1a7f37]" />
                            Valor da Degustação:
                          </span>
                          <span className="font-bold text-xs text-[#1d1d1f]">
                            {Number(tasting.amount) > 0 ? (
                              `R$ ${Number(tasting.amount).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}`
                            ) : (
                              <span className="text-[#1a7f37]">Gratuita / Cortesia</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé: Ações e Mudança Rápida de Status */}
                  <div className="mt-5 pt-3.5 border-t border-[#f2f2f7] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {tasting.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(tasting.id, 'completed')}
                          disabled={actionLoadingId === tasting.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#e8f8ee] text-[#1a7f37] hover:bg-[#d0f3dc] transition-all cursor-pointer"
                          title="Marcar degustação como realizada"
                        >
                          <Check size={12} strokeWidth={2.5} />
                          <span>Realizada</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(tasting.id, 'scheduled')}
                          disabled={actionLoadingId === tasting.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea] transition-all cursor-pointer"
                          title="Reabrir como agendada"
                        >
                          <RotateCcw size={12} />
                          <span>Reabrir</span>
                        </button>
                      )}

                      {tasting.status !== 'canceled' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(tasting.id, 'canceled')}
                          disabled={actionLoadingId === tasting.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#cf222e] hover:bg-[#feeceb] transition-all cursor-pointer"
                          title="Cancelar degustação"
                        >
                          <Ban size={12} />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setErrorMessage(null)
                          setEditingTasting(tasting)
                          setIsModalOpen(true)
                        }}
                        className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                        title="Editar degustação"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(tasting.id, tasting.title)}
                        disabled={actionLoadingId === tasting.id}
                        className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                        title="Excluir degustação"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="col-span-full py-12 text-center border border-dashed border-[#e5e5ea] rounded-2xl bg-[#fafafa]">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-[#86868b] mb-2 stroke-[1.5]" />
              <p className="text-[#1d1d1f] font-medium text-sm">
                {selectedDateFilter
                  ? `Nenhuma degustação agendada para ${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('pt-BR')}`
                  : hasActiveDateFilter
                  ? `Nenhuma degustação encontrada para o período selecionado (${periodLabel})`
                  : 'Nenhuma degustação cadastrada'}
              </p>
              <p className="text-xs text-[#86868b] mt-0.5">
                {hasActiveDateFilter
                  ? 'Tente selecionar outro mês/ano ou limpar os filtros de data.'
                  : 'Agende degustações com clientes para planejar a agenda da cozinha.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-3">
                {hasActiveDateFilter && (
                  <button
                    onClick={handleClearDateFilters}
                    className="text-xs font-semibold text-[#0071e3] hover:underline cursor-pointer"
                  >
                    Ver todas as degustações
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingTasting(null)
                    setIsModalOpen(true)
                  }}
                  className="text-xs font-semibold text-[#1d1d1f] hover:underline cursor-pointer"
                >
                  + Agendar nova degustação
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Nova / Editar Degustação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#1d1d1f] flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-[#b8860b]" />
                <span>{editingTasting ? 'Editar Degustação' : 'Nova Degustação'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl bg-[#feeceb] p-3 text-xs text-[#cf222e] font-medium border border-[#fdd8d5]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {editingTasting && <input type="hidden" name="id" value={editingTasting.id} />}

              {/* Nome / Cliente */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Nome / Cliente *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Ex: Degustação Casamento Luana & Lucas"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none transition-all"
                />
              </div>

              {/* Data */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Data da Degustação *
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer"
                />
              </div>

              {/* Valor e Quantidade de Pessoas em Linha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="amount"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none transition-all"
                  />
                  <span className="text-[10px] text-[#86868b] mt-0.5 block">0 para cortesia</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                    Qtd. de Pessoas
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="people_count"
                    required
                    value={modalPeopleCount}
                    onChange={(e) => setModalPeopleCount(e.target.value)}
                    placeholder="2"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Status</label>
                <select
                  name="status"
                  value={modalStatus}
                  onChange={(e) =>
                    setModalStatus(e.target.value as 'scheduled' | 'completed' | 'canceled')
                  }
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="scheduled">Agendada</option>
                  <option value="completed">Realizada</option>
                  <option value="canceled">Cancelada</option>
                </select>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : editingTasting ? 'Atualizar' : 'Salvar Degustação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
