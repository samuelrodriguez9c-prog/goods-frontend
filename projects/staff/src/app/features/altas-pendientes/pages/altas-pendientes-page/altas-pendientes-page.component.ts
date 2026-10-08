import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, interval } from 'rxjs';
import {
  IconArrowRight,
  IconBan,
  IconCalendarEvent,
  IconCalendarPlus,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheckFilled,
  IconClock,
  IconDeviceFloppy,
  IconLink,
  IconMailForward,
  IconPhone,
  IconPhoneOff,
  IconSend,
  IconSortAscending,
  IconSortDescending,
  IconStack2,
  IconUserPlus,
  IconAlertTriangle,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { ModuloCatalogo } from '../../../../core/catalog/models/modulo.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { CabeceraModuloComponent, MetricaCabecera, serieAcumulada } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { ListaHojaComponent } from '../../../../shared/ui/lista-hoja/lista-hoja.component';
import { FilaLista, GrupoLista } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { cuando, dias, fmt, pl, plata } from '../../../../shared/ui/lista-hoja/formato';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';

const UMBRAL = 10;

const GUION: [string, string | null][] = [
  ['Confirmá que hablás con el dueño', 'Nombre completo y si tiene autorización para contratar'],
  ['Repasá el nombre del negocio y el rubro', 'Así aparece en su panel y en sus comprobantes'],
  ['Confirmá el plan y el precio', null],
  ['Preguntá si necesita algún módulo extra', 'Lo marcás en el paso siguiente'],
  ['Contale que le llega un enlace por correo', 'Para definir su contraseña y activar la cuenta'],
];

type Fase = 'preparar' | 'enCurso' | 'confirmar' | 'esperando' | 'activada';
type Grupo = 'llamar' | 'agendadas' | 'esperando' | 'hoy';
type Filtro = 'llamar' | 'atrasadas' | 'agendadas' | 'esperando' | 'activadas';

interface FilaAlta extends Empresa {
  planId: number | null;
  /** La Empresa se activó mientras la pantalla estaba abierta. */
  activadaHoy: boolean;
}

/**
 * Altas pendientes — cola + hoja de la llamada (diseño `Altas pendientes - Cola y llamada`).
 *
 * Reemplaza la lista + `ActivarEmpresaWizardComponent` (modal) por una hoja
 * inline con cinco fases: preparar → llamada en curso → confirmar →
 * esperando al cliente → activada. Mismos endpoints que el wizard:
 * `corregirNombre`, `actualizar`, `cambiarPlan`, `programarLlamada`,
 * `llamadaFinalizada`, `reenviarEnlace`, `rechazar`, y el poll de 30s
 * mientras se espera al cliente.
 */
@Component({
  selector: 'app-altas-pendientes-page',
  standalone: true,
  imports: [DatePipe, TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, ListaHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './altas-pendientes-page.component.html',
  host: { class: 'flex h-full flex-col overflow-hidden px-6 pt-6' },
})
export class AltasPendientesPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly moduloService = inject(ModuloService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lista = viewChild(ListaHojaComponent);
  protected readonly hoy = new Date();
  protected readonly guion = GUION;
  protected readonly plata = plata;
  protected readonly i = {
    modulo: IconUserPlus, arriba: IconChevronUp, abajo: IconChevronDown, telefono: IconPhone, sinTel: IconPhoneOff, agenda: IconCalendarEvent,
    agendar: IconCalendarPlus, x: IconX, reloj: IconClock, plan: IconStack2, check: IconCheck, checkLleno: IconCircleCheckFilled, enviar: IconSend,
    enlace: IconLink, flecha: IconArrowRight, ban: IconBan, guardar: IconDeviceFloppy,
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly cola = signal<FilaAlta[]>([]);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly catalogo = signal<ModuloCatalogo[]>([]);
  protected readonly buscar = signal('');
  protected readonly filtro = signal<Filtro | null>(null);
  protected readonly orden = signal<'urgencia' | 'desc' | 'asc'>('urgencia');
  protected readonly colapsados = signal<ReadonlySet<string>>(new Set());
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly cambiosEnVivo = signal(0);
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;

  // Estado de la hoja (se reinicia al cambiar de Empresa)
  protected readonly fase = signal<Fase>('preparar');
  protected readonly borrador = signal<{ nombre: string; telefono: string } | null>(null);
  protected readonly planPop = signal(false);
  protected readonly agendaAbierta = signal(false);
  protected readonly agendaFecha = signal('');
  protected readonly segundos = signal(0);
  protected readonly guionHecho = signal<ReadonlySet<number>>(new Set());
  protected readonly extras = signal<ReadonlySet<number>>(new Set());
  protected readonly rechazoAbierto = signal(false);
  protected readonly motivoRechazo = signal('');
  private crono?: ReturnType<typeof setInterval>;

  protected readonly sel = computed(() => this.cola().find((x) => x.id === this.seleccionadaId()) ?? null);

  private grupoDe(x: FilaAlta): Grupo {
    if (x.activadaHoy) return 'hoy';
    if (x.estado === 'informacion_corroborada') return 'esperando';
    return x.llamadaProgramadaPara ? 'agendadas' : 'llamar';
  }
  private espera = (x: FilaAlta) => -dias(x.creadoEn);

  private readonly filtradas = computed(() => {
    const term = this.buscar().trim().toLowerCase();
    const F: Record<Filtro, (x: FilaAlta) => boolean> = {
      llamar: (x) => this.grupoDe(x) === 'llamar',
      atrasadas: (x) => this.grupoDe(x) === 'llamar' && this.espera(x) >= UMBRAL,
      agendadas: (x) => this.grupoDe(x) === 'agendadas',
      esperando: (x) => this.grupoDe(x) === 'esperando',
      activadas: (x) => this.grupoDe(x) === 'hoy',
    };
    const f = this.filtro();
    return this.cola().filter(
      (x) => (!f || F[f](x)) && (!term || `${x.nombre} ${x.duenoNombres ?? ''} ${x.duenoApellidos ?? ''} ${x.telefonoContacto ?? ''} ${x.correoContacto}`.toLowerCase().includes(term)),
    );
  });

  protected readonly grupos = computed<GrupoLista[]>(() => {
    const META: Record<Grupo, Omit<GrupoLista, 'clave' | 'sub' | 'filas'>> = {
      llamar: { titulo: 'Te toca llamar', icono: IconPhone, color: '#b45309', fondo: '#fbe7c6' },
      agendadas: { titulo: 'Agendadas', icono: IconCalendarEvent, color: '#00527c', fondo: '#e0f0ff' },
      esperando: { titulo: 'Esperando al cliente', icono: IconMailForward, color: '#0094d5', fondo: '#e0f0ff' },
      hoy: { titulo: 'Activadas hoy', icono: IconCheck, color: '#087b5d', fondo: '#d5f5e3' },
    };
    const o = this.orden();
    const porFecha = (a: FilaAlta, b: FilaAlta) => (o === 'desc' ? -1 : 1) * (a.creadoEn < b.creadoEn ? -1 : 1);
    return (['llamar', 'agendadas', 'esperando', 'hoy'] as Grupo[])
      .map((k): GrupoLista | null => {
        let l = this.filtradas().filter((x) => this.grupoDe(x) === k);
        l = [...l].sort(k === 'agendadas' ? (a, b) => (a.llamadaProgramadaPara! < b.llamadaProgramadaPara! ? -1 : 1) : porFecha);
        // Sin filas no hay subtítulo que calcular (`l[0]`, `Math.max()` de vacío): el grupo se descarta.
        return l.length ? { clave: k, ...META[k], sub: this.subGrupo(k, l), filas: l.map((x) => this.fila(x, k)) } : null;
      })
      .filter((g) => g !== null);
  });

  private subGrupo(k: Grupo, l: FilaAlta[]): string {
    if (k === 'llamar') {
      const at = l.filter((x) => this.espera(x) >= UMBRAL).length;
      return `la más vieja espera ${Math.max(...l.map(this.espera))} días` + (at ? ` · ${pl(at, 'atrasada', 'atrasadas')}` : '');
    }
    if (k === 'agendadas') return `próxima: ${cuando(l[0].llamadaProgramadaPara!)}`;
    if (k === 'esperando') return 'tienen el enlace, falta que confirmen';
    return pl(l.length, 'cliente nuevo', 'clientes nuevos');
  }

  private fila(x: FilaAlta, k: Grupo): FilaLista {
    const plan = this.planes().find((p) => p.id === x.planId)?.nombre ?? 'Sin plan';
    const dueno = [x.duenoNombres, x.duenoApellidos].filter(Boolean).join(' ') || x.correoContacto;
    let gauge: FilaLista['gauge'];
    if (k === 'agendadas') gauge = { texto: cuando(x.llamadaProgramadaPara!).split(' ').slice(-1)[0], ancho: null, color: '', tinta: '#00527c' };
    else if (k === 'hoy') gauge = { texto: 'activa', ancho: null, color: '', tinta: '#087b5d' };
    else {
      const d = this.espera(x);
      const tarde = d >= UMBRAL;
      gauge = { texto: d <= 0 ? 'hoy' : `${d} d`, ancho: Math.min(100, Math.max(6, (d / 14) * 100)), color: k === 'esperando' ? '#0094d5' : tarde ? '#d82c0d' : d >= 5 ? '#b07400' : '#303030', tinta: tarde && k === 'llamar' ? '#d82c0d' : '#374151' };
    }
    const punto = k === 'llamar' ? '#b07400' : k === 'hoy' ? '#087b5d' : '#0094d5';
    return { id: x.id, nombre: x.nombre, sub: `${dueno} · ${plan}`, punto, gauge };
  }

  private readonly nLlamar = computed(() => this.cola().filter((x) => this.grupoDe(x) === 'llamar').length);
  private readonly nAtrasadas = computed(() => this.cola().filter((x) => this.grupoDe(x) === 'llamar' && this.espera(x) >= UMBRAL).length);
  private readonly nEsperando = computed(() => this.cola().filter((x) => this.grupoDe(x) === 'esperando').length);

  protected readonly badge = computed(() => `${this.cola().filter((x) => !x.activadaHoy).length} en cola`);
  protected readonly lectura = computed(() => {
    const llamar = this.cola().filter((x) => this.grupoDe(x) === 'llamar');
    const vieja = Math.max(0, ...llamar.map(this.espera));
    return (
      `Hoy te tocan ${pl(this.nLlamar(), 'llamada', 'llamadas')}` +
      (this.nAtrasadas() ? ` y ${pl(this.nAtrasadas(), 'ya pasó', 'ya pasaron')} los ${UMBRAL} días` : '') +
      `.${llamar.length ? ` La más vieja espera hace ${vieja} días.` : ''} ${pl(this.nEsperando(), 'cliente tiene', 'clientes tienen')} el enlace y falta que confirmen.`
    );
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const fechas = (g: Grupo) => this.cola().filter((x) => this.grupoDe(x) === g).map((x) => x.creadoEn);
    return [
      { id: 'llamar', etiqueta: 'Te toca llamar', valor: this.nLlamar(), tono: 'aviso', trazo: '#b07400', serie: serieAcumulada(fechas('llamar')) },
      { id: 'atrasadas', etiqueta: 'Atrasadas', valor: this.nAtrasadas(), tono: this.nAtrasadas() ? 'peligro' : 'apagado', delta: `+${UMBRAL} días` },
      { id: 'agendadas', etiqueta: 'Agendadas', valor: fechas('agendadas').length, tono: 'info', trazo: '#0094d5' },
      { id: 'esperando', etiqueta: 'Esperando al cliente', valor: this.nEsperando(), tono: 'info', trazo: '#0094d5', serie: serieAcumulada(fechas('esperando')) },
      { id: 'activadas', etiqueta: 'Activadas hoy', valor: fechas('hoy').length, tono: 'exito', trazo: '#064e3b' },
    ];
  });

  protected readonly resultados = computed(() => pl(this.filtradas().length, 'empresa', 'empresas'));
  protected readonly filtroTexto = computed(() =>
    this.filtro() ? { llamar: 'Te toca llamar', atrasadas: 'Atrasadas', agendadas: 'Agendadas', esperando: 'Esperando al cliente', activadas: 'Activadas hoy' }[this.filtro()!] : null,
  );
  protected readonly ordenIcono = computed(() => (this.orden() === 'urgencia' ? IconAlertTriangle : this.orden() === 'desc' ? IconSortDescending : IconSortAscending));
  protected readonly ordenTitulo = computed(() => (this.orden() === 'urgencia' ? 'Por urgencia' : this.orden() === 'desc' ? 'Más recientes' : 'Más antiguas'));

  constructor() {
    this.cargar();
    // `/altas-pendientes?empresa=N`: "Llamar y verificar datos" de la ficha de Empresas.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((q) => this.abrirDesdeEnlace(Number(q.get('empresa'))));
    inject(CambiosEnVivoService)
      .huboCambio(['empresa', 'suscripcion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
    // Mientras hay alguien esperando, se mira cada 30 s si ya se activó.
    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.nEsperando() && this.cargar(true));
    this.destroyRef.onDestroy(() => clearInterval(this.crono));
  }

  protected cargar(silencioso = false): void {
    if (!silencioso) this.cargando.set(this.cola().length === 0);
    this.error.set(null);
    forkJoin({
      // Todas las páginas (2026-10-07): antes se cortaba en 100.
      pendientes: traerTodo((page) => this.empresaService.listar({ estado: 'pendiente', page })),
      esperando: traerTodo((page) => this.empresaService.listar({ estado: 'informacion_corroborada', page })),
      suscripciones: traerTodo((page) => this.suscripcionService.listar('pendiente', undefined, page)),
      planes: this.planService.listarTodos(),
      catalogo: this.moduloService.listarCatalogo(),
    }).subscribe({
      next: ({ pendientes, esperando, suscripciones, planes, catalogo }) => {
        const planDe = new Map(suscripciones.data.map((s) => [s.empresaId, s.planId]));
        const antes = this.cola();
        const nuevas: FilaAlta[] = [...pendientes.data, ...esperando.data].map((e) => ({ ...e, planId: planDe.get(e.id) ?? null, activadaHoy: false }));
        // Las que estaban esperando y ya no vienen: se activaron.
        const activadas = antes.filter((x) => (x.estado === 'informacion_corroborada' || x.activadaHoy) && !nuevas.some((n) => n.id === x.id)).map((x) => ({ ...x, activadaHoy: true }));
        if (activadas.some((x) => x.id === this.seleccionadaId()) && this.fase() === 'esperando') this.fase.set('activada');
        if (this.compararAlCargar) {
          this.compararAlCargar = false;
          this.resaltadas.set(filasCambiadas(antes, nuevas, (e) => e.id));
          setTimeout(() => this.resaltadas.set(new Set()), 2000);
        }
        this.cola.set([...nuevas, ...activadas]);
        this.planes.set(planes.data.filter((p) => p.activo));
        this.catalogo.set(catalogo);
        this.resolverEnlace();
        if (!this.sel()) this.seleccionar(this.grupos()[0]?.filas[0]?.id ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la cola de altas.');
        this.cargando.set(false);
      },
    });
  }

  /** Id pedido por enlace, hasta que la cola llega y se puede ubicar. */
  private enlaceId: number | null = null;

  private abrirDesdeEnlace(id: number): void {
    if (!id) return;
    this.enlaceId = id;
    // Si la cola ya está cargada se resuelve ya; si no, lo hace `cargar()` al llegar.
    if (!this.cargando() && this.cola().length) this.resolverEnlace();
    void this.router.navigate([], { queryParams: { empresa: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Elige el negocio del enlace y despliega su grupo. Si ya no está en la cola, avisa. */
  private resolverEnlace(): void {
    const id = this.enlaceId;
    if (!id) return;
    this.enlaceId = null;
    if (!this.cola().some((x) => x.id === id)) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Ese negocio ya no está en Altas pendientes', texto: 'Puede que ya se haya activado o rechazado.' });
      return;
    }
    const g = this.grupos().find((x) => x.filas.some((f) => f.id === id));
    if (g) this.colapsados.update((c) => { const n = new Set(c); n.delete(g.clave); return n; });
    this.seleccionar(id);
  }

  protected actualizar(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }

  protected seleccionar(id: number | null): void {
    if (id === this.seleccionadaId()) return;
    this.seleccionadaId.set(id);
    const x = this.sel();
    this.fase.set(!x ? 'preparar' : x.activadaHoy ? 'activada' : x.estado === 'informacion_corroborada' ? 'esperando' : 'preparar');
    this.borrador.set(null);
    this.planPop.set(false);
    this.agendaAbierta.set(false);
    this.rechazoAbierto.set(false);
    this.motivoRechazo.set('');
    this.guionHecho.set(new Set());
    this.extras.set(new Set(this.pedidos().map((m) => m.id)));
    this.pararCrono();
  }

  protected alternarMetrica(id: string): void {
    this.filtro.update((f) => (f === id ? null : (id as Filtro)));
  }
  protected alternarGrupo(c: string): void {
    this.colapsados.update((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'urgencia' ? 'desc' : o === 'desc' ? 'asc' : 'urgencia'));
  }
  protected limpiar(): void {
    this.filtro.set(null);
    this.buscar.set('');
  }

  /** "Llamar a la siguiente": la más vieja sin agenda. */
  protected llamarSiguiente(): void {
    const x = [...this.cola()].filter((y) => this.grupoDe(y) === 'llamar').sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1))[0];
    if (!x) {
      this.alertas.mostrar({ estado: 'info', titulo: 'No queda nadie para llamar' });
      return;
    }
    this.seleccionar(x.id);
  }
  protected readonly haySiguiente = computed(() => this.nLlamar() > 0);

  protected siguienteCola(): void {
    const filas = this.grupos().flatMap((g) => g.filas).filter((f) => f.id !== this.seleccionadaId());
    const prox = filas.find((f) => this.grupoDe(this.cola().find((x) => x.id === f.id)!) === 'llamar') ?? filas[0];
    if (prox) this.seleccionar(prox.id);
  }

  // ── Hoja ──────────────────────────────────────────────────────────────

  protected readonly plan = computed(() => this.planes().find((p) => p.id === this.sel()?.planId) ?? null);
  protected readonly dueno = computed(() => {
    const x = this.sel();
    return x ? [x.duenoNombres, x.duenoApellidos].filter(Boolean).join(' ') || 'Sin nombre' : '';
  });
  protected readonly telefono = computed(() => this.borrador()?.telefono ?? this.sel()?.telefonoContacto ?? '');

  protected readonly etapas = computed(() => {
    const orden: Fase[] = ['preparar', 'enCurso', 'confirmar', 'esperando', 'activada'];
    const textos = ['Preparar', 'Llamada', 'Confirmar', 'Esperando', 'Activa'];
    const k = orden.indexOf(this.fase());
    return textos.map((texto, j) => ({ texto, estado: j < k ? 'hecho' : j === k ? 'actual' : 'futuro' }));
  });

  /** Botón principal de la cabecera de la hoja, según la fase. */
  protected readonly accion = computed<{ texto: string; icono: typeof IconPhone; ejecutar: () => void } | null>(() => {
    switch (this.fase()) {
      case 'preparar': return { texto: 'Llamar ahora', icono: IconPhone, ejecutar: () => this.llamar() };
      case 'enCurso': return { texto: 'Terminé la llamada', icono: IconCheck, ejecutar: () => { this.pararCrono(false); this.fase.set('confirmar'); } };
      case 'esperando': return { texto: 'Reenviar enlace', icono: IconSend, ejecutar: () => this.reenviar() };
      default: return null;
    }
  });

  protected readonly campos = computed(() => {
    const x = this.sel();
    if (!x) return [];
    const b = this.borrador();
    return [
      { clave: 'nombre' as const, etiqueta: 'Nombre del negocio', valor: b?.nombre ?? x.nombre, ph: 'Nombre', cambiado: !!b && b.nombre !== x.nombre },
      { clave: 'telefono' as const, etiqueta: 'Teléfono', valor: b?.telefono ?? x.telefonoContacto ?? '', ph: '+57 300 000 0000', cambiado: !!b && b.telefono !== (x.telefonoContacto ?? '') },
    ];
  });
  protected readonly nCambios = computed(() => this.campos().filter((c) => c.cambiado).length);

  protected editar(clave: 'nombre' | 'telefono', valor: string): void {
    const x = this.sel()!;
    this.borrador.update((b) => ({ ...(b ?? { nombre: x.nombre, telefono: x.telefonoContacto ?? '' }), [clave]: valor }));
  }

  protected guardar(): void {
    const x = this.sel();
    const b = this.borrador();
    if (!x || !b) return;
    const pedidos = [];
    if (b.nombre.trim() !== x.nombre) pedidos.push(this.empresaService.corregirNombre(x.id, b.nombre.trim()));
    if (b.telefono.trim() !== (x.telefonoContacto ?? '')) pedidos.push(this.empresaService.actualizar(x.id, { telefonoContacto: b.telefono.trim() || undefined }));
    this.alertas
      .seguir(forkJoin(pedidos), {
        titulo: 'Guardando cambios', texto: x.nombre,
        exito: { titulo: 'Datos corroborados', texto: pl(pedidos.length, 'dato actualizado', 'datos actualizados') },
        error: { titulo: 'No se pudo guardar', texto: 'Revisá los datos.' },
      })
      .subscribe({
        next: () => {
          this.cola.update((xs) => xs.map((y) => (y.id === x.id ? { ...y, nombre: b.nombre.trim(), telefonoContacto: b.telefono.trim() || null } : y)));
          this.borrador.set(null);
        },
        error: () => undefined,
      });
  }

  protected elegirPlan(p: Plan): void {
    const x = this.sel()!;
    this.planPop.set(false);
    if (p.id === x.planId) return;
    this.alertas
      .seguir(this.suscripcionService.cambiarPlan(x.id, p.id), {
        titulo: 'Cambiando el plan', texto: `${x.nombre} → ${p.nombre}`,
        exito: { titulo: 'Plan actualizado', texto: `Arranca con ${p.nombre}.` },
        error: { titulo: 'No se pudo cambiar el plan', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => this.cola.update((xs) => xs.map((y) => (y.id === x.id ? { ...y, planId: p.id } : y))), error: () => undefined });
  }

  // Llamada
  protected llamar(): void {
    const tel = this.telefono();
    if (tel) window.open(`tel:${tel.replace(/\s/g, '')}`, '_self');
    this.fase.set('enCurso');
    this.segundos.set(0);
    clearInterval(this.crono);
    this.crono = setInterval(() => this.segundos.update((s) => s + 1), 1000);
  }
  private pararCrono(reset = true): void {
    clearInterval(this.crono);
    if (reset) this.segundos.set(0);
  }
  protected readonly cronoTexto = computed(() => {
    const s = this.segundos();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  protected alternarGuion(k: number): void {
    this.guionHecho.update((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  protected readonly atajosAgenda = computed(() => {
    const at = (offset: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, 0, 0, 0); return d; };
    const opciones = [at(0, 16), at(1, 10), at(1, 16), at(2, 10)].filter((d) => d.getTime() > Date.now());
    return opciones.map((d) => ({ texto: cuando(d.toISOString()), valor: toLocalInput(d) }));
  });

  protected agendar(): void {
    const x = this.sel()!;
    const f = this.agendaFecha();
    if (!f) return;
    const iso = new Date(f).toISOString();
    this.agendaAbierta.set(false);
    this.alertas
      .seguir(this.empresaService.programarLlamada(x.id, iso), {
        titulo: 'Agendando la llamada', texto: x.nombre,
        exito: { titulo: 'Llamada agendada', texto: cuando(iso) },
        error: { titulo: 'No se pudo agendar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => this.cola.update((xs) => xs.map((y) => (y.id === x.id ? { ...y, llamadaProgramadaPara: iso } : y))), error: () => undefined });
  }

  /** Lo que pidió en el checkout + lo que ya trae el plan. */
  protected readonly pedidos = computed(() => {
    const cods = this.sel()?.modulosSolicitados ?? [];
    return this.catalogo().filter((m) => cods.includes(m.codigo));
  });
  private readonly delPlan = computed(() => new Set((this.plan()?.modulos ?? []).map((m) => m.codigo)));
  protected readonly extrasPosibles = computed(() =>
    this.catalogo()
      .filter((m) => !this.delPlan().has(m.codigo))
      .map((m) => ({ ...m, pedido: this.pedidos().some((p) => p.id === m.id), elegido: this.extras().has(m.id) })),
  );
  protected alternarExtra(id: number): void {
    this.extras.update((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  protected readonly checklist = computed(() => {
    const x = this.sel();
    const hecho = [...this.guionHecho()].sort().map((k) => GUION[k][0]);
    return hecho.length ? hecho : [`Datos de ${x?.nombre ?? ''} corroborados`];
  });

  protected readonly consecuencias = computed(() => {
    const x = this.sel();
    const n = this.extrasPosibles().filter((m) => m.elegido);
    return [
      `Se crea la cuenta de ${this.dueno()} con plan ${this.plan()?.nombre ?? '—'}${this.plan()?.precioMensual ? ` (${plata(this.plan()!.precioMensual!)}/mes)` : ''}.`,
      n.length ? `Queda con ${pl(n.length, 'extra', 'extras')}: ${n.map((m) => m.nombre).join(', ')}.` : 'Sin módulos extra.',
      `Le llega el enlace a ${x?.duenoCorreo ?? x?.correoContacto ?? ''} para definir su contraseña.`,
    ];
  });

  protected confirmarLlamada(): void {
    const x = this.sel()!;
    const modulos = [...this.extras()].map((moduloId) => ({ moduloId, tipo: 'concedido' as const }));
    this.alertas
      .seguir(this.empresaService.llamadaFinalizada(x.id, modulos.length ? modulos : undefined), {
        titulo: 'Confirmando la llamada', texto: x.nombre,
        exito: { titulo: 'Enlace enviado', texto: `${x.nombre} pasa a esperar al cliente.` },
        error: { titulo: 'No se pudo confirmar', texto: 'No se cambió nada. Intentá de nuevo.' },
      })
      .subscribe({
        next: (e) => {
          this.cola.update((xs) => xs.map((y) => (y.id === x.id ? { ...y, ...e, estado: 'informacion_corroborada' } : y)));
          this.fase.set('esperando');
        },
        error: () => undefined,
      });
  }

  protected readonly espera2 = computed(() => {
    const x = this.sel();
    const desde = x?.estadoCambiadoEn ?? x?.actualizadoEn;
    return {
      detalle: `Le mandamos el enlace a ${x?.duenoCorreo ?? x?.correoContacto}${desde ? ` el ${fmt(desde)}` : ''}.`,
      hitos: [
        { texto: 'Llamada hecha', nota: desde ? fmt(desde) : '', hecho: true },
        { texto: 'Enlace enviado', nota: x?.duenoCorreo ?? '', hecho: true },
        { texto: 'Abre el enlace y define su contraseña', nota: 'lo hace el cliente', hecho: false },
        { texto: 'La Empresa queda activa', nota: 'sale sola de la cola', hecho: false },
      ],
    };
  });

  protected reenviar(): void {
    const x = this.sel()!;
    this.alertas
      .seguir(this.empresaService.reenviarEnlace(x.id), {
        titulo: 'Reenviando el enlace', texto: x.nombre,
        exito: { titulo: 'Enlace reenviado', texto: x.duenoCorreo ?? x.correoContacto },
        error: { titulo: 'No se pudo reenviar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ error: () => undefined });
  }

  protected rechazar(): void {
    const x = this.sel()!;
    const motivo = this.motivoRechazo().trim();
    if (!motivo) return;
    this.rechazoAbierto.set(false);
    this.alertas
      .seguir(this.empresaService.rechazar(x.id, motivo), {
        titulo: 'Rechazando la solicitud', texto: x.nombre,
        exito: { titulo: 'Solicitud rechazada', texto: `${x.nombre} queda en Empresas como rechazada.` },
        error: { titulo: 'No se pudo rechazar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.siguienteCola();
          this.cola.update((xs) => xs.filter((y) => y.id !== x.id));
        },
        error: () => undefined,
      });
  }

  protected volver(): void {
    this.router.navigateByUrl('/altas-pendientes');
  }
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
