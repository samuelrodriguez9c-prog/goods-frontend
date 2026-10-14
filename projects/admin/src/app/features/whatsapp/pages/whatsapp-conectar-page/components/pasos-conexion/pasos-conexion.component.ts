import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconCheck, TablerIconComponent } from '@tabler/icons-angular';

const PASOS = [
  { titulo: 'Entra con Facebook', texto: 'Usa la cuenta de Facebook que administra el negocio.' },
  { titulo: 'Elige tu número', texto: 'El de WhatsApp Business. Te llega un código para confirmarlo.' },
  { titulo: 'Listo', texto: 'Los mensajes nuevos empiezan a llegar a la bandeja de Goods.' },
];

/**
 * Los tres pasos para conectar el número. Mientras se conecta, los pasos ya
 * hechos se ponen turquesa con ✓ y el actual en oscuro.
 */
@Component({
  selector: 'app-pasos-conexion',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pasos-conexion.component.html',
  host: { class: 'block' },
})
export class PasosConexionComponent {
  /** Paso en curso (0, 1, 2) o null si no se está conectando. */
  readonly paso = input<number | null>(null);

  protected readonly iCheck = IconCheck;
  protected readonly pasos = computed(() => {
    const actual = this.paso();
    return PASOS.map((p, i) => {
      const hecho = actual != null && actual > i;
      const activo = actual === i;
      return {
        ...p,
        n: i + 1,
        hecho,
        linea: i < PASOS.length - 1,
        num: hecho ? 'bg-[#2be0d5] text-[#003331]' : activo ? 'bg-[#303030] text-white' : 'bg-[#f1f1f1] text-[#6b7280]',
        lineaBg: hecho ? 'bg-[#2be0d5]' : 'bg-[#ececec]',
      };
    });
  });
}
