import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import {
  IconBell,
  IconBuilding,
  IconBulb,
  IconFileText,
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
    // Copia propia del interceptor de `admin` (ver `AuthService` sobre por qué no se comparte).
    provideHttpClient(withInterceptors([authInterceptor])),
    // PrimeNG solo por comportamiento (overlays, accesibilidad), sin preset:
    // el estilo lo da Tailwind vía `pt`. `shared-ui` lo necesita (p. ej.
    // `StatusBadgeComponent` envuelve `p-tag`).
    provideAnimationsAsync(),
    providePrimeNG({ theme: 'none' }),
    // Solo los íconos que se piden por nombre de string: los del sidebar
    // (`item.icon`) y los `data.icon` de las rutas que pinta el rastro de
    // navegación del topbar. Los que se pasan como objeto (`[icon]="iconPlus"`)
    // no se registran. `provideTablerIcons` devuelve `EnvironmentProviders`,
    // así que solo puede ir a nivel de app o de ruta.
    provideTablerIcons({
      IconBell,
      IconBuilding,
      IconBulb,
      IconFileText,
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
