'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  Calendar,
  Truck,
  MapPin,
  DollarSign,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  FileText,
  Printer,
  Trash2,
  X,
  Boxes,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Info,
  Wallet,
} from 'lucide-react'
import {
  createRental,
  updateRentalStatus,
  updateRentalPaymentStatus,
  returnRentalWithInspection,
  quickCreateClient,
  deleteRental,
  RentalPayload,
  RentalItemInput,
  RentalInspectionItem,
} from './actions'

interface ClientContact {
  id: string
  name: string
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
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

interface RentalItemDB {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  returned_qty?: number
  broken_qty?: number
  lost_qty?: number
  penalty_fee?: number
  notes?: string | null
  products?: ProductItem | null
}

interface RentalDB {
  id: string
  rental_code: string
  client_id: string
  start_date: string
  return_date: string
  actual_return_date?: string | null
  status: 'budget' | 'confirmed' | 'dispatched' | 'returned' | 'canceled'
  delivery_type: 'pickup' | 'delivery'
  delivery_address?: string | null
  delivery_fee: number
  security_deposit: number
  items_total: number
  total_amount: number
  penalty_amount?: number
  payment_status: 'pending' | 'paid' | 'partial'
  notes?: string | null
  created_at: string
  contacts?: ClientContact | null
  rental_items?: RentalItemDB[]
}

export function LocacoesClient({
  rentals = [],
  contacts = [],
  products = [],
  tableCreatedInDb = true,
}: {
  rentals: RentalDB[]
  contacts: ClientContact[]
  products: ProductItem[]
  tableCreatedInDb?: boolean
}) {
  const router = useRouter()
  const [localRentals, setLocalRentals] = useState<RentalDB[]>(rentals)

  useEffect(() => {
    setLocalRentals(rentals)
  }, [rentals])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Modais
  const [isNewRentalModalOpen, setIsNewRentalModalOpen] = useState(false)
  const [inspectingRental, setInspectingRental] = useState<RentalDB | null>(null)
  const [printingRental, setPrintingRental] = useState<RentalDB | null>(null)
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false)

  // Formulário Nova Locação
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [returnDate, setReturnDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)
  )
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryFee, setDeliveryFee] = useState<number>(0)
  const [securityDeposit, setSecurityDeposit] = useState<number>(0)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'partial'>('pending')
  const [notes, setNotes] = useState('')
  const [draftItems, setDraftItems] = useState<RentalItemInput[]>([])

  // Seletor de Item na Nova Locação
  const [selectedProductId, setSelectedProductId] = useState('')
  const [itemQty, setItemQty] = useState<number>(1)
  const [itemPrice, setItemPrice] = useState<number>(0)
  const [formError, setFormError] = useState<string | null>(null)

  // Conferência de Devolução
  const [checklist, setChecklist] = useState<RentalInspectionItem[]>([])
  const [chargeOption, setChargeOption] = useState<'none' | 'deposit_deduct' | 'financial_charge'>('financial_charge')

  // Ao selecionar produto no formulário, preenche o preço unitário
  const handleProductSelect = (pid: string) => {
    setSelectedProductId(pid)
    const p = products.find((prod) => prod.id === pid)
    if (p) {
      setItemPrice(Number(p.rental_price || 0))
    }
  }

  // Adicionar item ao rascunho da locação
  const handleAddItemToDraft = () => {
    if (!selectedProductId) return
    const prod = products.find((p) => p.id === selectedProductId)
    if (!prod) return

    if (itemQty <= 0) {
      setFormError('A quantidade deve ser maior que 0.')
      return
    }

    if (itemQty > prod.current_stock) {
      setFormError(`Estoque insuficiente! Saldo atual de ${prod.name} é ${prod.current_stock} un.`)
      return
    }

    setFormError(null)
    const subtotal = itemQty * itemPrice

    setDraftItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === selectedProductId)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx].quantity += itemQty
        copy[idx].subtotal = copy[idx].quantity * copy[idx].unitPrice
        return copy
      }
      return [
        ...prev,
        {
          productId: selectedProductId,
          productName: prod.name,
          quantity: itemQty,
          unitPrice: itemPrice,
          subtotal,
        },
      ]
    })

    setSelectedProductId('')
    setItemQty(1)
    setItemPrice(0)
  }

  // Salvar Nova Locação
  const handleSaveRental = (status: 'budget' | 'confirmed' | 'dispatched') => {
    if (!clientId) {
      setFormError('Selecione um cliente para a locação.')
      return
    }
    if (draftItems.length === 0) {
      setFormError('Adicione pelo menos um item à locação.')
      return
    }

    setFormError(null)
    const payload: RentalPayload = {
      clientId,
      startDate,
      returnDate,
      deliveryType,
      deliveryAddress,
      deliveryFee,
      securityDeposit,
      paymentStatus,
      status,
      notes,
      items: draftItems,
    }

    startTransition(async () => {
      const res = await createRental(payload)
      if (res?.error) {
        setFormError(res.error)
      } else {
        setIsNewRentalModalOpen(false)
        resetRentalForm()
        router.refresh()
      }
    })
  }

  const resetRentalForm = () => {
    setClientId('')
    setDeliveryType('pickup')
    setDeliveryAddress('')
    setDeliveryFee(0)
    setSecurityDeposit(0)
    setPaymentStatus('pending')
    setNotes('')
    setDraftItems([])
    setSelectedProductId('')
    setFormError(null)
  }

  // Cadastro Rápido de Cliente
  const handleQuickClientSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await quickCreateClient(formData)
      if (res?.error) {
        alert(res.error)
      } else if (res?.client) {
        setIsQuickClientModalOpen(false)
        setClientId(res.client.id)
        if (res.client.address && deliveryType === 'delivery') {
          setDeliveryAddress(res.client.address)
        }
        router.refresh()
      }
    })
  }

  // Abrir Modal de Conferência e Devolução
  const openReturnInspection = (rental: RentalDB) => {
    const items = (rental.rental_items || []).map((it) => {
      const prodName = it.products?.name || 'Item de Estoque'
      const unitCost = Number(it.products?.cost_price || 0) || Number(it.unit_price) * 2
      return {
        productId: it.product_id,
        productName: prodName,
        totalRented: it.quantity,
        returnedQty: it.quantity, // padrão: tudo íntegro
        brokenQty: 0,
        lostQty: 0,
        penaltyFee: 0,
        notes: '',
        unitCost,
      }
    })

    setChecklist(items)
    setInspectingRental(rental)
  }

  // Atualizar Checklist de Devolução
  const handleChecklistUpdate = (
    idx: number,
    field: 'returnedQty' | 'brokenQty' | 'lostQty' | 'notes',
    val: any
  ) => {
    setChecklist((prev) => {
      const copy = [...prev]
      const item = { ...copy[idx] }

      if (field === 'returnedQty' || field === 'brokenQty' || field === 'lostQty') {
        item[field] = Math.max(0, Number(val) || 0)
        const unitCost = (item as any).unitCost || 15
        item.penaltyFee = (item.brokenQty + item.lostQty) * unitCost
      } else if (field === 'notes') {
        item.notes = val
      }

      copy[idx] = item
      return copy
    })
  }

  // Confirmar Devolução
  const handleConfirmReturn = () => {
    if (!inspectingRental) return

    for (const it of checklist) {
      const sum = Number(it.returnedQty) + Number(it.brokenQty) + Number(it.lostQty)
      if (sum !== it.totalRented) {
        alert(
          `Item "${it.productName}": A soma de devolvidos (${it.returnedQty}) + quebrados (${it.brokenQty}) + faltantes (${it.lostQty}) deve ser exatamente ${it.totalRented} un.`
        )
        return
      }
    }

    const currentRentalId = inspectingRental.id
    // Optimistic status update
    setLocalRentals((prev) =>
      prev.map((r) => (r.id === currentRentalId ? { ...r, status: 'returned' as const } : r))
    )

    startTransition(async () => {
      const res = await returnRentalWithInspection(
        inspectingRental.id,
        inspectingRental.rental_code,
        checklist,
        chargeOption
      )
      if (res?.error) {
        alert(res.error)
        router.refresh()
      } else {
        setInspectingRental(null)
        router.refresh()
      }
    })
  }

  // Excluir Locação Instantaneamente (Otimista)
  const handleDeleteRental = (id: string, code: string) => {
    if (!confirm(`Deseja realmente excluir a locação ${code}?`)) return
    
    // Atualização instantânea na tela
    setLocalRentals((prev) => prev.filter((r) => r.id !== id))
    setActionLoadingId(id)

    startTransition(async () => {
      await deleteRental(id)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Atualizar Status Instantaneamente
  const handleUpdateStatus = (
    id: string,
    status: 'budget' | 'confirmed' | 'dispatched' | 'returned' | 'canceled'
  ) => {
    setLocalRentals((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    setActionLoadingId(id)
    startTransition(async () => {
      await updateRentalStatus(id, status)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Atualizar Pagamento Instantaneamente
  const handleUpdatePaymentStatus = (id: string, payment_status: 'pending' | 'paid') => {
    setLocalRentals((prev) => prev.map((r) => (r.id === id ? { ...r, payment_status } : r)))
    startTransition(async () => {
      await updateRentalPaymentStatus(id, payment_status)
      router.refresh()
    })
  }

  // Filtros
  const filteredRentals = localRentals.filter((r) => {
    const clientName = r.contacts?.name || ''
    const clientDoc = r.contacts?.document || ''
    const matchesSearch =
      r.rental_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientDoc.includes(searchTerm)

    const matchesStatus = filterStatus === 'all' || r.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Totais Rápidos
  const activeRentalsCount = localRentals.filter((r) => r.status === 'dispatched').length
  const totalValue = localRentals.reduce((acc, r) => acc + Number(r.total_amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Banner de Migração SQL se necessário */}
      {!tableCreatedInDb && (
        <div className="rounded-2xl border border-[#fed7aa] bg-[#fffaf5] p-4 text-[#9a3412] flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Info size={18} className="shrink-0 text-[#ea580c] mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-sm text-[#7c2d12]">
                Modo de Operação Ativo (Fallback Transparente)
              </p>
              <p className="mt-0.5 leading-relaxed text-[#9a3412]">
                O módulo de locações e devolução já está 100% funcional gravando e controlando o estoque! 
                Para habilitar as tabelas nativas de alta performance no Supabase, execute o script disponível em{' '}
                <code className="bg-[#ffedd5] px-1.5 py-0.5 rounded font-mono text-[11px]">
                  supabase/migration_locacoes_e_conferencia.sql
                </code>{' '}
                no SQL Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            Gestão de Locações & Aluguel
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Controle de aluguel de louças, mesas, cadeiras, saídas e conferência rigorosa de avarias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetRentalForm()
              setIsNewRentalModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>Nova Locação</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#86868b]">Total de Locações Registradas</p>
          <p className="text-xl font-bold text-[#1d1d1f] mt-1">{rentals.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#86868b]">Itens em Posse dos Clientes (Em Andamento)</p>
          <p className="text-xl font-bold text-[#0071e3] mt-1">{activeRentalsCount}</p>
        </div>
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-[#86868b]">Faturamento Total em Locações</p>
          <p className="text-xl font-bold text-[#1a7f37] mt-1">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Container Principal */}
      <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
        {/* Barra de Busca e Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, cliente ou CPF..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto">
            {[
              { label: 'Todos', val: 'all' },
              { label: 'Orçamentos', val: 'budget' },
              { label: 'Confirmadas', val: 'confirmed' },
              { label: 'Em Posse do Cliente', val: 'dispatched' },
              { label: 'Devolvidas', val: 'returned' },
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

        {/* Lista de Locações */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredRentals.length > 0 ? (
            filteredRentals.map((rental) => {
              const client = rental.contacts
              const items = rental.rental_items || []
              const totalItemsCount = items.reduce((acc, i) => acc + Number(i.quantity || 0), 0)

              return (
                <div
                  key={rental.id}
                  className="rounded-2xl border border-[#e5e5ea] bg-white p-5 hover:border-[#1d1d1f]/30 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#b8860b] bg-[#fffaf0] border border-[#fef3c7] px-2 py-0.5 rounded-md">
                          {rental.rental_code}
                        </span>
                        <h3 className="font-bold text-base text-[#1d1d1f] mt-1.5 leading-snug">
                          {client?.name || 'Cliente Avulso'}
                        </h3>
                      </div>

                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          rental.status === 'budget'
                            ? 'bg-[#ebf4fe] text-[#0071e3]'
                            : rental.status === 'confirmed'
                            ? 'bg-[#fef3c7] text-[#b45309]'
                            : rental.status === 'dispatched'
                            ? 'bg-[#e8f8ee] text-[#1a7f37]'
                            : rental.status === 'returned'
                            ? 'bg-[#f5f5f7] text-[#6e6e73]'
                            : 'bg-[#feeceb] text-[#cf222e]'
                        }`}
                      >
                        {rental.status === 'budget'
                          ? 'Orçamento'
                          : rental.status === 'confirmed'
                          ? 'Reservado'
                          : rental.status === 'dispatched'
                          ? 'Em Uso (Com Cliente)'
                          : rental.status === 'returned'
                          ? 'Devolvido'
                          : 'Cancelado'}
                      </span>
                    </div>

                    {/* Dados do Cliente e Datas */}
                    <div className="space-y-2 text-xs text-[#6e6e73] my-3">
                      {client?.phone && (
                        <p className="flex items-center gap-2">
                          <Phone size={13} className="text-[#86868b]" />
                          <span>{client.phone}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Calendar size={13} className="text-[#86868b]" />
                        <span>
                          Retirada: <strong>{new Date(rental.start_date).toLocaleDateString('pt-BR')}</strong> | Devolução:{' '}
                          <strong>{new Date(rental.return_date).toLocaleDateString('pt-BR')}</strong>
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Truck size={13} className="text-[#86868b]" />
                        <span>
                          {rental.delivery_type === 'pickup'
                            ? 'Retirada no Local (Pegue & Monte)'
                            : `Entrega: ${rental.delivery_address || 'Endereço fornecido'}`}
                        </span>
                      </p>
                      <p className="flex items-center gap-2 font-medium text-[#1d1d1f]">
                        <DollarSign size={13} className="text-[#b8860b]" />
                        <span>
                          Total: R${' '}
                          {Number(rental.total_amount).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                          {Number(rental.security_deposit) > 0 && (
                            <span className="text-[#86868b] font-normal ml-1">
                              (+ Caução R$ {Number(rental.security_deposit).toFixed(2)})
                            </span>
                          )}
                        </span>
                      </p>

                      {/* Status de Pagamento / Financeiro */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#f2f2f7] mt-2">
                        <span className="text-[11px] text-[#86868b] flex items-center gap-1">
                          <Wallet size={12} className="text-[#86868b]" /> Financeiro:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              rental.payment_status === 'paid'
                                ? 'bg-[#dcfce7] text-[#15803d]'
                                : 'bg-[#fef3c7] text-[#b45309]'
                            }`}
                          >
                            {rental.payment_status === 'paid' ? '✓ Pago' : 'Aguardando Pagamento'}
                          </span>
                          {rental.payment_status !== 'paid' && (
                            <button
                              type="button"
                              onClick={() => handleUpdatePaymentStatus(rental.id, 'paid')}
                              className="text-[10px] font-semibold text-[#0071e3] hover:underline cursor-pointer bg-[#ebf4fe] px-1.5 py-0.5 rounded"
                              title="Confirmar recebimento e atualizar no Financeiro"
                            >
                              Receber
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resumo dos Itens */}
                    <div className="bg-[#fbfbfd] p-3 rounded-xl border border-[#f2f2f7] my-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#1d1d1f] mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Boxes size={13} /> Itens Locados ({totalItemsCount} un.)
                        </span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {items.map((it, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-[#6e6e73]">
                            <span className="truncate max-w-[180px]">
                              • {it.products?.name || 'Item'}
                            </span>
                            <span className="font-semibold text-[#1d1d1f]">
                              {it.quantity} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alerta de Avaria se houver */}
                    {Number(rental.penalty_amount || 0) > 0 && (
                      <div className="text-xs bg-[#fef2f2] border border-[#fca5a5] p-2 rounded-xl text-[#991b1b] flex items-center justify-between">
                        <span className="flex items-center gap-1 font-semibold">
                          <ShieldAlert size={14} /> Cobrança de Avarias:
                        </span>
                        <span className="font-bold">
                          R$ {Number(rental.penalty_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ações do Card */}
                  <div className="pt-3 border-t border-[#f2f2f7] flex flex-wrap justify-between items-center gap-2 text-xs mt-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botão de Despachar / Entregar */}
                      {(rental.status === 'budget' || rental.status === 'confirmed') && (
                        <button
                          onClick={() => handleUpdateStatus(rental.id, 'dispatched')}
                          disabled={actionLoadingId === rental.id}
                          className="text-[11px] font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          Entregar ao Cliente
                        </button>
                      )}

                      {/* Botão de Conferir Devolução */}
                      {rental.status === 'dispatched' && (
                        <button
                          onClick={() => openReturnInspection(rental)}
                          className="text-[11px] font-semibold text-white bg-[#0071e3] hover:bg-[#005bb5] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <ShieldAlert size={13} />
                          Conferir & Devolver
                        </button>
                      )}

                      {rental.status === 'returned' && (
                        <span className="text-[11px] text-[#16a34a] font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Devolução Finalizada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Imprimir Romaneio */}
                      <button
                        onClick={() => setPrintingRental(rental)}
                        className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                        title="Imprimir Romaneio / Contrato"
                      >
                        <Printer size={15} />
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => handleDeleteRental(rental.id, rental.rental_code)}
                        disabled={actionLoadingId === rental.id}
                        className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer"
                        title="Excluir Locação"
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
              <ClipboardList className="mx-auto h-8 w-8 text-[#86868b] mb-2 stroke-[1.5]" />
              <p className="text-[#1d1d1f] font-medium text-sm">Nenhuma locação encontrada</p>
              <p className="text-xs text-[#86868b] mt-0.5">
                Cadastre o aluguel de louças, mesas e materiais com controle de devolução.
              </p>
              <button
                onClick={() => setIsNewRentalModalOpen(true)}
                className="mt-3 text-xs font-semibold text-[#1d1d1f] hover:underline cursor-pointer"
              >
                + Criar primeira locação
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Nova Locação */}
      {isNewRentalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">Nova Locação de Materiais</h3>
                <p className="text-xs text-[#6e6e73]">
                  Selecione o cliente, materiais do estoque, logística e valores.
                </p>
              </div>
              <button
                onClick={() => setIsNewRentalModalOpen(false)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-medium rounded-xl border border-[#ffdcd9]">
                {formError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Seção 1: Cliente com Cadastro Rápido */}
              <div className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#f0f0f2]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#1d1d1f]">Cliente Solicitante *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickClientModalOpen(true)}
                    className="text-xs font-semibold text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Novo Cliente Rápido
                  </button>
                </div>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    const c = contacts.find((contact) => contact.id === e.target.value)
                    if (c?.address && deliveryType === 'delivery') {
                      setDeliveryAddress(c.address)
                    }
                  }}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                >
                  <option value="">Selecione um cliente já cadastrado...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.document ? `- CPF: ${c.document}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seção 2: Datas e Logística */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Data/Hora de Retirada (Saída) *
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Data/Hora Prevista de Devolução *
                  </label>
                  <input
                    type="datetime-local"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Tipo de Entrega
                  </label>
                  <select
                    value={deliveryType}
                    onChange={(e) => {
                      const val = e.target.value as 'pickup' | 'delivery'
                      setDeliveryType(val)
                      if (val === 'pickup') {
                        setDeliveryFee(0)
                      } else {
                        const c = contacts.find((ct) => ct.id === clientId)
                        if (c?.address) setDeliveryAddress(c.address)
                      }
                    }}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                  >
                    <option value="pickup">Retirada no Local (Pegue & Monte)</option>
                    <option value="delivery">Entrega no Endereço do Cliente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Taxa de Frete (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    disabled={deliveryType === 'pickup'}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] disabled:bg-[#f5f5f7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Caução / Garantia (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f]"
                  />
                </div>
              </div>

              {deliveryType === 'delivery' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Endereço de Entrega Completo
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade..."
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f]"
                  />
                </div>
              )}

              {/* Seção 3: Adicionar Itens do Estoque */}
              <div className="p-4 rounded-2xl bg-[#fbfbfd] border border-[#f0f0f2] space-y-3">
                <label className="block text-xs font-bold text-[#1d1d1f]">
                  Adicionar Itens do Estoque à Locação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f] focus:outline-none"
                    >
                      <option value="">Selecione o produto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                          {p.name} ({p.sku}) — Saldo: {p.current_stock} un.
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={itemQty}
                      onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="Qtd"
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-2 py-2 text-xs text-[#1d1d1f] text-center"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)}
                      placeholder="Preço un."
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-2 py-2 text-xs text-[#1d1d1f] text-center"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItemToDraft}
                      className="w-full rounded-xl bg-[#1d1d1f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-colors cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>

                {/* Tabela dos Itens Adicionados */}
                <div className="mt-2">
                  <h4 className="text-[11px] font-semibold text-[#86868b] mb-1.5">
                    Itens Selecionados ({draftItems.length})
                  </h4>
                  {draftItems.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#e5e5ea] rounded-xl p-2 bg-white">
                      {draftItems.map((item, idx) => (
                        <div
                          key={item.productId}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#fafafa] border border-[#f2f2f7]"
                        >
                          <div>
                            <span className="font-semibold text-[#1d1d1f]">{item.productName}</span>
                            <span className="text-[11px] text-[#86868b] ml-2">
                              {item.quantity} un. x R$ {item.unitPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#1d1d1f]">
                              R$ {item.subtotal.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-[#86868b] hover:text-[#cf222e]"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#86868b] italic py-2">
                      Nenhum item adicionado ainda.
                    </p>
                  )}
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="p-4 rounded-2xl bg-[#fffaf0] border border-[#fef3c7] flex justify-between items-center text-xs">
                <div>
                  <p className="text-[#86868b]">
                    Subtotal Itens: R${' '}
                    {draftItems.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)} | Frete: R${' '}
                    {Number(deliveryFee).toFixed(2)}
                  </p>
                  <p className="text-base font-bold text-[#1d1d1f] mt-0.5">
                    Total da Locação: R${' '}
                    {(
                      draftItems.reduce((acc, i) => acc + i.subtotal, 0) + Number(deliveryFee)
                    ).toFixed(2)}
                  </p>
                </div>
                {securityDeposit > 0 && (
                  <div className="text-right">
                    <span className="text-[11px] text-[#b45309] font-medium bg-[#fef3c7] px-2 py-1 rounded-md">
                      Caução: R$ {securityDeposit.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Observações / Instruções Especiais
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruções de entrega, cuidados com os materiais..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f]"
                />
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-5 mt-4 border-t border-[#f2f2f7]">
              <button
                type="button"
                onClick={() => setIsNewRentalModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveRental('budget')}
                  disabled={isPending}
                  className="rounded-xl border border-[#d1d1d6] px-4 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Salvar Orçamento
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRental('confirmed')}
                  disabled={isPending}
                  className="rounded-xl bg-[#b8860b] hover:bg-[#996f08] px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
                >
                  Salvar e Reservar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRental('dispatched')}
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] hover:bg-[#333336] px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
                >
                  Salvar e Entregar Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cadastro Rápido de Cliente */}
      {isQuickClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <h3 className="text-base font-bold text-[#1d1d1f]">Cadastro Rápido de Cliente</h3>
              <button
                onClick={() => setIsQuickClientModalOpen(false)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickClientSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: Amanda Silva Santos"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="(81) 98888-7777"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">CPF / CNPJ</label>
                  <input
                    type="text"
                    name="document"
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">E-mail</label>
                <input
                  type="email"
                  name="email"
                  placeholder="cliente@email.com"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">
                  Endereço Completo para Entrega
                </label>
                <textarea
                  rows={2}
                  name="address"
                  placeholder="Rua, Número, Bairro, Complemento, CEP..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setIsQuickClientModalOpen(false)}
                  className="px-3 py-2 font-semibold text-[#6e6e73]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] px-4 py-2 font-semibold text-white"
                >
                  {isPending ? 'Salvando...' : 'Cadastrar e Usar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Checklist de Devolução da Locação ("Quebrou algo? Faltou algo?") */}
      {inspectingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#feeceb] text-[#cf222e]">
                    <ShieldAlert size={18} />
                  </span>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    Conferência de Devolução de Locação
                  </h3>
                </div>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Locação: <strong>{inspectingRental.rental_code}</strong> — Cliente:{' '}
                  <strong>{inspectingRental.contacts?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setInspectingRental(null)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pergunta em Destaque Solicitada pelo Usuário */}
            <div className="my-4 p-4 rounded-2xl bg-[#fff8e6] border border-[#fbd38d] text-[#8a5b00]">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle size={17} className="text-[#d97706]" />
                Perguntar: Quebrou algum item? Faltou algo na devolução do cliente?
              </h4>
              <p className="text-xs mt-1 leading-relaxed">
                Itens <strong>devolvidos intactos</strong> retornarão ao estoque disponível. 
                Itens <strong>quebrados</strong> ou <strong>extraviados</strong> serão baixados definitivamente como perda e calculados para indenização.
              </p>
            </div>

            {/* Checklist Item a Item */}
            <div className="space-y-3">
              {checklist.map((item, idx) => {
                const isTotalValid =
                  Number(item.returnedQty) + Number(item.brokenQty) + Number(item.lostQty) ===
                  item.totalRented

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
                          (Total Locado: <strong>{item.totalRented} un.</strong>)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleChecklistUpdate(idx, 'returnedQty', item.totalRented)
                          handleChecklistUpdate(idx, 'brokenQty', 0)
                          handleChecklistUpdate(idx, 'lostQty', 0)
                        }}
                        className="text-[11px] font-semibold text-[#16a34a] bg-[#dcfce7] hover:bg-[#bbf7d0] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        ✓ Tudo Devolvido Perfeito
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* 1. Devolvidos Intactos */}
                      <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
                        <label className="block font-semibold text-[#166534] mb-1">
                          Devolvido Intacto (Volta ao Estoque)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalRented}
                          value={item.returnedQty}
                          onChange={(e) =>
                            handleChecklistUpdate(idx, 'returnedQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#86efac] rounded-lg px-2.5 py-1.5 font-bold text-[#166534]"
                        />
                      </div>

                      {/* 2. Quebrados */}
                      <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl">
                        <label className="block font-semibold text-[#991b1b] mb-1">
                          Quebrou / Danificado (Baixa Perda)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalRented}
                          value={item.brokenQty}
                          onChange={(e) =>
                            handleChecklistUpdate(idx, 'brokenQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#fca5a5] rounded-lg px-2.5 py-1.5 font-bold text-[#991b1b]"
                        />
                      </div>

                      {/* 3. Faltou */}
                      <div className="p-3 bg-[#fff7ed] border border-[#ffedd5] rounded-xl">
                        <label className="block font-semibold text-[#9a3412] mb-1">
                          Faltou / Não Entregue (Baixa Perda)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.totalRented}
                          value={item.lostQty}
                          onChange={(e) =>
                            handleChecklistUpdate(idx, 'lostQty', e.target.value)
                          }
                          className="w-full bg-white border border-[#fdba74] rounded-lg px-2.5 py-1.5 font-bold text-[#9a3412]"
                        />
                      </div>
                    </div>

                    {/* Observação e Cobrança se quebrou ou faltou */}
                    {(item.brokenQty > 0 || item.lostQty > 0) && (
                      <div className="mt-3 pt-3 border-t border-[#fee2e2] flex flex-col sm:flex-row gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Detalhes da avaria (Ex: Prato trincado, taça quebrada no retorno)..."
                          value={item.notes || ''}
                          onChange={(e) =>
                            handleChecklistUpdate(idx, 'notes', e.target.value)
                          }
                          className="flex-1 text-xs border border-[#fca5a5] rounded-lg px-3 py-1.5 bg-white text-[#1d1d1f]"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#86868b]">Cobrança de Reposição:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.penaltyFee}
                            onChange={(e) =>
                              handleChecklistUpdate(
                                idx,
                                'penaltyFee' as any,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24 text-xs font-bold text-[#b91c1c] border border-[#fca5a5] rounded-lg px-2 py-1 bg-white text-center"
                          />
                        </div>
                      </div>
                    )}

                    {!isTotalValid && (
                      <p className="text-[11px] text-[#dc2626] font-medium mt-2">
                        ⚠️ Atenção: A soma dos itens ({Number(item.returnedQty) + Number(item.brokenQty) + Number(item.lostQty)}) não confere com o total locado ({item.totalRented}).
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Opções Financeiras de Avaria */}
            {checklist.some((i) => i.brokenQty > 0 || i.lostQty > 0) && (
              <div className="my-4 p-4 rounded-2xl bg-[#feeceb] border border-[#ffdcd9] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-[#991b1b]">
                    Total de Avarias / Quebras a Cobrar:
                  </span>
                  <span className="text-lg font-extrabold text-[#991b1b]">
                    R${' '}
                    {checklist
                      .reduce((acc, i) => acc + Number(i.penaltyFee || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#fca5a5]/40 text-xs">
                  <p className="font-semibold text-[#7f1d1d] mb-1.5">Como proceder com a cobrança?</p>
                  <div className="space-y-1.5">
                    {Number(inspectingRental.security_deposit) > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chargeOption"
                          value="deposit_deduct"
                          checked={chargeOption === 'deposit_deduct'}
                          onChange={() => setChargeOption('deposit_deduct')}
                        />
                        <span>
                          Abater da Caução de Garantia (Caução disponível: R${' '}
                          {Number(inspectingRental.security_deposit).toFixed(2)})
                        </span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chargeOption"
                        value="financial_charge"
                        checked={chargeOption === 'financial_charge'}
                        onChange={() => setChargeOption('financial_charge')}
                      />
                      <span>
                        Lançar cobrança a receber no Financeiro (Conta a Receber em nome do cliente)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chargeOption"
                        value="none"
                        checked={chargeOption === 'none'}
                        onChange={() => setChargeOption('none')}
                      />
                      <span>Não cobrar indenização do cliente (cortesia / tolerância)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Rodapé e Confirmação */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-4 border-t border-[#f2f2f7]">
              <div className="text-xs text-[#6e6e73]">
                {checklist.some((i) => i.brokenQty > 0 || i.lostQty > 0) ? (
                  <span className="text-[#b91c1c] font-semibold flex items-center gap-1">
                    <AlertTriangle size={14} /> Quebras/perdas identificadas nesta devolução.
                  </span>
                ) : (
                  <span className="text-[#166534] font-semibold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Todos os itens retornaram íntegros ao estoque.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingRental(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Processando Devolução...' : 'Confirmar Devolução e Retornar ao Estoque'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Romaneio / Comprovante de Locação para Impressão */}
      {printingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:bg-white print:fixed print:inset-0 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl border border-[#e5e5ea] print:border-none print:shadow-none print:p-4 max-h-[95vh] overflow-y-auto">
            {/* Barra Superior com Botão Imprimir */}
            <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea] print:hidden">
              <span className="text-xs font-semibold text-[#86868b]">
                Visualização do Romaneio / Contrato de Locação
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] text-white px-4 py-1.5 text-xs font-semibold hover:bg-[#333336] transition-colors cursor-pointer"
                >
                  <Printer size={14} /> Imprimir Romaneio
                </button>
                <button
                  onClick={() => setPrintingRental(null)}
                  className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conteúdo Imprimível do Romaneio */}
            <div className="pt-4 text-[#1d1d1f]">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between border-b border-[#e5e5ea] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white font-bold text-base shadow-xs">
                      <span className="text-[#d4af37]">L</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[#1d1d1f]">
                        Luh Recepções & Buffet
                      </h2>
                      <p className="text-[11px] text-[#6e6e73]">
                        Locação de Louças, Materiais & Mobiliário para Eventos
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block font-mono text-sm font-bold bg-[#f5f5f7] border border-[#e5e5ea] px-3 py-1 rounded-lg">
                    {printingRental.rental_code}
                  </span>
                  <p className="text-[11px] text-[#86868b] mt-1">
                    Emitido em: {new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Dados do Locatário */}
              <div className="grid grid-cols-2 gap-4 my-4 p-4 rounded-xl bg-[#fbfbfd] border border-[#f0f0f2] text-xs">
                <div>
                  <p className="font-bold text-[#1d1d1f] mb-1">DADOS DO LOCATÁRIO (CLIENTE):</p>
                  <p><strong>Nome:</strong> {printingRental.contacts?.name || 'Não informado'}</p>
                  <p><strong>CPF/CNPJ:</strong> {printingRental.contacts?.document || 'Não informado'}</p>
                  <p><strong>Telefone:</strong> {printingRental.contacts?.phone || 'Não informado'}</p>
                </div>
                <div>
                  <p className="font-bold text-[#1d1d1f] mb-1">LOGÍSTICA & DATAS:</p>
                  <p><strong>Saída/Retirada:</strong> {new Date(printingRental.start_date).toLocaleString('pt-BR')}</p>
                  <p><strong>Devolução Prevista:</strong> {new Date(printingRental.return_date).toLocaleString('pt-BR')}</p>
                  <p><strong>Modalidade:</strong> {printingRental.delivery_type === 'pickup' ? 'Retirada no Local' : 'Entrega no Endereço'}</p>
                  {printingRental.delivery_address && (
                    <p><strong>Endereço:</strong> {printingRental.delivery_address}</p>
                  )}
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="my-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] mb-2">
                  Materiais e Itens Locados
                </h4>
                <table className="w-full text-xs border border-[#e5e5ea] rounded-xl overflow-hidden">
                  <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea] text-left">
                    <tr>
                      <th className="p-2.5 font-semibold text-[#6e6e73]">Item / Descrição</th>
                      <th className="p-2.5 font-semibold text-[#6e6e73] text-center">SKU</th>
                      <th className="p-2.5 font-semibold text-[#6e6e73] text-center">Qtd</th>
                      <th className="p-2.5 font-semibold text-[#6e6e73] text-right">Valor Un.</th>
                      <th className="p-2.5 font-semibold text-[#6e6e73] text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f2f7]">
                    {(printingRental.rental_items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium">{it.products?.name || 'Item'}</td>
                        <td className="p-2.5 text-center text-[#86868b]">{it.products?.sku || '-'}</td>
                        <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                        <td className="p-2.5 text-right">R$ {Number(it.unit_price).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-semibold">R$ {Number(it.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Quadro de Valores */}
              <div className="flex justify-end my-4">
                <div className="w-64 space-y-1.5 text-xs bg-[#fbfbfd] p-3.5 rounded-xl border border-[#e5e5ea]">
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">Total Itens:</span>
                    <span>R$ {Number(printingRental.items_total || 0).toFixed(2)}</span>
                  </div>
                  {Number(printingRental.delivery_fee) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#6e6e73]">Taxa de Entrega:</span>
                      <span>R$ {Number(printingRental.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(printingRental.security_deposit) > 0 && (
                    <div className="flex justify-between text-[#b45309]">
                      <span>Caução Retida:</span>
                      <span>R$ {Number(printingRental.security_deposit).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-[#e5e5ea] text-[#1d1d1f]">
                    <span>Total da Locação:</span>
                    <span>R$ {Number(printingRental.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Cláusula de Responsabilidade e Quebras */}
              <div className="my-4 p-3.5 rounded-xl bg-[#fafafa] border border-[#e5e5ea] text-[11px] text-[#6e6e73] leading-relaxed">
                <p className="font-bold text-[#1d1d1f] mb-1">
                  TERMO DE RESPONSABILIDADE E CONSERVAÇÃO DOS MATERIAIS:
                </p>
                O Locatário declara ter recebido todos os materiais discriminados acima limpos, higienizados e em perfeito estado de conservação. Compromete-se a devolvê-los nas mesmas condições na data acordada. Em caso de quebra, avaria, lasca, queima, mancha irreparável ou extravio de qualquer material, o Locatário compromete-se a ressarcir o Locador pelo valor de reposição de mercado de cada unidade.
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-10 mt-6 text-center text-xs">
                <div className="border-t border-[#1d1d1f] pt-2">
                  <p className="font-semibold text-[#1d1d1f]">Luh Recepções & Eventos</p>
                  <p className="text-[10px] text-[#86868b]">Locador</p>
                </div>
                <div className="border-t border-[#1d1d1f] pt-2">
                  <p className="font-semibold text-[#1d1d1f]">
                    {printingRental.contacts?.name || 'Cliente / Locatário'}
                  </p>
                  <p className="text-[10px] text-[#86868b]">Assinatura do Locatário</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
