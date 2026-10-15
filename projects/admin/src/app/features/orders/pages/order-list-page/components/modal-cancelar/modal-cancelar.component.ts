import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { pl } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { Pedido } from '../../../../shared/ventas.modelos';

/**
 * Ventana en línea para cancelar el pedido (motivo opcional) o registrar
 * una devolución. El servidor regresa el stock si ya se había descontado.
 */
@Component({
  selector: 'app-modal-cancelar',
  standalone: true,
  imports: [IcComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.2s_ease-out] flex-col gap-3 rounded-[14px] bg-[#fafafa] p-3.5 shadow-[inset_0_0_0_1px_#efefef]' },
  template: `
    @let p = pedido();
    @let cancelar = modo() === 'cancelar';
    <div class="flex items-center justify-between gap-2">
      <span class="text-[13.5px] font-semibold text-gray-900">{{ cancelar ? 'Cancelar el pedido' : 'Registrar devolución' }}</span>
      <button type="button" class="gp-btn-icono size-7" (click)="cerrar.emit()"><app-ic nombre="x" [size]="14" /></button>
    </div>
    <p class="m-0 text-[12.5px] leading-[18px] text-gray-500">
      @if (!cancelar) {
        El stock de los productos vuelve al inventario. El reembolso se marca aparte.
      } @else if (p.estado === 'pendiente') {
        Todavía no descontó stock, así que no hay nada que devolver.
      } @else {
        El stock de {{ pl(p.items.length, 'producto', 'productos') }} vuelve al inventario.
      }
    </p>
    <textarea class="gp-input resize-y leading-[19px]" rows="2" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
      [placeholder]="cancelar ? 'Motivo (opcional) · solo lo ve tu equipo' : '¿Por qué lo devolvió?'"></textarea>
    <div class="flex justify-end gap-2">
      <button type="button" class="gp-btn" (click)="cerrar.emit()">Volver</button>
      <button type="button" [class]="cancelar ? 'gp-btn-primario !bg-[#d82c0d]' : 'gp-btn-primario'" [disabled]="ocupado()" (click)="confirmar.emit(motivo())">
        {{ cancelar ? 'Cancelar pedido' : 'Registrar devolución' }}
      </button>
    </div>
  `,
})
export class ModalCancelarComponent {
  readonly pedido = input.required<Pedido>();
  readonly modo = input.required<'cancelar' | 'devolver'>();
  readonly ocupado = input(false);
  readonly confirmar = output<string>();
  readonly cerrar = output<void>();
  protected readonly motivo = signal('');
  protected readonly pl = pl;
}
