import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IconBan, IconPlayerPause, IconRotateClockwise, TablerIconComponent } from '@tabler/icons-angular';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { AlertaService } from '../../../../core/ui/alerta.service';

type Accion = 'suspender' | 'dar-de-baja' | 'reactivar';

const ESTADO_UI: Record<string, { texto: string; nota: string; punto: string }> = {
  activa: { texto: 'Activa', nota: 'La cuenta opera con normalidad (si su suscripción está al día).', punto: 'bg-success-solid' },
  suspendida: { texto: 'Suspendida', nota: 'Sin acceso hasta que la reactives. La suscripción sigue igual.', punto: 'bg-badge-warning-solid' },
  cancelada: { texto: 'Dada de baja', nota: 'Sin acceso y sin suscripción. Para volver hay que elegir un plan.', punto: 'bg-badge-error-solid' },
};

/**
 * "Estado de la cuenta" en el detalle de una Empresa (2026-10-04):
 * suspender, dar de baja y reactivar, con motivo obligatorio para cortar.
 * Solo aparece para Empresas ya dadas de alta (activa/suspendida/cancelada)
 * y con el permiso `empresas.cambiar_estado`.
 *
 * Suspender corta el acceso sin tocar la suscripción (temporal). Dar de
 * baja también cancela la suscripción. Reactivar desde una baja pide el
 * plan con el que vuelve.
 */
@Component({
  selector: 'app-ciclo-empresa',
  standalone: true,
  imports: [FormsModule, DatePipe, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ciclo-empresa.component.html',
})
export class CicloEmpresaComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);

  readonly empresa = input.required<Empresa>();
  readonly cambiado = output<void>();

  protected readonly i = { suspender: IconPlayerPause, baja: IconBan, reactivar: IconRotateClockwise };

  protected readonly puedeGestionar = computed(() =>
    (this.auth.currentUser()?.permisos ?? []).includes('empresas.cambiar_estado'),
  );
  protected readonly visible = computed(() => ['activa', 'suspendida', 'cancelada'].includes(this.empresa().estado));
  protected readonly ui = computed(() => ESTADO_UI[this.empresa().estado] ?? ESTADO_UI['activa']);

  /** Acceso real de una Empresa `activa` (2026-10-04): la cuenta puede
   *  estar activa y aun así no operar por la suscripción. */
  protected readonly accesoTexto = computed(() => {
    const e = this.empresa();
    if (e.estado !== 'activa' || !e.acceso) return null;
    const vence = e.acceso.fechaProximoVencimiento ? new Date(e.acceso.fechaProximoVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    switch (e.acceso.estado) {
      case 'ok':
        return { texto: vence ? `Opera con normalidad. Pagado hasta el ${vence}.` : 'Opera con normalidad.', tinta: 'text-gray-500' };
      case 'en_mora':
        return { texto: `En mora: venció el ${vence}. Sigue operando durante los días de gracia.`, tinta: 'text-amber-700' };
      default:
        return e.acceso.motivo === 'suscripcion_vencida'
          ? { texto: `Sin acceso: la suscripción venció el ${vence} sin pago. Se desbloquea sola al registrar el pago en Facturación.`, tinta: 'text-badge-error-solid' }
          : { texto: 'Sin acceso: no tiene un plan activo. Asígnale uno desde Suscripciones.', tinta: 'text-badge-error-solid' };
    }
  });

  protected readonly accion = signal<Accion | null>(null);
  protected readonly motivo = signal('');
  protected readonly planId = signal<number | null>(null);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly acciones = computed<{ clave: Accion; texto: string; icono: typeof IconBan; peligro: boolean }[]>(() => {
    switch (this.empresa().estado) {
      case 'activa':
        return [
          { clave: 'suspender', texto: 'Suspender', icono: IconPlayerPause, peligro: false },
          { clave: 'dar-de-baja', texto: 'Dar de baja', icono: IconBan, peligro: true },
        ];
      case 'suspendida':
        return [
          { clave: 'reactivar', texto: 'Reactivar', icono: IconRotateClockwise, peligro: false },
          { clave: 'dar-de-baja', texto: 'Dar de baja', icono: IconBan, peligro: true },
        ];
      case 'cancelada':
        return [{ clave: 'reactivar', texto: 'Reactivar con un plan', icono: IconRotateClockwise, peligro: false }];
      default:
        return [];
    }
  });

  protected readonly consecuencia = computed(() => {
    switch (this.accion()) {
      case 'suspender':
        return 'El cliente y su equipo pierden el acceso al panel hasta que la reactives. La suscripción y sus pagos no cambian.';
      case 'dar-de-baja':
        return 'La cuenta queda sin acceso y su suscripción se cancela (deja de facturarse). Se puede volver más adelante eligiendo un plan.';
      case 'reactivar':
        if (this.empresa().estado === 'cancelada') {
          return 'Vuelve a operar con una suscripción nueva desde hoy, al plan que elijas (vence en un mes).';
        }
        return this.empresa().acceso?.suscripcionEstado === 'vencida'
          ? 'La cuenta vuelve a quedar activa, pero su suscripción está vencida: seguirá sin acceso hasta que se registre el pago en Facturación.'
          : 'Vuelve a operar con la misma suscripción que tenía.';
      default:
        return '';
    }
  });

  protected readonly puedeConfirmar = computed(() => {
    if (this.guardando()) return false;
    const a = this.accion();
    if (a === 'suspender' || a === 'dar-de-baja') return this.motivo().trim().length >= 5;
    if (a === 'reactivar' && this.empresa().estado === 'cancelada') return this.planId() !== null;
    return a === 'reactivar';
  });

  protected elegir(a: Accion): void {
    this.accion.set(a);
    this.motivo.set('');
    this.error.set(null);
    if (a === 'reactivar' && this.empresa().estado === 'cancelada' && !this.planes().length) {
      this.planService.listarTodos().subscribe((r) => this.planes.set(r.data.filter((p) => p.activo)));
    }
  }

  protected cancelar(): void {
    this.accion.set(null);
    this.error.set(null);
  }

  protected confirmar(): void {
    const a = this.accion();
    const e = this.empresa();
    if (!a || !this.puedeConfirmar()) return;
    const motivo = this.motivo().trim();
    let llamada$: Observable<Empresa>;
    let titulos: { cargando: string; exito: string };
    if (a === 'suspender') {
      llamada$ = this.empresaService.suspender(e.id, motivo);
      titulos = { cargando: 'Suspendiendo la cuenta', exito: 'Cuenta suspendida' };
    } else if (a === 'dar-de-baja') {
      llamada$ = this.empresaService.darDeBaja(e.id, motivo);
      titulos = { cargando: 'Dando de baja la cuenta', exito: 'Cuenta dada de baja' };
    } else {
      llamada$ = this.empresaService.reactivar(e.id, { motivo: motivo || undefined, planId: this.planId() ?? undefined });
      titulos = { cargando: 'Reactivando la cuenta', exito: 'Cuenta reactivada' };
    }
    this.guardando.set(true);
    this.error.set(null);
    this.alertas
      .seguir(llamada$, {
        titulo: titulos.cargando,
        texto: e.nombre,
        exito: { titulo: titulos.exito, texto: e.nombre },
        error: { titulo: 'No se pudo cambiar el estado', texto: 'Revisa el detalle en el panel.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.accion.set(null);
          this.cambiado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          const m = err instanceof HttpErrorResponse ? (err.error as { message?: string | string[] } | null)?.message : null;
          this.error.set(m ? (Array.isArray(m) ? m.join(' ') : m) : 'No se pudo cambiar el estado. Intenta de nuevo.');
        },
      });
  }
}
