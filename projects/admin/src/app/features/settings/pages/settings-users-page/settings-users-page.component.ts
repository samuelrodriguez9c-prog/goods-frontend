import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, from, map, mergeMap, of, toArray } from 'rxjs';
import {
  ActividadEquipoService,
  ItemActividad,
} from '../../../../core/actividad/actividad-equipo.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modulo, modulosDe } from '../../../../core/roles/niveles';
import { RolAsignable } from '../../../../core/roles/models/rol.model';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { RolService } from '../../../../core/roles/rol.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { SesionAbierta, Usuario } from '../../../../core/usuarios/models/usuario.model';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { esTeclaDeLista, haceCuanto, normalizar } from '../../../../shared/ui/persona';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';
import { iconoRol } from '../../shared/permisos';
import { BuscadorListaComponent } from '../../shared/ui/buscador-lista/buscador-lista.component';
import {
  ChipActivo,
  ChipsFiltroComponent,
} from '../../shared/ui/chips-filtro/chips-filtro.component';
import { FichaBarraComponent } from '../../shared/ui/ficha-barra/ficha-barra.component';
import { FichaVaciaComponent } from '../../shared/ui/ficha-vacia/ficha-vacia.component';
import {
  FilaListaComponent,
  GrupoListaComponent,
} from '../../shared/ui/fila-lista/fila-lista.component';
import {
  DatoLateral,
  ListaDatosComponent,
} from '../../shared/ui/lista-datos/lista-datos.component';
import { ListaFichaComponent } from '../../shared/ui/lista-ficha/lista-ficha.component';
import {
  ItemMenuComponent,
  MenuFichaComponent,
} from '../../shared/ui/menu-ficha/menu-ficha.component';
import { PastillaCabeceraComponent } from '../../shared/ui/pastilla-cabecera/pastilla-cabecera.component';
import {
  ESTADO_USUARIO,
  ROL_DUENO,
  estadoDe,
  nombreCorto,
  nombreDe,
  nombreRol,
} from '../../shared/usuarios';
import { ActividadUsuarioComponent } from './components/actividad-usuario/actividad-usuario.component';
import { AvisoInvitacionComponent } from './components/aviso-invitacion/aviso-invitacion.component';
import {
  FiltroEstado,
  FiltroEstadoComponent,
  OpcionEstado,
} from './components/filtro-estado/filtro-estado.component';
import { FilaUsuarioComponent } from './components/fila-usuario/fila-usuario.component';
import { IdentidadUsuarioComponent } from './components/identidad-usuario/identidad-usuario.component';
import {
  Invitacion,
  ModalInvitarComponent,
} from './components/modal-invitar/modal-invitar.component';
import { PermisosUsuarioComponent } from './components/permisos-usuario/permisos-usuario.component';
import {
  SesionVM,
  SesionesAbiertasComponent,
} from './components/sesiones-abiertas/sesiones-abiertas.component';
import { RolUsuario, avisoInvitacion, enLinea, rolUsuarioDe } from './usuarios.util';

const ESTADOS: FiltroEstado[] = ['todos', 'activo', 'pendiente', 'vencida', 'inactivo'];
const DIA_MS = 864e5;

interface GrupoUsuarios {
  id: number;
  t: string;
  icono: string;
  propio: boolean;
  items: Usuario[];
  abierto: boolean;
}

/**
 * Usuarios: el equipo agrupado por rol a la izquierda y la ficha de la
 * persona elegida.
 *
 * @remarks
 * - Grupos por rol: primero el dueño, después las plantillas de Goods y al
 *   final los roles propios; dentro, tú primero y el resto por nombre. Un rol
 *   que no está entre los asignables (el del dueño) se arma con `usuario.rol`.
 * - «En línea» sale de `GET /usuarios/en-linea` al cargar y se mantiene con
 *   `presencia:cambio` (solo la gente de tu Empresa); al desconectarse trae
 *   `ultimoAcceso`, así «Entró hace 25 min» queda al día.
 * - Cambiar rol: se elige en el menú del engranaje, la ficha muestra qué gana
 *   o pierde y se aplica con «Cambiar rol». Tu propio rol no se cambia.
 * - Invitar: varios correos a la vez con un rol para todos y la vista previa
 *   del correo `user-invite.hbs`.
 * - Actividad reciente: el último mes de `ActividadEquipoService` filtrado por
 *   `usuarioId` (sin Plan Plus responde 403 y queda vacía).
 * - `?usuario=<id>` abre la ficha de esa persona (lo usa Actividad) y
 *   `?rol=<id>` deja abierto solo el grupo de ese rol (lo usa Roles).
 * - «Acceso a Goods» (`PATCH /usuarios/:id/acceso`): quitarlo pide
 *   confirmación y corta sus sesiones al instante; no aplica a ti ni al dueño.
 * - «Sesiones abiertas» se piden al abrir la ficha: el backend deja una por
 *   navegador, así que se muestran tal cual. Cerrar una no es inmediato
 *   (vuelve al login al vencer su token, unos minutos), salvo que sea la
 *   última; «Cerrar todas» sí. El backend no da la ciudad.
 * - Quitar del equipo no borra a la persona: el aviso trae «Deshacer»
 *   (`POST /usuarios/:id/restaurar`), que la devuelve con su rol y su acceso.
 * - Invitar acepta un «Mensaje personal» que va en el correo.
 * - Invitar manda el rol en la misma llamada y solo el correo: la persona
 *   escribe su nombre al aceptar. Mientras tanto se muestra su correo.
 */
import {
  CargarMasComponent,
  PaginaPorGrupo,
} from '../../../../shared/ui/cargar-mas/cargar-mas.component';

@Component({
  selector: 'app-settings-users-page',
  standalone: true,
  imports: [
    IcComponent,
    ModuloCabeceraComponent,
    EstadoPaginaComponent,
    PastillaCabeceraComponent,
    ListaFichaComponent,
    BuscadorListaComponent,
    ChipsFiltroComponent,
    GrupoListaComponent,
    FilaListaComponent,
    FichaVaciaComponent,
    FichaBarraComponent,
    MenuFichaComponent,
    ItemMenuComponent,
    ListaDatosComponent,
    FilaUsuarioComponent,
    FiltroEstadoComponent,
    IdentidadUsuarioComponent,
    AvisoInvitacionComponent,
    PermisosUsuarioComponent,
    ActividadUsuarioComponent,
    ModalInvitarComponent,
    SesionesAbiertasComponent,
    CargarMasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-users-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]',
    '(document:keydown)': 'tecla($event)',
    '(document:click)': 'cerrarMenus()',
  },
})
export class SettingsUsersPageComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly rolService = inject(RolService);
  private readonly actividad = inject(ActividadEquipoService);
  private readonly alerta = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly icono = icono;
  protected readonly lectura =
    'Las personas de tu equipo que entran a Goods. Invita a varias a la vez, define qué puede ver y editar cada una según su rol, revisa cuándo entraron por última vez y quítales el acceso cuando lo necesites.';

  // Datos
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly usuarios = signal<Usuario[]>([]);
  private readonly rolesApi = signal<RolAsignable[]>([]);
  protected readonly modulos = signal<Modulo[]>([]);
  protected readonly act = signal<ItemActividad[]>([]);
  private readonly conectados = signal<Set<number>>(new Set());
  private soloRol: number | null = null;

  // UI
  /** 15 filas por grupo y «Cargar 15 más · quedan N» (como Productos); la abierta siempre se ve. */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly sel = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<FiltroEstado>('todos');
  protected readonly filtros = signal(false);
  protected readonly cerrados = signal<number[]>([]);
  protected readonly completa = signal(false);
  protected readonly menu = signal(false);
  protected readonly rolMenu = signal(false);
  protected readonly propuesta = signal<number | null>(null);
  protected readonly invitar = signal(false);
  protected readonly enviando = signal(false);
  /** Sesiones de la persona abierta; `null` mientras cargan o si fallaron. */
  protected readonly sesiones = signal<SesionAbierta[] | null>(null);
  private readonly sesionesEnLinea = signal(false);
  protected readonly cambiandoAcceso = signal(false);

  protected readonly yoId = computed(() => this.auth.currentUser()?.id ?? -1);
  /** Como lo firma el correo de invitación: nombre y apellido. */
  protected readonly yoNombre = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.nombres} ${u.apellidos}`.trim() || 'El equipo' : 'El equipo';
  });
  protected readonly empresa = computed(
    () => this.auth.currentUser()?.empresa?.nombre ?? 'tu tienda',
  );

  /** Roles asignables con nombre legible, niveles y si son propios. */
  protected readonly roles = computed(() =>
    this.rolesApi().map((r) => rolUsuarioDe(r, this.modulos())),
  );

  protected readonly visibles = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const f = this.filtro();
    return this.usuarios().filter(
      (u) =>
        (!q || normalizar(`${nombreDe(u)} ${u.correo}`).includes(q)) &&
        (f === 'todos' || estadoDe(u) === f),
    );
  });

  protected readonly grupos = computed<GrupoUsuarios[]>(() => {
    const buscando = !!this.busqueda().trim();
    const porRol = new Map<number, Usuario[]>();
    for (const u of this.visibles()) porRol.set(u.rolId, [...(porRol.get(u.rolId) ?? []), u]);
    const grupos = [...porRol.entries()].map(([id, items]) => {
      const r = this.roles().find((x) => x.id === id);
      const codigo = r?.codigo ?? items[0].rol?.nombre ?? '';
      const orden = codigo === ROL_DUENO ? 0 : r && !r.propio ? 1 : r?.propio ? 2 : 3;
      const ordenados = [...items].sort(
        (a, b) =>
          Number(b.id === this.yoId()) - Number(a.id === this.yoId()) ||
          nombreDe(a).localeCompare(nombreDe(b)),
      );
      return {
        id,
        t: r?.nombre ?? nombreRol(codigo || 'Sin rol'),
        icono: codigo === ROL_DUENO ? 'crown' : iconoRol(r),
        propio: !!r?.propio,
        items: ordenados,
        abierto: buscando || !this.cerrados().includes(id),
        orden,
        pos: r ? this.roles().indexOf(r) : 999,
      };
    });
    return grupos.sort((a, b) => a.orden - b.orden || a.pos - b.pos);
  });
  /** Orden de la lista, para ↑ ↓. */
  protected readonly orden = computed(() => this.grupos().flatMap((g) => g.items));
  protected readonly pos = computed(() => this.orden().findIndex((u) => u.id === this.sel()) + 1);
  protected readonly u = computed(() => this.usuarios().find((x) => x.id === this.sel()) ?? null);
  protected readonly aviso = computed(() => {
    const u = this.u();
    return u ? avisoInvitacion(u) : null;
  });
  protected readonly pendientes = computed(
    () => this.usuarios().filter((x) => x.invitacion).length,
  );
  protected readonly opcionesEstado = computed<OpcionEstado[]>(() =>
    ESTADOS.map((k) => ({
      k,
      n:
        k === 'todos'
          ? this.usuarios().length
          : this.usuarios().filter((x) => estadoDe(x) === k).length,
    })),
  );
  protected readonly chips = computed<ChipActivo[]>(() => {
    const f = this.filtro();
    return f === 'todos'
      ? []
      : [{ t: ESTADO_USUARIO[f].t, quitar: () => this.filtro.set('todos') }];
  });
  protected readonly existentes = computed(
    () => new Set(this.usuarios().map((u) => u.correo.toLowerCase())),
  );
  /** Rol con el que abre «Invitar»: el de empleado si existe. */
  protected readonly rolInicial = computed(
    () => this.roles().find((r) => r.codigo === 'empleado_empresa')?.id ?? null,
  );

  protected readonly rolActual = computed<RolUsuario | null>(() => {
    const u = this.u();
    if (!u) return null;
    const r = this.roles().find((x) => x.id === u.rolId);
    if (r) return r;
    // El rol del dueño no está entre los asignables: se arma con lo que trae el usuario.
    // El dueño tiene todos los permisos de la tienda.
    const codigo = u.rol?.nombre ?? '';
    const permisos = codigo === ROL_DUENO ? this.modulos().flatMap((m) => m.permisos) : [];
    return rolUsuarioDe(
      { id: u.rolId, nombre: codigo, descripcion: null, permisos, empresaId: null },
      this.modulos(),
    );
  });
  protected readonly rolPropuesto = computed(
    () => this.roles().find((r) => r.id === this.propuesta()) ?? null,
  );
  protected readonly duenoYo = computed(
    () => this.u()?.id === this.yoId() && this.rolActual()?.esDueno === true,
  );

  protected readonly resumenEquipo = computed(
    () =>
      `${this.usuarios().length} en tu equipo${this.pendientes() ? ' · ' + this.pendientes() + ' por aceptar' : ''}`,
  );

  /** Lateral de la ficha: contacto y cuenta. */
  protected readonly lateral = computed<{ t: string; datos: DatoLateral[] }[]>(() => {
    const u = this.u();
    if (!u) return [];
    const r = this.rolActual();
    const n = r ? Object.values(r.niveles).filter(Boolean).length : 0;
    return [
      {
        t: 'Contacto',
        datos: [
          { t: 'Correo', i: 'mail', v: u.correo },
          { t: 'Teléfono', i: 'phone', v: u.telefono || 'Sin registrar' },
        ],
      },
      {
        t: 'Cuenta',
        datos: [
          {
            t: 'Se unió',
            i: 'calendar',
            v: u.invitacion || !u.creadoEn ? 'Aún no' : haceCuanto(u.creadoEn),
          },
          {
            t: 'Último acceso',
            i: 'clock',
            v: u.invitacion || !u.ultimoAcceso ? 'Nunca' : haceCuanto(u.ultimoAcceso),
          },
          { t: 'Permisos', i: 'shield-check', v: `${n} de ${this.modulos().length} módulos` },
        ],
      },
    ];
  });
  /** «Acceso a Goods» de la ficha. Ni tú ni el dueño pueden quedar sin acceso. */
  protected readonly acceso = computed(() => {
    const u = this.u();
    if (!u) return { on: false, bloqueado: true, texto: '' };
    const yo = u.id === this.yoId();
    const dueno = this.rolActual()?.esDueno === true;
    const texto = yo
      ? dueno
        ? 'Eres el dueño; no puedes quitarte el acceso.'
        : 'Eres tú; no puedes quitarte el acceso.'
      : dueno
        ? 'Es el dueño de la tienda; siempre tiene acceso.'
        : u.invitacion
          ? 'Se activa cuando acepte la invitación y cree su contraseña.'
          : u.activo
            ? 'Puede entrar con su correo y contraseña.'
            : 'No puede entrar. Sus datos y su actividad se conservan.';
    return {
      on: yo || dueno || (!u.invitacion && u.activo),
      bloqueado: yo || dueno || !!u.invitacion || this.cambiandoAcceso(),
      texto,
    };
  });

  /**
   * «Sesiones abiertas»: el backend deja una por navegador (al entrar cierra
   * la anterior del mismo navegador, IP y panel). La primera lleva el punto
   * verde si la persona tiene Goods abierto.
   */
  protected readonly filasSesion = computed<SesionVM[]>(() =>
    (this.sesiones() ?? []).map((s, i) => {
      const activa = i === 0 && this.sesionesEnLinea();
      return {
        id: s.id,
        icono: s.tipo === 'movil' ? 'device-mobile' : 'device-laptop',
        disp: s.dispositivo ?? 'Navegador sin identificar',
        lugar: s.ip ?? '',
        min: activa
          ? 0
          : Math.max(1, Math.round((Date.now() - new Date(s.ultimoUso).getTime()) / 60_000)),
        hace: haceCuanto(s.ultimoUso).toLowerCase(),
      };
    }),
  );
  protected readonly sinSesiones = computed(() => {
    const u = this.u();
    if (!u) return '';
    return u.invitacion
      ? 'Todavía no ha entrado a Goods.'
      : u.activo
        ? 'No tiene sesiones abiertas.'
        : 'Sin acceso; sus sesiones se cerraron.';
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    this.soloRol = Number(q.get('rol')) || null;
    this.cargar(Number(q.get('usuario')) || null);
    inject(RealtimeService)
      .escuchar<{ usuarioId: number; enLinea: boolean; ultimoAcceso?: string }>('presencia:cambio')
      .pipe(takeUntilDestroyed())
      .subscribe((p) => this.presencia(p));
  }

  /** Alguien del equipo abrió o cerró Goods. */
  private presencia(p: { usuarioId: number; enLinea: boolean; ultimoAcceso?: string }): void {
    this.conectados.update((c) => {
      const n = new Set(c);
      if (p.enLinea) n.add(p.usuarioId);
      else n.delete(p.usuarioId);
      return n;
    });
    if (p.ultimoAcceso)
      this.usuarios.update((us) =>
        us.map((u) => (u.id === p.usuarioId ? { ...u, ultimoAcceso: p.ultimoAcceso! } : u)),
      );
    if (this.sel() === p.usuarioId) this.sesionesEnLinea.set(p.enLinea);
  }

  protected cargar(abrir: number | null = null): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      // Todas las páginas: los grupos por rol y los contadores salen de aquí.
      u: this.usuarioService.todos(),
      roles: this.rolService.listarAsignables(),
      permisos: this.rolService.listarPermisosAsignables(),
    }).subscribe({
      next: ({ u, roles, permisos }) => {
        this.usuarios.set(u);
        this.rolesApi.set(roles);
        this.modulos.set(modulosDe(permisos));
        this.cargando.set(false);
        // `?rol=` (desde Roles): deja abierto solo el grupo de ese rol.
        const solo = this.soloRol;
        if (solo)
          this.cerrados.set([...new Set(u.map((x) => x.rolId))].filter((id) => id !== solo));
        this.soloRol = null;
        if (abrir) this.abrir(abrir);
      },
      error: () => {
        this.error.set('Revisa tu conexión e intenta de nuevo.');
        this.cargando.set(false);
      },
    });
    this.usuarioService
      .enLinea()
      .pipe(catchError(() => of({ ids: [] as number[] })))
      .subscribe((r) => this.conectados.set(new Set(r.ids)));
  }

  protected conectado(u: Usuario): boolean {
    return enLinea(u, this.conectados());
  }

  // Lista y ficha

  protected abrir(id: number): void {
    if (this.sel() === id) {
      this.sel.set(null);
      return;
    }
    this.sel.set(id);
    this.propuesta.set(null);
    this.rolMenu.set(false);
    this.menu.set(false);
    this.act.set([]);
    this.cargarSesiones(id);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 30 * DIA_MS);
    // Sin Plan Plus el endpoint responde 403: la ficha queda sin actividad.
    this.actividad
      .listar({ desde, hasta, usuarioId: id })
      .pipe(catchError(() => of({ items: [] as ItemActividad[] })))
      .subscribe((r) => {
        if (this.sel() === id) this.act.set(r.items);
      });
  }

  protected ir(d: number): void {
    const l = this.orden();
    const i = l.findIndex((x) => x.id === this.sel());
    const n = l[i + d];
    if (n) this.abrir(n.id);
  }

  protected alternarGrupo(id: number): void {
    this.cerrados.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  protected alternarMenu(): void {
    this.menu.update((m) => !m);
    this.rolMenu.set(false);
    this.filtros.set(false);
  }

  protected alternarRolMenu(): void {
    this.rolMenu.update((m) => !m);
    this.menu.set(false);
    this.filtros.set(false);
  }

  protected elegirFiltro(k: FiltroEstado): void {
    this.filtro.set(k);
    this.filtros.set(false);
  }

  protected cerrarMenus(): void {
    this.menu.set(false);
    this.rolMenu.set(false);
    this.filtros.set(false);
  }

  protected cerrarFicha(): void {
    this.sel.set(null);
    this.completa.set(false);
    this.menu.set(false);
    this.propuesta.set(null);
  }

  protected verActividad(): void {
    this.router.navigate(['/settings/actividad'], { queryParams: { persona: this.sel() } });
  }

  protected gestionarRoles(): void {
    this.router.navigate(['/settings/roles']);
  }

  // Cambiar rol

  protected proponer(r: RolUsuario): void {
    this.propuesta.set(r.id === this.u()?.rolId ? null : r.id);
    this.rolMenu.set(false);
  }

  protected aplicarRol(): void {
    const u = this.u();
    const r = this.rolPropuesto();
    if (!u || !r) return;
    const antes = u.rolId;
    this.alerta
      .seguir(this.usuarioService.cambiarRol(u.id, r.id), {
        titulo: 'Cambiando rol…',
        exito: {
          titulo: `${nombreCorto(u)} ahora es ${r.nombre}`,
          // El backend avisa `permisos:cambio` y el panel de esa persona se actualiza solo.
          texto: 'Los permisos nuevos aplican al instante.',
          accion: {
            label: 'Deshacer',
            ejecutar: () =>
              this.usuarioService.cambiarRol(u.id, antes).subscribe((x) => this.reemplazar(x)),
          },
        },
        error: { titulo: 'No se pudo cambiar el rol' },
      })
      .subscribe((x) => {
        this.reemplazar(x);
        this.propuesta.set(null);
        this.cerrados.update((c) => c.filter((id) => id !== r.id));
      });
  }

  private reemplazar(x: Usuario): void {
    this.usuarios.update((us) => us.map((u) => (u.id === x.id ? { ...u, ...x } : u)));
  }

  // Acciones del menú ⋯

  protected reenviar(): void {
    const u = this.u();
    if (!u?.invitacion) return;
    this.menu.set(false);
    this.alerta
      .seguir(this.usuarioService.reenviarInvitacion(u.id), {
        titulo: 'Enviando invitación…',
        exito: {
          titulo: 'Invitación reenviada',
          texto: `Le llegó un enlace nuevo a ${u.correo}. Vence en 48 horas.`,
        },
        error: { titulo: 'No se pudo reenviar' },
      })
      .subscribe(({ venceEn }) =>
        this.usuarios.update((us) =>
          us.map((x) => (x.id === u.id ? { ...x, invitacion: { venceEn, vencida: false } } : x)),
        ),
      );
  }

  protected copiarCorreo(): void {
    const u = this.u();
    if (!u) return;
    navigator.clipboard?.writeText(u.correo);
    this.menu.set(false);
    this.alerta.mostrar({ estado: 'info', titulo: 'Correo copiado', texto: u.correo });
  }

  protected pedirQuitar(): void {
    const u = this.u();
    if (!u || u.id === this.yoId()) return;
    this.menu.set(false);
    this.alerta.mostrar({
      estado: 'warning',
      titulo: `¿Quitar a ${nombreCorto(u)} del equipo?`,
      texto:
        'Pierde el acceso y deja de aparecer aquí. Lo que hizo se conserva en Actividad del equipo.',
      autoCierre: null,
      abierta: true,
      accion: {
        label: 'Quitar',
        ejecutar: () =>
          this.alerta
            .seguir(this.usuarioService.eliminar(u.id), {
              titulo: 'Quitando…',
              exito: {
                titulo: `${nombreDe(u)} ya no está en tu equipo`,
                accion: { label: 'Deshacer', ejecutar: () => this.restaurar(u) },
              },
              error: { titulo: 'No se pudo quitar' },
            })
            .subscribe(() => {
              const l = this.orden();
              const i = l.findIndex((x) => x.id === u.id);
              const sig = l[i + 1] ?? l[i - 1];
              this.usuarios.update((us) => us.filter((x) => x.id !== u.id));
              this.sel.set(sig?.id ?? null);
              this.completa.set(false);
            }),
      },
      accion2: { label: 'Cancelar', ejecutar: () => undefined },
    });
  }

  /** «Deshacer» de quitar: vuelve con su rol y su acceso (sin sesiones). */
  private restaurar(u: Usuario): void {
    this.usuarioService.restaurar(u.id).subscribe({
      next: ({ invitacionReenviada, ...x }) => {
        this.usuarios.update((us) => [...us.filter((y) => y.id !== x.id), x]);
        this.filtro.set('todos');
        this.sel.set(null);
        this.abrir(x.id);
        this.alerta.mostrar({
          estado: 'success',
          titulo: `${nombreCorto(x)} volvió a tu equipo`,
          texto: invitacionReenviada
            ? `Le llegó una invitación nueva a ${x.correo}; la anterior ya no sirve.`
            : 'Con su rol y su acceso. Tendrá que volver a entrar.',
        });
      },
      error: (e) =>
        this.alerta.mostrar({
          estado: 'error',
          titulo: `No se pudo devolver a ${nombreCorto(u)}`,
          texto: mensajeDeError(e),
        }),
    });
  }

  // Acceso y sesiones

  protected alternarAcceso(): void {
    const u = this.u();
    if (!u || this.acceso().bloqueado) return;
    const n = u.activo ? this.filasSesion().length : 0;
    if (!u.activo) return this.aplicarAcceso(u, true);
    this.alerta.mostrar({
      estado: 'warning',
      titulo: `¿Quitarle el acceso a ${nombreCorto(u)}?`,
      texto:
        (n
          ? `Se cierran sus ${n === 1 ? 'sesión abierta' : n + ' sesiones abiertas'} y no`
          : 'No') +
        ' podrá entrar hasta que se lo devuelvas. Sus datos y su actividad se conservan.',
      autoCierre: null,
      abierta: true,
      accion: { label: 'Quitar acceso', ejecutar: () => this.aplicarAcceso(u, false) },
      accion2: { label: 'Cancelar', ejecutar: () => undefined },
    });
  }

  private aplicarAcceso(u: Usuario, activo: boolean): void {
    this.cambiandoAcceso.set(true);
    this.alerta
      .seguir(this.usuarioService.cambiarAcceso(u.id, activo), {
        titulo: activo ? 'Devolviendo el acceso…' : 'Quitando el acceso…',
        exito: activo
          ? {
              titulo: `${nombreCorto(u)} puede entrar de nuevo`,
              texto: 'Entra con su mismo correo y contraseña.',
            }
          : {
              titulo: `${nombreCorto(u)} ya no puede entrar`,
              accion: { label: 'Deshacer', ejecutar: () => this.aplicarAcceso(u, true) },
            },
        error: { titulo: activo ? 'No se pudo devolver el acceso' : 'No se pudo quitar el acceso' },
      })
      .subscribe({
        next: (x) => {
          this.cambiandoAcceso.set(false);
          this.reemplazar(x);
          if (!activo && this.sel() === u.id) this.sesiones.set([]);
        },
        error: () => this.cambiandoAcceso.set(false),
      });
  }

  private cargarSesiones(id: number): void {
    this.sesiones.set(null);
    this.usuarioService.sesiones(id).subscribe({
      next: (r) => {
        if (this.sel() !== id) return;
        this.sesionesEnLinea.set(r.enLinea);
        this.sesiones.set(r.sesiones);
      },
      error: () => this.sel() === id && this.sesiones.set([]),
    });
  }

  protected cerrarSesion(id: number): void {
    const u = this.u();
    const s = this.sesiones()?.find((x) => x.id === id);
    if (!u || !s) return;
    const yo = u.id === this.yoId();
    const disp = s.dispositivo ?? 'Ese dispositivo';
    this.alerta
      .seguir(this.usuarioService.cerrarSesion(u.id, s.id), {
        titulo: 'Cerrando sesión…',
        exito: {
          titulo: 'Sesión cerrada',
          // El token de acceso que ya tiene sigue sirviendo unos minutos.
          texto: `${disp} · ${yo ? 'tendrás' : nombreCorto(u) + ' tendrá'} que volver a entrar en unos minutos.`,
        },
        error: { titulo: 'No se pudo cerrar la sesión' },
      })
      .subscribe(() => {
        if (this.sel() === u.id)
          this.sesiones.update((ss) => (ss ?? []).filter((x) => x.id !== s.id));
      });
  }

  protected pedirCerrarSesiones(): void {
    const u = this.u();
    if (!u) return;
    if (u.id !== this.yoId()) return this.cerrarSesiones(u);
    // Las tuyas incluyen esta: el panel se cierra al instante.
    this.alerta.mostrar({
      estado: 'warning',
      titulo: '¿Cerrar todas tus sesiones?',
      texto: 'Incluye este navegador: tendrás que volver a entrar en todos tus dispositivos.',
      autoCierre: null,
      abierta: true,
      accion: { label: 'Cerrar todas', ejecutar: () => this.cerrarSesiones(u) },
      accion2: { label: 'Cancelar', ejecutar: () => undefined },
    });
  }

  private cerrarSesiones(u: Usuario): void {
    const n = this.filasSesion().length;
    this.alerta
      .seguir(this.usuarioService.cerrarSesiones(u.id), {
        titulo: 'Cerrando sesiones…',
        exito: {
          titulo: n === 1 ? 'Sesión cerrada' : `${n} sesiones cerradas`,
          texto: `${nombreCorto(u)} tendrá que volver a entrar en todos sus dispositivos.`,
        },
        error: { titulo: 'No se pudieron cerrar las sesiones' },
      })
      .subscribe(() => this.sel() === u.id && this.sesiones.set([]));
  }

  // Invitar

  protected enviarInvitaciones(e: Invitacion): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    // Solo el correo y el rol: la persona escribe su nombre al aceptar.
    from(e.correos)
      .pipe(
        mergeMap(
          (correo) =>
            this.usuarioService
              .crearEmpleado({ correo, rolId: e.rol.id, mensaje: e.mensaje || undefined })
              .pipe(
                map((u) => ({ u, correo, error: '' })),
                catchError((err: unknown) =>
                  of({ u: null, correo, error: mensajeDeError(err, 'No se pudo enviar.') }),
                ),
              ),
          3,
        ),
        toArray(),
      )
      .subscribe((res) => {
        const creados = res.map((r) => r.u).filter((x): x is Usuario => !!x);
        const malos = res.filter((r) => !r.u);
        const fallos = malos.length;
        this.enviando.set(false);
        this.invitar.set(false);
        this.usuarios.update((us) => [...us, ...creados]);
        if (creados.length) {
          this.filtro.set('todos');
          this.busqueda.set('');
          this.cerrados.update((c) => c.filter((id) => id !== e.rol.id));
          this.propuesta.set(null);
          this.sel.set(null);
          this.abrir(creados[0].id);
        }
        this.alerta.mostrar(
          fallos
            ? {
                estado: 'error',
                titulo: `${creados.length} de ${res.length} invitaciones enviadas`,
                texto:
                  fallos === 1
                    ? `${malos[0].correo}: ${malos[0].error}`
                    : `${fallos} no se pudieron enviar: ${malos.map((m) => m.correo).join(', ')}.` +
                      (malos.every((m) => m.error === malos[0].error) ? ` ${malos[0].error}` : ''),
              }
            : {
                estado: 'success',
                titulo:
                  creados.length === 1
                    ? 'Invitación enviada'
                    : `${creados.length} invitaciones enviadas`,
                texto: 'Les llega un correo para crear su contraseña. El enlace vale 48 horas.',
              },
        );
      });
  }

  // Teclado

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.invitar()) return this.invitar.set(false);
      if (this.filtros() || this.menu() || this.rolMenu()) return this.cerrarMenus();
      if (this.propuesta()) return this.propuesta.set(null);
      if (!esTeclaDeLista(e)) return;
      if (this.completa()) return this.completa.set(false);
      if (this.sel()) this.sel.set(null);
      return;
    }
    if (!esTeclaDeLista(e) || this.invitar()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ir(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      this.invitar.set(true);
    } else if (e.key.toLowerCase() === 'f' && this.sel()) {
      this.completa.update((c) => !c);
    }
  }
}
