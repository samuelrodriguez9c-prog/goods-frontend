import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { PopoverDirective } from '../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Botón ⋯ de la barra de la ficha con su menú. El estado lo lleva la página
 * (para cerrarlo con Esc o con un clic afuera); las opciones van proyectadas
 * como `app-item-menu`.
 */
@Component({
  selector: 'app-menu-ficha',
  standalone: true,
  imports: [IcComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' },
  template: `
    <button
      type="button"
      (click)="$event.stopPropagation(); alternar.emit()"
      title="Más acciones"
      class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
    >
      <app-ic nombre="dots" />
    </button>
    <div
      [appPopover]="abierto()"
      (click)="$event.stopPropagation()"
      [style.width.px]="ancho()"
      class="absolute right-0 top-[34px] z-40 rounded-[14px] bg-white p-[5px] shadow-[0_0_0_1px_rgba(0,0,0,.06),0_18px_40px_-16px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
    >
      <ng-content />
    </div>
  `,
})
export class MenuFichaComponent {
  readonly abierto = input(false);
  readonly ancho = input(240);
  readonly alternar = output<void>();
}

/** Opción del menú ⋯. `peligro` la pinta en rojo y le pone un separador arriba. */
@Component({
  selector: 'app-item-menu',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (peligro()) {
      <div class="mx-1.5 my-1 h-px bg-[#f1f1f1]"></div>
    }
    <button
      type="button"
      (click)="elegir.emit()"
      class="flex h-[34px] w-full items-center gap-2 rounded-[9px] px-2.5 text-left text-[13px] hover:bg-[#f4f4f4]"
      [style.color]="peligro() ? '#b42318' : '#111827'"
    >
      <app-ic
        [nombre]="icono()"
        [size]="15"
        [style.color]="peligro() ? null : '#6b7280'"
      /><ng-content />
    </button>
  `,
})
export class ItemMenuComponent {
  readonly icono = input.required<string>();
  readonly peligro = input(false, { transform: booleanAttribute });
  readonly elegir = output<void>();
}
