import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { IconChevronDown, TablerIconComponent } from '@tabler/icons-angular';
import type { AccionFila } from '../../../products/shared/filas';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { AccionFilaComponent } from '../../../../shared/ui/accion-fila/accion-fila.component';
import { CargarMasComponent, PaginaPorGrupo } from '../../../../shared/ui/cargar-mas/cargar-mas.component';
import { CatalogoFiltrosStore } from '../../shared/catalogo-filtros.store';
import { ESTADOS_TIENDA, EstadoEnTienda, FilaProducto } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';

/** Insignia y etiqueta de cada estado en la tienda (como la fila de Productos). */
const INSIGNIA: Record<EstadoEnTienda, { bg: string; fg: string; icono: string }> = {
  visible: { bg: '#dcfce7', fg: '#0b5c3f', icono: 'eye' },
  agotado: { bg: '#fff6d1', fg: '#8a5a00', icono: 'clock-pause' },
  oculto: { bg: '#e3e3e3', fg: '#4b5563', icono: 'eye-off' },
};

/**
 * Productos del catálogo en grupos plegables (por estado, categoría o sin
 * agrupar). Cada fila lleva a Productos con clic, Enter o Espacio.
 */
@Component({
  selector: 'app-tienda-catalogo-lista',
  imports: [TablerIconComponent, IcComponent, AccionFilaComponent, CargarMasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-catalogo-lista.component.html',
  host: { class: 'contents' },
})
export class TiendaCatalogoListaComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly fl = inject(CatalogoFiltrosStore);
  protected readonly i = { chevron: IconChevronDown };
  protected readonly ESTADOS = ESTADOS_TIENDA;
  protected readonly INSIGNIA = INSIGNIA;
  /** «Cargar 15 más · quedan N» por grupo. */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly idFila = (r: FilaProducto) => r.p.id;

  constructor() {
    // Otros filtros, búsqueda o agrupación: vuelve a los primeros 15.
    effect(() => {
      this.fl.filtradas();
      this.fl.grupo();
      this.pagina.reiniciar();
    });
  }

  protected accionEditar(r: FilaProducto): AccionFila {
    return { verbo: 'Editar', nota: 'en Productos', icono: 'pencil', titulo: 'Editar «' + r.p.nombre + '» en Productos', peso: 'suave' };
  }

  protected stockTxt(n: number | null): string { return n === null ? '' : n ? `${n} u.` : 'Sin stock'; }
  protected stockColor(n: number | null): string { return !n ? '#b42318' : n < 5 ? '#8a6100' : '#303030'; }
  protected stockAncho(n: number | null): string { return `${n ? Math.max(6, Math.min(100, (n / 40) * 100)) : 0}%`; }
}
