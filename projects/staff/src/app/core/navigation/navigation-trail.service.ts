import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const CLAVE_SESSION = 'goods.staff.navTrail';
const MAX_ITEMS = 5;

export interface TrailItem {
  /** Path sin query params: dos visitas a la misma página con distintos
   *  query params son la misma entrada. */
  id: string;
  /** Viene de `route.data['breadcrumb']`. */
  etiqueta: string;
  /** Ícono Tabler en kebab-case (registrado con `provideTablerIcons`), o
   *  `'ia'` para la marca del Asistente de IA (`app-ia-marca`). */
  icono: string;
  /** URL completa, con query params, a la que vuelve el click. */
  href: string;
}

/**
 * Rastro de las últimas páginas visitadas que pinta el topbar
 * (`BreadcrumbTrailComponent`); cada una es clickeable para volver.
 *
 * @remarks
 * Cuenta cada ruta con `data.breadcrumb`, no solo los módulos del sidebar.
 * Funciona como una lista de recientes: revisitar una página la mueve al
 * final en vez de repetirla, con un tope de `MAX_ITEMS`. Se guarda en
 * `sessionStorage` para sobrevivir un F5 y `AuthService.limpiarSesion()`
 * lo vacía con `reiniciar()`.
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
    // Las rutas sin `data.breadcrumb` (como `/login`) no entran al rastro.
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
      // Almacenamiento lleno o deshabilitado (p. ej. navegación privada): el
      // rastro sigue en memoria, solo no sobrevive un F5.
    }
  }

  /** Vacía el rastro en memoria y en `sessionStorage` (lo llama `AuthService.limpiarSesion()`). */
  reiniciar(): void {
    this._trail.set([]);
    try {
      sessionStorage.removeItem(CLAVE_SESSION);
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }
}
