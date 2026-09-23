import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCornerUpLeft,
  IconMessageCircle2,
  IconMessagePlus,
  IconSend2,
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
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

const MS_MINUTO = 60_000;
const MS_HORA = 3_600_000;

/**
 * "Messages" del lado `admin` — el widget del cliente (tenant) para
 * hablar con soporte de Goods, contraparte de `SoportePageComponent` de
 * `staff`. Reemplaza el placeholder que decía "requiere login real en el
 * admin" — eso ya no aplica, `core/auth` está completo desde antes. El
 * backend (`ChatModule`/`RealtimeGateway`) ya está probado de punta a
 * punta con la bandeja de `staff`; esta pantalla es la primera en
 * consumirlo desde el lado del tenant, decidido junto con el usuario el
 * 2026-09-23 ("Solo el widget de Soporte en admin").
 *
 * Alcance deliberadamente angosto respecto de `SoportePageComponent`: acá
 * no hay bandeja compartida ni "asignarme"/"cerrar" — un tenant solo ve
 * sus propias conversaciones (`GET /chat/conversaciones/mias`) y puede
 * abrir una nueva o seguir escribiendo en una abierta. No existe
 * `PantallaEstado` todavía en `admin` (solo en `staff`); los estados de
 * carga/error se resuelven en línea en la plantilla, igual que el resto
 * de las pantallas ya reales de este proyecto (ver
 * `SettingsUsersPageComponent`).
 */
@Component({
  selector: 'app-message-list-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, StatusBadgeComponent, ModalComponent],
  templateUrl: './message-list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageListPageComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);

  protected readonly iconModulo = IconMessageCircle2;
  protected readonly iconNueva = IconMessagePlus;
  protected readonly iconEnviar = IconSend2;
  protected readonly iconResponder = IconCornerUpLeft;
  protected readonly iconCancelarRespuesta = IconX;

  protected readonly miId = computed(() => this.authService.currentUser()?.id ?? null);

  protected readonly conversaciones = signal<Conversacion[]>([]);
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly mensajeNuevo = signal('');
  /** Mensaje que se está por citar en la próxima respuesta — mismo
   * criterio que `SoportePageComponent` de `staff`. */
  protected readonly respondiendoA = signal<Mensaje | null>(null);

  protected readonly cargando = signal(true);
  protected readonly cargandoHilo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  // Modal "nueva conversación".
  protected readonly modalNuevaAbierto = signal(false);
  protected readonly nuevoMensaje = signal('');
  protected readonly creandoConversacion = signal(false);

  private mensajeSub: Subscription | undefined;
  private asignadaSub: Subscription | undefined;

  // Para devolverle el foco al input después de mandar un mensaje (ver
  // `enviar()`) — mismo criterio que `SoportePageComponent` de `staff`.
  @ViewChild('inputMensaje') private readonly inputMensajeRef?: ElementRef<HTMLInputElement>;

  // Ver el mismo comentario en `SoportePageComponent` de `staff`.
  @ViewChild('hiloScroll') private readonly hiloScrollRef?: ElementRef<HTMLDivElement>;

  protected readonly seleccionada = computed(
    () => this.conversaciones().find((c) => c.id === this.seleccionadaId()) ?? null,
  );

  constructor() {
    this.cargarConversaciones();
    this.escucharTiempoReal();
    // Auto-scroll al último mensaje — ver el mismo comentario en
    // `SoportePageComponent` de `staff`.
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
   * mandar/crear una conversación, o disparados por un evento de socket):
   * NO toca la señal `cargando`, así el `@if (cargando())` del template
   * nunca vuelve a la rama de carga — antes, cada refresco de fondo ponía
   * `cargando` en `true` y de vuelta en `false`, lo que hacía que Angular
   * destruyera y recreara TODO el panel (dos-paneles + input) en cada
   * mensaje — el módulo entero "pestañeaba" y el input de respuesta
   * perdía el foco porque el elemento se recreaba de cero. Solo la carga
   * inicial (constructor) y "Reintentar" (en el template) siguen usando
   * el default `true`. */
  protected cargarConversaciones(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargando.set(true);
      this.error.set(null);
    }
    this.chatService.listarMias().subscribe({
      next: (respuesta) => {
        this.conversaciones.set(respuesta.data);
        this.cargando.set(false);
        if (this.seleccionadaId() === null && respuesta.data.length) {
          this.seleccionar(respuesta.data[0].id);
        }
      },
      error: () => {
        if (mostrarCargando) {
          this.error.set('No se pudieron cargar tus conversaciones. Intentá de nuevo.');
        }
        this.cargando.set(false);
      },
    });
  }

  protected seleccionar(id: number): void {
    this.seleccionadaId.set(id);
    this.cargandoHilo.set(true);
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
    return autorId === null ? 'Sistema' : `Usuario #${autorId}`;
  }

  protected enviar(): void {
    const conversacion = this.seleccionada();
    const cuerpo = this.mensajeNuevo().trim();
    if (!conversacion || !cuerpo || conversacion.estado === 'cerrada' || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    const citado = this.respondiendoA();
    this.chatService
      .enviarMensaje(conversacion.id, cuerpo, citado?.id)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (mensaje) => {
          // Ver el mismo comentario en `SoportePageComponent` de `staff`:
          // el POST no devuelve `respondeA` resuelto, se arma acá con lo
          // que ya teníamos.
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
          // Devuelve el foco al input — mismo criterio que
          // `SoportePageComponent` de `staff` (ver el comentario ahí).
          this.inputMensajeRef?.nativeElement.focus();
          // Refresco EN SILENCIO (ver el comentario de
          // `cargarConversaciones`): mandar un mensaje no debe volver a
          // mostrar el estado de carga.
          this.cargarConversaciones(false);
        },
      });
  }

  protected abrirNueva(): void {
    this.nuevoMensaje.set('');
    this.modalNuevaAbierto.set(true);
  }

  protected cerrarNueva(): void {
    this.modalNuevaAbierto.set(false);
  }

  protected crearConversacion(): void {
    const cuerpo = this.nuevoMensaje().trim();
    if (!cuerpo || this.creandoConversacion()) {
      return;
    }
    this.creandoConversacion.set(true);
    this.chatService
      .crear(cuerpo)
      .pipe(finalize(() => this.creandoConversacion.set(false)))
      .subscribe({
        next: (conversacion) => {
          this.modalNuevaAbierto.set(false);
          this.cargarConversaciones(false);
          this.seleccionar(conversacion.id);
        },
      });
  }

  protected nombreAgente(c: Conversacion): string | null {
    return c.agenteAsignado ? `${c.agenteAsignado.nombres} ${c.agenteAsignado.apellidos}`.trim() : null;
  }

  protected esMio(m: Mensaje): boolean {
    return m.autorId === this.miId();
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

  /** Mismo criterio que `SoportePageComponent`: ante cualquier evento se
   * recarga la lista completa (trae estado/agente ya resueltos) y, si es
   * la conversación abierta en ese momento, también su hilo. */
  private escucharTiempoReal(): void {
    this.mensajeSub = this.realtimeService.escuchar<EventoMensajeNuevo>('mensaje:nuevo').subscribe((evento) => {
      this.cargarConversaciones(false);
      if (evento.conversacionId === this.seleccionadaId()) {
        this.chatService.listarMensajes(evento.conversacionId).subscribe((r) => this.mensajes.set(r.data));
      }
    });
    this.asignadaSub = this.realtimeService
      .escuchar<EventoConversacionAsignada>('conversacion:asignada')
      .subscribe(() => this.cargarConversaciones(false));
  }
}
