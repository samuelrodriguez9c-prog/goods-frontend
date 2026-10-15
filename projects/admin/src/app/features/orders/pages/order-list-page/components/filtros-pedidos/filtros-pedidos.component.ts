import { ChangeDetectionStrategy, Component, computed, model, output } from '@angular/core';
import { OpcionPopover } from '../../../../../products/shared/modelos';
import { BotonFiltroComponent } from '../../../../../products/shared/ui/boton-filtro/boton-filtro.component';
import { OpcionesPopoverComponent } from '../../../../../products/shared/ui/opciones-popover/opciones-popover.component';
import { SegmentoComponent } from '../../../../../products/shared/ui/segmento/segmento.component';
import { Canal, EstadoPago } from '../../../../shared/ventas.modelos';

export type AgruparPedidos = 'estado' | 'canal' | 'dia';
export type OrdenPedidos = 'reciente' | 'total';
export type RangoPedidos = 'todo' | '1' | '7' | '30';

const OPCIONES_AGRUPAR: OpcionPopover[] = [
  { clave: 'estado', titulo: 'Estado', detalle: 'Por confirmar, por enviar, en camino y entregados', icono: 'progress-check' },
  { clave: 'canal', titulo: 'Canal', detalle: 'Tienda en línea, WhatsApp y panel', icono: 'store' },
  { clave: 'dia', titulo: 'Día', detalle: 'Para cuadrar la caja de cada día', icono: 'calendar' },
];
const OPCIONES_ORDEN: OpcionPopover[] = [
  { clave: 'reciente', titulo: 'Más recientes', detalle: '', icono: 'calendar-down' },
  { clave: 'total', titulo: 'Mayor total', detalle: '', icono: 'sort-num' },
];

/** Herramientas de la lista de Pedidos: Filtros (fecha, pago y canal), Ordenar y Agrupar. */
@Component({
  selector: 'app-filtros-pedidos',
  standalone: true,
  imports: [BotonFiltroComponent, OpcionesPopoverComponent, SegmentoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-1' },
  template: `
    <app-boton-filtro icono="filter" titulo="Filtros" [activo]="nFiltros() > 0" [ancho]="320">
      <div class="flex items-baseline justify-between px-1 pb-3">
        <span class="font-[Archivo] text-[15px] font-semibold text-gray-900">Filtros</span>
        @if (nFiltros()) {
          <button type="button" class="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900" (click)="quitar()">Quitar {{ nFiltros() }}</button>
        }
      </div>
      <div class="flex flex-col gap-3.5 px-1">
        <div>
          <div class="gp-label">Fecha</div>
          <app-segmento [opciones]="[['todo', 'Todo'], ['1', 'Hoy'], ['7', '7 d'], ['30', '30 d']]" [valor]="rango()" (elegir)="rango.set($any($event))" />
        </div>
        <div>
          <div class="gp-label">Pago</div>
          <app-segmento [opciones]="[['todos', 'Todos'], ['pendiente', 'Por cobrar'], ['pagado', 'Pagado'], ['reembolsado', 'Reemb.']]" [valor]="pago()" (elegir)="pago.set($any($event))" />
        </div>
        <div>
          <div class="gp-label">Canal</div>
          @for (o of canales; track o[1]) {
            <button type="button" (click)="canal.set(o[0])"
              class="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-[#f7f7f7]"
              [style.background-color]="canal() === o[0] ? '#f4f4f4' : null" [style.font-weight]="canal() === o[0] ? 600 : 500">{{ o[1] }}</button>
          }
        </div>
      </div>
    </app-boton-filtro>
    <app-boton-filtro icono="arrows-sort" titulo="Ordenar" [activo]="orden() !== 'reciente'">
      <app-opciones-popover titulo="Ordenar" detalle="El orden dentro de cada grupo." [opciones]="opcionesOrden" [valor]="orden()" (elegir)="orden.set($any($event))" />
    </app-boton-filtro>
    <app-boton-filtro icono="stack-2" titulo="Agrupar la lista" [activo]="agrupar() !== 'estado'">
      <app-opciones-popover titulo="Agrupar la lista" detalle="Cómo se ordenan los pedidos en grupos plegables." [opciones]="opcionesAgrupar" [valor]="agrupar()"
        [plegable]="true" (elegir)="agrupar.set($any($event))" (abrirTodos)="plegar.emit(false)" (plegarTodos)="plegar.emit(true)" />
    </app-boton-filtro>
  `,
})
export class FiltrosPedidosComponent {
  readonly canal = model<Canal | null>(null);
  readonly pago = model<EstadoPago | 'todos'>('todos');
  readonly rango = model<RangoPedidos>('todo');
  readonly orden = model<OrdenPedidos>('reciente');
  readonly agrupar = model<AgruparPedidos>('estado');
  /** true = plegar todos los grupos. */
  readonly plegar = output<boolean>();

  protected readonly opcionesAgrupar = OPCIONES_AGRUPAR;
  protected readonly opcionesOrden = OPCIONES_ORDEN;
  protected readonly canales: [Canal | null, string][] = [[null, 'Todos los canales'], ['tienda', 'Tienda en línea'], ['whatsapp', 'WhatsApp'], ['panel', 'Panel']];
  protected readonly nFiltros = computed(() => (this.canal() ? 1 : 0) + (this.pago() !== 'todos' ? 1 : 0) + (this.rango() !== 'todo' ? 1 : 0));

  protected quitar(): void {
    this.canal.set(null);
    this.pago.set('todos');
    this.rango.set('todo');
  }
}
