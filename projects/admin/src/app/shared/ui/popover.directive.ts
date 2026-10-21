import { Directive, computed, input } from '@angular/core';

/**
 * Abre y cierra un panel flotante (menú, popover): cerrado queda
 * transparente, 4 px más arriba y al 97 %, sin recibir clics.
 * La posición, el tamaño y la transición van como clases en el propio elemento:
 *
 *   <div [appPopover]="menu() === 'agrupar'" class="absolute right-0 top-10.5 z-40 w-75 ... [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]">
 */
@Directive({
  selector: '[appPopover]',
  standalone: true,
  host: {
    '[style.opacity]': 'abierto() ? 1 : 0',
    '[style.transform]': 'transformacion()',
    '[style.pointer-events]': "abierto() ? 'auto' : 'none'",
    '[attr.aria-hidden]': '!abierto()',
  },
})
export class PopoverDirective {
  readonly abierto = input(false, { alias: 'appPopover' });
  protected readonly transformacion = computed(() => (this.abierto() ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)'));
}
