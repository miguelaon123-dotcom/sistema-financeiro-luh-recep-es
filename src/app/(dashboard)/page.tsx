import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarCheck,
  AlertCircle,
  PackageX,
  Wallet,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { getCaixinhas } from './caixinhas/actions'
import { CaixinhasFinanceiras } from '@/components/CaixinhasFinanceiras'

import { getCachedData } from '@/lib/data-cache'

export default async function DashboardPage() {
  const supabase = createAdminClient()

  // 1. Buscar transações, eventos, produtos e caixinhas com cache ultra-rápido em memória
  const { txsData, allEvents, allProducts, caixinhas } = await getCachedData(
    'dashboard_data',
    async () => {
      const [txsRes, eventsRes, prodsRes, cx] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select(`
            id, amount, type, status, description, due_date, paid_date,
            events(id, title), contacts(id, name)
          `)
          .order('due_date', { ascending: false }),
        supabase
          .from('events')
          .select('id, title, event_date, status, budget, contacts(name), financial_transactions(amount, status, description)')
          .order('event_date', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, current_stock, min_stock'),
        getCaixinhas(),
      ])

      const rawEvents = (eventsRes.data as any[]) || []
      const allEvents = rawEvents.map((ev: any) => {
        const sinalTx = ev.financial_transactions?.find((t: any) =>
          t.description?.toLowerCase().includes('sinal')
        )
        return {
          ...ev,
          deposit_amount: sinalTx ? Number(sinalTx.amount) : 0,
          deposit_status: sinalTx ? (sinalTx.status === 'paid' ? 'paid' : 'pending') : 'pending',
        }
      })

      return {
        txsData: txsRes.data,
        allEvents,
        allProducts: prodsRes.data,
        caixinhas: cx,
      }
    }
  )

  const transactions = (txsData as any[]) || []

  // Cálculos consolidados gerais
  const totalReceived = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const pendingIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const totalIncome = totalReceived + pendingIncome

  const totalPaid = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const pendingExpense = transactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)

  const totalExpense = totalPaid + pendingExpense

  const cashBalance = totalReceived - totalPaid
  const projectedBalance = totalIncome - totalExpense

  // Cálculos específicos do mês atual
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const isCurrentMonth = (dateStr: string) => {
    if (!dateStr) return false
    const parts = dateStr.split('-')
    if (parts.length < 2) return false
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    return y === currentYear && m === currentMonth
  }

  const monthTxs = transactions.filter((t) => isCurrentMonth(t.due_date))
  const monthReceived = monthTxs
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const monthPendingIncome = monthTxs
    .filter((t) => t.type === 'income' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const monthTotalIncome = monthReceived + monthPendingIncome

  const monthPaid = monthTxs
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const monthPendingExpense = monthTxs
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const monthTotalExpense = monthPaid + monthPendingExpense

  // Contas pendentes mais urgentes (próximos vencimentos)
  const pendingTxs = transactions
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
    .slice(0, 5)

  // 2. Processar eventos
  const events = (allEvents as any[]) || []
  const todayStr = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter((e) => e.event_date >= todayStr)

  // 3. Monitorar estoque baixo
  const lowStock = ((allProducts as any[]) || []).filter(
    (p: any) => Number(p.current_stock) <= Number(p.min_stock)
  )

  // 4. Caixinhas Financeiras
  const totalInCaixinhas = (caixinhas || []).reduce(
    (acc, c) => acc + Number(c.current_balance || 0),
    0
  )
  const freeCashBalance = Math.max(0, cashBalance - totalInCaixinhas)

  const monthName = now.toLocaleString('pt-BR', { month: 'long' })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Visão Geral</h1>
          <p className="text-sm text-[#6e6e73]">
            Acompanhamento financeiro em tempo real, eventos e acervo da Luh Recepções.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1d1d1f] border border-[#e5e5ea] shadow-2xs capitalize">
            Referência: {monthName} de {currentYear}
          </span>
        </div>
      </div>

      {/* KPI Cards Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Saldo em Caixa Real */}
        <Link
          href="/financeiro?action=ajustar-saldo"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#0071e3]/40 hover:shadow-sm"
          title="Clique para ajustar o saldo real da conta bancária"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
              Saldo em Caixa
            </span>
            <div className="rounded-xl bg-[#e8f8ee] p-2 text-[#1a7f37]">
              <Wallet className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
            R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>Recebido − Pago</span>
            <span className="text-[#0071e3] font-medium group-hover:underline flex items-center gap-0.5">
              Ajustar Saldo <ArrowRight size={11} />
            </span>
          </div>
        </Link>

        {/* 2. Saldo Livre */}
        <Link
          href="/financeiro?tab=caixinhas"
          className="group block rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#1a7f37]/50 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1a7f37]">
              Saldo Livre
            </span>
            <span className="rounded-md bg-[#e8f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#1a7f37]">
              Disponível
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1a7f37]">
            R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>Livre de caixinhas</span>
            <span className="text-[#1a7f37] font-medium group-hover:underline flex items-center gap-0.5">
              Usar <ArrowRight size={11} />
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
              A Receber (Futuro)
            </span>
            <div className="rounded-xl bg-[#fff8e6] p-2 text-[#b8860b]">
              <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#b8860b]">
            R$ {pendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>{totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} recebidos</span>
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
              A Pagar (Futuro)
            </span>
            <div className="rounded-xl bg-[#feeceb] p-2 text-[#cf222e]">
              <TrendingDown className="h-4 w-4" strokeWidth={2.2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#cf222e]">
            R$ {pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#86868b]">
            <span>{totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} pagos</span>
            <span className="text-[#cf222e] font-medium group-hover:underline flex items-center gap-0.5">
              Extrato <ArrowRight size={11} />
            </span>
          </div>
        </Link>
      </div>

      {/* Caixinhas de Organização Financeira */}
      <div id="caixinhas" className="scroll-mt-8">
        <CaixinhasFinanceiras
          initialCaixinhas={caixinhas}
          totalCashBalance={cashBalance}
        />
      </div>

      {/* Monitoramento Operacional & Contas a Vencer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contas a Vencer / Fluxo Próximo */}
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[#f5f5f7] p-1.5 text-[#1d1d1f]">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">Contas Pendentes de Baixa</h3>
              </div>
              <Link
                href="/financeiro"
                className="text-xs font-semibold text-[#1d1d1f] hover:underline"
              >
                Ver todas →
              </Link>
            </div>

            <div className="space-y-2.5">
              {pendingTxs.length > 0 ? (
                pendingTxs.map((tx) => (
                  <Link
                    key={tx.id}
                    href="/financeiro"
                    className="flex items-center justify-between rounded-xl border border-[#f2f2f7] bg-[#fbfbfd] p-3 hover:bg-[#f5f5f7] transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-sm font-semibold text-[#1d1d1f] truncate">
                        {tx.description || (tx.type === 'income' ? 'Receita sem título' : 'Despesa sem título')}
                      </span>
                      <span className="text-xs text-[#86868b] truncate">
                        {tx.contacts?.name || tx.events?.title || 'Lançamento avulso'} • Venc:{' '}
                        {new Date(tx.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold block ${
                          tx.type === 'income' ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'} R${' '}
                        {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-[#fff8e6] px-1.5 py-0.5 text-[10px] font-semibold text-[#b8860b]">
                        Pendente
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[#f2f2f7] bg-[#f9f9fb] p-4 text-center">
                  <div className="flex items-center gap-2 text-xs text-[#6e6e73]">
                    <CheckCircle2 size={16} className="text-[#1a7f37]" />
                    <span>Todas as contas estão em dia. Nenhuma pendência imediata.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f2f2f7] flex items-center justify-between text-xs text-[#6e6e73]">
            <span>Receitas do mês: R$ {monthTotalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>Despesas do mês: R$ {monthTotalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Alertas de Estoque e Próximos Eventos */}
        <div className="space-y-6">
          {/* Card Eventos */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[#ebf4fe] p-1.5 text-[#0071e3]">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">Próximos Eventos</h3>
              </div>
              <Link href="/eventos" className="text-xs font-semibold text-[#0071e3] hover:underline">
                Agenda ({events.length}) →
              </Link>
            </div>

            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map((ev) => (
                  <Link
                    key={ev.id}
                    href="/eventos"
                    className="flex items-center justify-between rounded-xl border border-[#f2f2f7] bg-[#fbfbfd] p-3 hover:bg-[#f5f5f7] transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-sm font-semibold text-[#1d1d1f] truncate">
                        {ev.title}
                      </span>
                      <span className="text-xs text-[#86868b] truncate">
                        {ev.contacts?.name ? `Cliente: ${ev.contacts.name} • ` : ''}
                        Data: {new Date(ev.event_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center rounded-lg bg-[#ebf4fe] px-2 py-0.5 text-xs font-medium text-[#0071e3] capitalize">
                        {ev.status || 'Agendado'}
                      </span>
                      {Number(ev.deposit_amount || 0) > 0 && (
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            ev.deposit_status === 'paid'
                              ? 'bg-[#e8f8ee] text-[#1a7f37]'
                              : 'bg-[#fff8e6] text-[#b8860b]'
                          }`}
                        >
                          Sinal: {ev.deposit_status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6e6e73] p-3 rounded-xl bg-[#f9f9fb] border border-[#f2f2f7]">
                Nenhum evento futuro agendado para os próximos dias.
              </p>
            )}
          </div>

          {/* Card Alerta de Estoque */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[#feeceb] p-1.5 text-[#cf222e]">
                  <PackageX className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">
                  Reposição de Estoque ({lowStock.length})
                </h3>
              </div>
              <Link href="/estoque" className="text-xs font-semibold text-[#1d1d1f] hover:underline">
                Ir ao acervo →
              </Link>
            </div>

            <div className="space-y-2">
              {lowStock.length > 0 ? (
                lowStock.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href="/estoque"
                    className="flex items-center justify-between rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 hover:bg-[#ffebeb] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#1d1d1f]">{item.name}</span>
                      <span className="text-xs text-[#cf222e]">
                        Apenas {item.current_stock} unidades (mínimo: {item.min_stock})
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#feeceb] px-2.5 py-0.5 text-xs font-semibold text-[#cf222e]">
                      Repor
                    </span>
                  </Link>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#1a7f37] p-3 rounded-xl bg-[#e8f8ee] border border-[#d2f0dd]">
                  <CheckCircle2 size={15} />
                  <span>Todos os itens do acervo estão com estoque regular.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Movimentações Financeiras Recentes */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#f2f2f7]">
          <div>
            <h3 className="text-base font-bold text-[#1d1d1f]">Últimas Movimentações Financeiras</h3>
            <p className="text-xs text-[#6e6e73]">
              Extrato consolidado das transações mais recentes registradas.
            </p>
          </div>
          <Link
            href="/financeiro"
            className="flex items-center gap-1 text-xs font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] px-3 py-1.5 rounded-xl transition-colors"
          >
            <span>Acessar Módulo Financeiro</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1d1d1f]">
            <thead className="bg-[#f9f9fb] text-xs font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Data Venc.</th>
                <th className="px-5 py-3.5 font-medium">Descrição</th>
                <th className="px-5 py-3.5 font-medium">Contato / Evento</th>
                <th className="px-5 py-3.5 font-medium text-center">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f7]">
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#fbfbfd] transition-colors">
                    <td className="px-5 py-3 text-xs text-[#6e6e73]">
                      {tx.due_date
                        ? new Date(tx.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-[#1d1d1f]">
                      {tx.description || (tx.type === 'income' ? 'Receita' : 'Despesa')}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#6e6e73]">
                      {tx.contacts?.name || tx.events?.title || 'Geral'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          tx.status === 'paid'
                            ? 'bg-[#e8f8ee] text-[#1a7f37]'
                            : tx.status === 'pending'
                            ? 'bg-[#fff8e6] text-[#b8860b]'
                            : 'bg-[#feeceb] text-[#cf222e]'
                        }`}
                      >
                        {tx.status === 'paid'
                          ? tx.type === 'income'
                            ? 'Recebido'
                            : 'Pago'
                          : tx.status === 'pending'
                          ? 'Pendente'
                          : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-sm">
                      <span
                        className={
                          tx.type === 'income' ? 'text-[#1a7f37]' : 'text-[#cf222e]'
                        }
                      >
                        {tx.type === 'income' ? '+' : '-'} R${' '}
                        {Number(tx.amount).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-[#86868b]">
                    Nenhuma transação financeira cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
