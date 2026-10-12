import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProductoService } from '../../../../core/producto/producto.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { pl } from '../../shared/formato';
import { MenuActivo } from './menu-activo';

export type OrdenProductos = 'nombre' | 'precio' | 'stock';
type Asignacion = readonly [productoId: number, categoriaId: number | null];

/**
 * Estado de la pestaña Productos de la hoja (sobrevive al cambiar de pestaña)
 * y el "mover a otra categoría" con Deshacer, que también usa la barra de selección.
 */
@Injectable()
export class ProductosCategoria {
  private readonly s = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);
  private readonly productosApi = inject(ProductoService);
  private readonly menu = inject(MenuActivo);

  readonly busqueda = signal('');
  readonly orden = signal<OrdenProductos>('nombre');
  readonly seleccion = signal<ReadonlySet<number>>(new Set());
  /** Grupos (subcategorías) plegados. */
  readonly plegados = signal<ReadonlySet<number>>(new Set());
  readonly agregando = signal(false);
  readonly busquedaAgregar = signal('');

  /** Al abrir otra categoría. */
  reiniciar(): void {
    this.seleccion.set(new Set());
    this.agregando.set(false);
    this.busqueda.set('');
  }

  alternarSeleccion(id: number): void {
    this.seleccion.update((s) => alternar(s, id));
  }
  alternarGrupo(id: number): void {
    this.plegados.update((s) => alternar(s, id));
  }

  /** Cambia la categoría de productos (PATCH /productos/:id) con Deshacer. */
  mover(ids: number[], destino: number | null, verbo: string): void {
    if (!ids.length || this.s.niega('productos.editar')) return;
    const antes: Asignacion[] = this.s.productos().filter((x) => ids.includes(x.id)).map((x) => [x.id, x.categoriaId]);
    const despues: Asignacion[] = ids.map((id) => [id, destino]);
    this.aplicar(despues);
    this.seleccion.set(new Set());
    this.menu.cerrar();
    this.enviar(despues).then(
      () =>
        this.alertas.mostrar({
          estado: 'success',
          titulo: pl(ids.length, 'producto', 'productos') + ' ' + verbo,
          accion: {
            label: 'Deshacer',
            ejecutar: () => {
              this.aplicar(antes);
              this.enviar(antes).then(
                () => this.alertas.mostrar({ estado: 'success', titulo: 'Cambio deshecho' }),
                () => this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo deshacer' }),
              );
            },
          },
        }),
      () => {
        this.aplicar(antes);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo mover', texto: pl(ids.length, 'producto', 'productos') });
      },
    );
  }

  /** Mueve los productos seleccionados. */
  moverSeleccion(destino: number | null, verbo: string): void {
    this.mover([...this.seleccion()], destino, verbo);
  }

  private aplicar(pares: Asignacion[]): void {
    const m = new Map(pares);
    this.s.productos.update((xs) => xs.map((x) => (m.has(x.id) ? { ...x, categoriaId: m.get(x.id)! } : x)));
  }
  private enviar(pares: Asignacion[]) {
    return Promise.all(pares.map(([id, categoriaId]) => firstValueFrom(this.productosApi.actualizar(id, { categoriaId }))));
  }
}

function alternar(s: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const n = new Set(s);
  if (!n.delete(id)) n.add(id);
  return n;
}
