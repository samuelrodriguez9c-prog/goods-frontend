import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import {
  IconBuilding,
  IconHeadset,
  IconHistory,
  IconReceipt2,
  IconRepeat,
  IconReportMoney,
  IconSettings2,
  IconShieldLock,
  IconStack2,
  IconUserPlus,
  IconUsers,
  provideTablerIcons,
} from '@tabler/icons-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Primera vez que `staff` hace llamadas HTTP reales (ver
    // PIVOTE_SAAS_MULTITENANT.md §8 paso 5) — mismo `authInterceptor` que
    // `admin`, pero la copia propia de `staff` (ver comentario de
    // `AuthService` sobre por qué no se comparte).
    provideHttpClient(withInterceptors([authInterceptor])),
    // Mismo criterio que `admin` (ver ese app.config.ts): PrimeNG solo por
    // comportamiento (overlays/accesibilidad), sin preset de estilo — el
    // look final lo da Tailwind vía `pt`. `shared-ui` depende de esto
    // (ej. StatusBadgeComponent envuelve `p-tag`), así que cualquier
    // proyecto que consuma la librería necesita configurarlo igual.
    provideAnimationsAsync(),
    providePrimeNG({ theme: 'none' }),
    // Íconos del sidebar propio de staff (10 items planos + Settings al
    // fondo, sin árbol de submenús como el de `admin` — ver
    // layout/sidebar/sidebar.component.ts y
    // PIVOTE_SAAS_MULTITENANT.md §7.2/§8). Mismo mecanismo que `admin`
    // (ver ese app.config.ts): `provideTablerIcons` devuelve
    // `EnvironmentProviders`, solo puede vivir a nivel de app/ruta. Los
    // íconos que usan las páginas nuevas (botones de crear/editar/
    // eliminar, etc.) NO necesitan registrarse acá — se pasan como objeto
    // directo (`[icon]="iconPlus"`), no por nombre de string; esto solo
    // hace falta para los del sidebar, que sí se pasan por nombre
    // (`item.icon`, ver sidebar.component.html). `IconSettings2` (no
    // `IconSettings`) sumado 2026-09-22 junto con `settingsItem` — misma
    // variante que ya usa `admin` para el mismo ítem, ver el comentario
    // de ese `app.config.ts`.
    provideTablerIcons({
      IconBuilding,
      IconUserPlus,
      IconStack2,
      IconRepeat,
      IconReceipt2,
      IconReportMoney,
      IconHeadset,
      IconHistory,
      IconUsers,
      IconShieldLock,
      IconSettings2,
    }),
  ],
};
