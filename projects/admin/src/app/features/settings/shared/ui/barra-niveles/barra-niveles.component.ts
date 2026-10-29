import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Nivel } from '../../../../../core/roles/niveles';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';
import { NIVELES } from '../../permisos';

/**
 * Barra de 3 segmentos (Ver · Editar · Todo) de los permisos de un módulo.
 *
 * @remarks
 * - `base` = guardado, `valor` = borrador: lo que se suma va verde con «+», lo
 *   que se quita blanco con borde rojo y «×».
 * - Modo área (`min`/`max`): #303030 hasta el mínimo, #c9c9c9 hasta el máximo
 *   (niveles mezclados).
 * - Tocar el segmento del nivel actual baja uno.
 * - `soloLectura` solo cambia el aspecto: el clic se emite igual, para que
 *   quien la usa pueda explicar por qué no se edita (las plantillas).
 */
@Component({
  selector: 'app-barra-niveles',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-3 gap-[3px]' },
  template: `
    @for (s of segmentos(); track s.n) {
      <button
        type="button"
        [title]="s.titulo"
        (click)="elegir(s.n)"
        class="flex items-center justify-center transition-[background-color,box-shadow] duration-300 hover:brightness-[.93]"
        [class.cursor-default]="soloLectura()"
        [style.height.px]="alto()"
        [style.border-radius]="s.radio"
        [style.background]="s.bg"
        [style.box-shadow]="s.sombra"
      >
        @if (s.icono) {
          <app-ic [nombre]="s.icono" [size]="11" [style.color]="s.icColor" />
        }
      </button>
    }
  `,
})
export class BarraNivelesComponent {
  readonly base = input<Nivel>(0);
  readonly valor = input<Nivel>(0);
  readonly min = input<Nivel | null>(null);
  readonly max = input<Nivel | null>(null);
  /** 22 por módulo · 14 en la cabecera del área. */
  readonly alto = input(22);
  readonly soloLectura = input(false);
  /** En modo área, su nombre para el título de cada segmento («Todo Ventas en Editar»). */
  readonly area = input('');
  readonly cambio = output<Nivel>();

  protected readonly segmentos = computed(() => {
    const a = this.base(),
      b = this.valor(),
      mn = this.min(),
      mx = this.max(),
      area = mn !== null && mx !== null;
    const r = area
      ? ['6px 3px 3px 6px', '3px', '3px 6px 6px 3px']
      : ['7px 3px 3px 7px', '3px', '3px 7px 7px 3px'];
    return ([1, 2, 3] as const).map((n) => {
      const radio = r[n - 1];
      if (area) {
        const todos = n <= mn!,
          algunos = !todos && n <= mx!;
        const nv = mn === mx && mn === n ? n - 1 : n;
        return {
          n,
          radio,
          titulo: this.area() ? `Todo ${this.area()} en ${NIVELES[nv]}` : NIVELES[n],
          icono: '',
          icColor: '#fff',
          bg: todos ? '#303030' : algunos ? '#c9c9c9' : '#fff',
          sombra: todos || algunos ? 'none' : 'inset 0 0 0 1px #e0e0e0',
        };
      }
      const fijo = n <= Math.min(a, b),
        suma = !fijo && n <= b,
        quita = !fijo && !suma && n <= a;
      return {
        n,
        radio,
        titulo: this.soloLectura()
          ? NIVELES[n]
          : n === b
            ? 'Bajar a ' + NIVELES[n - 1]
            : 'Poner en ' + NIVELES[n],
        bg: fijo ? '#303030' : suma ? '#29845a' : '#fff',
        sombra: suma
          ? '0 0 0 3px rgba(41,132,90,.16)'
          : quita
            ? 'inset 0 0 0 1.5px #f19aa7'
            : 'inset 0 0 0 1px #e5e5e5',
        icono: quita ? 'x' : suma ? 'plus' : '',
        icColor: quita ? '#e11d48' : '#fff',
      };
    });
  });

  protected elegir(n: 1 | 2 | 3): void {
    const mn = this.min(),
      mx = this.max();
    const actual = mn !== null && mx !== null ? (mn === mx ? mn : -1) : this.valor();
    this.cambio.emit((actual === n ? n - 1 : n) as Nivel);
  }
}
