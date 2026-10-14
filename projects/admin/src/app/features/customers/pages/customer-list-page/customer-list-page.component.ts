import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Clientes: lista (búsqueda, orden y archivados) + ficha en la hoja con pestañas Datos, Pedidos y Notas; el cliente nuevo también se carga en la hoja.
 * ?cliente=ID abre la ficha · ?nuevo=1 abre uno nuevo
 *
 * Mismo patrón que los módulos de Productos v5 (cabecera con métricas,
 * lista a la izquierda unida a la hoja de la derecha). Los componentes de
 * esta página viven en `components/`, uno por carpeta. Se completa con el
 * handoff de Pedidos y Clientes (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md).
 */
@Component({
  selector: 'app-customer-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-list-page.component.html',
})
export class CustomerListPageComponent {}
