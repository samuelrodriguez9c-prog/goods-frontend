import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { OpcionPopover } from '../../../../../products/shared/modelos';
import { BotonFiltroComponent } from '../../../../../products/shared/ui/boton-filtro/boton-filtro.component';
import { OpcionesPopoverComponent } from '../../../../../products/shared/ui/opciones-popover/opciones-popover.component';

export type OrdenClientes = 'reciente' | 'nombre' | 'gasto' | 'pedidos';

const OPCIONES_ORDEN: OpcionPopover[] = [
  { clave: 'reciente', titulo: 'Compraron hace poco', detalle: '', icono: 'calendar-down' },
  { clave: 'nombre', titulo: 'Nombre A→Z', detalle: '', icono: 'sort-az' },
  { clave: 'gasto', titulo: 'Más gasto', detalle: '', icono: 'sort-num' },
  { clave: 'pedidos', titulo: 'Más pedidos', detalle: '', icono: 'receipt' },
];

/** Herramientas de la lista de Clientes: activos o archivados, y el orden. */
@Component({
  selector: 'app-filtros-clientes',
  standalone: true,
  imports: [BotonFiltroComponent, OpcionesPopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-1' },
  template: `
    <app-boton-filtro icono="filter" titulo="Filtros" [activo]="archivados()" [ancho]="280">
      <div class="px-1 pb-3 font-[Archivo] text-[15px] font-semibold text-gray-900">Filtros</div>
      <div class="flex flex-col px-1">
        @for (o of [false, true]; track o) {
          <button type="button" data-cierra (click)="archivados.set(o)" class="cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-[#f7f7f7]"
            [style.background-color]="archivados() === o ? '#f4f4f4' : null" [style.font-weight]="archivados() === o ? 600 : 500">{{ o ? 'Archivados' : 'Activos' }}</button>
        }
      </div>
    </app-boton-filtro>
    <app-boton-filtro icono="arrows-sort" titulo="Ordenar" [activo]="orden() !== 'reciente'">
      <app-opciones-popover titulo="Ordenar" detalle="El orden dentro de cada grupo." [opciones]="opciones" [valor]="orden()" (elegir)="orden.set($any($event))" />
    </app-boton-filtro>
  `,
})
export class FiltrosClientesComponent {
  readonly archivados = model(false);
  readonly orden = model<OrdenClientes>('reciente');
  protected readonly opciones = OPCIONES_ORDEN;
}
