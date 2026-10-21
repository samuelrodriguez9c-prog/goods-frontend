import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';
import { IconBuildingStore, IconCalendar, IconCheck, TablerIconComponent } from '@tabler/icons-angular';
import { PopoverDirective } from '../popover.directive';

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
  /** Texto al pasar el mouse (si no, la etiqueta). */
  tip?: string;
  /**
   * Tarjeta «en vivo» (Pedidos · Por confirmar con pedidos nuevos de la
   * tienda): punto que late, texto ámbar y, en vez del sparkline, los
   * tiquetes saliendo de la ranura (máx. 4) con «+N» si hay más.
   */
  vivo?: { texto: string; tiquetes: TiqueteFranja[]; mas: number };
}

/** Un tiquete de la tarjeta en vivo. */
export interface TiqueteFranja {
  id: number | string;
  /** «#1049». */
  titulo: string;
  /** «$16.900». */
  monto: string;
  /** «8 m», «2 h». */
  hace: string;
  /** «Abrir #1049 · Julián Ospina». */
  tip: string;
}

/** Puntos del polyline (viewBox 64×22) para una serie: de abajo (mínimo) a arriba (máximo). */
export function puntosSpark(serie: number[]): string | null {
  if (serie.length < 2) return null;
  const mx = Math.max(...serie);
  const mn = Math.min(...serie);
  const rg = Math.max(1, mx - mn);
  return serie.map((v, i) => `${((i * 64) / (serie.length - 1)).toFixed(1)},${(21 - ((v - mn) / rg) * 18).toFixed(1)}`).join(' ');
}

/**
 * Franja de métricas de los módulos (Productos, Pedidos, Clientes, WhatsApp):
 * selector de período a la izquierda y una tarjeta por métrica. Clic en una
 * tarjeta filtra la lista; la activa lleva fondo y subrayado inferior.
 *
 * @remarks
 * WhatsApp usa `periodoFijo` (solo «Hoy», sin menú) y `fondoActiva` claro.
 */
@Component({
  selector: 'app-franja-metricas',
  standalone: true,
  imports: [TablerIconComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mt-4.5 flex flex-wrap rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,.07),0_0_0_1px_rgba(0,0,0,.05)]' },
  template: `
    <div class="relative -mb-px flex min-h-22 items-center justify-center border-r border-b border-r-[#ebebeb] border-b-[#ebebeb] px-2.5">
      @if (periodoFijo()) {
        <span class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-[#303030]">
          <tabler-icon [icon]="i.calendar" [size]="16" [stroke]="2" />{{ etiquetaPeriodo() }}
        </span>
      } @else {
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
      }
    </div>
    @for (m of metricas(); track m.k) {
      @if (m.vivo; as vv) {
        <!-- Tarjeta en vivo (Pedidos · Por confirmar): punto ámbar + tiquetes de la tienda. -->
        <button type="button" (click)="metrica.emit(m.k)" (mouseleave)="tkHi.set(null)"
          class="-mb-px flex min-w-0 flex-[1.8_1_400px] cursor-pointer items-end justify-between gap-2.5 border-r border-b border-r-[#ebebeb] border-b-[#ebebeb] p-4 text-left transition-[background-color,box-shadow] duration-200 ease-[ease] hover:bg-[#fafafa]!"
          [class]="m.activa ? 'bg-[#fff3c4] shadow-[inset_0_-2px_0_#ffb904]' : 'bg-[#fffbea] shadow-[inset_0_2px_0_#ffb904]'"
          [attr.title]="m.tip ?? m.label">
          <span class="flex min-w-0 flex-col justify-between gap-1.5">
            <span class="flex min-w-0 items-center gap-[7px]">
              <span class="relative flex size-[7px] shrink-0">
                <span class="absolute inset-0 animate-[ping_1.8s_cubic-bezier(0,0,.2,1)_infinite] rounded-full bg-[#ffb904]"></span>
                <span class="relative size-[7px] rounded-full bg-[#ffb904]"></span>
              </span>
              <span class="truncate text-[13px] font-semibold text-[#303030] [text-decoration:underline_dotted_#b5b5b5] [text-underline-offset:4px]">{{ m.label }}</span>
            </span>
            <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span class="max-w-full truncate text-[15px] font-semibold tabular-nums" [style.color]="m.tinta">{{ m.value }}</span>
              <span class="truncate text-[12px] font-medium text-[#8a5a00] transition-colors duration-200">{{ tkHi() != null ? 'Toca uno para abrirlo' : vv.texto }}</span>
            </span>
          </span>
          <span (click)="$event.stopPropagation()" class="relative -my-4 mr-[-2px] ml-3 block w-[200px] shrink-0 self-stretch">
            @if (vv.mas > 0) {
              <span [title]="vv.mas + ' más esperando · se ven al filtrar'"
                class="absolute top-3 right-1 z-25 flex h-[18px] min-w-[22px] animate-[pop_.35s_cubic-bezier(.2,.8,.2,1)_.4s_both] items-center justify-center rounded-full bg-[#ffb904] px-1.5 text-[10.5px] font-bold text-[#3d2a00] tabular-nums shadow-[0_0_0_2px_#fffbea]">+{{ vv.mas }}</span>
            }
            <!-- La ranura de la que salen los tiquetes. -->
            <span class="absolute inset-x-0 top-0 z-6 h-[9px] rounded-b-full bg-[#303030] shadow-[inset_0_-2px_0_#000,inset_0_1px_0_rgba(255,255,255,.12),0_1px_0_#fff]"></span>
            <span class="absolute inset-x-0 top-[5px] bottom-0 [clip-path:inset(0_0_0_0)] [filter:drop-shadow(0_4px_6px_rgba(138,90,0,.22))]">
              @for (x of vv.tiquetes; track x.id; let j = $index; let n = $count) {
                <span class="absolute top-0 w-[84px] animate-[imprime_.8s_cubic-bezier(.2,.8,.2,1)_both]"
                  [style.left.px]="izquierdaTiquete(j, n)" [style.z-index]="tkHi() === j ? 20 : 10 - j" [style.animation-delay.ms]="(n - 1 - j) * 140">
                  <span (click)="ticket.emit(x.id)" (mouseenter)="tkHi.set(j)" [title]="x.tip"
                    class="tiquete-papel flex cursor-pointer flex-col gap-0.5 bg-white px-2 pt-[7px] pb-[9px] [transform-origin:50%_0] transition-transform duration-500 ease-[cubic-bezier(.3,1.35,.5,1)]"
                    [style.transform]="giroTiquete(j)">
                    <span class="flex items-center justify-between gap-1">
                      <span class="flex items-center gap-[3px] text-[8.5px] font-bold tracking-[.09em] text-[#b07400] uppercase">
                        <tabler-icon [icon]="i.tienda" [size]="10" [stroke]="2" />Tienda
                      </span>
                      <span class="text-[9.5px] whitespace-nowrap text-[#9ca3af]">{{ x.hace }}</span>
                    </span>
                    <span class="font-[IBM_Plex_Mono,monospace] text-[12.5px] leading-[14px] font-semibold text-[#111827]">{{ x.titulo }}</span>
                    <span class="h-0 border-t border-dashed border-t-[#e3d3a5]"></span>
                    <span class="text-[11px] font-semibold whitespace-nowrap text-[#303030] tabular-nums">{{ x.monto }}</span>
                  </span>
                </span>
              }
            </span>
          </span>
        </button>
      } @else {
      <button type="button" (click)="metrica.emit(m.k)"
        class="-mb-px flex min-w-0 flex-[1_1_170px] cursor-pointer items-end justify-between gap-2.5 border-r border-b border-r-[#ebebeb] border-b-[#ebebeb] p-4 text-left transition-[background-color,box-shadow] duration-200 ease-[ease] hover:bg-[#fafafa]!"
        [class]="m.activa ? (fondoActiva() === 'claro' ? 'bg-[#fafafa] shadow-[inset_0_-2px_0_#303030]' : 'bg-[#f7f7f7] shadow-[inset_0_-2px_0_#303030]') : 'bg-white'"
        [attr.title]="m.tip ?? m.label">
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
  /** Sin menú de período: solo muestra la etiqueta del período elegido. */
  readonly periodoFijo = input(false);
  /** Fondo de la métrica activa: `gris` (#f7f7f7, Productos) o `claro` (#fafafa, WhatsApp). */
  readonly fondoActiva = input<'gris' | 'claro'>('gris');
  readonly cambiarPeriodo = output<string>();
  readonly metrica = output<string>();
  /** Tocaron un tiquete de la tarjeta en vivo (id del pedido). */
  readonly ticket = output<number | string>();

  protected readonly i = { calendar: IconCalendar, check: IconCheck, tienda: IconBuildingStore };
  /** Tiquete bajo el cursor (se endereza y los demás se apartan). */
  protected readonly tkHi = signal<number | null>(null);

  /** Los tiquetes se reparten en 200 px (84 de ancho cada uno). */
  protected izquierdaTiquete(i: number, n: number): number {
    const paso = n > 1 ? Math.min(84 + 6, (200 - 84) / (n - 1)) : 0;
    return Math.round(i * paso);
  }
  protected giroTiquete(i: number): string {
    const hi = this.tkHi();
    if (hi === i) return 'translateY(4px) rotate(0deg) scale(1.04)';
    return `translateY(${hi != null ? -2 : 0}px) rotate(${i % 2 ? 2.5 : -2}deg)`;
  }
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
