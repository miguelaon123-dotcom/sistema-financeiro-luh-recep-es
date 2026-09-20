'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  DollarSign,
  Pencil,
  Trash2,
  X,
  Boxes,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  UsersRound,
  UserCheck,
  Copy,
  Ban,
  MessageSquare,
  CalendarPlus,
  User,
  Package,
  ShieldAlert,
  Check,
  Wallet,
  TrendingUp,
  Clock,
} from 'lucide-react'
import {
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  allocateStockToEvent,
  returnEventWithInspection,
  ReturnItemChecklist,
  assignStaffToEvent,
  removeStaffFromEvent,
  EventStaffInput,
  receiveEventContractPayment,
} from './actions'
import { useConfirm } from '@/components/ConfirmDialog'

interface EventTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  status: 'pending' | 'paid' | 'late' | 'canceled'
  due_date?: string
  paid_date?: string | null
  description?: string
}

interface EventItem {
  id: string
  title: string
  event_date: string
  location?: string | null
  budget?: number | null
  status: 'budget' | 'approved' | 'completed' | 'canceled'
  contacts?: { id: string; name: string } | null
  financial_transactions?: EventTransaction[]
}

interface ProductItem {
  id: string
  name: string
  sku: string
  category?: string | null
  current_stock: number
  rental_price?: number | null
  cost_price?: number | null
  image_url?: string | null
}

interface EventMovement {
  id: string
  product_id: string
  event_id: string
  quantity: number
  type: 'in' | 'out' | 'loss' | 'adjustment' | 'return'
  reason?: string | null
  created_at: string
  products?: { id: string; name: string; sku: string } | null
}

interface EmployeeItem {
  id: string
  name: string
  role: string
  phone?: string | null
  default_daily_rate: number
  active?: boolean
}

interface StaffAssignmentItem {
  id: string
  event_id: string
  employee_id: string
  role: string
  daily_rate: number
  status?: string
}

export function EventosClient({
  events,
  contacts,
  products = [],
  eventMovements = [],
  employees = [],
  staffAssignments = [],
  initialOpenModal = false,
}: {
  events: EventItem[]
  contacts: { id: string; name: string }[]
  products?: ProductItem[]
  eventMovements?: EventMovement[]
  employees?: EmployeeItem[]
  staffAssignments?: StaffAssignmentItem[]
  initialOpenModal?: boolean
}) {
  const router = useRouter()
  const [localEvents, setLocalEvents] = useState<EventItem[]>(events)

  useEffect(() => {
    setLocalEvents(events)
  }, [events])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Modais de Materiais, Devolução e Escala de Equipe
  const [allocatingEvent, setAllocatingEvent] = useState<EventItem | null>(null)
  const [inspectingEvent, setInspectingEvent] = useState<EventItem | null>(null)
  const [staffModalEvent, setStaffModalEvent] = useState<EventItem | null>(null)

  // Estado para Alocação de Materiais
  const [allocationItems, setAllocationItems] = useState<{ productId: string; quantity: number }[]>([])
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('')
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1)
  const [allocationError, setAllocationError] = useState<string | null>(null)

  // Estado para Conferência de Devolução (Checklist Quebrou/Faltou)
  const [checklistItems, setChecklistItems] = useState<ReturnItemChecklist[]>([])

  // Estado para Escala de Equipe (Funcionários)
  const [staffDraft, setStaffDraft] = useState<EventStaffInput[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [staffRole, setStaffRole] = useState<string>('')
  const [staffDailyRate, setStaffDailyRate] = useState<number>(150)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffNotice, setStaffNotice] = useState<string | null>(null)
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false)

  // Função para resumir os materiais alocados em um evento a partir das movimentações
  const getEventMaterials = (eventId: string) => {
    const evtMovs = eventMovements.filter((m) => m.event_id === eventId)
    const productMap = new Map<
      string,
      { product: ProductItem; out: number; returned: number; loss: number }
    >()

    for (const m of evtMovs) {
      if (!productMap.has(m.product_id)) {
        const prod =
          products.find((p) => p.id === m.product_id) ||
          ({
            id: m.product_id,
            name: m.products?.name || 'Produto',
            sku: m.products?.sku || 'SKU',
            current_stock: 0,
          } as ProductItem)
        productMap.set(m.product_id, { product: prod, out: 0, returned: 0, loss: 0 })
      }
      const entry = productMap.get(m.product_id)!
      const qty = Number(m.quantity || 0)
      if (m.type === 'out') entry.out += qty
      else if (m.type === 'return') entry.returned += qty
      else if (m.type === 'loss') entry.loss += qty
    }

    const items = Array.from(productMap.entries()).map(([productId, data]) => ({
      productId,
      product: data.product,
      out: data.out,
      returned: data.returned,
      loss: data.loss,
      active: Math.max(0, data.out - data.returned - data.loss),
    }))

    const totalActive = items.reduce((acc, i) => acc + i.active, 0)
    const totalOut = items.reduce((acc, i) => acc + i.out, 0)
    const totalReturned = items.reduce((acc, i) => acc + i.returned, 0)
    const totalLoss = items.reduce((acc, i) => acc + i.loss, 0)

    return { items, totalActive, totalOut, totalReturned, totalLoss }
  }

  // REGRA ANTI-CONFLITO: Verifica se um colaborador já está escalado em outra festa no mesmo dia
  const checkEmployeeConflict = (employeeId: string, currentEventId: string, eventDate: string) => {
    // Busca outros eventos que ocorrem na mesma data e não estão cancelados
    const otherEventsSameDay = localEvents.filter(
      (e) => e.event_date === eventDate && e.id !== currentEventId && e.status !== 'canceled'
    )
    const otherEventIds = otherEventsSameDay.map((e) => e.id)

    if (otherEventIds.length === 0) return null

    // Verifica se o colaborador está em staffAssignments em algum desses outros eventos
    const conflictAssignment = staffAssignments.find(
      (s) => s.employee_id === employeeId && otherEventIds.includes(s.event_id)
    )

    if (conflictAssignment) {
      const conflictEvent = otherEventsSameDay.find((e) => e.id === conflictAssignment.event_id)
      return conflictEvent?.title || 'Outra festa na mesma data'
    }

    return null
  }

  // Filtragem de Eventos
  const filteredEvents = localEvents.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (evt.contacts?.name && evt.contacts.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (evt.location && evt.location.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = filterStatus === 'all' || evt.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Submit Evento Novo / Editar
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingEvent ? await updateEvent(formData) : await createEvent(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsModalOpen(false)
        setEditingEvent(null)
        form.reset()
        router.refresh()
      }
    })
  }

  // Status Change Instantâneo
  const handleStatusChange = (
    id: string,
    newStatus: 'budget' | 'approved' | 'completed' | 'canceled'
  ) => {
    if (newStatus === 'completed') {
      const summary = getEventMaterials(id)
      const targetEvt = localEvents.find((e) => e.id === id)
      if (targetEvt && summary.totalActive > 0) {
        openInspectionModal(targetEvt)
        return
      }
    }

    setActionLoadingId(id)
    // Atualização otimista imediata na interface
    setLocalEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    )
    startTransition(async () => {
      const res = await updateEventStatus(id, newStatus)
      if (res?.error) alert(res.error)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Exclusão Instantânea
  const handleDelete = (id: string, title: string) => {
    confirm(`Deseja realmente excluir o evento "${title}"?`).then(ok => {
      if (!ok) return
      setActionLoadingId(id)
      setLocalEvents((prev) => prev.filter((e) => e.id !== id))
      startTransition(async () => {
        await deleteEvent(id)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  // Recebimento do Contrato do Evento no Financeiro
  const handleReceiveContract = (eventId: string) => {
    setActionLoadingId(eventId)
    // Atualização otimista imediata
    setLocalEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e
        const txs = (e.financial_transactions || []).map((t) =>
          t.type === 'income' ? { ...t, status: 'paid' as const } : t
        )
        return { ...e, financial_transactions: txs }
      })
    )

    startTransition(async () => {
      const res = await receiveEventContractPayment(eventId)
      if (res?.error) alert(res.error)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Modal Alocar Materiais
  const openAllocationModal = (evt: EventItem) => {
    setAllocatingEvent(evt)
    setAllocationItems([])
    setSelectedProductToAdd('')
    setQuantityToAdd(1)
    setAllocationError(null)
  }

  const handleAddProductToAllocation = () => {
    if (!selectedProductToAdd) return
    const prod = products.find((p) => p.id === selectedProductToAdd)
    if (!prod) return

    if (quantityToAdd <= 0) {
      setAllocationError('A quantidade deve ser maior que zero.')
      return
    }

    if (quantityToAdd > prod.current_stock) {
      setAllocationError(`Estoque insuficiente! Saldo atual de ${prod.name}: ${prod.current_stock} un.`)
      return
    }

    setAllocationError(null)
    setAllocationItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === selectedProductToAdd)
      if (existingIdx >= 0) {
        const copy = [...prev]
        copy[existingIdx].quantity += quantityToAdd
        return copy
      }
      return [...prev, { productId: selectedProductToAdd, quantity: quantityToAdd }]
    })

    setSelectedProductToAdd('')
    setQuantityToAdd(1)
  }

  const handleConfirmAllocation = () => {
    if (!allocatingEvent || allocationItems.length === 0) return

    startTransition(async () => {
      const res = await allocateStockToEvent(allocatingEvent.id, allocationItems)
      if (res?.error) {
        setAllocationError(res.error)
      } else {
        setAllocatingEvent(null)
        setAllocationItems([])
        router.refresh()
      }
    })
  }

  // Modal Devolução e Checklist de Avarias
  const openInspectionModal = (evt: EventItem) => {
    const summary = getEventMaterials(evt.id)
    const activeItems = summary.items.filter((i) => i.active > 0)

    const initialChecklist: ReturnItemChecklist[] = activeItems.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      totalAllocated: item.active,
      returnedQty: item.active,
      brokenQty: 0,
      lostQty: 0,
      penaltyFee: 0,
      notes: '',
    }))

    setChecklistItems(initialChecklist)
    setInspectingEvent(evt)
  }

  const handleChecklistChange = (
    idx: number,
    field: 'returnedQty' | 'brokenQty' | 'lostQty' | 'notes',
    value: any
  ) => {
    setChecklistItems((prev) => {
      const copy = [...prev]
      const item = { ...copy[idx] }

      if (field === 'returnedQty' || field === 'brokenQty' || field === 'lostQty') {
        item[field] = Math.max(0, Number(value) || 0)
        const prod = products.find((p) => p.id === item.productId)
        const unitCost = Number(prod?.cost_price || 0) || Number(prod?.rental_price || 0) * 2
        item.penaltyFee = (item.brokenQty + item.lostQty) * unitCost
      } else if (field === 'notes') {
        item.notes = value
      }

      copy[idx] = item
      return copy
    })
  }

  const handleConfirmInspection = () => {
    if (!inspectingEvent) return

    for (const item of checklistItems) {
      const sum = Number(item.returnedQty) + Number(item.brokenQty) + Number(item.lostQty)
      if (sum !== item.totalAllocated) {
        alert(
          `Item "${item.productName}": A soma de devolvidos (${item.returnedQty}) + quebrados (${item.brokenQty}) + faltantes (${item.lostQty}) deve ser exatamente igual a ${item.totalAllocated} un.`
        )
        return
      }
    }

    startTransition(async () => {
      const res = await returnEventWithInspection(inspectingEvent.id, checklistItems)
      if (res?.error) {
        alert(res.error)
      } else {
        setInspectingEvent(null)
        router.refresh()
      }
    })
  }

  // MODAL ESCALA DE EQUIPE (FUNCIONÁRIOS)
  const openStaffModal = (evt: EventItem) => {
    setStaffModalEvent(evt)
    setStaffError(null)
    setStaffNotice(null)
    setCopiedWhatsApp(false)
    setSelectedEmpId('')

    // Carregar equipe já escalada
    const currentAssignments = staffAssignments.filter((s) => s.event_id === evt.id)
    const initialDraft: EventStaffInput[] = currentAssignments.map((s) => {
      const emp = employees.find((e) => e.id === s.employee_id)
      return {
        employeeId: s.employee_id,
        employeeName: emp?.name || 'Colaborador',
        role: s.role,
        dailyRate: Number(s.daily_rate || 0),
      }
    })

    setStaffDraft(initialDraft)
  }

  // Ao selecionar colaborador no dropdown, preenche a função e diária padrão
  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmpId(empId)
    setStaffError(null)
    setStaffNotice(null)
    const emp = employees.find((e) => e.id === empId)
    if (emp && staffModalEvent) {
      setStaffRole(emp.role)
      setStaffDailyRate(Number(emp.default_daily_rate || 150))

      // Checagem de escala dupla na mesma data (ex: festa de manhã e festa de noite)
      const conflict = checkEmployeeConflict(emp.id, staffModalEvent.id, staffModalEvent.event_date)
      if (conflict) {
        setStaffNotice(
          `⚠️ Atenção: "${emp.name}" já está escalado(a) na festa "${conflict}" nesta mesma data. Permitido para turnos diferentes (ex: manhã e noite). O colaborador receberá as diárias de ambas as festas no acerto financeiro.`
        )
      }
    }
  }

  // Adicionar colaborador ao rascunho da escala
  const handleAddStaffToDraft = () => {
    if (!staffModalEvent || !selectedEmpId) return

    const emp = employees.find((e) => e.id === selectedEmpId)
    if (!emp) return

    // 1. Validar se já está adicionado neste mesmo evento
    if (staffDraft.some((s) => s.employeeId === selectedEmpId)) {
      setStaffError(`"${emp.name}" já foi adicionado a esta escala.`)
      return
    }

    setStaffError(null)
    setStaffNotice(null)
    setStaffDraft((prev) => [
      ...prev,
      {
        employeeId: selectedEmpId,
        employeeName: emp.name,
        role: staffRole || emp.role,
        dailyRate: staffDailyRate,
      },
    ])

    setSelectedEmpId('')
  }

  // Salvar Escala no Servidor
  const handleSaveStaffScale = () => {
    if (!staffModalEvent) return

    startTransition(async () => {
      const res = await assignStaffToEvent(staffModalEvent.id, staffDraft)
      if (res?.error) {
        setStaffError(res.error)
      } else {
        setStaffModalEvent(null)
        router.refresh()
      }
    })
  }

  // Copiar Escala Formatada para WhatsApp
  const handleCopyWhatsAppScale = () => {
    if (!staffModalEvent) return
    const dateFmt = new Date(staffModalEvent.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
    const totalCost = staffDraft.reduce((acc, s) => acc + Number(s.dailyRate || 0), 0)

    const text = `🎉 *Luh Recepções & Buffet - Escala da Equipe*
📅 *Evento:* ${staffModalEvent.title}
🗓️ *Data:* ${dateFmt}
📍 *Local:* ${staffModalEvent.location || 'Luh Recepções'}

👥 *Equipe Escalada (${staffDraft.length} colaboradores):*
${staffDraft
  .map((s, i) => {
    const isDouble = checkEmployeeConflict(s.employeeId, staffModalEvent.id, staffModalEvent.event_date)
    return `${i + 1}. *${s.employeeName}* - ${s.role} (Diária: R$ ${Number(s.dailyRate).toFixed(2)})${
      isDouble ? ' [⚠️ Escala Dupla no Dia]' : ''
    }`
  })
  .join('\n')}

💰 *Custo Total de Diárias:* R$ ${totalCost.toFixed(2)}
Por favor, confirmem presença com antecedência! ✅`

    navigator.clipboard.writeText(text)
    setCopiedWhatsApp(true)
    setTimeout(() => setCopiedWhatsApp(false), 2500)
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Gestão de Festas & Eventos</h1>
          <p className="text-sm text-[#6e6e73]">
            Planejamento de orçamentos, cronograma, materiais do estoque e escala da equipe com bloqueio anti-conflito.
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              setErrorMessage(null)
              setEditingEvent(null)
              setIsModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <CalendarPlus size={15} strokeWidth={2.2} />
            <span>Novo Evento</span>
          </button>
        </div>
      </div>

      {/* Container de Eventos */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, cliente ou local..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto">
            {[
              { label: 'Todos', val: 'all' },
              { label: 'Orçamentos', val: 'budget' },
              { label: 'Aprovados', val: 'approved' },
              { label: 'Realizados', val: 'completed' },
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

        {/* Grid de Cards de Eventos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((evt) => {
              const materials = getEventMaterials(evt.id)
              const staffForEvt = staffAssignments.filter((s) => s.event_id === evt.id)
              const staffTotalCost = staffForEvt.reduce((acc, s) => acc + Number(s.daily_rate || 0), 0)
              const contractIncomeTx = (evt.financial_transactions || []).find((t) => t.type === 'income')
              const isContractPaid =
                contractIncomeTx?.status === 'paid' || evt.status === 'completed'
              const netProfit = Number(evt.budget || 0) - staffTotalCost

              return (
                <div
                  key={evt.id}
                  className="group rounded-2xl border border-[#e5e5ea] bg-white p-5 hover:border-[#1d1d1f]/30 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3.5 gap-2">
                      <h3 className="font-semibold text-base text-[#1d1d1f] group-hover:text-[#b8860b] transition-colors leading-snug">
                        {evt.title}
                      </h3>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          evt.status === 'budget'
                            ? 'bg-[#ebf4fe] text-[#0071e3]'
                            : evt.status === 'approved'
                            ? 'bg-[#e8f8ee] text-[#1a7f37]'
                            : evt.status === 'completed'
                            ? 'bg-[#f5f5f7] text-[#6e6e73]'
                            : 'bg-[#feeceb] text-[#cf222e]'
                        }`}
                      >
                        {evt.status === 'budget'
                          ? 'Orçamento'
                          : evt.status === 'approved'
                          ? 'Aprovado'
                          : evt.status === 'completed'
                          ? 'Realizado'
                          : 'Cancelado'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-[#6e6e73]">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-[#86868b]" />
                        <span>{new Date(evt.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#86868b]" />
                        <span>{evt.location || 'Local a definir'}</span>
                      </p>
                      <p className="flex items-center gap-2 font-medium text-[#1d1d1f]">
                        <DollarSign className="h-3.5 w-3.5 text-[#b8860b]" />
                        <span>
                          Orçamento: R${' '}
                          {evt.budget
                            ? Number(evt.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : '0,00'}
                        </span>
                      </p>
                      <p className="flex items-center gap-2 text-[#1d1d1f]">
                        <User className="h-3.5 w-3.5 text-[#86868b]" />
                        <span>
                          Cliente: <strong>{evt.contacts?.name || 'Não definido'}</strong>
                        </span>
                      </p>

                      {/* Status de Materiais do Estoque */}
                      <div className="pt-2 border-t border-[#f2f2f7] mt-3 space-y-1.5">
                        {materials.totalActive > 0 ? (
                          <div className="flex items-center justify-between text-xs bg-[#fef7ee] border border-[#fbd38d]/50 p-2 rounded-xl text-[#b7791f]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Package size={13} />
                              {materials.totalActive} itens em uso na festa
                            </span>
                            <span className="text-[10px] font-semibold bg-[#fffaf0] px-2 py-0.5 rounded-md">
                              Pendente Devolução
                            </span>
                          </div>
                        ) : materials.totalReturned > 0 || materials.totalLoss > 0 ? (
                          <div className="flex items-center justify-between text-xs bg-[#f0fdf4] border border-[#bbf7d0] p-2 rounded-xl text-[#16a34a]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <CheckCircle2 size={13} />
                              Todos os materiais devolvidos
                            </span>
                            {materials.totalLoss > 0 && (
                              <span className="text-[10px] font-semibold text-[#dc2626] bg-[#fee2e2] px-1.5 py-0.5 rounded-md">
                                {materials.totalLoss} avarias
                              </span>
                            )}
                          </div>
                        ) : null}

                        {/* Status da Equipe de Funcionários */}
                        <div className="flex items-center justify-between text-xs bg-[#f8fafc] border border-[#e2e8f0] p-2 rounded-xl text-[#334155]">
                          <span className="flex items-center gap-1.5 font-medium">
                            <UsersRound size={13} className="text-[#64748b]" />
                            {staffForEvt.length > 0
                              ? `${staffForEvt.length} colaboradores escalados`
                              : 'Equipe não escalada'}
                          </span>
                          {staffForEvt.length > 0 && (
                            <span className="text-[10px] font-bold text-[#475569] bg-white border border-[#cbd5e1] px-1.5 py-0.5 rounded">
                              Diárias: R$ {staffTotalCost.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* 💰 Painel Financeiro Conectado */}
                        {Number(evt.budget || 0) > 0 && (
                          <div className="flex items-center justify-between text-xs bg-[#fdfcf7] border border-[#f3e8c8] p-2 rounded-xl text-[#78350f]">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Wallet size={13} className="text-[#b45309]" />
                              <span>
                                Contrato: <strong>R$ {Number(evt.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isContractPaid
                                    ? 'bg-[#dcfce7] text-[#15803d]'
                                    : 'bg-[#fef3c7] text-[#b45309]'
                                }`}
                              >
                                {isContractPaid ? '✓ Recebido' : 'Aguardando'}
                              </span>
                              {!isContractPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleReceiveContract(evt.id)}
                                  disabled={actionLoadingId === evt.id}
                                  className="text-[10px] font-semibold text-[#0071e3] hover:underline cursor-pointer bg-[#ebf4fe] px-1.5 py-0.5 rounded"
                                  title="Marcar contrato como recebido no Financeiro"
                                >
                                  Receber
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Lucro Previsto Líquido da Festa */}
                        {(Number(evt.budget || 0) > 0 || staffTotalCost > 0) && (
                          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-[#fbfbfd] rounded-xl border border-[#f2f2f7] text-[#6e6e73]">
                            <span className="flex items-center gap-1">
                              <TrendingUp size={12} className={netProfit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'} />
                              <span>Lucro Previsto:</span>
                            </span>
                            <span className={`font-bold ${netProfit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                              R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="mt-4 pt-3.5 border-t border-[#f2f2f7] flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botão de Equipe / Funcionários */}
                      <button
                        type="button"
                        onClick={() => openStaffModal(evt)}
                        className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Escalar garçons, cozinha e equipe para este evento"
                      >
                        <UserCheck size={13} className="text-[#0071e3]" />
                        Equipe ({staffForEvt.length})
                      </button>

                      {/* Botão de Materiais do Estoque */}
                      <button
                        type="button"
                        onClick={() => openAllocationModal(evt)}
                        className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Vincular louças, mesas, taças e materiais do estoque"
                      >
                        <Boxes size={13} className="text-[#86868b]" />
                        Materiais
                      </button>

                      {evt.status === 'budget' && (
                        <button
                          onClick={() => handleStatusChange(evt.id, 'approved')}
                          disabled={actionLoadingId === evt.id}
                          className="text-[11px] font-semibold text-[#1a7f37] bg-[#e8f8ee] hover:bg-[#d5f3df] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Aprovar
                        </button>
                      )}

                      {evt.status === 'approved' && (
                        <button
                          onClick={() => {
                            if (materials.totalActive > 0) {
                              openInspectionModal(evt)
                            } else {
                              handleStatusChange(evt.id, 'completed')
                            }
                          }}
                          disabled={actionLoadingId === evt.id}
                          className="text-[11px] font-semibold text-white bg-[#0071e3] hover:bg-[#005bb5] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          {materials.totalActive > 0 ? (
                            <>
                              <ShieldAlert size={12} />
                              Conferir & Concluir
                            </>
                          ) : (
                            'Concluir Evento'
                          )}
                        </button>
                      )}

                      {evt.status === 'completed' && materials.totalActive > 0 && (
                        <button
                          onClick={() => openInspectionModal(evt)}
                          className="text-[11px] font-semibold text-[#d97706] bg-[#fef3c7] hover:bg-[#fde68a] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldAlert size={12} />
                          Conferir Devolução
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setErrorMessage(null)
                          setEditingEvent(evt)
                          setIsModalOpen(true)
                        }}
                        className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                        title="Editar evento"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(evt.id, evt.title)}
                        disabled={actionLoadingId === evt.id}
                        className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                        title="Excluir evento"
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
              <CalendarPlus className="mx-auto h-8 w-8 text-[#86868b] mb-2 stroke-[1.5]" />
              <p className="text-[#1d1d1f] font-medium text-sm">Nenhum evento encontrado</p>
              <p className="text-xs text-[#86868b] mt-0.5">
                Cadastre orçamentos e datas para acompanhar o cronograma.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-3 text-xs font-semibold text-[#1d1d1f] hover:underline cursor-pointer"
              >
                + Cadastrar novo evento
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Escala da Equipe de Funcionários (COM REGRA ANTI-CONFLITO) */}
      {staffModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#ebf4fe] text-[#0071e3]">
                    <UserCheck size={18} />
                  </span>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">Escala da Equipe da Festa</h3>
                </div>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Evento: <strong>{staffModalEvent.title}</strong> — Data:{' '}
                  <strong>
                    {new Date(staffModalEvent.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setStaffModalEvent(null)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner Informativo de Gestão de Escalas e Turnos */}
            <div className="my-3 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex items-center gap-2.5 text-xs text-[#475569]">
              <Clock size={16} className="text-[#0071e3] shrink-0" />
              <span>
                <strong>Gestão Inteligente de Turnos:</strong> Caso o colaborador atue em duas festas no mesmo dia (ex: manhã e noite), o sistema permite a <strong>Escala Dupla</strong> e calcula as diárias de ambas as festas individualmente!
              </span>
            </div>

            {staffNotice && (
              <div className="mb-3 p-3 bg-[#fffbeb] text-[#92400e] text-xs font-medium rounded-xl border border-[#fef3c7] flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="text-[#d97706] shrink-0 mt-0.5" />
                <span>{staffNotice}</span>
              </div>
            )}

            {staffError && (
              <div className="mb-3 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-semibold rounded-xl border border-[#ffdcd9] flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            {/* Seletor de Colaboradores */}
            <div className="space-y-3 bg-[#fbfbfd] p-4 rounded-2xl border border-[#f0f0f2]">
              <label className="block text-xs font-bold text-[#1d1d1f]">
                Escalar Colaborador para esta Festa
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <select
                    value={selectedEmpId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                  >
                    <option value="">Selecione o colaborador...</option>
                    {employees.map((emp) => {
                      const conflict = checkEmployeeConflict(
                        emp.id,
                        staffModalEvent.id,
                        staffModalEvent.event_date
                      )
                      const isAlreadyInDraft = staffDraft.some((s) => s.employeeId === emp.id)

                      return (
                        <option
                          key={emp.id}
                          value={emp.id}
                          disabled={isAlreadyInDraft}
                          className={conflict ? 'text-[#b45309] font-medium' : ''}
                        >
                          {emp.name} ({emp.role}){' '}
                          {isAlreadyInDraft
                            ? '— (Já nesta escala)'
                            : conflict
                            ? `— ⚠️ Escala Dupla (Já em: ${conflict})`
                            : `— Diária R$ ${emp.default_daily_rate}`}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    placeholder="Função (ex: Garçom)"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={staffDailyRate}
                      onChange={(e) => setStaffDailyRate(parseFloat(e.target.value) || 0)}
                      placeholder="Diária R$"
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-2.5 py-2 text-xs text-[#1d1d1f]"
                    />
                    <button
                      type="button"
                      onClick={handleAddStaffToDraft}
                      disabled={!selectedEmpId}
                      className="rounded-xl bg-[#1d1d1f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      + Escalar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista dos Colaboradores Escalados */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#1d1d1f]">
                  Equipe Escalada ({staffDraft.length} colaboradores)
                </h4>
                <button
                  type="button"
                  onClick={handleCopyWhatsAppScale}
                  disabled={staffDraft.length === 0}
                  className="text-xs font-semibold text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {copiedWhatsApp ? (
                    <span className="text-[#16a34a] flex items-center gap-1">
                      <Check size={13} /> Escala Copiada!
                    </span>
                  ) : (
                    <>
                      <MessageSquare size={13} /> Copiar Escala (WhatsApp)
                    </>
                  )}
                </button>
              </div>

              {staffDraft.length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-2 border border-[#e5e5ea] rounded-2xl p-2.5 bg-white">
                  {staffDraft.map((item, idx) => {
                    const emp = employees.find((e) => e.id === item.employeeId)
                    const sameDayOther = staffModalEvent
                      ? checkEmployeeConflict(item.employeeId, staffModalEvent.id, staffModalEvent.event_date)
                      : null

                    return (
                      <div
                        key={item.employeeId}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#fafafa] border border-[#f2f2f7]"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-[#1d1d1f] flex items-center gap-1.5">
                              <UserCheck size={13} className="text-[#0071e3]" />
                              {item.employeeName || emp?.name}
                            </p>
                            {sameDayOther && (
                              <span
                                title={`Escala dupla: este colaborador também está na festa "${sameDayOther}" nesta mesma data.`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fef3c7] px-2 py-0.5 rounded-md"
                              >
                                <Clock size={10} /> Escala Dupla (Também em: {sameDayOther})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#6e6e73] mt-0.5">
                            Função: <strong>{item.role}</strong>
                            {emp?.phone ? ` | Whats: ${emp.phone}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#1d1d1f] bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] px-2 py-1 rounded-lg">
                            R$ {Number(item.dailyRate).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setStaffDraft((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[#86868b] hover:text-[#cf222e] p-1 cursor-pointer"
                            title="Remover da escala"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#86868b] italic py-3 text-center border border-dashed border-[#e5e5ea] rounded-xl bg-[#fafafa]">
                  Nenhum colaborador adicionado a esta escala ainda.
                </p>
              )}
            </div>

            {/* Resumo do Custo da Equipe */}
            <div className="mt-4 p-3.5 rounded-2xl bg-[#fffaf0] border border-[#fef3c7] flex justify-between items-center text-xs">
              <span className="font-semibold text-[#86868b]">
                Custo Total de Diárias da Equipe:
              </span>
              <span className="text-base font-extrabold text-[#1d1d1f]">
                R${' '}
                {staffDraft
                  .reduce((acc, s) => acc + Number(s.dailyRate || 0), 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Ações do Modal */}
            <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-[#f2f2f7]">
              <button
                type="button"
                onClick={() => setStaffModalEvent(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveStaffScale}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Salvando Escala...' : 'Salvar Escala da Equipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Alocar Materiais do Estoque na Festa */}
      {allocatingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">
                  Materiais do Estoque para Festa
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  {allocatingEvent.title} — Itens serão descontados do saldo disponível do estoque.
                </p>
              </div>
              <button
                onClick={() => setAllocatingEvent(null)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {allocationError && (
              <div className="mt-4 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-medium rounded-xl border border-[#ffdcd9]">
                {allocationError}
              </div>
            )}

            {/* Seletor de Produtos */}
            <div className="mt-4 space-y-3 bg-[#fbfbfd] p-4 rounded-2xl border border-[#f0f0f2]">
              <label className="block text-xs font-semibold text-[#1d1d1f]">
                Adicionar Produto do Estoque à Festa
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedProductToAdd}
                  onChange={(e) => setSelectedProductToAdd(e.target.value)}
                  className="flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                >
                  <option value="">Selecione um produto disponível...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                      {p.name} ({p.sku}) — Saldo: {p.current_stock} un.
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] text-center"
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    onClick={handleAddProductToAllocation}
                    className="flex items-center gap-1 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-colors cursor-pointer shrink-0"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Itens a Alocar nesta Operação */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[#1d1d1f] mb-2">
                Itens para Saída nesta Operação ({allocationItems.length})
              </h4>
              {allocationItems.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 border border-[#e5e5ea] rounded-xl p-2.5">
                  {allocationItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId)
                    return (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-[#f2f2f7]"
                      >
                        <div>
                          <p className="font-semibold text-[#1d1d1f]">{prod?.name}</p>
                          <p className="text-[11px] text-[#86868b]">
                            SKU: {prod?.sku} | Saldo atual: {prod?.current_stock} un.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#0071e3] bg-[#ebf4fe] px-2 py-0.5 rounded-md">
                            {item.quantity} un.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAllocationItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-[#86868b] hover:text-[#cf222e]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#86868b] italic py-2">Nenhum item adicionado ainda.</p>
              )}
            </div>

            {/* Materiais já alocados anteriormente */}
            {(() => {
              const currentSummary = getEventMaterials(allocatingEvent.id)
              if (currentSummary.items.length === 0) return null
              return (
                <div className="mt-4 pt-3 border-t border-[#f2f2f7]">
                  <h4 className="text-xs font-semibold text-[#86868b] mb-1.5">
                    Histórico de Materiais já alocados nesta festa:
                  </h4>
                  <div className="text-[11px] text-[#6e6e73] space-y-1">
                    {currentSummary.items.map((i) => (
                      <div key={i.productId} className="flex justify-between">
                        <span>• {i.product.name}</span>
                        <span>
                          Total saído: {i.out} | Ativos: <strong>{i.active}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="flex justify-end gap-2.5 pt-5 mt-4 border-t border-[#f2f2f7]">
              <button
                type="button"
                onClick={() => setAllocatingEvent(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleConfirmAllocation}
                disabled={isPending || allocationItems.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isPending ? 'Gravando Saídas...' : 'Confirmar Saída do Estoque'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Checklist de Devolução & Conferência de Avarias ("Quebrou algo? Faltou algo?") */}
      {inspectingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#feeceb] text-[#cf222e]">
                    <ShieldAlert size={18} />
                  </span>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    Conferência de Retorno da Festa
                  </h3>
                </div>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Evento: <strong>{inspectingEvent.title}</strong> — Verifique as condições dos materiais antes do retorno ao estoque.
                </p>
              </div>
              <button
                onClick={() => setInspectingEvent(null)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pergunta de Destaque Requerida pelo Usuário */}
            <div className="my-4 p-4 rounded-2xl bg-[#fff8e6] border border-[#fbd38d] text-[#8a5b00]">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle size={17} className="text-[#d97706]" />
                Perguntar: Quebrou algum item? Faltou algo durante a festa?
              </h4>
              <p className="text-xs mt-1 leading-relaxed">
                Itens <strong>devolvidos intactos</strong> voltarão automaticamente ao estoque.
                Itens <strong>quebrados</strong> ou <strong>faltantes</strong> serão baixados definitivamente como perda/avaria no histórico.
              </p>
            </div>

            {/* Checklist Item a Item */}
            <div className="space-y-3">
              {checklistItems.map((item, idx) => {
                const isTotalValid =
                  Number(item.returnedQty) + Number(item.brokenQty) + Number(item.lostQty) ===
                  item.totalAllocated

                return (
                  <div
                    key={item.productId}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.brokenQty > 0 || item.lostQty > 0
                        ? 'border-[#fca5a5] bg-[#fffbfb]'
                        : 'border-[#e5e5ea] bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-sm font-bold text-[#1d1d1f]">
                          {item.productName}
                        </span>
                        <span className="ml-2 text-xs text-[#86868b]">
                          (Total na Festa: <strong>{item.totalAllocated} un.</strong>)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleChecklistChange(idx, 'returnedQty', item.totalAllocated)
                            handleChecklistChange(idx, 'brokenQty', 0)
                            handleChecklistChange(idx, 'lostQty', 0)
                          }}
                          className="text-[11px] font-semibold text-[#16a34a] bg-[#dcfce7] hover:bg-[#bbf7d0] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          ✓ Tudo Devolvido Íntegro
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
                        <label className="block font-semibold text-[#166534] mb-1">
                          Devolvido Intacto (Volta ao Estoque)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalAllocated}
                          value={item.returnedQty}
                          onChange={(e) =>
                            handleChecklistChange(idx, 'returnedQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#86efac] rounded-lg px-2.5 py-1.5 font-bold text-[#166534]"
                        />
                      </div>

                      <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl">
                        <label className="block font-semibold text-[#991b1b] mb-1">
                          Quebrou / Avariou (Baixa Perda)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalAllocated}
                          value={item.brokenQty}
                          onChange={(e) =>
                            handleChecklistChange(idx, 'brokenQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#fca5a5] rounded-lg px-2.5 py-1.5 font-bold text-[#991b1b]"
                        />
                      </div>

                      <div className="p-3 bg-[#fff7ed] border border-[#ffedd5] rounded-xl">
                        <label className="block font-semibold text-[#9a3412] mb-1">
                          Faltou / Não Devolvido
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalAllocated}
                          value={item.lostQty}
                          onChange={(e) =>
                            handleChecklistChange(idx, 'lostQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#fdba74] rounded-lg px-2.5 py-1.5 font-bold text-[#9a3412]"
                        />
                      </div>
                    </div>

                    {(item.brokenQty > 0 || item.lostQty > 0) && (
                      <div className="mt-3 pt-3 border-t border-[#fee2e2] flex flex-col sm:flex-row gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Motivo da quebra/extravio (Ex: Taça caiu na pista, prato lascado)..."
                          value={item.notes || ''}
                          onChange={(e) =>
                            handleChecklistChange(idx, 'notes', e.target.value)
                          }
                          className="flex-1 text-xs border border-[#fca5a5] rounded-lg px-3 py-1.5 bg-white text-[#1d1d1f]"
                        />
                        {item.penaltyFee ? (
                          <span className="text-xs font-bold text-[#b91c1c] whitespace-nowrap">
                            Valor de Reposição: R${' '}
                            {Number(item.penaltyFee).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {!isTotalValid && (
                      <p className="text-[11px] text-[#dc2626] font-medium mt-2">
                        ⚠️ Atenção: A soma ({Number(item.returnedQty) + Number(item.brokenQty) + Number(item.lostQty)}) não confere com o total ({item.totalAllocated}).
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-5 border-t border-[#f2f2f7]">
              <div className="text-xs text-[#6e6e73]">
                {checklistItems.some((i) => i.brokenQty > 0 || i.lostQty > 0) ? (
                  <span className="text-[#b91c1c] font-semibold flex items-center gap-1">
                    <AlertTriangle size={14} /> Houve registro de quebras/perdas nesta conferência.
                  </span>
                ) : (
                  <span className="text-[#166534] font-semibold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Todos os itens estão íntegros para retornar ao estoque.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingEvent(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInspection}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check size={15} />
                  {isPending ? 'Processando Devolução...' : 'Confirmar Devolução e Concluir Festa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Novo Evento / Editar Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">
                  {editingEvent ? 'Editar Evento' : 'Novo Evento / Recepção'}
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  {editingEvent
                    ? 'Atualize as informações do evento e cronograma.'
                    : 'Cadastre um novo evento no cronograma do buffet.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingEvent(null)
                }}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-medium rounded-xl border border-[#ffdcd9]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {editingEvent && <input type="hidden" name="id" value={editingEvent.id} />}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome do Evento / Festa *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingEvent?.title || ''}
                  placeholder="Ex: Casamento Beatriz & Leonardo"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Cliente Solicitante
                  </label>
                  <select
                    name="client_id"
                    defaultValue={editingEvent?.contacts?.id || ''}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  >
                    <option value="">Selecione um cliente...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Data do Evento *
                  </label>
                  <input
                    type="date"
                    name="event_date"
                    required
                    defaultValue={editingEvent?.event_date || ''}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Local do Evento
                  </label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editingEvent?.location || ''}
                    placeholder="Ex: Luh Recepções - Salão Nobre"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Orçamento / Valor Fechado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="budget"
                    defaultValue={editingEvent?.budget ? Number(editingEvent.budget) : ''}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editingEvent?.status || 'budget'}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="budget">Orçamento em Aberto</option>
                  <option value="approved">Contrato Fechado & Aprovado</option>
                  <option value="completed">Evento Já Realizado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingEvent(null)
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending
                    ? 'Salvando...'
                    : editingEvent
                    ? 'Salvar Alterações'
                    : 'Salvar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
