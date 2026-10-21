import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IconBrandWhatsapp, IconPlus, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { ResumenWhatsapp } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { FranjaMetricasComponent, MetricaFranja, puntosSpark } from '../../../../shared/ui/franja-metricas/franja-metricas.component';
import { ClaveSeccion, cop } from '../../shared/secciones';
import { FiltroBandeja, FiltroPlantillas, WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { MenuNumeroComponent } from '../menu-numero/menu-numero.component';
import { EstadoSeccion, TamborSeccionesComponent } from '../tambor-secciones/tambor-secciones.component';

const LECTURAS: Record<Exclude<ClaveSeccion, 'bandeja'>, string> = {
  plantillas: 'Para escribirle a un cliente pasadas 24 h de su último mensaje, o para campañas. Meta las revisa antes de que puedas usarlas.',
  automatico:
    'Goods responde solo cuando un cliente escribe: primero las palabras clave, después la IA, el aviso de fuera de horario y la bienvenida. Una respuesta por mensaje.',
  campanas:
    'Promociones para los clientes que aceptaron recibirlas. Goods no le manda más de una cada 7 días a la misma persona y quita a quien responde BAJA.',
};

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];


/**
 * Cabecera de las secciones de WhatsApp: "WhatsApp /
 * {sección}" con el tambor, insignia de no leídos, "Conectado", el número
 * (con Desconectar), la acción principal ("Nueva plantilla"…), una línea de
 * lectura y la franja de métricas, que en Bandeja y Plantillas filtran.
 */
@Component({
  selector: 'app-cabecera-whatsapp',
  imports: [TablerIconComponent, TamborSeccionesComponent, MenuNumeroComponent, FranjaMetricasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cabecera-whatsapp.component.html',
  host: {
    class: 'block',
    '(document:keydown)': 'tecla($event)',
  },
})
export class CabeceraWhatsappComponent {
  protected readonly store = inject(WhatsappModuloStore);
  private readonly whatsapp = inject(WhatsappService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);

  protected readonly i = { wa: IconBrandWhatsapp, mas: IconPlus };

  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));
  protected readonly cuenta = computed(() => this.store.conexion()?.cuenta ?? null);
  protected readonly noLeidos = computed(() => (this.store.seccion() !== 'bandeja' ? (this.store.resumen()?.bandeja.noLeidos ?? 0) : 0));

  protected readonly accion = computed(() => {
    const s = this.store.seccion();
    if (!this.puedeConfigurar()) return null;
    return s === 'plantillas' ? 'Nueva plantilla' : s === 'campanas' ? 'Nueva campaña' : null;
  });

  protected readonly lectura = computed(() => {
    const s = this.store.seccion();
    if (s !== 'bandeja') return LECTURAS[s];
    const b = this.store.resumen()?.bandeja;
    if (!b) return '';
    const sin = b.sinResponder.valor ?? 0;
    const vence = b.porVencer.valor ?? 0;
    const ia = b.atendidosIa.valor ?? 0;
    return (
      (sin ? `${sin} ${sin === 1 ? 'chat espera' : 'chats esperan'} tu respuesta` : 'Todo respondido') +
      (vence ? ` y ${vence} ${vence === 1 ? 'cierra' : 'cierran'} su ventana de 24 h pronto` : '') +
      `. La IA atiende ${ia} y te pasa los que necesitan cobro o cierre.`
    );
  });

  protected readonly metricas = computed<MetricaFranja[]>(() => {
    const r = this.store.resumen();
    if (!r) return [];
    return METRICAS[this.store.seccion()](r, this.store.filtroBandeja(), this.store.filtroPlantillas());
  });

  /** Número y estado de cada sección para la lista del tambor. */
  protected readonly estados = computed<Record<ClaveSeccion, EstadoSeccion>>(() => {
    const r = this.store.resumen();
    const sin = r?.bandeja.sinResponder.valor ?? 0;
    const rev = r?.plantillas.enRevision.valor ?? 0;
    const env = r?.campanas.enviando;
    const prox = r?.campanas.proxima;
    const fp = prox ? new Date(prox.programadaPara) : null;
    return {
      bandeja: sin ? { num: String(sin), numK: 'sin responder', numColor: '#b45309', vivo: false } : { num: '0', numK: 'al día', numColor: '#111827', vivo: false },
      plantillas: rev
        ? { num: String(rev), numK: 'en revisión', numColor: '#b45309', vivo: false }
        : { num: String(r?.plantillas.aprobadas.valor ?? 0), numK: 'aprobadas', numColor: '#111827', vivo: false },
      automatico: r?.automatico.iaActiva
        ? { num: String(r.automatico.ia.valor ?? 0), numK: 'IA hoy', numColor: '#00857e', vivo: true }
        : { num: '—', numK: 'IA apagada', numColor: '#111827', vivo: false },
      campanas: env
        ? { num: `${env.pct}%`, numK: 'enviando', numColor: '#111827', vivo: true }
        : fp
          ? { num: `${DIAS[fp.getDay()]} ${fp.getDate()}`, numK: 'próxima', numColor: '#111827', vivo: false }
          : { num: '—', numK: 'sin programar', numColor: '#111827', vivo: false },
    };
  });

  private gPendiente = 0;

  protected tecla(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (this.gPendiente && Date.now() - this.gPendiente < 900) {
      this.gPendiente = 0;
      const m: Record<string, ClaveSeccion> = { b: 'bandeja', p: 'plantillas', a: 'automatico', c: 'campanas' };
      if (m[k]) {
        e.preventDefault();
        this.store.ir(m[k]);
      }
      return;
    }
    if (k === 'g') this.gPendiente = Date.now();
  }

  protected clicMetrica(k: string): void {
    const s = this.store.seccion();
    if (s === 'bandeja' && (k === 'sin' || k === 'vence' || k === 'ia')) {
      this.store.filtroBandeja.update((f) => (f === k ? 'todos' : (k as FiltroBandeja)));
    } else if (s === 'plantillas' && (k === 'aprobada' || k === 'pendiente')) {
      this.store.filtroPlantillas.update((f) => (f === k ? 'todas' : (k as FiltroPlantillas)));
    }
  }

  protected desconectar(): void {
    this.whatsapp.desconectar().subscribe({
      next: (c) => {
        this.store.conexion.set(c);
        this.alertas.mostrar({ estado: 'success', titulo: 'Número desconectado. Los chats guardados se quedan.' });
      },
      error: (e) => this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos desconectar el número.') }),
    });
  }
}

type Fabrica = (r: ResumenWhatsapp, fb: FiltroBandeja, fp: FiltroPlantillas) => MetricaFranja[];

const met = (
  k: string,
  label: string,
  value: string,
  delta: string,
  serie: number[],
  o: { tinta?: string; sc?: string; activa?: boolean; tip?: string } = {},
): MetricaFranja => ({
  k,
  label,
  value,
  delta,
  tinta: o.tinta ?? '#111827',
  sparkColor: o.sc ?? '#303030',
  spark: puntosSpark(serie),
  activa: o.activa,
  tip: o.tip,
});

const METRICAS: Record<ClaveSeccion, Fabrica> = {
  bandeja: (r, fb) => {
    const b = r.bandeja;
    const sin = b.sinResponder.valor ?? 0;
    const vence = b.porVencer.valor ?? 0;
    const vs = b.pedidos.vsAyer;
    return [
      met('sin', 'Sin responder', String(sin), sin ? 'esperan respuesta' : 'al día', b.sinResponder.serie, {
        tinta: sin ? '#b45309' : undefined, sc: '#b45309', activa: fb === 'sin', tip: 'Clic: ver solo los que esperan respuesta',
      }),
      met('vence', 'Por vencer', String(vence), 'menos de 3 h', b.porVencer.serie, { tinta: vence ? '#b45309' : undefined, sc: '#b45309', activa: fb === 'vence' }),
      met('ia', 'Atendidos por IA', String(b.atendidosIa.valor ?? 0), b.atendidosIa.sinAyudaPct === null ? 'hoy' : `${b.atendidosIa.sinAyudaPct}% sin ayuda`, b.atendidosIa.serie, {
        sc: '#00a39b', activa: fb === 'ia',
      }),
      met('pedidos', 'Pedidos por WhatsApp', String(b.pedidos.valor ?? 0), vs > 0 ? `+${vs} vs. ayer` : vs < 0 ? `−${-vs} vs. ayer` : 'igual que ayer', b.pedidos.serie, { sc: '#087b5d' }),
      met('respuesta', 'Tiempo de respuesta', b.tiempoRespuesta.valor === null ? '—' : `${Math.round(b.tiempoRespuesta.valor)} min`, 'mediana', b.tiempoRespuesta.serie),
    ];
  },
  plantillas: (r, _fb, fp) => {
    const p = r.plantillas;
    return [
      met('aprobada', 'Aprobadas', String(p.aprobadas.valor ?? 0), 'listas para usar', p.aprobadas.serie, { sc: '#087b5d', activa: fp === 'aprobada' }),
      met('pendiente', 'En revisión', String(p.enRevision.valor ?? 0), 'Meta revisando', p.enRevision.serie, { tinta: '#b45309', sc: '#b45309', activa: fp === 'pendiente' }),
      met('envios', 'Envíos este mes', (p.enviosMes.valor ?? 0).toLocaleString('es-CO'), `+${p.enviosMes.semana} esta semana`, p.enviosMes.serie),
      met('costo', 'Costo este mes', `≈ ${cop(p.costoMes.valor ?? 0)}`, 'cobra Meta', p.costoMes.serie),
    ];
  },
  automatico: (r) => {
    const a = r.automatico;
    return [
      met('auto', 'Respuestas automáticas', String(a.respuestasHoy.valor ?? 0), 'hoy', a.respuestasHoy.serie, { sc: '#00a39b' }),
      met('ia', 'IA', `${a.ia.valor ?? 0} / ${a.ia.limite}`, 'límite diario', a.ia.serie, { sc: '#00a39b' }),
      met('pasados', 'Pasados a tu equipo', String(a.pasadosEquipo.valor ?? 0), 'pago, reclamo…', a.pasadosEquipo.serie),
      met('palabras', 'Palabras clave', String(a.palabrasClave.valor ?? 0), 'activas', a.palabrasClave.serie),
    ];
  },
  campanas: (r) => {
    const c = r.campanas;
    return [
      met('aceptan', 'Aceptan promociones', String(c.aceptan.valor ?? 0), `+${c.aceptan.nuevosMes} este mes`, c.aceptan.serie, { sc: '#087b5d' }),
      met('alcance', 'Alcance hoy', String(c.alcanceHoy.valor ?? 0), `${c.alcanceHoy.protegidos} protegidos`, c.alcanceHoy.serie, { sc: '#00a39b' }),
      met('lectura', 'Tasa de lectura', c.tasaLectura.valor === null ? '—' : `${c.tasaLectura.valor}%`,
        c.tasaLectura.campanas ? `${c.tasaLectura.campanas === 1 ? 'última' : `últimas ${c.tasaLectura.campanas}`}` : 'sin campañas', c.tasaLectura.serie),
      met('respondieron', 'Respondieron', String(c.respondieron.valor ?? 0), 'conversaciones nuevas', c.respondieron.serie),
    ];
  },
};


