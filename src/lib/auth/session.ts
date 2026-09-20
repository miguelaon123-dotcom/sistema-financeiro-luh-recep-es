import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Chave secreta lida do ambiente (NUNCA hardcode)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const COOKIE_NAME = 'luh_session'

const SESSION_8H  = 60 * 60 * 8          // 8 horas
const SESSION_30D = 60 * 60 * 24 * 30   // 30 dias

function buildCookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: rememberMe ? SESSION_30D : SESSION_8H,
    path: '/',
  }
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: string
}

/**
 * Cria um JWT e salva no cookie HttpOnly
 */
export async function createSession(payload: SessionPayload, rememberMe = false) {
  const expirationTime = rememberMe ? '30d' : '8h'
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, buildCookieOptions(rememberMe))
}

/**
 * Lê e verifica o JWT do cookie
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    // Token inválido ou expirado
    return null
  }
}

/**
 * Destrói a sessão (logout)
 */
export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
