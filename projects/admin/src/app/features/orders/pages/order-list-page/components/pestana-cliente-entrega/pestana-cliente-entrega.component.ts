import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { cop, pl } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { completa, iniCliente, tel } from '../../../../shared/ventas.formato';
import { Pedido, tonoCliente } from '../../../../shared/ventas.modelos';
import { VentasStore } from '../../../../shared/ventas.store';

/**
 * Pestaña Cliente y entrega: tarjeta del cliente (llamar, WhatsApp, correo,
 * ver ficha), datos de entrega y pagos registrados.
 */
@Component({
  selector: 'app-pestana-cliente-entrega',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3.5' },
  template: `
    @let p = pedido();
    @let ce = vista();
    <div class="gp-tarjeta flex flex-col gap-3.5">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-xl font-[Archivo] text-sm font-semibold" [style.background-color]="ce.tono[0]" [style.color]="ce.tono[1]">{{ ce.ini }}</span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[14px] font-semibold text-gray-900">{{ p.cliente.nombre }}</span>
          <span class="text-xs text-gray-500">{{ ce.st }}</span>
        </span>
        <button type="button" class="gp-btn" (click)="verCliente.emit()">Ver ficha<app-ic nombre="arrow-right" [size]="13" /></button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        @if (p.cliente.telefono) {
          <a class="gp-btn" [href]="'tel:+' + p.cliente.telefono"><app-ic nombre="phone" [size]="14" />{{ tel(p.cliente.telefono) }}</a>
          <button type="button" class="gp-btn" (click)="whatsapp.emit()"><app-ic nombre="whatsapp" [size]="14" [class]="ce.wa ? 'text-[#25d366]' : ''" />WhatsApp</button>
        }
        @if (p.cliente.correo) {
          <a class="gp-btn" [href]="'mailto:' + p.cliente.correo"><app-ic nombre="mail" [size]="14" />{{ p.cliente.correo }}</a>
        }
      </div>
    </div>
    <div class="gp-tarjeta flex flex-col gap-1">
      <div class="gp-seccion">Entrega</div>
      @for (e of ce.entrega; track e[1]) {
        <div class="flex items-start gap-2.5 border-b border-[#f4f4f4] py-2 last:border-b-0">
          <app-ic [nombre]="e[0]" [size]="15" class="mt-px text-gray-400" />
          <span class="flex flex-col gap-px">
            <span class="text-xs text-[#8a8a8a]">{{ e[1] }}</span>
            <span class="text-[13px]" [style.color]="e[3] ? '#9ca3af' : '#111827'">{{ e[2] }}</span>
          </span>
        </div>
      }
      <p class="m-0 mt-1 text-xs text-gray-500">{{ ce.envio }}</p>
    </div>
    <div class="gp-tarjeta flex flex-col gap-2">
      <div class="gp-seccion">Pago</div>
      @if (!p.detalle) {
        <span class="h-9 animate-[gp-brillo_1.4s_linear_infinite] rounded-lg [background:linear-gradient(90deg,#f1f1f1_0,#f7f7f7_80px,#f1f1f1_160px)] [background-size:320px_100%]"></span>
      } @else {
        @for (x of p.pagos; track $index) {
          <div class="flex items-center justify-between gap-2.5 text-[13px]">
            <span class="flex flex-col">
              <span class="font-medium">{{ x.estado === 'reembolsado' ? 'Reembolso' : 'Pago' }}</span>
              <span class="text-xs text-gray-500">{{ x.metodo }} · {{ completa(x.en) }}</span>
            </span>
            <span class="font-semibold tabular-nums" [style.color]="x.monto < 0 ? '#b42318' : '#087b5d'">{{ x.monto < 0 ? '−' : '' }}{{ cop(x.monto < 0 ? -x.monto : x.monto) }}</span>
          </div>
        } @empty {
          <p class="m-0 text-[12.5px] text-gray-400">Todavía no hay pagos registrados.</p>
        }
      }
    </div>
  `,
})
export class PestanaClienteEntregaComponent {
  private readonly v = inject(VentasStore);
  readonly pedido = input.required<Pedido>();
  readonly verCliente = output<void>();
  readonly whatsapp = output<void>();
  protected readonly cop = cop;
  protected readonly tel = tel;
  protected readonly completa = completa;

  protected readonly vista = computed(() => {
    const p = this.pedido(), c = this.v.cliente(p.clienteId), st = this.v.stats(p.clienteId), de = p.direccionEnvio;
    return {
      tono: tonoCliente(p.clienteId),
      ini: iniCliente(p.cliente.nombre),
      st: `${pl(st.n, 'pedido', 'pedidos')} · ${cop(st.total)} en total`,
      wa: !!c?.whatsappContactoId,
      entrega: [
        ['map-pin', 'Dirección', de?.direccion || 'Recoge en la tienda', !de?.direccion],
        ['alert-triangle', 'Referencia', de?.referencia || 'Sin referencia', !de?.referencia],
        ['store', 'Ciudad', de?.ciudad || '—', !de?.ciudad],
        ['phone', 'Teléfono de entrega', de?.telefono ? tel(de.telefono) : p.cliente.telefono ? tel(p.cliente.telefono) : '—', !de?.telefono && !p.cliente.telefono],
      ] as [string, string, string, boolean][],
      envio: p.costoEnvio ? cop(p.costoEnvio) + ' de envío' : 'Sin costo de envío',
    };
  });
}
