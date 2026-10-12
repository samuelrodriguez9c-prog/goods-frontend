import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBrandWhatsapp,
  IconCheck,
  IconChecks,
  IconClock,
  IconDeviceMobile,
  IconFile,
  IconLock,
  IconMapPin,
  IconMicrophone,
  IconPhoto,
  IconPlugConnected,
  IconRobot,
  IconSparkles,
  IconSpeakerphone,
  IconTemplate,
  IconSearch,
  IconSend,
  IconVideo,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { debounceTime, Subject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { formatoWhatsapp } from '../../../../core/whatsapp/formato-whatsapp';
import { abrirRegistroIntegrado } from '../../../../core/whatsapp/registro-integrado';
import { RouterLink } from '@angular/router';
import {
  Conversacion,
  EstadoConexion,
  Mensaje,
  Plantilla,
  RespuestaRapida,
  armarPlantilla,
  identificacion,
  piePromociones,
  variablesDe,
} from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * WhatsApp (Fase 1 de PROPUESTA_WHATSAPP.md): conectar el número del
 * negocio y la bandeja de chats. Sin número conectado muestra cómo
 * conectarlo; con número, la lista de chats a la izquierda y el chat
 * abierto a la derecha. Se actualiza en vivo (`whatsapp:cambio`).
 */
@Component({
  selector: 'app-whatsapp-page',
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-page.component.html',
})
export class WhatsappPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  protected readonly i = {
    wa: IconBrandWhatsapp,
    buscar: IconSearch,
    enviar: IconSend,
    volver: IconArrowLeft,
    reloj: IconClock,
    check: IconCheck,
    checks: IconChecks,
    error: IconAlertCircle,
    celular: IconDeviceMobile,
    candado: IconLock,
    conectar: IconPlugConnected,
    foto: IconPhoto,
    video: IconVideo,
    audio: IconMicrophone,
    archivo: IconFile,
    mapa: IconMapPin,
    bot: IconRobot,
    plantilla: IconTemplate,
    ia: IconSparkles,
    campana: IconSpeakerphone,
  };
  protected readonly identificacion = identificacion;
  /** *negrita*, _cursiva_, ~tachado~ como en WhatsApp. */
  protected readonly formato = formatoWhatsapp;

  private readonly permisos = computed(() => this.auth.currentUser()?.permisos ?? []);
  protected readonly puedeConfigurar = computed(() => this.permisos().includes('whatsapp.configurar'));
  protected readonly puedeResponder = computed(() => this.permisos().includes('whatsapp.responder'));

  // Conexión
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly conexion = signal<EstadoConexion | null>(null);
  protected readonly conectando = signal(false);
  protected readonly errorConexion = signal<string | null>(null);
  protected readonly modoPrueba = signal(false);
  protected readonly manual = { token: signal(''), phoneNumberId: signal(''), wabaId: signal('') };
  protected readonly confirmandoDesconexion = signal(false);

  // Bandeja
  protected readonly chats = signal<Conversacion[]>([]);
  protected readonly conNoLeidos = signal(0);
  protected readonly buscar = signal('');
  protected readonly soloNoLeidos = signal(false);
  protected readonly abiertoId = signal<number | null>(null);
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly hayMas = signal(false);
  protected readonly cargandoMensajes = signal(false);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);

  protected readonly abierto = computed(() => this.chats().find((c) => c.id === this.abiertoId()) ?? null);
  protected readonly cuentaActiva = computed(() => this.conexion()?.cuenta?.estado === 'conectada');
  protected readonly motivoSinResponder = computed(() => {
    const c = this.abierto();
    if (!c) return null;
    if (!this.puedeResponder()) return 'Tu usuario puede ver los chats pero no responderlos.';
    if (!this.cuentaActiva()) return 'Reconecta tu número para responder desde Goods.';
    return null;
  });
  /** Pasaron 24 h desde el último mensaje del cliente: solo se le puede escribir con una plantilla aprobada. */
  protected readonly ventanaCerrada = computed(() => {
    const c = this.abierto();
    return !!c && !c.ventanaAbierta;
  });

  // Plantillas (Fase 3): para escribirle a un cliente con la ventana cerrada.
  protected readonly aprobadas = signal<Plantilla[] | null>(null);
  protected readonly elegida = signal<Plantilla | null>(null);
  protected readonly variables = signal<string[]>([]);
  protected readonly indicesVariables = computed(() => Array.from({ length: variablesDe(this.elegida()?.cuerpo ?? '') }, (_, k) => k));
  protected readonly vistaPlantilla = computed(() => {
    const p = this.elegida();
    if (!p) return '';
    const cuerpo = armarPlantilla(p.cuerpo, this.variables());
    return p.categoria === 'MARKETING' ? `${cuerpo}\n\n${piePromociones(p.idioma)}` : cuerpo;
  });
  protected readonly plantillaLista = computed(
    () => !!this.elegida() && this.indicesVariables().every((k) => !!this.variables()[k]?.trim()),
  );

  /** El asistente de IA está prendido para el negocio (para mostrar su estado en cada chat). */
  protected readonly asistenteActivo = signal(false);
  protected readonly asistenteEnPausa = computed(() => {
    const c = this.abierto();
    return !!c?.asistentePausadoHasta && new Date(c.asistentePausadoHasta).getTime() > Date.now();
  });
  /** Las de promoción solo se le pueden mandar a quien aceptó recibirlas. */
  protected readonly promocionBloqueada = computed(
    () => this.elegida()?.categoria === 'MARKETING' && !this.abierto()?.contacto.aceptaPromociones,
  );

  // Respuestas rápidas (Fase 3): "/atajo" en el cuadro de texto.
  private readonly rapidas = signal<RespuestaRapida[]>([]);
  protected readonly sugerenciaActiva = signal(0);
  private readonly cerradoSugerencias = signal(false);
  protected readonly sugerencias = computed(() => {
    if (this.cerradoSugerencias()) return [];
    const m = /(?:^|\s)\/([a-z0-9_-]*)$/i.exec(this.texto());
    if (!m) return [];
    const q = m[1].toLowerCase();
    return this.rapidas()
      .filter((r) => r.atajo.startsWith(q))
      .slice(0, 6);
  });

  /** Adjuntos ya traídos de Meta, por id de mensaje (URL local del archivo). */
  protected readonly adjuntos = signal<Record<number, { url?: string; error?: string }>>({});

  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly cuadro = viewChild<ElementRef<HTMLTextAreaElement>>('cuadro');
  private readonly busqueda$ = new Subject<void>();

  constructor() {
    this.cargarConexion();
    // Las fotos se traen solas al aparecer; audio, video y documentos, al tocarlos.
    effect(() => {
      for (const m of this.mensajes()) {
        if (m.media?.descargable && (m.tipo === 'image' || m.tipo === 'sticker')) untracked(() => this.cargarAdjunto(m));
      }
    });
    // Con la ventana cerrada se ofrece mandar una plantilla: se traen las aprobadas (una vez).
    effect(() => {
      if (this.ventanaCerrada() && this.puedeResponder()) untracked(() => this.cargarAprobadas());
    });
    inject(DestroyRef).onDestroy(() => {
      for (const a of Object.values(this.adjuntos())) if (a.url) URL.revokeObjectURL(a.url);
    });
    this.busqueda$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.cargarChats());
    this.realtime
      .escuchar<{ conversacionId: number }>('whatsapp:cambio')
      .pipe(debounceTime(150), takeUntilDestroyed())
      .subscribe(({ conversacionId }) => {
        this.cargarChats();
        if (conversacionId === this.abiertoId()) this.cargarMensajes(conversacionId, true);
      });
  }

  // ── Conexión ────────────────────────────────────────────────────────

  private cargarConexion(): void {
    this.whatsapp.conexion().subscribe({
      next: (c) => {
        this.conexion.set(c);
        this.cargando.set(false);
        this.cargarChats();
        if (c.cuenta) this.cargarRapidas();
      },
      error: (e) => {
        this.errorCarga.set(mensajeDeError(e, 'No pudimos cargar WhatsApp.'));
        this.cargando.set(false);
      },
    });
  }

  protected async conectarConMeta(): Promise<void> {
    const ri = this.conexion()?.registroIntegrado;
    if (!ri || this.conectando()) return;
    this.conectando.set(true);
    this.errorConexion.set(null);
    try {
      const r = await abrirRegistroIntegrado(ri);
      this.whatsapp.conectar(r).subscribe({
        next: (c) => this.conectado(c),
        error: (e) => this.falloConexion(mensajeDeError(e)),
      });
    } catch (e) {
      this.falloConexion(e instanceof Error ? e.message : 'No se pudo conectar.');
    }
  }

  protected conectarManual(): void {
    if (this.conectando()) return;
    this.conectando.set(true);
    this.errorConexion.set(null);
    this.whatsapp
      .conectarManual({
        token: this.manual.token().trim(),
        phoneNumberId: this.manual.phoneNumberId().trim(),
        wabaId: this.manual.wabaId().trim() || undefined,
      })
      .subscribe({ next: (c) => this.conectado(c), error: (e) => this.falloConexion(mensajeDeError(e)) });
  }

  protected desconectar(): void {
    this.whatsapp.desconectar().subscribe({
      next: (c) => {
        this.conexion.set(c);
        this.confirmandoDesconexion.set(false);
      },
      error: (e) => this.errorConexion.set(mensajeDeError(e)),
    });
  }

  private conectado(c: EstadoConexion): void {
    this.conexion.set(c);
    this.conectando.set(false);
    this.manual.token.set('');
    this.cargarChats();
  }

  private falloConexion(mensaje: string): void {
    this.conectando.set(false);
    this.errorConexion.set(mensaje);
  }

  // ── Bandeja ─────────────────────────────────────────────────────────

  protected cambiarBusqueda(valor: string): void {
    this.buscar.set(valor);
    this.busqueda$.next();
  }

  protected filtrarNoLeidos(valor: boolean): void {
    this.soloNoLeidos.set(valor);
    this.cargarChats();
  }

  private cargarChats(): void {
    this.whatsapp.conversaciones({ buscar: this.buscar().trim() || undefined, noLeidas: this.soloNoLeidos() }).subscribe({
      next: (r) => {
        this.chats.set(r.data);
        this.conNoLeidos.set(r.conNoLeidos);
      },
    });
  }

  protected abrir(c: Conversacion): void {
    this.abiertoId.set(c.id);
    this.mensajes.set([]);
    this.texto.set('');
    this.errorEnvio.set(null);
    this.elegida.set(null);
    this.variables.set([]);
    this.confirmandoPromociones.set(false);
    this.cargarMensajes(c.id);
  }

  protected cerrar(): void {
    this.abiertoId.set(null);
  }

  private cargarMensajes(id: number, enVivo = false): void {
    if (!enVivo) this.cargandoMensajes.set(true);
    this.whatsapp.mensajes(id).subscribe({
      next: (r) => {
        if (this.abiertoId() !== id) return;
        const estabaAbajo = this.estaAbajo();
        this.mensajes.set(r.data);
        if (!enVivo) this.hayMas.set(r.hayMas);
        this.cargandoMensajes.set(false);
        if (!enVivo || estabaAbajo) this.bajar();
        const chat = this.chats().find((c) => c.id === id);
        if (chat?.noLeidos) {
          this.whatsapp.marcarLeida(id).subscribe();
          this.chats.update((l) => l.map((c) => (c.id === id ? { ...c, noLeidos: 0 } : c)));
          this.conNoLeidos.update((n) => Math.max(0, n - 1));
        }
      },
      error: () => this.cargandoMensajes.set(false),
    });
  }

  protected verAnteriores(): void {
    const id = this.abiertoId();
    const primero = this.mensajes()[0];
    if (!id || !primero) return;
    const el = this.scroll()?.nativeElement;
    const alto = el?.scrollHeight ?? 0;
    this.whatsapp.mensajes(id, primero.id).subscribe((r) => {
      this.mensajes.update((m) => [...r.data, ...m]);
      this.hayMas.set(r.hayMas);
      // Mantener la vista donde estaba.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - alto;
      });
    });
  }

  protected cargarAdjunto(m: Mensaje, alTerminar?: (url: string) => void): void {
    const previo = this.adjuntos()[m.id];
    if (previo?.url) {
      alTerminar?.(previo.url);
      return;
    }
    if (previo && !previo.error) return; // ya se está trayendo
    this.adjuntos.update((a) => ({ ...a, [m.id]: {} }));
    this.whatsapp.adjunto(m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.adjuntos.update((a) => ({ ...a, [m.id]: { url } }));
        alTerminar?.(url);
      },
      error: async (e) => {
        // El error llega como blob: hay que leerlo para mostrar el mensaje.
        let texto = 'No se pudo cargar el archivo.';
        try {
          const cuerpo = JSON.parse(await (e.error as Blob).text());
          if (cuerpo?.message) texto = cuerpo.message;
        } catch {
          /* se queda el texto genérico */
        }
        this.adjuntos.update((a) => ({ ...a, [m.id]: { error: texto } }));
      },
    });
  }

  protected descargar(m: Mensaje): void {
    this.cargarAdjunto(m, (url) => {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = m.media?.nombre ?? 'documento';
      enlace.click();
    });
  }

  protected reintentar(m: Mensaje): void {
    this.errorEnvio.set(null);
    this.whatsapp.reintentar(m.id).subscribe({
      next: (nuevo) => this.mensajes.update((l) => l.map((x) => (x.id === nuevo.id ? nuevo : x))),
      error: (e) => this.errorEnvio.set(mensajeDeError(e)),
    });
  }

  protected teclear(e: KeyboardEvent): void {
    const sug = this.sugerencias();
    if (sug.length && !e.isComposing) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = this.sugerenciaActiva() + (e.key === 'ArrowDown' ? 1 : -1);
        this.sugerenciaActiva.set((n + sug.length) % sug.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.usarRapida(sug[Math.min(this.sugerenciaActiva(), sug.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cerradoSugerencias.set(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected cambiarTexto(valor: string): void {
    this.texto.set(valor);
    this.cerradoSugerencias.set(false);
    this.sugerenciaActiva.set(0);
  }

  /** Reemplaza el "/atajo" que se está escribiendo por el texto guardado ({nombre} = nombre del cliente). */
  protected usarRapida(r: RespuestaRapida): void {
    const c = this.abierto();
    const nombre = c?.contacto.nombre?.trim().split(/\s+/)[0] ?? '';
    const texto = r.texto.replace(/\{nombre\}/gi, nombre).replace(/ ,/g, ',');
    this.texto.update((t) => t.replace(/\/[a-z0-9_-]*$/i, texto));
    this.sugerenciaActiva.set(0);
    requestAnimationFrame(() => {
      const el = this.cuadro()?.nativeElement;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  private cargarRapidas(): void {
    this.whatsapp.automatizaciones().subscribe({
      next: (a) => {
        this.rapidas.set(a.respuestasRapidas);
        this.asistenteActivo.set(!!a.asistente.config?.activa && a.asistente.disponible);
      },
      error: () => undefined,
    });
  }

  /** Pausar o devolverle el chat al asistente de IA. */
  protected alternarAsistente(c: Conversacion): void {
    const pausar = !this.asistenteEnPausa();
    this.whatsapp.pausarAsistente(c.id, pausar).subscribe({
      next: (r) => this.parcheChat(c.id, { asistentePausadoHasta: r.asistentePausadoHasta }),
      error: (e) => this.errorEnvio.set(mensajeDeError(e)),
    });
  }

  protected readonly confirmandoPromociones = signal(false);

  /** El cliente le dijo al negocio que sí (o que ya no) quiere promociones. */
  protected cambiarPromociones(c: Conversacion, acepta: boolean): void {
    this.whatsapp.marcarPromociones(c.id, acepta).subscribe({
      next: () => {
        this.confirmandoPromociones.set(false);
        this.parcheChat(c.id, { contacto: { ...c.contacto, aceptaPromociones: acepta } });
      },
      error: (e) => this.errorEnvio.set(mensajeDeError(e)),
    });
  }

  private parcheChat(id: number, cambio: Partial<Conversacion>): void {
    this.chats.update((l) => l.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  }

  /** Quién o qué escribió un mensaje automático o masivo, para la etiqueta de la burbuja. */
  protected etiquetaOrigen(m: Mensaje): { texto: string; icono: typeof IconRobot } | null {
    switch (m.origen) {
      case 'asistente_ia':
        return { texto: 'Asistente de IA', icono: this.i.ia };
      case 'campana':
        return { texto: `Campaña${m.plantilla ? ' · ' + m.plantilla.nombre : ''}`, icono: this.i.campana };
      case 'promociones':
        return { texto: 'Alta / baja de promociones', icono: this.i.bot };
      default:
        return m.autor === 'bot' ? { texto: 'Respuesta automática', icono: this.i.bot } : null;
    }
  }

  private cargarAprobadas(): void {
    if (this.aprobadas()) return;
    this.whatsapp.plantillas().subscribe({
      next: (l) => this.aprobadas.set(l.filter((p) => p.estado === 'aprobada')),
      error: () => this.aprobadas.set([]),
    });
  }

  protected categoriaCorta(p: Plantilla): string {
    return p.categoria === 'MARKETING' ? 'promoción' : 'servicio';
  }

  protected elegirPlantilla(id: string): void {
    const p = this.aprobadas()?.find((x) => String(x.id) === id) ?? null;
    this.elegida.set(p);
    // La primera variable casi siempre es el nombre: se propone el del cliente.
    const nombre = this.abierto()?.contacto.nombre?.trim().split(/\s+/)[0] ?? '';
    this.variables.set(p && variablesDe(p.cuerpo) ? [nombre] : []);
  }

  protected cambiarVariable(k: number, valor: string): void {
    this.variables.update((v) => {
      const n = [...v];
      n[k] = valor;
      return n;
    });
  }

  protected enviarPlantilla(): void {
    const id = this.abiertoId();
    const p = this.elegida();
    if (!id || !p || !this.plantillaLista() || this.enviando() || this.promocionBloqueada()) return;
    this.enviando.set(true);
    this.errorEnvio.set(null);
    const variables = this.indicesVariables().map((k) => this.variables()[k].trim());
    this.whatsapp.enviarPlantilla(id, p.id, variables).subscribe({
      next: (m) => {
        this.enviando.set(false);
        this.elegida.set(null);
        this.variables.set([]);
        this.mensajes.update((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
        this.bajar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorEnvio.set(mensajeDeError(e));
      },
    });
  }

  protected enviar(): void {
    const id = this.abiertoId();
    const texto = this.texto().trim();
    if (!id || !texto || this.enviando() || this.motivoSinResponder() || this.ventanaCerrada()) return;
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.whatsapp.responder(id, texto).subscribe({
      next: (m) => {
        this.enviando.set(false);
        this.texto.set('');
        this.mensajes.update((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
        this.bajar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorEnvio.set(mensajeDeError(e));
      },
    });
  }

  // ── Formato ─────────────────────────────────────────────────────────

  protected nombre(c: Conversacion): string {
    return c.contacto.nombre?.trim() || identificacion(c.contacto);
  }

  protected inicial(c: Conversacion): string {
    const n = c.contacto.nombre?.trim();
    return n ? n.charAt(0).toUpperCase() : '#';
  }

  /** "14:05" hoy, "ayer", "lun" esta semana, "3/10" antes. */
  protected cuandoLista(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    const dias = Math.floor((inicioDia(hoy) - inicioDia(d)) / 86_400_000);
    if (dias === 0) return hora(d);
    if (dias === 1) return 'ayer';
    if (dias < 7) return DIAS[d.getDay()];
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  protected hora(iso: string): string {
    return hora(new Date(iso));
  }

  /** Separador de día dentro del chat. */
  protected diaDe(iso: string): string {
    const d = new Date(iso);
    const dias = Math.floor((inicioDia(new Date()) - inicioDia(d)) / 86_400_000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  protected nuevoDia(indice: number): boolean {
    const m = this.mensajes();
    return indice === 0 || inicioDia(new Date(m[indice].enviadoEn)) !== inicioDia(new Date(m[indice - 1].enviadoEn));
  }

  protected ventanaTexto(c: Conversacion): string {
    if (!c.ventanaHasta || !c.ventanaAbierta) return 'Ventana de 24 h cerrada';
    const fin = new Date(c.ventanaHasta);
    const horas = Math.max(0, Math.round((fin.getTime() - Date.now()) / 3_600_000));
    return horas >= 1 ? `Puedes responder por ${horas} h más` : 'La ventana para responder cierra en menos de una hora';
  }

  protected iconoTipo(tipo: string) {
    return ({ image: this.i.foto, video: this.i.video, audio: this.i.audio, document: this.i.archivo, location: this.i.mapa } as Record<string, typeof IconPhoto>)[tipo] ?? null;
  }

  protected etiquetaTipo(m: Mensaje): string {
    const base: Record<string, string> = {
      image: 'Foto',
      video: 'Video',
      audio: 'Audio',
      document: m.media?.nombre ?? 'Documento',
      sticker: 'Sticker',
      location: 'Ubicación',
      contacts: 'Contacto',
      reaction: 'Reaccionó',
      unsupported: 'Mensaje que WhatsApp no deja ver aquí',
    };
    return base[m.tipo] ?? '';
  }

  private estaAbajo(): boolean {
    const el = this.scroll()?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  private bajar(): void {
    requestAnimationFrame(() => {
      const el = this.scroll()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}

function inicioDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function hora(d: Date): string {
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}
