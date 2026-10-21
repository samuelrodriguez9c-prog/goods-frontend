import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EstadoPago, PAGO } from '../../ventas.modelos';

/** Punto de color + estado del pago («Por cobrar», «Pagado», «Reembolsado»), con el método si se pasa. */
@Component({
  selector: 'app-insignia-pago',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1.5 whitespace-nowrap font-medium', '[style.color]': 'p().fg' },
  template: `<span class="size-1.5 rounded-full" [style.background-color]="p().dot"></span>{{ p().corto }}@if (metodo()) { · {{ metodo() }} }`,
})
export class InsigniaPagoComponent {
  readonly estado = input.required<EstadoPago>();
  readonly metodo = input('');
  protected readonly p = computed(() => PAGO[this.estado()]);
}
