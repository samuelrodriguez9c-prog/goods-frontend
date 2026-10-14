import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { IconHandStop, IconKey, IconMoon, IconSparkles, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { Automatizaciones, HorarioSemanal } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import {
  BIENVENIDA_INICIAL,
  ClavePaso,
  FUERA_INICIAL,
  HORARIO_INICIAL,
  PASOS,
  contienePalabra,
  estaAbierto,
  normalizar,
  resumenHorario,
} from './automatico';
import { EditorAsistenteComponent } from './components/editor-asistente/editor-asistente.component';
import { EditorBienvenidaComponent } from './components/editor-bienvenida/editor-bienvenida.component';
import { EditorFueraHorarioComponent } from './components/editor-fuera-horario/editor-fuera-horario.component';
import { EditorPalabrasComponent } from './components/editor-palabras/editor-palabras.component';
import { PasoVista, PasosRespuestaComponent } from './components/pasos-respuesta/pasos-respuesta.component';
import { RespuestasRapidasComponent } from './components/respuestas-rapidas/respuestas-rapidas.component';
import { RespuestaSimulada, SimuladorRespuestaComponent } from './components/simulador-respuesta/simulador-respuesta.component';
import { IaMarcaComponent } from '../../../../shared/ui/ia-marca/ia-marca.component';

type Borrador = 'ia' | 'fuera' | 'bienvenida';

const ETIQUETA_BORRADOR: Record<Borrador, string> = {
  ia: 'lo que sabe la IA',
  fuera: 'el aviso de fuera de horario',
  bienvenida: 'la bienvenida',
};

const AL_ALTERNAR: Record<ClavePaso, [prendido: string, apagado: string]> = {
  palabras: ['Palabras clave prendidas', 'Palabras clave apagadas'],
  ia: ['Asistente de IA prendido', 'Asistente de IA apagado'],
  fuera: ['Aviso de fuera de horario prendido', 'Aviso de fuera de horario apagado'],
  bienvenida: ['Bienvenida prendida', 'Bienvenida apagada'],
};

/** Ejemplo de lo que diría la IA en el simulador (no se llama a la IA de verdad). */
const RESPUESTA_IA = '¡Hola Ana! Con gusto te ayudo. Cuéntame qué buscas y te digo precio y disponibilidad.';

/**
 * Respuestas automáticas de WhatsApp (handoff-whatsapp §6): a la izquierda
 * los pasos en orden de prioridad (palabras clave → IA → fuera de horario →
 * bienvenida) y el simulador; a la derecha se edita el paso elegido y, debajo,
 * las respuestas rápidas del equipo. Los textos y el horario se guardan con la
 * alerta fija "Cambios sin guardar" (o Ctrl + S); los interruptores, las
 * palabras clave y las respuestas rápidas guardan al momento. Solo el dueño
 * (`whatsapp.configurar`) las cambia; el resto del equipo las ve.
 */
@Component({
  selector: 'app-whatsapp-automatizaciones-page',
  imports: [IaMarcaComponent, 
    TablerIconComponent,
    PasosRespuestaComponent,
    SimuladorRespuestaComponent,
    EditorPalabrasComponent,
    EditorAsistenteComponent,
    EditorFueraHorarioComponent,
    EditorBienvenidaComponent,
    RespuestasRapidasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-automatizaciones-page.component.html',
  host: { class: 'block leading-[normal]', '(document:keydown)': 'tecla($event)' },
})
export class WhatsappAutomatizacionesPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  protected readonly store = inject(WhatsappModuloStore);

  protected readonly iconos: Record<ClavePaso, typeof IconKey> = { palabras: IconKey, ia: IconSparkles, fuera: IconMoon, bienvenida: IconHandStop };
  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly datos = signal<Automatizaciones | null>(null);

  protected readonly pasoSel = signal<ClavePaso>('ia');
  protected readonly infoPaso = computed(() => PASOS.find((p) => p.k === this.pasoSel())!);
  protected readonly alternando = signal<ClavePaso | null>(null);
  protected readonly pedirNuevaPalabra = signal(false);
  private readonly guardando = signal(false);

  // Borradores (se guardan con "Cambios sin guardar")
  protected readonly instrucciones = signal('');
  /** Cuándo la IA le pasa el chat al equipo (chips editables). */
  protected readonly motivos = signal<string[]>([]);
  protected readonly bienvenidaTexto = signal('');
  protected readonly fueraTexto = signal('');
  protected readonly zona = signal('America/Bogota');
  protected readonly horario = signal<HorarioSemanal>(HORARIO_INICIAL);

  // Simulador
  protected readonly simTexto = signal('');
  protected readonly simNuevo = signal(true);
  protected readonly simAbierto = signal(true);

  /** Lo guardado, con los textos por defecto si nunca se configuró. */
  private readonly guardado = computed(() => {
    const d = this.datos();
    if (!d) return null;
    return {
      instrucciones: d.asistente.config?.config.instrucciones ?? '',
      motivos: d.asistente.config?.config.pasarCuando ?? d.asistente.motivosPorDefecto ?? [],
      bienvenida: d.bienvenida?.config.texto ?? BIENVENIDA_INICIAL,
      fuera: d.fueraHorario?.config.texto ?? FUERA_INICIAL,
      zona: d.fueraHorario?.config.zonaHoraria ?? 'America/Bogota',
      horario: d.fueraHorario?.config.horario ?? HORARIO_INICIAL,
    };
  });

  private readonly sucias = computed<Borrador[]>(() => {
    const g = this.guardado();
    const d = this.datos();
    if (!g || !d || !this.puedeConfigurar()) return [];
    const r: Borrador[] = [];
    if (d.asistente.disponible && (this.instrucciones() !== g.instrucciones || JSON.stringify(this.motivos()) !== JSON.stringify(g.motivos))) r.push('ia');
    if (this.fueraTexto() !== g.fuera || this.zona() !== g.zona || JSON.stringify(this.horario()) !== JSON.stringify(g.horario)) r.push('fuera');
    if (this.bienvenidaTexto() !== g.bienvenida) r.push('bienvenida');
    return r;
  });

  private readonly horarioMalo = computed(() => Object.values(this.horario()).some((r) => !!r && r.hasta <= r.desde));

  protected readonly llenar = (texto: string): string =>
    texto.replace(/\{nombre\}/gi, 'Ana').replace(/\{tienda\}/gi, this.datos()?.enlaceTienda ?? 'tu tienda en línea');

  protected readonly pasos = computed<PasoVista[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const activas = d.palabrasClave.filter((p) => p.activa);
    const resumen: Record<ClavePaso, string> = {
      palabras: activas.length
        ? `${activas.length} ${activas.length === 1 ? 'activa' : 'activas'} · ${activas.map((p) => p.config.palabras[0]).join(', ')}…`
        : 'Ninguna activa',
      ia: d.asistente.disponible ? 'Catálogo + lo que le cuentes' : 'Todavía no disponible',
      fuera: resumenHorario(this.horario()),
      bienvenida: this.bienvenidaTexto(),
    };
    return PASOS.map((p, i) => {
      const on = this.encendido(p.k);
      return {
        k: p.k,
        n: i + 1,
        titulo: p.titulo,
        resumen: on ? resumen[p.k] : p.k === 'ia' && !d.asistente.disponible ? resumen.ia : 'Apagado',
        on,
        editable: this.puedeConfigurar() && (p.k !== 'ia' || d.asistente.disponible),
      };
    });
  });

  /** Quién respondería el mensaje del simulador, en el mismo orden que el backend. */
  protected readonly respuestaSim = computed<RespuestaSimulada | null>(() => {
    const d = this.datos();
    const texto = normalizar(this.simTexto());
    if (!d || !texto) return null;
    const regla = d.palabrasClave.find((p) => p.activa && p.config.palabras.some((w) => contienePalabra(texto, normalizar(w))));
    if (regla) return { paso: 'palabras', quien: 'Palabras clave', texto: this.llenar(regla.config.texto) };
    if (this.encendido('ia')) return { paso: 'ia', quien: 'Asistente de IA', texto: RESPUESTA_IA };
    if (this.encendido('fuera') && !this.simAbierto()) return { paso: 'fuera', quien: 'Fuera de horario', texto: this.llenar(this.fueraTexto()) };
    if (this.encendido('bienvenida') && this.simNuevo()) return { paso: 'bienvenida', quien: 'Bienvenida', texto: this.llenar(this.bienvenidaTexto()) };
    return { paso: 'equipo', quien: 'Sin respuesta automática', texto: 'Nadie responde solo: el mensaje queda en la bandeja para tu equipo.' };
  });

  protected readonly usoIa = computed(() => {
    const d = this.datos();
    const r = this.store.resumen();
    return {
      respuestas: r?.automatico.ia.valor ?? d?.asistente.respuestasUltimas24h ?? 0,
      limite: r?.automatico.ia.limite ?? d?.asistente.limiteDiario ?? 0,
      sinAyudaPct: r?.bandeja.atendidosIa.sinAyudaPct ?? null,
      pasados: r?.automatico.pasadosEquipo.valor ?? null,
    };
  });

  constructor() {
    this.cargar(true);
    effect(() => {
      const sucias = this.sucias();
      if (!sucias.length) return this.alertas.fijarCambios(null);
      const malo = sucias.includes('fuera') && this.horarioMalo();
      const nombres = sucias.map((k) => ETIQUETA_BORRADOR[k]);
      const lista = nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(', ') + ' y ' + nombres.at(-1);
      this.alertas.fijarCambios({
        estado: malo ? 'error' : 'warning',
        titulo: malo ? 'Horario no válido' : 'Cambios sin guardar',
        texto: malo
          ? 'Un día cierra antes de abrir. Corrige las horas para poder guardar.'
          : `Cambiaste ${lista}. Guarda para aplicarlo o descarta para volver a como estaba. Atajo: Ctrl + S.`,
        guardar: () => this.guardarCambios(),
        descartar: () => this.descartar(),
      });
    });
    inject(DestroyRef).onDestroy(() => this.alertas.soltarCambios());
  }

  protected encendido(k: ClavePaso): boolean {
    const d = this.datos();
    if (!d) return false;
    if (k === 'palabras') return d.palabrasClave.some((p) => p.activa);
    if (k === 'ia') return d.asistente.disponible && !!d.asistente.config?.activa;
    if (k === 'fuera') return !!d.fueraHorario?.activa;
    return !!d.bienvenida?.activa;
  }

  protected tecla(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && this.sucias().length) {
      e.preventDefault();
      this.guardarCambios();
    }
  }

  /** Interruptor de un paso: guarda al momento con lo que ya estaba guardado. */
  protected alternar(k: ClavePaso): void {
    const d = this.datos();
    const g = this.guardado();
    if (!d || !g || !this.puedeConfigurar() || this.alternando()) return;
    const on = this.encendido(k);
    let peticion: Observable<unknown>;
    if (k === 'palabras') {
      if (!d.palabrasClave.length) {
        this.pasoSel.set('palabras');
        this.pedirNuevaPalabra.set(true);
        return;
      }
      const cambiar = d.palabrasClave.filter((p) => p.activa === on);
      peticion = cambiar.length ? forkJoin(cambiar.map((p) => this.whatsapp.guardarPalabraClave({ ...p.config, activa: !on }, p.id))) : of(null);
    } else if (k === 'ia') {
      if (!d.asistente.disponible) return;
      peticion = this.whatsapp.guardarAsistente({ activa: !on, instrucciones: g.instrucciones });
    } else if (k === 'fuera') {
      peticion = this.whatsapp.guardarFueraHorario({ activa: !on, texto: g.fuera, zonaHoraria: g.zona, horario: g.horario });
    } else {
      peticion = this.whatsapp.guardarBienvenida({ activa: !on, texto: g.bienvenida });
    }
    this.alternando.set(k);
    peticion.subscribe({
      next: () => {
        this.alternando.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: AL_ALTERNAR[k][on ? 1 : 0] });
        this.recargar();
      },
      error: (e) => {
        this.alternando.set(null);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos guardar el cambio.') });
      },
    });
  }

  protected guardarCambios(): void {
    const sucias = this.sucias();
    if (!sucias.length || this.guardando()) return;
    if (sucias.includes('fuera') && this.horarioMalo()) {
      this.pasoSel.set('fuera');
      this.alertas.sacudir();
      return;
    }
    const peticiones = sucias.map((k): Observable<unknown> => {
      if (k === 'ia') return this.whatsapp.guardarAsistente({ activa: this.encendido('ia'), instrucciones: this.instrucciones().trim(), pasarCuando: this.motivos() });
      if (k === 'fuera')
        return this.whatsapp.guardarFueraHorario({
          activa: this.encendido('fuera'),
          texto: this.fueraTexto().trim(),
          zonaHoraria: this.zona(),
          horario: this.horario(),
        });
      return this.whatsapp.guardarBienvenida({ activa: this.encendido('bienvenida'), texto: this.bienvenidaTexto().trim() });
    });
    this.guardando.set(true);
    forkJoin(peticiones).subscribe({
      next: () => {
        this.guardando.set(false);
        this.alertas.mostrar({ estado: 'success', titulo: 'Cambios guardados' });
        this.cargar(true);
        this.store.cargarResumen();
      },
      error: (e) => {
        this.guardando.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos guardar los cambios.') });
      },
    });
  }

  protected descartar(): void {
    const g = this.guardado();
    if (!g) return;
    this.instrucciones.set(g.instrucciones);
    this.motivos.set(g.motivos);
    this.bienvenidaTexto.set(g.bienvenida);
    this.fueraTexto.set(g.fuera);
    this.zona.set(g.zona);
    this.horario.set(g.horario);
  }

  /** Después de un cambio que ya se guardó: datos nuevos (sin pisar borradores) y números de la cabecera. */
  protected recargar(): void {
    this.cargar(false);
    this.store.cargarResumen();
  }

  protected cargar(conBorradores: boolean): void {
    this.whatsapp.automatizaciones().subscribe({
      next: (d) => {
        const primera = !this.datos();
        this.datos.set(d);
        this.error.set(null);
        this.cargando.set(false);
        if (conBorradores) this.descartar();
        if (primera) this.simAbierto.set(estaAbierto(this.horario(), this.zona()));
      },
      error: (e) => {
        this.error.set(mensajeDeError(e, 'No pudimos cargar las respuestas automáticas.'));
        this.cargando.set(false);
      },
    });
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.cargar(true);
  }
}
