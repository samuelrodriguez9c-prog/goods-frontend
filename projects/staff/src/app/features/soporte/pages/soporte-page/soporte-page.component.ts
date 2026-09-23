import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconArrowBackUp,
  IconCircleCheck,
  IconCircleX,
  IconCornerUpLeft,
  IconHeadset,
  IconInbox,
  IconSend2,
  IconUserCheck,
  IconUsers,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Subscription, finalize } from 'rxjs';
import { StatusBadgeComponent } from 'shared-ui';
import { AuthService } from '../../../../core/auth/auth.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { ChatService } from '../../../../core/chat/chat.service';
import {
  ChatUsuario,
  Conversacion,
  EventoConversacionAsignada,
  EventoMensajeNuevo,
  Mensaje,
} from '../../../../core/chat/models/conversacion.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { CabeceraModuloComponent, MetricaCabecera } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

const MS_MINUTO = 60_000;
const MS_HORA = 3_600_000;

type FiltroBandeja = 'todas' | 'sin_asignar' | 'mias';

/**
 * Bandeja de soporte (§7.2/§8 de `PIVOTE_SAAS_MULTITENANT.md`) —
 * reemplaza el placeholder que decía "TODO" apuntando a este mismo
 * documento. El backend (`modules/chat/`) ya estaba completo desde antes
 * (conversaciones tipo ticket, bandeja compartida con auto-asignación al
 * primero que responde, tiempo real vía `RealtimeGateway`); esta pantalla
 * es la primera que lo consume — ver `ChatService` (frontend) y la
 * migración `AjustarPermisosDeConversacionesPorRol` (2026-09-23), que le
 * dio `conversaciones.ver`/`conversaciones.gestionar` a los roles de
 * staff reales (antes solo los tenía el rol `admin` viejo).
 *
 * El widget del lado del cliente (`admin`, para que una Empresa pueda
 * ABRIR una conversación) todavía no existe — pendiente explícito,
 * decidido junto con el usuario el 2026-09-23: por ahora nadie puede
 * escribir del lado del cliente salvo por API directa. Esta pantalla no
 * depende de eso: lee/responde lo que ya haya en la bandeja.
 *
 * Carga todo de una vez (pageSize alto, ver `ChatService.listarBandeja`)
 * y filtra/cuenta en el cliente — a esta escala (decenas de
 * conversaciones, no miles) no hace falta paginación real todavía, mismo
 * criterio que ya usan Auditoría/Usuarios.
 */
@Component({
  selector: 'app-soporte-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, StatusBadgeComponent],
  templateUrl: './soporte-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoportePageComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly usuarioService = inject(UsuarioService);

  protected readonly iconModulo = IconHeadset;
  protected readonly iconSinAsignar = IconInbox;
  protected readonly iconMias = IconUserCheck;
  protected readonly iconCerrar = IconCircleX;
  protected readonly iconReabrir = IconArrowBackUp;
  protected readonly iconResuelta = IconCircleCheck;
  protected readonly iconEnviar = IconSend2;
  protected readonly iconResponder = IconCornerUpLeft;
  protected readonly iconCancelarRespuesta = IconX;
  // Tercera vuelta (2026-09-23): "Devolver" reusa la misma flecha de
  // "volver" que ya estaba declarada (iconReabrir) pero sin usar en
  // este HTML — encaja bien semánticamente ("deshacer" la toma). El
  // selector "Asignar a otro" suma un ícono nuevo.
  protected readonly iconAsignarOtro = IconUsers;

  protected readonly miId = computed(() => this.authService.currentUser()?.id ?? null);
  protected readonly puedeGestionar = computed(() =>
    (this.authService.currentUser()?.permisos ?? []).includes('conversaciones.gestionar'),
  );
  // Pedido explícito 2026-09-23 (segunda vuelta): "Asignarme" queda
  // reservado a admin/admin_goods — el resto del staff (staff_goods/
  // empleado_goods) tiene `conversaciones.gestionar` igual (ver
  // `puedeGestionar` arriba) pero ya no debería poder tomar una
  // conversación ajena por su cuenta. El backend (`ChatController.asignar`)
  // hace el mismo chequeo de rol — esto es solo para no mostrar un botón
  // que de todos modos el backend va a rechazar.
  protected readonly esAdminOAdminGoods = computed(() =>
    ['admin', 'admin_goods'].includes(this.authService.currentUser()?.rol?.nombre ?? ''),
  );
  // El backend (`ChatController.enviarMensaje`) ya rechaza con 409 mandarle
  // un mensaje a una conversación asignada a OTRO agente — este computed es
  // solo para no dejar escribir en el input y mostrar el motivo en vez de
  // esperar a que falle la request.
  //
  // Tercera vuelta (2026-09-23, mismo día): la segunda vuelta le daba acá
  // un bypass a admin/admin_goods (podían escribir aunque la conversación
  // fuera de otro agente, sin tomarla). El usuario probó eso y pidió lo
  // contrario: admin/admin_goods quedan bloqueados EXACTAMENTE igual que
  // cualquiera — tienen que usar el botón "Asignarme" (ver el HTML, ahora
  // también visible sobre conversaciones ajenas) para tomarla primero, lo
  // que los deja como `agenteAsignadoId` y recién ahí entran por la
  // segunda condición de abajo. Coincide 1:1 con la regla del backend.
  protected readonly puedeEscribir = computed(() => {
    const c = this.seleccionada();
    if (!c || c.estado === 'cerrada') {
      return false;
    }
    return !c.agenteAsignadoId || c.agenteAsignadoId === this.miId();
  });

  // Tercera vuelta (2026-09-23): "Asignarme" ahora también aparece sobre
  // una conversación YA asignada a OTRO agente, pero solo para
  // admin/admin_goods — es el botón que "toma" la conversación (dispara
  // `asignarme()`, que llama al mismo `PATCH .../asignar` de siempre con
  // el propio id). El backend (`ChatController.asignar`) sigue siendo
  // quien de verdad lo garantiza; esto es solo para no mostrar un botón
  // que de todos modos rechazaría.
  protected readonly puedeAsignarme = computed(() => {
    const c = this.seleccionada();
    if (!c || c.estado === 'cerrada' || !this.esAdminOAdminGoods()) {
      return false;
    }
    return c.agenteAsignadoId !== this.miId();
  });

  // "Devolver a X" (tercera vuelta): visible cuando YO tengo la
  // conversación asignada (la tomé) y quedó un rastro de a quién se la
  // saqué — devuelve con el mismo `PATCH .../asignar`, pasando
  // `agenteAnteriorId` como destino (ver `ChatService.reasignar` del
  // backend, que reconoce ese caso puntual y limpia el rastro en vez de
  // seguir acumulando).
  protected readonly puedeDevolver = computed(() => {
    const c = this.seleccionada();
    if (!c || !this.esAdminOAdminGoods()) {
      return false;
    }
    return c.agenteAsignadoId === this.miId() && c.agenteAnteriorId !== null;
  });

  // Selector "Asignar a otro" (tercera vuelta): admin/admin_goods puede
  // reasignar una conversación a CUALQUIER otro miembro del staff, no
  // solo tomarla para sí — se carga la lista de personal de Goods bajo
  // demanda (al abrir el selector, no en el constructor) para no pedirla
  // en cada carga de pantalla cuando puede que nunca se use.
  protected readonly staffAsignable = signal<UsuarioGoods[]>([]);
  protected readonly cargandoStaffAsignable = signal(false);
  protected readonly mostrandoSelectorAsignar = signal(false);
  protected readonly reasignandoA = signal<number | null>(null);

  protected readonly conversaciones = signal<Conversacion[]>([]);
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly filtro = signal<FiltroBandeja>('todas');
  protected readonly mensajeNuevo = signal('');
  /** Mensaje que se está por citar en la próxima respuesta — `null` si no
   * hay ninguno elegido. Pedido explícito 2026-09-23. */
  protected readonly respondiendoA = signal<Mensaje | null>(null);

  protected readonly cargando = signal(true);
  protected readonly cargandoHilo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly asignando = signal(false);
  protected readonly cerrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  private mensajeSub: Subscription | undefined;
  private asignadaSub: Subscription | undefined;

  // Para devolverle el foco al input después de mandar un mensaje (ver
  // `enviar()`) — pedido explícito: si no, el foco queda en el botón
  // "Enviar" (comportamiento normal del navegador al hacer click) y hay
  // que volver a clickear el input para escribir el siguiente mensaje.
  @ViewChild('inputMensaje') private readonly inputMensajeRef?: ElementRef<HTMLInputElement>;

  // Contenedor con scroll del hilo — para bajarlo al último mensaje (ver
  // el `effect()` del constructor). Pedido explícito 2026-09-23.
  @ViewChild('hiloScroll') private readonly hiloScrollRef?: ElementRef<HTMLDivElement>;

  protected readonly sinAsignar = computed(() =>
    this.conversaciones().filter((c) => c.estado === 'abierta' && c.agenteAsignadoId === null),
  );
  protected readonly mias = computed(() => {
    const yo = this.miId();
    return this.conversaciones().filter((c) => c.estado === 'abierta' && c.agenteAsignadoId === yo);
  });
  protected readonly abiertas = computed(() => this.conversaciones().filter((c) => c.estado === 'abierta'));

  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => [
    {
      id: 'sin_asignar',
      etiqueta: 'Sin asignar',
      valor: this.sinAsignar().length,
      tono: this.sinAsignar().length ? 'aviso' : 'neutro',
    },
    { id: 'mias', etiqueta: 'Mías', valor: this.mias().length, tono: 'info' },
    { id: 'todas', etiqueta: 'Abiertas', valor: this.abiertas().length },
  ]);

  /** Lista de la izquierda según el filtro activo — "todas" muestra
   * primero las ABIERTAS (ya vienen ordenadas por actividad reciente
   * desde el backend) y después las cerradas, para no perder de vista el
   * historial sin que compita visualmente con lo pendiente. */
  protected readonly visibles = computed(() => {
    if (this.filtro() === 'sin_asignar') {
      return this.sinAsignar();
    }
    if (this.filtro() === 'mias') {
      return this.mias();
    }
    return [...this.conversaciones()].sort((a, b) => {
      if (a.estado !== b.estado) {
        return a.estado === 'abierta' ? -1 : 1;
      }
      return 0;
    });
  });

  protected readonly seleccionada = computed(
    () => this.conversaciones().find((c) => c.id === this.seleccionadaId()) ?? null,
  );

  constructor() {
    this.cargarBandeja();
    this.escucharTiempoReal();
    // Auto-scroll al último mensaje — pedido explícito 2026-09-23. Corre
    // ante CUALQUIER cambio de `mensajes()`: carga inicial del hilo,
    // envío propio, o un mensaje entrante en vivo. El `setTimeout` deja
    // que Angular termine de pintar la burbuja nueva antes de medir
    // `scrollHeight` — si se mide en el mismo tick, a veces todavía tiene
    // el alto viejo.
    effect(() => {
      this.mensajes();
      setTimeout(() => this.scrollAlFinal());
    });
  }

  private scrollAlFinal(): void {
    const el = this.hiloScrollRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  ngOnDestroy(): void {
    this.mensajeSub?.unsubscribe();
    this.asignadaSub?.unsubscribe();
  }

  /** `mostrarCargando = false` para los refrescos "de fondo" (después de
   * mandar un mensaje, o disparados por un evento de socket): NO toca la
   * señal `cargando`, así `app-pantalla-estado` se queda en el estado
   * "listo" todo el tiempo — antes, cada uno de esos refrescos ponía
   * `cargando` en `true` y de vuelta en `false`, lo que hacía que
   * `PantallaEstado` destruyera y recreara TODO el contenido (esqueleto →
   * contenido real) en cada mensaje — el módulo entero "pestañeaba", y de
   * paso el input de respuesta perdía el foco porque el elemento DOM se
   * recreaba de cero. Solo la carga inicial (constructor) y "Reintentar"
   * (en el template) siguen usando el default `true`, que sí necesita
   * mostrar el esqueleto. */
  protected cargarBandeja(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargando.set(true);
      this.error.set(null);
    }
    this.chatService.listarBandeja().subscribe({
      next: (respuesta) => {
        this.conversaciones.set(respuesta.data);
        this.cargando.set(false);
        // Primera carga: si no hay nada elegido todavía, abrí la primera
        // de la bandeja (si hay alguna) para no dejar el panel derecho
        // vacío sin necesidad.
        if (this.seleccionadaId() === null && respuesta.data.length) {
          this.seleccionar(respuesta.data[0].id);
        }
      },
      error: () => {
        if (mostrarCargando) {
          this.error.set('No se pudo cargar la bandeja de soporte. Intentá de nuevo.');
        }
        this.cargando.set(false);
      },
    });
  }

  protected seleccionarFiltro(id: string): void {
    this.filtro.set(id as FiltroBandeja);
  }

  protected seleccionar(id: number): void {
    this.seleccionadaId.set(id);
    this.cargandoHilo.set(true);
    // No tiene sentido arrastrar una cita de OTRA conversación al
    // cambiar de hilo.
    this.respondiendoA.set(null);
    this.chatService
      .listarMensajes(id)
      .pipe(finalize(() => this.cargandoHilo.set(false)))
      .subscribe({
        next: (respuesta) => this.mensajes.set(respuesta.data),
        error: () => this.mensajes.set([]),
      });
  }

  protected responderA(mensaje: Mensaje): void {
    this.respondiendoA.set(mensaje);
    this.inputMensajeRef?.nativeElement.focus();
  }

  protected cancelarRespuesta(): void {
    this.respondiendoA.set(null);
  }

  protected nombreDeAutor(autor: ChatUsuario | null, autorId: number | null): string {
    if (autor) {
      return `${autor.nombres} ${autor.apellidos}`.trim();
    }
    // `autorId` nulo = mensaje de sistema — la UI no ofrece citarlo hoy,
    // pero por las dudas no queremos mostrar "Usuario #null".
    return autorId === null ? 'Sistema' : `Usuario #${autorId}`;
  }

  protected enviar(): void {
    const conversacion = this.seleccionada();
    const cuerpo = this.mensajeNuevo().trim();
    if (!conversacion || !cuerpo || conversacion.estado === 'cerrada' || this.enviando() || !this.puedeEscribir()) {
      return;
    }
    this.enviando.set(true);
    const citado = this.respondiendoA();
    this.chatService
      .enviarMensaje(conversacion.id, cuerpo, citado?.id)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (mensaje) => {
          // El POST no devuelve la relación `respondeA` resuelta (el
          // backend solo hace `save()`, no un `findOne` con relations) —
          // se arma acá con lo que ya teníamos en `respondiendoA`, para
          // que la burbuja recién mandada muestre la cita al toque en vez
          // de esperar al próximo refresco del hilo.
          const mensajeConCita: Mensaje = citado
            ? {
                ...mensaje,
                respondeA: {
                  id: citado.id,
                  autorId: citado.autorId,
                  autor: citado.autor,
                  cuerpo: citado.cuerpo,
                  creadoEn: citado.creadoEn,
                },
              }
            : mensaje;
          this.mensajes.update((actual) => [...actual, mensajeConCita]);
          this.mensajeNuevo.set('');
          this.respondiendoA.set(null);
          // Devuelve el foco al input — tanto si se mandó con Enter
          // (donde ya lo tenía) como con el botón (donde el navegador se
          // lo pasa al botón al hacer click) — para poder escribir el
          // siguiente mensaje sin volver a clickear.
          this.inputMensajeRef?.nativeElement.focus();
          // El propio envío ya dispara la auto-asignación del lado del
          // backend (si la conversación estaba libre) — recargar la
          // bandeja refleja eso sin tener que armar el estado a mano acá.
          // Refresco EN SILENCIO (ver el comentario de `cargarBandeja`):
          // mandar un mensaje no debe volver a mostrar el esqueleto.
          this.cargarBandeja(false);
        },
      });
  }

  protected asignarme(): void {
    const yo = this.miId();
    if (yo === null) {
      return;
    }
    this.reasignarA(yo);
  }

  /** Botón "Devolver a X" (tercera vuelta) — le pasa a `reasignarA` el
   * `agenteAnteriorId` guardado; el backend reconoce ese caso puntual y
   * limpia el rastro en vez de guardar una vuelta más. */
  protected devolver(): void {
    const conversacion = this.seleccionada();
    if (!conversacion?.agenteAnteriorId) {
      return;
    }
    this.reasignarA(conversacion.agenteAnteriorId);
  }

  /** Abre el selector de "Asignar a otro" (tercera vuelta) — carga la
   * lista de personal de Goods la primera vez que hace falta, no antes. */
  protected abrirSelectorAsignar(): void {
    this.mostrandoSelectorAsignar.set(true);
    if (this.staffAsignable().length || this.cargandoStaffAsignable()) {
      return;
    }
    this.cargandoStaffAsignable.set(true);
    this.usuarioService
      .listar()
      .pipe(finalize(() => this.cargandoStaffAsignable.set(false)))
      .subscribe({
        next: (respuesta) => this.staffAsignable.set(respuesta.data.filter((u) => u.activo)),
        error: () => this.staffAsignable.set([]),
      });
  }

  protected cerrarSelectorAsignar(): void {
    this.mostrandoSelectorAsignar.set(false);
  }

  /** Punto único para asignar/reasignar/tomar/devolver — todo pasa por el
   * mismo `PATCH .../asignar` (ver `asignarme()`/`devolver()`/el selector
   * "Asignar a otro" en el HTML, los tres llaman a este método con
   * distinto `usuarioId`). */
  protected reasignarA(usuarioId: number): void {
    const conversacion = this.seleccionada();
    if (!conversacion || this.asignando()) {
      return;
    }
    this.asignando.set(true);
    this.reasignandoA.set(usuarioId);
    this.chatService
      .asignar(conversacion.id, usuarioId)
      .pipe(
        finalize(() => {
          this.asignando.set(false);
          this.reasignandoA.set(null);
        }),
      )
      .subscribe({
        next: () => {
          this.mostrandoSelectorAsignar.set(false);
          this.cargarBandeja(false);
        },
      });
  }

  protected cerrarConversacion(): void {
    const conversacion = this.seleccionada();
    if (!conversacion || conversacion.estado === 'cerrada' || this.cerrando()) {
      return;
    }
    this.cerrando.set(true);
    this.chatService
      .cerrar(conversacion.id)
      .pipe(finalize(() => this.cerrando.set(false)))
      .subscribe({ next: () => this.cargarBandeja(false) });
  }

  protected nombreCliente(c: Conversacion): string {
    return c.usuario ? `${c.usuario.nombres} ${c.usuario.apellidos}`.trim() : `Usuario #${c.usuarioId}`;
  }

  protected nombreAgente(c: Conversacion): string | null {
    return c.agenteAsignado ? `${c.agenteAsignado.nombres} ${c.agenteAsignado.apellidos}`.trim() : null;
  }

  /** Tercera vuelta — nombre para el botón "Devolver a X". */
  protected nombreAgenteAnterior(c: Conversacion): string | null {
    return c.agenteAnterior ? `${c.agenteAnterior.nombres} ${c.agenteAnterior.apellidos}`.trim() : null;
  }

  protected esMio(m: Mensaje): boolean {
    return m.autorId !== this.seleccionada()?.usuarioId;
  }

  protected tiempoRelativo(iso: string): string {
    const diff = Date.now() - Date.parse(iso);
    if (diff < MS_MINUTO) {
      return 'ahora';
    }
    if (diff < MS_HORA) {
      return `hace ${Math.floor(diff / MS_MINUTO)} min`;
    }
    if (diff < MS_HORA * 24) {
      return `hace ${Math.floor(diff / MS_HORA)} h`;
    }
    const dias = Math.floor(diff / (MS_HORA * 24));
    return dias === 1 ? 'ayer' : `hace ${dias} días`;
  }

  protected horaCorta(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  /** Suscripciones de socket abiertas UNA VEZ (constructor), no por cada
   * `cargarBandeja()` — mismo criterio que `escucharPresencia()` en
   * `UsuariosPageComponent`. Ante cualquiera de los dos eventos, se
   * recarga la bandeja entera (trae nombres/estado ya resueltos) y, si
   * el evento es de la conversación abierta en ese momento, también su
   * hilo — más simple y más correcto que tratar de mergear el payload
   * angosto del socket a mano en el estado local. */
  private escucharTiempoReal(): void {
    this.mensajeSub = this.realtimeService.escuchar<EventoMensajeNuevo>('mensaje:nuevo').subscribe((evento) => {
      this.cargarBandeja(false);
      if (evento.conversacionId === this.seleccionadaId()) {
        this.chatService.listarMensajes(evento.conversacionId).subscribe((r) => this.mensajes.set(r.data));
      }
    });
    this.asignadaSub = this.realtimeService
      .escuchar<EventoConversacionAsignada>('conversacion:asignada')
      .subscribe(() => this.cargarBandeja(false));
  }
}
