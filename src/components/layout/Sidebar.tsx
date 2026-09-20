'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Package,
  CalendarDays,
  ClipboardList,
  Users,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Financeiro', href: '/financeiro', icon: Wallet },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Locações', href: '/locacoes', icon: ClipboardList },
  { name: 'Eventos', href: '/eventos', icon: CalendarDays },
  { name: 'Funcionários', href: '/funcionarios', icon: UserCheck },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={`relative flex flex-col border-r border-[#e5e5ea] bg-white transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-6 border-b border-[#f2f2f7]">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white font-semibold text-sm shadow-sm">
              <span className="text-[#d4af37]">L</span>
            </div>
            <div>
              <h1 className="truncate text-base font-semibold tracking-tight text-[#1d1d1f] leading-none">
                Luh Recepções
              </h1>
              <span className="text-[11px] font-medium tracking-wider uppercase text-[#86868b]">
                Gestão ERP
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors"
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
              className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f] shadow-none'
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
