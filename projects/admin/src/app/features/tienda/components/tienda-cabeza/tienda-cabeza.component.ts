import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TablerIcon, TablerIconComponent } from '@tabler/icons-angular';

/** Encabezado de una tarjeta: ícono, título y ayuda. Una acción opcional va como contenido, a la derecha. */
@Component({
  selector: 'app-tienda-cabeza',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="flex items-start gap-3">
      <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"><tabler-icon [icon]="icono()" [size]="17" [stroke]="1.75" /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{ titulo() }}</span><span class="text-xs leading-[17px] text-[#8a8a8a]">{{ sub() }}</span></span>
      <ng-content />
    </div>
  `,
})
export class TiendaCabezaComponent {
  readonly icono = input.required<TablerIcon>();
  readonly titulo = input.required<string>();
  readonly sub = input('');
}
