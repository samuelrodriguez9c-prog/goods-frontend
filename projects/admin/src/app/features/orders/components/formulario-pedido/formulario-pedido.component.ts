import { ChangeDetectionStrategy, Component, computed, inject, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cop } from '../../../products/shared/formato';
import { BuscadorProductosComponent } from '../buscador-productos/buscador-productos.component';
import { SelectorClienteComponent } from '../selector-cliente/selector-cliente.component';
import { BorradorPedido, CANAL, METODOS, Pedido } from '../../shared/ventas.modelos';
import { VentasStore } from '../../shared/ventas.store';

/**
 * Pedido nuevo o edición de uno pendiente, dentro de la hoja de Pedidos.
 * Pestaña Productos: buscador, líneas y totales. Pestaña Cliente y
 * entrega: cliente, dirección, envío, código, método y notas. El servidor
 * valida stock, código y celular repetido al guardar.
 */
@Component({
  selector: 'app-formulario-pedido',
  standalone: true,
  imports: [BuscadorProductosComponent, SelectorClienteComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5' },
  template: `
    @let d = borrador();
    @if (pestana() === 'productos') {
      <app-buscador-productos [(borrador)]="borrador" [intento]="intento()" [apartado]="apartado()" />
      @let k = calc();
      <div class="flex flex-col gap-[7px] rounded-[14px] bg-[#fafafa] px-4 py-3.5">
        <div class="flex justify-between text-[13px]"><span class="text-gray-500">Subtotal</span><span class="font-medium tabular-nums">{{ cop(k.subtotal) }}</span></div>
        <div class="flex justify-between text-[13px]"><span class="text-gray-500">Envío</span><span class="font-medium tabular-nums" [class.text-gray-400]="!k.envio">{{ k.envio ? cop(k.envio) : 'Sin costo' }}</span></div>
        @if (k.descuento) {
          <div class="flex justify-between text-[13px]"><span class="text-gray-500">Descuento · {{ k.code }}</span><span class="font-medium text-[#087b5d] tabular-nums">−{{ cop(k.descuento) }}</span></div>
        } @else if (k.pendiente) {
          <div class="flex justify-between text-[13px]"><span class="text-gray-500">Descuento · {{ k.code }}</span><span class="text-gray-400">se calcula al guardar</span></div>
        }
        <div class="mt-0.5 flex justify-between border-t border-[#ececec] pt-[9px]">
          <span class="text-[13.5px] font-semibold text-gray-900">Total</span>
          <span class="font-[Archivo] text-[17px] font-semibold text-gray-900 tabular-nums">{{ cop(k.total) }}</span>
        </div>
      </div>
    } @else {
      <div class="flex flex-col gap-4">
        <app-selector-cliente [(borrador)]="borrador" [intento]="intento() && !d.clienteId && d.cliMode === 'existente'" [editando]="!!original()" />
        <div class="grid grid-cols-2 gap-2.5">
          <label class="col-span-2"><span class="gp-label">Dirección de entrega</span>
            <input class="gp-input" placeholder="Vacío = recoge en la tienda" [ngModel]="d.direccion" (ngModelChange)="poner({ direccion: $event })" /></label>
          <label><span class="gp-label">Referencia</span><input class="gp-input" [ngModel]="d.referencia" (ngModelChange)="poner({ referencia: $event })" /></label>
          <label><span class="gp-label">Ciudad</span><input class="gp-input" [ngModel]="d.ciudad" (ngModelChange)="poner({ ciudad: $event })" /></label>
          <label><span class="gp-label">Costo de envío</span>
            <input class="gp-input-num" inputmode="numeric" placeholder="0" [ngModel]="d.costoEnvio" (ngModelChange)="poner({ costoEnvio: $event })" /></label>
          <label><span class="gp-label">Código de descuento</span>
            <input class="gp-input uppercase disabled:opacity-60" [disabled]="!!original()" [ngModel]="d.codigo" (ngModelChange)="poner({ codigo: $event.toUpperCase() })" />
            <span class="mt-1 block text-xs text-gray-400">{{ original() ? (d.codigo ? 'El código no se cambia al editar' : 'Solo al crear el pedido') : 'Se valida al guardar' }}</span>
          </label>
        </div>
        <div>
          <span class="gp-label">Método de pago</span>
          <div class="flex flex-wrap gap-1.5">
            @for (m of metodos; track m) {
              <button type="button" (click)="poner({ metodoPago: m })" class="h-[30px] cursor-pointer rounded-full px-3 text-[12.5px] font-medium"
                [class]="d.metodoPago === m ? 'bg-[#303030] text-white' : 'bg-white text-[#303030] shadow-[inset_0_0_0_1px_#e3e3e3]'">{{ m }}</button>
            }
          </div>
        </div>
        <label><span class="gp-label">Notas del pedido</span>
          <textarea class="gp-input resize-y" rows="2" [ngModel]="d.notas" (ngModelChange)="poner({ notas: $event })"></textarea></label>
        <p class="m-0 text-xs text-gray-400">Canal: {{ canal[d.canal].t }} · {{ canal[d.canal].d }}</p>
      </div>
    }
    @if (error()) {
      <p class="m-0 animate-[fade-in-up_.2s_ease-out] rounded-xl bg-[#fff1f0] px-3 py-2.5 text-[12.5px] text-[#7a1d10]">{{ error() }}</p>
    }
    <div class="flex justify-end gap-2">
      <button type="button" class="gp-btn" (click)="descartar.emit()">Descartar</button>
      <button type="button" class="gp-btn-primario" [disabled]="guardando()" (click)="guardar.emit()">
        {{ guardando() ? 'Guardando…' : original() ? 'Guardar cambios' : 'Crear pedido' }}
      </button>
    </div>
  `,
})
export class FormularioPedidoComponent {
  private readonly v = inject(VentasStore);
  readonly borrador = model.required<BorradorPedido>();
  readonly pestana = input<'productos' | 'cliente'>('productos');
  /** El pedido que se edita (null = nuevo). */
  readonly original = input<Pedido | null>(null);
  readonly intento = input(false);
  readonly error = input('');
  readonly guardando = input(false);
  readonly guardar = output<void>();
  readonly descartar = output<void>();

  protected readonly metodos = METODOS;
  protected readonly canal = CANAL;
  protected readonly cop = cop;
  protected readonly calc = computed(() => this.v.calcular(this.borrador(), this.original()));
  /** Un pendiente que ya apartó stock lo libera al editarse: cuenta como disponible. */
  protected readonly apartado = computed(() => {
    const p = this.original();
    const r: Record<number, number> = {};
    if (p?.stockReservado) for (const it of p.items) r[it.productoId] = (r[it.productoId] ?? 0) + it.cantidad;
    return r;
  });

  protected poner(cambio: Partial<BorradorPedido>): void {
    this.borrador.update((d) => ({ ...d, ...cambio }));
  }
}
