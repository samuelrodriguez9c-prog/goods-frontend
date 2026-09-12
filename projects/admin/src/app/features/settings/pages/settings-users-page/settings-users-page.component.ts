import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`UsuarioModule`) ya está listo (`GET /usuarios`,
 * `PATCH /usuarios/:id`, `DELETE /usuarios/:id`). Falta la página real:
 * listado + edición de usuarios. La gestión de roles/permisos se separó a
 * su propia página (`SettingsRolesPageComponent`, ruta `/settings/roles`)
 * porque en el backend son recursos y endpoints distintos
 * (`UsuarioController` vs. `RolController`/`PermisoController`) — ver
 * ADMIN_DISENO.md > "Sidebar > Submenús".
 */
@Component({
  selector: 'app-settings-users-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Usuarios</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de usuarios (ver ADMIN_DISENO.md &gt; "Sidebar").
      </p>
    </div>
  `,
})
export class SettingsUsersPageComponent {}
