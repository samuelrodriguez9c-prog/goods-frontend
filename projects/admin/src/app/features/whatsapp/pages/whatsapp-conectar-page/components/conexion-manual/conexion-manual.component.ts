import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { IconChevronRight, TablerIconComponent } from '@tabler/icons-angular';

export interface DatosConexionManual {
  token: string;
  phoneNumberId: string;
  wabaId?: string;
}

/**
 * "Conectar a mano con el número de prueba de Meta": plegable, con el token y
 * los identificadores que da developers.facebook.com.
 */
@Component({
  selector: 'app-conexion-manual',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conexion-manual.component.html',
  host: { class: 'block' },
})
export class ConexionManualComponent {
  readonly abierto = model(false);
  readonly conectando = input(false);
  readonly conectar = output<DatosConexionManual>();

  protected readonly iChevron = IconChevronRight;
  protected readonly token = signal('');
  protected readonly phoneNumberId = signal('');
  protected readonly wabaId = signal('');

  /** Token de Meta (largo) e identificador del número (solo dígitos, 6 o más). */
  protected readonly valido = computed(() => this.token().trim().length > 20 && /^\d{6,}$/.test(this.phoneNumberId().trim()));

  protected enviar(): void {
    if (this.conectando() || !this.valido()) return;
    this.conectar.emit({
      token: this.token().trim(),
      phoneNumberId: this.phoneNumberId().trim(),
      wabaId: this.wabaId().trim() || undefined,
    });
  }

  /** Después de conectar (bien o mal) no queda el token a la vista. */
  limpiarToken(): void {
    this.token.set('');
  }
}
