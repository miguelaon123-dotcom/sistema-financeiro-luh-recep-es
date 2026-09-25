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
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthYearStr = String(nextMonthDate.getFullYear())
  const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, '0')

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr)
  const [dateFilterMode, setDateFilterMode] = useState<'event' | 'due'>('event')

  const isCurrentMonthSelected =
    selectedMonth === currentMonthStr && selectedYear === currentYearStr
  const isNextMonthSelected =
    selectedMonth === nextMonthStr && selectedYear === nextMonthYearStr
  const isPeriodFiltered = selectedMonth !== 'all' || selectedYear !== 'all'

  // Resolução inteligente da data de competência da transação
  const getTransactionDate = (tx: Transaction) => {
    // Modo Evento (Competência da Festa): se a transação estiver ligada a um evento, usa a data da festa
    if (dateFilterMode === 'event' && tx.events?.event_date) {
      return tx.events.event_date
    }
    // Modo Vencimento/Caixa: se pago usa paid_date, se pendente usa due_date
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
  const freeCashBalance = Math.max(0, cashBalance - totalInCaixinhas)

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

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonthStr)
                setSelectedYear(currentYearStr)
              }}
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
              onClick={() => {
                setSelectedMonth(nextMonthStr)
                setSelectedYear(nextMonthYearStr)
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                isNextMonthSelected
                  ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                  : 'bg-white text-[#6e6e73] border-[#d1d1d6] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              Próximo Mês
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth('11')
                setSelectedYear('2026')
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                selectedMonth === '11' && selectedYear === '2026'
                  ? 'bg-[#b8860b] text-white border-[#b8860b] shadow-xs'
                  : 'bg-[#fffdf5] text-[#b8860b] border-[#f0e6cc] hover:bg-[#fff9e6]'
              }`}
            >
              Novembro/26
            </button>

            {isPeriodFiltered && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('all')
                  setSelectedYear('all')
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#cf222e] hover:bg-[#feeceb] rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#fcd7d5]"
              >
                Ver Geral
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo: Por Mês da Festa (Evento) vs Data de Vencimento */}
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
                📅 Vencimento / Quitação
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
      </div>

      {/* KPI Cards Dinâmicos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Saldo em Caixa / Entradas Pagas no Mês */}
        <Link
          href="/financeiro?action=ajustar-saldo"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#0071e3]/40 hover:shadow-sm"
          title="Clique para ajustar o saldo real da conta bancária"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
              {isPeriodFiltered ? 'Entradas no Mês' : 'Saldo em Caixa'}
            </span>
            <div className="rounded-xl bg-[#e8f8ee] p-2 text-[#1a7f37]">
              <Wallet className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R${' '}
            {(isPeriodFiltered ? periodReceived : cashBalance).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered
                ? `Saídas pagas: R$ ${periodPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'Recebido − Pago (Real)'}
            </span>
            <span className="text-[#0071e3] font-medium group-hover:underline flex items-center gap-0.5">
              Extrato <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 2. Saldo Livre / Rendimento do Mês */}
        <Link
          href="/financeiro?tab=caixinhas"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#1a7f37]/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1a7f37]">
              {isPeriodFiltered ? 'Rendimento Mês' : 'Saldo Livre'}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isPeriodFiltered
                  ? periodProfit >= 0
                    ? 'bg-[#e8f8ee] text-[#1a7f37]'
                    : 'bg-[#feeceb] text-[#cf222e]'
                  : 'bg-[#e8f8ee] text-[#1a7f37]'
              }`}
            >
              {isPeriodFiltered
                ? `${periodProfit >= 0 ? '+' : ''}${periodProfitMargin.toFixed(1)}% lucro`
                : 'Disponível'}
            </span>
          </div>
          <p
            className={`mt-3 text-2xl font-bold tracking-tight ${
              (isPeriodFiltered ? periodProfit : freeCashBalance) >= 0
                ? 'text-[#1a7f37]'
                : 'text-[#cf222e]'
            }`}
          >
            R${' '}
            {(isPeriodFiltered ? periodProfit : freeCashBalance).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>
              {isPeriodFiltered ? 'Lucro líquido do período' : 'Livre de caixinhas'}
            </span>
            <span className="text-[#1a7f37] font-medium group-hover:underline flex items-center gap-0.5">
              Ver mais <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 3. Guardado em Caixinhas */}
        <a
          href="#caixinhas"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#1d1d1f]/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f]">
              Em Caixinhas
            </span>
            <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-bold text-[#1d1d1f]">
              {caixinhas.length} ativas
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R$ {totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>Metas e reservas</span>
            <span className="text-[#1d1d1f] font-semibold group-hover:underline flex items-center gap-0.5">
              Ver <ArrowRight size={11} />
            </span>
          </div>
        </a>

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

      {/* PAINEL DE FECHAMENTO DO MÊS & % DE LUCRO */}
      <div className="rounded-3xl border border-[#e5e5ea] bg-linear-to-b from-[#fbfbfd] to-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#f2f2f7]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#1d1d1f] p-2.5 text-white shadow-2xs">
              <Percent size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f] flex items-center gap-2">
                <span>Fechamento & Margem de Lucro: {periodLabel}</span>
                {isPeriodFiltered && (
                  <span className="rounded-md bg-[#e8f8ee] px-2 py-0.5 text-[11px] font-bold text-[#1a7f37]">
                    Período Ativo
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#6e6e73]">
                Resultado líquido apurado e projeção percentual de lucro ao fechar todas as contas.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-[#86868b] block">Contas Liquidadas</span>
            <span className="text-xs font-bold text-[#1d1d1f]">
              {periodPaidCount} de {periodTotalCount} ({periodCompletionRate}%)
            </span>
          </div>
        </div>

        {/* Grid de Comparativo: Realizado x Ao Fechar as Contas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Contas Já Fechadas */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#1a7f37]"></span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">
                  Resultado Realizado (Contas Pagas)
                </h4>
              </div>
              <span className="rounded-md bg-[#e8f8ee] px-2 py-0.5 text-xs font-bold text-[#1a7f37]">
                Efetivado
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 border-y border-[#f2f2f7]">
              <div>
                <span className="text-xs text-[#86868b] block">Receitas Recebidas</span>
                <span className="text-sm font-bold text-[#1a7f37]">
                  R$ {periodReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#86868b] block">Despesas Pagas</span>
                <span className="text-sm font-bold text-[#cf222e]">
                  R$ {periodPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between pt-1">
              <div>
                <span className="text-xs text-[#86868b] block">Quanto Rendeu (Lucro Líquido Atual)</span>
                <span
                  className={`text-2xl font-black tracking-tight ${
                    periodProfit >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                  }`}
                >
                  R$ {periodProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#86868b] block">Margem de Lucro Atual</span>
                <span
                  className={`text-2xl font-black ${
                    periodProfit >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                  }`}
                >
                  {periodProfitMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#86868b] leading-relaxed">
              * Valor líquido real que sobrou no caixa de tudo que já entrou e saiu neste período.
            </p>
          </div>

          {/* Card B: Projeção Final (Quando fechar todas as contas) */}
          <div className="rounded-2xl border border-[#b8860b]/30 bg-[#fffdfa] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#b8860b]"></span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#b8860b]">
                  Ao Fechar as Contas (Com Pendências)
                </h4>
              </div>
              <span className="rounded-md bg-[#fff8e6] px-2 py-0.5 text-xs font-bold text-[#b8860b]">
                Projeção Final
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 border-y border-[#f7ecd0]">
              <div>
                <span className="text-xs text-[#86868b] block">Faturamento Previsto Total</span>
                <span className="text-sm font-bold text-[#1d1d1f]">
                  R$ {periodProjectedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-[#86868b] block">
                  (R$ {periodPendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a receber)
                </span>
              </div>
              <div>
                <span className="text-xs text-[#86868b] block">Despesas Totais Previstas</span>
                <span className="text-sm font-bold text-[#1d1d1f]">
                  R$ {periodProjectedExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-[#86868b] block">
                  (R$ {periodPendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a pagar)
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between pt-1">
              <div>
                <span className="text-xs text-[#86868b] block">Lucro Previsto ao Fechar as Contas</span>
                <span
                  className={`text-2xl font-black tracking-tight ${
                    periodProjectedProfit >= 0 ? 'text-[#1d1d1f]' : 'text-[#cf222e]'
                  }`}
                >
                  R$ {periodProjectedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#86868b] block">% de Lucro ao Fechar o Mês</span>
                <span
                  className={`text-2xl font-black ${
                    periodProjectedProfit >= 0 ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                  }`}
                >
                  {periodProjectedProfitMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#86868b] leading-relaxed">
              * Quando todos os contratos e custos deste mês forem liquidados, esta será a margem de lucro final do mês.
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-[#6e6e73] mb-1.5">
            <span>Progresso de Liquidação do Período ({periodLabel})</span>
            <span>
              <strong>{periodPaidCount}</strong> de <strong>{periodTotalCount}</strong> contas liquidadas ({periodCompletionRate}%)
            </span>
          </div>
          <div className="h-2 w-full bg-[#f2f2f7] rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-[#1a7f37] to-[#2da44e] transition-all duration-300 rounded-full"
              style={{ width: `${periodCompletionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
