import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { debounceTime, filter, map, merge } from 'rxjs';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { mensajeDeError } from '../../../core/solicitudes/solicitudes.service';
import { EstadoConexion, ResumenWhatsapp } from '../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../core/whatsapp/whatsapp.service';
import { ClaveSeccion, seccionDeUrl } from './secciones';

export type FiltroBandeja = 'todos' | 'sin' | 'vence' | 'ia';
export type FiltroPlantillas = 'todas' | 'aprobada' | 'pendiente' | 'rechazada';

/**
 * Estado compartido del módulo WhatsApp (rediseño del 2026-10-13), dado por
 * `WhatsappShellComponent` a sus páginas: la conexión, los números de la
 * cabecera (`GET /whatsapp/resumen`), la sección actual y lo que la cabecera
 * le pide a la página (filtrar desde una métrica, "Nueva…").
 */
@Injectable()
export class WhatsappModuloStore {
  private readonly whatsapp = inject(WhatsappService);
  private readonly router = inject(Router);

  readonly conexion = signal<EstadoConexion | null>(null);
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);
  readonly resumen = signal<ResumenWhatsapp | null>(null);

  /** Número conectado y operando. */
  readonly conectado = computed(() => this.conexion()?.cuenta?.estado === 'conectada');

  readonly seccion = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => seccionDeUrl(e.urlAfterRedirects)),
    ),
    { initialValue: seccionDeUrl(this.router.url) },
  );

  /** Filtro de la Bandeja que activan las métricas de la cabecera. */
  readonly filtroBandeja = signal<FiltroBandeja>('todos');
  /** Filtro de Plantillas que activan "Aprobadas" / "En revisión". */
  readonly filtroPlantillas = signal<FiltroPlantillas>('todas');
  /** Se incrementa cuando tocan "Nueva plantilla" / "Nueva campaña" en la cabecera. */
  readonly nuevo = signal(0);

  constructor() {
    this.cargarConexion();
    // Cualquier cambio de chats o de datos del módulo: se refrescan los números.
    merge(inject(RealtimeService).escuchar('whatsapp:cambio'), inject(RealtimeService).escuchar('datos:cambio'))
      .pipe(debounceTime(600), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.cargarResumen());
    const id = setInterval(() => this.cargarResumen(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  cargarConexion(): void {
    this.whatsapp.conexion().subscribe({
      next: (c) => {
        this.conexion.set(c);
        this.cargando.set(false);
        if (c.cuenta?.estado === 'conectada') this.cargarResumen();
      },
      error: (e) => {
        this.errorCarga.set(mensajeDeError(e, 'No pudimos cargar WhatsApp.'));
        this.cargando.set(false);
      },
    });
  }

  cargarResumen(): void {
    if (!this.conectado()) return;
    this.whatsapp.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => undefined });
  }

  ir(k: ClaveSeccion): void {
    const rutas: Record<ClaveSeccion, string> = {
      bandeja: '/whatsapp',
      plantillas: '/whatsapp/plantillas',
      automatico: '/whatsapp/automatizaciones',
      campanas: '/whatsapp/campanas',
    };
    void this.router.navigateByUrl(rutas[k]);
  }
}
