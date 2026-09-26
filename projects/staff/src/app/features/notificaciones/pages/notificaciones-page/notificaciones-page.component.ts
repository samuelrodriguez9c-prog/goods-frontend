// projects/staff/src/app/features/notificaciones/pages/notificaciones-page/notificaciones-page.component.ts
import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconArrowRight,
  IconBellCheck,
  IconBellRinging,
  IconChecks,
  IconChevronDown,
  IconSearch,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Notificacion } from '../../../../core/notificaciones/models/notificacion.model';
import { NotificacionService } from '../../../../core/notificaciones/notificacion.service';
import {
  CATEGORIAS,
  CategoriaNotificacion,
  agruparPorDia,
  defTipo,
  filaNotificacion,
  tituloDia,
} from '../../../../core/notificaciones/notificacion-catalogo';
import { PistaService } from '../../../../core/ui/pista.service';
import { CabeceraModuloComponent, MetricaCabecera, serieConteo } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

type Cat = Exclude<CategoriaNotificacion, 'otras'>;
const PAGE_SIZE = 30;

/**
 * "Ver todas" — rediseño (LEEME §17, 2026-09-24). Carga por páginas y va
 * ACUMULANDO ("Cargar anteriores") en vez de paginar con anterior/
 * siguiente. Filtros: métrica de la cabecera (Sin leer / categoría),
 * selector Todas · Sin leer y búsqueda, todo en el cliente sobre lo
 * cargado (ver el punto 3 de "A revisar al integrar" del LEEME).
 */
@Component({
  selector: 'app-notificaciones-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent],
  templateUrl: './notificaciones-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesPageComponent {
  private readonly notificacionService = inject(NotificacionService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly pista = inject(PistaService);

  protected readonly i = {
    modulo: IconBellRinging,
    marcarTodas: IconChecks,
    buscar: IconSearch,
    x: IconX,
    flecha: IconArrowRight,
    mas: IconChevronDown,
    vacio: IconBellCheck,
  };

  protected readonly notificaciones = signal<Notificacion[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPaginas = signal(1);
  protected readonly total = signal(0);
  protected readonly soloNoLeidas = signal(false);
  protected readonly categoria = signal<Cat | null>(null);
  protected readonly busqueda = signal('');

  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly noLeidas = computed(() => this.notificaciones().filter((n) => !n.leidaEn));

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const todas = this.notificaciones();
    const hoy = todas.filter((n) => tituloDia(n.creadoEn) === 'Hoy').length;
    const cats: Cat[] = ['soporte', 'empresas', 'suscripciones'];
    return [
      {
        id: 'sin_leer',
        etiqueta: 'Sin leer',
        valor: this.noLeidas().length,
        delta: hoy ? `${hoy} hoy` : null,
        deltaTono: 'info',
        trazo: '#00a39b',
        serie: serieConteo(this.noLeidas().map((n) => n.creadoEn), 8, 24),
      },
      ...cats.map((c) => {
        const lista = todas.filter((n) => defTipo(n.tipo).cat === c);
        const nl = lista.filter((n) => !n.leidaEn).length;
        return {
          id: c,
          etiqueta: CATEGORIAS[c].texto,
          valor: lista.length,
          delta: nl ? `${nl} sin leer` : 'al día',
          trazo: CATEGORIAS[c].trazo,
          serie: serieConteo(lista.map((n) => n.creadoEn), 8, 24),
        } satisfies MetricaCabecera;
      }),
    ];
  });

  protected readonly metricaActiva = computed(() => this.categoria() ?? (this.soloNoLeidas() ? 'sin_leer' : null));

  protected readonly accionables = computed(
    () => this.noLeidas().filter((n) => defTipo(n.tipo).accionable).length,
  );

  protected readonly grupos = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const cat = this.categoria();
    const filas = this.notificaciones()
      .filter((n) => (!this.soloNoLeidas() || !n.leidaEn) && (!cat || defTipo(n.tipo).cat === cat))
      .filter((n) => !q || `${n.titulo} ${n.cuerpo}`.toLowerCase().includes(q))
      .map((n) => filaNotificacion(n));
    return agruparPorDia(filas);
  });

  protected readonly hayMas = computed(() => this.page() < this.totalPaginas());

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.page.set(1);
    this.pedir(1, false);
  }

  protected cargarAnteriores(): void {
    if (!this.hayMas() || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    this.pedir(this.page() + 1, true);
  }

  private pedir(page: number, acumular: boolean): void {
    // Filtros en el cliente sobre lo cargado: así cambiar de pestaña o de
    // métrica no vuelve a pedir nada (ver LEEME §17, punto 3).
    this.notificacionService.listar(false, PAGE_SIZE, page, true).subscribe({
      next: (r) => {
        this.notificaciones.update((a) => (acumular ? [...a, ...r.data] : r.data));
        this.page.set(page);
        this.totalPaginas.set(Math.max(1, r.totalPaginas));
        this.total.set(r.total);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: () => {
        if (!acumular) this.error.set('No se pudieron cargar las notificaciones. Intentá de nuevo.');
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  protected seleccionarMetrica(id: string): void {
    if (id === 'sin_leer') {
      const activo = this.metricaActiva() === 'sin_leer';
      this.categoria.set(null);
      this.soloNoLeidas.set(!activo);
    } else {
      const c = id as Cat;
      const activo = this.categoria() === c;
      this.categoria.set(activo ? null : c);
      if (!activo) this.pista.filtro(CATEGORIAS[c].texto, () => this.categoria.set(null));
    }
  }

  protected alternar(n: Notificacion): void {
    const leida = !n.leidaEn;
    const antes = n.leidaEn;
    this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: leida ? new Date().toISOString() : null } : x)));
    (leida ? this.notificacionService.marcarLeida(n.id) : this.notificacionService.marcarNoLeida(n.id)).subscribe({
      error: () => this.notificaciones.update((a) => a.map((x) => (x.id === n.id ? { ...x, leidaEn: antes } : x))),
    });
  }

  protected abrir(f: ReturnType<typeof filaNotificacion>): void {
    if (!f.leida) this.alternar(f.n);
    this.pista.navegar(f.destino.destino);
    this.router.navigate([f.destino.url], { queryParams: f.destino.query });
  }

  protected marcarTodas(): void {
    const n = this.noLeidas().length;
    if (!n) return;
    const antes = this.notificaciones();
    const ahora = new Date().toISOString();
    this.notificaciones.update((a) => a.map((x) => (x.leidaEn ? x : { ...x, leidaEn: ahora })));
    this.notificacionService.marcarTodasLeidas().subscribe({ error: () => this.notificaciones.set(antes) });
    this.pista.hecho(`${n} ${n === 1 ? 'marcada' : 'marcadas'} como ${n === 1 ? 'leída' : 'leídas'}`);
  }

  protected horaCorta(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  protected fechaLarga(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
  }

  protected volver(): void {
    this.location.back();
  }
}
