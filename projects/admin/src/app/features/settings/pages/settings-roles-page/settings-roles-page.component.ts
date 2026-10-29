import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  MapaNiveles,
  Modulo,
  Nivel,
  areasDe,
  idsDeNiveles,
  modulosDe,
  nivelesDeRol,
} from '../../../../core/roles/niveles';
import { Rol } from '../../../../core/roles/models/rol.model';
import { RolService } from '../../../../core/roles/rol.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { Usuario } from '../../../../core/usuarios/models/usuario.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { esTeclaDeLista, normalizar } from '../../../../shared/ui/persona';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';

import { ICONO_PLANTILLA, nombreDe, nombreRol } from '../../shared/usuarios';
import { BuscadorListaComponent } from '../../shared/ui/buscador-lista/buscador-lista.component';
import { FichaBarraComponent } from '../../shared/ui/ficha-barra/ficha-barra.component';
import { FichaVaciaComponent } from '../../shared/ui/ficha-vacia/ficha-vacia.component';
import {
  FilaListaComponent,
  GrupoListaComponent,
} from '../../shared/ui/fila-lista/fila-lista.component';
import { ListaFichaComponent } from '../../shared/ui/lista-ficha/lista-ficha.component';
import {
  ItemMenuComponent,
  MenuFichaComponent,
} from '../../shared/ui/menu-ficha/menu-ficha.component';
import { PastillaCabeceraComponent } from '../../shared/ui/pastilla-cabecera/pastilla-cabecera.component';
import { FilaRolComponent } from './components/fila-rol/fila-rol.component';
import { IdentidadRolComponent } from './components/identidad-rol/identidad-rol.component';
import { LateralRolComponent } from './components/lateral-rol/lateral-rol.component';
import {
  ModalNuevoRolComponent,
  NuevoRol,
} from './components/modal-nuevo-rol/modal-nuevo-rol.component';
import { PermisosRolComponent } from './components/permisos-rol/permisos-rol.component';
import { PersonasRolComponent } from './components/personas-rol/personas-rol.component';

type Grupo = 'plantilla' | 'propio';

/**
 * Roles y permisos: lista de roles a la izquierda y ficha del elegido.
 *
 * @remarks
 * - Las plantillas (`empresaId === null`) son de solo lectura; los roles
 *   propios se editan en la ficha. Tocar un nivel de una plantilla ofrece
 *   duplicarla.
 * - El borrador de niveles vive en `borrador` y se muestra con
 *   `alerta.fijarCambios` (Guardar / Descartar). Al guardar se mandan los
 *   permisos planos con `idsDeNiveles`.
 * - Teclado: Esc cierra en orden (modal → menú → página completa → ficha),
 *   ↑ ↓ mueven la selección, N abre «Nuevo rol» y F la página completa.
 */
import {
  CargarMasComponent,
  PaginaPorGrupo,
} from '../../../../shared/ui/cargar-mas/cargar-mas.component';

@Component({
  selector: 'app-settings-roles-page',
  standalone: true,
  imports: [
    IcComponent,
    ModuloCabeceraComponent,
    EstadoPaginaComponent,
    PastillaCabeceraComponent,
    ListaFichaComponent,
    BuscadorListaComponent,
    GrupoListaComponent,
    FilaListaComponent,
    FichaVaciaComponent,
    FichaBarraComponent,
    MenuFichaComponent,
    ItemMenuComponent,
    FilaRolComponent,
    IdentidadRolComponent,
    PermisosRolComponent,
    PersonasRolComponent,
    LateralRolComponent,
    ModalNuevoRolComponent,
    CargarMasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-roles-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]',
    '(document:keydown)': 'tecla($event)',
    '(document:click)': 'menu.set(false)',
  },
})
export class SettingsRolesPageComponent {
  private readonly rolService = inject(RolService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly alerta = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly icono = icono;
  protected readonly lectura =
    'Qué puede ver y hacer cada persona de tu equipo. Las plantillas de Goods se mantienen solas y no se editan; duplícalas o crea roles propios para ajustar cada permiso a cómo trabaja tu tienda.';

  // Datos
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly modulos = signal<Modulo[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);

  // UI
  /** 15 filas por grupo y «Cargar 15 más · quedan N» (como Productos); la abierta siempre se ve. */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly sel = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly cerrados = signal<Grupo[]>([]);
  protected readonly completa = signal(false);
  protected readonly menu = signal(false);
  protected readonly nuevo = signal(false);
  protected readonly creando = signal(false);
  /** Niveles editados del rol elegido (`null` = sin cambios). */
  protected readonly borrador = signal<{ id: number; niveles: MapaNiveles } | null>(null);

  // Derivados
  protected readonly areas = computed(() => areasDe(this.modulos()));
  protected readonly rol = computed(() => this.roles().find((r) => r.id === this.sel()) ?? null);
  protected readonly propios = computed(
    () => this.roles().filter((r) => r.empresaId !== null).length,
  );
  protected readonly plantillas = computed(() => this.roles().length - this.propios());

  protected readonly visibles = computed(() => {
    const q = normalizar(this.busqueda().trim());
    // Por nombre, descripción, código de permiso («pedidos.ver») o módulo con acceso («Pedidos»).
    const texto = (r: Rol) => {
      const conAcceso = this.modulos().filter((m) =>
        r.permisos.some((p) => m.permisos.some((x) => x.id === p.id)),
      );
      return `${r.nombre} ${r.descripcion ?? ''} ${r.permisos.map((p) => p.codigo).join(' ')} ${conAcceso.map((m) => m.nombre).join(' ')}`;
    };
    const coincide = (r: Rol) => !q || normalizar(texto(r)).includes(q);
    return this.roles()
      .filter(coincide)
      .sort((a, b) => Number(a.empresaId !== null) - Number(b.empresaId !== null));
  });
  protected readonly grupos = computed(() => {
    const buscando = !!this.busqueda().trim();
    return [
      {
        k: 'plantilla' as Grupo,
        t: 'Plantillas de Goods',
        icono: 'lock',
        items: this.visibles().filter((r) => r.empresaId === null),
      },
      {
        k: 'propio' as Grupo,
        t: 'Roles de tu tienda',
        icono: 'building-store',
        items: this.visibles().filter((r) => r.empresaId !== null),
      },
    ]
      .filter((g) => g.items.length)
      .map((g) => ({ ...g, abierto: buscando || !this.cerrados().includes(g.k) }));
  });
  protected readonly pos = computed(
    () => this.visibles().findIndex((r) => r.id === this.sel()) + 1,
  );

  protected readonly base = computed<MapaNiveles>(() => {
    const r = this.rol();
    return r ? nivelesDeRol(r, this.modulos()) : {};
  });
  protected readonly actual = computed<MapaNiveles>(() => {
    const b = this.borrador();
    return b && b.id === this.sel() ? b.niveles : this.base();
  });
  protected readonly hayCambios = computed(
    () => this.borrador()?.id === this.sel() && this.sel() !== null,
  );
  protected readonly cambios = computed(() => {
    const a = this.base();
    const b = this.actual();
    const ks = Object.keys(b).filter((k) => (a[k] ?? 0) !== b[k]);
    return {
      gana: ks.filter((k) => b[k] > (a[k] ?? 0)).length,
      pierde: ks.filter((k) => b[k] < (a[k] ?? 0)).length,
      total: ks.length,
    };
  });

  protected readonly gente = computed(() => this.usuarios().filter((u) => u.rolId === this.sel()));
  protected readonly vacioResumen = computed(
    () =>
      `${this.plantillas()} plantillas · ${this.propios()} roles propios · ${this.usuarios().length} personas`,
  );
  /** Módulos con acceso con el borrador aplicado («5/9»). */
  protected readonly modulosDelRol = computed(() => {
    const n = this.actual();
    return `${this.modulos().filter((m) => (n[m.codigo] ?? 0) > 0).length}/${this.modulos().length}`;
  });
  protected readonly permisosDelRol = computed(
    () => idsDeNiveles(this.actual(), this.modulos()).length,
  );
  protected readonly totalPermisos = computed(() =>
    this.modulos().reduce((n, m) => n + m.permisos.length, 0),
  );

  constructor() {
    this.cargar();
    // Cambios sin guardar → alerta fija de la pila.
    effect(() => {
      const r = this.rol();
      const c = this.cambios();
      const hay = this.hayCambios();
      untracked(() =>
        this.alerta.fijarCambios(
          hay && r && c.total
            ? {
                titulo: 'Cambios sin guardar',
                texto: `Permisos de ${r.nombre}. Las personas con este rol los verán al guardar.`,
                guardar: () => this.guardar(),
                descartar: () => this.borrador.set(null),
              }
            : null,
        ),
      );
    });
    inject(DestroyRef).onDestroy(() => this.alerta.soltarCambios());
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      roles: this.rolService.listar(),
      // Solo para saber qué plantillas mostrar; si falla se muestran todas.
      asignables: this.rolService.listarAsignables().pipe(catchError(() => of(null))),
      permisos: this.rolService.listarPermisosAsignables(),
      // Todas las páginas: el conteo de personas por rol sale de aquí.
      usuarios: this.usuarioService.todos(),
    }).subscribe({
      next: ({ roles, asignables, permisos, usuarios }) => {
        // `GET /roles` también trae plantillas internas (`cliente`, `admin`) que el dueño no puede
        // asignar: se muestran solo las plantillas de negocio (las de `/roles/asignables`).
        const ids = asignables ? new Set(asignables.map((r) => r.id)) : null;
        this.roles.set(
          roles.filter((r) => r.empresaId !== null || !ids || ids.has(r.id)).map(paraVista),
        );
        this.modulos.set(modulosDe(permisos));
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('Revisa tu conexión e intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected genteDe(r: Rol): Usuario[] {
    return this.usuarios().filter((u) => u.rolId === r.id);
  }

  // Selección y navegación

  protected abrir(r: Rol): void {
    if (this.sel() === r.id && !this.hayCambios()) {
      this.sel.set(null);
      return;
    }
    this.sel.set(r.id);
    this.menu.set(false);
  }

  protected ir(d: number): void {
    const l = this.visibles();
    const i = l.findIndex((x) => x.id === this.sel());
    const n = l[Math.max(0, Math.min(l.length - 1, i + d))];
    if (n) this.sel.set(n.id);
  }

  protected alternarGrupo(k: Grupo): void {
    this.cerrados.update((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  }

  protected verUsuarios(): void {
    this.router.navigate(['/settings/usuarios'], { queryParams: { rol: this.sel() } });
  }

  // Borrador de niveles

  private fijar(cambios: MapaNiveles): void {
    const r = this.rol();
    if (!r) return;
    if (r.empresaId === null) {
      this.alerta.mostrar({
        estado: 'info',
        titulo: 'Es una plantilla de Goods',
        texto: 'Duplícala como rol propio para cambiar sus permisos.',
        accion: { label: 'Duplicar', ejecutar: () => this.duplicar() },
      });
      return;
    }
    const niveles = { ...this.actual(), ...cambios };
    const igual = Object.keys(niveles).every((k) => niveles[k] === (this.base()[k] ?? 0));
    this.borrador.set(igual ? null : { id: r.id, niveles });
  }

  protected fijarModulo(e: { codigo: string; nivel: Nivel }): void {
    this.fijar({ [e.codigo]: e.nivel });
  }

  protected fijarArea(e: { modulos: Modulo[]; nivel: Nivel }): void {
    this.fijar(Object.fromEntries(e.modulos.map((m) => [m.codigo, e.nivel])));
  }

  protected guardar(): void {
    const r = this.rol();
    const b = this.borrador();
    if (!r || !b) return;
    const antes = r.permisos.map((p) => p.id);
    const n = this.gente().length;
    const quienes = n
      ? ' · ' +
        (n === 1
          ? 'la persona con este rol los verá'
          : `las ${n} personas con este rol los verán`) +
        ' al instante.'
      : '';
    this.alerta
      .seguir(this.rolService.asignarPermisos(r.id, idsDeNiveles(b.niveles, this.modulos())), {
        titulo: 'Guardando permisos…',
        exito: {
          titulo: 'Permisos guardados',
          texto: r.nombre + quienes,
          accion: {
            label: 'Deshacer',
            ejecutar: () =>
              this.rolService.asignarPermisos(r.id, antes).subscribe((x) => this.reemplazar(x)),
          },
        },
        error: {
          titulo: 'No se guardaron los permisos',
          texto: 'Revisa tu conexión e intenta de nuevo.',
        },
      })
      .subscribe((x) => {
        this.reemplazar(x);
        this.borrador.set(null);
      });
  }

  private reemplazar(x: Rol): void {
    this.roles.update((rs) => rs.map((r) => (r.id === x.id ? paraVista(x) : r)));
  }

  // Acciones del rol

  protected renombrar(e: { campo: 'nombre' | 'descripcion'; valor: string }): void {
    const r = this.rol();
    const valor = e.valor.trim();
    if (
      !r ||
      r.empresaId === null ||
      (r[e.campo] ?? '') === valor ||
      (e.campo === 'nombre' && !valor)
    )
      return;
    this.rolService.actualizar(r.id, { [e.campo]: valor }).subscribe({
      next: (x) => this.reemplazar(x),
      error: (err) =>
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se pudo renombrar',
          texto: mensajeDeError(err),
        }),
    });
  }

  protected duplicar(): void {
    const r = this.rol();
    if (!r) return;
    this.menu.set(false);
    const ids = idsDeNiveles(this.actual(), this.modulos());
    this.rolService
      .crear({
        nombre: this.nombreCopia(r.nombre),
        descripcion: r.descripcion ?? undefined,
        icono: r.icono ?? undefined,
      })
      .subscribe({
        next: (copia) =>
          this.rolService.asignarPermisos(copia.id, ids).subscribe((x) => {
            this.roles.update((rs) => [...rs, x]);
            this.sel.set(x.id);
            this.cerrados.update((c) => c.filter((k) => k !== 'propio'));
            this.alerta.mostrar({
              estado: 'success',
              titulo: 'Rol duplicado',
              texto: 'Ahora puedes cambiarle el nombre y ajustar sus permisos.',
              accion: { label: 'Deshacer', ejecutar: () => this.borrarSinAviso(x, r.id) },
            });
          }),
        error: (err) =>
          this.alerta.mostrar({
            estado: 'error',
            titulo: 'No se pudo duplicar',
            texto: mensajeDeError(err),
          }),
      });
  }

  /** «Cajero (copia)», o «Cajero (copia 2)» si ya existe: el nombre es único por tienda. */
  private nombreCopia(nombre: string): string {
    const usados = new Set(this.roles().map((x) => x.nombre.toLowerCase()));
    let n = 1;
    let t = `${nombre} (copia)`;
    while (usados.has(t.toLowerCase())) t = `${nombre} (copia ${++n})`;
    return t;
  }

  protected pedirEliminar(): void {
    const r = this.rol();
    if (!r || r.empresaId === null) return;
    this.menu.set(false);
    const g = this.gente();
    if (g.length) {
      this.alerta.mostrar({
        estado: 'warning',
        titulo: `Aún no puedes eliminar «${r.nombre}»`,
        texto: `${g.length === 1 ? nombreDe(g[0]) + ' tiene' : g.length + ' personas tienen'} este rol. Cámbiales el rol desde Usuarios primero.`,
        accion: { label: 'Ir a Usuarios', ejecutar: () => this.verUsuarios() },
      });
      return;
    }
    this.alerta.mostrar({
      estado: 'warning',
      titulo: `¿Eliminar el rol «${r.nombre}»?`,
      texto: 'Nadie lo tiene asignado. Podrás deshacerlo en los próximos segundos.',
      autoCierre: null,
      abierta: true,
      accion: { label: 'Eliminar', ejecutar: () => this.eliminar(r) },
      accion2: { label: 'Cancelar', ejecutar: () => undefined },
    });
  }

  /** Borra el rol y abre el siguiente de la lista. «Deshacer» lo vuelve a crear con sus mismos permisos (con otro id). */
  private eliminar(r: Rol): void {
    const l = this.visibles();
    const i = l.findIndex((x) => x.id === r.id);
    const sig = l[i + 1] ?? l[i - 1];
    this.alerta
      .seguir(this.rolService.eliminar(r.id), {
        titulo: 'Eliminando…',
        exito: {
          titulo: 'Rol eliminado',
          accion: { label: 'Deshacer', ejecutar: () => this.recrear(r) },
        },
        error: { titulo: 'No se pudo eliminar' },
      })
      .subscribe(() => {
        this.roles.update((rs) => rs.filter((x) => x.id !== r.id));
        if (this.borrador()?.id === r.id) this.borrador.set(null);
        this.sel.set(sig?.id ?? null);
      });
  }

  private recrear(r: Rol): void {
    const ids = r.permisos.map((p) => p.id);
    this.rolService
      .crear({
        nombre: r.nombre,
        descripcion: r.descripcion ?? undefined,
        icono: r.icono ?? undefined,
      })
      .subscribe({
        next: (nuevo) => {
          const fin = (x: Rol) => {
            this.roles.update((rs) => [...rs, x]);
            this.sel.set(x.id);
          };
          if (ids.length) this.rolService.asignarPermisos(nuevo.id, ids).subscribe(fin);
          else fin(nuevo);
        },
        error: (err) =>
          this.alerta.mostrar({
            estado: 'error',
            titulo: 'No se pudo deshacer',
            texto: mensajeDeError(err),
          }),
      });
  }

  /** Deshacer de «Duplicar» y «Nuevo rol»: borra el rol recién creado y vuelve a `volverA`. */
  private borrarSinAviso(r: Rol, volverA: number | null): void {
    this.rolService.eliminar(r.id).subscribe(() => {
      this.roles.update((rs) => rs.filter((x) => x.id !== r.id));
      this.sel.set(volverA);
    });
  }

  // Nuevo rol

  protected crear(e: NuevoRol): void {
    if (this.creando()) return;
    this.creando.set(true);
    this.rolService
      .crear({ nombre: e.nombre, descripcion: e.descripcion, icono: e.icono })
      .subscribe({
        next: (creado) => {
          const fin = (x: Rol) => {
            this.creando.set(false);
            this.nuevo.set(false);
            this.busqueda.set('');
            this.roles.update((rs) => [...rs, x]);
            this.sel.set(x.id);
            this.cerrados.update((c) => c.filter((k) => k !== 'propio'));
            this.alerta.mostrar({
              estado: 'success',
              titulo: `Rol «${x.nombre}» creado`,
              texto: 'Ajusta sus permisos y asígnalo desde Usuarios.',
              accion: { label: 'Deshacer', ejecutar: () => this.borrarSinAviso(x, null) },
            });
          };
          if (e.permisoIds.length)
            this.rolService.asignarPermisos(creado.id, e.permisoIds).subscribe(fin);
          else fin(creado);
        },
        error: (err) => {
          this.creando.set(false);
          this.alerta.mostrar({
            estado: 'error',
            titulo: 'No se pudo crear el rol',
            texto: mensajeDeError(err),
          });
        },
      });
  }

  // Teclado

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.nuevo()) return this.nuevo.set(false);
      if (this.menu()) return this.menu.set(false);
      if (!esTeclaDeLista(e)) return;
      if (this.completa()) return this.completa.set(false);
      if (this.sel() && !this.hayCambios()) this.sel.set(null);
      return;
    }
    if (!esTeclaDeLista(e) || this.nuevo()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ir(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      this.nuevo.set(true);
    } else if (e.key.toLowerCase() === 'f' && this.sel()) {
      this.completa.update((c) => !c);
    }
  }
}

/** Las plantillas llegan con su código (`dueno_empresa`); se muestran con nombre legible. */
function paraVista(r: Rol): Rol {
  return r.empresaId === null
    ? { ...r, nombre: nombreRol(r.nombre), icono: r.icono ?? ICONO_PLANTILLA[r.nombre] ?? null }
    : r;
}
