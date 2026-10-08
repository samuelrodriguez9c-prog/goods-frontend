import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { RealtimeService } from './realtime.service';

/**
 * Punto del sidebar (LEEME §8, v2 — en `admin` desde 2026-10-07, el backend
 * emite `datos:cambio` también a la sala de la Empresa): marca las rutas con cambios en vivo que
 * el usuario NO está viendo. Se limpia al entrar a esa ruta.
 *
 * Mismo evento `datos:cambio` que `CambiosEnVivoService`, pero acá sí hace
 * falta la `entidad` para decidir qué items marcar. Las listas de entidades
 * son las mismas que cada página ya pasa a `huboCambio([...])`.
 * `'*'` = cualquier entidad (Auditoría registra toda escritura).
 */
const ENTIDADES_POR_RUTA: Record<string, string[]> = {
  '/orders': ['pedido', 'pago'],
  '/products': ['producto', 'inventario'],
  '/products/categorias': ['categoria'],
  '/products/inventario': ['inventario', 'producto'],
  '/products/proveedores': ['proveedor'],
  '/products/compras': ['compra', 'inventario'],
  '/discounts': ['descuento'],
  '/messages': ['chat'],
  '/settings/usuarios': ['usuario', 'rol'],
  '/settings/roles': ['rol', 'permiso'],
  '/settings/solicitudes': ['missolicitudes'],
};

@Injectable({ providedIn: 'root' })
export class CambiosPendientesService {
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);

  readonly rutas = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.realtime
      .escuchar<{ entidad: string }>('datos:cambio')
      .pipe(takeUntilDestroyed())
      .subscribe(({ entidad }) => {
        const actual = this.rutaActual();
        const tocadas = Object.entries(ENTIDADES_POR_RUTA)
          .filter(([ruta, ents]) => !this.esActual(ruta, actual) && (ents.includes('*') || ents.includes(entidad)))
          .map(([ruta]) => ruta);
        if (tocadas.length) this.rutas.update((s) => new Set([...s, ...tocadas]));
      });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        const actual = this.rutaActual();
        if ([...this.rutas()].some((r) => this.esActual(r, actual))) {
          this.rutas.update((s) => new Set([...s].filter((r) => !this.esActual(r, actual))));
        }
      });
  }

  tiene(ruta: string): boolean {
    return this.rutas().has(ruta);
  }

  /** En `admin` las rutas tienen dos niveles (`/products/compras`,
   *  `/settings/usuarios`): se compara la ruta completa, no el primer tramo. */
  private rutaActual(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  private esActual(ruta: string, actual: string): boolean {
    return ruta === actual;
  }
}
