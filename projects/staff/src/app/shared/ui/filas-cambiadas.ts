/**
 * Qué filas son nuevas o cambiaron entre dos cargas (LEEME §8, v2).
 * El evento en vivo solo trae `entidad`, así que el diff se hace en cliente.
 * Comparación superficial por JSON — suficiente para filas de tabla planas.
 */
export function filasCambiadas<T, K>(antes: readonly T[], despues: readonly T[], id: (f: T) => K): Set<K> {
  const previas = new Map(antes.map((f) => [id(f), JSON.stringify(f)]));
  const out = new Set<K>();
  for (const f of despues) {
    const k = id(f);
    if (previas.get(k) !== JSON.stringify(f)) out.add(k);
  }
  return out;
}
