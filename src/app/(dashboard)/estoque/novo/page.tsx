import { createProduct } from './actions'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { ImageUploadInput } from '@/components/ImageUploadInput'

export default async function NovoProdutoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const hasError = Boolean(params.error)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3">
        <Link href="/estoque" className="rounded-xl p-2 text-[#86868b] hover:bg-white hover:text-[#1d1d1f] border border-transparent hover:border-[#e5e5ea] transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Novo Produto</h1>
          <p className="text-sm text-[#6e6e73]">Cadastre um novo item no acervo da Luh Recepções.</p>
        </div>
      </div>

      {hasError && (
        <div className="rounded-2xl border border-[#feeceb] bg-[#fff5f5] p-4 text-xs font-medium text-[#cf222e]">
          Ocorreu um erro ao salvar o produto. Verifique se o código SKU informado já existe no sistema.
        </div>
      )}

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-8 shadow-xs">
        <form action={createProduct} className="space-y-8">
          
          {/* Informações Básicas */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] border-b border-[#f2f2f7] pb-2.5 mb-5">
              Identificação do Item
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  placeholder="Ex: Taça de Cristal Baccarat"
                />
              </div>
              
              <div>
                <label htmlFor="sku" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  SKU / Código Patrimonial *
                </label>
                <input
                  type="text"
                  name="sku"
                  id="sku"
                  required
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                  placeholder="Ex: TAC-CRI-001"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Categoria
                </label>
                <select
                  name="category"
                  id="category"
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                >
                  <option value="louças">Louças</option>
                  <option value="mobiliário">Mobiliário</option>
                  <option value="decoração">Decoração</option>
                  <option value="descartáveis">Descartáveis</option>
                  <option value="bebidas">Bebidas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quantidades */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] border-b border-[#f2f2f7] pb-2.5 mb-5">
              Controle de Estoque
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="current_stock" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Estoque Físico Atual *
                </label>
                <input
                  type="number"
                  name="current_stock"
                  id="current_stock"
                  required
                  min="0"
                  defaultValue="0"
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>
              
              <div>
                <label htmlFor="min_stock" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Estoque Mínimo de Segurança
                </label>
                <input
                  type="number"
                  name="min_stock"
                  id="min_stock"
                  min="0"
                  defaultValue="0"
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] border-b border-[#f2f2f7] pb-2.5 mb-5">
              Precificação
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="cost_price" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Preço de Custo / Reposição (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="cost_price"
                  id="cost_price"
                  min="0"
                  defaultValue="0.00"
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>
              
              <div>
                <label htmlFor="rental_price" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Valor Base de Locação (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="rental_price"
                  id="rental_price"
                  min="0"
                  defaultValue="0.00"
                  className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Imagem com Upload */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] border-b border-[#f2f2f7] pb-2.5 mb-5">
              Mídia do Item
            </h3>
            <div className="sm:col-span-2">
              <ImageUploadInput label="Foto do Produto (Upload)" />
            </div>
          </div>

          {/* Descrição Detalhada */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1d1d1f] border-b border-[#f2f2f7] pb-2.5 mb-5">
              Descrição do Produto
            </h3>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                Descrição do Item
              </label>
              <textarea
                name="description"
                id="description"
                rows={3}
                className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f] transition-all resize-y"
                placeholder="Ex: Taça de cristal trabalhada para espumantes e recepções refinadas. Material nobre, higienização delicada."
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-[#f2f2f7] pt-6">
            <button
              type="submit"
              className="flex items-center space-x-2 rounded-xl bg-[#1d1d1f] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#333336] focus:outline-none transition-all shadow-xs active:scale-[0.98]"
            >
              <Save size={15} strokeWidth={2.2} />
              <span>Salvar Produto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
