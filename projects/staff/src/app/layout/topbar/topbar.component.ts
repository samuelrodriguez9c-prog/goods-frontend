import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconBell, IconChevronRight, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacion } from '../../core/notificaciones/models/notificacion.model';
import { NotificacionService } from '../../core/notificaciones/notificacion.service';
import { RealtimeService } from '../../core/realtime/realtime.service';

/**
 * Barra superior del shell de staff — versión reducida de
 * `admin/layout/topbar/`: mismo wordmark izquierda + avatar/nombre/logout
 * derecha, sin buscador central (eso sigue sin aplicar a este panel).
 *
 * La campanita de notificaciones SÍ es real ahora (2026-09-23, pedido de
 * gerencia de separar notificaciones de cliente vs staff) — antes el
 * comentario de acá decía explícitamente que no había "ningún plan
 * concreto" detrás de un ícono así; ahora sí lo hay (ver
 * `NotificacionService`/`NotificacionController.listarStaff` del
 * backend). Consume `GET /notificaciones/staff`, con push en vivo por el
 * mismo socket que ya abre `RealtimeService` (evento `notificacion:nueva`,
 * `RealtimeGateway.emitirAUsuario` del backend).
 *
 * El aviso de acceso especial ya no es una píldora ámbar suelta a la
 * izquierda del avatar (rediseño del handoff, 2026-09-22): es una segunda
 * línea dentro del propio bloque de usuario ("Superadmin | Acceso
 * especial"), porque el dato es *sobre esa cuenta*, no un estado suelto
 * de la aplicación. El `title` con la explicación completa se movió del
 * badge viejo al bloque de usuario. En sesión normal el bloque queda
 * exactamente como antes (avatar + nombre en una línea).
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);
  private readonly realtimeService = inject(RealtimeService);

  protected readonly iconBell = IconBell;
  protected readonly iconBorrar = IconTrash;
  protected readonly iconVerTodas = IconChevronRight;

  protected readonly currentUser = this.authService.currentUser;

  protected readonly notificaciones = signal<Notificacion[]>([]);
  // "Borrar todas" (pedido explícito 2026-09-23, segunda vuelta; ajustado
  // en la tercera el mismo día): las filas NUNCA se borran ni se marcan
  // leídas — solo se ocultan de este dropdown. La segunda vuelta lo hacía
  // solo en memoria (por pedido explícito del usuario de no usar
  // localStorage) pero eso las hacía reaparecer al recargar, que es
  // justo lo que la tercera vuelta pide evitar: ahora `borrarTodas()`
  // también llama a `NotificacionService.ocultarTodas()`, que persiste el
  // ocultamiento en el backend (columna `oculta_en_bandeja_en`, nunca en
  // el navegador) — `cargar()` ya no vuelve a traerlas después de eso, sin
  // necesidad de `incluirOcultas`. Este set sigue existiendo solo para el
  // feedback visual INSTANTÁNEO (sacarlas de la vista sin esperar la
  // respuesta del PATCH).
  private readonly idsOcultos = signal<Set<number>>(new Set());
  protected readonly notificacionesVisibles = computed(() =>
    this.notificaciones().filter((n) => !this.idsOcultos().has(n.id)),
  );
  protected readonly noLeidas = computed(
    () => this.notificacionesVisibles().filter((n) => !n.leidaEn).length,
  );
  protected readonly panelAbierto = signal(false);

  private notifSub: Subscription | undefined;

  constructor() {
    // Solo si hay sesión: este componente se monta siempre (ShellComponent
    // lo incluye), pero el primer render puede pasar antes de que
    // AuthService termine de resolver `GET /auth/me` — mismo cuidado que
    // `ShellComponent.ngOnInit` con `isAuthenticated()`.
    if (this.authService.isAuthenticated()) {
      this.cargar();
    }
    this.notifSub = this.realtimeService
      .escuchar<Notificacion>('notificacion:nueva')
      .subscribe(() => this.cargar());
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
  }

  private cargar(): void {
    this.notificacionService.listar().subscribe({
      next: (respuesta) => this.notificaciones.set(respuesta.data),
      error: () => undefined,
    });
  }

  protected togglePanel(): void {
    this.panelAbierto.update((abierto) => !abierto);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected marcarLeida(notificacion: Notificacion): void {
    if (notificacion.leidaEn) {
      return;
    }
    this.notificacionService.marcarLeida(notificacion.id).subscribe(() => {
      this.notificaciones.update((actual) =>
        actual.map((n) =>
          n.id === notificacion.id ? { ...n, leidaEn: new Date().toISOString() } : n,
        ),
      );
    });
  }

  protected marcarTodasLeidas(): void {
    if (!this.noLeidas()) {
      return;
    }
    this.notificacionService.marcarTodasLeidas().subscribe(() => {
      const ahora = new Date().toISOString();
      this.notificaciones.update((actual) =>
        actual.map((n) => (n.leidaEn ? n : { ...n, leidaEn: ahora })),
      );
    });
  }

  /** Oculta todas de este dropdown, ahora persistido (ver el comentario
   * de `idsOcultos` arriba) — nunca borra filas ni las marca leídas. El
   * ocultamiento local es optimista (no espera la respuesta del PATCH);
   * si el PATCH fallara, la próxima recarga las trae de vuelta, que es un
   * fallback razonable para una acción puramente visual. */
  protected borrarTodas(): void {
    if (!this.notificacionesVisibles().length) {
      return;
    }
    this.idsOcultos.update((actual) => {
      const nuevo = new Set(actual);
      for (const n of this.notificaciones()) {
        nuevo.add(n.id);
      }
      return nuevo;
    });
    this.notificacionService.ocultarTodas().subscribe({ error: () => undefined });
  }

  /** "Ver todas" — cierra el panel y navega a la página con el detalle
   * completo (`NotificacionesPageComponent`), pedido explícito
   * 2026-09-23, segunda vuelta. */
  protected verTodas(): void {
    this.cerrarPanel();
    this.router.navigateByUrl('/notificaciones');
  }

  protected tiempoRelativo(iso: string): string {
    const diff = Date.now() - Date.parse(iso);
    const MS_MINUTO = 60_000;
    const MS_HORA = 3_600_000;
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

  protected readonly initials = computed(() => {
    const usuario = this.currentUser();
    if (!usuario) {
      return '…';
    }
    const inicial = (texto: string) => texto.trim().charAt(0).toUpperCase();
    return `${inicial(usuario.nombres)}${inicial(usuario.apellidos)}` || '?';
  });

  protected readonly displayName = computed(() => {
    const usuario = this.currentUser();
    return usuario ? usuario.nombres : '…';
  });

  // Fase 7 de PROPUESTA_ROLES_Y_ACCESOS.md (§5.5) — "lo que más impacto
  // tiene en seguridad" según la propia propuesta: quien esté usando el
  // acceso especial de superadmin tiene que verlo escrito en pantalla en
  // TODO momento dentro del panel de staff, no solo enterarse por lo que
  // pueda o no hacer. `esSesionCrossPanelStaff` viaja en la sesión (JWT +
  // GET /auth/me), nunca hace falta volver a pedirlo.
  protected readonly esCrossPanelStaff = computed(
    () => this.currentUser()?.esSesionCrossPanelStaff ?? false,
  );

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
