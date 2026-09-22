import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconBuildingStore,
  IconCheck,
  IconChevronRight,
  IconHistory,
  IconLayoutGrid,
  IconPhoneCall,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconUserPlus,
  IconUsers,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { Subscription, forkJoin } from 'rxjs';
import { AuditoriaService } from '../../../../core/auditoria/auditoria.service';
import { AuditoriaAccion } from '../../../../core/auditoria/models/auditoria-accion.model';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { Rol } from '../../../../core/roles/models/rol.model';
import { RolService } from '../../../../core/roles/rol.service';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { FichaUsuarioPanelComponent } from '../ficha-usuario-panel/ficha-usuario-panel.component';
import { CrearUsuarioPanelComponent } from '../crear-usuario-panel/crear-usuario-panel.component';

/** Payload real de `RealtimeGateway.EVENTO_PRESENCIA_CAMBIO` (backend,
 * `modules/realtime/realtime.constants.ts`) — mismo criterio que
 * `EventoEmpresaActivada` en `ActivarEmpresaWizardComponent`: el nombre del
 * evento se repite acá como string literal (`'presencia:cambio'`), no se
 * importa nada del backend. */
interface EventoPresenciaCambio {
  usuarioId: number;
  enLinea: boolean;
}

type ModoPanel = 'ficha' | 'crear' | null;
export type EstadoAcceso = 'activo' | 'dormido' | 'sin_estrenar' | 'desactivado';

/** Columna de la matriz. `id` tiene que coincidir con el prefijo del
 * `Permiso.codigo` del backend (`empresas.ver`, `auditoria.ver`, …) o con
 * `Permiso.modulo` si lo tenés poblado — salvo que tenga `codigos`, ver
 * abajo. Agregá una fila por módulo nuevo. */
export interface ModuloDef {
  id: string;
  corto: string;
  completo: string;
  icono: TablerIcon;
  /** Ajuste propio (no estaba en el handoff): cuando el `modulo` real del
   * backend no coincide 1:1 con la columna, se listan acá los códigos
   * exactos que la componen y `nivelDe()` los usa en vez del match por
   * prefijo/`modulo`. Hace falta para "Altas pendientes" — ver el
   * comentario en `MODULOS`. */
  codigos?: string[];
}

export const MODULOS: ModuloDef[] = [
  { id: 'empresas', corto: 'Empr', completo: 'Empresas', icono: IconBuildingStore },
  {
    id: 'altas',
    corto: 'Altas',
    completo: 'Altas pendientes',
    icono: IconPhoneCall,
    // Ajuste propio: en la tabla `permiso` real NO existe ningún
    // `modulo = 'altas'` — `empresas.activar` / `empresas.rechazar` /
    // `empresas.gestionar_alta` están agrupados bajo `modulo: 'empresas'`
    // junto con el resto de Empresas (verificado con
    // `SELECT codigo, modulo FROM permisos`, no solo leyendo migraciones).
    // Sin este override la columna "Altas" da "Sin acceso" para TODOS los
    // roles, incluido admin/staff_goods — exactamente el bug que el LEEME
    // pedía revisar ("ojo altas"). Ver ADMIN_DISENO.md.
    codigos: ['empresas.activar', 'empresas.rechazar', 'empresas.gestionar_alta'],
  },
  { id: 'planes', corto: 'Plan', completo: 'Planes', icono: IconLayoutGrid },
  { id: 'suscripciones', corto: 'Susc', completo: 'Suscripciones', icono: IconReceipt },
  { id: 'auditoria', corto: 'Audit', completo: 'Auditoría', icono: IconHistory },
  { id: 'usuarios', corto: 'Usr', completo: 'Usuarios', icono: IconUsers },
];

/** Verbos que convierten un permiso en "Todo" (nivel 3). El resto de los
 * códigos que no son `.ver` valen "Editar" (nivel 2). Contrastado contra
 * la tabla `permiso` real: los verbos reales son activar/crear/editar/
 * eliminar/gestionar_alta/rechazar/ver/cambiar_rol/asignar/gestionar —
 * `desactivar` todavía no existe en datos reales (queda como supuesto a
 * futuro, tal como lo dejó el handoff) y `cambiar_rol`/`asignar` cuentan
 * como "Editar" por no estar en esta lista (clasificación del diseño
 * original, no un bug — se deja igual). */
export const VERBOS_TOTALES = ['eliminar', 'rechazar', 'desactivar', 'gestionar', 'gestionar_alta'];

export const NIVEL = ['Sin acceso', 'Solo ver', 'Editar', 'Todo'];
/** El nivel 1 NO puede ser un gris claro: "Solo ver" contra "Sin acceso" es
 * la distinción central de la pantalla y a #c6cad1 no se lee. */
export const TONO = ['#ececec', '#6b7280', '#66b39b', '#087b5d'];
export const TINTA_NIVEL = ['text-gray-300', 'text-gray-500', 'text-badge-success-solid', 'text-[#065f46]'];

const DIAS_TIRA = 14;
const MS_DIA = 86_400_000;
/** Cuántos días sin entrar convierten a alguien en "dormido". */
const UMBRAL_DORMIDO = 90;
/** Cuántas acciones de auditoría se piden para reconstruir los accesos.
 * Ajuste propio: el handoff traía 500, pero TODO endpoint paginado del
 * backend hereda de `PaginationQueryDto`, que fuerza `@Max(100)` en
 * `pageSize` a propósito ("sin límite, alguien podría pedir
 * pageSize=999999") — pedir 500 no da menos cobertura, hace que
 * `GET /auditoria` responda 400 SIEMPRE, lo que revienta el `forkJoin`
 * entero y deja la pantalla mostrando "No se pudo cargar el personal de
 * Goods" de forma permanente (no es un problema de escala, es que la
 * pantalla no cargaba nunca). Con más personal del que entra en esta
 * ventana de 100 acciones, mover el cálculo al backend sigue siendo la
 * solución real (ver LEEME / ADMIN_DISENO.md). */
const PAGINA_AUDITORIA = 100;
/** Ajuste propio: el handoff traía `/^\/api\/auth\/login$/`, que nunca
 * matchea — el staff siempre entra por `/api/auth/login-staff`
 * (`POST /api/auth/login` es la ruta pública de clientes). Con la regex
 * original `reconstruirAccesos()` nunca encuentra un login de staff y
 * toda la función (estado, último acceso, tira de 14 días) queda rota
 * para el propio personal de Goods. Mismo bug ya corregido en
 * `auditoria-page`. Ver ADMIN_DISENO.md. */
const RUTA_LOGIN = /^\/api\/auth\/login(-staff)?$/;

export interface Acceso {
  ultimoMs: number | null;
  /** Índices 0..13, 13 = hoy. */
  dias: boolean[];
  accesos30: number;
  fallidos: number;
}

interface FilaUsuario {
  usuario: UsuarioGoods;
  nombre: string;
  correo: string;
  estado: EstadoAcceso;
  estadoTexto: string;
  punto: string;
  pulso: boolean;
  enLinea: boolean;
  ultimo: string;
  tintaUltimo: string;
  dias: { alto: string; color: string; titulo: string }[];
  celdas: { titulo: string; s1: string; s2: string; s3: string }[];
}

interface GrupoRol {
  rol: Rol;
  nombre: string;
  punto: string;
  resumen: string;
  conteo: string;
  filas: FilaUsuario[];
}

export const ESTADO_UI: Record<EstadoAcceso, { texto: string; punto: string; tinta: string }> = {
  activo: { texto: 'Activo', punto: '#087b5d', tinta: 'text-badge-success-solid' },
  dormido: { texto: 'Dormido', punto: '#ffb904', tinta: 'text-[#b45309]' },
  sin_estrenar: { texto: 'Sin estrenar', punto: '#c6cad1', tinta: 'text-gray-500' },
  desactivado: { texto: 'Desactivado', punto: '#d82c0d', tinta: 'text-badge-error-solid' },
};

/** Color del punto de cada rol en las cabeceras de grupo. Por nombre de rol
 * del backend (ver `ROL_*` en `rol.service.ts`); el fallback gris sirve
 * para roles nuevos o ad-hoc (ver `RolService.listar()`, que trae los
 * roles reales, no una lista fija). Familia de verdes/gris oscuro para
 * los roles de staff de Goods, familia de azul/violeta para los roles
 * propios de una Empresa cliente — distinción útil ahora que `admin` ve
 * a ambos grupos mezclados en la misma matriz (ver `filtroTenantUsuarios`
 * del backend). */
export const PUNTO_ROL: Record<string, string> = {
  admin: '#303030',
  staff_goods: '#087b5d',
  admin_goods: '#0f766e',
  auditoria_goods: '#a16207',
  empleado_goods: '#4b5563',
  cliente: '#c6cad1',
  dueno_empresa: '#2563eb',
  empleado_empresa: '#7c3aed',
};

/** Etiqueta legible por nombre técnico de rol — un trabajador ve "Dueño
 * de la Empresa", no el slug `dueno_empresa` tal cual viene de la base.
 * Roles conocidos del sistema (ver `ROL_*` en `rol.service.ts` del
 * backend); cualquier otro cae al fallback de `etiquetaRolTexto()`. */
export const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administrador',
  staff_goods: 'Staff Goods',
  admin_goods: 'Admin de Goods',
  auditoria_goods: 'Auditoría de Goods',
  empleado_goods: 'Empleado de Goods',
  cliente: 'Cliente',
  dueno_empresa: 'Dueño de la Empresa',
  empleado_empresa: 'Empleado de la Empresa',
};

/** Traduce el nombre técnico (slug) de un rol a algo legible para
 * cualquiera que no conozca la base de datos. Los roles conocidos (arriba)
 * tienen una etiqueta a mano; cualquier rol nuevo o ad-hoc (creado desde
 * "Roles y permisos", o un slug de prueba) cae acá: separa por `_`/`-` y
 * pone cada palabra en mayúscula inicial, en vez de mostrar el slug
 * crudo. */
export function etiquetaRolTexto(nombre: string): string {
  return (
    ETIQUETA_ROL[nombre] ??
    nombre
      .split(/[_-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  );
}

/**
 * Personal de Goods como matriz quién × qué: una fila por persona, una
 * columna por módulo, el nivel de acceso como medidor de tres barras.
 * Reemplaza la tabla + tres modales de la pantalla anterior.
 *
 * Los accesos (tira de 14 días, "último acceso", estado) NO vienen de
 * `Usuario`: se reconstruyen desde `GET /auditoria` filtrando
 * `POST /api/auth/login(-staff)?`. Ver ADMIN_DISENO.md — conviene un
 * `ultimoAccesoEn` en el backend y esta pantalla se simplifica entera.
 *
 * El panel se separó en dos componentes aparte, sibling en `pages/`, mismo
 * patrón que el resto de los módulos (`EmpresaDetallePanelComponent`,
 * `ActivarEmpresaWizardComponent`, `GestionarSuscripcionPanelComponent`,
 * `AccionDetallePanelComponent`): `FichaUsuarioPanelComponent` (ver/editar
 * a alguien que ya existe) y `CrearUsuarioPanelComponent` (dar de alta),
 * porque el handoff los trataba como dos cuerpos muy distintos compartiendo
 * solo el contenedor deslizable — separarlos en dos componentes, uno por
 * concepto, es más consistente con el resto de la app que uno solo
 * cambiando de modo por dentro.
 *
 * `CrearUsuarioPanelComponent` es completamente autónomo (no hay ninguna
 * fila existente con la que cruzar un "diff"), así que carga sus propias
 * constantes `MODULOS`/`nivelDe()` — se duplican a propósito, mismo criterio
 * que `fechaCorta`/`horaCorta` en `AccionDetallePanelComponent`.
 *
 * `FichaUsuarioPanelComponent` en cambio SÍ tiene una dependencia real con
 * la página: mientras hay un cambio de rol en preview, la fila de la
 * persona en la matriz (acá, a la izquierda del panel) tiene que pintar el
 * mismo diff, y el velo del panel se vuelve transparente para que se vea.
 * Por eso `rolPreview` (qué rol se está previsualizando) sigue viviendo en
 * la página — el panel lo recibe como `[rolPreviewId]` y lo cambia emitiendo
 * `(rolPreviewSeleccionado)`, en vez de manejarlo por su cuenta — y
 * `matrizPanel()`/`textoCambioRol()` (que si necesitan `nivelDe()`/
 * `MODULOS`) se calculan acá y se pasan ya armados, mismo tipo de excepción
 * que `[mrrTotal]`/`[acciones]` en los paneles anteriores.
 */
@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, FichaUsuarioPanelComponent, CrearUsuarioPanelComponent],
  templateUrl: './usuarios-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosPageComponent implements OnDestroy {
  private readonly usuarioService = inject(UsuarioService);
  private readonly rolService = inject(RolService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly realtimeService = inject(RealtimeService);

  protected readonly iconAgregar = IconUserPlus;
  protected readonly iconBuscar = IconSearch;
  protected readonly iconDerecha = IconChevronRight;
  protected readonly iconMas = IconPlus;
  protected readonly iconCheck = IconCheck;

  protected readonly modulos = MODULOS;
  protected readonly umbralDormido = UMBRAL_DORMIDO;

  protected readonly usuarios = signal<UsuarioGoods[]>([]);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly accesos = signal<Map<number, Acceso>>(new Map());
  /** Quién está conectado AHORA — la carga inicial sale de `GET
   * /usuarios/en-linea` (foto del momento), y `escucharPresencia()` la
   * mantiene al día en vivo con `EVENTO_PRESENCIA_CAMBIO` mientras la
   * pantalla sigue abierta. Ver ADMIN_DISENO.md. */
  protected readonly enLineaIds = signal<Set<number>>(new Set());
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  private presenciaSub: Subscription | undefined;

  protected readonly busqueda = signal('');
  protected readonly modo = signal<ModoPanel>(null);
  protected readonly seleccionadoId = signal<number | null>(null);
  /** Rol elegido en el panel de ficha que todavía no se aplicó — pinta el
   * diff acá y en la fila de la matriz. Ver el docstring de la clase. */
  protected readonly rolPreview = signal<number | null>(null);
  protected readonly rolParaAlta = signal<Rol | undefined>(undefined);

  constructor() {
    this.cargar();
    this.escucharPresencia();
  }

  ngOnDestroy(): void {
    this.presenciaSub?.unsubscribe();
  }

  private cargar(): void {
    this.cargando.set(true);
    forkJoin({
      usuarios: this.usuarioService.listar(),
      roles: this.rolService.listar(),
      auditoria: this.auditoriaService.listar({ pageSize: PAGINA_AUDITORIA }),
      enLinea: this.usuarioService.enLinea(),
    }).subscribe({
      next: ({ usuarios, roles, auditoria, enLinea }) => {
        this.usuarios.set(usuarios.data);
        this.roles.set(roles);
        this.accesos.set(this.reconstruirAccesos(auditoria.data));
        this.enLineaIds.set(new Set(enLinea.ids));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el personal de Goods. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** `GET /usuarios/en-linea` solo da la foto de arranque; esto la
   * mantiene al día mientras la pantalla sigue abierta, sin tener que
   * volver a pedir la lista entera. Se suscribe una sola vez (constructor),
   * no en cada `cargar()` — un re-fetch de usuarios no debería reabrir el
   * socket. */
  private escucharPresencia(): void {
    this.presenciaSub = this.realtimeService
      .escuchar<EventoPresenciaCambio>('presencia:cambio')
      .subscribe(({ usuarioId, enLinea }) => {
        this.enLineaIds.update((actual) => {
          const nuevo = new Set(actual);
          if (enLinea) {
            nuevo.add(usuarioId);
          } else {
            nuevo.delete(usuarioId);
          }
          return nuevo;
        });
      });
  }

  /** Accesos por usuario a partir del log de auditoría. `exitoso === false`
   * cuenta como intento fallido, no como acceso. */
  private reconstruirAccesos(acciones: AuditoriaAccion[]): Map<number, Acceso> {
    const hoy = new Date().setHours(0, 0, 0, 0);
    const mapa = new Map<number, Acceso>();
    for (const a of acciones) {
      if (a.usuarioId === null || !RUTA_LOGIN.test(a.ruta)) {
        continue;
      }
      const actual = mapa.get(a.usuarioId) ?? {
        ultimoMs: null,
        dias: Array.from({ length: DIAS_TIRA }, () => false),
        accesos30: 0,
        fallidos: 0,
      };
      const ms = new Date(a.creadoEn).getTime();
      if (!a.exitoso) {
        actual.fallidos += 1;
        mapa.set(a.usuarioId, actual);
        continue;
      }
      if (actual.ultimoMs === null || ms > actual.ultimoMs) {
        actual.ultimoMs = ms;
      }
      const diasAtras = Math.floor((hoy - new Date(ms).setHours(0, 0, 0, 0)) / MS_DIA);
      if (diasAtras >= 0 && diasAtras < DIAS_TIRA) {
        actual.dias[DIAS_TIRA - 1 - diasAtras] = true;
      }
      if (diasAtras >= 0 && diasAtras < 30) {
        actual.accesos30 += 1;
      }
      mapa.set(a.usuarioId, actual);
    }
    return mapa;
  }

  // ── Permisos ────────────────────────────────────────────────────────────

  /** 0 sin acceso · 1 solo ver · 2 editar · 3 todo. */
  protected nivelDe(rol: Rol | undefined, modulo: ModuloDef): number {
    if (!rol) {
      return 0;
    }
    const codigos = modulo.codigos
      ? rol.permisos.filter((p) => modulo.codigos!.includes(p.codigo)).map((p) => p.codigo.split('.')[1] ?? '')
      : rol.permisos
          .filter((p) => (p.modulo ?? p.codigo.split('.')[0]) === modulo.id)
          .map((p) => p.codigo.split('.')[1] ?? '');
    if (!codigos.length) {
      return 0;
    }
    if (codigos.some((v) => VERBOS_TOTALES.includes(v))) {
      return 3;
    }
    return codigos.some((v) => v !== 'ver') ? 2 : 1;
  }

  protected rolDe(u: UsuarioGoods): Rol | undefined {
    return this.roles().find((r) => r.id === u.rolId);
  }

  protected etiquetaRol(rol: Rol | undefined): string {
    if (!rol) {
      return 'Sin rol';
    }
    return etiquetaRolTexto(rol.nombre);
  }

  private resumenRol(rol: Rol): string {
    if (rol.descripcion) {
      return rol.descripcion;
    }
    const puede = MODULOS.filter((m) => this.nivelDe(rol, m) > 0).map((m) => m.completo.toLowerCase());
    return puede.length ? puede.join(', ') : 'Sin acceso al panel';
  }

  // ── Derivados de la lista ───────────────────────────────────────────────

  /** `Usuario.ultimoAcceso` (columna propia, escrita por
   * `AuthService.registrarAccesoExitoso` desde el fix de "nunca entró para
   * todos") combinado con `acceso.ultimoMs` (reconstruido desde `GET
   * /auditoria`, ver `reconstruirAccesos`) — el que sea más reciente gana.
   * No se reemplaza uno por el otro: `ultimoAcceso` es `null` para
   * cualquier cuenta que no haya vuelto a entrar desde que el campo
   * empezó a escribirse, mientras que la auditoría ya tenía historial real
   * de antes (51 logins del acceso especial de superadmin, por ejemplo) —
   * usar solo el campo nuevo perdería ese historial de golpe. */
  private ultimoMsEfectivo(u: UsuarioGoods, acceso: Acceso | undefined): number | null {
    const desdeUsuario = u.ultimoAcceso ? new Date(u.ultimoAcceso).getTime() : null;
    const desdeAuditoria = acceso?.ultimoMs ?? null;
    if (desdeUsuario === null) {
      return desdeAuditoria;
    }
    if (desdeAuditoria === null) {
      return desdeUsuario;
    }
    return Math.max(desdeUsuario, desdeAuditoria);
  }

  private estadoDe(u: UsuarioGoods, acceso: Acceso | undefined): EstadoAcceso {
    if (!u.activo) {
      return 'desactivado';
    }
    const ms = this.ultimoMsEfectivo(u, acceso);
    if (ms === null) {
      return 'sin_estrenar';
    }
    return this.diasDesde(ms) >= UMBRAL_DORMIDO ? 'dormido' : 'activo';
  }

  private diasDesde(ms: number): number {
    return Math.floor((Date.now() - ms) / MS_DIA);
  }

  /** `enLinea` gana por sobre el texto de días — es más específico y más
   * cierto que "hace X días" en el instante en que de verdad hay una
   * conexión abierta ahora mismo. */
  private textoUltimo(u: UsuarioGoods, acceso: Acceso | undefined, enLinea: boolean): string {
    if (!u.activo) {
      return 'cuenta desactivada';
    }
    if (enLinea) {
      return 'en línea ahora';
    }
    const ms = this.ultimoMsEfectivo(u, acceso);
    if (ms === null) {
      return 'nunca entró';
    }
    const d = this.diasDesde(ms);
    if (d === 0) {
      const h = Math.floor((Date.now() - ms) / 3_600_000);
      return h < 1 ? 'hace minutos' : `hace ${h} h`;
    }
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  protected readonly filtradas = computed<UsuarioGoods[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) {
      return this.usuarios();
    }
    return this.usuarios().filter((u) => `${u.nombres} ${u.apellidos} ${u.correo}`.toLowerCase().includes(q));
  });

  private filaDe(u: UsuarioGoods): FilaUsuario {
    const acceso = this.accesos().get(u.id);
    const estado = this.estadoDe(u, acceso);
    const enLinea = u.activo && this.enLineaIds().has(u.id);
    const rolActual = this.rolDe(u);
    const esSeleccionado = this.seleccionadoId() === u.id && this.modo() === 'ficha';
    const rolMostrado = esSeleccionado ? (this.rolPreviewObj() ?? rolActual) : rolActual;
    return {
      usuario: u,
      nombre: `${u.nombres} ${u.apellidos}`.trim(),
      correo: u.correo,
      estado,
      estadoTexto: ESTADO_UI[estado].texto,
      punto: ESTADO_UI[estado].punto,
      pulso: estado === 'desactivado',
      enLinea,
      ultimo: this.textoUltimo(u, acceso, enLinea),
      tintaUltimo: enLinea ? 'text-badge-success-solid' : estado === 'activo' ? 'text-gray-500' : ESTADO_UI[estado].tinta,
      dias: Array.from({ length: DIAS_TIRA }, (_, i) => {
        const entro = acceso?.dias[i] ?? false;
        const atras = DIAS_TIRA - 1 - i;
        return {
          alto: entro ? '13px' : '3px',
          color: entro ? '#087b5d' : '#ececec',
          titulo: `${atras === 0 ? 'Hoy' : `Hace ${atras} días`} · ${entro ? 'entró' : 'sin acceso'}`,
        };
      }),
      celdas: MODULOS.map((m) => {
        const base = this.nivelDe(rolActual, m);
        const n = this.nivelDe(rolMostrado, m);
        const color = base !== n ? (n > base ? '#087b5d' : '#d82c0d') : TONO[n];
        return {
          titulo: `${m.completo}: ${NIVEL[n]}`,
          s1: n >= 1 ? color : '#ececec',
          s2: n >= 2 ? color : '#ececec',
          s3: n >= 3 ? color : '#ececec',
        };
      }),
    };
  }

  /** Un grupo por rol. Con búsqueda activa los grupos vacíos no se muestran
   * (ni su fila de "agregar"), o la pantalla se llena de encabezados sueltos. */
  protected readonly grupos = computed<GrupoRol[]>(() => {
    const hayBusqueda = this.busqueda().trim().length > 0;
    return this.roles()
      .map((rol) => {
        const filas = this.filtradas()
          .filter((u) => u.rolId === rol.id)
          .map((u) => this.filaDe(u));
        return {
          rol,
          nombre: this.etiquetaRol(rol),
          punto: PUNTO_ROL[rol.nombre] ?? '#c6cad1',
          resumen: this.resumenRol(rol),
          conteo: `${filas.length} ${filas.length === 1 ? 'persona' : 'personas'}`,
          filas,
        };
      })
      .filter((g) => g.filas.length > 0 || !hayBusqueda);
  });

  protected readonly mostrarFilaAgregar = computed(() => this.busqueda().trim().length === 0);

  protected readonly conAcceso = computed(
    () => this.usuarios().filter((u) => this.estadoDe(u, this.accesos().get(u.id)) === 'activo').length,
  );

  protected readonly sinEstrenar = computed(
    () => this.usuarios().filter((u) => this.estadoDe(u, this.accesos().get(u.id)) === 'sin_estrenar').length,
  );

  protected readonly dormidos = computed(() =>
    this.usuarios().filter((u) => this.estadoDe(u, this.accesos().get(u.id)) === 'dormido'),
  );

  protected readonly cifras = computed(() => [
    { valor: `${this.conAcceso()}`, etiqueta: 'Con acceso', tinta: 'text-badge-success-solid' },
    {
      valor: `${this.sinEstrenar()}`,
      etiqueta: 'Sin estrenar',
      tinta: this.sinEstrenar() ? 'text-[#b45309]' : 'text-gray-900',
    },
    {
      valor: `${this.dormidos().length}`,
      etiqueta: `Dormidos ${UMBRAL_DORMIDO}d+`,
      tinta: this.dormidos().length ? 'text-badge-error-solid' : 'text-gray-900',
    },
  ]);

  protected readonly lectura = computed(
    () => 'Quién entra, con qué permisos y desde cuándo no aparece. El rol se elige viendo lo que concede, no por su nombre.',
  );

  /** Chips de la barra: lo que hay que hacer algo al respecto. Un admin
   * dormido y alguien que nunca estrenó la cuenta NO son el mismo caso. */
  protected readonly avisos = computed(() => {
    const salida: { texto: string; punto: string; pulso: boolean; clase: string; id: number }[] = [];
    for (const u of this.dormidos()) {
      const acceso = this.accesos().get(u.id);
      const ms = this.ultimoMsEfectivo(u, acceso);
      salida.push({
        id: u.id,
        texto: `${this.etiquetaRol(this.rolDe(u))} dormido · ${ms !== null ? this.diasDesde(ms) : '?'} d`,
        punto: '#ffb904',
        pulso: false,
        clase: 'border-[#f0e6c8] bg-[#fffdf2] text-[#78350f]',
      });
    }
    for (const u of this.usuarios()) {
      if (this.estadoDe(u, this.accesos().get(u.id)) !== 'sin_estrenar') {
        continue;
      }
      const dias = Math.floor((Date.now() - new Date(u.creadoEn).getTime()) / MS_DIA);
      if (dias < 30) {
        continue;
      }
      salida.push({
        id: u.id,
        texto: `${u.nombres} nunca estrenó su cuenta`,
        punto: '#c6cad1',
        pulso: false,
        clase: 'border-gray-200 bg-gray-50 text-gray-600',
      });
    }
    return salida;
  });

  protected readonly leyenda = computed(() =>
    [0, 1, 2, 3].map((n) => ({
      texto: NIVEL[n],
      s1: n >= 1 ? TONO[n] : '#ececec',
      s2: n >= 2 ? TONO[n] : '#ececec',
      s3: n >= 3 ? TONO[n] : '#ececec',
    })),
  );

  // ── Panel de ficha ──────────────────────────────────────────────────────

  protected readonly seleccionado = computed<UsuarioGoods | null>(
    () => this.usuarios().find((u) => u.id === this.seleccionadoId()) ?? null,
  );

  protected readonly rolPreviewObj = computed<Rol | null>(
    () => this.roles().find((r) => r.id === this.rolPreview()) ?? null,
  );

  /** Matriz del panel: nivel de hoy vs nivel del rol en preview. Se calcula
   * acá (no en `FichaUsuarioPanelComponent`) porque necesita `nivelDe()` +
   * `MODULOS` — ver el docstring de la clase. */
  protected readonly matrizPanel = computed(() => {
    const u = this.seleccionado();
    if (!u) {
      return [];
    }
    const actual = this.rolDe(u);
    const vista = this.rolPreviewObj() ?? actual;
    return MODULOS.map((m) => {
      const a = this.nivelDe(actual, m);
      const n = this.nivelDe(vista, m);
      const cambia = a !== n;
      const color = cambia ? (n > a ? '#087b5d' : '#d82c0d') : TONO[n];
      return {
        modulo: m.completo,
        icono: m.icono,
        texto: NIVEL[a],
        tinta: cambia ? 'text-gray-400' : TINTA_NIVEL[a],
        tachado: cambia,
        nuevo: NIVEL[n],
        tintaNuevo: n > a ? 'text-badge-success-solid' : 'text-badge-error-solid',
        cambia,
        s1: n >= 1 ? color : '#ececec',
        s2: n >= 2 ? color : '#ececec',
        s3: n >= 3 ? color : '#ececec',
      };
    });
  });

  protected readonly textoCambioRol = computed(() => {
    const u = this.seleccionado();
    const vista = this.rolPreviewObj();
    if (!u || !vista) {
      return '';
    }
    const actual = this.rolDe(u);
    const gana = MODULOS.filter((m) => this.nivelDe(vista, m) > this.nivelDe(actual, m));
    const pierde = MODULOS.filter((m) => this.nivelDe(vista, m) < this.nivelDe(actual, m));
    const lista = (ms: typeof MODULOS) => (ms.length ? ms.map((m) => m.completo.toLowerCase()).join(', ') : 'nada');
    return `De ${this.etiquetaRol(actual)} a ${this.etiquetaRol(vista)}: gana ${lista(gana)} y pierde ${lista(pierde)}.`;
  });

  // ── Acciones ────────────────────────────────────────────────────────────

  protected verFicha(u: UsuarioGoods): void {
    this.seleccionadoId.set(u.id);
    this.modo.set('ficha');
    this.rolPreview.set(null);
    this.busqueda.set('');
  }

  protected verFichaPorId(id: number): void {
    const u = this.usuarios().find((x) => x.id === id);
    if (u) {
      this.verFicha(u);
    }
  }

  protected abrirAlta(rol?: Rol): void {
    this.modo.set('crear');
    this.seleccionadoId.set(null);
    this.rolPreview.set(null);
    this.rolParaAlta.set(rol);
  }

  protected cerrarPanel(): void {
    this.modo.set(null);
    this.seleccionadoId.set(null);
    this.rolPreview.set(null);
  }

  /** Reemplaza (o agrega) un usuario en la lista — lo usan tanto el panel
   * de ficha (cambio de rol / edición de datos) como el de alta (usuario
   * recién creado). */
  private upsertUsuario(usuario: UsuarioGoods): void {
    this.usuarios.update((lista) => {
      const existe = lista.some((x) => x.id === usuario.id);
      return existe ? lista.map((x) => (x.id === usuario.id ? usuario : x)) : [...lista, usuario];
    });
  }

  protected onUsuarioActualizado(usuario: UsuarioGoods): void {
    this.upsertUsuario(usuario);
    this.rolPreview.set(null);
  }

  protected onAccesoQuitado(id: number): void {
    this.usuarios.update((lista) => lista.filter((x) => x.id !== id));
    this.cerrarPanel();
  }

  protected onUsuarioCreado(usuario: UsuarioGoods): void {
    this.upsertUsuario(usuario);
    this.cerrarPanel();
  }

  protected mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(null), 2600);
  }
}
