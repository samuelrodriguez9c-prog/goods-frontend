import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, untracked } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { cop, num, pl } from '../../../../shared/formato';
import { LineaCompra, nivelStock } from '../../../../shared/modelos';
import { productosProveedor, proximaEntrega } from '../../../../shared/proveedores.util';
import { icono } from '../../../../shared/ui/iconos';
import { NIVEL_STOCK, miniaturaDe, soloDigitos } from '../../proveedores.modelo';
import { MarcoModalComponent } from '../marco-modal/marco-modal.component';
import { MiniaturaProductoComponent } from '../miniatura-producto/miniatura-producto.component';

/** Una línea de la compra: marcada, cantidad tal como se escribió y precio unitario. */
interface Linea {
  marcada: boolean;
  cantidad: string;
  precio: number;
}

const cantidadDe = (l: Linea) => +soloDigitos(l.cantidad) || 0;

/**
 * Compra rápida a un proveedor: sus productos (primero los que necesitan
 * reposición) con la cantidad sugerida para llegar al doble del mínimo.
 * Emite `crear` con las líneas marcadas; "Armar en Compras" lleva al formulario completo.
 */
@Component({
  selector: 'app-modal-compra-rapida',
  standalone: true,
  imports: [TablerIconComponent, MarcoModalComponent, MiniaturaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (compra(); as c) {
      <app-marco-modal ancho="amplio" (cerrar)="cerrar.emit()">
        <div class="px-6 pt-5.5 pb-3">
          <div class="pr-7.5 font-[Archivo] text-[20px] font-semibold tracking-[-0.01em] text-[#111827]">Nueva compra · {{ c.proveedor.nombre }}</div>
          <div class="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#6b7280]">
            <tabler-icon [icon]="icono('calendar-event')" [size]="14" />{{ c.entrega }} · Cantidades sugeridas para llegar al doble del mínimo
          </div>
        </div>
        @if (c.filas.length) {
          <div class="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-6 pt-1 pb-3.5">
            @for (f of c.filas; track f.id) {
              <div (click)="cambiar(f.id, { marcada: !f.linea.marcada })"
                class="grid animate-[mov-in_360ms_cubic-bezier(.2,.8,.2,1)_both] cursor-pointer grid-cols-[18px_36px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_0_0_1px_#efefef] transition-[box-shadow] duration-200 ease-[ease] hover:shadow-[0_0_0_1px_#e0e0e0]!"
                [style.animation-delay.ms]="f.retraso">
                <span class="flex size-4.5 shrink-0 items-center justify-center rounded-md text-white transition-[background-color,box-shadow] duration-200 ease-[ease]"
                  [class]="f.linea.marcada ? 'bg-[#303030] shadow-[inset_0_0_0_1.5px_#303030]' : 'bg-white shadow-[inset_0_0_0_1.5px_#c4c4c4]'">
                  @if (f.linea.marcada) {
                    <tabler-icon [icon]="icono('check')" [size]="12" class="animate-[pop_.25s_cubic-bezier(.2,.8,.2,1)]" />
                  }
                </span>
                <app-miniatura-producto [miniatura]="f.miniatura" class="transition-[opacity] duration-200 ease-[ease]" [class.opacity-55]="!f.linea.marcada" />
                <span class="flex min-w-0 flex-col gap-0.5 transition-[opacity] duration-200 ease-[ease]" [class.opacity-55]="!f.linea.marcada">
                  <span class="flex min-w-0 items-center gap-[7px]">
                    <span class="truncate text-[13px] font-semibold text-[#111827]">{{ f.nombre }}</span>
                    <span class="shrink-0 rounded-full px-[7px] text-[10.5px] leading-[17px] font-medium" [class]="nivelStock[f.nivel].clases">{{ nivelStock[f.nivel].texto }}</span>
                  </span>
                  <span class="text-[11.5px] text-[#8a8a8a]">{{ f.stock }} · {{ f.precio }}</span>
                </span>
                <span (click)="$event.stopPropagation()" class="flex flex-col items-end gap-[3px]">
                  <span class="flex items-center gap-0.5 rounded-[9px] bg-[#f1f1f1] p-0.5">
                    <button type="button" (click)="fijarCantidad(f.id, f.cantidad - 1)"
                      class="flex size-6.5 cursor-pointer items-center justify-center rounded-[7px] hover:bg-white!">
                      <tabler-icon [icon]="icono('minus')" [size]="13" />
                    </button>
                    <input [value]="f.linea.cantidad" (input)="cambiar(f.id, { cantidad: soloDigitos($any($event.target).value), marcada: true })" inputmode="numeric"
                      class="h-6.5 w-10.5 rounded-[7px] bg-white text-center text-[13px] font-semibold tabular-nums outline-none" />
                    <button type="button" (click)="fijarCantidad(f.id, f.cantidad + 1)"
                      class="flex size-6.5 cursor-pointer items-center justify-center rounded-[7px] hover:bg-white!">
                      <tabler-icon [icon]="icono('plus')" [size]="13" />
                    </button>
                  </span>
                  <span class="text-[11px] text-[#6b7280] tabular-nums">{{ f.subtotal }}</span>
                </span>
              </div>
            }
          </div>
        } @else {
          <div class="mx-6 mt-1 mb-3.5 rounded-[14px] border border-dashed border-[#e0e0e0] p-6 text-center text-[13px] text-[#6b7280]">
            Todavía no le has comprado nada a este proveedor. Arma la primera compra en Compras.
          </div>
        }
        <div class="flex items-center gap-2.5 border-t border-t-[#f1f1f1] px-6 py-3.5">
          <button type="button" (click)="armarEnCompras.emit()"
            class="cursor-pointer text-[12.5px] font-medium text-[#00605b] underline [text-underline-offset:3px]">Armar en Compras</button>
          <span class="flex-1"></span>
          <span class="flex flex-col items-end">
            <span class="font-[Archivo] text-[16px] font-semibold tabular-nums">{{ c.total }}</span>
            <span class="text-[11px] text-[#9ca3af]">{{ pl(c.lineas.length, 'producto', 'productos') }}</span>
          </span>
          <button type="button" (click)="confirmar()"
            class="flex items-center gap-1.5 rounded-lg bg-[#303030] px-3.5 py-2 text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90!"
            [class]="c.lineas.length ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'">Crear compra pendiente</button>
        </div>
      </app-marco-modal>
    }
  `,
})
export class ModalCompraRapidaComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();
  readonly crear = output<LineaCompra[]>();
  readonly armarEnCompras = output<void>();
  readonly cerrar = output<void>();

  protected readonly icono = icono;
  protected readonly pl = pl;
  protected readonly soloDigitos = soloDigitos;
  protected readonly nivelStock = NIVEL_STOCK;

  /** Productos que se le compran (sin descontinuados). */
  private readonly productos = computed(() =>
    productosProveedor(this.catalogo, this.proveedorId()).filter((x) => x.p.estado !== 'descontinuado'),
  );
  /** Sugerencia al abrir: 2 × mínimo − disponible (marcada si hace falta). Solo se recalcula si cambia el proveedor. */
  private readonly lineas = linkedSignal<Record<number, Linea>>(() => {
    this.proveedorId();
    return untracked(() => {
      const lineas: Record<number, Linea> = {};
      for (const x of this.productos()) {
        const stock = this.catalogo.stockDe(x.p.id), sugerida = Math.max(stock.minimo * 2 - stock.disponible, 0);
        lineas[x.p.id] = { marcada: sugerida > 0, cantidad: String(sugerida || x.ultimaCantidad || 1), precio: x.actual };
      }
      return lineas;
    });
  });

  protected readonly compra = computed(() => {
    const proveedor = this.catalogo.proveedor(this.proveedorId());
    if (!proveedor) return null;
    const lineas = this.lineas(), alDia = (id: number) => Number(nivelStock(this.catalogo.stockDe(id)) === 'ok');
    const productos = [...this.productos()].sort((a, b) => alDia(a.p.id) - alDia(b.p.id) || b.unidades - a.unidades);
    const elegidos = productos.filter((x) => lineas[x.p.id]?.marcada && cantidadDe(lineas[x.p.id]) > 0);
    const entrega = proximaEntrega(proveedor.diasEntrega ?? [], this.catalogo.hoy());
    return {
      proveedor,
      entrega: entrega ? 'Próxima entrega: ' + entrega.texto.toLowerCase() : 'Sin días de entrega definidos',
      lineas: elegidos.map((x) => ({ productoId: x.p.id, cantidad: cantidadDe(lineas[x.p.id]), precioUnitario: lineas[x.p.id].precio })),
      total: cop(elegidos.reduce((t, x) => t + cantidadDe(lineas[x.p.id]) * lineas[x.p.id].precio, 0)),
      filas: productos.map((x, i) => {
        const linea = lineas[x.p.id] ?? { marcada: false, cantidad: '1', precio: x.actual }, stock = this.catalogo.stockDe(x.p.id), cantidad = cantidadDe(linea);
        return {
          id: x.p.id, nombre: x.p.nombre, miniatura: miniaturaDe(x.p, this.catalogo), nivel: nivelStock(stock), linea, cantidad,
          stock: 'Hay ' + num(stock.disponible) + ' · mín. ' + stock.minimo,
          precio: cop(linea.precio) + ' c/u', subtotal: cop(cantidad * linea.precio),
          retraso: Math.min(i, 8) * 30,
        };
      }),
    };
  });

  protected cambiar(productoId: number, cambio: Partial<Linea>): void {
    this.lineas.update((ls) => ({ ...ls, [productoId]: { ...(ls[productoId] ?? { marcada: false, cantidad: '1', precio: 0 }), ...cambio } }));
  }
  protected fijarCantidad(productoId: number, cantidad: number): void {
    this.cambiar(productoId, { cantidad: String(Math.max(0, cantidad)), marcada: cantidad > 0 });
  }
  protected confirmar(): void {
    const lineas = this.compra()?.lineas ?? [];
    if (lineas.length) this.crear.emit(lineas);
  }
}
