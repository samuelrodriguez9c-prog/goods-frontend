import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Extrae el patrón "etiqueta + valor (o input) + texto de ayuda gris
 * chico" de §3.2 (PROPUESTA_FLUJO_ALTA_ASISTIDA.md) una sola vez — lo usa
 * `EmpresaDetallePanelComponent` (§11 Paso 2) por cada campo de la
 * Empresa, y el asistente de activación del Paso 3 lo va a reusar
 * también (mismo diseño de campo en varios pasos del wizard).
 *
 * `[editable]` en `true` muestra un `<input>` en vez del texto plano —
 * sin Angular Forms, como el resto del proyecto: el valor se pasa por
 * `[valor]` y el componente emite `(valorCambiado)` en cada `input`, el
 * padre decide cuándo guardar (ver `EmpresaDetallePanelComponent.guardar`,
 * que junta los cambios y llama `EmpresaService.actualizar` con un botón
 * explícito, no en cada tecla).
 *
 * Local a `staff` por ahora, mismo criterio que `ModalComponent` y
 * `SidePanelComponent`: se promueve a `shared-ui` recién si `admin`
 * también lo necesita.
 */
@Component({
  selector: 'app-campo-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campo-detalle.component.html',
})
export class CampoDetalleComponent {
  readonly etiqueta = input.required<string>();
  readonly valor = input('');
  readonly ayuda = input('');
  readonly editable = input(false);
  readonly placeholder = input('');

  readonly valorCambiado = output<string>();
}
