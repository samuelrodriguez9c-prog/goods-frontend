import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { iniciales, tonoPersona } from '../../../../../shared/ui/persona';

/**
 * Hasta `max` avatares superpuestos y una burbuja «+n» con el resto.
 * `borde`: color del anillo, el del fondo donde va la pila.
 */
@Component({
  selector: 'app-pila-avatares',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex flex-row-reverse', '[style.padding-left.px]': 'grande() ? 12 : 8' },
  template: `
    @if (nombres().length > max()) {
      <span
        class="absolute -right-1.5 -top-[5px] z-[9] flex items-center justify-center rounded-full bg-[#303030] font-bold text-white"
        [class]="
          grande()
            ? 'h-[18px] min-w-[18px] px-1 text-[9.5px]'
            : 'h-[15px] min-w-[15px] px-[3px] text-[8.5px]'
        "
        [style.box-shadow]="'0 0 0 ' + (grande() ? 2 : 1.5) + 'px ' + borde()"
        >+{{ nombres().length - max() }}</span
      >
    }
    @for (p of visibles(); track $index; let j = $index) {
      <span
        [title]="p.nombre"
        class="flex items-center justify-center rounded-full font-semibold"
        [style.width.px]="tamano()"
        [style.height.px]="tamano()"
        [style.margin-left.px]="grande() ? -12 : -8"
        [style.font-size.px]="grande() ? 11 : 9"
        [style.background]="p.bg"
        [style.color]="p.fg"
        [style.z-index]="5 - j"
        [style.box-shadow]="'0 0 0 2px ' + borde()"
        >{{ p.ini }}</span
      >
    }
  `,
})
export class PilaAvataresComponent {
  readonly nombres = input.required<string[]>();
  readonly max = input(2);
  readonly tamano = input(22);
  readonly borde = input('#fff');

  protected readonly grande = computed(() => this.tamano() >= 30);
  protected readonly visibles = computed(() =>
    this.nombres()
      .slice(0, this.max())
      .map((nombre) => {
        const [bg, fg] = tonoPersona(nombre);
        return { nombre, ini: iniciales(nombre), bg, fg };
      }),
  );
}
