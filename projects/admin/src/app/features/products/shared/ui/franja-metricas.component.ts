import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from './iconos';
import { PopoverDirective } from './popover.directive';

export interface OpcionPeriodo {
  k: string;
  label: string;
}

/** Una métrica de la franja. `spark` = puntos del polyline (viewBox 64×22); sin serie, solo la base punteada. */
export interface MetricaFranja {
  k: string;
  label: string;
  value: string;
  delta: string;
  /** Color de la cifra. */
  tinta: string;
  /** Activa (filtrando la lista). */
  activa?: boolean;
  spark?: string | null;
  /** Color del trazo. */
  sparkColor?: string;
}

/**
 * Franja de métricas de los módulos de Productos (v5): selector de período a la
 * izquierda y una tarjeta por métrica (clic = filtra la lista; la activa se
 * marca con fondo y subrayado inferior).
 */
@Component({
  selector: 'app-franja-metricas',
  standalone: true,
  imports: [TablerIconComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mt-4.5 flex flex-wrap rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,.07),0_0_0_1px_rgba(0,0,0,.05)]' },
  template: `
    <div class="relative -mb-px flex min-h-22 items-center justify-center border-r border-b border-r-[#ebebeb] border-b-[#ebebeb] px-2.5">
      <button type="button" (click)="alternar($event)"
        class="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-[#303030] transition-[background] duration-200 ease-[ease] hover:bg-[#f1f1f1]!">
        <tabler-icon [icon]="i.calendar" [size]="16" [stroke]="2" />{{ etiquetaPeriodo() }}
      </button>
      <div [appPopover]="abierto()" (click)="$event.stopPropagation()"
        class="absolute top-[calc(100%-14px)] left-2.5 z-30 w-50 origin-top-left rounded-[14px] bg-white p-[5px] shadow-[0_0_0_1px_rgba(0,0,0,.06),0_18px_40px_-16px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.22s_cubic-bezier(.2,.8,.2,1)]">
        @for (o of periodos(); track o.k) {
          <button type="button" (click)="elegir(o.k)"
            class="flex h-8 w-full cursor-pointer items-center justify-between rounded-[9px] px-2.5 text-left text-[13px] hover:bg-[#f4f4f4]!">
            {{ o.label }}
            @if (o.k === periodo()) {
              <tabler-icon [icon]="i.check" [size]="14" [stroke]="2" />
            }
          </button>
        }
      </div>
    </div>
    @for (m of metricas(); track m.k) {
      <button type="button" (click)="metrica.emit(m.k)" [title]="m.label"
        class="-mb-px flex min-w-0 flex-[1_1_170px] cursor-pointer items-end justify-between gap-2.5 border-r border-b border-r-[#ebebeb] border-b-[#ebebeb] p-4 text-left transition-[background-color,box-shadow] duration-200 ease-[ease] hover:bg-[#fafafa]!"
        [class]="m.activa ? 'bg-[#f7f7f7] shadow-[inset_0_-2px_0_#303030]' : 'bg-white'">
        <span class="flex min-w-0 flex-col gap-1.5">
          <span class="truncate text-[13px] font-semibold text-[#303030] [text-decoration:underline_dotted_#b5b5b5] [text-underline-offset:4px]">{{ m.label }}</span>
          <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span class="max-w-full truncate text-[15px] font-semibold tabular-nums" [style.color]="m.tinta">{{ m.value }}</span>
            <span class="truncate text-[12px] font-medium text-[#6b7280]">{{ m.delta }}</span>
          </span>
        </span>
        <svg width="56" height="28" viewBox="0 0 64 22" preserveAspectRatio="none" class="min-w-6 shrink overflow-visible">
          <line x1="0" y1="21.5" x2="64" y2="21.5" stroke="#d4d4d4" stroke-dasharray="2 2" class="[stroke-width:1] [vector-effect:non-scaling-stroke]"></line>
          @if (m.spark) {
            <polyline [attr.points]="m.spark" fill="none" [attr.stroke]="m.sparkColor" class="[stroke-width:1.5] [vector-effect:non-scaling-stroke] [stroke-linecap:round] [stroke-linejoin:round]"></polyline>
          }
        </svg>
      </button>
    }
  `,
})
export class FranjaMetricasComponent {
  readonly periodos = input<OpcionPeriodo[]>([
    { k: 'hoy', label: 'Hoy' },
    { k: '7', label: 'Últimos 7 días' },
    { k: '30', label: 'Últimos 30 días' },
  ]);
  readonly periodo = input('hoy');
  readonly metricas = input<MetricaFranja[]>([]);
  readonly cambiarPeriodo = output<string>();
  readonly metrica = output<string>();

  protected readonly i = { calendar: icono('calendar'), check: icono('check') };
  /** Popover del período abierto (público para que la página coordine Esc y sus propios menús). */
  readonly abierto = signal(false);
  protected readonly etiquetaPeriodo = computed(() => this.periodos().find((o) => o.k === this.periodo())?.label ?? '');

  protected alternar(e: Event): void {
    e.stopPropagation();
    this.abierto.update((v) => !v);
  }
  protected elegir(k: string): void {
    this.cambiarPeriodo.emit(k);
    this.abierto.set(false);
  }
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected cerrar(): void {
    this.abierto.set(false);
  }
}
