import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Editor del paso "Bienvenida": el mensaje y cómo le llega a un cliente nuevo. */
@Component({
  selector: 'app-editor-bienvenida',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-bienvenida.component.html',
  host: { class: 'block' },
})
export class EditorBienvenidaComponent {
  readonly texto = model.required<string>();
  readonly puedeConfigurar = input(false);
  readonly llenar = input.required<(texto: string) => string>();
}
