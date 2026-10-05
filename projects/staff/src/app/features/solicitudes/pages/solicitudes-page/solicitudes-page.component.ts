import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IconBulb,
  IconChevronLeft,
  IconChevronRight,
  IconMessageCircle,
  IconSearch,
  IconUser,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { StatusBadgeComponent } from 'shared-ui';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { formatFecha } from '../../../../core/facturacion/facturacion.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import {
  ESTADO_SOLICITUD,
  EstadoSolicitud,
  FiltroSolicitudes,
  ListadoSolicitudes,
  ResumenSolicitudes,
  TIPO_SOLICITUD,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { SolicitudesService } from '../../../../core/solicitudes/solicitudes.service';
import { AvisoDatosNuevosComponent } from '../../../../shared/ui/aviso-datos-nuevos/aviso-datos-nuevos.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { SolicitudDetallePanelComponent } from '../solicitud-detalle-panel/solicitud-detalle-panel.component';

type Vista = 'abiertas' | 'recibida' | 'en_evaluacion' | 'en_desarrollo' | 'mias' | 'cerradas';

const VISTAS: { clave: Vista; texto: string }[] = [
  { clave: 'abiertas', texto: 'Abiertas' },
  { clave: 'recibida', texto: 'Por revisar' },
  { clave: 'en_evaluacion', texto: 'En evaluación' },
  { clave: 'en_desarrollo', texto: 'En desarrollo' },
  { clave: 'mias', texto: 'Asignadas a mí' },
  { clave: 'cerradas', texto: 'Cerradas' },
];

const PAGE_SIZE = 20;
const DIA_MS = 86_400_000;

/**
 * Solicitudes de personalización (2026-10-04) — lo que las Empresas le
 * piden a Goods: módulos nuevos, ajustes, campos propios. Ver
 * PROPUESTA_PERSONALIZACION_POR_EMPRESA.md y `SolicitudService` del
 * backend. La lista ordena lo que espera una acción de Goods primero; el
 * detalle (panel lateral) tiene el historial, los comentarios (internos o
 * visibles para el cliente) y las acciones de cada estado.
 */
@Component({
  selector: 'app-solicitudes-page',
  standalone: true,
  imports: [
    FormsModule,
    TablerIconComponent,
    StatusBadgeComponent,
    CabeceraModuloComponent,
    PantallaEstadoComponent,
    AvisoDatosNuevosComponent,
    SolicitudDetallePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitudes-page.component.html',
})
export class SolicitudesPageComponent {
  private readonly solicitudes = inject(SolicitudesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cambiosEnVivoService = inject(CambiosEnVivoService);

  protected readonly i = {
    modulo: IconBulb, buscar: IconSearch, limpiar: IconX, anterior: IconChevronLeft,
    siguiente: IconChevronRight, comentario: IconMessageCircle, persona: IconUser,
  };
  protected readonly vistas = VISTAS;
  protected readonly tipos = Object.entries(TIPO_SOLICITUD).map(([valor, t]) => ({ valor: valor as TipoSolicitud, texto: t.texto }));
  protected readonly estadoInfo = ESTADO_SOLICITUD;
  protected readonly tipoInfo = TIPO_SOLICITUD;
  protected readonly skeletons = [0, 1, 2, 3, 4];

  protected readonly puedeGestionar = computed(() =>
    (this.auth.currentUser()?.permisos ?? []).includes('solicitudes.gestionar'),
  );

  protected readonly cargando = signal(true);
  protected readonly cargandoLista = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly resumen = signal<ResumenSolicitudes | null>(null);
  protected readonly listado = signal<ListadoSolicitudes | null>(null);
  protected readonly vista = signal<Vista>('abiertas');
  protected readonly tipo = signal<TipoSolicitud | ''>('');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  private readonly buscar$ = new Subject<string>();

  protected readonly abiertaId = signal<number | null>(null);
  protected readonly cambiosEnVivo = signal(0);
  private ignorarCambiosHasta = 0;

  protected readonly filas = computed(() =>
    (this.listado()?.data ?? []).map((s) => {
      const dias = Math.floor((Date.now() - new Date(s.creadoEn).getTime()) / DIA_MS);
      return {
        ...s,
        estadoTexto: ESTADO_SOLICITUD[s.estado].texto,
        estadoTono: ESTADO_SOLICITUD[s.estado].tono,
        tipoTexto: TIPO_SOLICITUD[s.tipo].texto,
        espera: s.estado === 'recibida' ? (dias === 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`) : null,
        esperaLarga: s.estado === 'recibida' && dias >= 3,
        actividad: formatFecha(s.actualizadoEn),
        fechaCompromisoTexto: s.fechaCompromiso ? formatFecha(s.fechaCompromiso + 'T12:00:00') : '',
      };
    }),
  );

  protected readonly rango = computed(() => {
    const l = this.listado();
    if (!l || !l.total) return '';
    const desde = (l.page - 1) * l.pageSize + 1;
    return `${desde}–${Math.min(l.page * l.pageSize, l.total)} de ${l.total}`;
  });

  protected readonly hayFiltros = computed(() => this.vista() !== 'abiertas' || !!this.tipo() || !!this.buscar().trim());

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    const recibidas = r.porEstado.recibida;
    return [
      {
        id: 'recibida',
        etiqueta: 'Por revisar',
        valor: recibidas,
        tono: recibidas ? (r.esperaMaximaDias >= 3 ? 'peligro' : 'aviso') : 'apagado',
        delta: recibidas
          ? r.esperaMaximaDias
            ? `la más vieja, hace ${r.esperaMaximaDias} ${r.esperaMaximaDias === 1 ? 'día' : 'días'}`
            : recibidas === 1 ? 'llegó hoy' : 'llegaron hoy'
          : 'nada esperando',
        deltaTono: r.esperaMaximaDias >= 3 ? 'peligro' : 'apagado',
        titulo: 'Solicitudes nuevas que todavía nadie tomó',
      },
      {
        id: 'en_evaluacion',
        etiqueta: 'En evaluación',
        valor: r.porEstado.en_evaluacion,
        tono: r.porEstado.en_evaluacion ? 'info' : 'apagado',
        delta: r.porEstado.aprobada ? `${r.porEstado.aprobada} aprobada${r.porEstado.aprobada === 1 ? '' : 's'} sin arrancar` : null,
        titulo: 'Tomadas por alguien de Goods, pendientes de decisión',
      },
      {
        id: 'en_desarrollo',
        etiqueta: 'En desarrollo',
        valor: r.porEstado.en_desarrollo,
        tono: r.porEstado.en_desarrollo ? 'info' : 'apagado',
        titulo: 'Aprobadas que se están construyendo',
      },
      {
        id: 'entregadas',
        etiqueta: 'Entregadas este mes',
        valor: r.entregadasMes,
        tono: r.entregadasMes ? 'exito' : 'apagado',
        titulo: 'Solicitudes entregadas desde el primero del mes',
      },
      {
        id: 'sinAsignar',
        etiqueta: 'Sin asignar',
        valor: r.sinAsignar,
        tono: r.sinAsignar ? 'aviso' : 'apagado',
        delta: r.sinAsignar ? 'abiertas sin responsable' : null,
        deltaTono: 'aviso',
      },
    ];
  });

  protected readonly badge = computed(() => {
    const r = this.resumen();
    return r ? `${r.abiertas} ${r.abiertas === 1 ? 'abierta' : 'abiertas'}` : '';
  });

  protected readonly lectura = computed(() => {
    const r = this.resumen();
    if (!r) return '';
    if (!r.abiertas) return 'No hay solicitudes abiertas. Lo que pidan las Empresas desde su panel aparece acá.';
    const partes: string[] = [];
    if (r.porEstado.recibida) partes.push(`${r.porEstado.recibida} esperando que alguien la${r.porEstado.recibida === 1 ? '' : 's'} tome`);
    if (r.porEstado.en_evaluacion) partes.push(`${r.porEstado.en_evaluacion} en evaluación`);
    if (r.porEstado.en_desarrollo) partes.push(`${r.porEstado.en_desarrollo} en desarrollo`);
    return `${partes.join(', ')}. Lo que piden varias Empresas va primero; lo exclusivo se cobra aparte y con fecha comprometida.`;
  });

  constructor() {
    this.cargar();
    this.buscar$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.irAPagina(1));
    // Abrir directo una solicitud (ej. desde una notificación): /solicitudes?id=12
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const id = Number(q.get('id'));
      if (id) this.abiertaId.set(id);
    });
    this.cambiosEnVivoService
      .huboCambio(['solicitud', 'missolicitudes'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (Date.now() > this.ignorarCambiosHasta) this.cambiosEnVivo.update((n) => n + 1);
      });
  }

  protected cargar(): void {
    this.cargando.set(!this.listado());
    this.error.set(null);
    forkJoin({ resumen: this.solicitudes.resumen(), listado: this.solicitudes.listar(this.filtro()) }).subscribe({
      next: ({ resumen, listado }) => {
        this.resumen.set(resumen);
        this.listado.set(listado);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las solicitudes.');
        this.cargando.set(false);
      },
    });
  }

  private cargarLista(): void {
    this.cargandoLista.set(true);
    this.solicitudes.listar(this.filtro()).subscribe({
      next: (l) => {
        this.listado.set(l);
        this.cargandoLista.set(false);
      },
      error: () => this.cargandoLista.set(false),
    });
  }

  private filtro(): FiltroSolicitudes {
    const v = this.vista();
    const base: FiltroSolicitudes = {
      page: this.pagina(),
      pageSize: PAGE_SIZE,
      tipo: this.tipo() || undefined,
      buscar: this.buscar().trim() || undefined,
    };
    if (v === 'abiertas') return { ...base, grupo: 'abiertas' };
    if (v === 'cerradas') return { ...base, grupo: 'cerradas' };
    if (v === 'mias') return { ...base, grupo: 'abiertas', asignadaA: this.auth.currentUser()?.id };
    return { ...base, estado: v as EstadoSolicitud };
  }

  protected elegirVista(v: Vista): void {
    this.vista.set(v);
    this.irAPagina(1);
  }

  protected elegirTipo(t: TipoSolicitud | ''): void {
    this.tipo.set(t);
    this.irAPagina(1);
  }

  protected escribirBusqueda(texto: string): void {
    this.buscar.set(texto);
    this.buscar$.next(texto);
  }

  protected limpiarFiltros(): void {
    this.vista.set('abiertas');
    this.tipo.set('');
    this.buscar.set('');
    this.irAPagina(1);
  }

  protected irAPagina(n: number): void {
    this.pagina.set(n);
    this.cargarLista();
  }

  protected metricaClick(id: string): void {
    if (id === 'recibida' || id === 'en_evaluacion' || id === 'en_desarrollo') this.elegirVista(id);
    else if (id === 'entregadas') this.elegirVista('cerradas');
    else this.elegirVista('abiertas');
  }

  protected abrir(id: number): void {
    this.abiertaId.set(id);
  }

  protected cerrarPanel(): void {
    this.abiertaId.set(null);
    if (this.route.snapshot.queryParamMap.get('id')) {
      this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected silenciarEco(): void {
    this.ignorarCambiosHasta = Date.now() + 15_000;
  }

  protected onCambio(): void {
    this.ignorarCambiosHasta = Date.now() + 3000;
    this.cargar();
  }

  protected actualizarPorCambioEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.cargar();
  }

  protected volver(): void {
    this.router.navigateByUrl('/');
  }
}
