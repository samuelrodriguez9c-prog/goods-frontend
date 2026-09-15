import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { IconLock, IconPencil, IconPlus, IconShieldLock, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { GuardarRolPayload, RolService } from '../../../../core/roles/rol.service';
import { Permiso, Rol } from '../../../../core/roles/models/rol.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

interface FormularioRol {
  nombre: string;
  descripcion: string;
}

const FORMULARIO_VACIO: FormularioRol = { nombre: '', descripcion: '' };

/**
 * Roles y permisos del sistema (pantalla "Roles y permisos" del sidebar
 * de staff, ver PIVOTE_SAAS_MULTITENANT.md §8) — a diferencia de
 * Usuarios, esto NO es solo del personal de Goods: es el mismo catálogo
 * que usa `admin` para los roles internos de cada negocio (ver
 * `RolController`/`PermisoController`, ninguno pasa por
 * `TenantContextService`). Desde acá `staff_goods` puede ver/editar
 * cualquier rol del sistema, incluido el de cada cliente — es
 * deliberadamente así: es infraestructura del sistema (qué puede hacer
 * cada rol), no un dato de negocio de un tenant.
 *
 * Los roles de sistema (`esRolSistema`, ej. `admin`/`cliente`/
 * `staff_goods`) no se pueden borrar ni renombrar — el backend ya lo
 * bloquea (`RolService.remove`/`update`), acá solo se oculta el botón
 * de eliminar para esos roles en vez de dejar que el click termine en
 * un error.
 */
@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, StatusBadgeComponent, TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-page.component.html',
})
export class RolesPageComponent {
  private readonly rolService = inject(RolService);

  protected readonly tablePt = dataTablePt();
  protected readonly iconPlus = IconPlus;
  protected readonly iconEdit = IconPencil;
  protected readonly iconDelete = IconTrash;
  protected readonly iconPermisos = IconShieldLock;
  protected readonly iconSistema = IconLock;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly permisos = signal<Permiso[]>([]);

  // Permisos agrupados por `modulo` para el checklist del modal de
  // asignar — un `Map` en vez de recalcular el agrupamiento en el
  // template en cada change detection.
  protected readonly permisosPorModulo = computed(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of this.permisos()) {
      const modulo = permiso.modulo ?? 'otros';
      const lista = grupos.get(modulo) ?? [];
      lista.push(permiso);
      grupos.set(modulo, lista);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  // Modal crear/editar rol.
  protected readonly modalAbierto = signal(false);
  protected readonly rolEditando = signal<Rol | null>(null);
  protected readonly formulario = signal<FormularioRol>({ ...FORMULARIO_VACIO });
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  // Modal asignar permisos — set en vez de array: toggle por id es O(1)
  // y evita duplicados por error.
  protected readonly rolAsignando = signal<Rol | null>(null);
  protected readonly permisosSeleccionados = signal<Set<number>>(new Set());
  protected readonly guardandoPermisos = signal(false);
  protected readonly errorPermisos = signal<string | null>(null);

  // Confirmación de borrado (mismo patrón que UsuariosPageComponent).
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
      permisos: this.rolService.listarPermisos(),
    }).subscribe({
      next: ({ roles, permisos }) => {
        this.roles.set(roles);
        this.permisos.set(permisos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de roles y permisos. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected tonoActivo(activo: boolean): StatusBadgeTone {
    return activo ? 'success' : 'neutral';
  }

  // --- Crear / editar rol ---

  protected abrirCrear(): void {
    this.rolEditando.set(null);
    this.formulario.set({ ...FORMULARIO_VACIO });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected abrirEditar(rol: Rol): void {
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
