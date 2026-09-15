import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DataTableComponent, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { IconPencil, IconPlus, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { Rol } from '../../../../core/roles/models/rol.model';
import { RolService } from '../../../../core/roles/rol.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

const ROL_STAFF_GOODS = 'staff_goods';

interface FormularioUsuario {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  rolId: number | null;
}

const FORMULARIO_VACIO: FormularioUsuario = {
  nombres: '',
  apellidos: '',
  correo: '',
  telefono: '',
  password: '',
  rolId: null,
};

/**
 * Personal de Goods (pantalla "Usuarios" del sidebar de staff, ver
 * PIVOTE_SAAS_MULTITENANT.md §8) — desde el fix de aislamiento por
 * tenant en `UsuarioService` del backend, `GET /usuarios` acá siempre
 * trae solo `empresaId null` (colegas de Goods), nunca el equipo interno
 * de un cliente (ver el comentario de ese fix).
 *
 * `POST /usuarios` (público) siempre nace con rol `cliente` (o `admin`
 * si es el primer usuario del sistema, ver `resolverRolIdInicial` del
 * backend) y sin rol elegible en el body — por eso `guardar()` encadena
 * un `PATCH /usuarios/:id/rol` inmediatamente después de crear, con el
 * rol que se eligió en el formulario (por defecto `staff_goods`, el
 * único rol de Goods que existe hoy — ver `preseleccionarRolStaff`).
 */
@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, DatePipe, TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios-page.component.html',
})
export class UsuariosPageComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly rolService = inject(RolService);

  protected readonly tablePt = dataTablePt();
  protected readonly iconPlus = IconPlus;
  protected readonly iconEdit = IconPencil;
  protected readonly iconDelete = IconTrash;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly usuarios = signal<UsuarioGoods[]>([]);
  protected readonly roles = signal<Rol[]>([]);

  protected readonly modalAbierto = signal(false);
  protected readonly usuarioEditando = signal<UsuarioGoods | null>(null);
  protected readonly formulario = signal<FormularioUsuario>({ ...FORMULARIO_VACIO });
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  // Confirmación de borrado — modal aparte y deliberadamente más simple
  // (sin formulario), ver `ModalComponent`: `DELETE /usuarios/:id` es un
  // borrado real (no desactivar, a diferencia de Plan), así que pide
  // confirmación explícita en vez de un solo click.
  protected readonly usuarioEliminando = signal<UsuarioGoods | null>(null);
  protected readonly eliminando = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      usuarios: this.usuarioService.listar(),
      roles: this.rolService.listar(),
    }).subscribe({
      next: ({ usuarios, roles }) => {
        this.usuarios.set(usuarios.data);
        this.roles.set(roles);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el personal de Goods. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  private preseleccionarRolStaff(): number | null {
    return this.roles().find((r) => r.nombre === ROL_STAFF_GOODS)?.id ?? null;
  }

  protected abrirCrear(): void {
    this.usuarioEditando.set(null);
    this.formulario.set({ ...FORMULARIO_VACIO, rolId: this.preseleccionarRolStaff() });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected abrirEditar(usuario: UsuarioGoods): void {
    this.usuarioEditando.set(usuario);
    this.formulario.set({
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      telefono: usuario.telefono ?? '',
      password: '',
      rolId: usuario.rolId,
    });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected actualizarCampo(campo: keyof FormularioUsuario, valor: string): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected actualizarRol(rolId: string): void {
    this.formulario.update((actual) => ({ ...actual, rolId: rolId ? +rolId : null }));
  }

  protected guardar(): void {
    const f = this.formulario();
    if (!f.nombres.trim() || !f.apellidos.trim() || this.guardando()) {
      return;
    }
    const editando = this.usuarioEditando();
    if (!editando && (!f.correo.trim() || f.password.length < 8)) {
      this.errorGuardar.set('Completa el correo y una contraseña de al menos 8 caracteres.');
      return;
    }

    this.guardando.set(true);
    this.errorGuardar.set(null);

    if (editando) {
      this.guardarEdicion(editando, f);
    } else {
      this.guardarCreacion(f);
    }
  }

  private guardarCreacion(f: FormularioUsuario): void {
    this.usuarioService
      .crear({
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        correo: f.correo.trim(),
        telefono: f.telefono.trim() || undefined,
        password: f.password,
      })
      .subscribe({
        next: (creado) => {
          // El rol por defecto que asigna `POST /usuarios` nunca es
          // `staff_goods` (ver el comentario de la clase) — si se eligió
          // uno distinto al que trajo por defecto, hace falta este
          // segundo paso para que quede bien desde el alta.
          if (f.rolId && f.rolId !== creado.rolId) {
            this.usuarioService.cambiarRol(creado.id, f.rolId).subscribe({
              next: (conRol) => this.finalizarGuardado(conRol, false),
              error: (err: unknown) => {
                // El usuario ya se creó — no lo escondemos como si nada
                // hubiera pasado, pero sí lo dejamos en la lista con el
                // rol que le tocó por defecto para que el staff pueda
                // reintentar el cambio de rol desde "Editar".
                this.usuarios.update((actuales) => [...actuales, creado]);
                this.guardando.set(false);
                this.errorGuardar.set(
                  `El usuario se creó, pero no se pudo asignar el rol elegido: ${this.mensajeDeError(err)}`,
                );
              },
            });
          } else {
            this.finalizarGuardado(creado, false);
          }
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorGuardar.set(this.mensajeDeError(err));
        },
      });
  }

  private guardarEdicion(editando: UsuarioGoods, f: FormularioUsuario): void {
    const cambiaRol = f.rolId !== null && f.rolId !== editando.rolId;
    this.usuarioService
      .actualizar(editando.id, {
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        telefono: f.telefono.trim() || undefined,
      })
      .subscribe({
        next: (actualizado) => {
          if (cambiaRol && f.rolId) {
            this.usuarioService.cambiarRol(editando.id, f.rolId).subscribe({
              next: (conRol) => this.finalizarGuardado(conRol, true),
              error: (err: unknown) => {
                this.guardando.set(false);
                this.errorGuardar.set(
                  `Se guardaron los datos, pero no se pudo cambiar el rol: ${this.mensajeDeError(err)}`,
                );
                this.usuarios.update((actuales) =>
                  actuales.map((u) => (u.id === actualizado.id ? actualizado : u)),
                );
              },
            });
          } else {
            this.finalizarGuardado(actualizado, true);
          }
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorGuardar.set(this.mensajeDeError(err));
        },
      });
  }

  private finalizarGuardado(usuario: UsuarioGoods, editando: boolean): void {
    this.guardando.set(false);
    this.modalAbierto.set(false);
    this.usuarios.update((actuales) =>
      editando
        ? actuales.map((u) => (u.id === usuario.id ? usuario : u))
        : [...actuales, usuario],
    );
  }

  protected abrirEliminar(usuario: UsuarioGoods): void {
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
      error: () => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar el usuario. Intenta de nuevo.');
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
