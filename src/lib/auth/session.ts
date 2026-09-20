import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// Chave secreta lida do ambiente (NUNCA hardcode)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const COOKIE_NAME = 'luh_session'
const COOKIE_OPTIONS = {
  httpOnly: true,        // JavaScript não pode ler o cookie
  secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
  sameSite: 'strict' as const, // Proteção CSRF
  maxAge: 60 * 60 * 8,  // 8 horas de sessão
  path: '/',
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
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
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
