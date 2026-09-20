import { login } from './actions'
import { LockKeyhole } from 'lucide-react'

const errorMessages: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha incorretos.',
  conta_inativa: 'Sua conta está inativa. Contate o administrador.',
  campos_obrigatorios: 'Preencha o e-mail e a senha.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMsg = params.error ? errorMessages[params.error] : null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f7] px-4">
      
      {/* Logo / Marca */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d1d1f] shadow-sm">
          <span className="text-2xl font-bold text-[#d4af37]">L</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
          Luh Recepções
        </h1>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-[#86868b]">
          Sistema Integrado ERP
        </p>
      </div>

      {/* Card de Login */}
      <div className="w-full max-w-sm rounded-3xl border border-[#e5e5ea] bg-white p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
        <div className="mb-6 flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-[#1d1d1f]" />
          <h2 className="text-base font-semibold text-[#1d1d1f]">Acesso ao Sistema</h2>
        </div>

        <form className="space-y-4" action={login}>
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1d1d1f]" htmlFor="email">
                E-mail Corporativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] transition-all focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                placeholder="nome@luhrecepcoes.com.br"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1d1d1f]" htmlFor="password">
                Senha de Acesso
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="block w-full rounded-xl border border-[#d1d1d6] bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] transition-all focus:border-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          {/* Mensagem de erro */}
          {errorMsg && (
            <div className="rounded-xl border border-[#feeceb] bg-[#fff5f5] px-3.5 py-2.5 text-xs font-medium text-[#cf222e]">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-[#1d1d1f] py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#333336] active:scale-[0.98] shadow-xs"
          >
            Entrar no Painel
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-[#86868b]">
        © {new Date().getFullYear()} Luh Recepções · Todos os direitos reservados
      </p>
    </div>
  )
}
