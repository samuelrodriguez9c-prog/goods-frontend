import { Routes } from '@angular/router';
import { WhatsappAutomatizacionesPageComponent } from './pages/whatsapp-automatizaciones-page/whatsapp-automatizaciones-page.component';
import { WhatsappCampanasPageComponent } from './pages/whatsapp-campanas-page/whatsapp-campanas-page.component';
import { WhatsappPageComponent } from './pages/whatsapp-page/whatsapp-page.component';
import { WhatsappPlantillasPageComponent } from './pages/whatsapp-plantillas-page/whatsapp-plantillas-page.component';
import { WhatsappShellComponent } from './pages/whatsapp-shell/whatsapp-shell.component';

// Las cuatro secciones cuelgan del marco (`WhatsappShellComponent`), que pone la
// cabecera con el tambor y el store compartido. Sin número conectado muestra Conectar.
export const WHATSAPP_ROUTES: Routes = [
  {
    path: '',
    component: WhatsappShellComponent,
    children: [
      { path: '', component: WhatsappPageComponent, data: { breadcrumb: 'Bandeja', icon: 'messages' } },
      { path: 'plantillas', component: WhatsappPlantillasPageComponent, data: { breadcrumb: 'Plantillas', icon: 'template' } },
      {
        path: 'automatizaciones',
        component: WhatsappAutomatizacionesPageComponent,
        data: { breadcrumb: 'Automático', icon: 'sparkles' },
      },
      { path: 'campanas', component: WhatsappCampanasPageComponent, data: { breadcrumb: 'Campañas', icon: 'speakerphone' } },
    ],
  },
];
