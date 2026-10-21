import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const CLAVE_SESSION = 'goods.admin.navTrail';
/** Solo las 2 últimas, para dejar lugar al buscador del topbar. */
const MAX_ITEMS = 2;

export interface TrailItem {
  /** Path sin query params: la misma página con otros params es la misma entrada. */
  id: string;
  /** Sale de `route.data['breadcrumb']`. */
  etiqueta: string;
  /** Ícono Tabler en kebab-case (registrado en `provideTablerIcons`), o `'ia'` para la marca del asistente. */
  icono: string;
  /** URL completa (con query params) a la que vuelve el clic. */
  href: string;
}

/**
 * Rastro de las últimas páginas visitadas que pinta el topbar, una entrada
 * por ruta con `data.breadcrumb`.
 *
 * @remarks
 * Funciona como una lista de recientes: volver a una página la mueve al
 * final en vez de duplicarla. Se guarda en `sessionStorage` (sobrevive a un
 * F5 en la misma pestaña) y se vacía al cerrar sesión para que otra cuenta
 * no herede el rastro.
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
    // Las rutas sin `data.breadcrumb` (como `/login`) no se registran.
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

  /** Se queda con el último `data.breadcrumb` del camino: un hijo sin `data` hereda el del padre. */
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
      // Storage lleno o deshabilitado: el rastro sigue en memoria, solo no sobrevive a un F5.
    }
  }

  /** Vacía el rastro. Lo llama `AuthService.limpiarSesion()`. */
  reiniciar(): void {
    this._trail.set([]);
    try {
      sessionStorage.removeItem(CLAVE_SESSION);
    } catch {
      // no-op
    }
  }
}
