import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconAlertTriangle, IconBrandWhatsapp, IconCircleCheck, IconReceipt, TablerIconComponent } from '@tabler/icons-angular';
import { CompraService } from '../../../core/compra/compra.service';
import { pedirPorWhatsapp } from '../../../core/compra/pedido-whatsapp';
import { AlertaService } from '../../../core/ui/alerta.service';
import { AsistenteAccionesService } from '../../../core/asistente/asistente-acciones.service';
import { AsistenteChatStore } from '../../../core/asistente/asistente-chat.store';
import { AsistenteAccion } from '../../../core/asistente/models/asistente.model';

const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/**
 * Tarjeta de una acción que propuso el asistente (hoy, una compra a un
 * proveedor), bajo su respuesta en la pantalla completa y en el mini chat.
 * Nada pasa hasta «Confirmar compra»: el backend la crea pendiente con el
 * servicio de siempre y devuelve la acción resuelta, que reemplaza a esta en
 * el hilo (`AsistenteChatStore.actualizarAccion`).
 */
@Component({
  selector: 'app-ia-accion',
  standalone: true,
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ia-accion.component.html',
})
export class IaAccionComponent {
  private readonly api = inject(AsistenteAccionesService);
  private readonly store = inject(AsistenteChatStore);
  private readonly compras = inject(CompraService);
  private readonly alertas = inject(AlertaService);

  readonly accion = input.required<AsistenteAccion>();
  readonly mensajeId = input.required<number>();
  readonly compacto = input(false);

  protected readonly i = { compra: IconReceipt, ok: IconCircleCheck, aviso: IconAlertTriangle, whatsapp: IconBrandWhatsapp };
  protected readonly cop = cop;
  protected readonly ocupado = signal<'confirmar' | 'descartar' | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly abierta = computed(() => ['propuesta', 'fallida'].includes(this.accion().estado));
  protected readonly unidades = computed(() => this.accion().resumen.lineas.reduce((a, l) => a + l.cantidad, 0));
  /** «Vence en 5 h»: las propuestas duran 24 h. */
  protected readonly vence = computed(() => {
    const v = this.accion().venceEn;
    if (!v) return null;
    const horas = Math.max(0, Math.round((new Date(v).getTime() - Date.now()) / 3_600_000));
    return horas >= 1 ? `Vence en ${horas} h` : 'Vence en menos de una hora';
  });

  /** Con la compra creada: abre WhatsApp con el pedido escrito para el proveedor. */
  protected pedirWhatsapp(): void {
    const id = this.accion().resultado?.compraId;
    if (id) void pedirPorWhatsapp(id, this.compras, this.alertas);
  }

  protected confirmar(): void {
    this.hacer('confirmar', this.api.confirmar(this.accion().id));
  }

  protected descartar(): void {
    this.hacer('descartar', this.api.descartar(this.accion().id));
  }

  private hacer(cual: 'confirmar' | 'descartar', peticion: ReturnType<AsistenteAccionesService['confirmar']>): void {
    if (this.ocupado()) return;
    this.ocupado.set(cual);
    this.error.set(null);
    peticion.subscribe({
      next: (a) => {
        this.ocupado.set(null);
        this.store.actualizarAccion(this.mensajeId(), a);
      },
      error: (e: HttpErrorResponse) => {
        this.ocupado.set(null);
        const msg = e.error?.message;
        this.error.set(
          e.status === 403
            ? 'Tu rol no tiene permiso para crear compras.'
            : (Array.isArray(msg) ? msg.join('; ') : msg) ?? 'No se pudo. Intenta de nuevo.',
        );
        // Vencida, ya descartada o fallida: se refleja el estado nuevo sin recargar.
        if (e.status === 409 && /venció/.test(String(msg))) this.store.actualizarAccion(this.mensajeId(), { ...this.accion(), estado: 'vencida', venceEn: null });
        if (e.status === 400) this.store.actualizarAccion(this.mensajeId(), { ...this.accion(), estado: 'fallida', error: String(msg ?? '') });
      },
    });
  }
}
