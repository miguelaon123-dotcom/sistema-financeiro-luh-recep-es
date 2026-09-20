'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Plus, ArrowUpCircle, ArrowDownCircle, PackagePlus, CalendarPlus, UserPlus, Maximize2, Minimize2 } from 'lucide-react'
import Link from 'next/link'

export function Header({ email, name, role }: { email: string; name: string; role: string }) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sincroniza o ícone quando o usuário sai do fullscreen pelo ESC ou F11 nativo
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Atalho F11 no teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setQuickOpen(false)
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#e5e5ea] bg-white px-8 relative z-20">
      {/* Search Bar */}
      <div className="flex flex-1 items-center">
        <form action="/financeiro" method="GET" className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-[#86868b]" />
          </div>
          <input
            type="text"
            name="q"
            className="block w-full rounded-xl border border-transparent bg-[#f5f5f7] py-2 pl-10 pr-4 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:border-[#d1d1d6] focus:bg-white focus:outline-none transition-all duration-150"
            placeholder="Buscar eventos, clientes ou produtos..."
          />
        </form>
      </div>

      {/* Right side actions */}
      <div className="flex items-center space-x-3" ref={dropdownRef}>
        {/* Quick Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setQuickOpen(!quickOpen)
              setNotificationsOpen(false)
            }}
            className="flex items-center space-x-1.5 rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#333336] active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Ação Rápida</span>
          </button>

          {quickOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#e5e5ea] bg-white p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                Adicionar Novo
              </div>
              <Link
                href="/financeiro?action=nova-receita"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                <ArrowUpCircle size={16} className="text-[#34c759]" />
                <span>Nova Receita</span>
              </Link>
              <Link
                href="/financeiro?action=nova-despesa"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                <ArrowDownCircle size={16} className="text-[#ff3b30]" />
                <span>Nova Despesa</span>
              </Link>
              <Link
                href="/estoque/novo"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                <PackagePlus size={16} className="text-[#b8860b]" />
                <span>Novo Item no Estoque</span>
              </Link>
              <Link
                href="/eventos?action=novo-evento"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                <CalendarPlus size={16} className="text-[#0071e3]" />
                <span>Novo Evento / Recepção</span>
              </Link>
              <Link
                href="/clientes?action=novo-cliente"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
              >
                <UserPlus size={16} className="text-[#86868b]" />
                <span>Novo Cliente / Contato</span>
              </Link>
            </div>
          )}
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'}
          className="rounded-xl p-2 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <div className="h-5 w-px bg-[#e5e5ea] mx-1"></div>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen)
              setQuickOpen(false)
            }}
            className="relative rounded-xl p-2 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4af37]"></span>
            </span>
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#e5e5ea] bg-white p-3 shadow-lg animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-[#f2f2f7] mb-2 px-1">
                <span className="text-xs font-semibold text-[#1d1d1f]">Notificações do Sistema</span>
                <span className="text-[10px] text-[#34c759] font-medium bg-[#e8f8ee] px-2 py-0.5 rounded-full">Ativo</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-xl bg-[#f9f9fb] border border-[#f2f2f7]">
                  <p className="font-medium text-[#1d1d1f]">ERP Luh Recepções 100% Online</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">Banco de dados Supabase conectado com sucesso.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 pl-2">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-semibold text-[#1d1d1f] leading-tight">{name || 'Usuário'}</span>
            <span className="text-[11px] text-[#86868b] capitalize">{role}</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-xs font-semibold text-[#1d1d1f] shadow-none">
            {email.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  )
}
