import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Círculo de opción única de las listas y filtros. `aparece`: oculto hasta el
 * hover o la selección (el contenedor lleva la clase `group`); `fijo`: siempre
 * visible.
 */
@Component({
  selector: 'app-punto-radio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-[width,margin,opacity,transform,box-shadow] duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class]': 'clases()',
    '[style.width.px]': "variante() === 'fijo' ? tamano() : null",
    '[style.height.px]': 'tamano()',
    '[style.box-shadow]': "on() ? 'inset 0 0 0 1.5px #303030' : 'inset 0 0 0 1.5px #d4d4d4'",
  },
  template: `<span
    class="rounded-full bg-[#303030] transition-[scale] duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)]"
    [style.width.px]="punto()"
    [style.height.px]="punto()"
    [style.scale]="on() ? 1 : 0"
  ></span>`,
})
export class PuntoRadioComponent {
  readonly on = input(false);
  readonly variante = input<'aparece' | 'fijo'>('fijo');
  readonly tamano = input(16);

  protected punto(): number {
    return this.tamano() >= 18 ? 8 : 7;
  }

  protected clases(): string {
    if (this.variante() === 'fijo') return '';
    return this.on()
      ? 'mr-[9px] w-4 opacity-100'
      : 'mr-0 w-0 -translate-x-1.5 scale-[.8] opacity-0 group-hover:mr-[9px] group-hover:w-4 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100';
  }
}
