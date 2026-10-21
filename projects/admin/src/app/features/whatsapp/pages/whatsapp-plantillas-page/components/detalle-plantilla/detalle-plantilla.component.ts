import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconClock,
  IconCopy,
  IconMessage2,
  IconMessages,
  IconPencil,
  IconSend,
  IconSparkles,
  IconSpeakerphone,
  IconTrash,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Campana, Plantilla, TipoVariable, piePromociones, variablesDe } from '../../../../../../core/whatsapp/whatsapp.model';
import { cop } from '../../../../shared/secciones';
import { OPCIONES_VARIABLE, VARIABLES, tipoVariable } from '../../../../shared/variables';
import { ESTADO_PLANTILLA, costoDe, esPromo, marcaVariable, motivoRechazo, partes, pctLeida } from '../../plantillas.util';
import { VistaPreviaWhatsappComponent } from '../vista-previa-whatsapp/vista-previa-whatsapp.component';

type Icono = typeof IconSend;

/**
 * Panel de la plantilla elegida: cabecera con estado, motivo de
 * rechazo, franja de datos (envíos, lectura, costo), vista previa, de dónde
 * sale cada dato, dónde se usa y la acción principal según el estado.
 * El host lleva `.animar-panel`: cada bloque entra en cascada.
 */
@Component({
  selector: 'app-detalle-plantilla',
  imports: [TablerIconComponent, VistaPreviaWhatsappComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detalle-plantilla.component.html',
  host: { class: 'animar-panel flex flex-col' },
})
export class DetallePlantillaComponent {
  private readonly router = inject(Router);

  readonly plantilla = input.required<Plantilla>();
  /** Para contar cuántas campañas usan la plantilla. */
  readonly campanas = input<Campana[]>([]);
  readonly puedeConfigurar = input(false);
  readonly borrando = input(false);
  readonly corregir = output<Plantilla>();
  readonly duplicar = output<Plantilla>();
  readonly borrar = output<Plantilla>();
  /** Cambiaron de dónde sale una variable (`tipos` completo, en orden). */
  readonly cambiarTipos = output<{ plantilla: Plantilla; tipos: TipoVariable[] }>();

  protected readonly OPCIONES = OPCIONES_VARIABLE;

  protected readonly i = { alerta: IconAlertCircle, ir: IconArrowUpRight, copiar: IconCopy, borrar: IconTrash };
  protected readonly confirmandoBorrar = signal(false);

  protected readonly vista = computed(() => {
    const p = this.plantilla();
    const promo = esPromo(p);
    const costo = `≈ ${cop(costoDe(p.categoria))}`;
    const nCa = this.campanas().filter((c) => c.plantilla === p.nombre && c.estado !== 'cancelada').length;
    const n = variablesDe(p.cuerpo);
    const usos: { icono: Icono; t: string; sub: string; ruta: string }[] =
      p.estado !== 'aprobada'
        ? []
        : promo
          ? [
              { icono: IconSpeakerphone, t: 'Campañas', sub: nCa ? `${nCa} campaña${nCa > 1 ? 's' : ''} la usan` : 'Aún sin campañas', ruta: '/whatsapp/campanas' },
              { icono: IconMessages, t: 'Bandeja', sub: 'Solo a quien acepta promociones', ruta: '/whatsapp' },
            ]
          : [
              { icono: IconMessages, t: 'Bandeja', sub: 'Aparece al escribir con la ventana de 24 h cerrada', ruta: '/whatsapp' },
              { icono: IconSparkles, t: 'Automático', sub: 'Puede enviarse cuando cambia el estado del pedido', ruta: '/whatsapp/automatizaciones' },
            ];
    const accion: { icono: Icono; t: string; activa: boolean; ir: () => void } =
      p.estado === 'rechazada'
        ? { icono: IconPencil, t: 'Corregir y reenviar', activa: this.puedeConfigurar(), ir: () => this.corregir.emit(p) }
        : p.estado === 'pendiente'
          ? { icono: IconClock, t: 'Esperando a Meta', activa: false, ir: () => undefined }
          : p.estado !== 'aprobada'
            ? { icono: IconClock, t: ESTADO_PLANTILLA[p.estado].texto, activa: false, ir: () => undefined }
            : promo
              ? {
                  icono: IconSpeakerphone,
                  t: 'Usar en campaña',
                  activa: true,
                  ir: () => void this.router.navigate(['/whatsapp/campanas'], { queryParams: this.puedeConfigurar() ? { nueva: 1, plantilla: p.id } : {} }),
                }
              : { icono: IconSend, t: 'Enviar a un cliente', activa: true, ir: () => void this.router.navigate(['/whatsapp']) };
    return {
      icono: promo ? IconSpeakerphone : IconMessage2,
      sub: `${promo ? 'Promoción' : p.categoria === 'AUTHENTICATION' ? 'Código de acceso' : 'Servicio'} · ${costo} por envío`,
      estado: ESTADO_PLANTILLA[p.estado],
      rechazo: p.estado === 'rechazada' ? motivoRechazo(p.motivoRechazo) : '',
      stats: [
        { k: 'Enviada', v: p.uso?.enviados ? `${p.uso.enviados.toLocaleString('es-CO')} ${p.uso.enviados === 1 ? 'vez' : 'veces'}` : '—' },
        { k: 'Leída', v: pctLeida(p) ?? '—' },
        { k: 'Costo', v: costo },
      ],
      partes: partes(p.cuerpo, p.ejemplos),
      pie: promo ? piePromociones(p.idioma) : '',
      // De dónde sale cada una (`tiposVariables`, sugerido al crearla y editable acá).
      variables: Array.from({ length: n }, (_, k) => {
        const tipo = tipoVariable(p.tiposVariables, k);
        const info = VARIABLES[tipo];
        return {
          k: marcaVariable(k + 1),
          n: k,
          tipo,
          label: tipo === 'texto' && p.ejemplos[k] ? `Ej.: ${p.ejemplos[k]}` : info.label,
          fuente: tipo === 'texto' && promo ? 'La escribes en la campaña' : info.fuente,
          icono: info.icono,
          auto: info.auto,
        };
      }),
      usos,
      accion,
    };
  });

  protected elegirTipo(k: number, tipo: TipoVariable): void {
    const p = this.plantilla();
    const tipos = Array.from({ length: variablesDe(p.cuerpo) }, (_, i) => (i === k ? tipo : tipoVariable(p.tiposVariables, i)));
    this.cambiarTipos.emit({ plantilla: p, tipos });
  }

  protected irA(ruta: string): void {
    void this.router.navigateByUrl(ruta);
  }

  /** El primer toque pide confirmación; el segundo borra. */
  protected tocarBorrar(): void {
    if (!this.confirmandoBorrar()) return this.confirmandoBorrar.set(true);
    this.borrar.emit(this.plantilla());
  }
}
