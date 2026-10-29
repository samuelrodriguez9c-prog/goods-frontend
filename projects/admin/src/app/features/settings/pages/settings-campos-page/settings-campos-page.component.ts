import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  toArray,
} from 'rxjs';
import { TarjetasPlegablesComponent } from '../../../../shared/ui/tarjetas-plegables/tarjetas-plegables.component';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  ActualizarCampoPayload,
  CambioHistorialCampo,
  CampoPersonalizado,
  ENTIDADES,
  EntidadCampo,
  TIPOS,
  TOPE_CAMPOS,
  TipoCampo,
  UsoCampo,
  errorValor,
} from '../../../../core/campos/campo-personalizado.model';
import { CampoPersonalizadoService } from '../../../../core/campos/campo-personalizado.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { esTeclaDeLista, normalizar } from '../../../../shared/ui/persona';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';
import {
  Atajo,
  AtajosTecladoComponent,
} from '../../shared/ui/atajos-teclado/atajos-teclado.component';
import { BuscadorListaComponent } from '../../shared/ui/buscador-lista/buscador-lista.component';
import { FichaBarraComponent } from '../../shared/ui/ficha-barra/ficha-barra.component';
import { FichaVaciaComponent } from '../../shared/ui/ficha-vacia/ficha-vacia.component';
import { FilaListaComponent } from '../../shared/ui/fila-lista/fila-lista.component';
import { ListaFichaComponent } from '../../shared/ui/lista-ficha/lista-ficha.component';
import {
  ItemMenuComponent,
  MenuFichaComponent,
} from '../../shared/ui/menu-ficha/menu-ficha.component';
import { PastillaCabeceraComponent } from '../../shared/ui/pastilla-cabecera/pastilla-cabecera.component';
import {
  AccionMasiva,
  BarraSeleccionComponent,
} from './components/barra-seleccion/barra-seleccion.component';
import {
  CabeceraCampoComponent,
  PESTANAS,
  PestanaCampo,
} from './components/cabecera-campo/cabecera-campo.component';
import {
  TarjetaCapacidadComponent,
  CapacidadEntidad,
} from './components/capacidad-campos/capacidad-campos.component';
import { FilaCampoComponent } from './components/fila-campo/fila-campo.component';
import {
  EstadoCampos,
  FiltrosCamposComponent,
  OpcionFiltroCampo,
} from './components/filtros-campos/filtros-campos.component';
import { GrupoCamposComponent } from './components/grupo-campos/grupo-campos.component';
import {
  CambioCampo,
  PestanaGeneralComponent,
} from './components/pestana-general/pestana-general.component';
import {
  EleccionNuevoCampo,
  ModalNuevoCampoComponent,
} from './components/modal-nuevo-campo/modal-nuevo-campo.component';
import { PestanaActividadComponent } from './components/pestana-actividad/pestana-actividad.component';
import { PestanaValidacionComponent } from './components/pestana-validacion/pestana-validacion.component';
import { PestanaVisibilidadComponent } from './components/pestana-visibilidad/pestana-visibilidad.component';
import { PestanaVistaPreviaComponent } from './components/pestana-vista-previa/pestana-vista-previa.component';
import {
  BorradorCampo,
  ICONO_ENTIDAD,
  ICONO_TIPO,
  LUGARES,
  LugarCampo,
  SINGULAR_ENTIDAD,
  aplicaTienda,
  borradorDe,
  borradorDePlantilla,
  borradorVacio,
  campoDe,
  claveDe,
  crearDe,
  cuentaReglas,
  detalleDe,
  firmaBorrador,
  llevaDefecto,
  nombreEntidad,
} from './campos.util';

const ATAJOS: Atajo[] = [
  { t: 'Nuevo campo', k: 'N' },
  { t: 'Buscar', k: '/' },
  { t: 'Campo anterior / siguiente', k: '↑ ↓' },
  { t: 'Cambiar pestaña', k: '1–5' },
  { t: 'Página completa', k: 'F' },
  { t: 'Guardar', k: '⌘S' },
  { t: 'Cerrar o cancelar', k: 'Esc' },
];

const OPCIONES_ESTADO: { k: EstadoCampos; t: string; d: string; icono: string }[] = [
  { k: 'todos', t: 'Todos', d: 'Activos e inactivos', icono: 'list-details' },
  { k: 'activos', t: 'Activos', d: 'Se ven en los formularios', icono: 'eye' },
  { k: 'inactivos', t: 'Inactivos', d: 'Ocultos, con sus datos guardados', icono: 'eye-off' },
  { k: 'requeridos', t: 'Requeridos', d: 'Obligatorios al guardar', icono: 'asterisk' },
];

/** Cómo se nombra cada parte del borrador en «Cambiaste el nombre y la validación». */
const PARTES: [keyof BorradorCampo, string][] = [
  ['etiqueta', 'el nombre'],
  ['ayuda', 'la ayuda'],
  ['opciones', 'las opciones'],
  ['colores', 'las opciones'],
  ['obligatorio', 'obligatorio'],
  ['activo', 'el estado'],
  ['placeholder', 'el texto de ejemplo'],
  ['defecto', 'el valor por defecto'],
  ['reglas', 'la validación'],
  ['visibilidad', 'la visibilidad'],
  ['editan', 'quién edita'],
];

const PERMISO = 'campos.gestionar';
const SIN_PERMISO =
  'Necesitas el permiso «Definir los campos propios». Pídeselo a quien administra los roles.';

/**
 * Campos propios: lista agrupada por sección (Productos, Clientes, Pedidos,
 * Proveedores) y hoja del campo con pestañas General, Validación,
 * Visibilidad, Vista previa y Actividad.
 *
 * @remarks
 * - Capacidad: hasta `TOPE_CAMPOS` activos por sección, en tarjetas bajo la
 *   cabecera.
 * - «Nuevo campo» abre las plantillas de la sección; la hoja edita un
 *   borrador que se muestra con `alerta.fijarCambios` (estado `error` si no
 *   es válido); ⌘/Ctrl+S guarda. Con cambios sin guardar no se cambia de
 *   campo: la alerta se sacude.
 * - Al abrir un campo se piden su uso (registros con el dato y por opción) y
 *   su historial.
 * - Sin `campos.gestionar` la página es de solo lectura.
 * - Un campo con datos no se elimina (409): se ofrece desactivarlo.
 * - La exportación e importación todavía no existen: su interruptor en
 *   Visibilidad solo guarda la preferencia.
 */
import {
  CargarMasComponent,
  PaginaPorGrupo,
} from '../../../../shared/ui/cargar-mas/cargar-mas.component';

@Component({
  selector: 'app-settings-campos-page',
  standalone: true,
  imports: [
    IcComponent,
    ModuloCabeceraComponent,
    EstadoPaginaComponent,
    PastillaCabeceraComponent,
    AtajosTecladoComponent,
    ListaFichaComponent,
    BuscadorListaComponent,
    FilaListaComponent,
    FichaVaciaComponent,
    FichaBarraComponent,
    MenuFichaComponent,
    ItemMenuComponent,
    TarjetaCapacidadComponent,
    TarjetasPlegablesComponent,
    FiltrosCamposComponent,
    GrupoCamposComponent,
    FilaCampoComponent,
    CabeceraCampoComponent,
    PestanaGeneralComponent,
    PestanaValidacionComponent,
    PestanaVisibilidadComponent,
    PestanaVistaPreviaComponent,
    PestanaActividadComponent,
    ModalNuevoCampoComponent,
    BarraSeleccionComponent,
    CargarMasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-campos-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]',
    '(document:keydown)': 'tecla($event)',
    '(document:click)': 'cerrarMenus()',
  },
})
export class SettingsCamposPageComponent {
  private readonly servicio = inject(CampoPersonalizadoService);
  private readonly alerta = inject(AlertaService);
  private readonly auth = inject(AuthService);

  protected readonly icono = icono;
  protected readonly iconoTipo = ICONO_TIPO;
  protected readonly tope = TOPE_CAMPOS;
  protected readonly atajos = ATAJOS;
  protected readonly nombreEntidad = nombreEntidad;
  protected readonly lectura =
    'Los datos que tu negocio necesita y Goods no trae: talla y color en productos, NIT en clientes, número de mesa en pedidos. Aparecen en los formularios, en los filtros y en la exportación.';

  // Estado
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  /** 15 filas por sección y «Cargar 15 más · quedan N» (como Productos); el abierto siempre se ve. */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly sel = signal<number | null>(null);
  protected readonly borrador = signal<BorradorCampo | null>(null);
  protected readonly pestana = signal<PestanaCampo>('general');
  protected readonly busqueda = signal('');
  protected readonly plegados = signal<EntidadCampo[]>([]);
  protected readonly fEstado = signal<EstadoCampos>('todos');
  protected readonly fTipo = signal<TipoCampo | null>(null);
  protected readonly fEnt = signal<EntidadCampo | null>(null);
  protected readonly filtros = signal(false);
  protected readonly menu = signal(false);
  protected readonly verAtajos = signal(false);
  protected readonly completa = signal(false);
  protected readonly seleccion = signal<number[]>([]);
  /** Cuánto baja la hoja cuando las tarjetas de capacidad se despliegan encima. */
  protected readonly bajar = signal(0);
  /**
   * Registros con dato de cada campo (la derecha de la fila). No hay un
   * endpoint en bloque: se pide `/uso` de cada campo, de a 4, al cargar.
   */
  protected readonly conDato = signal<Partial<Record<number, number>>>({});
  protected readonly guardando = signal(false);
  /** Sección con la que abre el modal «Nuevo campo»; `null` = cerrado. */
  protected readonly creador = signal<EntidadCampo | null>(null);
  /** Uso e historial del campo abierto; `null` mientras cargan. */
  protected readonly uso = signal<UsoCampo | null>(null);
  protected readonly falloUso = signal(false);
  protected readonly historial = signal<CambioHistorialCampo[] | null>(null);
  private readonly buscador = viewChild(BuscadorListaComponent);
  private readonly general = viewChild(PestanaGeneralComponent);

  /** Sin `campos.gestionar` todo queda de solo lectura (el backend respondería 403). */
  protected readonly puede = computed(() => {
    const u = this.auth.currentUser();
    return !u || u.permisos.includes(PERMISO);
  });

  // Lista
  protected readonly todos = computed(() => ENTIDADES.flatMap((e) => this.servicio.todos(e.k)));
  protected readonly campo = computed(() => this.todos().find((c) => c.id === this.sel()) ?? null);
  protected readonly esNuevo = computed(() => this.borrador()?.id === null);
  protected readonly hayHoja = computed(() => !!this.campo() || this.esNuevo());
  protected readonly totalActivos = computed(() => this.todos().filter((c) => c.activo).length);
  protected readonly activosPor = computed(
    () =>
      Object.fromEntries(ENTIDADES.map((e) => [e.k, this.activosDe(e.k)])) as Record<
        EntidadCampo,
        number
      >,
  );
  protected readonly nombresPor = computed(
    () =>
      Object.fromEntries(
        ENTIDADES.map((e) => [e.k, this.servicio.todos(e.k).map((c) => c.etiqueta)]),
      ) as Record<EntidadCampo, string[]>,
  );

  protected readonly capacidad = computed<CapacidadEntidad[]>(() =>
    ENTIDADES.map((e) => {
      const n = this.activosDe(e.k);
      return {
        k: e.k,
        t: e.t,
        icono: ICONO_ENTIDAD[e.k],
        activos: n,
        pct: `${Math.min(100, (n / TOPE_CAMPOS) * 100)}%`,
        barra: n >= TOPE_CAMPOS ? '#d82c0d' : n >= 12 ? '#d97706' : '#303030',
        on: this.fEnt() === e.k,
      };
    }),
  );
  protected readonly pastilla = computed(() => {
    if (this.borrador() && this.sucio())
      return { t: 'Sin guardar', bg: 'rgba(224,154,26,.12)', fg: '#8a5a00', punto: '#e09a1a' };
    return { t: 'Al día', bg: 'rgba(41,132,90,.08)', fg: '#1f6e49', punto: '#29845a' };
  });

  private readonly q = computed(() => normalizar(this.busqueda().trim()));
  protected readonly hayFiltros = computed(
    () => this.fEstado() !== 'todos' || !!this.fTipo() || !!this.fEnt(),
  );
  private pasaEstado(c: CampoPersonalizado, f: EstadoCampos): boolean {
    return (
      f === 'todos' ||
      (f === 'activos' && c.activo) ||
      (f === 'inactivos' && !c.activo) ||
      (f === 'requeridos' && c.obligatorio)
    );
  }
  /** Lo que coincide con la búsqueda y la sección, antes de estado y tipo (para los contadores del filtro). */
  private readonly base = computed(() =>
    this.todos().filter(
      (c) =>
        (!this.q() ||
          normalizar(`${c.etiqueta} ${c.clave} ${(c.opciones ?? []).join(' ')}`).includes(
            this.q(),
          )) &&
        (!this.fEnt() || c.entidad === this.fEnt()),
    ),
  );
  protected readonly filtrados = computed(() =>
    this.base().filter(
      (c) => this.pasaEstado(c, this.fEstado()) && (!this.fTipo() || c.tipo === this.fTipo()),
    ),
  );
  protected readonly grupos = computed(() =>
    ENTIDADES.filter((e) => !this.fEnt() || e.k === this.fEnt())
      .map((e) => {
        const total = this.servicio.todos(e.k).length;
        const filas = this.filtrados().filter((c) => c.entidad === e.k);
        return {
          ...e,
          icono: ICONO_ENTIDAD[e.k],
          total,
          activos: this.activosDe(e.k),
          filas,
          abierto: !!this.q() || !this.plegados().includes(e.k),
          vacio: !total && !this.q() && this.puede(),
          sinFiltrados: !!total && !filas.length && !this.q(),
        };
      })
      .filter((g) => g.filas.length || g.vacio || (!this.q() && !this.hayFiltros())),
  );
  /** Orden de la lista abierta, para ↑ ↓. */
  protected readonly plano = computed(() =>
    this.grupos().flatMap((g) => (g.abierto ? g.filas : [])),
  );
  protected readonly pos = computed(() => this.plano().findIndex((c) => c.id === this.sel()) + 1);
  protected readonly chips = computed(() => {
    const out: { t: string; quitar: () => void }[] = [];
    const t = this.fTipo();
    const e = this.fEnt();
    if (e)
      out.push({ t: `Solo ${nombreEntidad(e).toLowerCase()}`, quitar: () => this.fEnt.set(null) });
    if (this.fEstado() !== 'todos')
      out.push({
        t: OPCIONES_ESTADO.find((o) => o.k === this.fEstado())!.t,
        quitar: () => this.fEstado.set('todos'),
      });
    if (t)
      out.push({
        t: `Tipo: ${TIPOS.find((x) => x.k === t)!.t}`,
        quitar: () => this.fTipo.set(null),
      });
    return out;
  });
  protected readonly opcionesEstado = computed<OpcionFiltroCampo<EstadoCampos>[]>(() =>
    OPCIONES_ESTADO.map((o) => ({
      ...o,
      n: this.base().filter(
        (c) => this.pasaEstado(c, o.k) && (!this.fTipo() || c.tipo === this.fTipo()),
      ).length,
      on: this.fEstado() === o.k,
    })),
  );
  protected readonly opcionesTipo = computed<OpcionFiltroCampo<TipoCampo | null>[]>(() =>
    [{ k: null, t: 'Todos los tipos' }, ...TIPOS].map((t) => ({
      k: t.k,
      t: t.t,
      icono: t.k ? ICONO_TIPO[t.k] : 'category',
      n: this.base().filter((c) => this.pasaEstado(c, this.fEstado()) && (!t.k || c.tipo === t.k))
        .length,
      on: this.fTipo() === t.k,
    })),
  );
  protected readonly todosPlegados = computed(() => this.plegados().length === ENTIDADES.length);
  protected readonly pieLista = computed(() =>
    this.puede()
      ? `Hasta ${TOPE_CAMPOS} activos por sección · el orden es el de los formularios`
      : 'Solo lectura · necesitas el permiso «Definir los campos propios»',
  );

  // Hoja
  protected readonly sucio = computed(() => {
    const b = this.borrador();
    const c = this.campo();
    if (!b || !this.puede()) return false;
    if (b.id === null) return true;
    return !!c && firmaBorrador(b) !== firmaBorrador(borradorDe(c));
  });
  /** «el nombre y la validación»: qué cambió respecto de lo guardado. */
  private readonly partesCambiadas = computed(() => {
    const b = this.borrador();
    const c = this.campo();
    if (!b || !c) return 'el campo';
    const g = borradorDe(c);
    const xs = [
      ...new Set(
        PARTES.filter(([k]) =>
          k === 'etiqueta'
            ? b.etiqueta.trim() !== g.etiqueta
            : JSON.stringify(b[k]) !== JSON.stringify(g[k]),
        ).map(([, t]) => t),
      ),
    ];
    return xs.length <= 1 ? (xs[0] ?? 'el campo') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
  });
  protected readonly errorNombre = computed(() => {
    const b = this.borrador();
    if (!b) return '';
    const e = b.etiqueta.trim();
    if (!e) return 'Ponle un nombre al campo.';
    if (
      this.servicio
        .todos(b.entidad)
        .some((c) => c.id !== b.id && normalizar(c.etiqueta) === normalizar(e))
    )
      return `Ya hay un campo «${e}» en ${nombreEntidad(b.entidad).toLowerCase()}.`;
    return '';
  });
  protected readonly errorOpciones = computed(() =>
    this.borrador()?.tipo === 'lista' && !this.borrador()!.opciones.length
      ? 'Agrega al menos una opción a la lista.'
      : '',
  );
  protected readonly errorRango = computed(() => {
    const b = this.borrador();
    if (!b || (b.tipo !== 'texto' && b.tipo !== 'numero')) return '';
    const { min, max } = b.reglas;
    return min !== '' && max !== '' && Number(min) > Number(max)
      ? 'El mínimo no puede ser mayor que el máximo.'
      : '';
  });
  /** El valor por defecto tiene que pasar sus propias reglas (si no, el backend responde 400). */
  protected readonly errorDefecto = computed(() => {
    const b = this.borrador();
    if (!b || !b.defecto.trim() || !llevaDefecto(b) || (b.tipo !== 'texto' && b.tipo !== 'numero'))
      return '';
    const e = errorValor({ ...campoDe(b, '', 0), obligatorio: false }, b.defecto);
    return e ? `Valor por defecto: ${e.charAt(0).toLowerCase()}${e.slice(1)}` : '';
  });
  /** Activarlo (o crearlo activo) sin cupo en la sección. */
  protected readonly errorCupo = computed(() => {
    const b = this.borrador();
    if (!b || !b.activo || this.campo()?.activo) return '';
    return this.activosDe(b.entidad) >= TOPE_CAMPOS
      ? `Ya tienes ${TOPE_CAMPOS} activos en ${nombreEntidad(b.entidad).toLowerCase()}: desactiva uno o guarda este como inactivo.`
      : '';
  });
  private readonly primerError = computed(
    () =>
      (
        [
          [this.errorNombre(), 'general'],
          [this.errorOpciones(), 'general'],
          [this.errorCupo(), 'general'],
          [this.errorRango(), 'validacion'],
          [this.errorDefecto(), 'validacion'],
        ] as [string, PestanaCampo][]
      ).find(([e]) => e) ?? null,
  );
  protected readonly valido = computed(() => !this.primerError());
  protected readonly clave = computed(
    () => this.campo()?.clave ?? claveDe(this.borrador()?.etiqueta ?? ''),
  );
  /** Los campos de la sección con el borrador en su lugar (para la vista previa). */
  protected readonly camposPrueba = computed<CampoPersonalizado[]>(() => {
    const b = this.borrador();
    if (!b) return [];
    const l = this.servicio.todos(b.entidad);
    const este = campoDe(b, this.clave(), this.campo()?.orden ?? Number.MAX_SAFE_INTEGER);
    return b.id === null ? [...l, este] : l.map((c) => (c.id === b.id ? este : c));
  });
  protected readonly lugar = computed<LugarCampo | null>(() => {
    const b = this.borrador();
    if (!b || b.id === null) return null;
    const l = this.servicio.todos(b.entidad);
    const i = l.findIndex((c) => c.id === b.id);
    return { i: i + 1, n: l.length, primero: i <= 0, ultimo: i >= l.length - 1 };
  });
  /** Registros por opción de la lista abierta. */
  protected readonly usoOpciones = computed<Record<string, number>>(() =>
    Object.fromEntries((this.uso()?.porOpcion ?? []).map((x) => [String(x.valor), x.n])),
  );
  protected readonly contadores = computed<Partial<Record<PestanaCampo, string>>>(() => {
    const b = this.borrador();
    if (!b) return {};
    const n = cuentaReglas(b);
    const lugares = LUGARES.filter(
      (l) =>
        l.k === 'formulario' ||
        ((l.k !== 'tienda' || aplicaTienda(b.entidad)) && b.visibilidad[l.k]),
    ).length;
    return {
      validacion: n ? String(n) : '',
      visibilidad: `${lugares}/${LUGARES.length}`,
      vista: String(this.camposPrueba().filter((c) => c.activo).length),
    };
  });

  constructor() {
    this.cargar(true);
    effect(() => {
      const s = this.sucio();
      const b = this.borrador();
      const err = this.primerError();
      untracked(() =>
        this.alerta.fijarCambios(
          s && b
            ? {
                titulo: err
                  ? 'No se puede guardar'
                  : b.id === null
                    ? 'Campo sin guardar'
                    : 'Cambios sin guardar',
                texto: err
                  ? err[0]
                  : b.id === null
                    ? 'Ponle nombre, elige el tipo y guarda para crearlo. Atajo: Ctrl + S.'
                    : `Cambiaste ${this.partesCambiadas()}. Guarda para aplicarlo o descarta para volver a como estaba. Atajo: Ctrl + S.`,
                estado: err ? 'error' : 'warning',
                guardar: () => this.guardar(),
                descartar: () => this.descartar(),
              }
            : null,
        ),
      );
    });
    inject(DestroyRef).onDestroy(() => this.alerta.soltarCambios());
  }

  /** Recarga las cuatro secciones. La primera vez abre el primer campo. */
  protected cargar(abrirPrimero = false): void {
    this.error.set(false);
    this.cargando.set(true);
    forkJoin(ENTIDADES.map((e) => this.servicio.recargar(e.k))).subscribe({
      next: () => {
        this.cargando.set(false);
        const p = this.plano()[0];
        if (abrirPrimero && p) this.abrir(p.id);
        this.cargarUso();
      },
      error: () => {
        this.cargando.set(false);
        this.error.set(true);
      },
    });
  }

  private cargarUso(): void {
    from(this.todos().map((c) => c.id))
      .pipe(
        mergeMap(
          (id) =>
            this.servicio.uso(id).pipe(
              map((u) => [id, u.conDato] as const),
              catchError(() => of(null)),
            ),
          4,
        ),
      )
      .subscribe((r) => r && this.conDato.update((m) => ({ ...m, [r[0]]: r[1] })));
  }

  protected activosDe(e: EntidadCampo): number {
    return this.servicio.activos(e).length;
  }

  protected marcado(id: number): boolean {
    return this.seleccion().includes(id);
  }

  private sinPermiso(): void {
    this.alerta.mostrar({ estado: 'error', titulo: 'Sin permiso', texto: SIN_PERMISO });
  }

  // Lista

  protected abrir(id: number): void {
    if (this.sel() === id && !this.sucio()) return this.cerrar();
    if (this.sucio()) return this.alerta.sacudir();
    const c = this.todos().find((x) => x.id === id);
    if (!c) return;
    this.sel.set(id);
    this.menu.set(false);
    this.borrador.set(borradorDe(c));
    this.cargarActividad(id);
  }

  /** Uso e historial del campo; la respuesta de otro campo (si se cambió rápido) se descarta. */
  private cargarActividad(id: number): void {
    this.uso.set(null);
    this.falloUso.set(false);
    this.historial.set(null);
    this.servicio.uso(id).subscribe({
      next: (u) => this.sel() === id && this.uso.set(u),
      error: () => this.sel() === id && this.falloUso.set(true),
    });
    this.servicio
      .historial(id)
      .pipe(catchError(() => of([] as CambioHistorialCampo[])))
      .subscribe((h) => this.sel() === id && this.historial.set(h));
  }

  protected cerrar(): void {
    if (this.sucio()) return this.alerta.sacudir();
    this.sel.set(null);
    this.borrador.set(null);
    this.completa.set(false);
  }

  protected ir(d: number): void {
    const l = this.plano();
    const i = l.findIndex((c) => c.id === this.sel());
    const n = l[Math.max(0, Math.min(l.length - 1, i + d))];
    if (n && n.id !== this.sel()) this.abrir(n.id);
  }

  protected alternarGrupo(k: EntidadCampo): void {
    this.plegados.update((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  protected alternarTodos(): void {
    this.plegados.set(this.todosPlegados() ? [] : ENTIDADES.map((e) => e.k));
  }

  protected marcar(id: number): void {
    if (!this.puede()) return this.sinPermiso();
    this.seleccion.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  protected elegirEntidad(k: EntidadCampo): void {
    this.fEnt.update((x) => (x === k ? null : k));
    this.plegados.set([]);
  }

  protected cerrarMenus(): void {
    this.menu.set(false);
    this.filtros.set(false);
    this.verAtajos.set(false);
  }

  protected limpiarTodo(): void {
    this.busqueda.set('');
    this.fEstado.set('todos');
    this.fTipo.set(null);
    this.fEnt.set(null);
  }

  // Borrador

  protected cambiar(e: CambioCampo): void {
    if (!this.puede()) return;
    this.borrador.update((b) => (b ? { ...b, [e.k]: e.v } : b));
  }

  /** Abre «Nuevo campo» en la sección filtrada, la del campo abierto o Productos. */
  protected nuevo(ent?: EntidadCampo): void {
    if (!this.puede()) return this.sinPermiso();
    this.menu.set(false);
    this.verAtajos.set(false);
    this.creador.set(ent ?? this.fEnt() ?? this.borrador()?.entidad ?? 'producto');
  }

  protected crearDesde(e: EleccionNuevoCampo): void {
    this.creador.set(null);
    if (this.sucio()) return this.alerta.sacudir();
    const activo = this.activosDe(e.entidad) < TOPE_CAMPOS;
    this.sel.set(null);
    this.pestana.set('general');
    this.borrador.set(
      e.plantilla
        ? borradorDePlantilla(e.entidad, e.plantilla, activo)
        : borradorVacio(e.entidad, activo),
    );
    this.plegados.update((p) => p.filter((x) => x !== e.entidad));
    setTimeout(() => this.general()?.enfocarNombre(), 80);
  }

  protected descartar(): void {
    const b = this.borrador();
    if (!b) return;
    const c = this.campo();
    this.general()?.limpiarPendiente();
    this.borrador.set(b.id === null || !c ? null : borradorDe(c));
  }

  /** Lo que se manda al guardar un campo existente (todo: el backend solo cambia lo que difiere). */
  private actualizarDe(b: BorradorCampo): ActualizarCampoPayload {
    return {
      etiqueta: b.etiqueta.trim(),
      opciones: b.tipo === 'lista' ? b.opciones : undefined,
      obligatorio: b.obligatorio,
      activo: b.activo,
      ...detalleDe(b),
    };
  }

  protected guardar(): void {
    if (!this.puede() || !this.borrador()) return;
    // La opción escrita sin Enter también cuenta.
    const pend = this.general()?.pendiente();
    if (pend && this.borrador()!.tipo === 'lista') {
      this.general()!.limpiarPendiente();
      this.borrador.update((b) =>
        b && !b.opciones.some((o) => normalizar(o) === normalizar(pend))
          ? {
              ...b,
              opciones: [...b.opciones, pend],
              colores: { ...b.colores, [pend]: b.colores[pend] ?? '#6b7280' },
            }
          : b,
      );
    }
    const b = this.borrador()!;
    if (!this.sucio() || this.guardando()) return;
    const err = this.primerError();
    if (err) {
      this.pestana.set(err[1]);
      return this.alerta.sacudir();
    }
    this.guardando.set(true);
    const fin = (c: CampoPersonalizado, titulo: string, deshacer: () => void) => {
      this.guardando.set(false);
      this.sel.set(c.id);
      this.borrador.set(borradorDe(c));
      this.cargarActividad(c.id);
      this.alerta.mostrar({
        estado: 'success',
        titulo,
        accion: { label: 'Deshacer', ejecutar: deshacer },
      });
    };
    const falla = (e: unknown) => {
      this.guardando.set(false);
      this.alerta.mostrar({
        estado: 'error',
        titulo: 'No se pudo guardar',
        texto: mensajeDeError(e),
      });
    };
    if (b.id === null) {
      // El backend crea los campos activos; si se pidió inactivo, se desactiva enseguida.
      this.servicio.crear(crearDe(b)).subscribe({
        next: (creado) => {
          const listo = (c: CampoPersonalizado) =>
            fin(c, `«${c.etiqueta}» creado en ${nombreEntidad(c.entidad).toLowerCase()}`, () =>
              this.servicio.eliminar(c).subscribe(() => {
                this.sel.set(null);
                this.borrador.set(null);
              }),
            );
          if (b.activo) listo(creado);
          else
            this.servicio
              .actualizar(creado, { activo: false })
              .subscribe({ next: listo, error: falla });
        },
        error: falla,
      });
      return;
    }
    const c = this.campo()!;
    const antes = this.actualizarDe(borradorDe(c));
    this.servicio.actualizar(c, this.actualizarDe(b)).subscribe({
      next: (x) =>
        fin(x, `«${x.etiqueta}» guardado`, () =>
          this.servicio.actualizar(x, antes).subscribe({
            next: (y) => this.reabrir(y),
            error: (e) =>
              this.alerta.mostrar({
                estado: 'error',
                titulo: 'No se pudo deshacer',
                texto: mensajeDeError(e),
              }),
          }),
        ),
      error: falla,
    });
  }

  /** Vuelve a abrir el campo con lo que respondió el backend, aunque ya estuviera abierto. */
  private reabrir(c: CampoPersonalizado): void {
    this.borrador.set(null);
    this.sel.set(null);
    this.abrir(c.id);
  }

  protected ordenar(d: number): void {
    const c = this.campo();
    if (!c || !this.puede()) return;
    const l = this.servicio.todos(c.entidad).map((x) => x.id);
    const i = l.indexOf(c.id);
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    const antes = [...l];
    [l[i], l[j]] = [l[j], l[i]];
    this.servicio.ordenar(c.entidad, l).subscribe({
      next: () =>
        this.alerta.mostrar({
          estado: 'success',
          titulo: `«${c.etiqueta}» ahora sale de ${j + 1} en ${nombreEntidad(c.entidad).toLowerCase()}`,
          accion: {
            label: 'Deshacer',
            ejecutar: () => this.servicio.ordenar(c.entidad, antes).subscribe(),
          },
        }),
      error: (e) =>
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se pudo cambiar el orden',
          texto: mensajeDeError(e),
        }),
    });
  }

  // Menú ⋯

  protected alternarActivo(): void {
    const c = this.campo();
    if (!c) return;
    this.menu.set(false);
    if (!this.puede()) return this.sinPermiso();
    if (this.sucio()) return this.alerta.sacudir();
    if (!c.activo && this.activosDe(c.entidad) >= TOPE_CAMPOS) {
      this.alerta.mostrar({
        estado: 'warning',
        titulo: `${nombreEntidad(c.entidad)} ya tiene ${TOPE_CAMPOS} activos`,
        texto: 'Desactiva otro primero.',
      });
      return;
    }
    this.alerta
      .seguir(this.servicio.actualizar(c, { activo: !c.activo }), {
        titulo: c.activo ? 'Desactivando…' : 'Activando…',
        exito: {
          titulo: `«${c.etiqueta}» ${c.activo ? 'desactivado' : 'activado'}`,
          texto: c.activo
            ? 'Ya no aparece en los formularios; los datos se conservan.'
            : 'Vuelve a aparecer en los formularios.',
          accion: {
            label: 'Deshacer',
            ejecutar: () =>
              this.servicio.actualizar(c, { activo: c.activo }).subscribe((x) => this.reabrir(x)),
          },
        },
        error: { titulo: 'No se pudo cambiar' },
      })
      .subscribe((x) => this.reabrir(x));
  }

  protected copiarClave(): void {
    navigator.clipboard?.writeText(this.clave());
    this.menu.set(false);
    this.alerta.mostrar({ estado: 'info', titulo: `Clave «${this.clave()}» copiada` });
  }

  /** Copia el borrador (con lo que no se ha guardado) como un campo nuevo. */
  protected duplicar(): void {
    const b = this.borrador();
    if (!b) return;
    this.menu.set(false);
    if (!this.puede()) return this.sinPermiso();
    if (this.sucio()) return this.alerta.sacudir();
    this.sel.set(null);
    this.pestana.set('general');
    this.borrador.set({
      ...b,
      id: null,
      etiqueta: `${b.etiqueta.trim()} (copia)`.slice(0, 40),
      activo: this.activosDe(b.entidad) < TOPE_CAMPOS,
    });
  }

  protected pedirBorrar(): void {
    const c = this.campo();
    if (!c) return;
    this.menu.set(false);
    if (!this.puede()) return this.sinPermiso();
    const n = this.uso()?.conDato ?? 0;
    const ent = nombreEntidad(c.entidad).toLowerCase();
    if (n > 0) {
      // El backend no deja borrar un campo con datos (409).
      this.alerta.mostrar({
        estado: 'warning',
        titulo: `«${c.etiqueta}» tiene datos`,
        texto: `${n.toLocaleString('es-CO')} ${n === 1 ? SINGULAR_ENTIDAD[c.entidad] + ' tiene' : ent + ' tienen'} este dato, así que no se puede eliminar. ${c.activo ? 'Desactívalo para ocultarlo sin perder nada.' : 'Ya está desactivado: no aparece en ningún formulario.'}`,
        autoCierre: null,
        abierta: true,
        ...(c.activo
          ? {
              accion: { label: 'Desactivar en su lugar', ejecutar: () => this.alternarActivo() },
              accion2: { label: 'Cancelar', ejecutar: () => undefined },
            }
          : {}),
      });
      return;
    }
    this.alerta.mostrar({
      estado: 'warning',
      titulo: `¿Eliminar «${c.etiqueta}»?`,
      texto: `Ningún ${SINGULAR_ENTIDAD[c.entidad]} tiene este dato todavía. Puedes deshacerlo justo después.`,
      autoCierre: null,
      abierta: true,
      accion: { label: 'Eliminar', ejecutar: () => this.borrar(c) },
      accion2: { label: 'Cancelar', ejecutar: () => undefined },
    });
  }

  private borrar(c: CampoPersonalizado): void {
    const orden = this.servicio.todos(c.entidad).map((x) => x.id);
    const b = borradorDe(c);
    this.servicio.eliminar(c).subscribe({
      next: () => {
        this.sel.set(null);
        this.borrador.set(null);
        this.alerta.mostrar({
          estado: 'success',
          titulo: `«${c.etiqueta}» eliminado`,
          accion: { label: 'Deshacer', ejecutar: () => this.recrear(b, orden) },
        });
      },
      error: (e: HttpErrorResponse) =>
        this.alerta.mostrar(
          e.status === 409
            ? {
                estado: 'error',
                titulo: 'Tiene datos guardados',
                texto: mensajeDeError(e),
                accion: { label: 'Desactivar', ejecutar: () => this.alternarActivo() },
              }
            : { estado: 'error', titulo: 'No se pudo eliminar', texto: mensajeDeError(e) },
        ),
    });
  }

  /** «Deshacer» de eliminar: lo vuelve a crear con lo mismo y en su lugar (queda con otro id). */
  private recrear(b: BorradorCampo, orden: number[]): void {
    this.servicio
      .crear(crearDe(b))
      .pipe(
        concatMapSi<CampoPersonalizado>(!b.activo, (c) =>
          this.servicio.actualizar(c, { activo: false }),
        ),
        concatMap((c) => {
          const viejo = b.id!;
          const ids = orden.map((id) => (id === viejo ? c.id : id));
          const vivos = new Set(this.servicio.todos(c.entidad).map((x) => x.id));
          return this.servicio
            .ordenar(
              c.entidad,
              ids.filter((id) => vivos.has(id)),
            )
            .pipe(
              map(() => c),
              catchError(() => of(c)),
            );
        }),
      )
      .subscribe({
        next: (c) => this.abrir(c.id),
        error: (e) =>
          this.alerta.mostrar({
            estado: 'error',
            titulo: 'No se pudo deshacer',
            texto: mensajeDeError(e),
          }),
      });
  }

  // Selección múltiple

  protected masivo(accion: AccionMasiva): void {
    if (!this.puede()) return this.sinPermiso();
    const cs = this.todos().filter((c) => this.seleccion().includes(c.id));
    if (!cs.length) return;
    if (accion === 'borrar') {
      this.alerta.mostrar({
        estado: 'warning',
        titulo: `¿Eliminar ${cs.length} ${cs.length === 1 ? 'campo' : 'campos'}?`,
        texto: 'Los que ya tienen datos no se pueden eliminar; esos se pueden desactivar.',
        autoCierre: null,
        abierta: true,
        accion: { label: 'Eliminar', ejecutar: () => this.borrarVarios(cs) },
        accion2: { label: 'Desactivar en su lugar', ejecutar: () => this.masivo('desactivar') },
      });
      return;
    }
    const on = accion === 'activar';
    const xs = cs.filter((c) => c.activo !== on);
    // Uno por uno: el backend revisa el cupo de la sección en cada activación.
    this.unoPorUno(xs, (c) => this.servicio.actualizar(c, { activo: on })).subscribe((r) => {
      this.seleccion.set([]);
      const b = this.borrador();
      if (b?.id && xs.some((c) => c.id === b.id) && !this.sucio()) {
        const c = this.campo();
        if (c) this.borrador.set(borradorDe(c));
      }
      const hechos = r.filter((x) => x.ok).length;
      const sinCupo = r.length - hechos;
      this.alerta.mostrar({
        estado: sinCupo ? 'warning' : 'success',
        titulo: `${hechos} ${on ? (hechos === 1 ? 'activado' : 'activados') : hechos === 1 ? 'desactivado' : 'desactivados'}${sinCupo ? ` · ${sinCupo} sin cupo` : ''}`,
        texto: sinCupo
          ? `${sinCupo} no se activaron: la sección ya tiene ${TOPE_CAMPOS} activos.`
          : undefined,
      });
    });
  }

  private borrarVarios(cs: CampoPersonalizado[]): void {
    this.unoPorUno(cs, (c) => this.servicio.eliminar(c)).subscribe((r) => {
      this.seleccion.set([]);
      if (r.some((x) => x.ok && x.c.id === this.sel())) {
        this.sel.set(null);
        this.borrador.set(null);
      }
      const conDatos = r.filter((x) => !x.ok).map((x) => x.c);
      const hechos = r.length - conDatos.length;
      this.alerta.mostrar(
        conDatos.length
          ? {
              estado: 'warning',
              titulo: `${hechos} ${hechos === 1 ? 'eliminado' : 'eliminados'} · ${conDatos.length} con datos`,
              texto: `${conDatos.map((c) => `«${c.etiqueta}»`).join(', ')} ya ${conDatos.length === 1 ? 'tiene' : 'tienen'} datos: se pueden desactivar.`,
              accion: {
                label: 'Desactivarlos',
                ejecutar: () =>
                  this.unoPorUno(
                    conDatos.filter((c) => c.activo),
                    (c) => this.servicio.actualizar(c, { activo: false }),
                  ).subscribe(),
              },
            }
          : {
              estado: 'success',
              titulo: `${hechos} ${hechos === 1 ? 'campo eliminado' : 'campos eliminados'}`,
            },
      );
    });
  }

  /** Aplica la operación a cada campo en orden y cuenta los que fallaron sin cortar los demás. */
  private unoPorUno(
    cs: CampoPersonalizado[],
    op: (c: CampoPersonalizado) => Observable<unknown>,
  ): Observable<{ c: CampoPersonalizado; ok: boolean }[]> {
    if (!cs.length) return of([]);
    return from(cs).pipe(
      concatMap((c) =>
        op(c).pipe(
          map(() => ({ c, ok: true })),
          catchError(() => of({ c, ok: false })),
        ),
      ),
      toArray(),
    );
  }

  // Teclado

  protected tecla(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.guardar();
      return;
    }
    if (e.key === 'Escape') {
      if (this.creador()) return this.creador.set(null);
      if (this.menu() || this.filtros() || this.verAtajos()) return this.cerrarMenus();
      if (!esTeclaDeLista(e)) return (e.target as HTMLElement).blur();
      if (this.seleccion().length) return this.seleccion.set([]);
      if (this.completa()) return this.completa.set(false);
      if (this.hayHoja()) this.cerrar();
      return;
    }
    if (!esTeclaDeLista(e) || this.creador() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ir(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      this.nuevo();
    } else if (e.key === '/') {
      e.preventDefault();
      this.buscador()?.enfocar();
    } else if (/^[1-5]$/.test(e.key) && this.hayHoja()) {
      this.pestana.set(PESTANAS[Number(e.key) - 1].k);
    } else if (e.key.toLowerCase() === 'f' && this.hayHoja()) {
      this.completa.update((c) => !c);
    }
  }
}

/** `concatMap` solo si `si`; si no, el valor sigue igual. */
function concatMapSi<T>(si: boolean, f: (x: T) => Observable<T>) {
  return concatMap((x: T) => (si ? f(x) : of(x)));
}
