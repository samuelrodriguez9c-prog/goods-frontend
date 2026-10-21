import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Parte } from '../../plantillas.util';

/**
 * Vista previa de un mensaje de plantilla como lo ve el cliente en WhatsApp:
 * fondo `#efe7de`, burbuja blanca y las variables resaltadas en turquesa con
 * su valor de ejemplo.
 */
@Component({
  selector: 'app-vista-previa-whatsapp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vista-previa-whatsapp.component.html',
  host: { class: 'mx-3.5 mt-3 block rounded-xl bg-[#efe7de] px-3 pt-3.5 pb-3' },
})
export class VistaPreviaWhatsappComponent {
  readonly partes = input.required<Parte[]>();
  /** Pie de baja de las promociones ("Responde BAJA…"); vacío = sin pie. */
  readonly pie = input('');
}
