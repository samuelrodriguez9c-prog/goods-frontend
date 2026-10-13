import { Injectable, computed, signal } from '@angular/core';

/** Atajos personalizables. Los fijos (Ctrl+…, Esc, flechas, Inicio/Fin, doble clic) no están acá. */
export type AtajoId =
  | 'buscar' | 'nuevo' | 'filtros' | 'vista' | 'expandir' | 'marcar' | 'sig' | 'ant'
  | 'goP' | 'goC' | 'goI' | 'goR' | 'goM';

export const ATAJOS_POR_DEFECTO: Record<AtajoId, string> = {
  buscar: '/', nuevo: 'n', filtros: 'f', vista: 'v', expandir: 'e', marcar: 'x', sig: 'j', ant: 'k',
  // segunda tecla después de G
  goP: 'p', goC: 'c', goI: 'i', goR: 'r', goM: 'm',
};

/** Reservadas para los atajos de una sola tecla: G abre la navegación, ? y . la guía. */
const RESERVADAS = ['g', '?', '.'];
const CLAVE = 'goods.atajos';

/**
 * Atajos del panel (handoff-productos §4). Solo se guardan los que el usuario
 * cambió, en localStorage (`goods.atajos`) — no hay endpoint todavía.
 *
 * Los "G luego …" y los de una tecla son dos espacios separados: la P de
 * "G luego P" no choca con una P de la lista. Si la tecla elegida ya la usa
 * otro atajo del mismo espacio, se intercambian.
 */
@Injectable({ providedIn: 'root' })
export class AtajosService {
  private readonly propios = signal<Partial<Record<AtajoId, string>>>(this.leer());

  readonly teclas = computed(() => ({ ...ATAJOS_POR_DEFECTO, ...this.propios() }) as Record<AtajoId, string>);
  readonly personalizados = computed(
    () => (Object.keys(this.propios()) as AtajoId[]).filter((k) => this.propios()[k] !== ATAJOS_POR_DEFECTO[k]),
  );
  /** Atajo esperando su nueva tecla (el diálogo muestra "Presiona una tecla"). */
  readonly capturando = signal<AtajoId | null>(null);
  /** Guía abierta. La abre Ctrl + . o el ítem "Atajos" del sidebar (`atajos.guia.set(true)`). */
  readonly guia = signal(false);

  esPersonalizado(id: AtajoId): boolean {
    return this.personalizados().includes(id);
  }

  /**
   * Valida la tecla capturada. Devuelve un mensaje para la Pista si no sirve,
   * o `null` si se aplicó. `intercambiado` = tecla con la que quedó el otro atajo.
   */
  aplicar(id: AtajoId, e: KeyboardEvent): { error?: string; intercambiado?: string } {
    const tecla = (e.key || '').toLowerCase();
    const nav = id.startsWith('go');
    if (e.ctrlKey || e.metaKey || e.altKey || tecla.length !== 1 || tecla === ' ' || (!nav && RESERVADAS.includes(tecla))) {
      return { error: 'Usa una sola tecla, sin Ctrl ni Alt' + (nav ? '' : '. G, ? y . están reservadas') };
    }
    const K = this.teclas();
    const otro = (Object.keys(K) as AtajoId[]).find((x) => x !== id && x.startsWith('go') === nav && K[x] === tecla);
    const u = { ...this.propios(), [id]: tecla };
    if (otro) u[otro] = K[id];
    this.guardar(u);
    return otro ? { intercambiado: K[id] } : {};
  }

  /** Sin id: restablece todos. */
  restablecer(id?: AtajoId): void {
    if (!id) return this.guardar({});
    const u = { ...this.propios() };
    delete u[id];
    this.guardar(u);
  }

  private guardar(u: Partial<Record<AtajoId, string>>): void {
    this.propios.set(u);
    this.capturando.set(null);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(u));
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }

  private leer(): Partial<Record<AtajoId, string>> {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || '{}');
    } catch {
      return {};
    }
  }
}

/** Cómo se muestra una tecla en un <kbd>. */
export const verTecla = (t: string) => (t === '/' ? '/' : t.toUpperCase());
