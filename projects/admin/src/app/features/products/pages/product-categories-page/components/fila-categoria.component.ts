import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { pl } from '../../../shared/formato';
import { icono } from '../../../shared/ui/iconos';
import { Miniatura } from '../categorias.util';
import { MiniaturaComponent } from './miniatura.component';

export interface FilaCategoria {
  id: number;
  nombre: string;
  detalle: string;
  miniatura: Miniatura;
  activa: boolean;
  /** Subcategoría dentro de su principal (árbol): más sangría y más chica. */
  subnivel: boolean;
  negrita: boolean;
  productos: number;
  /** Ancho de la barra de productos, en %. */
  barra: number;
  /** Seleccionada o con el mouse encima: se pega a la hoja. */
  resaltada: boolean;
  arrastrable: boolean;
  /** Qué va en la primera columna. */
  marca: 'plegar' | 'asa' | 'flecha' | 'barra';
  /** Nodo desplegado (para la flecha de plegar). */
  abierta: boolean;
  /** Mientras se arrastra: es el destino bajo el puntero, o un destino posible. */
  destino: 'actual' | 'posible' | null;
  destello: boolean;
  /** Atenuada: la que se arrastra, un destino imposible o una principal que solo da contexto al filtro. */
  atenuada: 'arrastrada' | 'invalida' | 'contexto' | null;
}

const OPACIDAD = { arrastrada: 'opacity-40', invalida: 'opacity-45', contexto: 'opacity-60' } as const;

/**
 * Fila de la lista de categorías (árbol y por estado). Los eventos de clic,
 * mouse y arrastre los escucha la página sobre el propio elemento.
 */
@Component({
  selector: 'app-fila-categoria',
  standalone: true,
  imports: [TablerIconComponent, MiniaturaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!fila().resaltada',
  },
  template: `
    @let f = fila();
    <div
      [attr.draggable]="f.arrastrable ? 'true' : 'false'"
      class="relative grid cursor-pointer grid-cols-[16px_32px_minmax(0,1fr)_84px] items-center gap-2.5 py-2 outline-offset-[-2px] select-none [transition:background-color_260ms_cubic-bezier(.2,.8,.2,1),_border-radius_260ms_cubic-bezier(.2,.8,.2,1),_padding_260ms_cubic-bezier(.2,.8,.2,1),_opacity_.2s,_outline-color_.2s]"
      [class]="clases()"
    >
      <span class="flex h-7 items-center justify-center">
        @switch (f.marca) {
          @case ('plegar') {
            <button
              type="button"
              (click)="$event.stopPropagation(); alternar.emit()"
              title="Plegar / desplegar"
              class="flex size-5 cursor-pointer items-center justify-center rounded-full text-[#8a8a8a] hover:bg-[#e3e3e3]! hover:text-[#111827]!"
            >
              <tabler-icon
                [icon]="i.chevron"
                [size]="14"
                [stroke]="2"
                class="transition-[rotate] duration-240 ease-[cubic-bezier(.2,.8,.2,1)]"
                [class.-rotate-90]="!f.abierta"
              />
            </button>
          }
          @case ('asa') {
            <tabler-icon [icon]="i.asa" [size]="15" [stroke]="2" title="Arrastra para moverla" class="animate-[fade-in_.15s] cursor-grab text-[#6b7280]" />
          }
          @case ('flecha') {
            <tabler-icon [icon]="i.flecha" [size]="14" [stroke]="2" class="text-[#b5b5b5]" />
          }
          @case ('barra') {
            <span class="h-7 w-[3px] rounded-full" [class]="f.activa ? 'bg-[#087b5d]' : 'bg-[#9ca3af]'"></span>
          }
        }
      </span>
      <span class="flex items-center justify-center">
        <app-miniatura [miniatura]="f.miniatura" class="rounded-[9px]" [class]="f.subnivel ? 'size-7' : 'size-8'" />
      </span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span
            class="truncate text-[#111827]"
            [class]="(f.subnivel ? 'text-[13px] ' : 'text-[13.5px] ') + (f.negrita ? 'font-semibold' : 'font-medium')"
          >{{ f.nombre }}</span>
          @if (!f.activa) {
            <span class="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#e3e3e3] px-1.5 text-[10.5px] leading-[17px] font-medium text-[#4b5563]">
              <tabler-icon [icon]="i.oculta" [size]="11" [stroke]="2" />Inactiva
            </span>
          }
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ f.detalle }}</span>
      </span>
      <span class="flex w-21 flex-col items-end gap-[5px]">
        @if (f.destino === 'actual') {
          <span class="inline-flex animate-[pop_.3s_cubic-bezier(.2,.8,.2,1)] items-center gap-[5px] rounded-full bg-[#00a39b] px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-white">
            <tabler-icon [icon]="i.soltar" [size]="12" [stroke]="2" />Mover aquí
          </span>
        } @else {
          <span class="text-[11.5px] font-semibold whitespace-nowrap tabular-nums" [class]="f.productos ? 'text-[#303030]' : 'text-[#b5b5b5]'">
            {{ conteo() }}
          </span>
          <span
            class="relative block h-1 w-16 overflow-hidden rounded-full transition-[background-color] duration-260 ease-[ease]"
            [class]="f.resaltada ? 'bg-[#efefef]' : 'bg-[#e2e2e2]'"
          >
            <span
              class="absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-600 ease-[cubic-bezier(.2,.8,.2,1)]"
              [class]="f.activa ? 'bg-[#303030]' : 'bg-[#b5b5b5]'"
              [style.width.%]="f.barra"
            ></span>
          </span>
        }
      </span>
    </div>
    @if (f.resaltada) {
      <!-- Esquinas cóncavas que unen la fila con la hoja -->
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaCategoriaComponent {
  readonly fila = input.required<FilaCategoria>();
  /** Plegar / desplegar sus subcategorías. */
  readonly alternar = output<void>();

  protected readonly i = {
    chevron: icono('chevron-down'),
    asa: icono('grip-vertical'),
    flecha: icono('corner-down-right'),
    oculta: icono('eye-off'),
    soltar: icono('arrow-bar-to-down'),
  };

  protected readonly conteo = computed(() => pl(this.fila().productos, 'producto', 'productos'));

  protected readonly clases = computed(() => {
    const f = this.fila();
    return [
      f.resaltada ? 'rounded-l-xl pr-[30px]' : 'rounded-xl pr-3.5',
      f.subnivel ? 'pl-[34px]' : 'pl-2.5',
      f.destino === 'actual' ? 'bg-[#e0f7f5]' : f.destello ? 'bg-[#e6fbf9]' : f.resaltada ? 'bg-white' : 'bg-transparent',
      f.destino === 'actual'
        ? 'outline-[1.5px] outline-dashed outline-[#00a39b]'
        : f.destino === 'posible'
          ? 'outline-[1.5px] outline-dashed outline-[#9fe3de]'
          : 'outline-0 outline-transparent',
      f.atenuada ? OPACIDAD[f.atenuada] : '',
    ].join(' ');
  });
}
