import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconRefresh, IconSearch, TablerIconComponent } from '@tabler/icons-angular';
import { Plantilla } from '../../../../../../core/whatsapp/whatsapp.model';
import { cop } from '../../../../shared/secciones';
import { FiltroPlantillas } from '../../../../shared/whatsapp-modulo.store';
import { costoDe, esPromo, normalizar } from '../../plantillas.util';
import { FilaPlantillaComponent } from '../fila-plantilla/fila-plantilla.component';
import { OpcionSegmentado, SegmentadoComponent } from '../../../../../../shared/ui/segmentado/segmentado.component';

const ETIQUETAS: Record<FiltroPlantillas, string> = { todas: 'Todas', aprobada: 'Aprobadas', pendiente: 'En revisión', rechazada: 'Rechazadas' };

/**
 * Lista de plantillas: buscador, segmentado de estado con
 * contadores, sincronizar con WhatsApp y los grupos Servicio / Promoción.
 */
@Component({
  selector: 'app-lista-plantillas',
  imports: [FormsModule, TablerIconComponent, FilaPlantillaComponent, SegmentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-plantillas.component.html',
  host: {
    class: 'flex min-w-0 flex-[1_1_420px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.04),0_1px_2px_rgba(0,0,0,.04)]',
  },
})
export class ListaPlantillasComponent {
  readonly plantillas = input.required<Plantilla[]>();
  /** Id de la plantilla abierta en el panel (null con el formulario abierto). */
  readonly elegidaId = input<number | null>(null);
  readonly puedeConfigurar = input(false);
  readonly sincronizando = input(false);
  readonly filtro = model.required<FiltroPlantillas>();
  readonly q = model('');
  readonly elegir = output<Plantilla>();
  readonly sincronizar = output<void>();

  protected readonly i = { buscar: IconSearch, sincronizar: IconRefresh };

  protected readonly filtros = computed<OpcionSegmentado<FiltroPlantillas>[]>(() => {
    const l = this.plantillas();
    return (Object.keys(ETIQUETAS) as FiltroPlantillas[]).map((k) => ({
      k,
      label: ETIQUETAS[k],
      n: k === 'todas' ? l.length : l.filter((p) => p.estado === k).length,
    }));
  });

  protected readonly maxEnvios = computed(() => Math.max(1, ...this.plantillas().map((p) => p.uso?.enviados ?? 0)));

  protected readonly grupos = computed(() => {
    const q = normalizar(this.q().trim());
    const f = this.filtro();
    const vis = this.plantillas().filter((p) => (f === 'todas' || p.estado === f) && (!q || normalizar(`${p.nombre} ${p.cuerpo}`).includes(q)));
    return [
      { k: 'servicio', titulo: 'Servicio', sub: `Pedidos y atención · ≈ ${cop(costoDe('UTILITY'))} c/u`, items: vis.filter((p) => !esPromo(p)) },
      { k: 'promocion', titulo: 'Promoción', sub: `Ofertas y novedades · ≈ ${cop(costoDe('MARKETING'))} c/u`, items: vis.filter(esPromo) },
    ]
      .filter((g) => g.items.length)
      .map((g) => ({ ...g, n: `${g.items.length} plantilla${g.items.length === 1 ? '' : 's'}` }));
  });
}
