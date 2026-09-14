import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from './core/http/auth.interceptor';
import {
  IconChevronDown,
  IconDiscount2,
  IconHome2Filled,
  IconInbox,
  IconMessageCircle2,
  IconSettings2,
  IconShieldLock,
  IconTagFilled,
  IconUserFilled,
  IconUsers,
  provideTablerIcons,
} from '@tabler/icons-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // authInterceptor adjunta el Bearer token y reintenta una vez con
    // refresh ante un 401 — ver core/http/auth.interceptor.ts.
    provideHttpClient(withInterceptors([authInterceptor])),
    // PrimeNG usa @angular/animations (vía provideAnimationsAsync) para las
    // transiciones de overlays (dropdowns, dialogs, popovers). Angular marca
    // @angular/animations como deprecado a favor de animate.enter/leave, pero
    // PrimeNG 21.x todavía depende de la API clásica — se revisará cuando
    // PrimeNG migre.
    provideAnimationsAsync(),
    providePrimeNG({
      // Sin preset de estilo (Aura/Material/Lara/Nora): el look final se
      // construye con Tailwind + `pt` (pass-through) sobre cada componente,
      // para calcar el lenguaje visual de Polaris documentado en
      // ADMIN_DISENO.md, en vez de partir de un tema ya vestido y pelear
      // contra su estética por defecto.
      //
      // Nota: el tipo expone también `unstyled: true`, pero en esta versión
      // (21.1.10) está marcado como @experimental / "not yet implemented" —
      // `theme: 'none'` es el mecanismo real y funcional para lograr lo mismo.
      theme: 'none',
    }),
    // Íconos que usa el sidebar por nombre (`<tabler-icon [icon]="item.icon">`
    // — ver layout/sidebar/sidebar.component.ts y ADMIN_DISENO.md > "Sidebar
    // > Íconos"). `provideTablerIcons` devuelve `EnvironmentProviders`, que
    // solo puede vivir a nivel de app o de ruta, no en el `providers` de un
    // componente — por eso está acá y no junto al componente que los usa.
    // El topbar (search, bot, bell) no necesita registro: pasa cada ícono
    // por referencia de objeto directamente desde su propio componente.
    //
    // Dashboard usa `IconHome2Filled` (no `IconHomeFilled`) y Settings usa
    // `IconSettings2` (no `IconSettings`) — variantes elegidas a pedido de
    // gerencia por verse más curvas/redondeadas (la insignia hexagonal de
    // Settings2 en vez del engranaje de 8 dientes, la ventana de esquinas
    // redondeadas de Home2 en vez de la rectangular) — ver ADMIN_DISENO.md
    // > "Sidebar > Íconos".
    //
    // IconDiscount2/IconMessageCircle2 (Discounts/Messages, items nuevos con
    // backend real — ver ADMIN_DISENO.md > "Sidebar > Submenús") van de
    // línea, mismo criterio que Orders/Settings (fuera del set original
    // relleno de Home/Products/Customers). IconChevronDown es el indicador
    // de expandir/contraer de Products y de la sección "Administración". El
    // conector deslizante entre hijos del submenú "árbol" de Products
    // (calcado de la referencia de Shopify — ver ADMIN_DISENO.md > "Sidebar
    // > Submenús") NO usa un ícono: se dibuja con bordes CSS
    // (`border-left`/`border-bottom` + radio de esquina) directo en el
    // template, así que no necesita registrar nada acá. IconUsers/
    // IconShieldLock sí son íconos de verdad — son los hijos de la sección
    // "Administración" (patrón "Sales channels": cada hijo lleva su propio
    // ícono, sin conector), de línea igual que el resto de íconos agregados
    // después del set original.
    provideTablerIcons({
      IconHome2Filled,
      IconInbox,
      IconTagFilled,
      IconUserFilled,
      IconSettings2,
      IconDiscount2,
      IconMessageCircle2,
      IconChevronDown,
      IconUsers,
      IconShieldLock,
    }),
  ],
};
