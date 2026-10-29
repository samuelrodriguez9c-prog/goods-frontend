import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from './core/http/auth.interceptor';
import {
  IconBell,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconBulb,
  IconCategory,
  IconChevronDown,
  IconBookmark,
  IconDiscount2,
  IconFileText,
  IconForms,
  IconHistory,
  IconHome2,
  IconInbox,
  IconMessageCircle2,
  IconMessages,
  IconPackages,
  IconSettings2,
  IconShieldLock,
  IconShoppingCart,
  IconSparkles,
  IconSpeakerphone,
  IconTag,
  IconTemplate,
  IconTruck,
  IconUser,
  IconUsers,
  IconHome2Filled,
  IconTagFilled,
  IconUserFilled,
  provideTablerIcons,
} from '@tabler/icons-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // PrimeNG 21 todavía anima sus overlays con @angular/animations (deprecado
    // a favor de animate.enter/leave). TODO(front): quitarlo cuando PrimeNG migre.
    provideAnimationsAsync(),
    providePrimeNG({
      // Sin preset: el estilo sale de Tailwind y del `pt` de cada componente,
      // para no pelear contra la estética de un tema. `unstyled: true` existe
      // en el tipo pero en PrimeNG 21 todavía no está implementado.
      theme: 'none',
    }),
    // Íconos que se usan por nombre (`<tabler-icon [icon]="item.icon">`: sidebar,
    // migas). `provideTablerIcons` devuelve `EnvironmentProviders`, que solo
    // pueden ir a nivel de app o de ruta, no en un componente. Los componentes
    // que pasan el ícono como objeto no necesitan registrarlo.
    // Home2 y Settings2 se eligieron por verse más redondeados que Home y Settings.
    provideTablerIcons({
      IconBell,
      IconBrandWhatsapp,
      IconBuildingStore,
      IconBulb,
      IconCategory,
      IconChevronDown,
      IconBookmark,
      IconDiscount2,
      IconFileText,
      IconForms,
      IconHistory,
      IconHome2,
      IconInbox,
      IconMessageCircle2,
      IconMessages,
      IconPackages,
      IconSettings2,
      IconShieldLock,
      IconShoppingCart,
      IconSparkles,
      IconSpeakerphone,
      IconTag,
      IconTemplate,
      IconTruck,
      IconUser,
      IconUsers,
      IconHome2Filled,
      IconTagFilled,
      IconUserFilled,
    }),
  ],
};
