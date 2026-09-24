'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Wallet,
  Package,
  CalendarDays,
  ClipboardList,
  Truck,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UtensilsCrossed,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Financeiro', href: '/financeiro', icon: Wallet },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Locações', href: '/locacoes', icon: ClipboardList },
  { name: 'Eventos', href: '/eventos', icon: CalendarDays },
  { name: 'Degustações', href: '/degustacoes', icon: UtensilsCrossed },
  { name: 'Fornecedores', href: '/fornecedores', icon: Truck },
  { name: 'Funcionários', href: '/funcionarios', icon: UserCheck },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Pré-carrega ativamente todas as rotas no navegador na montagem inicial
  useEffect(() => {
    navigation.forEach((item) => {
      try {
        router.prefetch(item.href)
      } catch {}
    })
  }, [router])

  return (
    <aside
      className={`relative flex flex-col border-r border-[#e5e5ea] bg-white transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-[#f2f2f7]">
        {!collapsed && (
          <div className="flex items-center min-w-0 flex-1 py-1">
            <Image
              src="/logo-luh.png"
              alt="Luh Recepções"
              width={180}
              height={60}
              className="object-contain w-auto h-13 max-w-[170px] transition-all"
              priority
            />
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex items-center justify-center py-1">
            <Image
              src="/logo-luh.png"
              alt="Luh"
              width={48}
              height={48}
              className="object-contain w-11 h-11 transition-all"
              priority
            />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors flex-shrink-0 cursor-pointer"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              onMouseEnter={() => {
                try {
                  router.prefetch(item.href)
                } catch {}
              }}
              onMouseDown={() => {
                try {
                  router.prefetch(item.href)
                } catch {}
              }}
              className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold'
                  : 'text-[#6e6e73] hover:bg-[#f5f5f7]/80 hover:text-[#1d1d1f]'
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon
                className={`flex-shrink-0 transition-colors ${collapsed ? 'mx-auto' : 'mr-3'} ${
                  isActive ? 'text-[#1d1d1f]' : 'text-[#86868b] group-hover:text-[#1d1d1f]'
                }`}
                size={18}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-5 border-t border-[#f2f2f7] pt-3">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#ff3b30] transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className={`flex-shrink-0 transition-colors ${collapsed ? '' : 'mr-3'}`} size={18} strokeWidth={1.8} />
            {!collapsed && <span>Encerrar Sessão</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
