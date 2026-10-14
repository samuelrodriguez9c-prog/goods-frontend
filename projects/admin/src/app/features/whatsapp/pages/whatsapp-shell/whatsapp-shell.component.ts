import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CabeceraWhatsappComponent } from '../../components/cabecera-whatsapp/cabecera-whatsapp.component';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { WhatsappConectarPageComponent } from '../whatsapp-conectar-page/whatsapp-conectar-page.component';

/**
 * Marco del módulo WhatsApp (rediseño 2026-10-13): da el store compartido y,
 * con el número conectado, la cabecera común sobre la sección elegida
 * (Bandeja, Plantillas, Automático, Campañas). Sin número, la pantalla de
 * Conectar ocupa todo.
 */
@Component({
  selector: 'app-whatsapp-shell',
  imports: [RouterOutlet, CabeceraWhatsappComponent, WhatsappConectarPageComponent],
  providers: [WhatsappModuloStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-shell.component.html',
  host: { class: 'block' },
})
export class WhatsappShellComponent {
  protected readonly store = inject(WhatsappModuloStore);
}
