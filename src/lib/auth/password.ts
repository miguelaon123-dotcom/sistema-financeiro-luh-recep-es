import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12 // Alto custo computacional = resistente a força bruta

/**
 * Gera o hash bcrypt de uma senha.
 * Use isso APENAS no servidor (Server Action ou API Route).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

/**
 * Verifica se uma senha plain bate com um hash armazenado.
 * Retorna true/false. Tempo constante (resistente a timing attacks).
 */
export async function verifyPassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash)
}
