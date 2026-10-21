import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { pl } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { relativo } from '../../../../shared/ventas.formato';
import { EST, PUEDE, Pedido, SIGUIENTE } from '../../../../shared/ventas.modelos';
import { VentasStore } from '../../../../shared/ventas.store';
import { AvisoStockComponent } from '../aviso-stock/aviso-stock.component';
import { ModalCancelarComponent } from '../modal-cancelar/modal-cancelar.component';
import { ModalPagoComponent } from '../modal-pago/modal-pago.component';

export type VentanaAccion = 'pagar' | 'reemb' | 'devolver' | 'cancelar';

const SUB_SIGUIENTE: Record<string, (u: number) => string> = {
  confirmado: (u) => `Descuenta ${pl(u, 'unidad', 'unidades')} del inventario`,
  enviado: () => 'El cliente lo tiene en camino',
  entregado: () => 'Cierra el pedido',
};

/**
 * «Próximo paso»: una barra de 40 px sobre #f4f4f2 con el botón oscuro
 * («● Estado actual › Acción», la explicación y el ícono del estado
 * siguiente) y las acciones secundarias como íconos con tooltip (pagar,
 * reembolsar, devolución, cancelar). Sin próximo paso se muestran con
 * texto. Cada una abre debajo su ventana en línea. También muestra el
 * error de stock al confirmar y el motivo de un pedido cancelado o devuelto.
 */
@Component({
  selector: 'app-acciones-pedido',
  standalone: true,
  imports: [IcComponent, ModalPagoComponent, ModalCancelarComponent, AvisoStockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5' },
  template: `
    @let p = pedido();
    @let a = vista();
    @if (a.siguiente || a.sec.length) {
      <div class="flex items-center gap-1 rounded-[14px] bg-[#f4f4f2] p-1 shadow-[inset_0_0_0_1px_#ecebe7]">
        @if (a.siguiente; as nx) {
          <button type="button" (click)="avanzar()" [title]="nx.sub" [disabled]="ocupado()"
            class="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[11px] bg-[#303030] pr-1.5 pl-3 text-left text-white shadow-[inset_0_-1px_0_#000,0_6px_14px_-8px_rgba(0,0,0,.5)] transition-[background-color,transform,opacity] duration-200 hover:bg-[#1a1a1a] active:scale-[.985] disabled:cursor-wait disabled:opacity-70">
            <span class="flex shrink-0 items-center gap-1.5 text-[11.5px] text-[#a3a3a3]">
              <span class="size-[7px] rounded-full" [style.background-color]="a.actual.dot"></span>{{ a.actual.t }}<app-ic nombre="chevron-right" [size]="12" class="text-[#6b6b6b]" />
            </span>
            <span class="shrink-0 text-[13px] font-semibold">{{ nx.texto }}</span>
            <span class="min-w-0 flex-1 truncate text-[11.5px] text-[#9a9a9a]">{{ nx.sub }}</span>
            <span class="flex size-7 shrink-0 items-center justify-center rounded-lg" [style.background-color]="nx.fondo" [style.color]="nx.tinta">
              <app-ic [nombre]="ocupado() ? 'clock' : nx.ic" [size]="15" />
            </span>
          </button>
        }
        @for (b of a.sec; track b.k) {
          <button type="button" (click)="alternar(b.k)" [title]="b.t"
            class="flex h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[11px] px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-[background-color,box-shadow] duration-200 hover:bg-white hover:shadow-[0_1px_2px_rgba(0,0,0,.08)]"
            [style.color]="b.c" [style.background-color]="ventana() === b.k ? '#fff' : null">
            <app-ic [nombre]="b.ic" [size]="17" />
            @if (a.conEtiqueta) {
              <span>{{ b.t }}</span>
            }
          </button>
        }
      </div>
    }

    @switch (ventana()) {
      @case ('pagar') {
        <app-modal-pago [pedido]="p" modo="pagar" [ocupado]="ocupado()" (confirmar)="pagar($event)" (cerrar)="ventana.set(null)" />
      }
      @case ('reemb') {
        <app-modal-pago [pedido]="p" modo="reemb" [ocupado]="ocupado()" (confirmar)="reembolsar()" (cerrar)="ventana.set(null)" />
      }
      @case ('cancelar') {
        <app-modal-cancelar [pedido]="p" modo="cancelar" [ocupado]="ocupado()" (confirmar)="salida('cancelado', $event)" (cerrar)="ventana.set(null)" />
      }
      @case ('devolver') {
        <app-modal-cancelar [pedido]="p" modo="devolver" [ocupado]="ocupado()" (confirmar)="salida('devuelto', $event)" (cerrar)="ventana.set(null)" />
      }
    }

    @if (a.error) {
      <app-aviso-stock [mensaje]="a.error" [editable]="p.estado === 'pendiente'" (editar)="editar.emit()" (cerrar)="v.limpiarError(p.id)" />
    }
    @if (p.estado === 'cancelado') {
      <div class="flex gap-2.5 rounded-[14px] bg-[#f4f4f4] px-3.5 py-3">
        <app-ic nombre="circle-x" [size]="17" class="text-gray-500" />
        <span class="flex flex-col gap-0.5">
          <span class="text-[13px] font-semibold text-gray-700">Cancelado {{ p.canceladoEn ? rel(p.canceladoEn) : '' }}</span>
          <span class="text-[12.5px] text-gray-500">{{ p.motivoCancelacion ? '«' + p.motivoCancelacion + '»' : 'Sin motivo' }}</span>
        </span>
      </div>
    }
    @if (p.estado === 'devuelto') {
      <div class="flex gap-2.5 rounded-[14px] bg-[#fff1f0] px-3.5 py-3">
        <app-ic nombre="undo" [size]="17" class="text-[#b42318]" />
        <span class="flex flex-col gap-0.5">
          <span class="text-[13px] font-semibold text-[#7a1d10]">Devuelto · el stock volvió al inventario</span>
          @if (motivoDevolucion()) {
            <span class="text-[12.5px] text-[#9a3b2c]">«{{ motivoDevolucion() }}»</span>
          }
        </span>
      </div>
    }
  `,
})
export class AccionesPedidoComponent {
  protected readonly v = inject(VentasStore);
  readonly pedido = input.required<Pedido>();
  readonly editar = output<void>();

  /** Ventana abierta debajo de la barra; se cierra al cambiar de pedido. */
  readonly ventana = linkedSignal<number, VentanaAccion | null>({ source: () => this.pedido().id, computation: () => null });
  protected readonly ocupado = computed(() => this.v.ocupado(this.pedido().id));
  protected readonly rel = (iso: string) => relativo(iso, this.v.hoy());
  protected readonly motivoDevolucion = computed(
    () => [...this.pedido().eventos].reverse().find((x) => x.tipo === 'estado' && x.estado === 'devuelto')?.motivo ?? '',
  );

  protected readonly vista = computed(() => {
    const p = this.pedido(), nx = SIGUIENTE[p.estado], u = p.items.reduce((a, it) => a + it.cantidad, 0);
    const sec = (
      [
        [p.estadoPago === 'pendiente' && p.estado !== 'cancelado', 'cash', 'Marcar pagado', 'pagar', '#087b5d'],
        [p.estadoPago === 'pagado', 'receipt-refund', 'Reembolsar', 'reemb', '#4b5563'],
        [p.estado === 'entregado', 'undo', 'Registrar devolución', 'devolver', '#4b5563'],
        [PUEDE[p.estado].includes('cancelado'), 'circle-x', 'Cancelar pedido', 'cancelar', '#b42318'],
      ] as [boolean, string, string, VentanaAccion, string][]
    )
      .filter((x) => x[0])
      .map(([, ic, t, k, c]) => ({ ic, t, k, c }));
    return {
      siguiente: nx ? { texto: nx[1], ic: nx[2], sub: SUB_SIGUIENTE[nx[0]](u), fondo: EST[nx[0]].bg, tinta: EST[nx[0]].fg } : null,
      actual: { t: EST[p.estado].t, dot: EST[p.estado].bar },
      sec,
      conEtiqueta: !nx,
      error: this.v.errores()[p.id] ?? '',
    };
  });

  /** También lo abre el menú «Más acciones» de la hoja. */
  abrir(k: VentanaAccion): void {
    this.ventana.set(k);
  }

  protected alternar(k: VentanaAccion): void {
    this.ventana.update((x) => (x === k ? null : k));
  }

  protected avanzar(): void {
    const nx = SIGUIENTE[this.pedido().estado];
    if (nx) void this.v.cambiarEstado(this.pedido().id, nx[0]);
  }

  protected async pagar(metodo: string): Promise<void> {
    if (await this.v.marcarPagado(this.pedido().id, metodo)) this.ventana.set(null);
  }

  protected async reembolsar(): Promise<void> {
    if (await this.v.reembolsar(this.pedido().id)) this.ventana.set(null);
  }

  protected async salida(dest: 'cancelado' | 'devuelto', motivo: string): Promise<void> {
    if (await this.v.cambiarEstado(this.pedido().id, dest, motivo)) this.ventana.set(null);
  }
}
