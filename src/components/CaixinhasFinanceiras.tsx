'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Wallet,
  Shield,
  Target,
  Wrench,
  Sparkles,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Trash2,
  SlidersHorizontal,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import {
  Caixinha,
  createCaixinha,
  updateCaixinha,
  depositToCaixinha,
  withdrawFromCaixinha,
  editCaixinhaBalance,
  deleteCaixinha,
} from '@/app/(dashboard)/caixinhas/actions'

interface CaixinhasFinanceirasProps {
  initialCaixinhas: Caixinha[]
  totalCashBalance?: number
  compactView?: boolean
}

export function CaixinhasFinanceiras({
  initialCaixinhas,
  totalCashBalance = 0,
  compactView = false,
}: CaixinhasFinanceirasProps) {
  const router = useRouter()
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>(initialCaixinhas)

  // Manter estado sincronizado quando o servidor revalidar
  useEffect(() => {
    setCaixinhas(initialCaixinhas)
  }, [initialCaixinhas])
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modais
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalCaixinha, setEditModalCaixinha] = useState<Caixinha | null>(null)
  const [depositModalCaixinha, setDepositModalCaixinha] = useState<Caixinha | null>(null)
  const [withdrawModalCaixinha, setWithdrawModalCaixinha] = useState<Caixinha | null>(null)
  const [adjustBalanceCaixinha, setAdjustBalanceCaixinha] = useState<Caixinha | null>(null)
  const [deleteConfirmCaixinha, setDeleteConfirmCaixinha] = useState<Caixinha | null>(null)

  // Form states
  const [actionAmount, setActionAmount] = useState<string>('')

  // Cálculos consolidados
  const totalInCaixinhas = caixinhas.reduce((acc, c) => acc + Number(c.current_balance || 0), 0)
  const totalTargetInCaixinhas = caixinhas.reduce((acc, c) => acc + Number(c.target_balance || 0), 0)
  const freeCashBalance = Math.max(0, totalCashBalance - totalInCaixinhas)

  // Helper de Ícones
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'shield':
        return <Shield size={18} />
      case 'target':
        return <Target size={18} />
      case 'wrench':
        return <Wrench size={18} />
      case 'sparkles':
        return <Sparkles size={18} />
      case 'truck':
        return <Truck size={18} />
      default:
        return <Wallet size={18} />
    }
  }

  // Ações com Atualização Automática Imediata
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    const initial_balance = Number(formData.get('current_balance') || 0)

    if (initial_balance > freeCashBalance) {
      setErrorMessage(
        `Saldo livre insuficiente em caixa! Você possui apenas R$ ${freeCashBalance.toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )} livre na conta para transferir.`
      )
      return
    }

    startTransition(async () => {
      const res = await createCaixinha(formData)
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        if (res.caixinha) {
          setCaixinhas((prev) => [...prev, res.caixinha!])
        }
        setCreateModalOpen(false)
        setSuccessMessage('Caixinha criada com sucesso!')
        router.refresh()
        setTimeout(() => setSuccessMessage(null), 3500)
      }
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    const id = formData.get('id') as string

    startTransition(async () => {
      const res = await updateCaixinha(formData)
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setCaixinhas((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: (formData.get('name') as string)?.trim() || c.name,
                  target_balance: Number(formData.get('target_balance') || c.target_balance),
                  category: (formData.get('category') as string) || c.category,
                  color: (formData.get('color') as string) || c.color,
                  icon: (formData.get('icon') as string) || c.icon,
                  notes: (formData.get('notes') as string)?.trim() || c.notes,
                }
              : c
          )
        )
        setEditModalCaixinha(null)
        setSuccessMessage('Caixinha atualizada com sucesso!')
        router.refresh()
        setTimeout(() => setSuccessMessage(null), 3500)
      }
    })
  }

  const handleDeposit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    const id = formData.get('id') as string
    const amount = Number(formData.get('amount') || 0)

    if (amount > freeCashBalance) {
      setErrorMessage(
        `Saldo livre insuficiente! Você possui apenas R$ ${freeCashBalance.toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )} disponível na conta para guardar.`
      )
      return
    }

    startTransition(async () => {
      const res = await depositToCaixinha(formData)
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setCaixinhas((prev) =>
          prev.map((c) => (c.id === id ? { ...c, current_balance: c.current_balance + amount } : c))
        )
        setDepositModalCaixinha(null)
        setActionAmount('')
        setSuccessMessage('Valor guardado com sucesso na caixinha!')
        router.refresh()
        setTimeout(() => setSuccessMessage(null), 3500)
      }
    })
  }

  const handleWithdraw = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    const id = formData.get('id') as string
    const amountNum = Number(formData.get('amount'))

    if (withdrawModalCaixinha && amountNum > withdrawModalCaixinha.current_balance) {
      setErrorMessage(
        `Saldo insuficiente! Você não pode retirar R$ ${amountNum.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })}, pois esta caixinha possui apenas R$ ${withdrawModalCaixinha.current_balance.toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )}.`
      )
      return
    }

    startTransition(async () => {
      const res = await withdrawFromCaixinha(formData)
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setCaixinhas((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, current_balance: c.current_balance - amountNum } : c
          )
        )
        setWithdrawModalCaixinha(null)
        setActionAmount('')
        setSuccessMessage('Valor resgatado com sucesso!')
        router.refresh()
        setTimeout(() => setSuccessMessage(null), 3500)
      }
    })
  }

  const handleAdjustBalance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const formData = new FormData(e.currentTarget)
    const id = formData.get('id') as string
    const newBalance = Number(formData.get('new_balance'))

    if (adjustBalanceCaixinha && newBalance > adjustBalanceCaixinha.current_balance) {
      const diff = newBalance - adjustBalanceCaixinha.current_balance
      if (diff > freeCashBalance) {
        setErrorMessage(
          `Saldo livre insuficiente em caixa! Para aumentar em R$ ${diff.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}, você possui apenas R$ ${freeCashBalance.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })} disponível.`
        )
        return
      }
    }

    startTransition(async () => {
      const res = await editCaixinhaBalance(formData)
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setCaixinhas((prev) =>
          prev.map((c) => (c.id === id ? { ...c, current_balance: newBalance } : c))
        )
        setAdjustBalanceCaixinha(null)
        setActionAmount('')
        setSuccessMessage('Saldo da caixinha ajustado com sucesso!')
        router.refresh()
        setTimeout(() => setSuccessMessage(null), 3500)
      }
    })
  }

  const handleDelete = (id: string) => {
    setErrorMessage(null)
    const target = caixinhas.find((c) => c.id === id)
    if (target && target.current_balance > 0) {
      setErrorMessage(
        `Operação bloqueada: A caixinha "${target.name}" possui R$ ${target.current_balance.toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 }
        )} guardado. Resgate o valor antes de excluir.`
      )
      return
    }

    setCaixinhas((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirmCaixinha(null)
    setSuccessMessage('Caixinha removida com sucesso!')
    setTimeout(() => setSuccessMessage(null), 3500)

    startTransition(async () => {
      const res = await deleteCaixinha(id)
      if (res?.error) {
        setErrorMessage(res.error)
        router.refresh()
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Alertas de Sucesso e Erro */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#d2f0dd] bg-[#e8f8ee] p-3 text-xs font-semibold text-[#1a7f37] animate-in fade-in duration-150">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs font-medium text-[#cf222e] animate-in fade-in duration-150">
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header da Seção de Caixinhas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-[#e5e5ea] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center font-bold">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1d1d1f]">
                Caixinhas de Organização Financeira
              </h3>
              <p className="text-xs text-[#6e6e73]">
                Separe reservas de emergência, reposições e metas do acervo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="text-right hidden sm:block border-r border-[#f2f2f7] pr-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] block">
              Saldo Livre em Caixa
            </span>
            <span className="text-sm font-bold text-[#1a7f37]">
              R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="text-right mr-1 hidden sm:block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] block">
              Total em Caixinhas
            </span>
            <span className="text-sm font-bold text-[#1d1d1f]">
              R$ {totalInCaixinhas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => {
              setErrorMessage(null)
              setCreateModalOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white px-4 py-2.5 text-xs font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Criar Caixinha</span>
          </button>
        </div>
      </div>

      {/* Grid de Caixinhas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {caixinhas.map((caixinha) => {
          const effectiveColor = caixinha.color === '#820ad1' ? '#1d1d1f' : (caixinha.color || '#1d1d1f')
          const percent =
            caixinha.target_balance > 0
              ? Math.min(Math.round((caixinha.current_balance / caixinha.target_balance) * 100), 100)
              : 0

          return (
            <div
              key={caixinha.id}
              className="relative flex flex-col justify-between rounded-3xl border border-[#e5e5ea] bg-white p-5 shadow-2xs hover:shadow-md hover:border-[#1d1d1f]/40 transition-all duration-200 group"
            >
              <div>
                {/* Topo da Caixinha */}
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xs"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    {getIcon(caixinha.icon)}
                  </div>

                  {/* Menu de Ações Rápidas */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setErrorMessage(null)
                        setAdjustBalanceCaixinha(caixinha)
                        setActionAmount(String(caixinha.current_balance))
                      }}
                      className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                      title="Editar Saldo diretamente"
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setErrorMessage(null)
                        setEditModalCaixinha(caixinha)
                      }}
                      className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                      title="Editar detalhes da caixinha"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setErrorMessage(null)
                        setDeleteConfirmCaixinha(caixinha)
                      }}
                      className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#cf222e] transition-colors cursor-pointer"
                      title="Apagar caixinha"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Nome e Saldo */}
                <div className="mt-3.5">
                  <h4 className="text-sm font-bold text-[#1d1d1f] truncate" title={caixinha.name}>
                    {caixinha.name}
                  </h4>
                  <p className="text-xs text-[#6e6e73] mt-0.5 line-clamp-1">
                    {caixinha.notes || 'Sem observações'}
                  </p>

                  <div className="mt-2.5">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                      Saldo Guardado
                    </span>
                    <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                      R${' '}
                      {Number(caixinha.current_balance).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso da Meta */}
                {caixinha.target_balance > 0 && (
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                      <span className="text-[#6e6e73]">
                        Meta: R${' '}
                        {Number(caixinha.target_balance).toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      <span
                        className="font-bold"
                        style={{ color: effectiveColor }}
                      >
                        {percent}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#f2f2f7]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: effectiveColor,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Guardar e Resgatar */}
              <div className="grid grid-cols-2 gap-2 mt-5 pt-3 border-t border-[#f2f2f7]">
                <button
                  onClick={() => {
                    setErrorMessage(null)
                    setDepositModalCaixinha(caixinha)
                    setActionAmount('')
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl bg-[#f5f5f7] hover:bg-[#e8f8ee] hover:text-[#1a7f37] text-[#1d1d1f] py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  <ArrowDownLeft size={13} className="text-[#1a7f37]" />
                  <span>Guardar</span>
                </button>

                <button
                  onClick={() => {
                    setErrorMessage(null)
                    setWithdrawModalCaixinha(caixinha)
                    setActionAmount('')
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl bg-[#f5f5f7] hover:bg-[#feeceb] hover:text-[#cf222e] text-[#1d1d1f] py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  <ArrowUpRight size={13} className="text-[#cf222e]" />
                  <span>Resgatar</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ========================================================
          MODAIS DE OPERAÇÃO
         ======================================================== */}

      {/* 1. Modal Guardar Dinheiro */}
      {depositModalCaixinha && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-white"
                  style={{
                    backgroundColor:
                      depositModalCaixinha.color === '#820ad1'
                        ? '#1d1d1f'
                        : (depositModalCaixinha.color || '#1d1d1f'),
                  }}
                >
                  <ArrowDownLeft size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f]">Guardar Dinheiro</h3>
                  <p className="text-xs text-[#6e6e73]">{depositModalCaixinha.name}</p>
                </div>
              </div>
              <button
                onClick={() => setDepositModalCaixinha(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeposit} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={depositModalCaixinha.id} />

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[#fafafc] p-3 border border-[#f2f2f7]">
                  <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Na Caixinha
                  </span>
                  <span className="text-base font-bold text-[#1d1d1f]">
                    R${' '}
                    {depositModalCaixinha.current_balance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="rounded-2xl bg-[#fafafc] p-3 border border-[#f2f2f7]">
                  <span className="text-[10px] font-semibold text-[#1a7f37] uppercase tracking-wider block">
                    Saldo Livre em Caixa
                  </span>
                  <span className="text-base font-bold text-[#1a7f37]">
                    R${' '}
                    {freeCashBalance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {freeCashBalance <= 0 && (
                <div className="rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e] flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Saldo livre zerado!</strong> Você não possui saldo real livre em caixa para guardar em caixinhas. Valores pendentes "A Receber" ainda não entraram na conta.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Quanto deseja guardar? (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={freeCashBalance > 0 ? freeCashBalance : 0}
                  disabled={freeCashBalance <= 0}
                  name="amount"
                  required
                  placeholder="0,00"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-base font-bold text-[#1d1d1f] focus:outline-none transition-all ${
                    Number(actionAmount) > freeCashBalance
                      ? 'border-[#cf222e] bg-[#fff5f5] focus:ring-1 focus:ring-[#cf222e]'
                      : 'border-[#d1d1d6] bg-white focus:border-[#1d1d1f] focus:ring-1 focus:ring-[#1d1d1f]'
                  }`}
                />
              </div>

              {Number(actionAmount) > freeCashBalance && (
                <div className="rounded-xl border border-[#feeceb] bg-[#fff5f5] p-2.5 text-xs text-[#cf222e] font-medium flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  <span>
                    Valor excede o saldo livre disponível (R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                  </span>
                </div>
              )}

              {Number(actionAmount) > 0 && Number(actionAmount) <= freeCashBalance && (
                <div className="rounded-xl bg-[#e8f8ee] p-2.5 text-xs text-[#1a7f37] font-medium flex items-center justify-between">
                  <span>Novo saldo da caixinha:</span>
                  <strong>
                    R${' '}
                    {(
                      depositModalCaixinha.current_balance + Number(actionAmount)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setDepositModalCaixinha(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isPending ||
                    Number(actionAmount) <= 0 ||
                    Number(actionAmount) > freeCashBalance ||
                    freeCashBalance <= 0
                  }
                  className="rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Guardando...' : 'Confirmar Depósito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Resgatar Dinheiro (COM VALIDAÇÃO: NÃO PODER TIRAR O QUE NÃO TEM) */}
      {withdrawModalCaixinha && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#feeceb] text-[#cf222e] flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f]">Resgatar Dinheiro</h3>
                  <p className="text-xs text-[#6e6e73]">{withdrawModalCaixinha.name}</p>
                </div>
              </div>
              <button
                onClick={() => setWithdrawModalCaixinha(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={withdrawModalCaixinha.id} />

              <div className="rounded-2xl bg-[#fafafc] p-3.5 border border-[#f2f2f7] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Saldo Disponível para Retirar
                  </span>
                  <span className="text-lg font-bold text-[#1d1d1f]">
                    R${' '}
                    {withdrawModalCaixinha.current_balance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionAmount(String(withdrawModalCaixinha.current_balance))}
                  className="rounded-lg bg-[#f5f5f7] hover:bg-[#e5e5ea] px-2.5 py-1 text-[11px] font-semibold text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Tudo
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Quanto deseja retirar? (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={withdrawModalCaixinha.current_balance}
                  name="amount"
                  required
                  placeholder="0,00"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-base font-bold text-[#1d1d1f] focus:outline-none transition-all ${
                    Number(actionAmount) > withdrawModalCaixinha.current_balance
                      ? 'border-[#cf222e] bg-[#fff5f5] focus:ring-1 focus:ring-[#cf222e]'
                      : 'border-[#d1d1d6] bg-white focus:border-[#1d1d1f] focus:ring-1 focus:ring-[#1d1d1f]'
                  }`}
                />
              </div>

              {/* AVISO CRÍTICO DE BLOQUEIO QUANDO TENTA TIRAR MAIS DO QUE TEM */}
              {Number(actionAmount) > withdrawModalCaixinha.current_balance ? (
                <div className="rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e] flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Não é permitido retirar saldo que você não possui!</strong> O valor máximo disponível nesta caixinha é R${' '}
                    {withdrawModalCaixinha.current_balance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}.
                  </span>
                </div>
              ) : Number(actionAmount) > 0 ? (
                <div className="rounded-xl bg-[#f5f5f7] p-2.5 text-xs text-[#48484a] font-medium flex items-center justify-between">
                  <span>Saldo restante na caixinha:</span>
                  <strong>
                    R${' '}
                    {(
                      withdrawModalCaixinha.current_balance - Number(actionAmount)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setWithdrawModalCaixinha(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isPending ||
                    Number(actionAmount) <= 0 ||
                    Number(actionAmount) > withdrawModalCaixinha.current_balance
                  }
                  className="rounded-xl bg-[#cf222e] px-5 py-2 text-xs font-semibold text-white hover:bg-[#b01e26] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Processando...' : 'Confirmar Resgate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Editar Saldo Diretamente */}
      {adjustBalanceCaixinha && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f]">Editar Saldo</h3>
                  <p className="text-xs text-[#6e6e73]">{adjustBalanceCaixinha.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustBalanceCaixinha(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={adjustBalanceCaixinha.id} />

              <div className="rounded-2xl bg-[#fafafc] p-3 border border-[#f2f2f7] flex justify-between items-center text-xs">
                <span className="text-[#86868b]">Saldo Livre em Caixa:</span>
                <strong className="text-[#1a7f37]">R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Novo Saldo da Caixinha (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="new_balance"
                  required
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-base font-bold text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                />
                <span className="text-[11px] text-[#86868b] mt-1 block">
                  Aumentos de saldo consomem o saldo livre em caixa disponível.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setAdjustBalanceCaixinha(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || isNaN(Number(actionAmount)) || Number(actionAmount) < 0}
                  className="rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : 'Salvar Novo Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Editar Caixinha (Nome, Meta, Cor) */}
      {editModalCaixinha && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">Editar Caixinha</h3>
                <p className="text-xs text-[#6e6e73]">Altere as metas e configurações desta caixinha.</p>
              </div>
              <button
                onClick={() => setEditModalCaixinha(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={editModalCaixinha.id} />

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome da Caixinha *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editModalCaixinha.name}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Meta de Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="target_balance"
                    defaultValue={editModalCaixinha.target_balance}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Ícone
                  </label>
                  <select
                    name="icon"
                    defaultValue={editModalCaixinha.icon || 'wallet'}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  >
                    <option value="wallet">Carteira</option>
                    <option value="shield">Escudo (Segurança)</option>
                    <option value="target">Alvo (Meta)</option>
                    <option value="wrench">Ferramentas (Reposição)</option>
                    <option value="sparkles">Brilho (Especial)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Cor Visual
                  </label>
                  <select
                    name="color"
                    defaultValue={
                      editModalCaixinha.color === '#820ad1'
                        ? '#1d1d1f'
                        : (editModalCaixinha.color || '#1d1d1f')
                    }
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  >
                    <option value="#1d1d1f">Preto / Grafite</option>
                    <option value="#0071e3">Azul Royal</option>
                    <option value="#1a7f37">Verde Finanças</option>
                    <option value="#d4af37">Dourado Prêmio</option>
                    <option value="#cf222e">Vermelho Emergência</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Categoria
                  </label>
                  <select
                    name="category"
                    defaultValue={editModalCaixinha.category || 'geral'}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  >
                    <option value="emergencia">Emergência</option>
                    <option value="equipamentos">Equipamentos / Louças</option>
                    <option value="giro">Capital de Giro</option>
                    <option value="meta">Meta / Lucro</option>
                    <option value="geral">Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Observações / Objetivo
                </label>
                <input
                  type="text"
                  name="notes"
                  defaultValue={editModalCaixinha.notes || ''}
                  placeholder="Ex: Fundo para troca de travessas e taças"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setEditModalCaixinha(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Criar Nova Caixinha */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">Nova Caixinha Financeira</h3>
                <p className="text-xs text-[#6e6e73]">
                  Crie uma caixinha para separar reservas ou atingir metas do acervo.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="rounded-2xl bg-[#fafafc] p-3 border border-[#f2f2f7] flex justify-between items-center text-xs">
                <span className="text-[#86868b]">Saldo Livre em Caixa:</span>
                <strong className="text-[#1a7f37]">R$ {freeCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome da Caixinha *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: Reforma das Cadeiras Tiffany"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={freeCashBalance}
                    defaultValue="0.00"
                    name="current_balance"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Meta de Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="5000.00"
                    name="target_balance"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Cor Visual
                  </label>
                  <select
                    name="color"
                    defaultValue="#1d1d1f"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  >
                    <option value="#1d1d1f">Preto / Grafite</option>
                    <option value="#0071e3">Azul Royal</option>
                    <option value="#1a7f37">Verde Finanças</option>
                    <option value="#d4af37">Dourado Prêmio</option>
                    <option value="#cf222e">Vermelho Emergência</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Ícone
                  </label>
                  <select
                    name="icon"
                    defaultValue="target"
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                  >
                    <option value="target">Alvo (Meta)</option>
                    <option value="shield">Escudo (Segurança)</option>
                    <option value="wallet">Carteira</option>
                    <option value="wrench">Ferramentas (Reposição)</option>
                    <option value="sparkles">Brilho (Especial)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Observações / Objetivo
                </label>
                <input
                  type="text"
                  name="notes"
                  placeholder="Ex: Fundo para reforma semestral de peças"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Criando...' : 'Criar Caixinha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Confirmar Exclusão (COM BLOQUEIO SE HOUVER SALDO - REGRA BANCÁRIA) */}
      {deleteConfirmCaixinha && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-2xl bg-[#feeceb] text-[#cf222e] flex items-center justify-center shrink-0">
                {deleteConfirmCaixinha.current_balance > 0 ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Trash2 size={20} />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1d1d1f]">
                  {deleteConfirmCaixinha.current_balance > 0
                    ? 'Exclusão Bloqueada'
                    : 'Excluir Caixinha?'}
                </h3>
                <p className="text-xs text-[#6e6e73]">{deleteConfirmCaixinha.name}</p>
              </div>
            </div>

            {deleteConfirmCaixinha.current_balance > 0 ? (
              <div className="space-y-3 my-3">
                <div className="rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e] leading-relaxed">
                  <strong>Não é permitido excluir caixinhas com dinheiro dentro!</strong>
                  <p className="mt-1 text-[#48484a]">
                    Esta caixinha possui um saldo de{' '}
                    <strong className="text-[#1d1d1f]">
                      R${' '}
                      {deleteConfirmCaixinha.current_balance.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                    . Conforme regra de segurança bancária, você deve resgatar todo o saldo para a conta antes de apagar a caixinha.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#48484a] leading-relaxed my-3">
                Tem certeza que deseja apagar a caixinha <strong>{deleteConfirmCaixinha.name}</strong>?
                O saldo desta caixinha está zerado.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f2f7]">
              <button
                type="button"
                onClick={() => setDeleteConfirmCaixinha(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                {deleteConfirmCaixinha.current_balance > 0 ? 'Fechar' : 'Cancelar'}
              </button>

              {deleteConfirmCaixinha.current_balance > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = deleteConfirmCaixinha
                    setDeleteConfirmCaixinha(null)
                    setWithdrawModalCaixinha(target)
                    setActionAmount(String(target.current_balance))
                  }}
                  className="rounded-xl bg-[#1d1d1f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  Resgatar Saldo Agora
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(deleteConfirmCaixinha.id)}
                  className="rounded-xl bg-[#cf222e] px-5 py-2 text-xs font-semibold text-white hover:bg-[#b01e26] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Apagando...' : 'Sim, Apagar Caixinha'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
