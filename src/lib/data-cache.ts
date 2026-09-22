/**
 * In-memory fast cache para resposta instantânea (sub-1ms).
 * O cache é invalidado automaticamente em qualquer mutação de dados.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<any>>()
const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutos (dados instantâneos da memória, sempre atualizados via invalidateCache)

export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL
): Promise<T> {
  const cached = memoryCache.get(key)
  const now = Date.now()
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data
  }
  const data = await fetcher()
  memoryCache.set(key, { data, timestamp: now })
  return data
}

export function invalidateCache(keys?: string[]) {
  if (!keys || keys.length === 0) {
    memoryCache.clear()
  } else {
    for (const k of keys) {
      for (const mapKey of memoryCache.keys()) {
        if (mapKey.includes(k)) {
          memoryCache.delete(mapKey)
        }
      }
    }
  }
}
