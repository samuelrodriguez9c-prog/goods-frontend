import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, TemplateRef, contentChild, input, output, signal, viewChild,
} from '@angular/core';
import { ChipFiltro, FilaModulo, GrupoModulo } from '../../modelos';
import type { AccionFila } from '../../filas';
import { IcComponent } from '../ic/ic.component';
import { AccionFilaComponent } from '../../../../../shared/ui/accion-fila/accion-fila.component';
import { DespegueDirective } from '../../../../../shared/ui/despegue/despegue.directive';
import { CargarMasComponent, PaginaPorGrupo } from '../../../../../shared/ui/cargar-mas/cargar-mas.component';

type Fila = FilaModulo<unknown>;

/**
 * Lista de la izquierda de los módulos lista + hoja (Pedidos, Clientes):
 * buscador en pastilla, herramientas (`[herramientas]`), resultados y chips de
 * filtros, y los grupos plegables con sus filas. `/` enfoca el buscador.
 *
 * - `[arriba]`: slot antes del buscador para la lectura (subtítulo) y la
 *   franja de métricas; así la hoja empieza a la altura del subtítulo.
 * - Fila nueva: miniatura 38 px con insignia de estado · nombre (+ gris, ★) ·
 *   subtítulo gris con íconos · máx. 2 etiquetas · derecha valor + sub + medidor.
 * - `accion` en la fila: botón circular con verbo + nota al pasar el cursor
 *   (`app-accion-fila`), reemplaza la derecha. `#acciones` sigue funcionando.
 * - Cada grupo muestra 15 filas y «Cargar 15 más · quedan N» al final; la
 *   abierta siempre se ve.
 * - Despegue: la fila abierta se suelta del panel al pasar bajo la cabecera
 *   sticky (48 px) o salir por abajo (`appDespegue`).
 */
@Component({
  selector: 'app-lista-modulo',
  standalone: true,
  imports: [IcComponent, NgTemplateOutlet, AccionFilaComponent, DespegueDirective, CargarMasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative z-[2] -mr-4 flex h-full min-h-0 min-w-0 flex-col',
    '(document:keydown)': 'tecla($event)',
  },
  template: `
    <ng-content select="[arriba]" />

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
          <button type="button" (click)="c.quitar()" class="flex size-4 cursor-pointer items-center justify-center rounded-full text-[#6b7280] hover:bg-[#d1d5db]! hover:text-[#111827]!"><app-ic nombre="x" [size]="11" /></button>
        </span>
      }
      @if (buscar()) {
        <span class="inline-flex animate-[fade-in-up_.2s_ease-out] items-center gap-1.5 rounded-full bg-[#e3e3e3] py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-[#374151]">
          «{{ buscar() }}»
          <button type="button" (click)="buscarChange.emit('')" class="flex size-4 cursor-pointer items-center justify-center rounded-full text-[#6b7280] hover:bg-[#d1d5db]! hover:text-[#111827]!"><app-ic nombre="x" [size]="11" /></button>
        </span>
      }
    </div>

    <div appDespegue [cabecera]="48" [seleccion]="seleccionadaId()" #d="despegue" class="relative min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none]">
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
            <button type="button" (click)="limpiar.emit()" class="mt-3 cursor-pointer rounded-full bg-[#e3e3e3] px-3 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-[#d4d4d4]!">Limpiar filtros</button>
          }
        </div>
      } @else {
        @for (g of grupos(); track g.clave) {
          @let abierto = !colapsados().has(g.clave);
          <!-- Cabecera sticky: ancho calc(100% - 28px) para NO montarse sobre la hoja. -->
          <button type="button" (click)="alternarGrupo.emit(g.clave)"
            class="sticky top-0 z-[3] flex w-[calc(100%_-_28px)] cursor-pointer items-center gap-2.5 bg-[#f1f1f1] pt-3.5 pr-2 pb-2 pl-1 text-left">
            <span class="flex size-5.5 shrink-0 items-center justify-center rounded-full" [style.background]="g.fondo" [style.color]="g.color"><app-ic [nombre]="g.icono" [size]="13" /></span>
            <span class="flex min-w-0 flex-1 flex-col gap-px">
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
            <div class="min-h-0 overflow-visible transition-[clip-path] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" [class]="abierto ? '[clip-path:inset(-14px_-2px_-14px_-2px)]' : '[clip-path:inset(0)]'">
              <div class="flex flex-col gap-0.5 pt-0.5 pb-1">
                @let pg = pagina.ver(g.clave, g.filas, seleccionadaId());
                @for (f0 of pg.filas; track f0.id) {
                  @let f = $any(f0);
                  @let sel = f.id === seleccionadaId();
                  @let hov = f.id === encima();
                  @let res = (sel && !d.despegada()) || hov;
                  @let conAccion = hov && (f.accion || (acciones() && tieneAccion()(f)));
                  <div class="relative transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]" [class.mr-7]="!res" [attr.data-sel]="sel ? '1' : null"
                    (mouseenter)="encima.set(f.id)" (mouseleave)="encima.set(null)">
                    <div (click)="seleccionar.emit(f.id)"
                      class="relative grid cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
                      [class]="res ? 'rounded-l-xl rounded-r-none bg-white pr-[30px]' : (sel ? 'rounded-xl bg-white pr-3.5' : 'rounded-xl bg-transparent pr-3.5')">

                      <!-- Miniatura + insignia -->
                      <span class="relative flex size-[38px] items-center justify-center font-[Archivo] text-[14px] font-semibold transition-[background-color] duration-260"
                        [class]="f.redonda ? 'rounded-full' : 'rounded-[11px]'" [style.background-color]="f.mini.fondo ?? (res ? '#f4f4f4' : '#e6e6e6')" [style.color]="f.mini.tinta ?? '#6b7280'">
                        @if (f.mini.url) { <img [src]="f.mini.url" alt="" class="size-full rounded-[inherit] object-cover" /> }
                        @else if (f.mini.iniciales) { {{ f.mini.iniciales }} }
                        @else { <app-ic [nombre]="f.mini.icono ?? 'category'" [size]="17" /> }
                        @if (f.insignia; as i) {
                          <span [title]="i.tip" class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-[box-shadow] duration-260"
                            [style.background]="i.fondo" [style.color]="i.tinta" [style.box-shadow]="'0 0 0 2px ' + (res ? '#fff' : '#f1f1f1')">
                            <app-ic [nombre]="i.icono" [size]="10" />
                          </span>
                        }
                      </span>

                      <!-- Centro -->
                      <span class="flex min-w-0 flex-col gap-[5px]">
                        <span class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-px">
                          <span class="min-w-0 max-w-full truncate text-[13px] leading-[18px] text-[#111827]" [class]="sel ? 'font-semibold' : 'font-medium'">{{ f.nombre }}</span>
                          @if (f.estrella) { <app-ic nombre="star-filled" [size]="11" class="self-center text-[#ffb904]" /> }
                          @if (f.nombreGris) { <span class="min-w-0 max-w-full truncate text-[11.5px] text-[#9ca3af]">{{ f.nombreGris }}</span> }
                        </span>
                        @if (f.segmentos?.length) {
                          <span class="-mt-[3px] flex min-w-0 items-center gap-2 overflow-hidden text-[12px] leading-4 text-[#6b7280]">
                            @for (s of f.segmentos; track $index; let ult = $last) {
                              <span class="inline-flex items-center gap-1 whitespace-nowrap" [class]="ult ? 'min-w-0 flex-1 truncate' : 'shrink-0'"
                                [style.font-family]="s.mono ? mono : null" [style.font-size.px]="s.mono ? 11 : null">
                                @if (s.icono) { <app-ic [nombre]="s.icono" [size]="12" class="shrink-0 text-[#9ca3af]" /> }
                                <span class="truncate">{{ s.texto }}</span>
                              </span>
                            }
                          </span>
                        } @else if (f.sub || f.codigo) {
                          <span class="-mt-[3px] flex min-w-0 items-center gap-1.5 text-[12px] leading-4 whitespace-nowrap text-[#6b7280]">
                            @if (f.pastilla; as mk) {
                              <span [title]="mk.tip" class="shrink-0 rounded-[5px] bg-[#e0f7f5] px-[5px] text-[10px] leading-[15px] font-semibold text-[#00605b]">{{ mk.texto }}</span>
                            }
                            @if (f.codigo) { <span class="shrink-0 text-[11px]" [style.font-family]="mono">{{ f.codigo }}</span> }
                            <span class="truncate">{{ f.sub }}</span>
                          </span>
                        }
                        @if (f.etiquetas?.length) {
                          <span class="flex min-w-0 flex-wrap items-center gap-1">
                            @for (e of f.etiquetas; track e.texto) {
                              <span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap transition-[background-color] duration-260"
                                [style.font-family]="e.mono ? mono : null" [style.font-size.px]="e.mono ? 10.5 : null"
                                [style.background]="e.tono ? e.tono[0] : (res ? '#f4f4f4' : '#e8e8e8')" [style.color]="e.tono ? e.tono[1] : (e.mono ? '#6b7280' : '#4b5563')">
                                @if (e.icono) { <app-ic [nombre]="e.icono" [size]="11" /> }{{ e.texto }}
                              </span>
                            }
                          </span>
                        }
                      </span>

                      <!-- Derecha (o la acción con el cursor) -->
                      @if (conAccion) {
                        @if (f.accion) {
                          <app-accion-fila [accion]="f.accion" (accionar)="accion.emit({ id: f.id, accion: f.accion })" />
                        } @else {
                          <span class="flex h-[38px] animate-[fade-in_.15s_ease-out] items-center" (click)="$event.stopPropagation()">
                            <ng-container [ngTemplateOutlet]="acciones()!" [ngTemplateOutletContext]="{ $implicit: f }" />
                          </span>
                        }
                      } @else {
                        <span class="flex flex-col items-end gap-1.5 pt-px">
                          @if (derecha(); as t) {
                            <ng-container [ngTemplateOutlet]="t" [ngTemplateOutletContext]="{ $implicit: f }" />
                          } @else {
                            <span class="text-[13px] font-semibold whitespace-nowrap tabular-nums" [style.color]="f.valorColor ?? '#111827'">{{ f.valor }}</span>
                            <span class="flex items-center gap-[7px]">
                              @if (f.medidor; as m) {
                                <span class="relative block h-1 w-10 rounded-full transition-[background-color] duration-260" [style.background]="res ? '#efefef' : '#e2e2e2'">
                                  <span class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-600" [style.width.%]="m.w" [style.background]="m.c"></span>
                                  @if (m.m != null) { <span class="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-sm bg-[#00a19a]" [style.left.%]="m.m"></span> }
                                </span>
                              }
                              @if (f.valorSub) { <span class="text-[11.5px] font-medium whitespace-nowrap tabular-nums" [style.color]="f.valorSubColor ?? '#9ca3af'">{{ f.valorSub }}</span> }
                            </span>
                          }
                        </span>
                      }
                    </div>
                    @if (res) {
                      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
                      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
                    }
                  </div>
                }
                <app-cargar-mas [quedan]="pg.quedan" (cargar)="pagina.mas(g.clave)" />
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
  readonly conLimpiar = input(true);
  /** Solo para filas sin `accion` que usan la plantilla `#acciones` (Inventario − / +). */
  readonly tieneAccion = input<(f: Fila) => boolean>(() => true);

  readonly seleccionar = output<number>();
  readonly buscarChange = output<string>();
  readonly alternarGrupo = output<string>();
  readonly limpiar = output<void>();
  /** Tocaron el botón circular de la fila. */
  readonly accion = output<{ id: number; accion: AccionFila }>();

  protected readonly derecha = contentChild<TemplateRef<unknown>>('derecha');
  protected readonly acciones = contentChild<TemplateRef<unknown>>('acciones');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  protected readonly encima = signal<number | null>(null);
  /** 15 filas por grupo y «Cargar 15 más · quedan N» (como Productos). */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly mono = "'IBM Plex Mono', ui-monospace, monospace";

  protected tecla(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target as HTMLElement).isContentEditable) return;
    e.preventDefault();
    this.buscador()?.nativeElement.focus();
  }
}
