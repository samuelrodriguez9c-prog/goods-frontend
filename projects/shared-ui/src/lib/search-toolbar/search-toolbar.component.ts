import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconSearch, IconX, TablerIconComponent } from '@tabler/icons-angular';

/** Una pestaña de vista (ej. "Todos", "Activa") — reemplaza las pills con
 * anillo que envolvían `app-status-badge` en `empresas-page` (no se
 * parecían a nada de Shopify) por el patrón real de la barra "All" de
 * Orders (captura 61): texto plano, la activa con una píldora de fondo
 * gris, sin badge/punto de color adentro — el color de estado ya vive en
 * la columna de la tabla, no hace falta repetirlo acá. */
export interface SearchToolbarTab {
  readonly value: string | null;
  readonly label: string;
}

/** Un filtro aplicado, mostrado como tag/pill removible debajo de la
 * barra de búsqueda (ver ADMIN_DISENO.md > "Barra de búsqueda y
 * filtros"). `key` identifica QUÉ filtro es (para poder sacarlo desde
 * `filterRemoved` sin adivinar por el texto), `label` es lo que se
 * muestra (ej. "Plan: Premium"). */
export interface AppliedFilterChip {
  readonly key: string;
  readonly label: string;
}

/**
 * Barra de búsqueda + filtros — calco de la barra "Search and filter" de
 * Shopify (capturas 61 de Orders y 446 de Customers, ver ADMIN_DISENO.md
 * > "Barra de búsqueda y filtros"): un campo de texto SIN caja/borde
 * visible que flota directo sobre la tarjeta blanca de la tabla (nada
 * que ver con el `<input>` de `bg-canvas-bg` con label arriba que tenían
 * `EmpresasPageComponent`/`AuditoriaPageComponent` hasta ahora — ese
 * patrón es el de un campo de FORMULARIO, no el de un buscador de
 * listado), más una fila opcional de pestañas de vista arriba y una fila
 * opcional de tags de filtros aplicados abajo.
 *
 * Deliberadamente NO incluye los controles de filtro en sí (select de
 * plan, rango de fechas, etc.) — esos varían por pantalla y viven en un
 * `p-popover` propio de cada página (mismo patrón "PrimeNG solo por
 * comportamiento" que `QuickAdjustPopoverComponent`), proyectado acá vía
 * `[toolbarActions]`. Así este componente se queda con una sola
 * responsabilidad (buscar + mostrar/quitar lo ya aplicado), en vez de
 * intentar adivinar de antemano qué tipos de filtro va a necesitar cada
 * pantalla futura.
 *
 * Se usa como primer hijo de `<app-data-table>` (slot `[toolbar]`, ver
 * ese componente) para que quede DENTRO de la misma tarjeta redondeada
 * que la tabla — en las capturas de Shopify la barra de búsqueda y la
 * tabla son una sola pieza visual, no dos tarjetas separadas.
 */
@Component({
  selector: 'app-search-toolbar',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-toolbar.component.html',
})
export class SearchToolbarComponent {
  /** Placeholder del campo de búsqueda (ej. "Nombre, correo o dueño"). */
  readonly placeholder = input('Buscar');

  /** Valor actual — el consumidor sigue siendo dueño del signal, este
   * componente no guarda estado propio (mismo patrón sin Angular Forms
   * que el resto del panel de staff). */
  readonly searchValue = input('');
  readonly searchValueChange = output<string>();

  /** Se emite con Enter en el campo de búsqueda — mismo `cargar()` que
   * ya dispara el botón "Filtrar" de adentro del popover de Filtros. */
  readonly submitted = output<void>();

  /** Pestañas de vista opcionales (ej. estados de Empresa). Vacío = no
   * se muestra la fila. */
  readonly tabs = input<readonly SearchToolbarTab[]>([]);
  readonly activeTab = input<string | null>(null);
  readonly activeTabChange = output<string | null>();

  /** Filtros ya aplicados (plan, rango de fechas, etc.) — vacío = no se
   * muestra la fila de tags. */
  readonly appliedFilters = input<readonly AppliedFilterChip[]>([]);
  readonly filterRemoved = output<string>();
  readonly filtersCleared = output<void>();

  /** Texto opcional tipo "12 resultados" (ver `empresas-page`, "Total
   * REAL vs. filtrado" en ese componente) — se muestra a la izquierda de
   * la fila de tags, y por sí solo ya alcanza para mostrar esa fila
   * (útil para dar feedback en vivo del filtrado aunque no haya ningún
   * chip todavía). `null` = no mostrar nada. */
  readonly resultsSummary = input<string | null>(null);

  protected readonly iconSearch = IconSearch;
  protected readonly iconX = IconX;

  protected onSearchInput(value: string): void {
    this.searchValueChange.emit(value);
  }

  protected selectTab(value: string | null): void {
    if (value === this.activeTab()) {
      return;
    }
    this.activeTabChange.emit(value);
  }

  protected removeFilter(key: string): void {
    this.filterRemoved.emit(key);
  }
}
