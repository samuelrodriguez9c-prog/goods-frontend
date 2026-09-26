// projects/staff/src/app/features/roles/pages/roles-page/roles-page.component.ts

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IconBuildingStore,
  IconLock,
  IconPlus,
  IconShieldLock,
  IconSparkles,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin, of, switchMap } from 'rxjs';
import { GuardarRolPayload, RolService } from '../../../../core/roles/rol.service';
import { Permiso, Rol } from '../../../../core/roles/models/rol.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { RolPanelComponent } from '../rol-panel/rol-panel.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';

type Preset = 'nada' | 'lectura' | 'total';

/** Orden acumulativo del nivel de acceso: un rol con nivel 3 en un módulo
 * tiene `ver` + `crear` + `editar`. Cualquier verbo que no esté acá se
 * ordena al final (y sube el nivel igual) — ver `ordenarAcciones`. */
const ORDEN_ACCION = ['ver', 'crear', 'editar', 'eliminar'];

/** Orden de las columnas. Los módulos que el backend devuelva y no estén
 * acá se agregan al final por orden alfabético, así una migración nueva
 * de permisos no rompe la pantalla. */
const ORDEN_MODULO = ['auditoria', 'empresas', 'planes', 'suscripciones', 'usuarios', 'roles', 'permisos'];

/** Nombre corto para el encabezado de la columna (la grilla no da para
 * "Suscripciones") y nombre largo para el panel. */
const ETIQUETA_MODULO: Record<string, { corto: string; largo: string }> = {
  auditoria: { corto: 'Auditoría', largo: 'Auditoría' },
  empresas: { corto: 'Empresas', largo: 'Empresas' },
  planes: { corto: 'Planes', largo: 'Planes' },
  suscripciones: { corto: 'Suscrip.', largo: 'Suscripciones' },
  usuarios: { corto: 'Usuarios', largo: 'Usuarios' },
  roles: { corto: 'Roles', largo: 'Roles' },
  permisos: { corto: 'Permisos', largo: 'Permisos' },
};

/** Descripción de respaldo cuando `Permiso.descripcion` viene null. */
const DESCRIPCION_ACCION: Record<string, string> = {
  ver: 'Ver el listado',
  crear: 'Crear un registro',
  editar: 'Editar un registro',
  eliminar: 'Eliminar un registro',
};

/** Rampa de los segmentos: más oscuro = más poder. El último segmento de un
 * módulo de cuatro acciones es destructivo y va en rojo — es la única
 * distinción de color con carga semántica de la matriz, no la quites. */
const TONO = ['#9ca3af', '#6b7280', '#374151'];
const TONO_DESTRUCTIVO = '#d82c0d';
const TONO_VACIO = '#d6d6d6';

/** Id del borrador en el mapa de niveles. No choca con ningún `Rol.id`
 * porque las claves reales son numéricas. */
const BORRADOR = 'nuevo';

/** Mismo ajuste que `ETIQUETA_ROL`/`etiquetaRolTexto()` en
 * `usuarios-page.component.ts` (mismos roles de sistema, mismas
 * etiquetas) — acá aplicado al propio módulo de Roles: un trabajador ve
 * "Admin de Goods" en la matriz y en el panel, no el slug `admin_goods`
 * crudo de la base. Se exporta para que `RolPanelComponent` no tenga que
 * duplicarlo — a diferencia de `CrearUsuarioPanelComponent` (that panel
 * es completamente autónomo, sin dependencia de tiempo de ejecución con
 * su página), `RolPanelComponent` ya depende de `RolesPageComponent`
 * para todo lo demás (`niveles`/`edits` compartidos), así que importar
 * esto de acá es el mismo criterio que `FichaUsuarioPanelComponent`
 * importando `ETIQUETA_ROL`/`etiquetaRolTexto` de `usuarios-page`. */
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

/** Traduce el nombre técnico (slug) de un rol a algo legible. Los roles
 * conocidos de sistema (arriba) tienen etiqueta a mano; cualquier otro —
 * un rol propio creado desde acá mismo, ya con nombre humano tecleado
 * por alguien ("Cajero", "soporte-690") — cae al fallback: separa por
 * `_`/`-` y pone cada palabra en mayúscula inicial, en vez de mostrar el
 * slug crudo. Es puramente de lectura: nunca se usa para el valor de un
 * campo editable (ver `nombreEdicion` en `RolesPageComponent`), solo para
 * la fila de la matriz, el título del panel, y las plantillas de "Partir
 * de" al crear. */
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

interface ModuloMatriz {
  id: string;
  corto: string;
  largo: string;
  acciones: Permiso[];
}

interface Celda {
  modulo: string;
  titulo: string;
  sucia: boolean;
  segmentos: { codigo: string; ancho: string; color: string; nivel: number }[];
}

interface FilaRol {
  rol: Rol;
  nombre: string;
  descripcion: string;
  esSistema: boolean;
  tocada: boolean;
  seleccionada: boolean;
  total: number;
  totalTexto: string;
  anchoBarra: string;
  celdas: Celda[];
}

interface GrupoMatriz {
  titulo: string;
  nota: string;
  etiquetaNuevo: string;
  filas: FilaRol[];
}

interface Borrador {
  nombre: string;
  descripcion: string;
  baseId: number | null;
}

const BORRADOR_VACIO: Borrador = { nombre: '', descripcion: '', baseId: null };

/**
 * "Roles y permisos" como matriz roles × módulos, editable en la celda.
 * Reemplaza la tabla + los tres modales (`abrirCrear`/`abrirEditar`/
 * `abrirPermisos`/`abrirEliminar`) de la pantalla anterior.
 *
 * El modelo mental: el nivel de acceso de un rol en un módulo es
 * **acumulativo** — 0 sin acceso, 1 `ver`, 2 `ver+crear`, 3 `+editar`,
 * 4 `+eliminar`. La celda tiene un segmento por acción real del módulo
 * (`auditoria` y `permisos` tienen una sola, `suscripciones` tres), así que
 * la grilla no miente sobre lo que existe en la tabla `permiso`.
 *
 * Nada viaja al backend hasta confirmar: los cambios viven en `niveles` y se
 * comparan contra `nivelesOriginales`. Guardar hace un
 * `PUT /roles/:id/permisos` por rol tocado (más el `PATCH` si se editó
 * nombre/descripción), que es exactamente lo que ya hacía
 * `guardarPermisos()`, pero en lote y sin modal.
 *
 * El panel lateral (ficha/edición/alta) vive en `RolPanelComponent`, aparte,
 * sibling en `pages/` — mismo patrón que el resto de los módulos
 * (`EmpresaDetallePanelComponent`, `FichaUsuarioPanelComponent`). A
 * diferencia de Usuarios (que separó ficha y alta en dos componentes
 * distintos), acá queda uno solo: el LEEME (§10) diseñó a propósito un
 * único panel que cambia de modo con `creando()`, reusando la misma lista
 * de switches de permisos y los mismos preajustes para ver/editar y para
 * dar de alta — separarlo en dos hubiera duplicado ese template entero,
 * justo lo que el diseño evitaba (ver el docstring de `RolPanelComponent`).
 *
 * `niveles`/`nivelesOriginales`/`edits`/`roles`/`modulos` siguen viviendo
 * acá, no en el panel: la matriz (afuera del panel) tiene que pintar el
 * diff en vivo de TODOS los roles tocados, no solo el que está abierto, y
 * la barra flotante (`tocadosFuera`) necesita lo mismo. El panel recibe
 * todo lo que arma con ese estado ya calculado — `modulosPanel`/
 * `metricas`/`bases`/`metadatos`/`chip`/`nombrePanel`/`textoPie`, etc. —
 * por `@Input`, y `persistir`/`crearRol`/`eliminarRol` (que necesitan ese
 * mismo estado compartido) se quedan acá: el panel solo emite
 * `confirmar`/`eliminar`/`duplicar`, nunca llama a `RolService` por su
 * cuenta. Mismo tipo de excepción que `[matrizPanel]`/`[textoCambioRol]`
 * en `FichaUsuarioPanelComponent`.
 *
 * El panel es un overlay `fixed`, nunca corre la página con `marginRight`
 * — mismo criterio que se corrigió en Usuarios el mismo día que se
 * integró este módulo (ver ADMIN_DISENO.md). A diferencia de
 * Empresas/Usuarios, su backdrop es transparente en vez de oscurecer la
 * pantalla — ver el docstring de `RolPanelComponent`.
 *
 * Los nombres de rol que se MUESTRAN (fila de la matriz, título del
 * panel, plantillas de "Partir de") pasan por `etiquetaRolTexto()` —
 * mismo ajuste que ya tenía Usuarios para sus cabeceras de grupo, ahora
 * también acá: un rol de sistema como `admin_goods` se lee "Admin de
 * Goods", no el slug crudo. El campo editable nunca pasa por ahí (ver
 * `nombreEdicion`), así que lo que se guarda es siempre, letra por letra,
 * lo que la persona tecleó — la traducción es puramente de lectura.
 */
@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [TablerIconComponent, RolPanelComponent, PantallaEstadoComponent, CabeceraModuloComponent],
  templateUrl: './roles-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPageComponent {
  private readonly rolService = inject(RolService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly iconos = {
    buildingStore: IconBuildingStore,
    lock: IconLock,
    plus: IconPlus,
    shieldLock: IconShieldLock,
    sparkles: IconSparkles,
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );
  protected readonly guardando = signal(false);

  protected readonly roles = signal<Rol[]>([]);
  protected readonly permisos = signal<Permiso[]>([]);

  /** Estado editable: `"<rolId|nuevo>:<modulo>" -> nivel`. */
  protected readonly niveles = signal<Map<string, number>>(new Map());
  /** Copia de lo que hay guardado en el backend, para el diff. */
  private readonly nivelesOriginales = signal<Map<string, number>>(new Map());
  /** Ediciones de nombre/descripción sin guardar, por `rol.id`. */
  protected readonly edits = signal<Map<number, { nombre?: string; descripcion?: string }>>(new Map());

  protected readonly seleccionadoId = signal<number | null>(null);
  protected readonly creando = signal(false);
  protected readonly borrador = signal<Borrador>({ ...BORRADOR_VACIO });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      roles: this.rolService.listar(),
      permisos: this.rolService.listarPermisos(),
    }).subscribe({
      next: ({ roles, permisos }) => {
        this.roles.set(roles);
        this.permisos.set(permisos);
        this.sincronizarNiveles(roles, permisos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de roles y permisos. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  // ── Catálogo de módulos ─────────────────────────────────────────────────

  private moduloDe(p: Permiso): string {
    return p.modulo ?? p.codigo.split('.')[0];
  }

  private accionDe(p: Permiso): string {
    return p.codigo.split('.')[1] ?? p.codigo;
  }

  /** Acciones de un módulo en orden acumulativo. Un verbo desconocido
   * (`gestionar`, `rechazar`, …) va al final: sube el nivel pero nunca
   * desordena `ver` → `eliminar`. */
  private ordenarAcciones(lista: Permiso[]): Permiso[] {
    return [...lista].sort((a, b) => {
      const ia = ORDEN_ACCION.indexOf(this.accionDe(a));
      const ib = ORDEN_ACCION.indexOf(this.accionDe(b));
      return (ia === -1 ? ORDEN_ACCION.length : ia) - (ib === -1 ? ORDEN_ACCION.length : ib);
    });
  }

  protected readonly modulos = computed<ModuloMatriz[]>(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const p of this.permisos()) {
      const id = this.moduloDe(p);
      grupos.set(id, [...(grupos.get(id) ?? []), p]);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => {
        const ia = ORDEN_MODULO.indexOf(a);
        const ib = ORDEN_MODULO.indexOf(b);
        if (ia === -1 && ib === -1) {
          return a.localeCompare(b);
        }
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .map(([id, lista]) => ({
        id,
        corto: ETIQUETA_MODULO[id]?.corto ?? id,
        largo: ETIQUETA_MODULO[id]?.largo ?? id,
        acciones: this.ordenarAcciones(lista),
      }));
  });

  protected readonly totalAcciones = computed(() =>
    this.modulos().reduce((s, m) => s + m.acciones.length, 0),
  );

  /** Ancho del segmento según cuántas acciones tenga el módulo, para que
   * todas las celdas midan lo mismo. Escalado hacia arriba junto con el
   * ancho de columna de módulo (ajuste "se ve apretado" del 2026-09-22:
   * 52px → minmax(88px, 1fr) y gap-0.5 → gap-1 en la celda). */
  protected anchoSegmento(cantidad: number): string {
    if (cantidad === 1) {
      return '44px';
    }
    return cantidad === 3 ? '15px' : '10px';
  }

  protected descripcionDe(p: Permiso): string {
    return p.descripcion ?? DESCRIPCION_ACCION[this.accionDe(p)] ?? p.codigo;
  }

  // ── Niveles ─────────────────────────────────────────────────────────────

  /** Nivel = cuántas acciones consecutivas (desde `ver`) tiene el rol. Si el
   * backend tiene un set "con agujeros" (ej. `editar` sin `crear`), el nivel
   * es la cantidad de acciones otorgadas: guardar lo normaliza al prefijo.
   * Ver LEEME, punto 4. */
  private nivelGuardado(rol: Rol, modulo: ModuloMatriz): number {
    const ids = new Set(rol.permisos.map((p) => p.id));
    return modulo.acciones.filter((a) => ids.has(a.id)).length;
  }

  private sincronizarNiveles(roles: Rol[], permisos: Permiso[]): void {
    const modulos = this.modulosDe(permisos);
    const mapa = new Map<string, number>();
    for (const rol of roles) {
      for (const m of modulos) {
        mapa.set(`${rol.id}:${m.id}`, this.nivelGuardado(rol, m));
      }
    }
    this.niveles.set(mapa);
    this.nivelesOriginales.set(new Map(mapa));
    this.edits.set(new Map());
  }

  /** Igual que `modulos()` pero sobre una lista suelta — lo necesita
   * `sincronizarNiveles` antes de que el signal `permisos` esté aplicado. */
  private modulosDe(permisos: Permiso[]): ModuloMatriz[] {
    const grupos = new Map<string, Permiso[]>();
    for (const p of permisos) {
      const id = this.moduloDe(p);
      grupos.set(id, [...(grupos.get(id) ?? []), p]);
    }
    return [...grupos.entries()].map(([id, lista]) => ({
      id,
      corto: ETIQUETA_MODULO[id]?.corto ?? id,
      largo: ETIQUETA_MODULO[id]?.largo ?? id,
      acciones: this.ordenarAcciones(lista),
    }));
  }

  protected nivel(clave: string | number, modulo: string): number {
    return this.niveles().get(`${clave}:${modulo}`) ?? 0;
  }

  private nivelOriginal(clave: string | number, modulo: string): number {
    return this.nivelesOriginales().get(`${clave}:${modulo}`) ?? 0;
  }

  protected fijar(clave: string | number, modulo: string, nivel: number): void {
    this.niveles.update((m) => new Map(m).set(`${clave}:${modulo}`, nivel));
  }

  /** Click en un segmento: lo enciende, o lo apaga si ya era el último. */
  protected alternarSegmento(clave: string | number, modulo: string, indice: number): void {
    const actual = this.nivel(clave, modulo);
    this.fijar(clave, modulo, actual === indice + 1 ? indice : indice + 1);
  }

  /** Click en el encabezado de una columna: acceso total a todos los roles,
   * o vuelta a lo guardado si ya estaban todos en total. */
  protected aplicarColumna(modulo: ModuloMatriz): void {
    const todos = this.roles().every((r) => this.nivel(r.id, modulo.id) === modulo.acciones.length);
    this.niveles.update((m) => {
      const copia = new Map(m);
      for (const r of this.roles()) {
        copia.set(
          `${r.id}:${modulo.id}`,
          todos ? this.nivelOriginal(r.id, modulo.id) : modulo.acciones.length,
        );
      }
      return copia;
    });
  }

  protected aplicarPreset(preset: Preset): void {
    const clave = this.claveObjetivo();
    if (clave === null) {
      return;
    }
    this.niveles.update((m) => {
      const copia = new Map(m);
      for (const mod of this.modulos()) {
        copia.set(
          `${clave}:${mod.id}`,
          preset === 'nada' ? 0 : preset === 'lectura' ? Math.min(1, mod.acciones.length) : mod.acciones.length,
        );
      }
      return copia;
    });
  }

  // ── Matriz ──────────────────────────────────────────────────────────────

  private colorSegmento(indice: number, cantidad: number): string {
    if (indice === cantidad - 1 && cantidad === 4) {
      return TONO_DESTRUCTIVO;
    }
    return TONO[Math.min(indice, TONO.length - 1)];
  }

  protected esPropio(rol: Rol): boolean {
    return !rol.esRolSistema;
  }

  protected nombreDe(rol: Rol): string {
    return this.edits().get(rol.id)?.nombre ?? rol.nombre;
  }

  /** Versión legible de `nombreDe()` — para la fila de la matriz, el
   * título del panel y las plantillas de "Partir de" al crear. Nunca para
   * un campo editable: ver `nombreEdicion`, que le pasa al panel el
   * mismo `nombreDe()` crudo (sin este `etiquetaRolTexto()`) para que el
   * input de "Datos del rol" muestre y guarde exactamente lo que hay,
   * letra por letra. */
  protected nombreMostrado(rol: Rol): string {
    return etiquetaRolTexto(this.nombreDe(rol));
  }

  protected descripcionRol(rol: Rol): string {
    return this.edits().get(rol.id)?.descripcion ?? rol.descripcion ?? '';
  }

  private totalDe(clave: string | number): number {
    return this.modulos().reduce((s, m) => s + this.nivel(clave, m.id), 0);
  }

  private modulosConAcceso(clave: string | number): number {
    return this.modulos().filter((m) => this.nivel(clave, m.id) > 0).length;
  }

  private celdasDe(clave: string | number): Celda[] {
    return this.modulos().map((m) => {
      const nivel = this.nivel(clave, m.id);
      const otorgadas = m.acciones.slice(0, nivel).map((a) => this.accionDe(a));
      return {
        modulo: m.id,
        titulo: `${m.largo} — ${nivel === 0 ? 'sin acceso' : otorgadas.join(', ')}`,
        sucia: nivel !== this.nivelOriginal(clave, m.id),
        segmentos: m.acciones.map((a, i) => ({
          codigo: a.codigo,
          ancho: this.anchoSegmento(m.acciones.length),
          color: i < nivel ? this.colorSegmento(i, m.acciones.length) : TONO_VACIO,
          nivel: i,
        })),
      };
    });
  }

  private filaDe(rol: Rol): FilaRol {
    const total = this.totalDe(rol.id);
    const celdas = this.celdasDe(rol.id);
    return {
      rol,
      nombre: this.nombreMostrado(rol),
      descripcion: this.descripcionRol(rol),
      esSistema: rol.esRolSistema,
      tocada: celdas.some((c) => c.sucia) || this.edits().has(rol.id),
      seleccionada: this.seleccionadoId() === rol.id,
      total,
      totalTexto: `${total} / ${this.totalAcciones()}`,
      anchoBarra: `${Math.round((total / Math.max(1, this.totalAcciones())) * 100)}%`,
      celdas,
    };
  }

  /** Dos grupos: plantillas del sistema (`esRolSistema`) y roles propios de
   * cada cliente. Hoy la tabla los mezclaba sin distinguirlos. */
  protected readonly grupos = computed<GrupoMatriz[]>(() => [
    {
      titulo: 'Plantillas del sistema',
      nota: 'compartidas por todo Goods — se pueden reconfigurar, no renombrar',
      etiquetaNuevo: 'Nueva plantilla del sistema',
      filas: this.roles().filter((r) => r.esRolSistema).map((r) => this.filaDe(r)),
    },
    {
      titulo: 'Roles propios de clientes',
      nota: 'creados por cada negocio desde su propio panel',
      etiquetaNuevo: 'Crear un rol para un cliente',
      filas: this.roles().filter((r) => !r.esRolSistema).map((r) => this.filaDe(r)),
    },
  ]);

  protected readonly leyenda = computed(() => [
    { texto: 'Sin acceso', color: '#d4d4d4' },
    { texto: 'Ver', color: TONO[0] },
    { texto: 'Crear', color: TONO[1] },
    { texto: 'Editar', color: TONO[2] },
    { texto: 'Eliminar', color: TONO_DESTRUCTIVO },
  ]);

  protected readonly cifras = computed(() => [
    { valor: `${this.roles().length}`, etiqueta: 'roles activos' },
    {
      valor: `${this.totalAcciones()}`,
      etiqueta: `permisos en ${this.modulos().length} módulos`,
    },
    {
      valor: `${this.roles().filter((r) => !r.esRolSistema).length}`,
      etiqueta: 'roles propios de clientes',
    },
  ]);

  /** Cabecera compartida (LEEME.md §14) — mismos 3 valores de `cifras()`,
   *  sin serie: no hay historia de roles en el tiempo. La leyenda de
   *  niveles sigue fuera de la cabecera, debajo.
   *
   *  Migrada a v2 (badge) por LEEME.md §16, 2026-09-24 — el badge lo pone
   *  el HTML (`roles().length + ' roles activos'`). La tabla del handoff
   *  sugiere `serieAcumulada(roles.map(r => r.creadoEn))`, pero `Rol` (ver
   *  `rol.model.ts`) no tiene `creadoEn`: el backend no lo expone. Sigue sin
   *  serie, como ya decía este mismo comentario antes de la migración. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() =>
    this.cifras().map((c, i): MetricaCabecera => ({ id: `cifra-${i}`, etiqueta: c.etiqueta, valor: c.valor })),
  );

  // ── Diff global ─────────────────────────────────────────────────────────

  private rolesTocados(): number[] {
    const ids = new Set<number>();
    for (const rol of this.roles()) {
      const cambio =
        this.modulos().some((m) => this.nivel(rol.id, m.id) !== this.nivelOriginal(rol.id, m.id)) ||
        this.edits().has(rol.id);
      if (cambio) {
        ids.add(rol.id);
      }
    }
    return [...ids];
  }

  private celdasCambiadas(rolId: number): number {
    return this.modulos().filter((m) => this.nivel(rolId, m.id) !== this.nivelOriginal(rolId, m.id))
      .length;
  }

  /** La barra flotante solo habla de los roles tocados que NO están en el
   * panel: los del panel se confirman desde su pie. */
  protected readonly tocadosFuera = computed(() =>
    this.rolesTocados().filter((id) => id !== this.seleccionadoId()),
  );

  protected readonly textoBarra = computed(() => {
    const total = this.rolesTocados().reduce((s, id) => s + this.celdasCambiadas(id), 0);
    return total === 1 ? '1 cambio sin guardar' : `${total} cambios sin guardar`;
  });

  protected readonly detalleBarra = computed(() => {
    const n = this.rolesTocados().length;
    return n === 1 ? 'en 1 rol' : `en ${n} roles`;
  });

  protected descartarTodo(): void {
    this.niveles.set(new Map(this.nivelesOriginales()));
    this.edits.set(new Map());
  }

  /** Un `PUT /roles/:id/permisos` (+ `PATCH` si cambió el texto) por rol
   * tocado. El backend ya reemplaza el set completo, así que mandar el
   * prefijo del nivel es suficiente. */
  protected guardarTodo(): void {
    const ids = this.rolesTocados();
    if (!ids.length || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.alertas
      .seguir(forkJoin(ids.map((id) => this.persistir(id))), {
        titulo: 'Guardando cambios',
        texto: ids.length === 1 ? 'en 1 rol' : `en ${ids.length} roles`,
        exito: { titulo: ids.length === 1 ? 'Rol actualizado' : `${ids.length} roles actualizados` },
        error: { titulo: 'No se pudo guardar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: (actualizados) => {
          this.aplicarActualizados(actualizados);
          this.guardando.set(false);
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  /** Ids de permiso que corresponden al nivel actual de cada módulo. */
  private permisoIdsDe(clave: string | number): number[] {
    return this.modulos().flatMap((m) =>
      m.acciones.slice(0, this.nivel(clave, m.id)).map((a) => a.id),
    );
  }

  private persistir(rolId: number) {
    const rol = this.roles().find((r) => r.id === rolId);
    const edit = this.edits().get(rolId);
    const permisos$ = this.rolService.asignarPermisos(rolId, this.permisoIdsDe(rolId));
    if (!edit || !rol || rol.esRolSistema) {
      return permisos$;
    }
    const payload: Partial<GuardarRolPayload> = {
      nombre: (edit.nombre ?? rol.nombre).trim(),
      descripcion: (edit.descripcion ?? rol.descripcion ?? '').trim() || undefined,
    };
    return this.rolService.actualizar(rolId, payload).pipe(switchMap(() => permisos$));
  }

  private aplicarActualizados(actualizados: Rol[]): void {
    this.roles.update((lista) =>
      lista.map((r) => actualizados.find((a) => a.id === r.id) ?? r),
    );
    this.nivelesOriginales.set(new Map(this.niveles()));
    this.edits.set(new Map());
  }

  // ── Panel ───────────────────────────────────────────────────────────────

  protected readonly seleccionado = computed<Rol | null>(
    () => this.roles().find((r) => r.id === this.seleccionadoId()) ?? null,
  );

  protected readonly panelAbierto = computed(() => this.creando() || this.seleccionado() !== null);

  /** Clave con la que se indexan los niveles del panel: el id del rol, o
   * `'nuevo'` mientras se arma el borrador. */
  protected claveObjetivo(): string | number | null {
    if (this.creando()) {
      return BORRADOR;
    }
    return this.seleccionadoId();
  }

  protected abrirRol(rol: Rol): void {
    if (!this.creando() && this.seleccionadoId() === rol.id) {
      this.cerrarPanel();
      return;
    }
    this.creando.set(false);
    this.seleccionadoId.set(rol.id);
  }

  /** El alta abre el mismo panel en la pestaña Datos (la pestaña activa
   * es estado interno de `RolPanelComponent` — se resetea sola cuando
   * cambia `creando()`, ver su docstring), con el borrador en cero. No
   * hay modal de "Nuevo rol". */
  protected abrirCreacion(base?: Rol): void {
    this.seleccionadoId.set(null);
    this.creando.set(true);
    this.borrador.set({
      nombre: '',
      descripcion: '',
      baseId: base?.id ?? null,
    });
    this.niveles.update((m) => {
      const copia = new Map(m);
      for (const mod of this.modulos()) {
        copia.set(`${BORRADOR}:${mod.id}`, base ? this.nivel(base.id, mod.id) : 0);
      }
      return copia;
    });
  }

  protected cerrarPanel(): void {
    this.creando.set(false);
    this.seleccionadoId.set(null);
  }

  protected readonly chip = computed(() => {
    if (this.creando()) {
      return {
        texto: 'Nuevo rol',
        icono: this.iconos.sparkles,
        clase: 'bg-[#eef2ff] text-[#3730a3]',
      };
    }
    const rol = this.seleccionado();
    if (rol?.esRolSistema) {
      return { texto: 'Plantilla del sistema', icono: this.iconos.shieldLock, clase: 'bg-canvas-bg text-gray-600' };
    }
    return {
      texto: 'Rol propio de cliente',
      icono: this.iconos.buildingStore,
      clase: 'bg-[#e9f3ee] text-badge-success-solid',
    };
  });

  /** Título del panel — pasa por `etiquetaRolTexto()` cuando se está
   * viendo un rol existente (un `admin_goods` se lee "Admin de Goods").
   * Mientras se está creando uno nuevo queda crudo: es lo que la persona
   * está tecleando en ese mismo instante, no un slug de la base que haga
   * falta traducir. Para el VALOR del input editable, ver
   * `nombreEdicion` — nunca este. */
  protected readonly nombrePanel = computed(() => {
    if (this.creando()) {
      return this.borrador().nombre.trim();
    }
    const rol = this.seleccionado();
    return rol ? this.nombreMostrado(rol) : '';
  });

  /** Valor crudo para el input de "Datos del rol" — a diferencia de
   * `nombrePanel()` (título, ya "prolijo"), este tiene que reflejar
   * exactamente lo guardado o lo que se está tecleando, letra por letra:
   * si mostrara la versión traducida, cada tecla pisaría el cursor y lo
   * que se termina guardando dejaría de ser lo que la persona ve
   * escrito. */
  protected readonly nombreEdicion = computed(() => {
    if (this.creando()) {
      return this.borrador().nombre;
    }
    const rol = this.seleccionado();
    return rol ? this.nombreDe(rol) : '';
  });

  protected readonly descripcionPanel = computed(() => {
    if (this.creando()) {
      return this.borrador().descripcion;
    }
    const rol = this.seleccionado();
    return rol ? this.descripcionRol(rol) : '';
  });

  protected readonly subtitulo = computed(() => {
    if (this.creando()) {
      return 'Definí nombre y permisos — se crea cuando confirmás.';
    }
    const rol = this.seleccionado();
    if (!rol) {
      return '';
    }
    return rol.esRolSistema
      ? 'Reconfigurable, no renombrable — es una plantilla compartida.'
      : `Rol propio · ${rol.permisos.length} permisos guardados`;
  });

  /** Tira de métricas del panel. NOTA: el mockup mostraba "usuarios" como
   * tercera métrica; `Rol` no trae ese conteo (`GET /roles` no cuenta
   * usuarios por rol), así que va "módulos sin acceso". Si el backend
   * agrega `usuariosCount`, es un cambio de una línea. Ver LEEME, punto 11. */
  protected readonly metricas = computed(() => {
    const clave = this.claveObjetivo();
    if (clave === null) {
      return [];
    }
    return [
      { valor: `${this.totalDe(clave)} / ${this.totalAcciones()}`, etiqueta: 'permisos' },
      { valor: `${this.modulosConAcceso(clave)} / ${this.modulos().length}`, etiqueta: 'módulos' },
      {
        valor: `${this.modulos().length - this.modulosConAcceso(clave)}`,
        etiqueta: 'sin acceso',
      },
    ];
  });

  /** Módulos con sus acciones como switches — los códigos exactos que
   * viajan al backend, para que el panel no esconda el detalle. */
  protected readonly modulosPanel = computed(() => {
    const clave = this.claveObjetivo();
    if (clave === null) {
      return [];
    }
    return this.modulos().map((m) => {
      const nivel = this.nivel(clave, m.id);
      return {
        id: m.id,
        nombre: m.largo,
        resumen: nivel === 0 ? 'sin acceso' : `${nivel} de ${m.acciones.length}`,
        etiquetaTodo: nivel === m.acciones.length ? 'Quitar todo' : 'Dar todo',
        nivelTotal: nivel === m.acciones.length ? 0 : m.acciones.length,
        acciones: m.acciones.map((a, i) => ({
          codigo: a.codigo,
          descripcion: this.descripcionDe(a),
          activa: i < nivel,
          indice: i,
          destructiva: i === m.acciones.length - 1 && m.acciones.length === 4,
        })),
      };
    });
  });

  /** Plantillas ofrecidas como punto de partida al crear. */
  protected readonly bases = computed(() =>
    [null, ...this.roles().filter((r) => r.esRolSistema)].map((rol) => ({
      rol,
      etiqueta: rol ? this.nombreMostrado(rol) : 'Desde cero',
      conteo: rol ? `${this.totalDe(rol.id)} permisos` : '0 permisos',
      elegida: this.borrador().baseId === (rol?.id ?? null),
    })),
  );

  protected elegirBase(rol: Rol | null): void {
    this.borrador.update((b) => ({ ...b, baseId: rol?.id ?? null }));
    this.niveles.update((m) => {
      const copia = new Map(m);
      for (const mod of this.modulos()) {
        copia.set(`${BORRADOR}:${mod.id}`, rol ? this.nivel(rol.id, mod.id) : 0);
      }
      return copia;
    });
  }

  protected readonly metadatos = computed(() => {
    const rol = this.seleccionado();
    if (!rol) {
      return [];
    }
    return [
      { clave: 'Permisos guardados', valor: `${rol.permisos.length}` },
      { clave: 'Pertenece a', valor: rol.esRolSistema ? 'Todo el sistema' : 'Un cliente' },
      { clave: 'Se puede eliminar', valor: rol.esRolSistema ? 'No — rol del sistema' : 'Sí' },
    ];
  });

  protected actualizarTexto(campo: 'nombre' | 'descripcion', valor: string): void {
    if (this.creando()) {
      this.borrador.update((b) => ({ ...b, [campo]: valor }));
      return;
    }
    const rol = this.seleccionado();
    if (!rol) {
      return;
    }
    this.edits.update((m) => {
      const copia = new Map(m);
      copia.set(rol.id, { ...(copia.get(rol.id) ?? {}), [campo]: valor });
      return copia;
    });
  }

  protected readonly nombreValido = computed(() => this.borrador().nombre.trim().length >= 3);

  protected readonly hayCambiosPanel = computed(() => {
    const rol = this.seleccionado();
    if (!rol) {
      return false;
    }
    return this.celdasCambiadas(rol.id) > 0 || this.edits().has(rol.id);
  });

  /** El pie tiene que nombrar lo que de verdad cambió: los niveles de la
   * matriz y los campos del formulario son dos fuentes distintas. */
  protected readonly textoPie = computed(() => {
    if (this.creando()) {
      return this.nombreValido()
        ? `Se creará con ${this.totalDe(BORRADOR)} permisos.`
        : 'Poné un nombre para poder crearlo.';
    }
    const rol = this.seleccionado();
    if (!rol) {
      return '';
    }
    const edit = this.edits().get(rol.id);
    const modulos = this.celdasCambiadas(rol.id);
    const partes: string[] = [];
    let plural = false;
    if (edit?.nombre !== undefined && edit?.descripcion !== undefined) {
      partes.push('Nombre y descripción');
      plural = true;
    } else if (edit?.nombre !== undefined) {
      partes.push('Nombre');
    } else if (edit?.descripcion !== undefined) {
      partes.push('Descripción');
    }
    if (modulos > 0) {
      partes.push(modulos === 1 ? '1 módulo' : `${modulos} módulos`);
      plural = plural || modulos > 1;
    }
    if (partes.length > 1) {
      plural = true;
    }
    return partes.length
      ? `${partes.join(' + ')} ${plural ? 'modificados' : 'modificado'}`
      : 'Sin cambios pendientes';
  });

  protected readonly puedeConfirmar = computed(() =>
    this.creando() ? this.nombreValido() && !this.guardando() : this.hayCambiosPanel() && !this.guardando(),
  );

  protected confirmarPanel(): void {
    if (!this.puedeConfirmar()) {
      return;
    }
    if (this.creando()) {
      this.crearRol();
      return;
    }
    const rol = this.seleccionado();
    if (!rol) {
      return;
    }
    this.guardando.set(true);
    this.alertas
      .seguir(this.persistir(rol.id), {
        titulo: 'Guardando el rol',
        texto: this.nombreMostrado(rol),
        exito: { titulo: `${this.nombreMostrado(rol)} actualizado` },
        error: { titulo: 'No se pudo guardar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: (actualizado) => {
          this.aplicarActualizados([actualizado]);
          this.guardando.set(false);
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  /** `POST /roles` no acepta permisos, así que hay que encadenar el
   * `PUT /roles/:id/permisos` con los ids del borrador. */
  private crearRol(): void {
    const b = this.borrador();
    this.guardando.set(true);
    const payload: GuardarRolPayload = {
      nombre: b.nombre.trim(),
      descripcion: b.descripcion.trim() || undefined,
    };
    const ids = this.permisoIdsDe(BORRADOR);
    this.alertas
      .seguir(
        this.rolService
          .crear(payload)
          .pipe(switchMap((creado) => (ids.length ? this.rolService.asignarPermisos(creado.id, ids) : of(creado)))),
        {
          titulo: 'Creando el rol',
          texto: payload.nombre,
          exito: { titulo: `Rol "${payload.nombre}" creado` },
          error: { titulo: 'No se pudo crear el rol', texto: 'Intenta de nuevo.' },
        },
      )
      .subscribe({
        next: (rol) => {
          this.roles.update((lista) => [...lista, rol]);
          this.niveles.update((m) => {
            const copia = new Map(m);
            for (const mod of this.modulos()) {
              copia.set(`${rol.id}:${mod.id}`, this.nivel(BORRADOR, mod.id));
              copia.set(`${BORRADOR}:${mod.id}`, 0);
            }
            return copia;
          });
          this.nivelesOriginales.set(new Map(this.niveles()));
          this.guardando.set(false);
          this.cerrarPanel();
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  protected eliminarRol(): void {
    const rol = this.seleccionado();
    if (!rol || rol.esRolSistema || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.alertas
      .seguir(this.rolService.eliminar(rol.id), {
        titulo: 'Eliminando el rol',
        texto: this.nombreMostrado(rol),
        exito: { titulo: `Rol "${rol.nombre}" eliminado` },
        error: { titulo: 'No se pudo eliminar el rol', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.roles.update((lista) => lista.filter((r) => r.id !== rol.id));
          this.guardando.set(false);
          this.cerrarPanel();
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  /** `(reintentar)` de `app-pantalla-estado`. */
  protected reintentar(): void {
    this.cargar();
  }

  /** `(volver)` — mismo criterio que `EmpresasPageComponent.volver()`. */
  protected volver(): void {
    this.router.navigateByUrl('/roles');
  }
}
