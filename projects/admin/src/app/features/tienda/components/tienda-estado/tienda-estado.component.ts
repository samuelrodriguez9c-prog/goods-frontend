import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  IconBrandWhatsapp, IconCheck, IconCircleDashed, IconCopy, IconListCheck, IconPlayerPause, IconRocket, IconWorld, TablerIconComponent,
} from '@tabler/icons-angular';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';

/**
 * Columna derecha, arriba: estado de la tienda (abierta / pausada / falta
 * poco), el interruptor Publicada–Pausada, los requisitos para publicar y
 * «Compartir» (enlace y las pestañas Chat / Estado de la vista previa).
 */
@Component({
  selector: 'app-tienda-estado',
  imports: [TablerIconComponent, TiendaEtiquetaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-estado.component.html',
  host: { class: 'contents' },
})
export class TiendaEstadoComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly i = { check: IconCheck, copiar: IconCopy, estado: IconCircleDashed, mundo: IconWorld, wa: IconBrandWhatsapp };

  protected readonly hero = computed(() => {
    const s = this.s;
    if (s.activa()) return { titulo: 'Abierta al público', texto: `Cualquiera con el enlace ve ${s.visibles().length} productos y te puede pedir.`, bg: '#eafbef', fg: '#0c7a43', icono: IconWorld };
    if (s.publicable()) return { titulo: s.teniaNumero() ? 'Tienda pausada' : 'Lista para publicar', texto: 'Nadie la ve por ahora. Publícala cuando quieras.', bg: '#f1f1f1', fg: '#6b7280', icono: s.teniaNumero() ? IconPlayerPause : IconRocket };
    return { titulo: 'Falta poco', texto: 'Completa lo pendiente para publicarla.', bg: '#fff4d6', fg: '#8a6100', icono: IconListCheck };
  });
  protected readonly requisitos = computed(() => {
    const s = this.s, n = s.visibles().length;
    return [
      { label: 'Dirección disponible', ok: s.dirOk(), sec: 'direccion' as const, nota: s.dirOk() ? '' : 'Revisar' },
      { label: 'WhatsApp para pedidos', ok: s.waLleno(), sec: 'whatsapp' as const, nota: s.waLleno() ? '' : 'Falta' },
      { label: 'Productos activos', ok: n > 0, sec: 'catalogo' as const, nota: `${n} visibles` },
    ];
  });
}
