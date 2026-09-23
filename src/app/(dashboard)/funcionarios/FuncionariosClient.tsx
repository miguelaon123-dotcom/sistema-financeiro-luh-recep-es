'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserCheck,
  Search,
  Plus,
  DollarSign,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
  Calendar,
  AlertCircle,
  Briefcase,
  KeyRound,
  Info,
  UsersRound,
  Tag,
  Settings,
  Sparkles,
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  CalendarCheck,
  FileText,
  Send,
  Share2,
  ArrowRight,
  TrendingUp,
  BadgeDollarSign,
  ChevronDown,
} from 'lucide-react'
import {
  createEmployee,
  updateEmployee,
  toggleEmployeeActive,
  deleteEmployee,
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
  payStaffDailyRate,
  payAllEmployeeDailyRates,
  revertStaffDailyPayment,
  createProlabore,
  updateProlabore,
  deleteProlabore,
  payProlabore,
  revertProlabore,
  createWorkEntry,
  payWorkEntry,
  payAllWorkEntriesForEmployee,
  revertWorkEntryPayment,
  deleteWorkEntry,
  WorkEntryData,
} from './actions'
import { useConfirm } from '@/components/ConfirmDialog'

export interface EmployeeRole {
  id: string
  name: string
  default_daily_rate: number
  description?: string | null
}

interface Employee {
  id: string
  name: string
  role: string
  phone?: string | null
  document?: string | null
  pix_key?: string | null
  default_daily_rate: number
  active: boolean
  notes?: string | null
  created_at: string
}

interface StaffAssignment {
  id: string
  event_id: string
  employee_id: string
  role: string
  daily_rate: number
  status: string
  payment_status?: 'pending' | 'paid'
  paid_at?: string | null
  events?: { id: string; title: string; event_date: string } | null
}

interface Prolabore {
  id: string
  employee_id: string
  competencia: string   // 'YYYY-MM'
  amount: number
  description?: string | null
  payment_status: 'pending' | 'paid'
  paid_at?: string | null
  created_at: string
}

export function FuncionariosClient({
  employees = [],
  staffAssignments = [],
  roles = [],
  prolabores = [],
  workEntries = [],
  tableCreatedInDb = true,
}: {
  employees: Employee[]
  staffAssignments: StaffAssignment[]
  roles?: EmployeeRole[]
  prolabores?: Prolabore[]
  workEntries?: WorkEntryData[]
  tableCreatedInDb?: boolean
}) {
  const router = useRouter()
  const [localEmployees, setLocalEmployees] = useState<Employee[]>(employees)
  const [localRoles, setLocalRoles] = useState<EmployeeRole[]>(roles)
  const [localStaffAssignments, setLocalStaffAssignments] = useState<StaffAssignment[]>(staffAssignments)
  const [localProlabores, setLocalProlabores] = useState<Prolabore[]>(prolabores)
  const [localWorkEntries, setLocalWorkEntries] = useState<WorkEntryData[]>(workEntries)

  useEffect(() => {
    setLocalEmployees(employees)
  }, [employees])

  useEffect(() => {
    setLocalRoles(roles)
  }, [roles])

  useEffect(() => {
    setLocalStaffAssignments(staffAssignments)
  }, [staffAssignments])

  useEffect(() => {
    setLocalProlabores(prolabores)
  }, [prolabores])

  useEffect(() => {
    setLocalWorkEntries(workEntries)
  }, [workEntries])

  // Navegação por abas: Equipe | Folha & Acertos | Pró-Labore
  const [mainTab, setMainTab] = useState<'colaboradores' | 'folha' | 'prolabore'>('colaboradores')

  // Detecta se a URL veio com ?tab=prolabore ou #prolabore
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const tabFromQuery = searchParams.get('tab')
      const tabFromHash = window.location.hash.replace('#', '')
      if (tabFromQuery === 'prolabore' || tabFromHash === 'prolabore') {
        setMainTab('prolabore')
      } else if (tabFromQuery === 'folha' || tabFromHash === 'folha') {
        setMainTab('folha')
      }
    }
  }, [])

  // Estado do modal de Lançar Dias Trabalhados
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false)
  const [workEmployeeId, setWorkEmployeeId] = useState<string>('')
  const [workDays, setWorkDays] = useState<number | string>(1)
  const [workDailyRate, setWorkDailyRate] = useState<number | string>(150)
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [workDescription, setWorkDescription] = useState<string>('')
  const [workPaymentStatus, setWorkPaymentStatus] = useState<'pending' | 'paid'>('pending')
  const [workFormError, setWorkFormError] = useState<string | null>(null)

  // Estado do modal de pró-labore
  const [isProlaboreModalOpen, setIsProlaboreModalOpen] = useState(false)
  const [editingProlabore, setEditingProlabore] = useState<Prolabore | null>(null)
  const [prolaboreEmployee, setProlaboreEmployee] = useState<Employee | null>(null)
  const [prolaboreFormError, setProlaboreFormError] = useState<string | null>(null)
  const [statementEmployee, setStatementEmployee] = useState<Employee | null>(null)
  const [copiedReceipt, setCopiedReceipt] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  
  // Estado para modal de gerenciamento de Funções / Categorias
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<EmployeeRole | null>(null)
  const [roleFormError, setRoleFormError] = useState<string | null>(null)
  const [roleActionLoadingId, setRoleActionLoadingId] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  // Estado para valor padrão ao trocar a função no formulário de funcionário
  const [selectedRoleDailyRate, setSelectedRoleDailyRate] = useState<number | null>(null)

  // Copiar chave PIX
  const handleCopyPix = (id: string, pixKey: string) => {
    navigator.clipboard.writeText(pixKey)
    setCopiedPixId(id)
    setTimeout(() => setCopiedPixId(null), 2000)
  }

  // Cálculos da Folha & Acerto de Diárias (apenas colaboradores cadastrados)
  const employeeIdSet = new Set(localEmployees.map((e) => e.id))
  const pendingStaffAssignments = localStaffAssignments.filter(
    (a) => a.payment_status !== 'paid' && employeeIdSet.has(a.employee_id)
  )
  const paidStaffAssignments = localStaffAssignments.filter(
    (a) => a.payment_status === 'paid' && employeeIdSet.has(a.employee_id)
  )

  const pendingWorkEntriesList = localWorkEntries.filter(
    (w) => w.payment_status !== 'paid' && employeeIdSet.has(w.employee_id)
  )
  const paidWorkEntriesList = localWorkEntries.filter(
    (w) => w.payment_status === 'paid' && employeeIdSet.has(w.employee_id)
  )

  const pendingDailyRatesTotal =
    pendingStaffAssignments.reduce((acc, a) => acc + Number(a.daily_rate || 0), 0) +
    pendingWorkEntriesList.reduce((acc, w) => acc + Number(w.total_amount || 0), 0)

  const paidDailyRatesTotal =
    paidStaffAssignments.reduce((acc, a) => acc + Number(a.daily_rate || 0), 0) +
    paidWorkEntriesList.reduce((acc, w) => acc + Number(w.total_amount || 0), 0)

  const employeeIdsWithPending = new Set([
    ...pendingStaffAssignments.map((a) => a.employee_id),
    ...pendingWorkEntriesList.map((w) => w.employee_id),
  ])
  const pendingEmployeesCount = employeeIdsWithPending.size

  // Resumo financeiro consolidado por colaborador
  const getEmployeeFinancials = (employeeId: string) => {
    const list = localStaffAssignments.filter((a) => a.employee_id === employeeId)
    const pendingList = list.filter((a) => a.payment_status !== 'paid')
    const paidList = list.filter((a) => a.payment_status === 'paid')
    const staffPending = pendingList.reduce((acc, a) => acc + Number(a.daily_rate || 0), 0)
    const staffPaid = paidList.reduce((acc, a) => acc + Number(a.daily_rate || 0), 0)

    const workList = localWorkEntries.filter((w) => w.employee_id === employeeId)
    const pendingWork = workList.filter((w) => w.payment_status !== 'paid')
    const paidWork = workList.filter((w) => w.payment_status === 'paid')
    const workPending = pendingWork.reduce((acc, w) => acc + Number(w.total_amount || 0), 0)
    const workPaid = paidWork.reduce((acc, w) => acc + Number(w.total_amount || 0), 0)

    const totalDaysWorked =
      workList.reduce((acc, w) => acc + Number(w.days_worked || 0), 0) + list.length
    const pendingDaysWorked =
      pendingWork.reduce((acc, w) => acc + Number(w.days_worked || 0), 0) + pendingList.length

    const totalPending = staffPending + workPending
    const totalPaid = staffPaid + workPaid

    return {
      list,
      pendingList,
      paidList,
      workList,
      pendingWork,
      paidWork,
      totalDaysWorked,
      pendingDaysWorked,
      totalPending,
      totalPaid,
      totalEvents: list.length + workList.length,
    }
  }

  // Ações de Lançamento de Dias Trabalhados
  const openWorkModal = (emp?: Employee) => {
    setWorkFormError(null)
    if (emp) {
      setWorkEmployeeId(emp.id)
      setWorkDailyRate(emp.default_daily_rate > 0 ? emp.default_daily_rate : 150)
    } else if (localEmployees.length > 0) {
      setWorkEmployeeId(localEmployees[0].id)
      setWorkDailyRate(localEmployees[0].default_daily_rate > 0 ? localEmployees[0].default_daily_rate : 150)
    }
    setWorkDays(1)
    setWorkDate(new Date().toISOString().split('T')[0])
    setWorkDescription('')
    setWorkPaymentStatus('pending')
    setIsWorkModalOpen(true)
  }

  const handleWorkEmployeeChange = (empId: string) => {
    setWorkEmployeeId(empId)
    const found = localEmployees.find((e) => e.id === empId)
    if (found && found.default_daily_rate > 0) {
      setWorkDailyRate(found.default_daily_rate)
    }
  }

  const handleWorkSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setWorkFormError(null)

    const numDays = Number(workDays)
    const numRate = Number(workDailyRate)

    if (!workEmployeeId) {
      setWorkFormError('Selecione o colaborador.')
      return
    }
    if (isNaN(numDays) || numDays <= 0) {
      setWorkFormError('Informe a quantidade de dias trabalhados válida.')
      return
    }
    if (isNaN(numRate) || numRate <= 0) {
      setWorkFormError('Informe o valor da diária válido.')
      return
    }

    const form = e.currentTarget
    const formData = new FormData(form)

    const emp = localEmployees.find((x) => x.id === workEmployeeId)
    const empName = emp?.name || 'Colaborador'
    const empRole = emp?.role || ''
    const totalAmount = Number((numDays * numRate).toFixed(2))

    // Atualização otimista
    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()
    const optimisticEntry: WorkEntryData = {
      id: tempId,
      employee_id: workEmployeeId,
      employee_name: empName,
      role: empRole,
      days_worked: numDays,
      daily_rate: numRate,
      total_amount: totalAmount,
      date: workDate,
      description: workDescription || null,
      payment_status: workPaymentStatus,
      paid_at: workPaymentStatus === 'paid' ? now : null,
      created_at: now,
    }
    setLocalWorkEntries((prev) => [optimisticEntry, ...prev])
    setIsWorkModalOpen(false)

    startTransition(async () => {
      const res = await createWorkEntry(formData)
      if (res?.error) {
        alert(res.error)
      }
      router.refresh()
    })
  }

  const handlePayWorkEntry = (entryId: string, amount: number, empName: string) => {
    confirm(`Deseja confirmar o pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${empName}? O valor será descontado do Saldo em Caixa no Financeiro.`).then(ok => {
      if (!ok) return
      setActionLoadingId(entryId)
      setLocalWorkEntries((prev) =>
        prev.map((w) => (w.id === entryId ? { ...w, payment_status: 'paid', paid_at: new Date().toISOString() } : w))
      )
      startTransition(async () => {
        const res = await payWorkEntry(entryId)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleRevertWorkEntry = (entryId: string) => {
    confirm('Deseja estornar este pagamento e retornar para pendente? O valor será recomposto no financeiro.').then(ok => {
      if (!ok) return
      setActionLoadingId(entryId)
      setLocalWorkEntries((prev) =>
        prev.map((w) => (w.id === entryId ? { ...w, payment_status: 'pending', paid_at: null } : w))
      )
      startTransition(async () => {
        const res = await revertWorkEntryPayment(entryId)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleDeleteWorkEntry = (entryId: string) => {
    confirm('Deseja realmente excluir este lançamento de dias trabalhados?').then(ok => {
      if (!ok) return
      setActionLoadingId(entryId)
      setLocalWorkEntries((prev) => prev.filter((w) => w.id !== entryId))
      startTransition(async () => {
        const res = await deleteWorkEntry(entryId)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  // Ações de Pagamento de Diárias (Eventos)
  const handlePaySingleDaily = (assignmentId: string) => {
    setActionLoadingId(assignmentId)
    setLocalStaffAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, payment_status: 'paid', paid_at: new Date().toISOString() } : a))
    )
    startTransition(async () => {
      const res = await payStaffDailyRate(assignmentId)
      if (res?.error) alert(res.error)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  const handlePayAllDailies = (employeeId: string) => {
    const fin = getEmployeeFinancials(employeeId)
    confirm(`Deseja confirmar o pagamento de todas as diárias pendentes deste colaborador (Total: R$ ${fin.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) e descontar no Saldo em Caixa?`).then(ok => {
      if (!ok) return
      setActionLoadingId(employeeId)
      setLocalStaffAssignments((prev) =>
        prev.map((a) => (a.employee_id === employeeId ? { ...a, payment_status: 'paid', paid_at: new Date().toISOString() } : a))
      )
      setLocalWorkEntries((prev) =>
        prev.map((w) => (w.employee_id === employeeId ? { ...w, payment_status: 'paid', paid_at: new Date().toISOString() } : w))
      )
      startTransition(async () => {
        const [r1, r2] = await Promise.all([
          payAllEmployeeDailyRates(employeeId),
          payAllWorkEntriesForEmployee(employeeId),
        ])
        if (r1?.error && !r1.error.includes('Não há')) alert(r1.error)
        if (r2?.error && !r2.error.includes('Não há')) alert(r2.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleRevertPayment = (assignmentId: string) => {
    confirm('Deseja estornar e reabrir o pagamento desta diária?').then(ok => {
      if (!ok) return
      setActionLoadingId(assignmentId)
      setLocalStaffAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, payment_status: 'pending', paid_at: null } : a))
      )
      startTransition(async () => {
        await revertStaffDailyPayment(assignmentId)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  // Gerador de Recibo de Diárias para WhatsApp
  const handleCopyWhatsAppReceipt = (employee: Employee) => {
    const { list, workList, totalPaid, totalPending, totalDaysWorked } = getEmployeeFinancials(employee.id)
    let msg = `🧾 *Luh Recepções & Buffet - Extrato de Diárias e Trabalho*\n`
    msg += `👤 *Colaborador(a):* ${employee.name}\n`
    msg += `💼 *Função:* ${employee.role}\n`
    if (employee.pix_key) {
      msg += `🔑 *Chave PIX:* ${employee.pix_key}\n`
    }
    msg += `📊 *Total de Dias Trabalhados:* ${totalDaysWorked} dias\n`

    if (workList && workList.length > 0) {
      msg += `\n🗓️ *Dias Trabalhados Lançados (${workList.length}):*\n`
      workList.forEach((w, i) => {
        const dateStr = w.date
          ? new Date(w.date + 'T00:00:00').toLocaleDateString('pt-BR')
          : 'Data não informada'
        const statusIcon = w.payment_status === 'paid' ? '✅ Pago' : '⏳ Pendente'
        const descStr = w.description ? ` (${w.description})` : ''
        msg += `${i + 1}. ${dateStr}${descStr}: ${w.days_worked} dias × R$ ${Number(w.daily_rate).toFixed(2)} = R$ ${Number(w.total_amount).toFixed(2)} [${statusIcon}]\n`
      })
    }

    if (list && list.length > 0) {
      msg += `\n🎉 *Eventos Trabalhados (${list.length}):*\n`
      list.forEach((a, i) => {
        const dateStr = a.events?.event_date
          ? new Date(a.events.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
          : 'Data não informada'
        const statusIcon = a.payment_status === 'paid' ? '✅ Pago' : '⏳ Pendente'
        msg += `${i + 1}. ${dateStr} - ${a.events?.title || 'Festa'} (${a.role}): R$ ${Number(a.daily_rate).toFixed(2)} [${statusIcon}]\n`
      })
    }

    msg += `\n💰 *Total Liquidado:* R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    if (totalPending > 0) {
      msg += `⏳ *Saldo a Receber:* R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    }
    msg += `\nMuito obrigado pelo seu excelente trabalho e dedicação! 🎉`

    navigator.clipboard.writeText(msg)
    setCopiedReceipt(true)
    setTimeout(() => setCopiedReceipt(false), 2500)
  }

  // Filtragem
  const filteredEmployees = localEmployees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = filterRole === 'all' || emp.role.toLowerCase() === filterRole.toLowerCase()
    return matchesSearch && matchesRole
  })

  // Salvar Colaborador com Atualização Imediata
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingEmployee
        ? await updateEmployee(formData)
        : await createEmployee(formData)

      if (res?.error) {
        setFormError(res.error)
      } else {
        setIsModalOpen(false)
        setEditingEmployee(null)
        form.reset()
        router.refresh()
      }
    })
  }

  // Alternar Ativo/Inativo Instantâneo
  const handleToggleActive = (emp: Employee) => {
    setActionLoadingId(emp.id)
    // Atualização otimista imediata na tela
    setLocalEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e))
    )
    startTransition(async () => {
      await toggleEmployeeActive(emp.id, !emp.active)
      setActionLoadingId(null)
      router.refresh()
    })
  }

  // Excluir Colaborador Instantâneo
  const handleDelete = (id: string, name: string) => {
    confirm(`Deseja realmente excluir o colaborador "${name}"?`).then(ok => {
      if (!ok) return
      setActionLoadingId(id)
      setLocalEmployees((prev) => prev.filter((e) => e.id !== id))
      startTransition(async () => {
        await deleteEmployee(id)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  // Salvar Função / Categoria Instantâneo
  const handleRoleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setRoleFormError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    const name = (formData.get('name') as string)?.trim()
    const rate = Number(formData.get('default_daily_rate')) || 150
    const desc = (formData.get('description') as string)?.trim() || null

    if (!name) {
      setRoleFormError('O nome da função é obrigatório.')
      return
    }

    // Atualização otimista imediata na interface
    if (editingRole) {
      setLocalRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? { ...r, name, default_daily_rate: rate, description: desc }
            : r
        )
      )
    } else {
      const tempId = crypto.randomUUID()
      setLocalRoles((prev) => [
        ...prev,
        { id: tempId, name, default_daily_rate: rate, description: desc },
      ])
    }

    startTransition(async () => {
      const res = editingRole
        ? await updateEmployeeRole(formData)
        : await createEmployeeRole(formData)

      if (res?.error) {
        setRoleFormError(res.error)
      } else {
        setEditingRole(null)
        form.reset()
        router.refresh()
      }
    })
  }

  // Excluir Função / Categoria Instantâneo
  const handleDeleteRole = (id: string, name: string) => {
    confirm(`Deseja realmente excluir a função/categoria "${name}"?`).then(ok => {
      if (!ok) return
      setRoleActionLoadingId(id)
      setLocalRoles((prev) => prev.filter((r) => r.id !== id))
      startTransition(async () => {
        await deleteEmployeeRole(id)
        setRoleActionLoadingId(null)
        if (editingRole?.id === id) setEditingRole(null)
        router.refresh()
      })
    })
  }

  // ─── Pró-Labore Handlers ───────────────────────────────────────────────────
  const prolaborePending = localProlabores.filter((p) => p.payment_status !== 'paid')
  const prolaborePaid    = localProlabores.filter((p) => p.payment_status === 'paid')
  const prolaborePendingTotal = prolaborePending.reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const prolaborePaidTotal    = prolaborePaid.reduce((acc, p) => acc + Number(p.amount || 0), 0)

  const formatCompetencia = (comp: string) => {
    const [year, month] = comp.split('-')
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${monthNames[parseInt(month, 10) - 1] || month}/${year}`
  }

  const currentCompetencia = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const handleOpenProlaboreModal = (emp: Employee, existing?: Prolabore) => {
    setProlaboreEmployee(emp)
    setEditingProlabore(existing || null)
    setProlaboreFormError(null)
    setIsProlaboreModalOpen(true)
  }

  const handleProlaboreSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setProlaboreFormError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = editingProlabore
        ? await updateProlabore(formData)
        : await createProlabore(formData)

      if (res?.error) {
        setProlaboreFormError(res.error)
      } else {
        setIsProlaboreModalOpen(false)
        setEditingProlabore(null)
        setProlaboreEmployee(null)
        form.reset()
        router.refresh()
      }
    })
  }

  const handlePayProlabore = (id: string) => {
    confirm('Confirmar pagamento do pró-labore e lançar no Financeiro como despesa?').then(ok => {
      if (!ok) return
      setActionLoadingId(id)
      setLocalProlabores((prev) =>
        prev.map((p) => p.id === id ? { ...p, payment_status: 'paid', paid_at: new Date().toISOString() } : p)
      )
      startTransition(async () => {
        const res = await payProlabore(id)
        if (res?.error) alert(res.error)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleRevertProlabore = (id: string) => {
    confirm('Deseja estornar este pró-labore e reabrir como pendente?').then(ok => {
      if (!ok) return
      setActionLoadingId(id)
      setLocalProlabores((prev) =>
        prev.map((p) => p.id === id ? { ...p, payment_status: 'pending', paid_at: null } : p)
      )
      startTransition(async () => {
        await revertProlabore(id)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const handleDeleteProlabore = (id: string) => {
    confirm('Deseja excluir este lançamento de pró-labore?').then(ok => {
      if (!ok) return
      setLocalProlabores((prev) => prev.filter((p) => p.id !== id))
      startTransition(async () => {
        await deleteProlabore(id)
        router.refresh()
      })
    })
  }

  // Estatísticas
  const activeCount = localEmployees.filter((e) => e.active).length
  const avgDailyRate =
    localEmployees.length > 0
      ? localEmployees.reduce((acc, e) => acc + Number(e.default_daily_rate || 0), 0) / localEmployees.length
      : 0

  return (
    <div className="space-y-6">
      <ConfirmDialog />
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
                O cadastro e escalas de funcionários já estão 100% operacionais com a regra anti-conflito!
                Para habilitar as tabelas nativas de alta performance no Supabase, execute o script{' '}
                <code className="bg-[#ffedd5] px-1.5 py-0.5 rounded font-mono text-[11px]">
                  supabase/migration_funcionarios_e_escalas.sql
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
            Gestão de Equipe & Colaboradores
          </h1>
          <p className="text-sm text-[#6e6e73]">
            Cadastro de garçons, cozinheiros e equipe para escalas em festas com bloqueio anti-conflito.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openWorkModal()}
            className="flex items-center space-x-1.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2 text-xs font-semibold text-[#166534] hover:bg-[#dcfce7] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <CalendarCheck size={14} className="text-[#16a34a]" />
            <span>+ Lançar Dias Trabalhados</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingRole(null)
              setRoleFormError(null)
              setIsRolesModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Tag size={14} className="text-[#86868b]" />
            <span>Funções & Categorias ({localRoles.length})</span>
          </button>

          <button
            onClick={() => {
              setEditingEmployee(null)
              setFormError(null)
              setSelectedRoleDailyRate(null)
              setIsModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>Novo Colaborador</span>
          </button>
        </div>
      </div>

      {/* Abas Principais em estilo Segmented Control de Alta Visibilidade */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#e5e5ea] pb-3 gap-3">
        <div className="inline-flex p-1 bg-[#f2f2f7] rounded-2xl gap-1 border border-[#e5e5ea] max-w-full overflow-x-auto shadow-inner">
          <button
            type="button"
            onClick={() => {
              setMainTab('colaboradores')
              if (typeof window !== 'undefined') window.history.replaceState(null, '', '?tab=colaboradores')
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === 'colaboradores'
                ? 'bg-white text-[#1d1d1f] shadow-sm font-bold'
                : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
            }`}
          >
            <UsersRound size={15} />
            <span>Equipe & Funções</span>
            <span className="rounded-full bg-[#e5e5ea] px-2 py-0.5 text-[11px] text-[#1d1d1f] font-medium">
              {localEmployees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainTab('folha')
              if (typeof window !== 'undefined') window.history.replaceState(null, '', '?tab=folha')
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === 'folha'
                ? 'bg-white text-[#1d1d1f] shadow-sm font-bold'
                : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
            }`}
          >
            <Wallet size={15} />
            <span>Acerto de Diárias</span>
            {pendingDailyRatesTotal > 0 ? (
              <span className="rounded-full bg-[#fef3c7] text-[#b45309] font-bold px-2 py-0.5 text-[10px]">
                R$ {pendingDailyRatesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="rounded-full bg-[#e8f8ee] text-[#1a7f37] font-semibold px-2 py-0.5 text-[10px]">
                ✓ Em dia
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMainTab('prolabore')
              if (typeof window !== 'undefined') window.history.replaceState(null, '', '?tab=prolabore')
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              mainTab === 'prolabore'
                ? 'bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/25'
                : 'text-[#6e6e73] hover:text-[#7c3aed] hover:bg-white/60'
            }`}
          >
            <BadgeDollarSign size={15} className={mainTab === 'prolabore' ? 'text-white' : 'text-[#7c3aed]'} />
            <span>Pró-Labore</span>
            {prolaborePendingTotal > 0 ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                mainTab === 'prolabore' ? 'bg-white text-[#7c3aed]' : 'bg-[#f3e8ff] text-[#7c3aed]'
              }`}>
                R$ {prolaborePendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                mainTab === 'prolabore' ? 'bg-white/20 text-white' : 'bg-[#f3e8ff] text-[#7c3aed]'
              }`}>
                Novo
              </span>
            )}
          </button>
        </div>

        {mainTab === 'prolabore' && localEmployees.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenProlaboreModal(localEmployees[0])}
              className="flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>Lançar Pró-Labore</span>
            </button>
          </div>
        )}
      </div>

      {/* ABA 1: COLABORADORES & EQUIPE */}
      {mainTab === 'colaboradores' && (
        <div className="space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-[#86868b]">Total de Colaboradores</p>
              <p className="text-xl font-bold text-[#1d1d1f] mt-1">{localEmployees.length}</p>
            </div>
            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-[#86868b]">Colaboradores Ativos para Escala</p>
              <p className="text-xl font-bold text-[#1a7f37] mt-1">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-[#86868b]">Média de Diária Padrão</p>
              <p className="text-xl font-bold text-[#b8860b] mt-1">
                R$ {avgDailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  placeholder="Buscar por nome ou função..."
                  className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto max-w-full">
                <button
                  onClick={() => setFilterRole('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterRole === 'all'
                      ? 'bg-white text-[#1d1d1f] shadow-xs'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  Todos ({localEmployees.length})
                </button>
                {localRoles.map((r) => (
                  <button
                    key={r.id || r.name}
                    onClick={() => setFilterRole(r.name)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      filterRole.toLowerCase() === r.name.toLowerCase()
                        ? 'bg-white text-[#1d1d1f] shadow-xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Cards de Funcionários */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const eventsCount = localStaffAssignments.filter((s) => s.employee_id === emp.id).length
                  const fin = getEmployeeFinancials(emp.id)

                  return (
                    <div
                      key={emp.id}
                      className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                        emp.active
                          ? 'border-[#e5e5ea] bg-white hover:border-[#1d1d1f]/30 hover:shadow-xs'
                          : 'border-[#f2f2f7] bg-[#fafafa] opacity-75'
                      }`}
                    >
                      <div>
                        {/* Topo do Card */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#b8860b] bg-[#fffaf0] border border-[#fef3c7] px-2 py-0.5 rounded-md">
                              <Briefcase size={11} /> {emp.role}
                            </span>
                            <h3 className="font-bold text-base text-[#1d1d1f] mt-1.5 leading-snug">
                              {emp.name}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(emp)}
                            disabled={actionLoadingId === emp.id}
                            className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition-colors ${
                              emp.active
                                ? 'bg-[#e8f8ee] text-[#1a7f37] hover:bg-[#d5f3df]'
                                : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#e5e5ea]'
                            }`}
                            title="Clique para ativar ou inativar"
                          >
                            {emp.active ? 'Ativo na Escala' : 'Inativo'}
                          </button>
                        </div>

                        {/* Detalhes */}
                        <div className="space-y-2 text-xs text-[#6e6e73] my-3">
                          <p className="flex items-center gap-2 font-medium text-[#1d1d1f]">
                            <DollarSign size={13} className="text-[#b8860b]" />
                            <span>
                              Diária Padrão: <strong>R$ {Number(emp.default_daily_rate).toFixed(2)}</strong>
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar size={13} className="text-[#86868b]" />
                            <span>
                              Dias Trabalhados: <strong>{fin.totalDaysWorked} {fin.totalDaysWorked === 1 ? 'dia' : 'dias'}</strong>
                              {fin.pendingDaysWorked > 0 ? (
                                <span className="text-[#b45309] font-medium text-[11px] ml-1">({fin.pendingDaysWorked} pend.)</span>
                              ) : fin.totalDaysWorked > 0 ? (
                                <span className="text-[#15803d] font-medium text-[11px] ml-1">(quitado)</span>
                              ) : null}
                            </span>
                          </p>

                          {/* Resumo de Diárias / Acerto */}
                          <div className="pt-2 border-t border-[#f2f2f7] mt-2 flex flex-col gap-2 bg-[#fdfcf7] p-2.5 rounded-xl border border-[#f3e8c8]">
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] text-[#86868b] block font-medium">Acerto de Diárias:</span>
                                <span className={`font-bold text-xs ${fin.totalPending > 0 ? 'text-[#b45309]' : 'text-[#15803d]'}`}>
                                  {fin.totalPending > 0 ? `R$ ${fin.totalPending.toFixed(2)} a pagar` : '✓ Todas pagas'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openWorkModal(emp)}
                                  className="text-[11px] font-semibold text-[#166534] bg-[#dcfce7] hover:bg-[#bbf7d0] px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  title="Lançar dias trabalhados para este colaborador"
                                >
                                  <Plus size={11} strokeWidth={2.5} />
                                  <span>+ Dias</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatementEmployee(emp)}
                                  className="text-[11px] font-semibold text-[#0071e3] bg-[#ebf4fe] hover:bg-[#d0e5fc] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  Extrato
                                </button>
                              </div>
                            </div>
                            {fin.totalPending > 0 && (
                              <button
                                type="button"
                                onClick={() => handlePayAllDailies(emp.id)}
                                disabled={actionLoadingId === emp.id}
                                className="w-full text-center text-xs font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] py-1.5 px-3 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                <Check size={13} strokeWidth={2.5} />
                                <span>Pagar R$ {fin.totalPending.toFixed(2)} (Descontar no Saldo)</span>
                              </button>
                            )}
                          </div>

                          {/* Chave PIX com Cópia Rápida */}
                          {emp.pix_key && (
                            <div className="pt-2 border-t border-[#f2f2f7] mt-2 flex items-center justify-between text-xs bg-[#fbfbfd] p-2 rounded-xl border border-[#f0f0f2]">
                              <div className="truncate pr-2">
                                <span className="text-[10px] text-[#86868b] block font-medium">
                                  Chave PIX para Pagamento:
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-[#1d1d1f] truncate block">
                                  {emp.pix_key}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyPix(emp.id, emp.pix_key!)}
                                className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#f0f0f2] hover:text-[#1d1d1f] transition-colors cursor-pointer shrink-0"
                                title="Copiar chave PIX"
                              >
                                {copiedPixId === emp.id ? (
                                  <Check size={14} className="text-[#16a34a]" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações do Card */}
                      <div className="pt-3 border-t border-[#f2f2f7] flex justify-end items-center gap-1.5 text-xs mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEmployee(emp)
                            setFormError(null)
                            setIsModalOpen(true)
                          }}
                          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Editar Colaborador"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(emp.id, emp.name)}
                          disabled={actionLoadingId === emp.id}
                          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer"
                          title="Excluir Colaborador"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full py-12 text-center border border-dashed border-[#e5e5ea] rounded-2xl bg-[#fafafa]">
                  <UsersRound className="mx-auto h-8 w-8 text-[#86868b] mb-2 stroke-[1.5]" />
                  <p className="text-[#1d1d1f] font-medium text-sm">Nenhum colaborador encontrado</p>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    Cadastre garçons, cozinheiros e equipe para escalar em festas e eventos.
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-3 text-xs font-semibold text-[#1d1d1f] hover:underline cursor-pointer"
                  >
                    + Cadastrar primeiro colaborador
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: FOLHA & ACERTO DE DIÁRIAS */}
      {mainTab === 'folha' && (
        <div className="space-y-6">
          {/* Métricas da Folha */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[#fed7aa] bg-[#fffaf5] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#9a3412]">Diárias a Pagar (Pendente)</p>
                <Clock size={16} className="text-[#ea580c]" />
              </div>
              <p className="text-2xl font-bold text-[#7c2d12] mt-1.5">
                R$ {pendingDailyRatesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#c2410c] mt-0.5">
                {pendingEmployeesCount} {pendingEmployeesCount === 1 ? 'colaborador aguardando' : 'colaboradores aguardando'}
              </p>
            </div>

            <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#166534]">Diárias Já Liquidadas</p>
                <CheckCircle2 size={16} className="text-[#16a34a]" />
              </div>
              <p className="text-2xl font-bold text-[#14532d] mt-1.5">
                R$ {paidDailyRatesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#15803d] mt-0.5">
                {paidStaffAssignments.length} diárias pagas
              </p>
            </div>

            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#86868b]">Total de Colaboradores</p>
                <UsersRound size={16} className="text-[#1d1d1f]" />
              </div>
              <p className="text-2xl font-bold text-[#1d1d1f] mt-1.5">
                {localEmployees.length}
              </p>
              <p className="text-[11px] text-[#86868b] mt-0.5">
                {activeCount} ativos na escala
              </p>
            </div>

            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#86868b]">Total de Escalas</p>
                <CalendarCheck size={16} className="text-[#0071e3]" />
              </div>
              <p className="text-2xl font-bold text-[#1d1d1f] mt-1.5">
                {localStaffAssignments.length}
              </p>
              <p className="text-[11px] text-[#86868b] mt-0.5">
                participações em festas registradas
              </p>
            </div>
          </div>

          {/* Lista de Acertos por Colaborador */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">
                  Acerto de Diárias por Colaborador
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  Consolidação dos eventos trabalhados, valores a pagar e quitações via PIX integradas ao Financeiro.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => openWorkModal()}
                  className="flex items-center space-x-1.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2 text-xs font-semibold text-[#166534] hover:bg-[#dcfce7] transition-all shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
                >
                  <CalendarCheck size={14} className="text-[#16a34a]" />
                  <span>+ Lançar Dias Trabalhados</span>
                </button>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar colaborador..."
                    className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-xs text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Grid de Cards de Folha */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredEmployees.map((emp) => {
                const fin = getEmployeeFinancials(emp.id)

                return (
                  <div
                    key={emp.id}
                    className="rounded-2xl border border-[#e5e5ea] bg-white p-5 hover:border-[#1d1d1f]/30 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#b8860b] bg-[#fffaf0] border border-[#fef3c7] px-2 py-0.5 rounded-md">
                            <Briefcase size={11} /> {emp.role}
                          </span>
                          <h4 className="font-bold text-base text-[#1d1d1f] mt-1.5 leading-snug">
                            {emp.name}
                          </h4>
                        </div>

                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            fin.totalPending > 0
                              ? 'bg-[#fef3c7] text-[#b45309]'
                              : fin.totalDaysWorked > 0
                              ? 'bg-[#e8f8ee] text-[#1a7f37]'
                              : 'bg-[#f5f5f7] text-[#86868b]'
                          }`}
                        >
                          {fin.totalPending > 0
                            ? 'Saldo Pendente'
                            : fin.totalDaysWorked > 0
                            ? '✓ Quitado'
                            : 'Sem Lançamentos'}
                        </span>
                      </div>

                      {/* Dados Financeiros */}
                      <div className="space-y-2 text-xs text-[#6e6e73] my-3">
                        <div className="flex items-center justify-between p-2.5 bg-[#fbfbfd] rounded-xl border border-[#f2f2f7]">
                          <div>
                            <span className="text-[10px] text-[#86868b] block">Dias Trabalhados</span>
                            <span className="font-bold text-sm text-[#1d1d1f]">
                              {fin.totalDaysWorked} {fin.totalDaysWorked === 1 ? 'dia' : 'dias'}
                            </span>
                            {fin.pendingDaysWorked > 0 && (
                              <span className="text-[10px] text-[#b45309] font-medium block">
                                {fin.pendingDaysWorked} pendentes
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#86868b] block">Total a Pagar</span>
                            <span className={`font-bold text-sm ${fin.totalPending > 0 ? 'text-[#b45309]' : 'text-[#16a34a]'}`}>
                              R$ {fin.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Chave PIX */}
                        {emp.pix_key ? (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                            <div className="truncate pr-2">
                              <span className="text-[10px] text-[#86868b] block">Chave PIX:</span>
                              <span className="font-mono text-[11px] font-semibold text-[#1d1d1f] truncate block">
                                {emp.pix_key}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPix(emp.id, emp.pix_key!)}
                              className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#e5e5ea] hover:text-[#1d1d1f] transition-colors cursor-pointer shrink-0"
                              title="Copiar Chave PIX"
                            >
                              {copiedPixId === emp.id ? (
                                <Check size={14} className="text-[#16a34a]" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#86868b] italic">
                            Chave PIX não cadastrada
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ações de Pagamento */}
                    <div className="pt-3 border-t border-[#f2f2f7] flex flex-wrap items-center justify-between gap-2 text-xs mt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openWorkModal(emp)}
                          className="text-[11px] font-semibold text-[#166534] bg-[#dcfce7] hover:bg-[#bbf7d0] px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Lançar dias trabalhados para este colaborador"
                        >
                          <Plus size={12} strokeWidth={2.5} />
                          <span>Lançar Dias</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatementEmployee(emp)}
                          className="text-[11px] font-semibold text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FileText size={13} />
                          Extrato
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsAppReceipt(emp)}
                          className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Copiar Extrato WhatsApp"
                        >
                          <Share2 size={14} />
                        </button>

                        {fin.totalPending > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePayAllDailies(emp.id)}
                            disabled={actionLoadingId === emp.id}
                            className="text-[11px] font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check size={13} strokeWidth={2.5} />
                            Pagar R$ {fin.totalPending.toFixed(2)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Histórico Consolidado de Dias Trabalhados Lançados */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f] flex items-center gap-2">
                  <CalendarCheck size={18} className="text-[#0071e3]" />
                  <span>Histórico de Dias Trabalhados Lançados ({localWorkEntries.length})</span>
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  Registro avulso de dias trabalhados e multiplicação automática por diária com integração de pagamento ao Saldo em Caixa.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openWorkModal()}
                className="flex items-center space-x-1.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2 text-xs font-semibold text-[#166534] hover:bg-[#dcfce7] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Novo Lançamento de Dias</span>
              </button>
            </div>

            <div className="border border-[#e5e5ea] rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#f9f9fb] border-b border-[#f2f2f7] text-[#6e6e73] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Colaborador</th>
                    <th className="p-3 text-center">Dias Trab.</th>
                    <th className="p-3">Diária (R$)</th>
                    <th className="p-3">Total Calculado</th>
                    <th className="p-3">Descrição / Motivo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {localWorkEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#86868b]">
                        Nenhum lançamento avulso de dias trabalhados registrado ainda.
                        <button
                          type="button"
                          onClick={() => openWorkModal()}
                          className="block mx-auto mt-2 text-xs font-semibold text-[#0071e3] hover:underline cursor-pointer"
                        >
                          + Lançar primeiro dia trabalhado
                        </button>
                      </td>
                    </tr>
                  ) : (
                    localWorkEntries.map((w) => {
                      const dateStr = w.date
                        ? new Date(w.date + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'
                      const isPaid = w.payment_status === 'paid'

                      return (
                        <tr key={w.id} className="hover:bg-[#fbfbfd] transition-colors">
                          <td className="p-3 font-medium text-[#1d1d1f] whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-[#1d1d1f] block">{w.employee_name}</span>
                            <span className="text-[10px] text-[#86868b]">{w.role}</span>
                          </td>
                          <td className="p-3 text-center font-bold text-[#1d1d1f] whitespace-nowrap">
                            {w.days_worked} {w.days_worked === 1 ? 'dia' : 'dias'}
                          </td>
                          <td className="p-3 text-[#6e6e73] whitespace-nowrap">
                            R$ {Number(w.daily_rate).toFixed(2)}
                          </td>
                          <td className="p-3 font-bold text-[#1d1d1f] whitespace-nowrap">
                            R$ {Number(w.total_amount).toFixed(2)}
                          </td>
                          <td className="p-3 text-[#6e6e73] max-w-xs truncate">
                            {w.description || '—'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-[#dcfce7] text-[#15803d]'
                                  : 'bg-[#fef3c7] text-[#b45309]'
                              }`}
                            >
                              {isPaid ? '✓ Pago (Saldo)' : '⏳ Pendente'}
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevertWorkEntry(w.id)}
                                  disabled={actionLoadingId === w.id}
                                  className="text-[10px] font-semibold text-[#86868b] hover:text-[#cf222e] hover:underline cursor-pointer"
                                >
                                  Estornar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePayWorkEntry(w.id, w.total_amount, w.employee_name)}
                                  disabled={actionLoadingId === w.id}
                                  className="text-[10px] font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Check size={11} strokeWidth={2.5} />
                                  Pagar Diária
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteWorkEntry(w.id)}
                                disabled={actionLoadingId === w.id}
                                className="p-1 text-[#86868b] hover:text-[#cf222e] hover:bg-[#feeceb] rounded-md transition-colors cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PRÓ-LABORE */}
      {mainTab === 'prolabore' && (
        <div className="space-y-6">
          {/* Métricas do Pró-Labore */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#e9d5ff] bg-[#faf5ff] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#6d28d9]">Pró-Labore Pendente</p>
                <Clock size={16} className="text-[#7c3aed]" />
              </div>
              <p className="text-2xl font-bold text-[#4c1d95] mt-1.5">
                R$ {prolaborePendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#7c3aed] mt-0.5">
                {prolaborePending.length} {prolaborePending.length === 1 ? 'lançamento pendente' : 'lançamentos pendentes'}
              </p>
            </div>

            <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#166534]">Total Já Pago</p>
                <CheckCircle2 size={16} className="text-[#16a34a]" />
              </div>
              <p className="text-2xl font-bold text-[#14532d] mt-1.5">
                R$ {prolaborePaidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#15803d] mt-0.5">
                {prolaborePaid.length} lançamentos pagos
              </p>
            </div>

            <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#86868b]">Total de Lançamentos</p>
                <TrendingUp size={16} className="text-[#1d1d1f]" />
              </div>
              <p className="text-2xl font-bold text-[#1d1d1f] mt-1.5">
                {localProlabores.length}
              </p>
              <p className="text-[11px] text-[#86868b] mt-0.5">
                em {localEmployees.length} colaboradores
              </p>
            </div>
          </div>

          {/* Grid por colaborador */}
          <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">Pró-Labore por Colaborador</h3>
                <p className="text-xs text-[#6e6e73]">
                  Gerencie as retiradas mensais fixas de cada colaborador. O pagamento é lançado automaticamente no Financeiro.
                </p>
              </div>
            </div>

            {localEmployees.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-[#e5e5ea] rounded-2xl bg-[#fafafa]">
                <BadgeDollarSign className="mx-auto h-8 w-8 text-[#86868b] mb-2 stroke-[1.5]" />
                <p className="text-[#1d1d1f] font-medium text-sm">Nenhum colaborador cadastrado</p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Cadastre colaboradores primeiro na aba "Equipe & Funções".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {localEmployees.filter(emp =>
                  emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  emp.role.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((emp) => {
                  const empProlabores = localProlabores.filter((p) => p.employee_id === emp.id)
                  const empPending   = empProlabores.filter((p) => p.payment_status !== 'paid')
                  const empPaid      = empProlabores.filter((p) => p.payment_status === 'paid')
                  const empPendingTotal = empPending.reduce((acc, p) => acc + Number(p.amount || 0), 0)
                  const empPaidTotal   = empPaid.reduce((acc, p) => acc + Number(p.amount || 0), 0)

                  return (
                    <div
                      key={emp.id}
                      className="rounded-2xl border border-[#e5e5ea] bg-white p-5 hover:border-[#7c3aed]/30 hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Topo */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7c3aed] bg-[#f5f3ff] border border-[#e9d5ff] px-2 py-0.5 rounded-md">
                              <BadgeDollarSign size={11} /> Pró-Labore
                            </span>
                            <h4 className="font-bold text-base text-[#1d1d1f] mt-1.5 leading-snug">{emp.name}</h4>
                            <span className="text-[11px] text-[#86868b]">{emp.role}</span>
                          </div>
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            empPendingTotal > 0
                              ? 'bg-[#f3e8ff] text-[#7c3aed]'
                              : empProlabores.length > 0
                              ? 'bg-[#e8f8ee] text-[#1a7f37]'
                              : 'bg-[#f5f5f7] text-[#86868b]'
                          }`}>
                            {empPendingTotal > 0 ? 'Pendente' : empProlabores.length > 0 ? '✓ Quitado' : 'Sem lançamentos'}
                          </span>
                        </div>

                        {/* Resumo financeiro */}
                        {empProlabores.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="p-2.5 bg-[#fffaf5] rounded-xl border border-[#fcd7c5]">
                              <span className="text-[10px] text-[#9a3412] block">A Pagar</span>
                              <span className={`font-bold text-sm ${empPendingTotal > 0 ? 'text-[#c2410c]' : 'text-[#16a34a]'}`}>
                                R$ {empPendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="p-2.5 bg-[#f0fdf4] rounded-xl border border-[#bbf7d0]">
                              <span className="text-[10px] text-[#166534] block">Já Pago</span>
                              <span className="font-bold text-sm text-[#15803d]">
                                R$ {empPaidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Lista de lançamentos (últimos 3) */}
                        {empProlabores.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {empProlabores.slice(0, 3).map((p) => (
                              <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-[#fbfbfd] border border-[#f2f2f7] text-xs">
                                <div>
                                  <span className="font-semibold text-[#1d1d1f]">{formatCompetencia(p.competencia)}</span>
                                  {p.description && (
                                    <span className="text-[#86868b] ml-1.5 truncate max-w-[90px] inline-block align-middle">{p.description}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold text-[#1d1d1f]">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                                    p.payment_status === 'paid'
                                      ? 'bg-[#dcfce7] text-[#15803d]'
                                      : 'bg-[#f3e8ff] text-[#7c3aed]'
                                  }`}>
                                    {p.payment_status === 'paid' ? '✓' : '⏳'}
                                  </span>
                                  {p.payment_status !== 'paid' ? (
                                    <button
                                      type="button"
                                      onClick={() => handlePayProlabore(p.id)}
                                      disabled={actionLoadingId === p.id}
                                      className="text-[10px] font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] px-2 py-0.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                                    >
                                      Pagar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRevertProlabore(p.id)}
                                      disabled={actionLoadingId === p.id}
                                      className="text-[10px] font-semibold text-[#86868b] hover:text-[#cf222e] hover:underline cursor-pointer"
                                    >
                                      Estornar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenProlaboreModal(emp, p)}
                                    className="p-1 rounded-lg text-[#86868b] hover:bg-[#f0f0f2] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProlabore(p.id)}
                                    className="p-1 rounded-lg text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {empProlabores.length > 3 && (
                              <p className="text-[11px] text-[#86868b] text-center pt-1">
                                +{empProlabores.length - 3} lançamentos anteriores
                              </p>
                            )}
                          </div>
                        )}

                        {empProlabores.length === 0 && (
                          <p className="text-xs text-[#86868b] italic mb-3">
                            Nenhum lançamento de pró-labore ainda.
                          </p>
                        )}
                      </div>

                      {/* Ação principal */}
                      <div className="pt-3 border-t border-[#f2f2f7] flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenProlaboreModal(emp)}
                          className="flex items-center gap-1.5 rounded-xl bg-[#f3e8ff] hover:bg-[#e9d5ff] text-[#7c3aed] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Plus size={13} />
                          Novo Lançamento
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Pró-Labore */}
      {isProlaboreModalOpen && prolaboreEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <BadgeDollarSign size={18} className="text-[#7c3aed]" />
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    {editingProlabore ? 'Editar Pró-Labore' : 'Novo Pró-Labore'}
                  </h3>
                </div>
                <p className="text-xs text-[#6e6e73]">
                  {prolaboreEmployee.name} — {prolaboreEmployee.role}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsProlaboreModalOpen(false)
                  setEditingProlabore(null)
                  setProlaboreEmployee(null)
                }}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {prolaboreFormError && (
              <div className="mt-4 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-medium rounded-xl border border-[#ffdcd9]">
                {prolaboreFormError}
              </div>
            )}

            <form onSubmit={handleProlaboreSubmit} className="mt-5 space-y-4 text-xs">
              <input type="hidden" name="employee_id" value={prolaboreEmployee.id} />
              {editingProlabore && <input type="hidden" name="id" value={editingProlabore.id} />}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">Competência (Mês/Ano) *</label>
                  <input
                    type="month"
                    name="competencia"
                    required
                    defaultValue={editingProlabore?.competencia || currentCompetencia}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    required
                    defaultValue={editingProlabore?.amount ? Number(editingProlabore.amount) : ''}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">Observação (Opcional)</label>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingProlabore?.description || ''}
                  placeholder="Ex: 13º proporcional, adiantamento, comissão..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#7c3aed]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setIsProlaboreModalOpen(false)
                    setEditingProlabore(null)
                    setProlaboreEmployee(null)
                  }}
                  className="px-4 py-2 font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] px-5 py-2 font-semibold text-white transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isPending
                    ? 'Salvando...'
                    : editingProlabore
                    ? 'Salvar Alterações'
                    : 'Criar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Novo / Editar Colaborador */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">
                  {editingEmployee ? 'Editar Colaborador' : 'Novo Colaborador / Freelancer'}
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  Cadastre as informações da equipe para escalas de festas.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingEmployee(null)
                }}
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              {editingEmployee && <input type="hidden" name="id" value={editingEmployee.id} />}

              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingEmployee?.name || ''}
                  placeholder="Ex: Carlos Eduardo dos Santos"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#1d1d1f]">Função Principal *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(null)
                        setRoleFormError(null)
                        setIsRolesModalOpen(true)
                      }}
                      className="text-[11px] text-[#0066cc] hover:underline cursor-pointer"
                    >
                      + Gerenciar Funções
                    </button>
                  </div>
                  <select
                    name="role"
                    required
                    defaultValue={editingEmployee?.role || (roles.length > 0 ? roles[0].name : 'Garçom')}
                    onChange={(e) => {
                      const selected = roles.find((r) => r.name === e.target.value)
                      if (selected) {
                        setSelectedRoleDailyRate(selected.default_daily_rate)
                      }
                    }}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id || r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                    {/* Fallback caso a role do funcionário não esteja na lista de roles */}
                    {editingEmployee?.role && !roles.some((r) => r.name === editingEmployee.role) && (
                      <option value={editingEmployee.role}>{editingEmployee.role}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">
                    Valor Diária Padrão (R$)
                  </label>
                  <input
                    key={selectedRoleDailyRate !== null ? `rate-${selectedRoleDailyRate}` : 'rate-default'}
                    type="number"
                    step="0.01"
                    name="default_daily_rate"
                    defaultValue={
                      selectedRoleDailyRate !== null
                        ? selectedRoleDailyRate
                        : editingEmployee?.default_daily_rate
                        ? Number(editingEmployee.default_daily_rate)
                        : (roles.length > 0 ? roles[0].default_daily_rate : 150)
                    }
                    placeholder="150,00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                  />
                </div>
              </div>


              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">
                  Chave PIX (para pagamento de diárias)
                </label>
                <input
                  type="text"
                  name="pix_key"
                  defaultValue={editingEmployee?.pix_key || ''}
                  placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1d1d1f] mb-1">Observações</label>
                <textarea
                  rows={2}
                  name="notes"
                  defaultValue={editingEmployee?.notes || ''}
                  placeholder="Tamanho de uniforme, restrições, disponibilidade..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs text-[#1d1d1f]"
                />
              </div>

              {editingEmployee && (
                <div>
                  <label className="block font-semibold text-[#1d1d1f] mb-1">Status</label>
                  <select
                    name="active"
                    defaultValue={editingEmployee.active ? 'true' : 'false'}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f]"
                  >
                    <option value="true">Ativo (Disponível para Escalas)</option>
                    <option value="false">Inativo (Indisponível)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingEmployee(null)
                  }}
                  className="px-4 py-2 font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 font-semibold text-white hover:bg-[#333336] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isPending
                    ? 'Salvando...'
                    : editingEmployee
                    ? 'Salvar Alterações'
                    : 'Cadastrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Gerenciar Funções / Categorias (Criar, Editar, Excluir) */}
      {isRolesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f] flex items-center gap-2">
                  <Tag size={18} className="text-[#b8860b]" />
                  <span>Categorias & Funções da Equipe</span>
                </h3>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Crie, edite ou remova funções da equipe (Garçom, Cozinheiro, Bartender, etc.) e defina a diária padrão.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRolesModalOpen(false)
                  setEditingRole(null)
                  setRoleFormError(null)
                }}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {roleFormError && (
              <div className="mt-4 p-3 bg-[#feeceb] text-[#cf222e] text-xs font-medium rounded-xl border border-[#ffdcd9]">
                {roleFormError}
              </div>
            )}

            {/* Formulário de Criação / Edição de Função */}
            <div className="mt-5 p-4 rounded-2xl bg-[#fafafc] border border-[#e5e5ea]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider">
                  {editingRole ? `✏️ Editar Função: ${editingRole.name}` : '➕ Nova Função / Categoria'}
                </h4>
                {editingRole && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRole(null)
                      setRoleFormError(null)
                    }}
                    className="text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>

              <form onSubmit={handleRoleSubmit} className="space-y-3 text-xs">
                {editingRole && <input type="hidden" name="id" value={editingRole.id} />}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block font-semibold text-[#1d1d1f] mb-1">
                      Nome da Função / Categoria *
                    </label>
                    <input
                      key={editingRole?.id || 'new-role-name'}
                      type="text"
                      name="name"
                      required
                      defaultValue={editingRole?.name || ''}
                      placeholder="Ex: Garçom, Cozinheiro(a), Auxiliar de Bar..."
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-[#1d1d1f] mb-1">
                      Diária Sugerida (R$) *
                    </label>
                    <input
                      key={editingRole?.id ? `rate-${editingRole.id}` : 'new-role-rate'}
                      type="number"
                      step="0.01"
                      name="default_daily_rate"
                      required
                      defaultValue={editingRole?.default_daily_rate ? Number(editingRole.default_daily_rate) : 150}
                      placeholder="150,00"
                      className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full h-[38px] flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1d1f] px-4 font-semibold text-white hover:bg-[#333336] transition-all disabled:opacity-50 cursor-pointer shadow-xs text-xs"
                    >
                      {isPending ? (
                        'Salvando...'
                      ) : editingRole ? (
                        'Atualizar'
                      ) : (
                        <>
                          <Plus size={14} /> Adicionar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#6e6e73] mb-1">
                    Descrição / Requisitos (Opcional)
                  </label>
                  <input
                    key={editingRole?.id ? `desc-${editingRole.id}` : 'new-role-desc'}
                    type="text"
                    name="description"
                    defaultValue={editingRole?.description || ''}
                    placeholder="Ex: Atendimento ao salão e apoio no buffet"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-1.5 text-xs text-[#1d1d1f] focus:outline-none"
                  />
                </div>
              </form>
            </div>

            {/* Lista das Funções Cadastradas */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#86868b] uppercase tracking-wider">
                  Funções Cadastradas ({localRoles.length})
                </h4>
                <span className="text-[11px] text-[#86868b]">
                  Usadas para pré-configurar colaboradores e filtros
                </span>
              </div>

              <div className="divide-y divide-[#f2f2f7] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
                {localRoles.length > 0 ? (
                  localRoles.map((r) => {
                    const employeesWithRole = localEmployees.filter(
                      (e) => e.role.toLowerCase() === r.name.toLowerCase()
                    ).length

                    return (
                      <div
                        key={r.id || r.name}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#fbfbfd] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] shrink-0">
                            <Briefcase size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-[#1d1d1f] truncate">{r.name}</p>
                              <span className="text-[11px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                                {employeesWithRole} {employeesWithRole === 1 ? 'membro' : 'membros'}
                              </span>
                            </div>
                            {r.description && (
                              <p className="text-xs text-[#86868b] truncate mt-0.5">{r.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-semibold text-[#1d1d1f]">
                              R$ {Number(r.default_daily_rate).toFixed(2)}
                            </p>
                            <span className="text-[10px] text-[#86868b]">diária padrão</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(r)
                                setRoleFormError(null)
                              }}
                              className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#f0f0f2] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                              title="Editar Função"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={roleActionLoadingId === r.id}
                              onClick={() => handleDeleteRole(r.id, r.name)}
                              className="p-1.5 rounded-lg text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer disabled:opacity-50"
                              title="Excluir Função"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-[#86868b]">
                    Nenhuma categoria de função cadastrada ainda.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#f2f2f7] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsRolesModalOpen(false)
                  setEditingRole(null)
                }}
                className="rounded-xl bg-[#f5f5f7] px-5 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Extrato de Diárias do Colaborador */}
      {statementEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Cabeçalho do Extrato */}
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <span className="text-[11px] font-bold text-[#b8860b] bg-[#fffaf0] border border-[#fef3c7] px-2 py-0.5 rounded-md">
                  {statementEmployee.role}
                </span>
                <h3 className="text-lg font-bold text-[#1d1d1f] mt-1">
                  Extrato de Diárias: {statementEmployee.name}
                </h3>
                <p className="text-xs text-[#6e6e73]">
                  Detalhamento de cada festa trabalhada e controle de quitações.
                </p>
              </div>
              <button
                onClick={() => setStatementEmployee(null)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumo Rápido */}
            {(() => {
              const fin = getEmployeeFinancials(statementEmployee.id)
              return (
                <div className="my-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#fbfbfd] rounded-xl border border-[#f2f2f7]">
                    <span className="text-[11px] text-[#86868b] block">Total de Dias Trabalhados</span>
                    <span className="font-bold text-base text-[#1d1d1f] mt-0.5 block">
                      {fin.totalDaysWorked} {fin.totalDaysWorked === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f0fdf4] rounded-xl border border-[#bbf7d0]">
                    <span className="text-[11px] text-[#166534] block">Total Já Pago</span>
                    <span className="font-bold text-base text-[#15803d] mt-0.5 block">
                      R$ {fin.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-[#fffaf5] rounded-xl border border-[#fed7aa]">
                    <span className="text-[11px] text-[#9a3412] block">Saldo a Pagar</span>
                    <span className="font-bold text-base text-[#c2410c] mt-0.5 block">
                      R$ {fin.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Chave PIX */}
            {statementEmployee.pix_key && (
              <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-[#86868b]" />
                  <div>
                    <span className="text-[10px] text-[#86868b] block">Chave PIX:</span>
                    <span className="font-mono text-xs font-bold text-[#1d1d1f]">
                      {statementEmployee.pix_key}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPix(statementEmployee.id, statementEmployee.pix_key!)}
                  className="flex items-center gap-1 bg-white border border-[#d1d1d6] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1d1d1f] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  {copiedPixId === statementEmployee.id ? (
                    <>
                      <Check size={13} className="text-[#16a34a]" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copiar PIX</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* SEÇÃO 1: Dias Trabalhados Lançados Diretamente */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-1.5 uppercase tracking-wider">
                  <CalendarCheck size={14} className="text-[#0071e3]" />
                  <span>Dias Trabalhados Lançados ({getEmployeeFinancials(statementEmployee.id).workList.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => openWorkModal(statementEmployee)}
                  className="text-[11px] font-semibold text-[#166534] bg-[#dcfce7] hover:bg-[#bbf7d0] px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={11} strokeWidth={2.5} />
                  <span>Lançar Novos Dias</span>
                </button>
              </div>

              <div className="border border-[#e5e5ea] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f9f9fb] border-b border-[#f2f2f7] text-[#6e6e73] font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5 text-center">Dias Trab.</th>
                      <th className="p-2.5">Diária</th>
                      <th className="p-2.5">Total</th>
                      <th className="p-2.5">Motivo / Descrição</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f2f7]">
                    {(() => {
                      const { workList } = getEmployeeFinancials(statementEmployee.id)
                      if (workList.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-[#86868b] text-[11px]">
                              Nenhum lançamento avulso de dias cadastrado para este colaborador.
                            </td>
                          </tr>
                        )
                      }
                      return workList.map((w) => {
                        const dateStr = w.date
                          ? new Date(w.date + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '—'
                        const isPaid = w.payment_status === 'paid'

                        return (
                          <tr key={w.id} className="hover:bg-[#fbfbfd] transition-colors">
                            <td className="p-2.5 font-medium text-[#1d1d1f] whitespace-nowrap">{dateStr}</td>
                            <td className="p-2.5 text-center font-bold text-[#1d1d1f] whitespace-nowrap">
                              {w.days_worked} {w.days_worked === 1 ? 'dia' : 'dias'}
                            </td>
                            <td className="p-2.5 text-[#6e6e73] whitespace-nowrap">R$ {Number(w.daily_rate).toFixed(2)}</td>
                            <td className="p-2.5 font-bold text-[#1d1d1f] whitespace-nowrap">R$ {Number(w.total_amount).toFixed(2)}</td>
                            <td className="p-2.5 text-[#6e6e73] max-w-[140px] truncate">{w.description || '—'}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isPaid ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'
                                }`}
                              >
                                {isPaid ? '✓ Pago (Saldo)' : '⏳ Pendente'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRevertWorkEntry(w.id)}
                                    disabled={actionLoadingId === w.id}
                                    className="text-[10px] font-semibold text-[#86868b] hover:text-[#cf222e] hover:underline cursor-pointer"
                                  >
                                    Estornar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handlePayWorkEntry(w.id, w.total_amount, statementEmployee.name)}
                                    disabled={actionLoadingId === w.id}
                                    className="text-[10px] font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-2 py-1 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Check size={11} strokeWidth={2.5} />
                                    Pagar Diária
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWorkEntry(w.id)}
                                  disabled={actionLoadingId === w.id}
                                  className="p-1 text-[#86868b] hover:text-[#cf222e] hover:bg-[#feeceb] rounded-md transition-colors cursor-pointer"
                                  title="Excluir lançamento"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEÇÃO 2: Tabela de Escalas em Eventos */}
            <div>
              <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-1.5 uppercase tracking-wider mb-2">
                <Calendar size={14} className="text-[#86868b]" />
                <span>Escalas em Eventos & Festas ({getEmployeeFinancials(statementEmployee.id).list.length})</span>
              </h4>

              <div className="border border-[#e5e5ea] rounded-2xl overflow-hidden mb-5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f9f9fb] border-b border-[#f2f2f7] text-[#6e6e73] font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Festa / Evento</th>
                      <th className="p-3">Função</th>
                      <th className="p-3">Diária (R$)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f2f7]">
                    {(() => {
                      const { list } = getEmployeeFinancials(statementEmployee.id)
                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-[#86868b] text-[11px]">
                              Este colaborador ainda não foi escalado para nenhuma festa.
                            </td>
                          </tr>
                        )
                      }

                      return list.map((a) => {
                        const dateStr = a.events?.event_date
                          ? new Date(a.events.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '—'
                        const isPaid = a.payment_status === 'paid'

                        return (
                          <tr key={a.id} className="hover:bg-[#fbfbfd] transition-colors">
                            <td className="p-3 font-medium text-[#1d1d1f] whitespace-nowrap">
                              {dateStr}
                            </td>
                            <td className="p-3 font-semibold text-[#1d1d1f]">
                              {a.events?.title || 'Festa'}
                            </td>
                            <td className="p-3 text-[#6e6e73]">
                              {a.role}
                            </td>
                            <td className="p-3 font-bold text-[#1d1d1f] whitespace-nowrap">
                              R$ {Number(a.daily_rate).toFixed(2)}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isPaid
                                    ? 'bg-[#dcfce7] text-[#15803d]'
                                    : 'bg-[#fef3c7] text-[#b45309]'
                                }`}
                              >
                                {isPaid ? '✓ Pago' : '⏳ Pendente'}
                              </span>
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevertPayment(a.id)}
                                  disabled={actionLoadingId === a.id}
                                  className="text-[10px] font-semibold text-[#86868b] hover:text-[#cf222e] hover:underline cursor-pointer"
                                >
                                  Estornar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePaySingleDaily(a.id)}
                                  disabled={actionLoadingId === a.id}
                                  className="text-[10px] font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-xs"
                                >
                                  Pagar Diária
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-4 border-t border-[#f2f2f7] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleCopyWhatsAppReceipt(statementEmployee)}
                className="text-xs font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedReceipt ? (
                  <>
                    <Check size={14} className="text-[#16a34a]" />
                    <span>Recibo Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Copiar Recibo WhatsApp</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {(() => {
                  const fin = getEmployeeFinancials(statementEmployee.id)
                  if (fin.totalPending <= 0) return null
                  return (
                    <button
                      type="button"
                      onClick={() => handlePayAllDailies(statementEmployee.id)}
                      disabled={actionLoadingId === statementEmployee.id}
                      className="text-xs font-semibold text-white bg-[#1a7f37] hover:bg-[#146c2e] px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check size={14} />
                      <span>Quitar Tudo (R$ {fin.totalPending.toFixed(2)}) e Descontar do Saldo</span>
                    </button>
                  )
                })()}

                <button
                  type="button"
                  onClick={() => setStatementEmployee(null)}
                  className="text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] px-3 py-2 rounded-xl hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Lançar Dias Trabalhados e Pagamento */}
      {isWorkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center text-[#16a34a]">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">
                    Lançar Dias Trabalhados
                  </h3>
                  <p className="text-xs text-[#6e6e73]">
                    Informe a quantidade de dias e diária para calcular e pagar.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWorkModalOpen(false)}
                className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {workFormError && (
              <div className="mt-4 p-3 rounded-xl bg-[#fff2f2] border border-[#ffcdd2] text-[#cf222e] text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{workFormError}</span>
              </div>
            )}

            <form onSubmit={handleWorkSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="employee_id" value={workEmployeeId} />
              <input type="hidden" name="days_worked" value={workDays} />
              <input type="hidden" name="daily_rate" value={workDailyRate} />
              <input type="hidden" name="payment_status" value={workPaymentStatus} />

              {/* Seleção do Colaborador */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Colaborador <span className="text-[#cf222e]">*</span>
                </label>
                <select
                  value={workEmployeeId}
                  onChange={(e) => handleWorkEmployeeChange(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-xs text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="" disabled>Selecione um colaborador...</option>
                  {localEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.role} (Diária padrão: R$ {Number(e.default_daily_rate).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Data do Trabalho */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Data de Referência <span className="text-[#cf222e]">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-xs text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none transition-all"
                />
              </div>

              {/* Dias Trabalhados e Diária */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Dias Trabalhados <span className="text-[#cf222e]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={workDays}
                    onChange={(e) => setWorkDays(Math.max(0.5, Number(e.target.value)))}
                    required
                    placeholder="Ex: 3"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-xs text-[#1d1d1f] font-bold focus:border-[#1d1d1f] focus:outline-none transition-all"
                  />
                  <span className="text-[10px] text-[#86868b] mt-0.5 block">Ex: 1, 2, 3 ou 0.5 (meio dia)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Valor da Diária (R$) <span className="text-[#cf222e]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={workDailyRate}
                    onChange={(e) => setWorkDailyRate(Number(e.target.value))}
                    required
                    placeholder="Ex: 150.00"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-xs text-[#1d1d1f] font-bold focus:border-[#1d1d1f] focus:outline-none transition-all"
                  />
                  <span className="text-[10px] text-[#86868b] mt-0.5 block">Preenchido com o valor cadastrado</span>
                </div>
              </div>

              {/* CARD DE CÁLCULO VISUAL EM TEMPO REAL */}
              <div className="p-3.5 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#166534] block">
                    Cálculo Automático:
                  </span>
                  <span className="text-xs text-[#15803d]">
                    {workDays} {workDays === 1 ? 'dia' : 'dias'} × R$ {Number(workDailyRate || 0).toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#166534] uppercase tracking-wider font-semibold block">
                    Total a Pagar
                  </span>
                  <span className="text-xl font-extrabold text-[#14532d]">
                    R$ {(Number(workDays || 0) * Number(workDailyRate || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Descrição / Motivo */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Descrição / Observação (Opcional)
                </label>
                <input
                  type="text"
                  name="description"
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="Ex: Trabalho na semana de eventos, reforço na cozinha buffet..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-xs text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none transition-all"
                />
              </div>

              {/* Status do Pagamento (Pendente vs Pagar Agora) */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-2">
                  Situação do Pagamento:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWorkPaymentStatus('pending')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      workPaymentStatus === 'pending'
                        ? 'border-[#f59e0b] bg-[#fffbeb] ring-2 ring-[#f59e0b]/20 shadow-xs'
                        : 'border-[#e5e5ea] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#b45309]">
                      <Clock size={14} />
                      <span>Deixar Pendente</span>
                    </div>
                    <p className="text-[10px] text-[#92400e] mt-1 leading-tight">
                      Ficará registrado no acerto do colaborador para quitação posterior.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkPaymentStatus('paid')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      workPaymentStatus === 'paid'
                        ? 'border-[#16a34a] bg-[#f0fdf4] ring-2 ring-[#16a34a]/20 shadow-xs'
                        : 'border-[#e5e5ea] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#15803d]">
                      <Check size={14} strokeWidth={2.5} />
                      <span>Pagar Agora</span>
                    </div>
                    <p className="text-[10px] text-[#166534] mt-1 leading-tight">
                      <strong>Desconta no Saldo em Caixa</strong> do Financeiro imediatamente.
                    </p>
                  </button>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-[#f2f2f7] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWorkModalOpen(false)}
                  className="rounded-xl bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-1.5 ${
                    workPaymentStatus === 'paid'
                      ? 'bg-[#1a7f37] hover:bg-[#146c2e]'
                      : 'bg-[#1d1d1f] hover:bg-[#333336]'
                  }`}
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>
                    {workPaymentStatus === 'paid'
                      ? `Confirmar Pagamento (R$ ${(Number(workDays || 0) * Number(workDailyRate || 0)).toFixed(2)})`
                      : `Salvar Lançamento (R$ ${(Number(workDays || 0) * Number(workDailyRate || 0)).toFixed(2)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
