import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DespegueDirective } from '../../../../../shared/ui/despegue/despegue.directive';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Cuerpo lista + ficha de los módulos de Settings (Roles, Usuarios,
 * Solicitudes, Campos, Actividad).
 *
 * @remarks
 * - **Proporción de Campos propios:** sin selección la lista ocupa
 *   `max(320px, 65%)`; con selección `max(320px, 36.4%)` (≈ 0.8fr / 1.4fr),
 *   con `width` 380 ms `cubic-bezier(.2,.8,.2,1)`.
 * - **Slot `[arriba]`** antes del buscador: la descripción de la página y, en
 *   Actividad / Campos, `app-tarjetas-plegables`. La ficha empieza así a la
 *   altura del subtítulo.
 * - **Ficha** con radio solo arriba, pegada al borde inferior; `bajar` (px) la
 *   desplaza cuando las tarjetas se despliegan (0 s al bajar, 220 ms al subir).
 * - **Despegue** de la fila seleccionada (`appDespegue`, `cabeceraGrupo` 32;
 *   Solicitudes, sin grupos, 0). La página lee `lf.despegada()` (con
 *   `#lf="listaFicha"`) y lo pasa a cada `app-fila-lista`.
 * - `ancho` (px) de todo el cuerpo, para que las tarjetas sepan hasta dónde crecer.
 * - `completa`: oculta la lista (ficha en página completa).
 * - Slots: `[arriba]`, `[buscador]`, `[lista]`, `[ficha]`, `[vacio]`. El pie de
 *   la lista (rayo + texto) lo pone este componente.
 */
@Component({
  selector: 'app-lista-ficha',
  standalone: true,
  imports: [IcComponent, DespegueDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'listaFicha',
  host: { class: '-mt-1.5 flex min-h-0 flex-1' },
  template: `
    @if (!completa()) {
      <div
        class="relative z-[2] -mr-4 flex min-w-0 shrink-0 flex-col transition-[width] duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.width]="anchoLista()"
      >
        <ng-content select="[arriba]" />
        <div class="flex items-center gap-1.5 pb-2.5 pr-7"><ng-content select="[buscador]" /></div>
        <div
          appDespegue
          [cabecera]="cabeceraGrupo()"
          [seleccion]="seleccionId()"
          class="sin-barra flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-6 pt-0.5"
        >
          <ng-content select="[lista]" />
          @if (pie()) {
            <p
              class="mb-1 mr-7 mt-3 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11.5px] text-[#8a8a8a]"
            >
              <app-ic nombre="bolt" [size]="13" />{{ pie() }}
            </p>
          }
        </div>
      </div>
    }
    <div
      class="relative z-[1] min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-t-[14px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-[margin-top] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] [scrollbar-width:thin]"
      [style.margin-top.px]="bajar()"
      [style.transition-delay]="bajar() ? '0s' : '.22s'"
    >
      @if (haySeleccion()) {
        <ng-content select="[ficha]" />
      } @else {
        <ng-content select="[vacio]" />
      }
    </div>
  `,
})
export class ListaFichaComponent {
  readonly haySeleccion = input.required<boolean>();
  /** Id seleccionado: el despegue vuelve a medir al cambiar. */
  readonly seleccionId = input<unknown>(null);
  readonly completa = input(false);
  readonly pie = input('');
  /** Alto de la cabecera sticky del grupo (0 sin grupos). */
  readonly cabeceraGrupo = input(32);
  readonly bajar = input(0);
  /** Ancho del cuerpo en px (para `app-tarjetas-plegables [anchoExpandido]`). */
  readonly ancho = signal(0);

  private readonly desp = viewChild(DespegueDirective);
  /** La fila seleccionada está despegada (pásalo a `app-fila-lista [despegada]`). */
  readonly despegada = computed(() => this.desp()?.despegada() ?? false);
  protected readonly anchoLista = computed(() =>
    this.haySeleccion() ? 'max(320px, 36.4%)' : 'max(320px, 65%)',
  );

  constructor() {
    if (typeof ResizeObserver === 'undefined') return;
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const ro = new ResizeObserver(([e]) => this.ancho.set(Math.round(e.contentRect.width)));
    ro.observe(el);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
}
