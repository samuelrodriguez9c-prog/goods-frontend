import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const CLAVE_SESSION = 'goods.admin.navTrail';
/** La página anterior y la actual, para dejar lugar al buscador del topbar. */
const MAX_ITEMS = 2;

export interface TrailItem {
  /** Path sin query params: la misma página con otros params es la misma entrada. */
  id: string;
  /** La página con su sección delante si es una subpágina: «Clientes», «Productos · Compras». */
  etiqueta: string;
  /** Ícono Tabler en kebab-case (registrado en `provideTablerIcons`), o `'ia'` para la marca del asistente. */
  icono: string;
  /** URL completa (con query params) a la que vuelve el clic. */
  href: string;
  /** Si está, el clic hace esto en vez de navegar (cerrar la hoja abierta). */
  accion?: () => void;
}

/** Registro abierto en la hoja de una página con lista: la última miga. */
interface MigaHoja {
  texto: string;
  cerrar: () => void;
}

/**
 * Migas del topbar: la página en la que estuviste y en la que estás
 * («Pedidos › Clientes»), y el registro abierto en la hoja si hay uno
 * («Pedidos › Clientes › Ana Gómez»).
 *
 * @remarks
 * - Funciona como una lista de recientes: volver a una página la mueve al
 *   final en vez de duplicarla. Se guarda en `sessionStorage` (sobrevive a
 *   un F5 en la misma pestaña) y se vacía al cerrar sesión.
 * - El nombre de cada página sale de las rutas activas: cada nivel con
 *   `data.breadcrumb` propio (en `routeConfig`) se suma, unidos con « · »
 *   («Productos · Compras», «Configuración · Usuarios»); la sección y su
 *   página principal con el mismo texto cuentan una vez. Para una página
 *   nueva basta con ponerle `data: { breadcrumb, icon }` a su ruta.
 * - Las páginas con lista y hoja suman el registro abierto con
 *   `migaDeHoja`; mientras está abierto, la miga de la página lo cierra.
 */
@Injectable({ providedIn: 'root' })
export class NavigationTrailService {
  private readonly router = inject(Router);

  private readonly _trail = signal<TrailItem[]>(this.leerGuardado());
  private readonly hoja = signal<MigaHoja | null>(null);
  readonly trail = computed<TrailItem[]>(() => {
    const base = this._trail(), h = this.hoja();
    const pagina = base.at(-1);
    if (!h || !pagina) return base;
    return [
      ...base.slice(0, -1),
      { ...pagina, accion: h.cerrar },
      { id: pagina.id + '#hoja', etiqueta: h.texto, icono: '', href: pagina.href },
    ];
  });

  constructor() {
    this.registrar();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.registrar());
  }

  private registrar(): void {
    const nueva = this.paginaActual();
    // Las rutas sin `data.breadcrumb` (como `/login`) no se registran.
    if (!nueva) return;
    const trail = [...this._trail().filter((i) => i.id !== nueva.id), nueva].slice(-MAX_ITEMS);
    this._trail.set(trail);
    this.guardar(trail);
  }

  private paginaActual(): TrailItem | null {
    const niveles: { etiqueta: string; icono: string }[] = [];
    let actual: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let id = '';
    while (actual) {
      const d = actual.routeConfig?.data as { breadcrumb?: string; icon?: string } | undefined;
      if (d?.breadcrumb && niveles.at(-1)?.etiqueta !== d.breadcrumb) niveles.push({ etiqueta: d.breadcrumb, icono: d.icon ?? 'building' });
      if (!actual.firstChild) id = '/' + actual.pathFromRoot.flatMap((r) => r.url.map((s) => s.path)).join('/');
      actual = actual.firstChild;
    }
    if (!niveles.length) return null;
    return { id, etiqueta: niveles.map((n) => n.etiqueta).join(' · '), icono: niveles.at(-1)!.icono, href: this.router.url };
  }

  private leerGuardado(): TrailItem[] {
    try {
      const raw = sessionStorage.getItem(CLAVE_SESSION);
      return raw ? (JSON.parse(raw) as TrailItem[]) : [];
    } catch {
      return [];
    }
  }

  private guardar(trail: TrailItem[]): void {
    try {
      sessionStorage.setItem(CLAVE_SESSION, JSON.stringify(trail.map(({ accion: _a, ...i }) => i)));
    } catch {
      // Storage lleno o deshabilitado: el rastro sigue en memoria, solo no sobrevive a un F5.
    }
  }

  /** Pone (o quita, con `null`) el registro abierto en la hoja. Ver `migaDeHoja`. */
  fijarHoja(h: MigaHoja | null): void {
    this.hoja.set(h);
  }

  /** Quita la miga de la hoja si sigue siendo la de esa página (al salir de ella). */
  soltarHoja(cerrar: () => void): void {
    if (this.hoja()?.cerrar === cerrar) this.hoja.set(null);
  }

  /** Vacía las migas. Lo llama `AuthService.limpiarSesion()`. */
  reiniciar(): void {
    this._trail.set([]);
    this.hoja.set(null);
    try {
      sessionStorage.removeItem(CLAVE_SESSION);
    } catch {
      // no-op
    }
  }
}

/**
 * Para las páginas con lista y hoja: suma como última miga el registro
 * abierto (`texto` devuelve `null` si no hay ninguno) y hace que la miga de
 * la página lo cierre con `cerrar`. Se llama en el constructor.
 *
 * @example
 * migaDeHoja(() => (this.sel() ? `#${this.sel()!.numero}` : null), () => this.cerrar());
 */
export function migaDeHoja(texto: () => string | null, cerrar: () => void): void {
  const rastro = inject(NavigationTrailService);
  // Una sola referencia: con ella se reconoce la hoja de esta página al salir.
  const cerrarHoja = () => cerrar();
  effect(() => {
    const t = texto();
    untracked(() => rastro.fijarHoja(t ? { texto: t, cerrar: cerrarHoja } : null));
  });
  inject(DestroyRef).onDestroy(() => rastro.soltarHoja(cerrarHoja));
}
