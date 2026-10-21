import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { cop } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { METODOS, Pedido } from '../../../../shared/ventas.modelos';

/**
 * Ventana en línea (debajo de «Próximo paso») para marcar el pedido como
 * pagado, con el método, o como reembolsado. El cobro se hace por fuera de Goods.
 */
@Component({
  selector: 'app-modal-pago',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.2s_ease-out] flex-col gap-3 rounded-[14px] bg-[#fafafa] p-3.5 shadow-[inset_0_0_0_1px_#efefef]' },
  template: `
    @let p = pedido();
    <div class="flex items-center justify-between gap-2">
      <span class="text-[13.5px] font-semibold text-gray-900">{{ modo() === 'pagar' ? 'Marcar como pagado' : 'Marcar como reembolsado' }}</span>
      <button type="button" class="gp-btn-icono size-7" (click)="cerrar.emit()"><app-ic nombre="x" [size]="14" /></button>
    </div>
    @if (modo() === 'pagar') {
      <span class="text-xs text-gray-500">¿Cómo pagó?</span>
      <div class="flex flex-wrap gap-1.5">
        @for (m of metodos; track m) {
          <button type="button" (click)="metodo.set(m)" class="h-[30px] cursor-pointer rounded-full px-3 text-[12.5px] font-medium transition-colors"
            [class]="metodo() === m ? 'bg-[#303030] text-white' : 'bg-white text-[#303030] shadow-[inset_0_0_0_1px_#e3e3e3]'">{{ m }}</button>
        }
      </div>
    } @else {
      <p class="m-0 text-[12.5px] leading-[18px] text-gray-500">Se registra la devolución de {{ cop(p.total) }}{{ p.metodoPago ? ' por ' + p.metodoPago : '' }}. El dinero se devuelve por fuera de Goods.</p>
    }
    <div class="flex justify-end gap-2">
      @if (modo() !== 'pagar') {
        <button type="button" class="gp-btn" (click)="cerrar.emit()">Volver</button>
      }
      <button type="button" class="gp-btn-primario" [disabled]="ocupado()" (click)="confirmar.emit(metodo())">
        {{ modo() === 'pagar' ? 'Marcar pagado · ' + cop(p.total) : 'Marcar reembolsado' }}
      </button>
    </div>
  `,
})
export class ModalPagoComponent {
  readonly pedido = input.required<Pedido>();
  readonly modo = input.required<'pagar' | 'reemb'>();
  readonly ocupado = input(false);
  readonly confirmar = output<string>();
  readonly cerrar = output<void>();
  protected readonly metodos = METODOS;
  /** Arranca con el método que ya tenía el pedido. */
  protected readonly metodo = linkedSignal<string>(() => (METODOS as string[]).includes(this.pedido().metodoPago) ? this.pedido().metodoPago : 'Efectivo');
  protected readonly cop = cop;
}
