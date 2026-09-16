import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconPlus, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { RolAsignable } from '../../../../core/roles/models/rol.model';
import { RolService } from '../../../../core/roles/rol.service';
import { Usuario } from '../../../../core/usuarios/models/usuario.model';
import { CrearEmpleadoPayload, UsuarioService } from '../../../../core/usuarios/usuario.service';

interface FormularioEmpleado {
  nombres: string;
  apellidos: string;
  correo: string;
  password: string;
}

const FORMULARIO_VACIO: FormularioEmpleado = {
  nombres: '',
  apellidos: '',
  correo: '',
  password: '',
};

/**
 * "Usuarios" del lado `admin` — pantalla real,
 * `PROPUESTA_ROLES_Y_ACCESOS.md` §6 paso 5 (reemplaza el placeholder
 * "TODO: listado real de usuarios"). Es el equipo de MI Empresa
 * (`GET /usuarios` ya viene filtrado por tenant, ver `UsuarioService` del
 * backend) — acá es donde de verdad se cumple lo que pidió gerencia
 * ("un dueño puede asignarle un rol acotado a alguien de su equipo"):
 * dar de alta un empleado (`POST /usuarios/empleado`, siempre nace
 * `empleado_empresa`) y después, si hace falta, subirlo a
 * `dueno_empresa` o bajarlo de nuevo — el selector de rol de cada fila
 * solo ofrece los roles de `GET /roles/asignables` (ver
 * `SettingsRolesPageComponent` para el catálogo completo, de solo
 * lectura).
 */
@Component({
  selector: 'app-settings-users-page',
  standalone: true,
  imports: [TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-users-page.component.html',
})
export class SettingsUsersPageComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly rolService = inject(RolService);

  protected readonly iconPlus = IconPlus;
  protected readonly iconDelete = IconTrash;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly rolesAsignables = signal<RolAsignable[]>([]);

  // Modal "dar de alta empleado".
  protected readonly modalAbierto = signal(false);
  protected readonly formulario = signal<FormularioEmpleado>({ ...FORMULARIO_VACIO });
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  // Cambio de rol por fila — id del usuario cuyo select está en vuelo,
  // para poder deshabilitarlo mientras la request está en curso.
  protected readonly cambiandoRolDe = signal<number | null>(null);

  // Confirmación de borrado (mismo patrón que `staff`'s UsuariosPageComponent).
  protected readonly usuarioEliminando = signal<Usuario | null>(null);
  protected readonly eliminando = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      usuarios: this.usuarioService.listar(),
      roles: this.rolService.listarAsignables(),
    }).subscribe({
      next: ({ usuarios, roles }) => {
        this.usuarios.set(usuarios.data);
        this.rolesAsignables.set(roles);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el equipo. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  // --- Dar de alta empleado ---

  protected abrirCrear(): void {
    this.formulario.set({ ...FORMULARIO_VACIO });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected actualizarCampo(campo: keyof FormularioEmpleado, valor: string): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected guardar(): void {
    const f = this.formulario();
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.correo.trim() || !f.password || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errorGuardar.set(null);
    const payload: CrearEmpleadoPayload = {
      nombres: f.nombres.trim(),
      apellidos: f.apellidos.trim(),
      correo: f.correo.trim(),
      password: f.password,
    };
    this.usuarioService.crearEmpleado(payload).subscribe({
      next: (usuario) => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.usuarios.update((actuales) => [...actuales, usuario]);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGuardar.set(this.mensajeDeError(err));
      },
    });
  }

  // --- Cambiar rol ---

  protected cambiarRol(usuario: Usuario, rolIdTexto: string): void {
    const rolId = Number(rolIdTexto);
    if (!rolId || rolId === usuario.rolId || this.cambiandoRolDe() !== null) {
      return;
    }
    this.cambiandoRolDe.set(usuario.id);
    this.usuarioService.cambiarRol(usuario.id, rolId).subscribe({
      next: (actualizado) => {
        this.cambiandoRolDe.set(null);
        this.usuarios.update((actuales) =>
          actuales.map((u) => (u.id === actualizado.id ? actualizado : u)),
        );
      },
      error: (err: unknown) => {
        this.cambiandoRolDe.set(null);
        this.error.set(this.mensajeDeError(err));
      },
    });
  }

  // --- Eliminar ---

  protected abrirEliminar(usuario: Usuario): void {
    this.usuarioEliminando.set(usuario);
  }

  protected cerrarEliminar(): void {
    this.usuarioEliminando.set(null);
  }

  protected confirmarEliminar(): void {
    const usuario = this.usuarioEliminando();
    if (!usuario || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.usuarioService.eliminar(usuario.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.usuarioEliminando.set(null);
        this.usuarios.update((actuales) => actuales.filter((u) => u.id !== usuario.id));
      },
      error: (err: unknown) => {
        this.eliminando.set(false);
        this.error.set(this.mensajeDeError(err));
        this.usuarioEliminando.set(null);
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
