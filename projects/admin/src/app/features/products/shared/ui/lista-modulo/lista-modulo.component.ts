import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, TemplateRef, contentChild, input, output, signal, viewChild,
} from '@angular/core';
import { ChipFiltro, FilaModulo, GrupoModulo } from '../../modelos';
import { IcComponent } from '../ic/ic.component';

/**
 * Lista de la izquierda de los módulos lista + hoja: buscador en
 * pastilla, herramientas (`[herramientas]`), resultados y chips de filtros,
 * y los grupos plegables con sus filas.
 *
 * Cada fila: tick de color, miniatura (ícono, iniciales o foto), nombre con
 * etiqueta, detalle y a la derecha `valor` (o la plantilla `#derecha`). Con
 * el cursor encima la plantilla `#acciones` reemplaza a la derecha. La fila
 * abierta (o con el cursor) se pega a la hoja con esquinas cóncavas.
 *
 * `/` enfoca el buscador.
 */
@Component({
  selector: 'app-lista-modulo',
  standalone: true,
  imports: [IcComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative z-[2] -mr-4 flex h-full min-h-0 min-w-0 flex-col',
    '(document:keydown)': 'tecla($event)',
  },
  template: `
    <div class="flex items-center gap-1.5 pr-7 pb-2.5">
      <label class="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#e6e6e6] px-3 transition-[background-color,box-shadow] duration-200 ease-[ease] has-[input:focus]:bg-white has-[input:focus]:shadow-[0_0_0_1px_#d4d4d4]">
        <app-ic nombre="search" [size]="15" class="text-[#8a8a8a]" />
        <input #buscador [value]="buscar()" (input)="buscarChange.emit($any($event.target).value)" (keydown.escape)="$any($event.target).blur()"
          [placeholder]="placeholder()" class="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-[#111827] outline-none" />
        @if (buscar()) {
          <button type="button" (click)="buscarChange.emit('')" class="flex cursor-pointer text-[#8a8a8a]"><app-ic nombre="x" [size]="13" /></button>
        }
      </label>
      <ng-content select="[herramientas]" />
    </div>

    <div class="flex min-h-6.5 flex-wrap items-center gap-2 pr-7 pb-2 pl-1">
      <span class="text-[12px] text-[#6b7280] tabular-nums">{{ resultados() }}</span>
      @for (c of chips(); track c.texto) {
        <span class="inline-flex animate-[fade-in-up_.2s_ease-out] items-center gap-1.5 rounded-full bg-[#e3e3e3] py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-[#374151]">
          {{ c.texto }}
          <button type="button" (click)="c.quitar()" class="flex size-4 cursor-pointer items-center justify-center rounded-full text-[#6b7280] hover:bg-[#d1d5db]! hover:text-[#111827]!">
            <app-ic nombre="x" [size]="11" />
          </button>
        </span>
      }
      @if (buscar()) {
        <span class="inline-flex animate-[fade-in-up_.2s_ease-out] items-center gap-1.5 rounded-full bg-[#e3e3e3] py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-[#374151]">
          «{{ buscar() }}»
          <button type="button" (click)="buscarChange.emit('')" class="flex size-4 cursor-pointer items-center justify-center rounded-full text-[#6b7280] hover:bg-[#d1d5db]! hover:text-[#111827]!">
            <app-ic nombre="x" [size]="11" />
          </button>
        </span>
      }
    </div>

    <div class="relative min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none]">
      @if (cargando()) {
        <div class="flex flex-col gap-2 pt-3 pr-7">
          @for (k of [1, 2, 3, 4, 5, 6]; track k) {
            <span class="h-12 animate-[gp-brillo_1.4s_linear_infinite] rounded-xl [background:linear-gradient(90deg,#e6e6e6_0,#ededed_80px,#e6e6e6_160px)] [background-size:320px_100%]"></span>
          }
        </div>
      } @else if (sinCoincidencias()) {
        <div class="animate-[fade-in-up_.2s_ease-out] pt-10 pr-11 pb-10 pl-4 text-center">
          <p class="text-[13px] text-[#6b7280]">{{ vacioTexto() }}</p>
          @if (conLimpiar()) {
            <button type="button" (click)="limpiar.emit()"
              class="mt-3 cursor-pointer rounded-full bg-[#e3e3e3] px-3 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-[#d4d4d4]!">Limpiar filtros</button>
          }
        </div>
      } @else {
        @for (g of grupos(); track g.clave) {
          @let abierto = !colapsados().has(g.clave);
          <button type="button" (click)="alternarGrupo.emit(g.clave)"
            class="sticky top-0 z-[3] flex w-[calc(100%_-_28px)] cursor-pointer items-center gap-2.5 bg-[#f1f1f1] pt-3.5 pr-2 pb-2 pl-1 text-left">
            <span class="flex size-5.5 shrink-0 items-center justify-center rounded-full" [style.background]="g.fondo" [style.color]="g.color">
              <app-ic [nombre]="g.icono" [size]="13" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-[1px]">
              <span class="flex items-center gap-[7px]">
                <span class="text-[13px] font-semibold text-[#111827]">{{ g.titulo }}</span>
                <span class="rounded-full bg-[#e3e3e3] px-[7px] text-[11px] leading-[17px] font-semibold text-[#4b5563] tabular-nums">{{ g.filas.length }}</span>
              </span>
              <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ g.sub }}</span>
            </span>
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a]">
              <app-ic nombre="chevron-down" [size]="14" class="transition-[rotate] duration-240 ease-[cubic-bezier(.2,.8,.2,1)]" [class.-rotate-90]="!abierto" />
            </span>
          </button>
          <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" [class]="abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
            <div class="min-h-0 overflow-visible transition-[clip-path] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
              [class]="abierto ? '[clip-path:inset(-14px_-2px_-14px_-2px)]' : '[clip-path:inset(0)]'">
              <div class="flex flex-col gap-0.5 pt-0.5 pb-1">
                @for (f of g.filas; track f.id) {
                  @let sel = f.id === seleccionadaId();
                  @let res = sel || f.id === encima();
                  <div class="relative transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]" [class.mr-7]="!res"
                    (mouseenter)="encima.set(f.id)" (mouseleave)="encima.set(null)">
                    <div (click)="seleccionar.emit(f.id)"
                      class="relative grid cursor-pointer grid-cols-[4px_36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-l-xl py-2 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
                      [class]="res ? 'rounded-r-none bg-white pr-[30px]' : 'rounded-r-xl bg-transparent pr-3.5'">
                      <span class="h-7 w-[3px] rounded-full transition-[background-color] duration-300" [style.background-color]="f.barra"></span>
                      <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] font-[Archivo] text-[13px] font-semibold"
                        [style.background-color]="f.mini.fondo" [style.color]="f.mini.tinta">
                        @if (f.mini.url) {
                          <img [src]="f.mini.url" alt="" class="size-full object-cover" />
                        } @else if (f.mini.iniciales) {
                          {{ f.mini.iniciales }}
                        } @else {
                          <app-ic [nombre]="f.mini.icono ?? 'category'" [size]="16" />
                        }
                      </span>
                      <span class="flex min-w-0 flex-col gap-0.5">
                        <span class="flex min-w-0 items-center gap-1.5">
                          <span class="truncate text-[13.5px] text-[#111827]" [class]="sel ? 'font-semibold' : 'font-medium'">{{ f.nombre }}</span>
                          @if (f.etiqueta) {
                            <span class="shrink-0 rounded-md bg-[#e3e3e3] px-1.5 text-[10.5px] leading-[17px] font-medium text-[#4b5563]">{{ f.etiqueta }}</span>
                          }
                        </span>
                        @if (f.pastilla || f.codigo) {
                          <span class="flex min-w-0 items-center gap-1.5 text-[11.5px] whitespace-nowrap text-[#8a8a8a]">
                            @if (f.pastilla; as mk) {
                              <span [title]="mk.tip" class="shrink-0 rounded-[5px] bg-[#e0f7f5] px-[5px] text-[10px] leading-[15px] font-semibold text-[#00605b]">{{ mk.texto }}</span>
                            }
                            @if (f.codigo) {
                              <span class="shrink-0 font-['IBM_Plex_Mono',monospace] text-[11px] font-medium text-[#6b7280]">{{ f.codigo }}</span>
                            }
                            <span class="truncate">{{ f.sub }}</span>
                          </span>
                        } @else {
                          <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ f.sub }}</span>
                        }
                      </span>
                      <span class="relative flex min-h-9 flex-col items-end justify-center gap-[3px]">
                        <span class="flex flex-col items-end gap-[3px] transition-opacity duration-150" [class.opacity-0]="acciones() && f.id === encima() && tieneAccion()(f)">
                          @if (derecha(); as t) {
                            <ng-container [ngTemplateOutlet]="t" [ngTemplateOutletContext]="{ $implicit: f }" />
                          } @else {
                            <span class="text-[12.5px] font-semibold whitespace-nowrap tabular-nums" [style.color]="f.valorColor">{{ f.valor }}</span>
                          }
                        </span>
                        @if (acciones() && f.id === encima() && tieneAccion()(f)) {
                          <span class="absolute inset-y-0 right-0 flex animate-[fade-in_.15s_ease-out] items-center" (click)="$event.stopPropagation()">
                            <ng-container [ngTemplateOutlet]="acciones()!" [ngTemplateOutletContext]="{ $implicit: f }" />
                          </span>
                        }
                      </span>
                    </div>
                    @if (res) {
                      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
                      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
        <ng-content select="[pie]" />
      }
    </div>
  `,
})
export class ListaModuloComponent {
  readonly grupos = input.required<GrupoModulo<unknown>[]>();
  readonly seleccionadaId = input<number | null>(null);
  readonly colapsados = input<Set<string>>(new Set());
  readonly buscar = input('');
  readonly placeholder = input('Buscar');
  readonly resultados = input('');
  readonly chips = input<ChipFiltro[]>([]);
  readonly cargando = input(false);
  readonly sinCoincidencias = input(false);
  readonly vacioTexto = input('Nada coincide con estos filtros.');
  /** «Limpiar filtros» bajo el texto vacío (sin datos todavía no tiene sentido). */
  readonly conLimpiar = input(true);
  /** Si la fila tiene algo que mostrar en `#acciones` (si no, la derecha queda fija). */
  readonly tieneAccion = input<(f: FilaModulo<unknown>) => boolean>(() => true);

  readonly seleccionar = output<number>();
  readonly buscarChange = output<string>();
  readonly alternarGrupo = output<string>();
  readonly limpiar = output<void>();

  protected readonly derecha = contentChild<TemplateRef<unknown>>('derecha');
  protected readonly acciones = contentChild<TemplateRef<unknown>>('acciones');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  protected readonly encima = signal<number | null>(null);

  protected tecla(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target as HTMLElement).isContentEditable) return;
    e.preventDefault();
    this.buscador()?.nativeElement.focus();
  }
}
