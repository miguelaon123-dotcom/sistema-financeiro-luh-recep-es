'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Wallet,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Percent,
} from 'lucide-react'
import { Caixinha } from '@/app/(dashboard)/caixinhas/actions'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  status: 'pending' | 'paid' | 'late' | 'canceled'
  description?: string
  due_date: string
  paid_date?: string | null
  events?: { id: string; title: string; event_date?: string } | null
}

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

export function DashboardKpis({
  transactions,
  caixinhas,
}: {
  transactions: Transaction[]
  caixinhas: Caixinha[]
}) {
  const now = new Date()
  const currentYearStr = String(now.getFullYear())
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0')

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr)
  const [dateFilterMode, setDateFilterMode] = useState<'due' | 'event'>('event')

  const isPeriodFiltered = selectedMonth !== 'all' || selectedYear !== 'all'

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

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>()
    const currentY = now.getFullYear()
    yearsSet.add(String(currentY))
    yearsSet.add(String(currentY - 1))
    yearsSet.add(String(currentY + 1))
    transactions.forEach((tx) => {
      const d = getTransactionDate(tx)
      if (d) {
        const y = d.split('-')[0]
        if (y && !isNaN(Number(y)) && y.length === 4) yearsSet.add(y)
      }
    })
    return Array.from(yearsSet).sort()
  }, [transactions, now, dateFilterMode])

  const selectedMonthObj = MONTH_NAMES.find((m) => m.value === selectedMonth)
  const periodLabel =
    selectedMonth !== 'all'
      ? `${selectedMonthObj?.label || selectedMonth} de ${selectedYear !== 'all' ? selectedYear : currentYearStr}`
      : selectedYear !== 'all'
      ? `Ano de ${selectedYear}`
      : 'Todos os Meses'

  // Filtragem de transações pelo período
  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const effectiveDate = getTransactionDate(tx)
      const parts = effectiveDate.split('-')
      const txYear = parts[0]
      const txMonth = parts[1]

      if (selectedMonth !== 'all' && txMonth !== selectedMonth) return false
      if (selectedYear !== 'all' && txYear !== selectedYear) return false
      return true
    })
  }, [transactions, selectedMonth, selectedYear, dateFilterMode])

  // Métricas do Período
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

  // Lucro Realizado (Contas já pagas)
  const periodProfit = periodReceived - periodPaid
  const periodProfitMargin = periodReceived > 0 ? (periodProfit / periodReceived) * 100 : 0

  // Fechamento Total Projetado
  const periodProjectedIncome = periodReceived + periodPendingIncome
  const periodProjectedExpense = periodPaid + periodPendingExpense
  const periodProjectedProfit = periodProjectedIncome - periodProjectedExpense
  const periodProjectedProfitMargin =
    periodProjectedIncome > 0 ? (periodProjectedProfit / periodProjectedIncome) * 100 : 0

  const periodPaidCount = periodTransactions.filter((t) => t.status === 'paid').length
  const periodTotalCount = periodTransactions.length
  const periodCompletionRate =
    periodTotalCount > 0 ? Math.round((periodPaidCount / periodTotalCount) * 100) : 100

  // Métricas Globais (Saldo em Caixa Real)
  const totalReceived = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const totalPaid = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const cashBalance = totalReceived - totalPaid
  const totalInCaixinhas = (caixinhas || []).reduce(
    (acc, c) => acc + Number(c.current_balance || 0),
    0
  )
  const freeCashBalance = cashBalance

  const pendingIncomeAll = transactions
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const pendingExpenseAll = transactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* BARRA DE FILTRO POR MÊS */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1d1d1f]">
              <Calendar className="h-4 w-4 text-[#b8860b]" />
              <span>Filtrar Mês do Fechamento:</span>
            </div>

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
                title="Agrupa pelo mês da festa/evento contratado"
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
              <span>{isPeriodFiltered ? `Filtrando: ${periodLabel}` : 'Visão Geral Consolidada'}</span>
            </span>
          </div>
        </div>

        {dateFilterMode === 'event' && isPeriodFiltered && periodTransactions.length === 0 && (
          <div className="mt-2 rounded-xl border border-[#ffe0b2] bg-[#fff8e1] p-3 text-xs text-[#b8860b] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              Nenhum evento agendado para <strong>{periodLabel}</strong> no modo de Festas.
            </span>
            <button
              type="button"
              onClick={() => setDateFilterMode('due')}
              className="text-xs font-bold text-[#0071e3] underline hover:text-[#005bb5] cursor-pointer"
            >
              Alternar para Vencimento / Quitação (Caixa) →
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Dinâmicos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Saldo em Caixa (Livre) */}
        <Link
          href="/financeiro"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#0071e3]/40 hover:shadow-sm"
          title="Ver movimentações no Financeiro"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
              Saldo em Caixa (Livre)
            </span>
            <div className="rounded-xl bg-[#e8f8ee] p-2 text-[#1a7f37]">
              <Wallet className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R${' '}
            {cashBalance.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered
                ? `Entradas no mês: R$ ${periodReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'Disponível na conta para uso imediato'}
            </span>
            <span className="text-[#0071e3] font-medium group-hover:underline flex items-center gap-0.5">
              Extrato <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 2. Em Caixinhas / Rendimento do Mês */}
        <Link
          href={isPeriodFiltered ? "/financeiro" : "#caixinhas"}
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#1a7f37]/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
              {isPeriodFiltered ? 'Rendimento Mês' : 'Em Caixinhas'}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isPeriodFiltered
                  ? periodReceived > 0
                    ? periodProfit >= 0
                      ? 'bg-[#e8f8ee] text-[#1a7f37]'
                      : 'bg-[#feeceb] text-[#cf222e]'
                    : periodPaid > 0
                    ? 'bg-[#feeceb] text-[#cf222e]'
                    : 'bg-[#f5f5f7] text-[#6e6e73]'
                  : 'bg-[#f5f5f7] text-[#1d1d1f]'
              }`}
            >
              {isPeriodFiltered
                ? periodReceived > 0
                  ? `${periodProfit >= 0 ? '+' : ''}${periodProfitMargin.toFixed(1)}% margem`
                  : periodPaid > 0
                  ? 'Despesas do mês'
                  : 'Sem movimentação'
                : `${caixinhas.length} ativas`}
            </span>
          </div>
          <p
            className={`mt-3 text-2xl font-bold tracking-tight ${
              (isPeriodFiltered ? periodProfit : totalInCaixinhas) >= 0
                ? isPeriodFiltered ? 'text-[#1a7f37]' : 'text-[#1d1d1f]'
                : 'text-[#cf222e]'
            }`}
          >
            R${' '}
            {(isPeriodFiltered ? periodProfit : totalInCaixinhas).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered ? 'Resultado líquido do mês' : 'Reservas e metas separadas'}
            </span>
            <span className="text-[#1a7f37] font-medium group-hover:underline flex items-center gap-0.5">
              Ver mais <ArrowRight size={11} />
            </span>
          </div>

          {isPeriodFiltered && (
            <div className="mt-3 pt-2.5 border-t border-[#f2f2f7] flex flex-col gap-1 text-[11px] text-[#6e6e73]">
              <div className="flex items-center justify-between">
                <span>Margem Realizada:</span>
                <strong className={periodProfit >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'}>
                  {periodReceived > 0
                    ? `${periodProfitMargin.toFixed(1)}%`
                    : periodPaid > 0
                    ? '—'
                    : '0.0%'}
                </strong>
              </div>
              <div className="flex items-center justify-between text-[#b8860b]">
                <span>Ao fechar contas:</span>
                <strong>
                  {periodProjectedIncome > 0
                    ? `${periodProjectedProfitMargin.toFixed(1)}%`
                    : '—'}
                </strong>
              </div>
            </div>
          )}
        </Link>

        {/* 3. Patrimônio Total da Empresa / Guardado em Caixinhas no Mês */}
        <Link
          href="/financeiro?tab=caixinhas"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#1d1d1f]/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
              {isPeriodFiltered ? 'Guardado em Caixinhas' : 'Patrimônio Total'}
            </span>
            <span className="rounded-md bg-[#e8f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#1a7f37]">
              {isPeriodFiltered ? `${caixinhas.length} ativas` : 'Conta + Caixas'}
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R${' '}
            {(isPeriodFiltered ? totalInCaixinhas : cashBalance + totalInCaixinhas).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered
                ? 'Reservas e metas ativas'
                : `Conta (R$ ${cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}) + Caixinhas (R$ ${totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})`}
            </span>
            <span className="text-[#1d1d1f] font-semibold group-hover:underline flex items-center gap-0.5">
              Detalhes <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 4. A Receber */}
        <Link
          href="/financeiro"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#b8860b]/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#b8860b]">
              {isPeriodFiltered ? 'A Receber no Mês' : 'A Receber (Futuro)'}
            </span>
            <div className="rounded-xl bg-[#fff8e6] p-2 text-[#b8860b]">
              <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#b8860b]">
            R${' '}
            {(isPeriodFiltered ? periodPendingIncome : pendingIncomeAll).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered ? `Previsto: R$ ${periodProjectedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : 'Contratos pendentes'}
            </span>
            <span className="text-[#b8860b] font-medium group-hover:underline flex items-center gap-0.5">
              Extrato <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 5. A Pagar */}
        <Link
          href="/financeiro"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#cf222e]/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#cf222e]">
              {isPeriodFiltered ? 'A Pagar no Mês' : 'A Pagar (Futuro)'}
            </span>
            <div className="rounded-xl bg-[#feeceb] p-2 text-[#cf222e]">
              <TrendingDown className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#cf222e]">
            R${' '}
            {(isPeriodFiltered ? periodPendingExpense : pendingExpenseAll).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered ? `Custo: R$ ${periodProjectedExpense.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : 'Custos fixos'}
            </span>
            <span className="text-[#cf222e] font-medium group-hover:underline flex items-center gap-0.5">
              Extrato <ArrowRight size={11} />
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
