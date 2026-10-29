import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { num } from '../../../../shared/formato';
import { Stock } from '../../../../shared/modelos';
import { IcComponent } from '../../../../shared/ui/ic/ic.component';
import { icono } from '../../../../shared/ui/iconos';
import { Miniatura, Nivel, escalaStock } from '../../inventario.modelo';

export interface FilaInventario {
  id: number;
  nombre: string;
  sku: string;
  /** Texto gris junto al nombre: «En Panes» (o «De Harinas del Valle» al agrupar por categoría). */
  gris: string;
  miniatura: Miniatura;
  stock: Stock;
  nivel: Nivel;
}

/** Insignia, etiqueta y medidor de cada nivel. */
const NV: Record<Nivel, { t: string; icono: string; bg: string; fg: string; barra: string; cifra: string }> = {
  sin: { t: 'Sin stock', icono: 'x', bg: '#ffe6e5', fg: '#b42318', barra: '#d82c0d', cifra: '#b42318' },
  bajo: { t: 'Bajo el mínimo', icono: 'alert-triangle', bg: '#fff6d1', fg: '#8a5a00', barra: '#ffb904', cifra: '#8a5a00' },
  ok: { t: 'Con stock', icono: 'check', bg: '#dcfce7', fg: '#0b5c3f', barra: '#303030', cifra: '#303030' },
};

/**
 * Fila de la lista de Inventario (`38px minmax(0,1fr) auto`, arriba):
 * miniatura de 38 px con la insignia del nivel · nombre con «En Panes» en gris ·
 * etiquetas del nivel y el SKU · a la derecha «n u», el medidor con la marca
 * del mínimo y «mín. 12» / «4 reserv.». Seleccionada o con el cursor encima se
 * pega a la hoja; con permiso, el cursor muestra los botones −1 / +1.
 * `despegada`: la seleccionada pasó bajo la cabecera del grupo (sigue blanca).
 */
@Component({
  selector: 'app-fila-inventario',
  standalone: true,
  imports: [TablerIconComponent, IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!resaltada()',
    '[attr.data-sel]': "seleccionada() ? '1' : null",
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    @let n = nv();
    @let r = resaltada();
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="(r ? 'rounded-l-xl rounded-r-none pr-[30px] ' : 'rounded-xl pr-3.5 ') + (destello() ? 'bg-[#e6fbf9]' : r || seleccionada() ? 'bg-white' : 'bg-transparent')">
      <span class="relative flex size-[38px] items-center justify-center rounded-[11px] font-[Archivo] text-[14px] font-semibold text-[#6b7280] transition-[background-color] duration-260"
        [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e6e6e6]'">
        @if (f.miniatura.tipo === 'imagen') {
          <span class="block size-full rounded-[11px] bg-cover bg-center" [style.background-image]="'url(' + f.miniatura.url + ')'"></span>
        } @else {
          {{ letra() }}
        }
        <span [title]="n.t" class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-[box-shadow] duration-260"
          [style.background]="n.bg" [style.color]="n.fg" [style.box-shadow]="'0 0 0 2px ' + (r ? '#fff' : '#f1f1f1')">
          <app-ic [nombre]="n.icono" [size]="10" />
        </span>
      </span>
      <span class="flex min-w-0 flex-col gap-[5px]">
        <span class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-px">
          <span class="max-w-full min-w-0 truncate text-[13px] leading-[18px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ f.nombre }}</span>
          @if (f.gris) { <span class="max-w-full min-w-0 truncate text-[11.5px] text-[#9ca3af]">{{ f.gris }}</span> }
        </span>
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          <span class="inline-flex h-5 shrink-0 items-center gap-[5px] rounded-md px-[7px] text-[11px] font-medium whitespace-nowrap" [style.background]="n.bg" [style.color]="n.fg">
            <app-ic [nombre]="n.icono" [size]="11" />{{ n.t }}
          </span>
          <span class="inline-flex h-5 shrink-0 items-center rounded-md px-1.5 font-mono text-[10.5px] font-medium whitespace-nowrap text-[#6b7280] transition-[background-color] duration-260"
            [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e8e8e8]'">{{ f.sku || 'Sin SKU' }}</span>
        </span>
      </span>
      @if (botones()) {
        <span class="flex h-[38px] animate-[fade-in_.15s] items-center gap-1" (click)="$event.stopPropagation()">
          <button type="button" (click)="ajustar.emit(-1)" title="Restar 1"
            class="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#f1f1f1] text-[#303030] hover:bg-[#e3e3e3]! active:scale-[.92]"
            [class.opacity-35]="f.stock.disponible <= 0">
            <tabler-icon [icon]="icono('minus')" [size]="14" [stroke]="2" />
          </button>
          <span class="min-w-[34px] text-center text-[12.5px] font-semibold tabular-nums" [style.color]="n.cifra">{{ unidades() }}</span>
          <button type="button" (click)="ajustar.emit(1)" title="Sumar 1"
            class="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#303030] text-white hover:bg-[#1a1a1a]! active:scale-[.92]">
            <tabler-icon [icon]="icono('plus')" [size]="14" [stroke]="2" />
          </button>
        </span>
      } @else {
        <span class="flex flex-col items-end gap-1.5 pt-px">
          <span class="text-[13px] font-semibold whitespace-nowrap tabular-nums" [style.color]="n.cifra">{{ unidades() }}</span>
          <span class="flex items-center gap-[7px]">
            <span class="relative block h-1 w-10 rounded-full transition-[background-color] duration-260" [class]="r ? 'bg-[#efefef]' : 'bg-[#e2e2e2]'">
              <span class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-600 ease-[cubic-bezier(.2,.8,.2,1)]" [style.background]="n.barra" [style.width.%]="relleno()"></span>
              @if (f.stock.minimo > 0) {
                <span class="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-sm bg-[#00a19a]" [style.left.%]="posicionMinimo()"></span>
              }
            </span>
            <span class="text-[11.5px] font-medium whitespace-nowrap tabular-nums text-[#9ca3af]">{{ nota() }}</span>
          </span>
        </span>
      }
    </div>
    @if (r) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaInventarioComponent {
  readonly fila = input.required<FilaInventario>();
  readonly seleccionada = input(false);
  /** La seleccionada pasó bajo la cabecera del grupo o salió por abajo. */
  readonly despegada = input(false);
  /** Tiene el permiso inventario.editar (muestra −1 / +1). */
  readonly editable = input(false);
  /** Recién ajustada: fondo turquesa un instante. */
  readonly destello = input(false);
  readonly abrir = output<void>();
  readonly ajustar = output<number>();

  protected readonly icono = icono;
  protected readonly encima = signal(false);
  protected readonly nv = computed(() => NV[this.fila().nivel]);
  protected readonly resaltada = computed(() => (this.seleccionada() && !this.despegada()) || this.encima());
  protected readonly botones = computed(() => this.encima() && this.editable());
  protected readonly unidades = computed(() => num(this.fila().stock.disponible) + ' u');
  protected readonly letra = computed(() => {
    const m = this.fila().miniatura;
    return m.tipo === 'inicial' ? m.letra : ((this.fila().nombre || '?').trim()[0] || '?').toUpperCase();
  });
  /** «4 reserv.» si hay reservas; si no, el mínimo. */
  protected readonly nota = computed(() => {
    const s = this.fila().stock;
    return s.reservado ? `${num(s.reservado)} reserv.` : s.minimo ? `mín. ${num(s.minimo)}` : 'sin mínimo';
  });
  protected readonly relleno = computed(() => {
    const s = this.fila().stock;
    return Math.max(s.disponible > 0 ? 4 : 0, Math.min(100, (s.disponible / escalaStock(s)) * 100));
  });
  protected readonly posicionMinimo = computed(() => (this.fila().stock.minimo / escalaStock(this.fila().stock)) * 100);
}
