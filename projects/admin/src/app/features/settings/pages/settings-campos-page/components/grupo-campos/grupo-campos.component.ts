import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TOPE_CAMPOS } from '../../../../../../core/campos/campo-personalizado.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Grupo de una sección (Productos, Clientes…) en la lista: cabecera fija al
 * hacer scroll con la cuenta, los activos sobre el tope y el «+» para crear
 * ahí; el cuerpo (las filas) va proyectado y se pliega animando la altura.
 */
@Component({
  selector: 'app-grupo-campos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div
      (click)="alternar.emit()"
      class="sticky top-0 z-[3] flex w-[calc(100%-28px)] cursor-pointer select-none items-center gap-2.5 bg-[#f1f1f1] px-1 pb-2 pt-3.5"
    >
      <span
        class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#e3e3e3] text-[#303030]"
        ><app-ic [nombre]="icono()" [size]="13"
      /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="flex items-center gap-[7px]">
          <span class="text-[13px] font-semibold text-[#111827]">{{ titulo() }}</span>
          <span
            class="rounded-full bg-[#e3e3e3] px-[7px] text-[11px] font-semibold leading-[17px] tabular-nums text-[#4b5563]"
            >{{ total() }}</span
          >
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]"
          >{{ activos() }} de {{ tope }} activos · {{ descripcion() }}</span
        >
      </span>
      @if (puedeAgregar()) {
        <button
          type="button"
          (click)="$event.stopPropagation(); nuevo.emit()"
          [title]="'Nuevo campo en ' + titulo().toLowerCase()"
          class="flex size-6 shrink-0 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#e3e3e3] hover:text-[#111827]"
        >
          <app-ic nombre="plus" [size]="14" />
        </button>
      }
      <span class="flex size-6 shrink-0 items-center justify-center text-[#8a8a8a]"
        ><app-ic
          nombre="chevron-down"
          [size]="14"
          class="transition-transform duration-300"
          [style.transform]="abierto() ? 'none' : 'rotate(-90deg)'"
      /></span>
    </div>
    <div
      class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      [style.grid-template-rows]="abierto() ? '1fr' : '0fr'"
    >
      <div class="min-h-0" [style.overflow]="abierto() ? 'visible' : 'hidden'">
        <div class="flex flex-col gap-0.5 pb-1 pt-0.5"><ng-content /></div>
      </div>
    </div>
  `,
})
export class GrupoCamposComponent {
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly icono = input.required<string>();
  readonly total = input(0);
  readonly activos = input(0);
  readonly abierto = input(true);
  /** Sin permiso para crear campos no se muestra el «+». */
  readonly puedeAgregar = input(true);
  readonly alternar = output<void>();
  readonly nuevo = output<void>();
  protected readonly tope = TOPE_CAMPOS;
}
