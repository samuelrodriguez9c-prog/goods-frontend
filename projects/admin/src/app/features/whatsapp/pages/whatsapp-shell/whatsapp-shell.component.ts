import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { CabeceraWhatsappComponent } from '../../components/cabecera-whatsapp/cabecera-whatsapp.component';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { WhatsappConectarPageComponent } from '../whatsapp-conectar-page/whatsapp-conectar-page.component';

/**
 * Marco del módulo WhatsApp: da el store compartido y,
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

  constructor() {
    // La miga dice solo "WhatsApp" hasta saber que hay número conectado: así
    // no aparece "WhatsApp › Plantillas" un momento mientras carga ni en Conectar.
    const whatsapp = inject(WhatsappService);
    effect(() => whatsapp.sinNumero.set(!this.store.conectado()));
    inject(DestroyRef).onDestroy(() => whatsapp.sinNumero.set(false));
  }
}
