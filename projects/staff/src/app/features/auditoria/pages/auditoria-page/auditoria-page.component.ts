import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { AuditoriaService } from '../../../../core/auditoria/auditoria.service';
import { AuditoriaAccion } from '../../../../core/auditoria/models/auditoria-accion.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { AccionDetallePanelComponent } from '../accion-detalle-panel/accion-detalle-panel.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
  serieAcumulada,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';

type LenteAuditoria = 'todo' | 'fallidas' | 'sensibles' | 'agente' | 'anonimas';
export type FamiliaAccion = 'sesion' | 'alta' | 'edicion' | 'plata' | 'permisos' | 'baja';

/** Exportada: la usa también `AccionDetallePanelComponent` (ver ese
 * componente) — recibe la lista completa ya calculada acá vía `[acciones]`
 * en vez de recalcularla por su cuenta. */
export interface AccionLeible extends AuditoriaAccion {
  /** La ruta HTTP traducida a lo que pasó — el corazón del rediseño. */
  frase: string;
  icono: typeof IconPencil;
  familia: FamiliaAccion;
  /** Etiqueta legible del `userAgent` + si es un navegador de verdad. */
  agenteEtiqueta: string;
  agenteEsNavegador: boolean;
  /** Fuera del horario laboral configurado. */
  fueraDeHora: boolean;
  horaNum: number;
  fechaMs: number;
  /** Fecha y hora completa, para el encabezado del panel de detalle
   * (ej. "21 sept 2026, 14:32"). Ajuste propio: el handoff original
   * referenciaba `accion.cuando` en el template sin que existiera en
   * ningún lado — con `strictTemplates` eso no compila (TS2339). Se
   * agrega acá, calculado una sola vez en `leibles()` en vez de en el
   * propio template, mismo criterio que el resto de los campos
   * derivados de esta interfaz. */
  cuando: string;
  /** Clases de caja (fondo + tinta) del ícono, para el encabezado del
   * panel de detalle. Ajuste propio, mismo caso que `cuando`: el
   * template usaba `accion.caja` (el `AccionLeible` de `accionAbierta()`
   * directo, no la fila armada por `aFila()`), y esa propiedad tampoco
   * existía en la interfaz — ver la nota de `cuando` arriba. Misma
   * fórmula que ya usa `aFila()` para la fila de la lista. */
  caja: string;
  /** Nombre ya resuelto de `usuarioId` (o `null` si la acción es
   * anónima) — se calcula acá, una sola vez por acción, con el mapa
   * `nombrePorUsuario` que arma `cargar()`. Se agrega para que
   * `AccionDetallePanelComponent` no necesite ese mapa ni el método
   * `nombreUsuario()`: le alcanza con la lista de `AccionLeible` que ya
   * recibe por `[acciones]`. Cada lugar que lo usa pone su propio texto
   * de reemplazo cuando es `null` ("Sin usuario", "anónimo", "Esa IP",
   * etc. — son distintos a propósito, ver cada `computed`). */
  nombreResuelto: string | null;
}

/** Fila ya armada para una fila de la bitácora — se separa como interfaz
 * propia (en vez de `ReturnType<typeof this.aFila>` inline, como traía el
 * handoff) porque ese type query dentro del arrow function de `dias`
 * disparaba TS2683 ("'this' implicitly has type 'any'"): con
 * `strictTemplates`/modo estricto, TS no logra resolver el tipo de
 * `this.aFila` dentro de una posición de tipo anidada así. */
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

/** Reglas ruta → frase. Agregá una entrada por endpoint de escritura nuevo;
 * el fallback muestra `METODO /ruta` como antes. Los prefijos asumen
 * `/api/...` — coincide con `environment.apiUrl` y con `ruta:
 * request.originalUrl` del interceptor, que sí incluye el
 * `setGlobalPrefix('api')` de `main.ts` (verificado antes de integrar). */
const REGLAS: {
  re: RegExp;
  frase: (a: AuditoriaAccion, m: RegExpMatchArray) => string;
  icono: (a: AuditoriaAccion) => typeof IconPencil;
  familia: (a: AuditoriaAccion) => FamiliaAccion;
}[] = [
  {
    // Ajuste propio: el handoff solo cubría `/auth/login` (el del panel
    // `admin`) — `staff` pega contra `/auth/login-staff` (ver
    // `AuthController`, `@Post('login-staff')`), un endpoint aparte con
    // el mismo significado. Sin este agregado, el login — la acción más
    // frecuente de esta pantalla, literalmente todas las sesiones que se
    // abren en el panel de staff — caía siempre al fallback genérico
    // `POST /api/auth/login-staff` en vez de "Inició sesión".
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

/** Clases de caja (fondo + tinta del ícono) por familia. Sin hues nuevos:
 * el azul de `permisos` es el mismo `sky` que usan los otros rediseños. */
const CAJA_FAMILIA: Record<FamiliaAccion, string> = {
  sesion: 'bg-canvas-bg text-gray-600',
  alta: 'bg-emerald-50 text-success-solid',
  edicion: 'bg-canvas-bg text-gray-600',
  plata: 'bg-sky-100 text-sky-700',
  permisos: 'bg-sky-100 text-sky-700',
  baja: 'bg-badge-error-solid/10 text-badge-error-solid',
};

/** Fuera de esta franja una acción se marca "De madrugada". */
const HORA_DESDE = 7;
const HORA_HASTA = 21;

/**
 * Auditoría — rediseño del 2026-09-19 ("bitácora"), cuarto componente del
 * mismo handoff integrado 2026-09-21 (LEEME.md §8): sigue el de
 * `suscripciones-page` en la lista "componente por componente".
 *
 * La tabla anterior era el log HTTP crudo: `PATCH /empresas/14` es una ruta,
 * no una acción; el usuario era un número; y tres intentos de login fallidos
 * seguidos se veían igual que un PATCH exitoso. Una auditoría se lee de dos
 * maneras — **barriendo** ("¿pasó algo raro?") y **investigando** ("¿quién
 * tocó Empresa 14?") — y la tabla no servía para ninguna.
 *
 * Cinco cosas nuevas, todas sacadas de lo que el endpoint YA devuelve:
 *
 * 1. **`REGLAS`: la ruta se traduce a una frase.** `POST
 *    /api/suscripciones/cambiar-plan` con `cuerpo.empresaId: 14` →
 *    "Cambió el plan de Empresa #14".
 * 2. **`alertas()`: anomalías detectadas en cliente** — intentos de sesión
 *    fallidos repetidos desde una IP, acciones hechas desde fuera de un
 *    navegador (el `userAgent` real trae `PostmanRuntime/2.6.0`), y cambios
 *    sensibles (permisos y bajas).
 * 3. **`pulso()`: volumen por hora del día**, con los errores apilados en
 *    rojo — se ve el pico sin leer una fila.
 * 4. **El `cuerpo` por fin se usa** (pestaña Datos), con `[oculto]`
 *    renderizado como "No se guarda", y el status traducido.
 * 5. **`rastroPanel()` / "Ver todo el rastro"**: el modo investigación —
 *    todo lo que pasó con una misma entidad.
 *
 * Además: agrupado por día, orden estricto descendente por `creadoEn`, y el
 * panel partido en tres pestañas (Resumen / Datos / Técnico) con el contexto
 * de sesión que convierte un registro suelto en una historia.
 *
 * **El panel de detalle está separado en `AccionDetallePanelComponent`**
 * (`features/auditoria/pages/accion-detalle-panel/`), a pedido explícito
 * del cliente para mantener la misma estructura de `pages/` que ya tenían
 * `EmpresaDetallePanelComponent` / `ActivarEmpresaWizardComponent` /
 * `GestionarSuscripcionPanelComponent` — un componente por panel, sibling
 * de la página, no un bloque más del template.
 *
 * A diferencia de esos tres paneles, **este no carga sus propios datos por
 * `id` contra el backend** — recibe la lista COMPLETA ya cargada acá vía
 * `[acciones]="leibles()"`, además del `[accionId]` a mostrar. Es una
 * excepción deliberada, mismo criterio que `[mrrTotal]` en
 * `GestionarSuscripcionPanelComponent`: dentro del panel, "En la misma
 * sesión" y "Historia de X" necesitan recorrer TODAS las acciones (buscar
 * otras de la misma persona/IP en la misma media hora, o de la misma
 * entidad) — cargar eso por su cuenta significaría reimplementar ahí
 * adentro las 11 reglas de `REGLAS`/`describir()`/`agente()` de esta
 * página y pegarle una segunda vez a `AuditoriaService.listar()` +
 * `UsuarioService.listar()`, cuando esta página ya hizo ese trabajo.
 * `AccionLeible` (con el nombre de usuario ya resuelto en
 * `nombreResuelto`, ver esa interfaz) es lo que hace posible pasarla tal
 * cual sin que el panel necesite el mapa `nombrePorUsuario`.
 *
 * La navegación DENTRO del panel (los botones de "En la misma sesión" /
 * "Historia de X", que cambian qué acción se muestra sin cerrarlo) no la
 * resuelve el panel solo: emite `(verAccion)`, y es esta página —dueña de
 * `panelId`— la que decide, reutilizando `abrirPanel()`. Lo mismo con "Ver
 * todo el rastro": el panel emite `(verRastro)` con la entidad, y
 * `onVerRastro()` arma el filtro y cierra el panel.
 *
 * **Cuatro ajustes propios al integrar** (bugs del handoff, no decisiones
 * de diseño — los primeros dos hacían que `ng build` no compilara con
 * `strictTemplates`):
 * 1. `accion.cuando` y `accion.caja`, usados en el encabezado del panel de
 *    detalle, no existían en `AccionLeible` — se agregan acá, calculadas en
 *    `leibles()`.
 * 2. `dias()` tipaba `filas` como `ReturnType<typeof this.aFila>[]` inline,
 *    lo que disparaba TS2683 ("'this' implicitly has type 'any'") dentro
 *    del `computed()` — se extrajo `FilaAuditoria` como interfaz propia.
 * 3. La regla de `REGLAS` para el login solo cubría `/api/auth/login`
 *    (panel `admin`) — se amplió a `/api/auth/login-staff` también (ver
 *    esa entrada), el que de verdad usa este panel.
 * 4. Ninguna keyframe nueva hacía falta: `fade-in-up` y `slide-in-right`
 *    (las que usa el panel) ya estaban en `staff/src/styles.css`.
 *
 * SOBRE EL BACKEND — dos cosas que convendría cambiar (ver LEEME.md §8):
 * a) **`usuarioId` sin nombre.** `AuditoriaAccionService.findAll` no hace
 *    `relations: ['usuario']`, así que acá se resuelve con una segunda
 *    llamada a `UsuarioService.listar()` y un mapa en memoria (mismo
 *    criterio que `EmpresasPageComponent` con los planes). Si el volumen
 *    crece, es el primer lugar a optimizar: un `leftJoin` en el backend
 *    ahorra la llamada entera.
 * b) **Los filtros de `FiltroAuditoria` (entidad/desde/hasta) ya no se
 *    usan.** Los lentes y la búsqueda son en memoria sobre las últimas 50
 *    acciones, porque son transversales (fallidas, fuera del navegador,
 *    anónimas) y el backend no sabe filtrar por eso. Para más de unos
 *    cientos de registros hace falta mover esos filtros al servidor —
 *    especialmente `exitoso` y un rango de fechas.
 *
 * `SearchToolbarComponent`, `p-table`, `dataTablePt()`, `DataTableComponent`,
 * `p-popover` y `p-date-picker` ya no se usan en esta pantalla: la barra de
 * búsqueda es parte de la tarjeta de la bitácora y los lentes reemplazan al
 * popover de fechas. Los componentes siguen en uso en el resto del panel.
 *
 * Verificado antes de integrar: `environment.apiUrl` (`http://localhost:3000/api`)
 * y `AuditoriaAccionInterceptor` guarda `ruta: request.originalUrl`, que sí
 * incluye el prefijo — `main.ts` llama `app.setGlobalPrefix('api')` — así
 * que las regex de `REGLAS` (todas ancladas a `/api/...`) matchean contra
 * los valores reales guardados. `UsuarioService.listar()` no toma
 * argumentos y devuelve `RespuestaPaginada<UsuarioGoods>` con `nombres`/
 * `apellidos`/`correo` — coincide tal cual con lo que espera `cargar()`.
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auditoria-page.component.html',
})
export class AuditoriaPageComponent {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);

  protected readonly iconModulo = IconHistory;
  protected readonly iconBuscar = IconSearch;
  protected readonly iconCerrar = IconX;
  protected readonly iconDerecha = IconChevronRight;
  protected readonly iconRastro = IconRoute;
  protected readonly iconAlerta = IconAlertTriangle;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
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
   * hacia adelante dentro del mismo día no se puede leer. `protected` (no
   * `private`, como el resto de los `computed` de esta clase): el
   * template se lo pasa a `AccionDetallePanelComponent` vía `[acciones]`. */
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

  /** Cabecera compartida (LEEME.md §14). Período "Últimas 48 h" — la
   *  ventana real de esta pantalla. Serie por hora (8 cubos de 6 h,
   *  `serieAcumulada(fechas, 8, 0.25)`) solo donde hay una fecha por
   *  evento que agrupar: "Personas"/"IPs distintas" son conteos de
   *  valores únicos, no tienen una. Clic en "Con error" → `lente`. */
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
        detalle:
          'Probaron con más de una cuenta en pocos minutos, de madrugada y desde una herramienta, no desde un navegador.',
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
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      auditoria: this.auditoriaService.listar({ pageSize: 50 }),
      usuarios: this.usuarioService.listar(),
    }).subscribe({
      next: ({ auditoria, usuarios }) => {
        this.acciones.set(auditoria.data);
        this.total.set(auditoria.total);
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

  /** `(volver)` de `app-pantalla-estado` — mismo criterio que
   * `EmpresasPageComponent.volver()`. */
  protected volver(): void {
    this.router.navigateByUrl('/auditoria');
  }

  /** El panel emite la entidad al pedir "Ver todo el rastro" (ver
   * `AccionDetallePanelComponent.verRastro`) — acá se arma el filtro
   * transversal y se cierra el panel, mismo comportamiento que tenía
   * `verRastroCompleto()` antes de la extracción. */
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
