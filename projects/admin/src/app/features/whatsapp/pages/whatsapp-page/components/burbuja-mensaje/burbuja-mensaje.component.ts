import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  IconAlertCircle,
  IconCheck,
  IconChecks,
  IconClock,
  IconDeviceMobile,
  IconFile,
  IconMapPin,
  IconMicrophone,
  IconPackage,
  IconPhoto,
  IconRobot,
  IconSparkles,
  IconSpeakerphone,
  IconTemplate,
  IconVideo,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { formatoWhatsapp } from '../../../../../../core/whatsapp/formato-whatsapp';
import { Mensaje } from '../../../../../../core/whatsapp/whatsapp.model';
import { cop } from '../../../../shared/secciones';
import { hhmm, stockTexto } from '../../bandeja.utils';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

export interface EstadoAdjunto {
  url?: string;
  error?: string;
}

/**
 * Una burbuja del chat: etiqueta de quién la escribió (Asistente de IA,
 * celular, automática, campaña), tarjeta de producto, adjuntos (foto, audio,
 * video, documento), texto con formato de WhatsApp, hora y ticks; si falló,
 * el motivo y "Reintentar".
 */
@Component({
  selector: 'app-burbuja-mensaje',
  imports: [IaMarcaComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './burbuja-mensaje.component.html',
  host: { class: 'mb-[5px] flex animate-[wa-entra_.28s_ease-out]', '[class.justify-end]': 'saliente()' },
})
export class BurbujaMensajeComponent {
  readonly m = input.required<Mensaje>();
  readonly adjunto = input<EstadoAdjunto | undefined>(undefined);
  readonly puedeReintentar = input(false);

  readonly cargar = output<void>();
  readonly descargar = output<void>();
  readonly reintentar = output<void>();

  protected readonly i = {
    archivo: IconFile,
    plantilla: IconTemplate,
    producto: IconPackage,
    error: IconAlertCircle,
  };
  protected readonly formato = formatoWhatsapp;
  protected readonly cop = cop;
  protected readonly stockTexto = stockTexto;

  protected readonly saliente = computed(() => this.m().direccion === 'saliente');
  protected readonly hora = computed(() => hhmm(new Date(this.m().enviadoEn)));

  protected readonly fondo = computed(() => {
    const m = this.m();
    if (m.direccion !== 'saliente') return 'bg-white';
    return m.estado === 'fallido' ? 'bg-[#fef3f2]' : 'bg-[#d9fdd3]';
  });

  /** Quién o qué lo escribió, si no fue una persona desde Goods. */
  protected readonly etiqueta = computed<{ texto: string; icono: typeof IconRobot; clase: string; ia?: boolean } | null>(() => {
    const m = this.m();
    if (m.autor === 'celular') return { texto: 'Desde el celular', icono: IconDeviceMobile, clase: 'text-[#6b7280]' };
    switch (m.origen) {
      case 'asistente_ia':
        return { texto: 'Asistente de IA', icono: IconSparkles, ia: true, clase: 'text-[#00857e]' };
      case 'campana':
        return { texto: `Campaña${m.plantilla ? ' · ' + m.plantilla.nombre : ''}`, icono: IconSpeakerphone, clase: 'text-[#6b7280]' };
      case 'promociones':
        return { texto: 'Alta / baja de promociones', icono: IconRobot, clase: 'text-[#6b7280]' };
      default:
        return m.autor === 'bot' ? { texto: 'Respuesta automática', icono: IconRobot, clase: 'text-[#6b7280]' } : null;
    }
  });

  protected readonly tick = computed(() => {
    const m = this.m();
    if (m.direccion !== 'saliente') return null;
    switch (m.estado) {
      case 'pendiente':
        return { icono: IconClock, clase: 'text-[#8b8b8b]', label: 'Enviando' };
      case 'entregado':
        return { icono: IconChecks, clase: 'text-[#8b8b8b]', label: 'Entregado' };
      case 'leido':
        return { icono: IconChecks, clase: 'text-[#2c8ef0]', label: 'Leído' };
      case 'fallido':
        return { icono: IconAlertCircle, clase: 'text-[#d92d20]', label: 'No se envió' };
      default:
        return { icono: IconCheck, clase: 'text-[#8b8b8b]', label: 'Enviado' };
    }
  });

  /** El texto de un producto mostrado es su ficha: la tarjeta ya lo dice. */
  protected readonly mostrarTexto = computed(() => {
    const m = this.m();
    return !!m.texto && !m.producto && m.tipo !== 'reaction' && !(m.tipo === 'document' && m.texto === m.media?.nombre);
  });

  protected iconoTipo(tipo: string): typeof IconPhoto | null {
    return ({ image: IconPhoto, video: IconVideo, audio: IconMicrophone, document: IconFile, location: IconMapPin } as Record<string, typeof IconPhoto>)[tipo] ?? null;
  }

  protected etiquetaTipo(m: Mensaje): string {
    const base: Record<string, string> = {
      image: 'Foto',
      video: 'Video',
      audio: 'Audio',
      document: m.media?.nombre ?? 'Documento',
      sticker: 'Sticker',
      location: 'Ubicación',
      contacts: 'Contacto',
      reaction: 'Reaccionó',
      unsupported: 'Mensaje que WhatsApp no deja ver aquí',
    };
    return base[m.tipo] ?? '';
  }
}
