import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const CLAVE_SESSION = 'goods.staff.navTrail';
const MAX_ITEMS = 5;

export interface TrailItem {
  /** Identificador estable del módulo/página — el path SIN query params
   *  (ej. '/empresas', '/settings'). Se usa para dedupe/`track`: dos
   *  visitas a la misma página con distintos query params (ej. Settings
   *  con `?seccion=perfil` vs `?seccion=seguridad`) son la MISMA entrada,
   *  no dos. */
  id: string;
  /** Texto a mostrar — viene de `route.data['breadcrumb']`. */
  etiqueta: string;
  /** Nombre de ícono Tabler en kebab-case (resuelto contra el registro
   *  global de `provideTablerIcons`, mismo mecanismo que
   *  `SidebarComponent.navItems`), o `'ia'` para el ícono de marca del
   *  Asistente de IA (`app-ia-marca`, no es un ícono Tabler). */
  icono: string;
  /** URL completa (con query params) a la que navegar al hacer click —
   *  se actualiza in-place cuando cambian los query params de la página
   *  ACTIVA (misma `id`), sin crear una entrada nueva ni reordenar. */
  href: string;
}

/**
 * Rastro de navegación global (rediseño del topbar, 2026-10-02) —
 * "breadcrumb" de los últimos módulos/páginas visitados, pintado por
 * `BreadcrumbTrailComponent` dentro de `TopbarComponent` y clickeable
 * para volver a cualquiera. Reemplaza el breadcrumb fijo que antes
 * existía, hardcodeado, solo en la pantalla del Asistente de IA (ver
 * `PROPUESTA_ASISTENTE_IA_RAG.md` §5.4.4 "Unificación del topbar") — acá
 * se generaliza para cualquier pantalla de `staff`.
 *
 * Unidad de rastro: CADA RUTA (`route.data['breadcrumb']`), no solo los
 * 11 módulos de primer nivel del sidebar — pedido explícito del usuario
 * ("cada página/ruta distinta"). Hoy eso da el mismo resultado que "solo
 * módulos de primer nivel" porque ningún feature de `staff` tiene
 * todavía una ruta hija real (detalle/sub-página, ej. `/empresas/:id`):
 * cada `*.routes.ts` solo define `{ path: '' }`. El mecanismo ya queda
 * listo para cuando algún módulo sume una, sin tener que tocar esto de
 * nuevo.
 *
 * Dedupe por `id`: revisitar un módulo ya presente en el rastro lo MUEVE
 * al final (más reciente) en vez de dejar una entrada duplicada — mismo
 * criterio que una lista MRU ("most recently used") de pestañas/archivos
 * recientes, así nunca se ve el mismo nombre dos veces. Tope de
 * `MAX_ITEMS` = 5 entradas (el usuario pidió "mínimo 3"; 5 lo cubre sin
 * saturar el topbar).
 *
 * Persiste en `sessionStorage` (sobrevive un F5 dentro de la misma
 * pestaña del navegador) — se vacía explícitamente al hacer logout
 * (`AuthService.limpiarSesion()` llama a `reiniciar()`) para que una
 * sesión de otra cuenta en la misma pestaña no herede el rastro de la
 * anterior.
 */
@Injectable({ providedIn: 'root' })
export class NavigationTrailService {
  private readonly router = inject(Router);

  private readonly _trail = signal<TrailItem[]>(this.leerGuardado());
  readonly trail = this._trail.asReadonly();

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.registrar(e.urlAfterRedirects));
  }

  private registrar(url: string): void {
    const datos = this.datosRutaActiva();
    // Rutas sin `data.breadcrumb` (hoy, solo `/login`) no se registran.
    if (!datos.breadcrumb) return;

    const id = url.split('?')[0];
    const nueva: TrailItem = {
      id,
      etiqueta: datos.breadcrumb,
      icono: datos.icon ?? 'building',
      href: url,
    };
    const sinEsa = this._trail().filter((i) => i.id !== id);
    const trail = [...sinEsa, nueva].slice(-MAX_ITEMS);
    this._trail.set(trail);
    this.guardar(trail);
  }

  /** Camina el árbol de rutas activadas hasta la más profunda, quedándose
   *  con el último `data.breadcrumb` definido en el camino (un hijo sin
   *  `data` propio hereda el del padre más cercano que sí lo tenga). */
  private datosRutaActiva(): { breadcrumb?: string; icon?: string } {
    let actual: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let datos: { breadcrumb?: string; icon?: string } = {};
    while (actual) {
      const d = actual.data as { breadcrumb?: string; icon?: string };
      if (d.breadcrumb) datos = d;
      actual = actual.firstChild;
    }
    return datos;
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
      sessionStorage.setItem(CLAVE_SESSION, JSON.stringify(trail));
    } catch {
      // Almacenamiento lleno/deshabilitado (ej. navegación privada) — el
      // rastro sigue funcionando en memoria para el resto de la sesión,
      // solo no sobrevive un F5.
    }
  }

  /** Vacía el rastro — llamado desde `AuthService.limpiarSesion()` al
   *  hacer logout. */
  reiniciar(): void {
    this._trail.set([]);
    try {
      sessionStorage.removeItem(CLAVE_SESSION);
    } catch {
      // no-op
    }
  }
}
