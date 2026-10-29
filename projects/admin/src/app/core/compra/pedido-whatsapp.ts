import { firstValueFrom } from 'rxjs';
import { AlertaService } from '../ui/alerta.service';
import { CompraService } from './compra.service';

/**
 * «Pedir por WhatsApp»: trae el borrador del pedido de una compra y abre
 * WhatsApp con el mensaje escrito para el proveedor. No envía nada: la
 * persona lo manda desde su WhatsApp. Sin un celular usable, copia el texto.
 *
 * @remarks
 * La pestaña se abre en el mismo clic y luego se le pone la dirección: si se
 * abriera después de la petición, el navegador la tomaría por un pop-up.
 */
export async function pedirPorWhatsapp(compraId: number, api: CompraService, alertas: AlertaService): Promise<void> {
  const ventana = window.open('', '_blank');
  try {
    const m = await firstValueFrom(api.mensajeProveedor(compraId));
    if (m.enlace && ventana) {
      ventana.opener = null;
      ventana.location.href = m.enlace;
      if (m.nota) alertas.mostrar({ estado: 'warning', titulo: 'Abrimos WhatsApp', texto: m.nota, autoCierre: 7000 });
      return;
    }
    ventana?.close();
    await navigator.clipboard?.writeText(m.texto);
    alertas.mostrar({ estado: 'success', titulo: 'Pedido copiado', texto: m.nota ?? 'Pégalo en el chat del proveedor.', autoCierre: 7000 });
  } catch {
    ventana?.close();
    alertas.mostrar({ estado: 'error', titulo: 'No se pudo armar el mensaje', texto: 'Intenta de nuevo en un momento.', autoCierre: 7000 });
  }
}
