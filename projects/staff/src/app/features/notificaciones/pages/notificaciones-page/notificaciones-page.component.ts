import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IconBellRinging,
  IconBuildingStore,
  IconCircleCheck,
  IconCircleX,
  IconClockHour4,
  IconCreditCardOff,
  IconHeadset,
  IconMessage,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { CabeceraModuloComponent } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { Notificacion, TipoNotificacion } from '../../../../core/notificaciones/models/notificacion.model';
import { NotificacionService } from '../../../../core/notificaciones/notificacion.service';

/** Ícono + etiqueta legible por tipo — la campanita del topbar no lo
 * necesita (solo muestra título/cuerpo), pero una página dedicada de
 * "todas las notificaciones" sí se beneficia de poder distinguir de un
 * vistazo qué tipo es cada una, sin tener que leer el cuerpo entero. */
const CATALOGO_TIPO: Record<TipoNotificacion, { etiqueta: string; icono: typeof IconMessage }> = {
  pedido_estado: { etiqueta: 'Pedido', icono: IconMessage },
  pago_estado: { etiqueta: 'Pago', icono: IconCreditCardOff },
  stock_bajo: { etiqueta: 'Stock bajo', icono: IconMessage },
  mensaje_chat: { etiqueta: 'Mensaje de chat', icono: IconMessage },
  empresa_registrada: { etiqueta: 'Empresa registrada', icono: IconBuildingStore },
  empresa_estado_cambio: { etiqueta: 'Cambio de estado de Empresa', icono: IconBuildingStore },
  conversacion_solicitada: { etiqueta: 'Conversación solicitada', icono: IconHeadset },
  conversacion_sin_asignar: { etiqueta: 'Conversación sin asignar', icono: IconHeadset },
  conversacion_asignada: { etiqueta: 'Conversación asignada', icono: IconHeadset },
  conversacion_cerrada: { etiqueta: 'Conversación cerrada', icono: IconCircleX },
  plan_por_vencer: { etiqueta: 'Plan por vencer', icono: IconClockHour4 },
  plan_pago_vencido: { etiqueta: 'Pago de plan vencido', icono: IconCreditCardOff },
};

/**
 * "Ver todas las notificaciones" — pedido explícito 2026-09-23, segunda
 * vuelta: el dropdown de la campanita (`TopbarComponent`) queda acotado a
 * las últimas 20 sin más detalle que título/cuerpo/tiempo relativo; esta
 * pantalla es el destino de su botón "Ver todas" — mismo servicio
 * (`NotificacionService`, ya soportaba paginación real vía `page`, no hizo
 * falta tocar el backend) pero con fecha exacta, tipo legible, y
 * paginación de verdad en vez de una lista corta.
 *
 * No comparte estado con `TopbarComponent` (cada uno pide su propia
 * página al backend) — "marcar leída" acá actualiza esta lista; la
 * próxima vez que el topbar recargue (evento de socket o F5) va a
 * reflejar el mismo cambio, porque ambos leen la misma tabla.
 */
@Component({
  selector: 'app-notificaciones-page',
  standalone: true,
  imports: [TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent],
  templateUrl: './notificaciones-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesPageComponent {
  private readonly notificacionService = inject(NotificacionService);
  private readonly location = inject(Location);

  protected readonly iconModulo = IconBellRinging;
  protected readonly iconLeida = IconCircleCheck;

  protected readonly PAGE_SIZE = 20;

  protected readonly notificaciones = signal<Notificacion[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPaginas = signal(1);
  protected readonly total = signal(0);
  protected readonly soloNoLeidas = signal(false);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    // incluirOcultas=true (tercera vuelta, 2026-09-23): esta es
    // justamente la pantalla donde SÍ tienen que seguir apareciendo las
    // que el usuario ya "borró" del dropdown de la campanita.
    this.notificacionService
      .listar(this.soloNoLeidas(), this.PAGE_SIZE, this.page(), true)
      .subscribe({
        next: (respuesta) => {
          this.notificaciones.set(respuesta.data);
          this.totalPaginas.set(Math.max(1, respuesta.totalPaginas));
          this.total.set(respuesta.total);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar las notificaciones. Intentá de nuevo.');
          this.cargando.set(false);
        },
      });
  }

  protected alternarSoloNoLeidas(): void {
    this.soloNoLeidas.update((actual) => !actual);
    this.page.set(1);
    this.cargar();
  }

  protected paginaAnterior(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.cargar();
    }
  }

  protected paginaSiguiente(): void {
    if (this.page() < this.totalPaginas()) {
      this.page.update((p) => p + 1);
      this.cargar();
    }
  }

  protected marcarLeida(n: Notificacion): void {
    if (n.leidaEn) {
      return;
    }
    this.notificacionService.marcarLeida(n.id).subscribe(() => {
      this.notificaciones.update((actual) =>
        actual.map((x) => (x.id === n.id ? { ...x, leidaEn: new Date().toISOString() } : x)),
      );
    });
  }

  protected catalogoTipo(tipo: TipoNotificacion): { etiqueta: string; icono: typeof IconMessage } {
    return CATALOGO_TIPO[tipo] ?? { etiqueta: tipo, icono: IconMessage };
  }

  protected fechaCompleta(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** "Volver" — a esta pantalla se llega desde cualquier lado (el botón
   * "Ver todas" del dropdown de la campanita, disponible en todo el panel),
   * así que tiene más sentido volver a lo que se estaba mirando antes que
   * mandar a una ruta fija. */
  protected volver(): void {
    this.location.back();
  }
}
