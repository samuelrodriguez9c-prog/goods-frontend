import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Error al confirmar (409 del servidor: no alcanza el stock), con salida a
 * editar las cantidades o a Inventario.
 */
@Component({
  selector: 'app-aviso-stock',
  standalone: true,
  imports: [IcComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] gap-3 rounded-[14px] bg-[#fff1f0] px-3.5 py-3 shadow-[inset_0_0_0_1px_#ffd2cc]' },
  template: `
    <app-ic nombre="alert-triangle" [size]="18" class="mt-px text-[#d82c0d]" />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <span class="text-[13px] leading-[19px] text-[#7a1d10]">{{ mensaje() }}</span>
      <div class="flex flex-wrap gap-1.5">
        @if (editable()) {
          <button type="button" class="gp-btn !bg-white" (click)="editar.emit()"><app-ic nombre="pencil" [size]="14" />Editar cantidades</button>
        }
        <a class="gp-btn !bg-white" routerLink="/products/inventario"><app-ic nombre="packages" [size]="14" />Ajustar inventario</a>
      </div>
    </div>
    <button type="button" class="gp-btn-icono size-7 self-start" (click)="cerrar.emit()"><app-ic nombre="x" [size]="14" /></button>
  `,
})
export class AvisoStockComponent {
  readonly mensaje = input.required<string>();
  readonly editable = input(true);
  readonly editar = output<void>();
  readonly cerrar = output<void>();
}
