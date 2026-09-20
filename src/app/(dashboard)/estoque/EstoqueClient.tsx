'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Eye,
  ExternalLink,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Layers,
} from 'lucide-react'
import { createStockMovement, updateProduct, deleteProduct } from './actions'
import { ImageUploadInput } from '@/components/ImageUploadInput'
import { useConfirm } from '@/components/ConfirmDialog'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  current_stock: number
  min_stock: number
  cost_price: number
  rental_price: number
  image_url?: string | null
  description?: string | null
}

export function EstoqueClient({
  products,
  movements = [],
}: {
  products: Product[]
  movements?: any[]
}) {
  const router = useRouter()
  const [localProducts, setLocalProducts] = useState<Product[]>(products)

  useEffect(() => {
    setLocalProducts(products)
  }, [products])

  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [movementModalOpen, setMovementModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirm()

  const lowStockProducts = localProducts.filter((p) => Number(p.current_stock) <= Number(p.min_stock))

  const filteredProducts = localProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory =
      selectedCategory === 'all' ||
      product.category?.toLowerCase() === selectedCategory.toLowerCase()

    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(localProducts.map((p) => p.category).filter(Boolean)))

  const handleMovementSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await createStockMovement(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setMovementModalOpen(false)
        form.reset()
        router.refresh()
      }
    })
  }

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await updateProduct(formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingProduct(null)
        form.reset()
        router.refresh()
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    confirm(`Deseja realmente remover o produto "${name}" do acervo?`).then(ok => {
      if (!ok) return
      setLocalProducts((prev) => prev.filter((p) => p.id !== id))
      setActionLoadingId(id)
      startTransition(async () => {
        await deleteProduct(id)
        setActionLoadingId(null)
        router.refresh()
      })
    })
  }

  const openMovementForProduct = (productId: string) => {
    setSelectedProductId(productId)
    setErrorMessage(null)
    setMovementModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Estoque & Acervo</h1>
          <p className="text-sm text-[#6e6e73]">
            Controle de louças, mobiliário, reposições e histórico de locações.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setSelectedProductId(products[0]?.id || '')
              setErrorMessage(null)
              setMovementModalOpen(true)
            }}
            className="flex items-center space-x-1.5 rounded-xl border border-[#e5e5ea] bg-white px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft size={14} />
            <span>Lançar Movimentação</span>
          </button>
          <Link
            href="/estoque/novo"
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Novo Produto</span>
          </Link>
        </div>
      </div>

      {/* Alerta de Estoque Baixo */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-[#feeceb] bg-[#fff8f8] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ff3b30]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#ff3b30]">
                {lowStockProducts.length} Itens com Nível de Reposição Baixo
              </h3>
            </div>
            <span className="text-[11px] text-[#cf222e]">Abaixo ou igual ao mínimo de segurança</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => openMovementForProduct(p.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#cf222e] border border-[#fcd7d5] shadow-2xs hover:bg-[#feeceb] transition-colors cursor-pointer"
                title="Clique para dar entrada"
              >
                <span>{p.name}</span>
                <span className="font-semibold">({p.current_stock} un)</span>
                <span className="text-[10px] underline ml-1">+ Repor</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Selector: Produtos vs Histórico de Movimentações */}
      <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
          }`}
        >
          <Package size={15} />
          <span>Itens em Estoque ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'movements'
              ? 'bg-[#1d1d1f] text-white shadow-xs'
              : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
          }`}
        >
          <ArrowRightLeft size={15} />
          <span>Histórico & Movimentações ({movements.length})</span>
        </button>
      </div>

      {activeTab === 'movements' ? (
        <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#f2f2f7]">
            <h3 className="text-sm font-bold text-[#1d1d1f]">
              Histórico Recente de Entradas, Saídas e Retornos
            </h3>
            <p className="text-xs text-[#6e6e73]">
              Acompanhe as saídas para festas, locações, devoluções íntegras e baixas de avarias.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1d1d1f]">
              <thead className="bg-[#f9f9fb] font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
                <tr>
                  <th className="px-5 py-3">Data / Hora</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-center">Tipo</th>
                  <th className="px-5 py-3 text-center">Quantidade</th>
                  <th className="px-5 py-3">Motivo / Vínculo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f2f7]">
                {movements.length > 0 ? (
                  movements.map((mov) => {
                    const isFesta = mov.reason?.toLowerCase().includes('festa') || mov.reason?.toLowerCase().includes('evento')
                    const isLocacao = mov.reason?.toLowerCase().includes('loca')

                    return (
                      <tr key={mov.id} className="hover:bg-[#fbfbfd]">
                        <td className="px-5 py-3 text-[#86868b] whitespace-nowrap">
                          {new Date(mov.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-5 py-3 font-semibold text-[#1d1d1f]">
                          {mov.products?.name || 'Item de Estoque'}
                          {mov.products?.sku && (
                            <span className="block text-[11px] text-[#86868b] font-normal">
                              SKU: {mov.products.sku}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              mov.type === 'in'
                                ? 'bg-[#dcfce7] text-[#15803d]'
                                : mov.type === 'return'
                                ? 'bg-[#e0f2fe] text-[#0369a1]'
                                : mov.type === 'out'
                                ? 'bg-[#fef3c7] text-[#b45309]'
                                : mov.type === 'loss'
                                ? 'bg-[#fee2e2] text-[#b91c1c]'
                                : 'bg-[#f3f4f6] text-[#4b5563]'
                            }`}
                          >
                            {mov.type === 'in'
                              ? 'Entrada'
                              : mov.type === 'return'
                              ? 'Retorno / Devolução'
                              : mov.type === 'out'
                              ? 'Saída'
                              : mov.type === 'loss'
                              ? 'Avaria / Quebra'
                              : 'Ajuste'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center font-bold">
                          <span
                            className={
                              mov.type === 'in' || mov.type === 'return'
                                ? 'text-[#16a34a]'
                                : 'text-[#dc2626]'
                            }
                          >
                            {mov.type === 'in' || mov.type === 'return' ? '+' : '-'}
                            {mov.quantity} un.
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6e6e73]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isFesta && (
                              <span className="bg-[#f3e8ff] text-[#7e22ce] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Festa / Evento
                              </span>
                            )}
                            {isLocacao && (
                              <span className="bg-[#ffedd5] text-[#c2410c] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Locação
                              </span>
                            )}
                            <span>{mov.reason || 'Sem motivo informado'}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[#86868b]">
                      Nenhuma movimentação registrada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Products Table Container */
        <div className="rounded-2xl border border-[#e5e5ea] bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#f2f2f7] p-4 gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-3.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#f5f5f7] p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Todas Categorias ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-[#1d1d1f] shadow-xs'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1d1d1f]">
            <thead className="bg-[#f9f9fb] text-xs font-semibold uppercase tracking-wider text-[#6e6e73] border-b border-[#f2f2f7]">
              <tr>
                <th className="px-5 py-3.5 font-medium w-12">Item</th>
                <th className="px-5 py-3.5 font-medium">Produto</th>
                <th className="px-5 py-3.5 font-medium">SKU</th>
                <th className="px-5 py-3.5 font-medium">Categoria</th>
                <th className="px-5 py-3.5 font-medium text-right">Saldo Físico</th>
                <th className="px-5 py-3.5 font-medium text-right">Locação (R$)</th>
                <th className="px-5 py-3.5 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2f7]">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-[#fbfbfd] transition-colors group">
                    <td
                      className="px-5 py-3.5 cursor-pointer"
                      onClick={() => setPreviewProduct(product)}
                      title="Clique para ver detalhes do produto"
                    >
                      <div className="h-11 w-11 overflow-hidden rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-center hover:scale-105 transition-transform">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-[#86868b]" />
                        )}
                      </div>
                    </td>
                    <td
                      className="px-5 py-3.5 font-medium text-[#1d1d1f] cursor-pointer"
                      onClick={() => setPreviewProduct(product)}
                      title="Clique para ver detalhes do produto"
                    >
                      <div className="flex items-center gap-2 group/title">
                        <span className="group-hover/title:text-[#b8860b] transition-colors">
                          {product.name}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#86868b] opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye size={11} /> Ver
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-5 py-3.5 text-xs font-mono text-[#86868b] cursor-pointer"
                      onClick={() => setPreviewProduct(product)}
                    >
                      {product.sku}
                    </td>
                    <td
                      className="px-5 py-3.5 cursor-pointer"
                      onClick={() => setPreviewProduct(product)}
                    >
                      <span className="inline-flex items-center rounded-lg bg-[#f5f5f7] px-2 py-0.5 text-xs font-medium text-[#6e6e73] capitalize">
                        {product.category || 'Sem categoria'}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right font-medium cursor-pointer ${
                        Number(product.current_stock) <= Number(product.min_stock)
                          ? 'text-[#cf222e] font-semibold'
                          : 'text-[#1d1d1f]'
                      }`}
                      onClick={() => setPreviewProduct(product)}
                    >
                      {product.current_stock} un
                    </td>
                    <td
                      className="px-5 py-3.5 text-right font-semibold text-[#1d1d1f] cursor-pointer"
                      onClick={() => setPreviewProduct(product)}
                    >
                      R${' '}
                      {product.rental_price
                        ? Number(product.rental_price).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })
                        : '0,00'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewProduct(product)}
                          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Visualizar produto com foto maior"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openMovementForProduct(product.id)}
                          className="flex items-center gap-1 text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft size={12} />
                          <span>Movimentar</span>
                        </button>
                        <button
                          onClick={() => {
                            setErrorMessage(null)
                            setEditingProduct(product)
                          }}
                          className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                          title="Editar produto"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          disabled={actionLoadingId === product.id}
                          className="rounded-lg p-1 text-[#86868b] hover:bg-[#feeceb] hover:text-[#ff3b30] transition-colors cursor-pointer"
                          title="Remover produto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#86868b]">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="h-8 w-8 mb-2 text-[#86868b] stroke-[1.5]" />
                      <p className="text-sm font-medium text-[#1d1d1f]">
                        Nenhum item encontrado no estoque
                      </p>
                      <Link
                        href="/estoque/novo"
                        className="mt-3 text-xs font-semibold text-[#1d1d1f] hover:underline"
                      >
                        + Cadastrar o primeiro item
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal Movimentação de Estoque */}
      {movementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">Movimentação de Estoque</h3>
                <p className="text-xs text-[#6e6e73]">
                  Registre entradas, devoluções, quebras ou saídas.
                </p>
              </div>
              <button
                onClick={() => setMovementModalOpen(false)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e]">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleMovementSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Item / Produto *
                </label>
                <select
                  name="product_id"
                  defaultValue={selectedProductId}
                  required
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Saldo atual: {p.current_stock} un)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Tipo de Movimentação *
                </label>
                <select
                  name="type"
                  defaultValue="in"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="in">Entrada / Compra de Reposição (+)</option>
                  <option value="return">Retorno de Locação de Evento (+)</option>
                  <option value="out">Saída para Evento (-)</option>
                  <option value="loss">Perda / Quebra / Avaria (-)</option>
                  <option value="adjustment">Ajuste de Balanço / Inventário (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  name="quantity"
                  required
                  min="1"
                  defaultValue="1"
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Motivo / Observação
                </label>
                <input
                  type="text"
                  name="reason"
                  placeholder="Ex: Compra fornecedor X, Retorno casamento..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Gravando...' : 'Confirmar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Produto */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f2f2f7]">
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f]">Editar Produto</h3>
                <p className="text-xs text-[#6e6e73]">
                  Atualize as informações do item no acervo da Luh Recepções.
                </p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-[#feeceb] bg-[#fff5f5] p-3 text-xs text-[#cf222e]">
                {errorMessage}
              </div>
            )}

            <form
              key={editingProduct.id}
              onSubmit={handleEditSubmit}
              className="mt-5 space-y-4"
            >
              <input type="hidden" name="id" value={editingProduct.id} />

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingProduct.name}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Código SKU *
                  </label>
                  <input
                    type="text"
                    name="sku"
                    required
                    defaultValue={editingProduct.sku}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Categoria
                  </label>
                  <select
                    name="category"
                    defaultValue={editingProduct.category || 'louças'}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  >
                    <option value="louças">Louças</option>
                    <option value="mobiliário">Mobiliário</option>
                    <option value="decoração">Decoração</option>
                    <option value="descartáveis">Descartáveis</option>
                    <option value="bebidas">Bebidas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Estoque Físico Atual *
                  </label>
                  <input
                    type="number"
                    name="current_stock"
                    required
                    min="0"
                    defaultValue={editingProduct.current_stock}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Estoque Mínimo de Segurança
                  </label>
                  <input
                    type="number"
                    name="min_stock"
                    min="0"
                    defaultValue={editingProduct.min_stock}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_price"
                    defaultValue={editingProduct.cost_price || 0}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                    Valor de Locação (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="rental_price"
                    defaultValue={editingProduct.rental_price || 0}
                    className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  />
                </div>
              </div>

              <ImageUploadInput
                key={editingProduct.id}
                defaultImageUrl={editingProduct.image_url}
                label="Foto do Produto (Upload)"
              />

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                  Descrição do Produto
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingProduct.description || ''}
                  placeholder="Descreva as características do item, material, conservação, medidas..."
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all resize-y"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#f2f2f7]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Visualização Detalhada do Produto (Pop-up Responsivo) */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-[#e5e5ea] animate-in zoom-in-95 duration-150 p-5 sm:p-7 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Badges & Close Button */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#f2f2f7] gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider capitalize">
                  {previewProduct.category || 'Item de Acervo'}
                </span>
                <span className="inline-flex items-center rounded-lg bg-[#f9f9fb] border border-[#e5e5ea] px-2 py-0.5 text-xs font-mono text-[#6e6e73]">
                  SKU: {previewProduct.sku}
                </span>
                {Number(previewProduct.current_stock) <= Number(previewProduct.min_stock) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#feeceb] px-2.5 py-0.5 text-xs font-semibold text-[#cf222e]">
                    <AlertTriangle size={12} /> Estoque Baixo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ee] px-2.5 py-0.5 text-xs font-semibold text-[#1a7f37]">
                    <CheckCircle2 size={12} /> Disponível
                  </span>
                )}
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="rounded-xl p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer shrink-0"
                title="Fechar visualização"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="mt-4 space-y-5">
              {/* Foto Maior do Produto com Visualizador Responsivo */}
              <div className="relative w-full rounded-2xl overflow-hidden border border-[#e5e5ea] bg-[#f5f5f7] flex items-center justify-center min-h-[220px] max-h-[380px] group">
                {previewProduct.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewProduct.image_url}
                      alt={previewProduct.name}
                      className="w-full h-full object-contain max-h-[380px] p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                    <a
                      href={previewProduct.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-3 right-3 rounded-xl bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 text-xs font-medium flex items-center gap-1 hover:bg-black/80 transition-colors shadow-sm"
                    >
                      <ExternalLink size={12} />
                      <span>Abrir foto original</span>
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-[#86868b]">
                    <div className="h-16 w-16 rounded-2xl bg-[#ebebee] flex items-center justify-center mb-3">
                      <ImageIcon size={32} className="text-[#86868b]" />
                    </div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">Sem foto cadastrada</p>
                    <p className="text-xs text-[#86868b] mt-1 max-w-xs">
                      Você pode adicionar uma foto de alta resolução clicando em Editar Produto abaixo.
                    </p>
                  </div>
                )}
              </div>

              {/* Título e Descrição */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                  {previewProduct.name}
                </h2>
                <div className="mt-2.5 p-4 rounded-2xl bg-[#f9f9fb] border border-[#f2f2f7]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] block mb-1">
                    Descrição do Item
                  </span>
                  {previewProduct.description ? (
                    <p className="text-xs sm:text-sm text-[#1d1d1f] leading-relaxed whitespace-pre-line">
                      {previewProduct.description}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-[#86868b] leading-relaxed italic">
                      Nenhuma descrição cadastrada para este produto. Clique no botão <strong>Editar Produto</strong> abaixo para adicionar detalhes como material, conservação e dimensões.
                    </p>
                  )}
                </div>
              </div>

              {/* Grid Responsivo de Métricas (2 colunas no celular, 4 no desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Saldo Físico
                  </span>
                  <p className="text-lg sm:text-xl font-bold text-[#1d1d1f] mt-1">
                    {previewProduct.current_stock}{' '}
                    <span className="text-xs font-normal text-[#86868b]">un</span>
                  </p>
                  <span className="text-[11px] text-[#6e6e73] block mt-0.5">Em depósito</span>
                </div>

                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Estoque Mínimo
                  </span>
                  <p className="text-lg sm:text-xl font-bold text-[#1d1d1f] mt-1">
                    {previewProduct.min_stock}{' '}
                    <span className="text-xs font-normal text-[#86868b]">un</span>
                  </p>
                  <span className="text-[11px] text-[#6e6e73] block mt-0.5">Segurança</span>
                </div>

                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#1a7f37] uppercase tracking-wider block">
                    Valor Locação
                  </span>
                  <p className="text-lg sm:text-xl font-bold text-[#1a7f37] mt-1">
                    R${' '}
                    {previewProduct.rental_price
                      ? Number(previewProduct.rental_price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })
                      : '0,00'}
                  </p>
                  <span className="text-[11px] text-[#86868b] block mt-0.5">Por unidade</span>
                </div>

                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider block">
                    Preço de Custo
                  </span>
                  <p className="text-lg sm:text-xl font-bold text-[#1d1d1f] mt-1">
                    R${' '}
                    {previewProduct.cost_price
                      ? Number(previewProduct.cost_price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })
                      : '0,00'}
                  </p>
                  <span className="text-[11px] text-[#86868b] block mt-0.5">Reposição</span>
                </div>
              </div>

              {/* Potencial Bruto Total */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-[#f5f5f7] text-xs gap-2">
                <span className="text-[#6e6e73]">
                  Potencial bruto de locação do lote ({previewProduct.current_stock} unidades):
                </span>
                <span className="font-bold text-sm text-[#1d1d1f]">
                  R${' '}
                  {(
                    Number(previewProduct.current_stock) * Number(previewProduct.rental_price || 0)
                  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Footer Buttons (Totalmente responsivos para mobile e desktop) */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-4 mt-5 border-t border-[#f2f2f7]">
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer w-full sm:w-auto text-center"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  const p = previewProduct
                  setPreviewProduct(null)
                  openMovementForProduct(p.id)
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all shadow-2xs cursor-pointer w-full sm:w-auto"
              >
                <ArrowRightLeft size={14} />
                <span>Lançar Movimentação</span>
              </button>
              <button
                onClick={() => {
                  const p = previewProduct
                  setPreviewProduct(null)
                  setErrorMessage(null)
                  setEditingProduct(p)
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1d1f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#333336] transition-all shadow-xs active:scale-[0.98] cursor-pointer w-full sm:w-auto"
              >
                <Pencil size={14} />
                <span>Editar Produto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
