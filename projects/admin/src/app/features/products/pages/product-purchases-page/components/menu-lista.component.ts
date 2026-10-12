import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';
import { PopoverDirective } from '../../../shared/ui/popover.directive';

/**
 * Botón redondo de la barra de la lista (ordenar, filtros, agrupar) con su
 * popover. El punto turquesa avisa que la opción no está en su valor por defecto.
 * El contenido del popover va proyectado; `panel` lleva su ancho y relleno.
 */
@Component({
  selector: 'app-menu-lista',
  standalone: true,
  imports: [TablerIconComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' },
  template: `
    <button type="button" (click)="alternar.emit($event)" [title]="titulo()"
      class="relative flex size-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#4b5563] transition-[background-color] duration-200 ease-[ease] hover:bg-[#e6e6e6]!"
      [class]="abierto() || marcado() ? 'bg-[#e3e3e3]' : 'bg-transparent'">
      <tabler-icon [icon]="icono()" [size]="16" [stroke]="2" />
      @if (marcado()) {
        <span class="absolute top-1 right-1 size-[7px] rounded-full bg-[#2be0d5] shadow-[0_0_0_2px_#f1f1f1]"></span>
      }
    </button>
    <div [appPopover]="abierto()" (click)="$event.stopPropagation()"
      class="absolute top-10.5 right-0 z-40 origin-top-right rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
      [class]="panel()">
      <ng-content />
    </div>
  `,
})
export class MenuListaComponent {
  readonly icono = input.required<TablerIcon>();
  readonly titulo = input('');
  readonly abierto = input(false);
  /** Muestra el punto turquesa. */
  readonly marcado = input(false);
  /** Ancho y relleno del popover (clases). */
  readonly panel = input('w-75 p-3');
  readonly alternar = output<Event>();
}
