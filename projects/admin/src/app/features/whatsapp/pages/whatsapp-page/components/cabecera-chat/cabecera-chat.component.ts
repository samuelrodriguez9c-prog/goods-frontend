import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  IconArrowLeft,
  IconClock,
  IconClockPause,
  IconHourglassLow,
  IconLayoutSidebarRight,
  IconSparkles,
  IconUser,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Conversacion, identificacion } from '../../../../../../core/whatsapp/whatsapp.model';
import { claseAvatar, estadoVentana, fraccionVentana, iniciales, nombreChat, restante, ventanaFmt } from '../../bandeja.utils';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

/**
 * Cabecera de la conversación: cliente, número, tiempo de la ventana de 24 h
 * con su barrita, el segmentado IA / Tú (pausa o devuelve el chat al
 * asistente) y el botón del panel del cliente.
 */
@Component({
  selector: 'app-cabecera-chat',
  imports: [IaMarcaComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cabecera-chat.component.html',
  host: { class: 'flex items-center gap-3 border-b border-[#f1f1f1] px-3.5 py-2.5' },
})
export class CabeceraChatComponent {
  readonly chat = input.required<Conversacion>();
  readonly ahora = input(Date.now());
  /** La IA atiende este chat. */
  readonly enIa = input(false);
  /** El asistente está prendido para el negocio. */
  readonly asistenteActivo = input(false);
  readonly puedeResponder = input(false);
  readonly panelAbierto = input(false);
  /** Pantalla angosta: botón para volver a la lista y la ventana sin "para responder gratis". */
  readonly angosto = input(false);
  readonly compacto = input(false);

  readonly modo = output<'ia' | 'tu'>();
  readonly alternarPanel = output<void>();
  readonly volver = output<void>();

  protected readonly i = { volver: IconArrowLeft, ia: IconSparkles, tu: IconUser, panel: IconLayoutSidebarRight };

  protected readonly vista = computed(() => {
    const c = this.chat();
    const ahora = this.ahora();
    const st = estadoVentana(c, ahora);
    const r = restante(c, ahora);
    return {
      nombre: nombreChat(c),
      ini: iniciales(c),
      avatar: claseAvatar(c),
      tel: identificacion(c.contacto),
      texto: st === 'cerrada' ? 'Ventana cerrada' : this.compacto() ? ventanaFmt(r) : `${ventanaFmt(r)} para responder gratis`,
      icono: st === 'cerrada' ? IconClockPause : st === 'vence' ? IconHourglassLow : IconClock,
      color: st === 'cerrada' ? 'text-[#9ca3af]' : st === 'vence' ? 'text-[#d97706]' : 'text-[#1d8a4b]',
      barra: st === 'cerrada' ? 'bg-[#9ca3af]' : st === 'vence' ? 'bg-[#d97706]' : 'bg-[#1d8a4b]',
      pct: (fraccionVentana(c, ahora) * 100).toFixed(2) + '%',
    };
  });
}
