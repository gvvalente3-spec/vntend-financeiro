// Cache simples em memória (padrão stale-while-revalidate).
// As páginas mostram o último dado conhecido instantaneamente e
// revalidam em segundo plano. Vive enquanto o app estiver aberto
// (navegações do Next são SPA); é limpo num reload completo.

type Entrada = { dados: unknown; ts: number };

const store = new Map<string, Entrada>();

export function cacheGet<T>(chave: string): T | null {
  const e = store.get(chave);
  return e ? (e.dados as T) : null;
}

export function cacheSet(chave: string, dados: unknown) {
  store.set(chave, { dados, ts: Date.now() });
}

// Sem prefixo: limpa tudo. Com prefixo: limpa só as chaves daquele grupo.
export function cacheClear(prefixo?: string) {
  if (!prefixo) { store.clear(); return; }
  for (const k of store.keys()) {
    if (k.startsWith(prefixo)) store.delete(k);
  }
}
