import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { cop } from '../../../../../products/shared/formato';
import { relativo } from '../../../../../orders/shared/ventas.formato';
import { Cliente } from '../../../../../orders/shared/ventas.modelos';
import { VentasStore } from '../../../../../orders/shared/ventas.store';

/** Pedidos, total gastado, ticket promedio y último pedido (cifras del servidor). */
@Component({
  selector: 'app-resumen-cliente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2' },
  template: `
    @for (x of cifras(); track x[0]) {
      <div class="flex flex-col gap-1 rounded-[14px] bg-[#fafafa] px-3.5 py-3">
        <span class="text-xs text-[#8a8a8a]">{{ x[0] }}</span>
        <span class="gp-cifra text-[17px]">{{ x[1] }}</span>
      </div>
    }
  `,
})
export class ResumenClienteComponent {
  private readonly v = inject(VentasStore);
  readonly cliente = input.required<Cliente>();
  protected readonly cifras = computed(() => {
    const s = this.v.stats(this.cliente().id);
    return [
      ['Pedidos', String(s.n)],
      ['Total gastado', cop(s.total)],
      ['Ticket promedio', s.ticket ? cop(s.ticket) : '—'],
      ['Último pedido', s.ultimo ? relativo(s.ultimo, this.v.hoy()) : '—'],
    ];
  });
}
