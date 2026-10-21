import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconBrandWhatsapp, IconCheck, IconSparkles, TablerIconComponent } from '@tabler/icons-angular';
import { debounceTime, Subject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { FichaCliente } from '../../../../core/cliente/models/cliente.model';
import { ClienteService } from '../../../../core/cliente/cliente.service';
import { PedidoService } from '../../../../core/pedido/pedido.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import {
  Conversacion,
  Mensaje,
  Mostrador,
  Plantilla,
  RespuestaRapida,
  identificacion,
} from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { COSTO_PLANTILLA, cop } from '../../shared/secciones';
import { DatosPlantilla } from '../../shared/variables';
import { FiltroBandeja, WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import {
  BorradorPedido,
  ItemChat,
  MarcaLocal,
  atiendeIa,
  claveSugerencia,
  diaDe,
  estadoVentana,
  hhmm,
  inicioDia,
  primerNombre,
} from './bandeja.utils';
import { BurbujaMensajeComponent, EstadoAdjunto } from './components/burbuja-mensaje/burbuja-mensaje.component';
import { CabeceraChatComponent } from './components/cabecera-chat/cabecera-chat.component';
import { CompositorComponent } from './components/compositor/compositor.component';
import { ListaChatsComponent } from './components/lista-chats/lista-chats.component';
import { PanelClienteComponent } from './components/panel-cliente/panel-cliente.component';
import { IaMarcaComponent } from '../../../../shared/ui/ia-marca/ia-marca.component';

/**
 * Bandeja de WhatsApp: lista de chats,
 * conversación y panel del cliente. La cabecera (título, métricas, número) y
 * la conexión las pone el marco (`WhatsappShellComponent`); las métricas
 * filtran la lista vía `store.filtroBandeja`. Se actualiza en vivo
 * (`whatsapp:cambio`).
 */
@Component({
  selector: 'app-whatsapp-page',
  imports: [IaMarcaComponent, 
    TablerIconComponent,
    ListaChatsComponent,
    CabeceraChatComponent,
    BurbujaMensajeComponent,
    CompositorComponent,
    PanelClienteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-page.component.html',
  host: { class: 'block' },
})
export class WhatsappPageComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly clientes = inject(ClienteService);
  private readonly pedidosApi = inject(PedidoService);
  private readonly alertas = inject(AlertaService);
  protected readonly store = inject(WhatsappModuloStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly i = { wa: IconBrandWhatsapp, ia: IconSparkles, check: IconCheck };

  private readonly permisos = computed(() => this.auth.currentUser()?.permisos ?? []);
  protected readonly puedeConfigurar = computed(() => this.permisos().includes('whatsapp.configurar'));
  protected readonly puedeResponder = computed(() => this.permisos().includes('whatsapp.responder'));
  protected readonly puedeCrearPedido = computed(() => this.permisos().includes('pedidos.editar'));
  private readonly puedeVerClientes = computed(() => this.permisos().includes('clientes.ver'));

  /** Reloj de la ventana de 24 h (anillos, "Cierra en…"). */
  protected readonly ahora = signal(Date.now());

  // Lista
  protected readonly chats = signal<Conversacion[]>([]);
  protected readonly total = signal(0);
  private readonly pagina = signal(1);
  private readonly totalPaginas = signal(1);
  private cargandoMas = false;
  protected readonly busca = signal('');
  private readonly busqueda$ = new Subject<void>();

  // Conversación
  protected readonly abiertoId = signal<number | null>(null);
  /** El usuario eligió el chat (no el que se abre solo al entrar): se marca leído. */
  private readonly elegidoPorUsuario = signal(false);
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly hayMas = signal(false);
  protected readonly cargandoMensajes = signal(false);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly adjuntos = signal<Record<number, EstadoAdjunto>>({});
  /** Avisos locales ("Pedido #… creado", "La IA te pasó el chat") por conversación. */
  private readonly marcas = signal<Record<number, MarcaLocal[]>>({});

  // Automático, plantillas, mostrador, cliente
  protected readonly rapidas = signal<RespuestaRapida[]>([]);
  protected readonly asistenteActivo = signal(false);

  /** Chats donde la IA está armando una respuesta → hasta cuándo (ms). Llega por tiempo real. */
  private readonly escribiendoHasta = signal<Record<number, number>>({});
  protected readonly escribiendo = computed(() => {
    const ahora = this.ahora();
    return Object.entries(this.escribiendoHasta())
      .filter(([, hasta]) => hasta > ahora)
      .map(([id]) => Number(id));
  });

  /**
   * Sugerencia de la IA por chat, atada al último mensaje del cliente
   * (`clave` = id + fecha del último mensaje): si llega otro, se pide de nuevo.
   */
  private readonly sugerencias = signal<Record<number, { clave: string; texto: string | null }>>({});
  /** La IA de Goods no está disponible: no se vuelven a pedir sugerencias. */
  private readonly sinSugerencias = signal(false);
  protected readonly sugerencia = computed(() => {
    const c = this.abierto();
    if (!c) return null;
    const s = this.sugerencias()[c.id];
    return s && s.clave === claveSugerencia(c) ? s.texto : null;
  });
  protected readonly aprobadas = signal<Plantilla[] | null>(null);
  private readonly mostradores = signal<Record<number, Mostrador>>({});
  /** Por contacto: undefined = cargando, null = todavía no es cliente. */
  private readonly fichas = signal<Record<number, FichaCliente | null>>({});
  private readonly borradores = signal<Record<number, BorradorPedido>>({});
  protected readonly creandoPedido = signal(false);

  // Disposición: depende del ancho del área
  private readonly ancho = signal(1216);
  /** El área de mensajes: los popovers del compositor no la pasan. */
  protected readonly altoMensajes = signal(400);
  protected readonly angosto = computed(() => this.ancho() < 800);
  protected readonly compacto = computed(() => this.ancho() < 1000);
  protected readonly panelFijo = computed(() => this.ancho() >= 1180);
  private readonly panelCerrado = signal(false);
  private readonly panelFlotante = signal(false);
  protected readonly panelVisible = computed(() => (this.panelFijo() ? !this.panelCerrado() : this.panelFlotante()));

  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly compositor = viewChild(CompositorComponent);

  protected readonly abierto = computed(() => this.chats().find((c) => c.id === this.abiertoId()) ?? null);
  protected readonly cliente = computed(() => primerNombre(this.abierto()));
  protected readonly enIa = computed(() => {
    const c = this.abierto();
    return !!c && atiendeIa(c, this.asistenteActivo(), this.ahora());
  });
  protected readonly ventanaAbierta = computed(() => {
    const c = this.abierto();
    return !!c && estadoVentana(c, this.ahora()) !== 'cerrada';
  });
  protected readonly motivoSinResponder = computed(() => {
    if (!this.abierto()) return null;
    if (!this.puedeResponder()) return 'Tu usuario puede ver los chats pero no responderlos.';
    if (!this.store.conectado()) return 'Reconecta tu número para responder desde Goods.';
    return null;
  });
  /** "La IA te pasó este chat · motivo" (mientras atiendas tú). */
  protected readonly traspaso = computed(() => {
    const c = this.abierto();
    if (!c?.pasadoAEquipo || this.enIa()) return null;
    return c.pasadoAEquipo.motivo?.trim() || 'Necesita que alguien del equipo lo atienda.';
  });

  protected readonly mostrador = computed(() => {
    const id = this.abiertoId();
    return id ? (this.mostradores()[id] ?? null) : null;
  });
  protected readonly ficha = computed(() => {
    const c = this.abierto();
    if (!c) return undefined;
    const f = this.fichas();
    return c.contacto.id in f ? f[c.contacto.id] : undefined;
  });
  /** Para llenar solas las variables de una plantilla: nombre, último pedido y producto que mencionó. */
  protected readonly datosPlantilla = computed<DatosPlantilla>(() => {
    const ultimo = this.ficha()?.ultimosPedidos?.[0];
    const m = this.mostrador();
    const producto = m?.productos.find((p) => p.id === m.interes[0]);
    return {
      nombre: this.cliente(),
      ...(ultimo ? { pedido: `#${ultimo.numero}`, total: cop(Number(ultimo.total)) } : {}),
      ...(producto ? { producto: producto.nombre } : {}),
    };
  });
  protected readonly borrador = computed(() => {
    const id = this.abiertoId();
    return id ? (this.borradores()[id] ?? {}) : {};
  });

  /** Mensajes con los separadores de día y los avisos locales intercalados por hora. */
  protected readonly items = computed<ItemChat[]>(() => {
    const id = this.abiertoId();
    const locales = id ? (this.marcas()[id] ?? []) : [];
    const todos: { en: string; item: Omit<ItemChat, 'dia'> }[] = [
      ...this.mensajes().map((m) => ({ en: m.enviadoEn, item: { k: 'msg' as const, id: 'm' + m.id, m } })),
      ...locales.map((l) => ({
        en: l.en,
        item: l.k === 'sistema' ? { k: 'sistema' as const, id: l.id, texto: l.texto } : { k: 'marca' as const, id: l.id, texto: l.texto, hora: hhmm(new Date(l.en)) },
      })),
    ].sort((a, b) => new Date(a.en).getTime() - new Date(b.en).getTime());
    let anterior: number | null = null;
    return todos.map(({ en, item }) => {
      const dia = inicioDia(new Date(en));
      const separador = dia !== anterior ? diaDe(en) : null;
      anterior = dia;
      return { ...item, dia: separador } as ItemChat;
    });
  });

  constructor() {
    this.cargarChats();
    this.cargarAutomatico();

    const reloj = setInterval(() => this.ahora.set(Date.now()), 15_000);
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      clearInterval(reloj);
      for (const a of Object.values(this.adjuntos())) if (a.url) URL.revokeObjectURL(a.url);
    });

    // Ancho del área (lista angosta, panel fijo o flotante) y alto de los mensajes.
    const medir = new ResizeObserver(() => {
      // Los cortes de ancho cuentan el padding del área (24 px a cada lado).
      this.ancho.set(this.host.nativeElement.clientWidth + 48);
      const el = this.scroll()?.nativeElement;
      if (el) this.altoMensajes.set(el.clientHeight);
    });
    medir.observe(this.host.nativeElement);
    effect(() => {
      const el = this.scroll()?.nativeElement;
      if (el) untracked(() => medir.observe(el));
    });
    destroy.onDestroy(() => medir.disconnect());

    // Las fotos se traen solas al aparecer; audio, video y documentos, al tocarlos.
    effect(() => {
      for (const m of this.mensajes()) {
        if (m.media?.descargable && (m.tipo === 'image' || m.tipo === 'sticker')) untracked(() => this.cargarAdjunto(m));
      }
    });
    // Con la ventana cerrada se ofrece mandar una plantilla: se traen las aprobadas (una vez).
    effect(() => {
      if (this.abierto() && !this.ventanaAbierta() && this.puedeResponder()) untracked(() => this.cargarAprobadas());
    });
    // Le toca responder a una persona (no a la IA) y el cliente escribió último: se pide una sugerencia.
    effect(() => {
      const c = this.abierto();
      if (!c || this.sinSugerencias() || !this.puedeResponder() || !this.ventanaAbierta() || this.enIa()) return;
      if (c.ultimoMensajeDireccion !== 'entrante') return;
      const clave = claveSugerencia(c);
      if (untracked(() => this.sugerencias()[c.id]?.clave) === clave) return;
      untracked(() => this.pedirSugerencia(c.id, clave));
    });
    // Al entrar se abre el primer chat, salvo en pantallas angostas.
    effect(() => {
      const primero = this.chats()[0];
      if (primero && this.abiertoId() === null && !this.angosto()) untracked(() => this.abrir(primero, false));
    });

    this.busqueda$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.cargarChats());
    this.realtime
      .escuchar<{ conversacionId: number; hasta: string | null }>('whatsapp:escribiendo')
      .pipe(takeUntilDestroyed())
      .subscribe(({ conversacionId, hasta }) => {
        this.ahora.set(Date.now());
        this.escribiendoHasta.update((x) => {
          const n = { ...x };
          if (hasta) n[conversacionId] = new Date(hasta).getTime();
          else delete n[conversacionId];
          return n;
        });
      });
    this.realtime
      .escuchar<{ conversacionId: number }>('whatsapp:cambio')
      .pipe(debounceTime(150), takeUntilDestroyed())
      .subscribe(({ conversacionId }) => {
        this.cargarChats(true);
        if (conversacionId === this.abiertoId()) {
          this.cargarMensajes(conversacionId, true);
          this.cargarMostrador(conversacionId, true);
        }
      });
  }

  // Lista

  protected cambiarBusca(v: string): void {
    this.busca.set(v);
    this.busqueda$.next();
  }

  protected cambiarFiltro(f: FiltroBandeja): void {
    this.store.filtroBandeja.set(f);
  }

  /** Recarga la primera página; en vivo conserva las que ya se habían traído. */
  private cargarChats(enVivo = false): void {
    this.whatsapp.conversaciones({ buscar: this.busca().trim() || undefined }).subscribe({
      next: (r) => {
        this.total.set(r.total);
        this.totalPaginas.set(r.totalPaginas);
        if (!enVivo) {
          this.pagina.set(1);
          this.chats.set(r.data);
          return;
        }
        const nuevos = new Set(r.data.map((c) => c.id));
        const resto = this.chats().filter((c) => !nuevos.has(c.id));
        this.chats.set([...r.data, ...resto]);
      },
    });
  }

  protected masChats(): void {
    if (this.cargandoMas || this.pagina() >= this.totalPaginas()) return;
    this.cargandoMas = true;
    const siguiente = this.pagina() + 1;
    this.whatsapp.conversaciones({ buscar: this.busca().trim() || undefined, page: siguiente }).subscribe({
      next: (r) => {
        const ya = new Set(this.chats().map((c) => c.id));
        this.chats.update((l) => [...l, ...r.data.filter((c) => !ya.has(c.id))]);
        this.pagina.set(siguiente);
        this.totalPaginas.set(r.totalPaginas);
        this.cargandoMas = false;
      },
      error: () => (this.cargandoMas = false),
    });
  }

  protected readonly hayMasChats = computed(() => this.pagina() < this.totalPaginas());

  // Conversación

  protected abrir(c: Conversacion, porUsuario = true): void {
    if (c.id === this.abiertoId()) {
      if (porUsuario && !this.elegidoPorUsuario()) {
        this.elegidoPorUsuario.set(true);
        this.marcarLeida(c);
      }
      return;
    }
    this.abiertoId.set(c.id);
    this.elegidoPorUsuario.set(porUsuario);
    this.mensajes.set([]);
    this.hayMas.set(false);
    this.texto.set('');
    this.errorEnvio.set(null);
    this.compositor()?.reiniciar();
    this.panelFlotante.set(false);
    this.cargarMensajes(c.id);
    this.cargarMostrador(c.id);
    this.cargarFicha(c);
  }

  protected cerrarChat(): void {
    this.abiertoId.set(null);
  }

  private cargarMensajes(id: number, enVivo = false): void {
    if (!enVivo) this.cargandoMensajes.set(true);
    this.whatsapp.mensajes(id).subscribe({
      next: (r) => {
        if (this.abiertoId() !== id) return;
        const estabaAbajo = this.estaAbajo();
        if (enVivo) {
          // Conserva los anteriores ya traídos con "ver anteriores".
          const nuevos = new Set(r.data.map((m) => m.id));
          const primero = r.data[0]?.id ?? Infinity;
          this.mensajes.update((l) => [...l.filter((m) => !nuevos.has(m.id) && m.id < primero), ...r.data]);
        } else {
          this.mensajes.set(r.data);
          this.hayMas.set(r.hayMas);
        }
        this.cargandoMensajes.set(false);
        if (!enVivo || estabaAbajo) this.bajar();
        const chat = this.chats().find((c) => c.id === id);
        if (chat && this.elegidoPorUsuario()) this.marcarLeida(chat);
      },
      error: () => this.cargandoMensajes.set(false),
    });
  }

  private marcarLeida(c: Conversacion): void {
    if (!c.noLeidos) return;
    this.whatsapp.marcarLeida(c.id).subscribe();
    this.parcheChat(c.id, { noLeidos: 0 });
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

  protected puedeReintentar(m: Mensaje): boolean {
    return (m.autor === 'equipo' || m.autor === 'bot') && this.puedeResponder();
  }

  // Enviar

  /** `resumen`: el resumen de un pedido; no toca lo que se esté escribiendo y, si falla, queda en el cuadro para reintentar. */
  protected enviar(texto: string, resumen = false): void {
    const c = this.abierto();
    if (!c || !texto.trim() || this.enviando() || this.motivoSinResponder() || !this.ventanaAbierta()) return;
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.whatsapp.responder(c.id, texto.trim()).subscribe({
      next: (m) => {
        this.enviando.set(false);
        if (!resumen) this.texto.set('');
        this.agregarMensaje(m);
        this.tomarChat(c);
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorEnvio.set(mensajeDeError(e));
        if (resumen && !this.texto().trim()) this.texto.set(texto.trim());
      },
    });
  }

  protected enviarProducto(productoId: number): void {
    const c = this.abierto();
    if (!c || this.motivoSinResponder() || !this.ventanaAbierta()) return;
    this.errorEnvio.set(null);
    this.whatsapp.enviarProducto(c.id, productoId).subscribe({
      next: (m) => {
        this.agregarMensaje(m);
        this.tomarChat(c);
      },
      error: (e) => this.errorEnvio.set(mensajeDeError(e)),
    });
  }

  protected enviarPlantilla(e: { plantilla: Plantilla; variables: string[] }): void {
    const id = this.abiertoId();
    if (!id || this.enviando()) return;
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.whatsapp.enviarPlantilla(id, e.plantilla.id, e.variables).subscribe({
      next: (m) => {
        this.enviando.set(false);
        this.agregarMensaje(m);
        this.alertas.mostrar({
          estado: 'success',
          titulo: `Plantilla enviada · Meta cobra ≈ ${cop(COSTO_PLANTILLA[e.plantilla.categoria] ?? 4)}`,
        });
      },
      error: (err) => {
        this.enviando.set(false);
        this.errorEnvio.set(mensajeDeError(err));
      },
    });
  }

  private agregarMensaje(m: Mensaje): void {
    this.mensajes.update((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    this.bajar();
  }

  /** Al escribir el equipo, el backend pausa la IA 12 h y da por visto el traspaso. */
  private tomarChat(c: Conversacion): void {
    this.elegidoPorUsuario.set(true);
    if (c.pasadoAEquipo) this.fijarTraspaso(c);
    const cambio: Partial<Conversacion> = { pasadoAEquipo: null };
    if (this.enIa()) cambio.asistentePausadoHasta = new Date(Date.now() + 12 * 3_600_000).toISOString();
    this.parcheChat(c.id, cambio);
  }

  /** "Entendido": deja una marca en el chat y lo avisa al backend. */
  protected entendido(): void {
    const c = this.abierto();
    if (!c?.pasadoAEquipo) return;
    this.fijarTraspaso(c);
    this.parcheChat(c.id, { pasadoAEquipo: null });
    this.whatsapp.marcarPasadoVisto(c.id).subscribe({ error: (e) => this.errorEnvio.set(mensajeDeError(e)) });
  }

  private fijarTraspaso(c: Conversacion): void {
    const motivo = (c.pasadoAEquipo?.motivo ?? '').trim().replace(/\.$/, '');
    if (!motivo) return;
    this.agregarMarca(c.id, { k: 'marca', texto: motivo });
  }

  private agregarMarca(id: number, m: Omit<MarcaLocal, 'id' | 'en'>): void {
    const en = new Date().toISOString();
    this.marcas.update((x) => ({ ...x, [id]: [...(x[id] ?? []), { ...m, id: `${m.k}-${Date.now()}`, en }] }));
    this.bajar();
  }

  // IA y promociones

  protected cambiarModo(modo: 'ia' | 'tu'): void {
    const c = this.abierto();
    if (!c || (modo === 'ia') === this.enIa()) return;
    const pausar = modo === 'tu';
    this.whatsapp.pausarAsistente(c.id, pausar).subscribe({
      next: (r) => {
        this.parcheChat(c.id, { asistentePausadoHasta: r.asistentePausadoHasta, ...(pausar ? {} : { pasadoAEquipo: null }) });
        if (!pausar) {
          if (c.pasadoAEquipo) this.whatsapp.marcarPasadoVisto(c.id).subscribe();
          this.alertas.mostrar({ estado: 'success', titulo: 'La IA vuelve a atender este chat' });
        }
      },
      error: (e) => this.errorEnvio.set(mensajeDeError(e)),
    });
  }

  protected alternarPromociones(): void {
    const c = this.abierto();
    if (!c || !this.puedeResponder()) return;
    const acepta = !c.contacto.aceptaPromociones;
    this.parcheChat(c.id, { contacto: { ...c.contacto, aceptaPromociones: acepta } });
    this.whatsapp.marcarPromociones(c.id, acepta).subscribe({
      error: (e) => {
        this.parcheChat(c.id, { contacto: { ...c.contacto, aceptaPromociones: !acepta } });
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e) });
      },
    });
  }

  private parcheChat(id: number, cambio: Partial<Conversacion>): void {
    this.chats.update((l) => l.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  }

  // Mostrador y pedido en curso

  protected cargarMostrador(id: number, enVivo = false): void {
    if (!enVivo && this.mostradores()[id]) return;
    this.whatsapp.mostrador(id).subscribe({
      next: (m) => this.mostradores.update((x) => ({ ...x, [id]: m })),
      error: () => undefined,
    });
  }

  private cargarFicha(c: Conversacion): void {
    const contacto = c.contacto.id;
    if (contacto in this.fichas() && this.fichas()[contacto] !== undefined) return;
    if (!this.puedeVerClientes()) {
      this.fichas.update((x) => ({ ...x, [contacto]: null }));
      return;
    }
    this.clientes.porWhatsapp(contacto).subscribe({
      next: (f) => this.fichas.update((x) => ({ ...x, [contacto]: f })),
      error: () => this.fichas.update((x) => ({ ...x, [contacto]: null })),
    });
  }

  protected sumarAlPedido(productoId: number, cantidad: number, aviso = true): void {
    const id = this.abiertoId();
    if (!id) return;
    this.borradores.update((b) => {
      const actual = { ...(b[id] ?? {}) };
      const n = Math.max(0, (actual[productoId] ?? 0) + cantidad);
      if (n) actual[productoId] = n;
      else delete actual[productoId];
      return { ...b, [id]: actual };
    });
    if (aviso && cantidad > 0) this.alertas.mostrar({ estado: 'success', titulo: `${cantidad} agregado${cantidad > 1 ? 's' : ''} al pedido` });
  }

  /** Crea el pedido (canal WhatsApp) y le manda al cliente el resumen. */
  protected crearPedido(): void {
    const c = this.abierto();
    const productos = this.mostrador()?.productos ?? [];
    const lineas = Object.entries(this.borrador())
      .map(([id, n]) => ({ p: productos.find((x) => x.id === Number(id)), n }))
      .filter((l) => !!l.p && l.n > 0);
    if (!c || !lineas.length || this.creandoPedido()) return;
    const ficha = this.ficha();
    this.creandoPedido.set(true);
    this.pedidosApi
      .crear({
        ...(ficha
          ? { clienteId: ficha.id }
          : { clienteNuevo: { nombre: c.contacto.nombre?.trim() || identificacion(c.contacto), telefono: c.contacto.waId } }),
        items: lineas.map((l) => ({ productoId: l.p!.id, cantidad: l.n })),
        canal: 'whatsapp',
        whatsappConversacionId: c.id,
      })
      .subscribe({
        next: (pedido) => {
          this.creandoPedido.set(false);
          const total = cop(Number(pedido.total));
          this.borradores.update((b) => ({ ...b, [c.id]: {} }));
          this.agregarMarca(c.id, { k: 'sistema', texto: `Pedido #${pedido.numero} creado · ${total}` });
          // La ficha ahora tiene un pedido más (y, si era nuevo, ya es cliente).
          this.fichas.update((x) => {
            const n = { ...x };
            delete n[c.contacto.id];
            return n;
          });
          this.cargarFicha(c);
          const nombre = primerNombre(c);
          const detalle = pedido.items.map((it) => `• ${it.cantidad} × ${it.productoNombre}`).join('\n');
          const resumen = `Listo${nombre ? ' ' + nombre : ''}, tu pedido #${pedido.numero}:\n${detalle}\nTotal: ${total}. Te aviso cuando esté listo.`;
          if (this.ventanaAbierta() && !this.motivoSinResponder()) {
            setTimeout(() => this.enviar(resumen, true), 350);
          } else {
            this.alertas.mostrar({ estado: 'success', titulo: `Pedido #${pedido.numero} creado. Con la ventana cerrada, el resumen no se puede enviar.` });
          }
        },
        error: (e) => {
          this.creandoPedido.set(false);
          this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos crear el pedido.') });
        },
      });
  }

  // Automático y plantillas

  private pedirSugerencia(id: number, clave: string): void {
    this.sugerencias.update((x) => ({ ...x, [id]: { clave, texto: null } }));
    this.whatsapp.sugerencia(id).subscribe({
      next: ({ texto }) => this.sugerencias.update((x) => (x[id]?.clave === clave ? { ...x, [id]: { clave, texto } } : x)),
      // 409: Goods no tiene la IA configurada. Otros errores: se queda sin sugerencia para ese mensaje.
      error: (e: { status?: number }) => {
        if (e?.status === 409) this.sinSugerencias.set(true);
      },
    });
  }

  private cargarAutomatico(): void {
    this.whatsapp.automatizaciones().subscribe({
      next: (a) => {
        this.rapidas.set(a.respuestasRapidas);
        this.asistenteActivo.set(!!a.asistente.config?.activa && a.asistente.disponible);
      },
      error: () => undefined,
    });
  }

  private cargarAprobadas(): void {
    if (this.aprobadas()) return;
    this.whatsapp.plantillas().subscribe({
      next: (l) => this.aprobadas.set(l.filter((p) => p.estado === 'aprobada')),
      error: () => this.aprobadas.set([]),
    });
  }

  // Panel

  protected alternarPanel(): void {
    if (this.panelFijo()) this.panelCerrado.update((v) => !v);
    else this.panelFlotante.update((v) => !v);
  }

  // Scroll

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
