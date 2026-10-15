import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EST, EstadoPedido } from '../../ventas.modelos';

/** Pastilla del estado del pedido (pendiente · confirmado · enviado · entregado · cancelado · devuelto). */
@Component({
  selector: 'app-insignia-estado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex whitespace-nowrap rounded-full px-[7px] text-[11px] font-semibold leading-[18px]',
    '[style.background-color]': 'e().bg',
    '[style.color]': 'e().fg',
  },
  template: `{{ e().t }}`,
})
export class InsigniaEstadoComponent {
  readonly estado = input.required<EstadoPedido>();
  protected readonly e = computed(() => EST[this.estado()]);
}
