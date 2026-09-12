import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`RolModule`, RBAC completo) ya está listo:
 * `RolController` (`GET/POST/PATCH/DELETE /roles`) para el CRUD de roles y
 * `PATCH /roles/:id/permisos` para asignarle permisos a uno, más
 * `PermisoController` (`GET/POST /permisos`) para el catálogo de permisos
 * disponibles. Falta la página real: listado de roles, alta/edición, y un
 * selector de permisos por rol. Separado de `SettingsUsersPageComponent`
 * (ruta `/settings/usuarios`) porque en el backend son recursos y
 * endpoints distintos — ver ADMIN_DISENO.md > "Sidebar > Submenús".
 */
@Component({
  selector: 'app-settings-roles-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Roles y permisos</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado de roles + asignación de permisos por rol (ver ADMIN_DISENO.md &gt;
        "Sidebar").
      </p>
    </div>
  `,
})
export class SettingsRolesPageComponent {}
