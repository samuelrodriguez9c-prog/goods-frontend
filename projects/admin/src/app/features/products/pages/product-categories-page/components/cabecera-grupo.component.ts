import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';

/** Encabezado fijo (sticky) de un grupo de la lista agrupada por estado: Activas / Inactivas. */
@Component({
  selector: 'app-cabecera-grupo',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 z-[3] block w-[calc(100%_-_28px)]' },
  template: `
    <button type="button" (click)="alternar.emit()" class="flex w-full cursor-pointer items-center gap-2.5 bg-[#f1f1f1] pt-3.5 pr-2 pb-2 pl-1 text-left">
      <span
        class="flex size-5.5 shrink-0 items-center justify-center rounded-full"
        [class]="activas() ? 'bg-[#a4ffb6] text-[#0b5c3f]' : 'bg-[#e3e3e3] text-[#4b5563]'"
      >
        <tabler-icon [icon]="activas() ? i.activas : i.inactivas" [size]="13" [stroke]="2" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span class="flex items-center gap-[7px]">
          <span class="text-[13px] font-semibold text-[#111827]">{{ activas() ? 'Activas' : 'Inactivas' }}</span>
          <span class="rounded-full bg-[#e3e3e3] px-[7px] text-[11px] leading-[17px] font-semibold text-[#4b5563] tabular-nums">{{ cuenta() }}</span>
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">
          {{ activas() ? 'Visibles en la tienda' : 'Ocultas en la tienda; sus productos siguen en el admin' }}
        </span>
      </span>
      <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a]">
        <tabler-icon
          [icon]="i.chevron"
          [size]="14"
          [stroke]="2"
          class="transition-[rotate] duration-240 ease-[cubic-bezier(.2,.8,.2,1)]"
          [class.-rotate-90]="!abierto()"
        />
      </span>
    </button>
  `,
})
export class CabeceraGrupoComponent {
  readonly activas = input.required<boolean>();
  readonly cuenta = input.required<number>();
  readonly abierto = input.required<boolean>();
  readonly alternar = output<void>();

  protected readonly i = { activas: icono('eye'), inactivas: icono('eye-off'), chevron: icono('chevron-down') };
}
