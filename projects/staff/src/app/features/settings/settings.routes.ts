import { Routes } from '@angular/router';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';

/** Una sola ruta — a diferencia de `admin/features/settings/` (que tiene
 *  sub-rutas `usuarios`/`roles` porque gestiona el equipo de UNA Empresa),
 *  acá Settings es solo el perfil de la propia cuenta: no hay nada que
 *  gestionar sobre "otros" (eso ya vive en los ítems de primer nivel
 *  Usuarios/Roles y permisos del sidebar de staff), así que no hace falta
 *  un árbol de sub-páginas. */
export const SETTINGS_ROUTES: Routes = [{ path: '', component: SettingsPageComponent }];
