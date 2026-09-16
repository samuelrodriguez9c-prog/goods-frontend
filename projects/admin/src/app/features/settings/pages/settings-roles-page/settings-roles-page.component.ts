import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconLock, IconPencil, IconPlus, IconShieldLock, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { GuardarRolPayload, RolService } from '../../../../core/roles/rol.service';
import { Permiso, Rol } from '../../../../core/roles/models/rol.model';

interface FormularioRol {
  nombre: string;
  descripcion: string;
}

const FORMULARIO_VACIO: FormularioRol = { nombre: '', descripcion: '' };

/**
 * "Roles y permisos" del lado `admin` — Fase 6 de
 * `PROPUESTA_ROLES_Y_ACCESOS.md` (§5.4/§6 paso 5). Reemplaza la pantalla
 * de solo lectura de la Fase 5: ahora que `Rol.empresaId` existe, un
 * dueño puede armar sus propios roles (ej. "Cajero", "Repartidor") sin
 * afectar a ninguna otra Empresa — antes cualquier edición le pegaría al
 * catálogo GLOBAL compartido por todos los clientes de Goods, por eso
 * esa versión no dejaba editar nada.
 *
 * `GET /roles` (vía `listar()`) ahora devuelve una mezcla: los templates
 * de siempre (`empresaId: null` — `admin`/`cliente`/`dueno_empresa`/
 * `empleado_empresa`) más los roles propios de mi Empresa. Los templates
 * se muestran de solo lectura (el backend los rechazaría igual —
 * `RolService.puedeModificar` — pero ocultar los botones evita mandar
 * una request que sabemos que va a fallar); solo mis propios roles
 * (`rol.empresaId !== null`, que por construcción del filtro del backend
 * solo puede ser MI empresaId) tienen edición/borrado/permisos.
 *
 * El catálogo de permisos para el checklist de "asignar" viene de
 * `GET /permisos/asignables` (`listarPermisosAsignables()`), no de
 * `GET /permisos` — ver `RolService.findAsignablesPermisos` del backend:
 * un dueño no tiene `permisos.ver`, así que ni siquiera se le muestran
 * como opción los códigos reservados de administración de Goods
 * (`PERMISOS_RESERVADOS_STAFF`) que el backend igual rechazaría.
 */
@Component({
  selector: 'app-settings-roles-page',
  standalone: true,
  imports: [TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-roles-page.component.html',
})
export class SettingsRolesPageComponent {
  private readonly rolService = inject(RolService);

  protected readonly iconPlus = IconPlus;
  protected readonly iconEdit = IconPencil;
  protected readonly iconDelete = IconTrash;
  protected readonly iconPermisos = IconShieldLock;
  protected readonly iconTemplate = IconLock;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly permisosAsignables = signal<Permiso[]>([]);

  protected readonly permisosPorModulo = computed(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of this.permisosAsignables()) {
      const modulo = permiso.modulo ?? 'otros';
      const lista = grupos.get(modulo) ?? [];
      lista.push(permiso);
      grupos.set(modulo, lista);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  // Modal crear/editar rol propio.
  protected readonly modalAbierto = signal(false);
  protected readonly rolEditando = signal<Rol | null>(null);
  protected readonly formulario = signal<FormularioRol>({ ...FORMULARIO_VACIO });
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  // Modal asignar permisos.
  protected readonly rolAsignando = signal<Rol | null>(null);
  protected readonly permisosSeleccionados = signal<Set<number>>(new Set());
  protected readonly guardandoPermisos = signal(false);
  protected readonly errorPermisos = signal<string | null>(null);

  // Confirmación de borrado.
  protected readonly rolEliminando = signal<Rol | null>(null);
  protected readonly eliminando = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      roles: this.rolService.listar(),
      permisos: this.rolService.listarPermisosAsignables(),
    }).subscribe({
      next: ({ roles, permisos }) => {
        this.roles.set(roles);
        this.permisosAsignables.set(permisos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de roles. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Solo mis propios roles (empresaId no nulo) son editables — los
   * templates (`admin`/`cliente`/`dueno_empresa`/`empleado_empresa`) son
   * de solo lectura acá, ver el comentario de la clase. */
  protected esPropio(rol: Rol): boolean {
    return rol.empresaId !== null;
  }

  protected agruparPorModulo(permisos: Permiso[]): { modulo: string; permisos: Permiso[] }[] {
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of permisos) {
      const modulo = permiso.modulo ?? 'otros';
      const lista = grupos.get(modulo) ?? [];
      lista.push(permiso);
      grupos.set(modulo, lista);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modulo, perms]) => ({ modulo, permisos: perms }));
  }

  // --- Crear / editar rol propio ---

  protected abrirCrear(): void {
    this.rolEditando.set(null);
    this.formulario.set({ ...FORMULARIO_VACIO });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected abrirEditar(rol: Rol): void {
    if (!this.esPropio(rol)) {
      return;
    }
    this.rolEditando.set(rol);
    this.formulario.set({ nombre: rol.nombre, descripcion: rol.descripcion ?? '' });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected actualizarCampo(campo: keyof FormularioRol, valor: string): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected guardar(): void {
    const f = this.formulario();
    if (!f.nombre.trim() || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errorGuardar.set(null);
    const payload: GuardarRolPayload = {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || undefined,
    };
    const editando = this.rolEditando();
    const request = editando
      ? this.rolService.actualizar(editando.id, payload)
      : this.rolService.crear(payload);

    request.subscribe({
      next: (rol) => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.roles.update((actuales) =>
          editando ? actuales.map((r) => (r.id === rol.id ? rol : r)) : [...actuales, rol],
        );
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGuardar.set(this.mensajeDeError(err));
      },
    });
  }

  // --- Asignar permisos ---

  protected abrirPermisos(rol: Rol): void {
    if (!this.esPropio(rol)) {
      return;
    }
    this.rolAsignando.set(rol);
    this.permisosSeleccionados.set(new Set(rol.permisos.map((p) => p.id)));
    this.errorPermisos.set(null);
  }

  protected cerrarPermisos(): void {
    this.rolAsignando.set(null);
  }

  protected estaSeleccionado(permisoId: number): boolean {
    return this.permisosSeleccionados().has(permisoId);
  }

  protected alternarPermiso(permisoId: number, marcado: boolean): void {
    this.permisosSeleccionados.update((actual) => {
      const nuevo = new Set(actual);
      if (marcado) {
        nuevo.add(permisoId);
      } else {
        nuevo.delete(permisoId);
      }
      return nuevo;
    });
  }

  protected guardarPermisos(): void {
    const rol = this.rolAsignando();
    if (!rol || this.guardandoPermisos()) {
      return;
    }
    this.guardandoPermisos.set(true);
    this.errorPermisos.set(null);
    this.rolService.asignarPermisos(rol.id, [...this.permisosSeleccionados()]).subscribe({
      next: (actualizado) => {
        this.guardandoPermisos.set(false);
        this.rolAsignando.set(null);
        this.roles.update((actuales) =>
          actuales.map((r) => (r.id === actualizado.id ? actualizado : r)),
        );
      },
      error: (err: unknown) => {
        this.guardandoPermisos.set(false);
        this.errorPermisos.set(this.mensajeDeError(err));
      },
    });
  }

  // --- Eliminar ---

  protected abrirEliminar(rol: Rol): void {
    if (!this.esPropio(rol)) {
      return;
    }
    this.rolEliminando.set(rol);
  }

  protected cerrarEliminar(): void {
    this.rolEliminando.set(null);
  }

  protected confirmarEliminar(): void {
    const rol = this.rolEliminando();
    if (!rol || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.rolService.eliminar(rol.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.rolEliminando.set(null);
        this.roles.update((actuales) => actuales.filter((r) => r.id !== rol.id));
      },
      error: (err: unknown) => {
        this.eliminando.set(false);
        this.error.set(this.mensajeDeError(err));
        this.rolEliminando.set(null);
      },
    });
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo completar la acción. Intenta de nuevo.';
  }
}
