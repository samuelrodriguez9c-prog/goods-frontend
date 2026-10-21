import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface PestanaHojaV5 {
  k: string;
  label: string;
  /** Cuenta en pastilla gris (null = sin pastilla). */
  n?: string | null;
  /** Punto rojo: la pestaña tiene un campo con error. */
  err?: boolean;
  /** En gris claro: todavía no aplica (p. ej. un registro nuevo sin guardar). */
  deshabilitada?: boolean;
}

/**
 * Pestañas de la hoja: columnas iguales, la activa en negrita y una
 * barra de 2 px que se desliza debajo.
 */
@Component({
  selector: 'app-pestanas-hoja',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative -mx-6 grid px-4', '[style.grid-template-columns]': 'columnas()' },
  template: `
    <span class="pointer-events-none absolute right-4 bottom-0 left-4 h-px bg-[#ebebeb]"></span>
    @for (t of pestanas(); track t.k) {
      <button type="button" (click)="elegir.emit(t.k)"
        class="relative flex h-10.5 cursor-pointer items-center justify-center gap-1.5 text-[13px] whitespace-nowrap transition-[color] duration-200 ease-[ease] hover:text-[#111827]!"
        [class]="t.k === activa() ? 'font-semibold text-[#111827]' : t.deshabilitada ? 'font-medium text-[#c4c4c4]' : 'font-medium text-[#6b7280]'">
        {{ t.label }}
        @if (t.n) {
          <span class="rounded-full bg-[#f1f1f1] px-1.5 text-[11px] leading-[17px] font-semibold text-[#6b7280]" [class.tabular-nums]="cuentaTabular()">{{ t.n }}</span>
        }
        @if (t.err) {
          <span class="size-1.5 rounded-full bg-[#d82c0d]"></span>
        }
      </button>
    }
    <span class="absolute bottom-0 left-4 h-0.5 rounded-xs bg-[#303030] transition-[transform] duration-320 ease-[cubic-bezier(.2,.8,.2,1)]"
      [style.width]="ancho()" [style.transform]="'translateX(' + indice() * 100 + '%)'"></span>
  `,
})
export class PestanasHojaComponent {
  readonly pestanas = input.required<PestanaHojaV5[]>();
  readonly activa = input.required<string>();
  /** Cifras de la cuenta con ancho fijo (Compras las usa proporcionales). */
  readonly cuentaTabular = input(true);
  readonly elegir = output<string>();
  protected readonly indice = computed(() => Math.max(0, this.pestanas().findIndex((t) => t.k === this.activa())));
  protected readonly columnas = computed(() => `repeat(${this.pestanas().length},minmax(0,1fr))`);
  protected readonly ancho = computed(() => `calc((100% - 32px) / ${this.pestanas().length})`);
}
