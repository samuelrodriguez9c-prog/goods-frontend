import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COSTO_PLANTILLA, cop } from '../../../../shared/secciones';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

/** Columna derecha de Conectar: lo que cuesta y que la IA viene incluida. */
@Component({
  selector: 'app-costos-conexion',
  imports: [IaMarcaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './costos-conexion.component.html',
  host: { class: 'flex flex-col gap-3' },
})
export class CostosConexionComponent {
  protected readonly costos = [
    { k: 'Responder en 24 h', d: 'Desde el último mensaje del cliente', v: 'Gratis', color: 'text-[#1d8a4b]' },
    { k: 'Plantilla de servicio', d: 'Pedido listo, entrega, cotización', v: `≈ ${cop(COSTO_PLANTILLA['UTILITY'])}`, color: 'text-[#111827]' },
    { k: 'Plantilla de promoción', d: 'Campañas y ofertas', v: `≈ ${cop(COSTO_PLANTILLA['MARKETING'])}`, color: 'text-[#111827]' },
    { k: 'Goods', d: 'Bandeja, IA y campañas', v: 'En tu plan', color: 'text-[#00857e]' },
  ];
}
