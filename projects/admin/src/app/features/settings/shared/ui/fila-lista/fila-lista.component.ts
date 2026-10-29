import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Fila de la lista que se «pega» a la ficha cuando está resaltada (hover o
 * seleccionada): sin margen derecho, radio solo a la izquierda, fondo blanco y
 * dos esquinas cóncavas. El contenido va en una grilla de `columnas`.
 *
 * Desde la plantilla, `#fila` + `fila.resaltada()` sirve para cambiar los
 * fondos de lo que va adentro.
 *
 * `despegada` (de `appDespegue` en `app-lista-ficha`): la seleccionada deja de
 * pegarse mientras pasa bajo la cabecera sticky del grupo o sale por abajo;
 * sigue blanca. Marca `data-sel="1"` para que la directiva la mida.
 */
@Component({
  selector: 'app-fila-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative block animate-[st-fade-in-up_.28s_cubic-bezier(.2,.8,.2,1)_both] transition-[margin] duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)]',
    '[style.margin-right]': "resaltada() ? '0px' : '28px'",
    '[style.animation-delay.ms]': 'retraso()',
    '[attr.data-sel]': "seleccionada() ? '1' : null",
    '(mouseenter)': 'hover.set(true)',
    '(mouseleave)': 'hover.set(false)',
  },
  template: `
    <div
      role="button"
      tabindex="-1"
      (click)="abrir.emit()"
      class="relative grid cursor-pointer select-none gap-3 pl-[10px] transition-[background-color,border-radius,padding] duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      [class.items-center]="!arriba()"
      [class.items-start]="arriba()"
      [style.column-gap.px]="separacion()"
      [style.grid-template-columns]="columnas()"
      [style.padding-block.px]="alto()"
      [style.border-radius]="resaltada() ? '12px 0 0 12px' : '12px'"
      [style.padding-right]="resaltada() ? '30px' : '14px'"
      [style.background]="resaltada() || seleccionada() ? '#fff' : 'transparent'"
    >
      <ng-content />
    </div>
    @if (resaltada()) {
      <span
        class="st-esquina-arriba pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[st-fade-in_.2s]"
      ></span>
      <span
        class="st-esquina-abajo pointer-events-none absolute -bottom-3 right-4 z-[4] size-3 animate-[st-fade-in_.2s]"
      ></span>
    }
  `,
})
export class FilaListaComponent {
  readonly seleccionada = input(false);
  /** La seleccionada pasó bajo la cabecera del grupo o salió por abajo. */
  readonly despegada = input(false);
  /** Posición en el grupo: escalona la entrada (30 ms por fila, hasta la sexta). */
  readonly indice = input(0);
  readonly columnas = input('36px minmax(0,1fr) auto');
  /** Alinea el contenido arriba (filas de dos líneas). */
  readonly arriba = input(false, { transform: booleanAttribute });
  /** Relleno vertical en px. */
  readonly alto = input(9);
  readonly separacion = input(12);
  readonly abrir = output<void>();
  protected readonly hover = signal(false);

  resaltada(): boolean {
    return (this.seleccionada() && !this.despegada()) || this.hover();
  }

  protected retraso(): number {
    return Math.min(this.indice(), 6) * 30;
  }
}

/**
 * Grupo plegable de la lista: cabecera sticky de 32 px (`top-0`, fondo del
 * lienzo, `mr-7` para no montarse sobre la ficha) con ícono, título, contador
 * y chevron; el cuerpo anima `grid-template-rows`.
 */
@Component({
  selector: 'app-grupo-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <button
      type="button"
      (click)="alternar.emit()"
      class="sticky top-0 z-[3] mr-7 flex h-8 shrink-0 items-center gap-2 rounded-[9px] bg-[#f1f1f1] px-2 text-left hover:bg-[#e9e9e9]"
    >
      <ng-content select="[icono]" />
      <span class="text-[12.5px] font-semibold text-[#111827]">{{ titulo() }}</span>
      @if (propio()) {
        <span
          class="rounded-[5px] bg-[#e3e3e3] px-1.5 py-px text-[10.5px] font-semibold text-[#4b5563]"
          >Propio</span
        >
      }
      <span class="text-xs tabular-nums text-[#9ca3af]">{{ contador() }}</span>
      <span class="flex-1"></span>
      <svg
        viewBox="0 0 24 24"
        class="size-3.5 text-[#8a8a8a] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.transform]="abierto() ? 'none' : 'rotate(-90deg)'"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div
      class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      [style.grid-template-rows]="abierto() ? '1fr' : '0fr'"
    >
      <div
        class="flex min-h-0 flex-col gap-0.5 pt-0.5"
        [style.overflow]="abierto() ? 'visible' : 'hidden'"
      >
        <ng-content />
      </div>
    </div>
  `,
})
export class GrupoListaComponent {
  readonly titulo = input.required<string>();
  readonly contador = input<string | number>('');
  readonly abierto = input(true);
  /** Chip «Propio» (grupos de un rol de la tienda en Usuarios). */
  readonly propio = input(false);
  readonly alternar = output<void>();
}
