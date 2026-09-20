import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const PUBLIC_ROUTES = ['/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // Rotas estáticas e de API passam sem verificação
  const isStaticOrApi =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // arquivos estáticos (favicon, images, etc)

  if (isStaticOrApi) return NextResponse.next()

  const sessionToken = request.cookies.get('luh_session')?.value

  // Sem token → redirecionar para login (exceto se já está na rota pública)
  if (!sessionToken) {
    if (isPublicRoute) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verificar e validar o JWT
  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET)

    // Token válido — se tentar acessar /login, mandar para o dashboard
    if (isPublicRoute) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Injetar user_id e role nos headers para que os Server Components possam usar
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.userId as string)
    requestHeaders.set('x-user-role', payload.role as string)
    requestHeaders.set('x-user-name', payload.name as string)
    requestHeaders.set('x-user-email', payload.email as string)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    // Token inválido ou expirado → limpar cookie e redirecionar para login
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('luh_session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
