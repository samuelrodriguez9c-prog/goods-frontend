import { Routes } from '@angular/router';
import { WhatsappAutomatizacionesPageComponent } from './pages/whatsapp-automatizaciones-page/whatsapp-automatizaciones-page.component';
import { WhatsappCampanasPageComponent } from './pages/whatsapp-campanas-page/whatsapp-campanas-page.component';
import { WhatsappPageComponent } from './pages/whatsapp-page/whatsapp-page.component';
import { WhatsappPlantillasPageComponent } from './pages/whatsapp-plantillas-page/whatsapp-plantillas-page.component';

export const WHATSAPP_ROUTES: Routes = [
  { path: '', component: WhatsappPageComponent, data: { breadcrumb: 'WhatsApp', icon: 'brand-whatsapp' } },
  // Fase 3 (2026-10-12): se entra desde la bandeja (no son hijos del menú lateral).
  { path: 'plantillas', component: WhatsappPlantillasPageComponent, data: { breadcrumb: 'Plantillas', icon: 'file-text' } },
  {
    path: 'automatizaciones',
    component: WhatsappAutomatizacionesPageComponent,
    data: { breadcrumb: 'Respuestas automáticas', icon: 'sparkles' },
  },
  { path: 'campanas', component: WhatsappCampanasPageComponent, data: { breadcrumb: 'Campañas', icon: 'discount-2' } },
];
