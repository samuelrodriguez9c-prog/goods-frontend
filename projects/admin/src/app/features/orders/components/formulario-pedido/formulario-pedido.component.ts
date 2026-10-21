import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cop } from '../../../products/shared/formato';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { TarjetaIconoComponent } from '../../../products/shared/ui/tarjeta-icono/tarjeta-icono.component';
import { BuscadorProductosComponent } from '../buscador-productos/buscador-productos.component';
import { SelectorClienteComponent } from '../selector-cliente/selector-cliente.component';
import { erroresCampos } from '../../../../core/campos/campo-personalizado.model';
import { CamposPropiosComponent } from '../../../../shared/ui/campos-propios/campos-propios.component';
import { BorradorPedido, CANAL, METODOS, Pedido } from '../../shared/ventas.modelos';
import { VentasStore } from '../../shared/ventas.store';

/**
 * Pedido nuevo o edición de uno pendiente, dentro de la hoja de Pedidos.
 * Pestaña Productos: buscador, líneas y totales. Pestaña Cliente y
 * entrega: cliente, dirección, envío, código, método y notas. El servidor
 * valida stock, código y celular repetido al guardar. El error y los
 * botones van en el pie fijo de la hoja (`app-pie-formulario`, en la página).
 */
@Component({
  selector: 'app-formulario-pedido',
  standalone: true,
  imports: [BuscadorProductosComponent, SelectorClienteComponent, TarjetaIconoComponent, IcComponent, FormsModule, CamposPropiosComponent],
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
      <app-tarjeta-icono icono="user" titulo="Cliente" sub="Quién hace el pedido.">
        <app-selector-cliente [(borrador)]="borrador" [intento]="intento() && !d.clienteId && d.cliMode === 'existente'" [editando]="!!original()" />
      </app-tarjeta-icono>
      <app-tarjeta-icono icono="truck-delivery" titulo="Entrega" sub="Déjala vacía si recoge en la tienda.">
        <div class="grid grid-cols-2 gap-2.5">
          <label class="col-span-2"><span class="gp-label">Dirección de entrega</span>
            <input class="gp-input" placeholder="Vacío = recoge en la tienda" [ngModel]="d.direccion" (ngModelChange)="poner({ direccion: $event })" /></label>
          <label><span class="gp-label">Referencia</span><input class="gp-input" placeholder="Portería, color de la reja…" [ngModel]="d.referencia" (ngModelChange)="poner({ referencia: $event })" /></label>
          <label><span class="gp-label">Ciudad</span><input class="gp-input" [ngModel]="d.ciudad" (ngModelChange)="poner({ ciudad: $event })" /></label>
          <label class="col-span-2"><span class="gp-label">Costo de envío</span>
            <input class="gp-input-num" inputmode="numeric" placeholder="0" [ngModel]="d.costoEnvio" (ngModelChange)="poner({ costoEnvio: $event })" /></label>
        </div>
      </app-tarjeta-icono>
      <app-tarjeta-icono icono="cash" titulo="Pago y notas" sub="El método queda registrado; el cobro va por fuera.">
        <div>
          <span class="gp-label">Método de pago</span>
          <div class="flex flex-wrap gap-1.5">
            @for (m of metodos; track m) {
              <button type="button" (click)="poner({ metodoPago: m })" class="h-[30px] cursor-pointer rounded-full px-3 text-[12.5px] font-medium"
                [class]="d.metodoPago === m ? 'bg-[#303030] text-white' : 'bg-white text-[#303030] shadow-[inset_0_0_0_1px_#e3e3e3]'">{{ m }}</button>
            }
          </div>
        </div>
        <label><span class="gp-label">Código de descuento</span>
          <input class="gp-input uppercase disabled:opacity-60" [disabled]="!!original()" [ngModel]="d.codigo" (ngModelChange)="poner({ codigo: $event.toUpperCase() })" />
          <span class="mt-1 block text-xs text-gray-400">{{ original() ? (d.codigo ? 'El código no se cambia al editar' : 'Solo al crear el pedido') : 'Se valida al guardar' }}</span>
        </label>
        <label><span class="gp-label">Notas del pedido</span>
          <textarea class="gp-input resize-y" rows="2" placeholder="Ej. Es para un cumpleaños" [ngModel]="d.notas" (ngModelChange)="poner({ notas: $event })"></textarea></label>
        <span class="flex items-center gap-1.5 text-xs text-gray-400"><app-ic nombre="route" [size]="13" />Canal: {{ canal[d.canal].t }} · {{ canal[d.canal].d }}</span>
      </app-tarjeta-icono>
      @if (v.camposPedido().length) {
        <app-tarjeta-icono icono="forms" titulo="Campos propios" sub="Los datos que tu negocio guarda de cada pedido.">
          <app-campos-propios [campos]="v.camposPedido()" [valores]="d.atributos" [errores]="erroresAtributos()" [mostrarErrores]="intento()" (cambio)="ponerAtributo($event.clave, $event.valor)" />
        </app-tarjeta-icono>
      }
    }
  `,
})
export class FormularioPedidoComponent {
  protected readonly v = inject(VentasStore);
  readonly borrador = model.required<BorradorPedido>();
  readonly pestana = input<'productos' | 'cliente'>('productos');
  /** El pedido que se edita (null = nuevo). */
  readonly original = input<Pedido | null>(null);
  readonly intento = input(false);

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

  protected readonly erroresAtributos = computed(() => erroresCampos(this.borrador().atributos, this.v.camposPedido()));

  protected poner(cambio: Partial<BorradorPedido>): void {
    this.borrador.update((d) => ({ ...d, ...cambio }));
  }

  protected ponerAtributo(clave: string, valor: string): void {
    this.borrador.update((d) => ({ ...d, atributos: { ...d.atributos, [clave]: valor } }));
  }
}
