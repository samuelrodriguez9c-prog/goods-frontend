import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconAlertTriangle,
  IconBan,
  IconBuildingStore,
  IconChevronRight,
  IconCircleOff,
  IconCode,
  IconExchange,
  IconHistory,
  IconLockOff,
  IconLogin,
  IconMoon,
  IconPencil,
  IconPhoneCheck,
  IconPlus,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconTerminal2,
  IconUserMinus,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';
import { AuditoriaService } from '../../../../core/auditoria/auditoria.service';
import { AuditoriaAccion } from '../../../../core/auditoria/models/auditoria-accion.model';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { AvisoDatosNuevosComponent } from '../../../../shared/ui/aviso-datos-nuevos/aviso-datos-nuevos.component';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { AccionDetallePanelComponent } from '../accion-detalle-panel/accion-detalle-panel.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
  serieAcumulada,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';

type LenteAuditoria = 'todo' | 'fallidas' | 'sensibles' | 'agente' | 'anonimas';
export type FamiliaAccion = 'sesion' | 'alta' | 'edicion' | 'plata' | 'permisos' | 'baja';

/** Acción de auditoría con los campos derivados para mostrarla. También la
 * usa `AccionDetallePanelComponent`, que recibe la lista ya calculada. */
export interface AccionLeible extends AuditoriaAccion {
  /** La ruta HTTP traducida a lo que pasó (ver `REGLAS`). */
  frase: string;
  icono: typeof IconPencil;
  familia: FamiliaAccion;
  /** Etiqueta legible del `userAgent` + si es un navegador de verdad. */
  agenteEtiqueta: string;
  agenteEsNavegador: boolean;
  /** Fuera de la franja `HORA_DESDE`–`HORA_HASTA`. */
  fueraDeHora: boolean;
  horaNum: number;
  fechaMs: number;
  /** Fecha y hora completa para el encabezado del detalle (ej. "21 sept 2026, 14:32"). */
  cuando: string;
  /** Clases de caja (fondo + tinta) del ícono; misma fórmula que `aFila()`. */
  caja: string;
  /** Nombre de `usuarioId`, o `null` si la acción es anónima; cada lugar
   * que lo usa pone su propio texto de reemplazo. */
  nombreResuelto: string | null;
}

/** Fila ya armada de la bitácora. */
interface FilaAuditoria {
  id: number;
  hora: string;
  icono: typeof IconPencil;
  caja: string;
  frase: string;
  exitoso: boolean;
  contexto: string;
  marca: { texto: string; icono: typeof IconX; caja: string } | null;
}

/** Reglas ruta → frase. Agrega una entrada por cada endpoint de escritura
 * nuevo; si ninguna coincide se muestra `METODO /ruta`. Las regex van
 * ancladas a `/api/...` porque el interceptor del backend guarda
 * `request.originalUrl`, que incluye el prefijo global. */
const REGLAS: {
  re: RegExp;
  frase: (a: AuditoriaAccion, m: RegExpMatchArray) => string;
  icono: (a: AuditoriaAccion) => typeof IconPencil;
  familia: (a: AuditoriaAccion) => FamiliaAccion;
}[] = [
  {
    // `staff` inicia sesión por `/auth/login-staff` y `admin` por `/auth/login`.
    re: /^\/api\/auth\/login(-staff)?$/,
    frase: (a) => (a.exitoso ? 'Inició sesión' : 'Intento de inicio de sesión fallido'),
    icono: (a) => (a.exitoso ? IconLogin : IconLockOff),
    familia: () => 'sesion',
  },
  {
    re: /^\/api\/registro-publico$/,
    frase: (a) => `Se registró “${(a.cuerpo as { nombre?: string } | null)?.nombre ?? 'una Empresa'}” desde el sitio público`,
    icono: () => IconBuildingStore,
    familia: () => 'alta',
  },
  {
    re: /^\/api\/empresas\/(\d+)\/llamada-finalizada$/,
    frase: (_a, m) => `Registró la llamada de Empresa #${m[1]}`,
    icono: () => IconPhoneCheck,
    familia: () => 'alta',
  },
  {
    re: /^\/api\/empresas\/(\d+)\/rechazar$/,
    frase: (_a, m) => `Rechazó la solicitud de Empresa #${m[1]}`,
    icono: () => IconBan,
    familia: () => 'baja',
  },
  {
    re: /^\/api\/empresas\/(\d+)$/,
    frase: (_a, m) => `Editó los datos de Empresa #${m[1]}`,
    icono: () => IconPencil,
    familia: () => 'edicion',
  },
  {
    re: /^\/api\/suscripciones\/cambiar-plan$/,
    frase: (a) => `Cambió el plan de Empresa #${(a.cuerpo as { empresaId?: number } | null)?.empresaId ?? '?'}`,
    icono: () => IconExchange,
    familia: () => 'plata',
  },
  {
    re: /^\/api\/suscripciones\/(\d+)\/estado$/,
    frase: (_a, m) => `Cambió el estado de la suscripción #${m[1]}`,
    icono: () => IconExchange,
    familia: () => 'plata',
  },
  {
    re: /^\/api\/planes\/(\d+)$/,
    frase: (a, m) => (a.metodo === 'DELETE' ? 'Intentó sacar del catálogo el plan #' : 'Editó el plan #') + m[1],
    icono: (a) => (a.metodo === 'DELETE' ? IconCircleOff : IconPencil),
    familia: (a) => (a.metodo === 'DELETE' ? 'baja' : 'plata'),
  },
  { re: /^\/api\/planes$/, frase: () => 'Creó un plan nuevo', icono: () => IconPlus, familia: () => 'plata' },
  {
    re: /^\/api\/usuarios\/(\d+)\/roles$/,
    frase: (_a, m) => `Cambió los permisos de Usuario #${m[1]}`,
    icono: () => IconShieldCheck,
    familia: () => 'permisos',
  },
  {
    re: /^\/api\/usuarios\/(\d+)$/,
    frase: (a, m) => (a.metodo === 'DELETE' ? 'Eliminó Usuario #' : 'Editó Usuario #') + m[1],
    icono: (a) => (a.metodo === 'DELETE' ? IconUserMinus : IconPencil),
    familia: (a) => (a.metodo === 'DELETE' ? 'baja' : 'permisos'),
  },
];

/** Clases de caja (fondo + tinta del ícono) por familia. */
const CAJA_FAMILIA: Record<FamiliaAccion, string> = {
  sesion: 'bg-canvas-bg text-gray-600',
  alta: 'bg-emerald-50 text-success-solid',
  edicion: 'bg-canvas-bg text-gray-600',
  plata: 'bg-sky-100 text-sky-700',
  permisos: 'bg-sky-100 text-sky-700',
  baja: 'bg-badge-error-solid/10 text-badge-error-solid',
};

/** Fuera de esta franja una acción cuenta como fuera de hora ("De madrugada"). */
const HORA_DESDE = 7;
/** La pantalla mira las últimas 48 h (cabecera, alertas y bitácora). */
const VENTANA_MS = 48 * 60 * 60 * 1000;
/** Tope de acciones a traer de esa ventana, por si hay un pico (p. ej. un ataque de inicios de sesión). */
const TOPE_ACCIONES = 5000;
/** Intentos fallidos más juntos que esto cuentan como «en pocos minutos». */
const RAFAGA_MS = 15 * 60 * 1000;
const HORA_HASTA = 21;

// TODO(backend): incluir el nombre del usuario en `GET /auditoria`; mientras
// tanto se cruza con `UsuarioService.listar()` en memoria.
// TODO(backend): filtrar por `exitoso` en el servidor; hoy los lentes y la
// búsqueda son en memoria sobre las acciones de las últimas 48 h.
/**
 * Auditoría como bitácora: cada escritura del sistema traducida a una frase
 * (`REGLAS`), agrupada por día, con anomalías detectadas en el cliente
 * (`alertas()`), volumen por hora (`pulso()`) y lentes de filtro.
 *
 * @remarks
 * `AccionDetallePanelComponent` recibe la lista completa (`[acciones]`) en
 * vez de cargar por id: "En la misma sesión" e "Historia de X" recorren todas
 * las acciones y así no repite las llamadas ni las reglas. La navegación
 * dentro del panel la decide esta página (`verAccion`, `verRastro`).
 */
@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [
    FormsModule,
    TablerIconComponent,
    AccionDetallePanelComponent,
    PantallaEstadoComponent,
    CabeceraModuloComponent,
    AvisoDatosNuevosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auditoria-page.component.html',
})
export class AuditoriaPageComponent {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);
  private readonly cambiosEnVivoService = inject(CambiosEnVivoService);

  protected readonly iconModulo = IconHistory;
  protected readonly iconBuscar = IconSearch;
  protected readonly iconCerrar = IconX;
  protected readonly iconDerecha = IconChevronRight;
  protected readonly iconRastro = IconRoute;
  protected readonly iconAlerta = IconAlertTriangle;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Cambios en vivo desde la última carga, para la píldora "N cambios nuevos ·
   *  Actualizar". Sin filtro de entidad: cualquier escritura genera una fila aquí. */
  protected readonly cambiosEnVivo = signal(0);
  /** Filas resaltadas 2 s después de tocar "Actualizar". */
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;
  protected readonly total = signal(0);

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly busqueda = signal('');
  protected readonly lente = signal<LenteAuditoria>('todo');
  protected readonly rastro = signal<{ entidad: string; entidadId: string } | null>(null);
  protected readonly panelId = signal<number | null>(null);

  private readonly acciones = signal<AuditoriaAccion[]>([]);
  private readonly nombrePorUsuario = signal<Map<number, string>>(new Map());

  /** Lo más reciente primero, siempre: una bitácora que salta hacia atrás y
   * hacia adelante dentro del mismo día no se puede leer. */
  protected readonly leibles = computed<AccionLeible[]>(() =>
    [...this.acciones()]
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
      .map((a) => {
        const d = this.describir(a);
        const ag = this.agente(a.userAgent ?? '');
        const fecha = new Date(a.creadoEn);
        const h = fecha.getHours();
        return {
          ...a,
          ...d,
          agenteEtiqueta: ag.etiqueta,
          agenteEsNavegador: ag.esNavegador,
          fueraDeHora: h < HORA_DESDE || h >= HORA_HASTA,
          horaNum: h,
          fechaMs: fecha.getTime(),
          cuando: `${this.fechaCorta(a.creadoEn)}, ${this.horaCorta(a.creadoEn)}`,
          caja: a.exitoso ? CAJA_FAMILIA[d.familia] : CAJA_FAMILIA['baja'],
          nombreResuelto: a.usuarioId ? this.nombreUsuario(a.usuarioId) : null,
        };
      }),
  );

  private readonly deHoy = computed(() => {
    const hoy = new Date().toDateString();
    return this.leibles().filter((a) => new Date(a.creadoEn).toDateString() === hoy);
  });

  private readonly fallidasSesion = computed(() =>
    this.leibles().filter((a) => a.familia === 'sesion' && !a.exitoso),
  );
  private readonly noNavegador = computed(() => this.leibles().filter((a) => !a.agenteEsNavegador));
  private readonly sensibles = computed(() =>
    this.leibles().filter((a) => a.familia === 'permisos' || a.familia === 'baja'),
  );

  protected readonly lectura = computed(() => {
    const base =
      'Cada vez que alguien escribe algo en el sistema queda anotado acá, con quién fue, desde dónde y qué mandó. ';
    const n = this.fallidasSesion().length;
    return (
      base +
      (n
        ? `Hoy hay ${n} ${n === 1 ? 'intento de sesión fallido' : 'intentos de sesión fallidos'} que conviene mirar.`
        : 'Hoy no hay nada fuera de lo normal.')
    );
  });

  /** Series de 8 cubos de 6 h (48 h) solo donde hay una fecha por evento;
   *  "Personas" e "IPs distintas" son conteos de valores únicos. Clic en
   *  "Con error" → lente `fallidas`. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const hoyFechas = this.deHoy().map((a) => a.creadoEn);
    const errorFechas = this.leibles()
      .filter((a) => !a.exitoso)
      .map((a) => a.creadoEn);
    return [
      { id: 'hoy', etiqueta: 'Hoy', valor: hoyFechas.length, tono: 'neutro', serie: serieAcumulada(hoyFechas, 8, 0.25) },
      {
        id: 'error',
        etiqueta: 'Con error',
        valor: errorFechas.length,
        tono: errorFechas.length ? 'peligro' : 'neutro',
        serie: serieAcumulada(errorFechas, 8, 0.25),
      },
      {
        id: 'personas',
        etiqueta: 'Personas',
        valor: new Set(this.leibles().filter((a) => a.usuarioId).map((a) => a.usuarioId)).size,
        tono: 'info',
      },
      { id: 'ips', etiqueta: 'IPs distintas', valor: new Set(this.leibles().map((a) => a.ip)).size, tono: 'apagado' },
    ];
  });

  protected metricaCabeceraClick(id: string): void {
    if (id === 'error') {
      this.lente.update((actual) => (actual === 'fallidas' ? 'todo' : 'fallidas'));
    }
  }

  protected readonly metricaActivaCabecera = computed(() => (this.lente() === 'fallidas' ? 'error' : null));

  /** Las anomalías ya están en el log: solo hay que mirarlo. */
  protected readonly alertas = computed(() => {
    const lista: {
      clave: string;
      titulo: string;
      detalle: string;
      icono: typeof IconLockOff;
      caja: string;
      conteo: number;
      lente: LenteAuditoria;
    }[] = [];

    const porIp = new Map<string, number>();
    for (const a of this.fallidasSesion()) {
      porIp.set(a.ip ?? '—', (porIp.get(a.ip ?? '—') ?? 0) + 1);
    }
    const peor = [...porIp.entries()].sort((x, y) => y[1] - x[1])[0];
    if (peor && peor[1] >= 3) {
      lista.push({
        clave: 'sesiones',
        titulo: `${peor[1]} ${peor[1] === 1 ? 'intento de sesión fallido' : 'intentos de sesión fallidos'} desde ${peor[0]}`,
        detalle: detalleIntentos(this.fallidasSesion().filter((a) => (a.ip ?? '—') === peor[0])),
        icono: IconLockOff,
        caja: 'bg-badge-error-solid/10 text-badge-error-solid',
        conteo: peor[1],
        lente: 'fallidas',
      });
    }

    const fuera = this.noNavegador();
    if (fuera.length) {
      lista.push({
        clave: 'agente',
        titulo: `${fuera.length} ${fuera.length === 1 ? 'acción hecha fuera del navegador' : 'acciones hechas fuera del navegador'}`,
        detalle: `Llegaron desde ${fuera[0].agenteEtiqueta}. Puede ser una prueba automatizada — o alguien usando la API directo.`,
        icono: IconTerminal2,
        caja: 'bg-[#fffdf2] text-amber-700',
        conteo: fuera.length,
        lente: 'agente',
      });
    }

    const sens = this.sensibles();
    if (sens.length) {
      lista.push({
        clave: 'sensibles',
        titulo: `${sens.length} ${sens.length === 1 ? 'cambio sensible' : 'cambios sensibles'} en permisos o bajas`,
        detalle:
          'Cambios de rol, eliminación de usuarios y planes sacados del catálogo — lo que conviene mirar dos veces.',
        icono: IconShieldCheck,
        caja: 'bg-sky-100 text-sky-700',
        conteo: sens.length,
        lente: 'sensibles',
      });
    }

    return lista;
  });

  protected readonly pulso = computed(() => {
    const conteo = Array.from({ length: 24 }, () => ({ ok: 0, mal: 0 }));
    for (const a of this.deHoy()) {
      conteo[a.horaNum][a.exitoso ? 'ok' : 'mal'] += 1;
    }
    const pico = Math.max(1, ...conteo.map((c) => c.ok + c.mal));
    return conteo.map((c, hora) => {
      const total = c.ok + c.mal;
      return {
        hora,
        total,
        alto: Math.round((c.ok / pico) * 40),
        altoError: Math.round((c.mal / pico) * 40),
        titulo: `${String(hora).padStart(2, '0')}h · ${total} ${total === 1 ? 'acción' : 'acciones'}${c.mal ? ` (${c.mal} con error)` : ''}`,
      };
    });
  });

  protected readonly notaPulso = computed(() => {
    const pico = Math.max(...this.pulso().map((h) => h.total), 0);
    return this.deHoy().length
      ? `Pico de ${pico} ${pico === 1 ? 'acción' : 'acciones'} en una hora`
      : 'Sin actividad hoy';
  });

  protected readonly lentes = computed(() => {
    const todas = this.leibles();
    return [
      { clave: 'todo' as const, texto: 'Todo', conteo: todas.length },
      { clave: 'fallidas' as const, texto: 'Fallidas', conteo: todas.filter((a) => !a.exitoso).length },
      { clave: 'sensibles' as const, texto: 'Sensibles', conteo: this.sensibles().length },
      { clave: 'agente' as const, texto: 'Fuera del navegador', conteo: this.noNavegador().length },
      { clave: 'anonimas' as const, texto: 'Sin usuario', conteo: todas.filter((a) => a.usuarioId === null).length },
    ];
  });

  private readonly visibles = computed(() => {
    const r = this.rastro();
    let lista = r
      ? this.leibles().filter((a) => a.entidad === r.entidad && a.entidadId === r.entidadId)
      : this.porLente(this.lente());

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      lista = lista.filter((a) => {
        const quien = a.nombreResuelto ?? 'anónimo';
        return `${a.frase} ${quien} ${a.entidad ?? ''} ${a.entidadId ?? ''} ${a.ip ?? ''} ${JSON.stringify(a.cuerpo ?? {})}`
          .toLowerCase()
          .includes(q);
      });
    }
    return lista;
  });

  protected readonly conteoVisible = computed(() => {
    const n = this.visibles().length;
    return `${n} ${n === 1 ? 'acción' : 'acciones'}`;
  });

  /** El tiempo es el índice natural de una bitácora. */
  protected readonly dias = computed(() => {
    const hoy = new Date().toDateString();
    const grupos: { dia: string; titulo: string; resumen: string; filas: FilaAuditoria[] }[] = [];

    for (const a of this.visibles()) {
      const clave = new Date(a.creadoEn).toDateString();
      let grupo = grupos.find((g) => g.dia === clave);
      if (!grupo) {
        const etiqueta = this.fechaCorta(a.creadoEn);
        grupo = {
          dia: clave,
          titulo: clave === hoy ? `Hoy · ${etiqueta}` : etiqueta,
          resumen: '',
          filas: [],
        };
        grupos.push(grupo);
      }
      grupo.filas.push(this.aFila(a));
    }

    for (const g of grupos) {
      const errores = g.filas.filter((f) => !f.exitoso).length;
      g.resumen = `${g.filas.length} ${g.filas.length === 1 ? 'acción' : 'acciones'}${errores ? ` · ${errores} con error` : ''}`;
    }
    return grupos;
  });

  constructor() {
    this.cargar();
    this.cambiosEnVivoService
      .huboCambio()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
  }

  protected actualizarPorCambioEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }

  /** Marca 2 s las filas nuevas o cambiadas al tocar "Actualizar". `clave` =
   *  id de la fila en pantalla, por si no coincide con el id del dato comparado. */
  private resaltarCambios<T>(
    antes: readonly T[],
    despues: readonly T[],
    id: (f: T) => number,
    clave: (f: T) => number = id,
  ): void {
    if (!this.compararAlCargar) return;
    this.compararAlCargar = false;
    const cambiados = filasCambiadas(antes, despues, id);
    this.resaltadas.set(new Set(despues.filter((f) => cambiados.has(id(f))).map(clave)));
    setTimeout(() => this.resaltadas.set(new Set()), 2000);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      auditoria: traerTodo(
        (page, pageSize) => this.auditoriaService.listar({ page, pageSize, desde: new Date(Date.now() - VENTANA_MS).toISOString() }),
        TOPE_ACCIONES,
      ),
      // Solo para el total del badge («N acciones registradas»): todas, no solo las de 48 h.
      conteo: this.auditoriaService.listar({ pageSize: 1 }),
      usuarios: this.usuarioService.listar(),
    }).subscribe({
      next: ({ auditoria, conteo, usuarios }) => {
        this.resaltarCambios(this.acciones(), auditoria.data, (a) => a.id);
        this.acciones.set(auditoria.data);
        this.total.set(conteo.total);
        this.nombrePorUsuario.set(
          new Map(
            usuarios.data.map((u) => [u.id, [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.correo]),
          ),
        );
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de auditoría. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected aplicarLente(lente: LenteAuditoria): void {
    this.lente.set(lente);
    this.rastro.set(null);
    this.panelId.set(null);
  }

  protected abrirPanel(id: number): void {
    this.panelId.set(id);
  }

  protected cerrarPanel(): void {
    this.panelId.set(null);
  }

  /** «Volver al inicio» de la pantalla de error: va a la portada de staff. */
  protected volver(): void {
    this.router.navigateByUrl('/');
  }

  /** "Ver todo el rastro" del panel: filtra por esa entidad, limpia lente y
   * búsqueda y cierra el panel. */
  protected onVerRastro(evt: { entidad: string; entidadId: string }): void {
    this.rastro.set(evt);
    this.panelId.set(null);
    this.lente.set('todo');
    this.busqueda.set('');
  }

  private porLente(lente: LenteAuditoria): AccionLeible[] {
    switch (lente) {
      case 'fallidas':
        return this.leibles().filter((a) => !a.exitoso);
      case 'sensibles':
        return this.sensibles();
      case 'agente':
        return this.noNavegador();
      case 'anonimas':
        return this.leibles().filter((a) => a.usuarioId === null);
      default:
        return this.leibles();
    }
  }

  private aFila(a: AccionLeible): FilaAuditoria {
    const campos = a.cuerpo ? Object.keys(a.cuerpo).filter((k) => k !== 'password') : [];
    const quien = a.nombreResuelto ?? 'Sin usuario identificado';

    let marca: { texto: string; icono: typeof IconX; caja: string } | null = null;
    if (!a.exitoso) {
      marca = { texto: 'No se aplicó', icono: IconX, caja: 'bg-badge-error-solid/10 text-badge-error-solid' };
    } else if (!a.agenteEsNavegador) {
      marca = { texto: 'Fuera del navegador', icono: IconTerminal2, caja: 'bg-[#fffdf2] text-amber-700' };
    } else if (a.fueraDeHora) {
      marca = { texto: 'De madrugada', icono: IconMoon, caja: 'bg-[#fffdf2] text-amber-700' };
    }

    return {
      id: a.id,
      hora: this.horaCorta(a.creadoEn),
      icono: a.icono,
      caja: a.exitoso ? CAJA_FAMILIA[a.familia] : CAJA_FAMILIA['baja'],
      frase: a.frase,
      exitoso: a.exitoso,
      contexto: `${quien} · ${a.agenteEtiqueta}${campos.length ? ` · tocó ${campos.slice(0, 3).join(', ')}` : ''}`,
      marca,
    };
  }

  private describir(a: AuditoriaAccion): { frase: string; icono: typeof IconPencil; familia: FamiliaAccion } {
    for (const r of REGLAS) {
      const m = a.ruta.match(r.re);
      if (m) {
        return { frase: r.frase(a, m), icono: r.icono(a), familia: r.familia(a) };
      }
    }
    return { frase: `${a.metodo} ${a.ruta}`, icono: IconCode, familia: 'edicion' };
  }

  /** El `userAgent` también es un dato de seguridad: Postman no es un
   * navegador. */
  private agente(ua: string): { etiqueta: string; esNavegador: boolean } {
    if (/Postman|curl|insomnia|python|axios|node-fetch/i.test(ua)) {
      return { etiqueta: ua.split('/')[0], esNavegador: false };
    }
    const nav = /Chrome\/[\d.]+/.test(ua)
      ? 'Chrome'
      : /Firefox/.test(ua)
        ? 'Firefox'
        : /Safari/.test(ua)
          ? 'Safari'
          : 'Navegador';
    const so = /Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    return { etiqueta: nav + (so ? ` en ${so}` : ''), esNavegador: true };
  }

  private nombreUsuario(id: number): string {
    return this.nombrePorUsuario().get(id) ?? `Usuario #${id}`;
  }

  private fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private horaCorta(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Describe solo lo que de verdad pasó en una tanda de inicios de sesión fallidos
 * desde una misma IP: cuántas cuentas probaron, si fue seguido, fuera de hora o
 * fuera del navegador.
 */
function detalleIntentos(intentos: AccionLeible[]): string {
  const cuentas = new Set(intentos.map((a) => String(a.cuerpo?.['correo'] ?? '').trim().toLowerCase()).filter(Boolean)).size;
  const tiempos = intentos.map((a) => a.fechaMs);
  const seguidos = Math.max(...tiempos) - Math.min(...tiempos) <= RAFAGA_MS;
  const partes = [
    cuentas > 1 ? `Probaron con ${cuentas} cuentas distintas` : cuentas === 1 ? 'Probaron varias veces la misma cuenta' : 'Fallaron varias veces',
    seguidos ? 'en pocos minutos' : 'en distintos momentos',
  ];
  if (intentos.every((a) => a.fueraDeHora)) partes.push('fuera del horario de trabajo');
  const herramienta = intentos.every((a) => !a.agenteEsNavegador);
  return `${partes.join(', ')}${herramienta ? ', y desde una herramienta, no desde un navegador' : ''}.`;
}
