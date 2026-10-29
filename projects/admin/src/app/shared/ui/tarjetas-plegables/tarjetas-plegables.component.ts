import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Tarjetas de Actividad del equipo (métricas) y Campos propios (capacidad por
 * sección) con el mismo pliegue que la franja de métricas de Productos.
 *
 * - Una sola fila. Caben `floor((ancho − 46 + 8) / (min + 8))`; el resto se
 *   pliega y aparece el círculo «+N».
 * - «+N» → crece hasta `anchoExpandido` (ancho de `app-lista-ficha`, por
 *   encima de la ficha; `width` 500 ms, 120 ms de retraso) y emite `fondo`
 *   para `[bajar]` de la ficha. «−» recoge.
 * - `permitirDesplegar` en `false` (sin ficha abierta) la recoge sola.
 *
 * Uso:
 *   <app-tarjetas-plegables [items]="metricas()" [min]="132" [anchoExpandido]="lf.ancho()" (fondo)="bajar.set($event)">
 *     <ng-template #tarjeta let-m> …la tarjeta (flex-1 min-w-0)… </ng-template>
 *   </app-tarjetas-plegables>
 */
@Component({
  selector: 'app-tarjetas-plegables',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative z-[5] mb-3.5 flex shrink-0 transition-[width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[style.width]': 'ancho()',
    '[style.transition-delay]': "desplegada() ? '.12s' : '0s'",
  },
  template: `
    @for (it of items(); track $index; let j = $index) {
      @let ver = visible(j);
      <div
        class="flex min-w-0 overflow-hidden transition-[flex,max-width,margin,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.flex]="ver ? '1 1 0px' : '0 0 0px'"
        [style.max-width]="ver ? '600px' : '0px'"
        [style.margin-right]="ver && j < ultimo() ? '8px' : '0px'"
        [style.opacity]="ver ? 1 : 0"
        [style.pointer-events]="ver ? 'auto' : 'none'"
        [attr.aria-hidden]="!ver"
      >
        <ng-container [ngTemplateOutlet]="tpl()!" [ngTemplateOutletContext]="{ $implicit: it }" />
      </div>
    }
    @if (hayOcultas()) {
      <span class="flex w-[46px] shrink-0 items-center justify-center">
        <button
          type="button"
          (click)="alternar()"
          [title]="desplegada() ? 'Recoger' : 'Ver ' + ocultas() + ' más'"
          class="flex h-[30px] min-w-[30px] animate-[pop-in_.35s_cubic-bezier(.2,.8,.2,1)_both] cursor-pointer items-center justify-center rounded-full bg-white px-2 text-[12px] font-semibold tabular-nums text-[#303030] shadow-[0_0_0_1px_rgba(0,0,0,.06),0_1px_2px_rgba(0,0,0,.06)] transition-[background-color,transform] duration-200 hover:bg-[#fafafa] active:scale-[.94]"
        >
          {{ desplegada() ? '−' : '+' + ocultas() }}
        </button>
      </span>
    }
  `,
})
export class TarjetasPlegablesComponent {
  readonly items = input<unknown[]>([]);
  readonly min = input(132);
  readonly anchoExpandido = input(0);
  readonly permitirDesplegar = input(true);
  readonly fondo = output<number>();
  readonly desplegada = signal(false);

  protected readonly tpl = contentChild<TemplateRef<unknown>>('tarjeta');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly disp = signal(0);

  private readonly n = computed(() => this.items().length);
  private readonly todas = computed(
    () => !this.disp() || Math.floor((this.disp() + 8) / (this.min() + 8)) >= this.n(),
  );
  private readonly caben = computed(() =>
    this.todas() ? this.n() : Math.max(1, Math.floor((this.disp() - 46 + 8) / (this.min() + 8))),
  );
  protected readonly ocultas = computed(() => this.n() - this.caben());
  protected readonly hayOcultas = computed(() => this.ocultas() > 0);
  protected readonly ultimo = computed(() => (this.desplegada() ? this.n() : this.caben()) - 1);
  protected readonly ancho = computed(() =>
    this.desplegada() && this.anchoExpandido()
      ? this.anchoExpandido() + 'px'
      : this.disp()
        ? this.disp() + 'px'
        : 'calc(100% - 28px)',
  );

  constructor() {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() =>
        this.disp.set(Math.max(0, (this.host.parentElement?.clientWidth ?? 0) - 28)),
      );
      queueMicrotask(() => this.host.parentElement && ro.observe(this.host.parentElement));
      inject(DestroyRef).onDestroy(() => ro.disconnect());
    }
    // Se recoge sola si ya caben todas o si no hay ficha abierta.
    effect(() => {
      if (this.desplegada() && (!this.hayOcultas() || !this.permitirDesplegar())) this.cambiar(false);
    });
  }

  protected visible(j: number): boolean {
    return this.desplegada() || j < this.caben();
  }

  protected alternar(): void {
    this.cambiar(!this.desplegada());
  }

  private cambiar(v: boolean): void {
    this.desplegada.set(v);
    this.fondo.emit(v ? this.host.offsetTop + this.host.offsetHeight + 12 : 0);
  }
}
