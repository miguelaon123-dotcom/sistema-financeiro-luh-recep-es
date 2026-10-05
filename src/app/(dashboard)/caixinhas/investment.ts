/**
 * Módulo de Rendimento Automático Diário de Investimentos (100% CDI - Sicredi)
 * Luh Recepções - Sistema Financeiro
 */

// Feriados Nacionais Bancários no Brasil (2026-2027)
const BRAZILIAN_BANK_HOLIDAYS = new Set([
  '2026-01-01', // Confraternização Universal
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-04-03', // Paixão de Cristo / Sexta-Feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência do Brasil
  '2026-10-12', // N. Sra Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
  '2027-01-01',
])

export interface InvestmentYieldInfo {
  isInvestment: boolean
  bankName: string
  benchmark: string
  appliedAmount: number
  startDate: string
  businessDays: number
  totalDays: number
  accumulatedYield: number
  dailyYieldEstimate: number
  percentageYield: number
  monthlyRate: number
  currentBalance: number
  taxes: number
  lastUpdateDate: string
}

/**
 * Retorna a data de hoje no fuso horário de Brasília (YYYY-MM-DD)
 */
export function getBrasiliaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Calcula a quantidade de dias úteis entre duas datas no formato YYYY-MM-DD.
 * Começa a render no dia útil seguinte à aplicação (D+1).
 */
export function countBusinessDays(startDateStr: string, endDateStr: string): number {
  if (startDateStr >= endDateStr) return 0

  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number)
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number)

  const current = new Date(Date.UTC(sYear, sMonth - 1, sDay))
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay))

  let businessDays = 0

  // Começa no dia seguinte (D+1 da aplicação)
  current.setUTCDate(current.getUTCDate() + 1)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay() // 0 = Domingo, 6 = Sábado
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const yyyy = current.getUTCFullYear()
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(current.getUTCDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`

    if (!isWeekend && !BRAZILIAN_BANK_HOLIDAYS.has(dateStr)) {
      businessDays++
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return businessDays
}

/**
 * Calcula o rendimento de um investimento 100% CDI
 *
 * Taxa diária calibrada exatamente com os dados reais do Sicredi informados pelo usuário:
 * - Aplicação: 28/09/2026
 * - Em 3 dias úteis (até 01/10/2026): R$ 3,04 de rendimento sobre R$ 2.000,00 aplicado
 * - Taxa diária efetiva = (1 + 3.04 / 2000)^(1/3) - 1 ≈ 0.050634% ao dia útil (~1.08% ao mês)
 */
export function calculateInvestmentYield(params: {
  appliedAmount: number
  startDate: string
  monthlyRate?: number
  bankName?: string
  benchmark?: string
  currentDateStr?: string
}): InvestmentYieldInfo {
  const appliedAmount = Math.max(0, params.appliedAmount)
  const startDate = params.startDate || '2026-09-28'
  const monthlyRate = params.monthlyRate || 1.08
  const bankName = params.bankName || 'Sicredi'
  const benchmark = params.benchmark || '100% CDI'
  const todayStr = params.currentDateStr || getBrasiliaDateString()

  // Taxa diária dos dias úteis calibrada com 100% CDI Sicredi (R$ 3,04 em 3 dias sobre R$ 2.000)
  const dailyRate = Math.pow(1 + 3.04 / 2000, 1 / 3) - 1

  const businessDays = countBusinessDays(startDate, todayStr)

  // Diferença total em dias corridos
  const [sY, sM, sD] = startDate.split('-').map(Number)
  const [eY, eM, eD] = todayStr.split('-').map(Number)
  const startMs = Date.UTC(sY, sM - 1, sD)
  const endMs = Date.UTC(eY, eM - 1, eD)
  const totalDays = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)))

  // Cálculo dos juros compostos diários em dias úteis
  let accumulatedYield = 0
  if (appliedAmount > 0 && businessDays > 0) {
    accumulatedYield = appliedAmount * (Math.pow(1 + dailyRate, businessDays) - 1)
  }

  // Arredondamento bancário a 2 casas decimais
  accumulatedYield = Math.round(accumulatedYield * 100) / 100

  // Estimativa de rendimento diário médio
  const dailyYieldEstimate = Math.round(appliedAmount * dailyRate * 100) / 100

  const currentBalance = Math.round((appliedAmount + accumulatedYield) * 100) / 100
  const percentageYield = appliedAmount > 0 ? (accumulatedYield / appliedAmount) * 100 : 0

  return {
    isInvestment: true,
    bankName,
    benchmark,
    appliedAmount,
    startDate,
    businessDays,
    totalDays,
    accumulatedYield,
    dailyYieldEstimate,
    percentageYield: Math.round(percentageYield * 1000) / 1000,
    monthlyRate,
    currentBalance,
    taxes: 0,
    lastUpdateDate: todayStr,
  }
}
