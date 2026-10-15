import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OpcionPopover } from '../../modelos';
import { IcComponent } from '../ic/ic.component';

/**
 * Contenido de un popover de opciones excluyentes (Ordenar · Agrupar): título,
 * explicación y filas con radio + ícono. `plegable` suma «Abrir todos /
 * Plegar todos» para los grupos de la lista.
 */
@Component({
  selector: 'app-opciones-popover',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-1 pb-2.5">
      <div class="font-[Archivo] text-[15px] font-semibold text-[#111827]">{{ titulo() }}</div>
      @if (detalle()) {
        <div class="text-[12.5px] leading-[18px] text-[#6b7280]">{{ detalle() }}</div>
      }
    </div>
    <div class="flex flex-col gap-1">
      @for (o of opciones(); track o.clave) {
        @let activa = o.clave === valor();
        <button type="button" data-cierra (click)="elegir.emit(o.clave)"
          class="grid cursor-pointer grid-cols-[18px_30px_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-[background-color] duration-200 ease-[ease] hover:bg-[#f7f7f7]!"
          [class]="activa ? 'bg-[#f4f4f4]' : 'bg-transparent'">
          <span class="flex size-4.5 items-center justify-center rounded-full transition-[box-shadow] duration-200 ease-[ease]"
            [class]="activa ? 'shadow-[inset_0_0_0_1.5px_#303030]' : 'shadow-[inset_0_0_0_1.5px_#d4d4d4]'">
            <span class="size-2 rounded-full bg-[#303030] transition-[scale] duration-250 ease-[cubic-bezier(.34,1.56,.64,1)]"
              [class]="activa ? 'scale-100' : 'scale-0'"></span>
          </span>
          <span class="flex size-7.5 items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[#4b5563]">
            <app-ic [nombre]="o.icono" [size]="16" />
          </span>
          <span class="flex flex-col gap-[1px]">
            <span class="text-[13px] font-semibold text-[#111827]">{{ o.titulo }}</span>
            @if (o.detalle) {
              <span class="text-[12px] text-[#8a8a8a]">{{ o.detalle }}</span>
            }
          </span>
        </button>
      }
    </div>
    @if (plegable()) {
      <div class="mt-2.5 flex gap-1.5 border-t border-t-[#f1f1f1] pt-2.5">
        <button type="button" data-cierra (click)="abrirTodos.emit()"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#f1f1f1] px-2.5 py-[7px] text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6]!">
          <app-ic nombre="chevrons-down" [size]="14" />Abrir todos
        </button>
        <button type="button" data-cierra (click)="plegarTodos.emit()"
          class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#f1f1f1] px-2.5 py-[7px] text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6]!">
          <app-ic nombre="chevrons-up" [size]="14" />Plegar todos
        </button>
      </div>
    }
  `,
})
export class OpcionesPopoverComponent {
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly opciones = input.required<OpcionPopover[]>();
  readonly valor = input.required<string>();
  readonly plegable = input(false);
  readonly elegir = output<string>();
  readonly abrirTodos = output<void>();
  readonly plegarTodos = output<void>();
}
