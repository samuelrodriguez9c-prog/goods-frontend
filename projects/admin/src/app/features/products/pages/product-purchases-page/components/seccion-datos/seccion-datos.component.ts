import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';

/** Bloque de la pestaña Datos: ícono, título y explicación; el contenido va debajo. */
@Component({
  selector: 'app-seccion-datos',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col border-b border-b-[#f1f1f1] pt-1 pb-4.5', '[class]': "apretada() ? 'gap-3' : 'gap-4'" },
  template: `
    <div class="flex items-start gap-3">
      <span class="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]">
        <tabler-icon [icon]="icono()" [size]="17" [stroke]="2" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{ titulo() }}</span>
        <span class="text-[12px] leading-[17px] text-[#8a8a8a]">{{ detalle() }}</span>
      </span>
    </div>
    <ng-content />
  `,
})
export class SeccionDatosComponent {
  readonly icono = input.required<TablerIcon>();
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  /** Menos espacio entre la cabecera y el contenido. */
  readonly apretada = input(false);
}
