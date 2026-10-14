import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Campana } from '../../../../../../core/whatsapp/whatsapp.model';
import { ESTADO_CAMPANA, calendario, clientesDe, costoCampana, fechaCorta } from '../../campanas.util';

/**
 * Una campaña del historial (LEEME §7): punto + nombre + estado, plantilla y
 * costo; la fecha a la derecha. Enviando / enviada: embudo enviados →
 * entregados → leídos → respondieron. Programada: tarjeta-calendario con
 * "Editar" y "Cancelar" (el primer toque pide confirmación).
 */
@Component({
  selector: 'app-fila-campana',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fila-campana.component.html',
  host: {
    class: 'fila-campana flex flex-col gap-3 rounded-xl p-3',
    '[class.fila-plantilla--elegida]': 'editando()',
    '[style.animation-delay.ms]': 'indice() * 40',
  },
})
export class FilaCampanaComponent {
  readonly campana = input.required<Campana>();
  readonly indice = input(0);
  /** Alcance de hoy: los clientes estimados de una programada. */
  readonly alcance = input(0);
  readonly puedeConfigurar = input(false);
  /** Está abierta en el panel de edición. */
  readonly editando = input(false);
  readonly cancelando = input(false);
  readonly editar = output<void>();
  readonly cancelar = output<void>();

  protected readonly confirmando = signal(false);

  protected readonly estado = computed(() => ESTADO_CAMPANA[this.campana().estado]);
  protected readonly costo = computed(() => costoCampana(this.campana(), this.alcance()));
  protected readonly clientes = computed(() => clientesDe(this.campana(), this.alcance()));
  protected readonly fecha = computed(() => {
    const c = this.campana();
    if (c.estado === 'programada') return '';
    if (c.estado === 'enviando') return 'ahora';
    return fechaCorta(c.enviadaEn ?? c.programadaPara);
  });
  protected readonly cal = computed(() => calendario(this.campana().programadaPara));
  /** Con datos de envío: enviando, enviada, o cancelada/fallida a mitad de camino. */
  protected readonly conDatos = computed(() => {
    const c = this.campana();
    return c.estado === 'enviando' || c.estado === 'enviada' || c.resumen.enviados > 0;
  });

  /** Embudo: enviados → entregados → leídos → respondieron. */
  protected readonly embudo = computed(() => {
    const r = this.campana().resumen;
    const base = r.enviados || r.destinatarios;
    const pct = (v: number) => (base ? Math.round((v / base) * 100) : 0);
    return [
      { k: 'enviados', v: r.enviados, c: '#c4c4c4', pct: '' },
      { k: 'entregados', v: r.entregados, c: '#7fded8', pct: `${pct(r.entregados)}%` },
      { k: 'leídos', v: r.leidos, c: '#00a39b', pct: `${pct(r.leidos)}%` },
      { k: 'respondieron', v: r.respondieron ?? 0, c: '#303030', pct: `${pct(r.respondieron ?? 0)}%` },
    ].map((m) => ({ ...m, w: base ? `${Math.min(100, (m.v / base) * 100).toFixed(1)}%` : '0%' }));
  });

  /** El primer toque pide confirmación; el segundo cancela. */
  protected tocarCancelar(): void {
    if (!this.confirmando()) return this.confirmando.set(true);
    this.cancelar.emit();
  }
}
