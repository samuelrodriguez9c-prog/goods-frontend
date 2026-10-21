import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Campana } from '../../../../../../core/whatsapp/whatsapp.model';
import { OpcionSegmentado, SegmentadoComponent } from '../../../../../../shared/ui/segmentado/segmentado.component';
import { esProxima } from '../../campanas.util';
import { FilaCampanaComponent } from '../fila-campana/fila-campana.component';

type Filtro = 'todas' | 'proximas' | 'enviadas';

const fechaDe = (c: Campana) => new Date(c.enviadaEn ?? c.programadaPara).getTime();

/**
 * Historial de campañas: resumen (próximas · enviadas en 30 días
 * · % que las leen), segmentado Todas / Próximas / Enviadas y los grupos
 * "Próximas" (la que sale antes, primero) y "Enviadas" (la más reciente,
 * primero).
 */
@Component({
  selector: 'app-historial-campanas',
  imports: [SegmentadoComponent, FilaCampanaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historial-campanas.component.html',
  host: { class: 'flex flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.04),0_1px_2px_rgba(0,0,0,.04)]' },
})
export class HistorialCampanasComponent {
  readonly campanas = input.required<Campana[]>();
  readonly alcance = input(0);
  readonly puedeConfigurar = input(false);
  readonly editandoId = input<number | null>(null);
  readonly cancelandoId = input<number | null>(null);
  readonly editar = output<Campana>();
  readonly cancelar = output<Campana>();

  protected readonly filtro = signal<Filtro>('todas');

  protected readonly resumen = computed(() => {
    const l = this.campanas();
    const hace30 = Date.now() - 30 * 864e5;
    const env = l.filter((c) => c.estado === 'enviada' && fechaDe(c) >= hace30);
    const dest = env.reduce((a, c) => a + c.resumen.enviados, 0);
    const lei = env.reduce((a, c) => a + c.resumen.leidos, 0);
    return [
      { v: String(l.filter(esProxima).length), k: 'próximas', c: '#3b82f6' },
      { v: String(env.length), k: 'enviadas en 30 días', c: '#c4c4c4' },
      { v: dest ? `${Math.round((lei / dest) * 100)}%` : '—', k: 'las leen', c: '#00a39b' },
    ];
  });

  protected readonly filtros = computed<OpcionSegmentado<Filtro>[]>(() => {
    const l = this.campanas();
    const n = l.filter(esProxima).length;
    return [
      { k: 'todas', label: 'Todas', n: l.length },
      { k: 'proximas', label: 'Próximas', n },
      { k: 'enviadas', label: 'Enviadas', n: l.length - n },
    ];
  });

  protected readonly grupos = computed(() => {
    const f = this.filtro();
    const l = this.campanas();
    return [
      {
        k: 'prox',
        titulo: 'Próximas',
        sub: 'Programadas o saliendo ahora',
        items: f === 'enviadas' ? [] : l.filter(esProxima).sort((a, b) => Number(b.estado === 'enviando') - Number(a.estado === 'enviando') || fechaDe(a) - fechaDe(b)),
      },
      {
        k: 'env',
        titulo: 'Enviadas',
        sub: 'Las más recientes primero',
        items: f === 'proximas' ? [] : l.filter((c) => !esProxima(c)).sort((a, b) => fechaDe(b) - fechaDe(a)),
      },
    ].filter((g) => g.items.length);
  });
}
