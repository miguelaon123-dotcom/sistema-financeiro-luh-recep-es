// Funções utilitárias síncronas para Funcionários e Pró-Labore

export function parseEmployeeNotes(rawNotes?: string | null) {
  if (!rawNotes) return { notes: '', payment_day: null }
  const match = rawNotes.match(/\[DIA_PGTO:(\d+)\]/)
  const payment_day = match ? parseInt(match[1], 10) : null
  const notes = rawNotes.replace(/\[DIA_PGTO:\d+\]\s*/g, '').trim()
  return { notes, payment_day }
}

export function formatEmployeeNotes(cleanNotes?: string | null, payment_day?: number | null) {
  const prefix = payment_day && payment_day >= 1 && payment_day <= 31 ? `[DIA_PGTO:${payment_day}] ` : ''
  return `${prefix}${cleanNotes || ''}`.trim() || null
}

export function isFounderRole(role?: string | null) {
  if (!role) return false
  const r = role.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return r.includes('fundador') || r.includes('socio')
}
