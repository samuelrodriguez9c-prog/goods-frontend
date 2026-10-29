import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Cabecera de la ficha: kicker, «n de N», ↑ ↓, slot de menú ⋯, página completa
 * y cerrar. Va arriba del contenido de la ficha (`flex-[0_0_100%]`).
 */
@Component({
  selector: 'app-ficha-barra',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: '-mb-2.5 flex min-w-0 flex-[0_0_100%] items-center gap-1' },
  template: `
    <span
      class="min-w-0 flex-1 truncate text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#9ca3af]"
      >{{ kicker() }}</span
    >
    <span
      class="mr-1 min-w-0 shrink overflow-hidden whitespace-nowrap text-[11.5px] tabular-nums text-[#9ca3af]"
      >{{ pos() }} de {{ total() }}</span
    >
    <button
      type="button"
      (click)="anterior.emit()"
      title="Anterior (↑)"
      [style.opacity]="pos() > 1 ? 1 : 0.35"
      class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
    >
      <app-ic nombre="chevron-up" />
    </button>
    <button
      type="button"
      (click)="siguiente.emit()"
      title="Siguiente (↓)"
      [style.opacity]="pos() < total() ? 1 : 0.35"
      class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
    >
      <app-ic nombre="chevron-down" />
    </button>
    <ng-content />
    <button
      type="button"
      (click)="completa.emit()"
      [title]="enCompleta() ? 'Volver a la lista (F)' : 'Abrir en página completa (F)'"
      class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
    >
      <app-ic [nombre]="enCompleta() ? 'arrows-diagonal-minimize-2' : 'arrows-diagonal'" />
    </button>
    <button
      type="button"
      (click)="cerrar.emit()"
      title="Cerrar (Esc)"
      class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
    >
      <app-ic nombre="x" />
    </button>
  `,
})
export class FichaBarraComponent {
  readonly kicker = input('');
  readonly pos = input(0);
  readonly total = input(0);
  readonly enCompleta = input(false);
  readonly anterior = output<void>();
  readonly siguiente = output<void>();
  readonly completa = output<void>();
  readonly cerrar = output<void>();
}
