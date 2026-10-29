import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { UsuarioService } from '../usuarios/usuario.service';

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
/** De quién son los atajos guardados en este navegador (para no pasárselos a otra cuenta). */
const CLAVE_DUENO = 'goods.atajos.de';

/**
 * Atajos de teclado personalizables. Solo se guardan los que el usuario
 * cambió, en su cuenta (`PUT /usuarios/me/atajos`, vuelven en `/auth/me`):
 * lo acompañan en cualquier navegador. localStorage (`goods.atajos`) es solo
 * una copia para tenerlos al instante al abrir, antes de que llegue el perfil.
 *
 * @remarks
 * Si la cuenta todavía no tiene atajos pero este navegador sí (los que se
 * guardaban solo aquí, de esta misma persona), se suben a la cuenta una vez.
 *
 * Los «G luego …» y los de una tecla son dos espacios separados: la P de
 * «G luego P» no choca con una P de la lista. Si la tecla elegida ya la usa
 * otro atajo del mismo espacio, se intercambian.
 */
@Injectable({ providedIn: 'root' })
export class AtajosService {
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly propios = signal<Partial<Record<AtajoId, string>>>(this.leer());

  constructor() {
    // Cada vez que llega el perfil (inicio de sesión, recarga, otra cuenta).
    effect(() => {
      const u = this.auth.currentUser();
      if (!u) return;
      untracked(() => {
        const cuenta = soloConocidos(u.atajos ?? {});
        const locales = this.leer();
        if (!Object.keys(cuenta).length && Object.keys(locales).length && this.leerDueno() === null) {
          // Los de antes de guardarse en la cuenta: se suben una vez.
          this.guardar(locales);
        } else {
          this.propios.set(cuenta);
          this.copiaLocal(cuenta);
        }
        this.escribir(CLAVE_DUENO, String(u.id));
      });
    });
  }

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
   * Valida la tecla capturada y, si sirve, la asigna.
   *
   * @returns `error` con el mensaje para la Pista si no sirve; si se aplicó,
   * un objeto vacío o `intercambiado` con la tecla que le quedó al otro atajo.
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
    this.copiaLocal(u);
    // Sin sesión (no debería pasar) o si falla, quedan en este navegador.
    if (this.auth.currentUser()) this.usuarios.guardarAtajos(u as Record<string, string>).subscribe({ error: () => undefined });
  }

  private copiaLocal(u: Partial<Record<AtajoId, string>>): void {
    this.escribir(CLAVE, JSON.stringify(u));
  }

  private escribir(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }

  private leerDueno(): string | null {
    try {
      return localStorage.getItem(CLAVE_DUENO);
    } catch {
      return null;
    }
  }

  private leer(): Partial<Record<AtajoId, string>> {
    try {
      return soloConocidos(JSON.parse(localStorage.getItem(CLAVE) || '{}'));
    } catch {
      return {};
    }
  }
}

/** Solo atajos que existen y de una tecla (lo guardado puede venir de otra versión). */
function soloConocidos(x: Record<string, unknown>): Partial<Record<AtajoId, string>> {
  return Object.fromEntries(
    Object.entries(x).filter(([k, v]) => k in ATAJOS_POR_DEFECTO && typeof v === 'string' && v.length === 1),
  ) as Partial<Record<AtajoId, string>>;
}

/** Cómo se muestra una tecla en un <kbd>. */
export const verTecla = (t: string) => (t === '/' ? '/' : t.toUpperCase());
