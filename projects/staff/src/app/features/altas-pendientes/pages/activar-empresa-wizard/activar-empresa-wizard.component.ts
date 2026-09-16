import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { IconInfoCircle, TablerIconComponent } from '@tabler/icons-angular';
import { Observable, Subscription, forkJoin } from 'rxjs';
import { SidePanelComponent } from '../../../../shared/ui/side-panel/side-panel.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { CampoDetalleComponent } from '../../../../shared/ui/campo-detalle/campo-detalle.component';
import { EmpresaDetallePanelComponent } from '../../../empresas/pages/empresa-detalle-panel/empresa-detalle-panel.component';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { EmpresaConDueno } from '../../../../core/catalog/models/empresa.model';
import { Plan } from '../../../../core/catalog/models/plan.model';

/** Payload real de `RealtimeGateway.emitirAUsuario(..., 'empresa.activada', ...)`
 * (ver `EmpresaService.activarPorConfirmacionCliente` del backend). */
interface EventoEmpresaActivada {
  empresaId: number;
  nombre: string;
}

/**
 * Asistente de activación (§4/§11 Paso 3, PROPUESTA_FLUJO_ALTA_ASISTIDA.md)
 * — reemplaza la llamada directa a `EmpresaService.activar()` (legado, un
 * solo paso) que usaba `AltasPendientesPageComponent`. Contenedor:
 * `SidePanelComponent` en vez de `ModalComponent` (la propuesta dejaba
 * cualquiera de los dos "a decidir al construirlo") — hay demasiados
 * campos + ayudas para un modal centrado, mismo motivo que ya llevó a
 * `EmpresaDetallePanelComponent` a usar el panel lateral en el Paso 2.
 * `ModalComponent` sigue usándose, pero anidado, para las dos
 * confirmaciones puntuales (llamada finalizada / rechazar) que sí son
 * simples "dos botones" — igual que ya conviven `ModalComponent` +
 * paneles en el resto de la app.
 *
 * Dos pasos según el estado real de la Empresa, no un contador interno:
 * si al abrir ya está `informacion_corroborada` (se cerró con "Cerrar y
 * seguir trabajando" en una sesión anterior y se reabre desde la
 * etiqueta de espera), arranca directo en el paso 2 en vez de volver a
 * mostrar el paso 1 — "retomarlo cuando quiera, sin perder el hilo" (§4).
 */
@Component({
  selector: 'app-activar-empresa-wizard',
  standalone: true,
  imports: [TablerIconComponent, SidePanelComponent, ModalComponent, CampoDetalleComponent, EmpresaDetallePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activar-empresa-wizard.component.html',
})
export class ActivarEmpresaWizardComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly realtimeService = inject(RealtimeService);

  readonly empresaId = input.required<number>();
  /** Emite cada vez que algo cambió en el servidor (datos editados,
   * llamada finalizada, activada, rechazada) — el padre
   * (`AltasPendientesPageComponent`) simplemente recarga la cola entera
   * en vez de tratar de reflejar cada transición a mano: son pocas filas
   * y varios tipos de cambio distintos, no vale la pena la complejidad. */
  readonly actualizada = output<void>();
  /** "Cerrar y seguir trabajando" (o la X, o el backdrop) — nunca cancela
   * nada del lado del servidor, ver el comentario de la clase. */
  readonly cerrar = output<void>();

  protected readonly iconInfo = IconInfoCircle;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly empresa = signal<EmpresaConDueno | null>(null);
  protected readonly titulo = computed(() => this.empresa()?.nombre ?? 'Activar Empresa');

  protected readonly paso = signal<1 | 2>(1);
  protected readonly exito = signal(false);

  // Paso 1 — datos editables al vuelo (§4 paso 1).
  protected readonly nombre = signal('');
  protected readonly telefono = signal('');
  protected readonly planId = signal<number | null>(null);
  protected readonly planes = signal<Plan[]>([]);
  private planIdOriginal: number | null = null;
  protected readonly guardandoDatos = signal(false);
  protected readonly errorGuardarDatos = signal<string | null>(null);

  protected readonly hayCambiosDatos = computed(() => {
    const actual = this.empresa();
    if (!actual) {
      return false;
    }
    return (
      this.nombre().trim() !== actual.nombre ||
      this.telefono().trim() !== (actual.telefonoContacto ?? '') ||
      this.planId() !== this.planIdOriginal
    );
  });

  // Paso 1 — llamar ahora / programar llamada → "Llamada finalizada".
  protected readonly llamadaIniciada = signal(false);
  protected readonly mostrarFormularioProgramar = signal(false);
  protected readonly fechaHoraProgramada = signal('');
  protected readonly programando = signal(false);
  protected readonly errorProgramar = signal<string | null>(null);

  protected readonly mostrarConfirmacionLlamada = signal(false);
  protected readonly confirmandoLlamada = signal(false);
  protected readonly errorConfirmarLlamada = signal<string | null>(null);

  // Paso 2 — esperando confirmación del cliente.
  protected readonly reenviando = signal(false);
  protected readonly enlaceReenviado = signal(false);
  protected readonly errorReenviar = signal<string | null>(null);
  private pollingSub: Subscription | null = null;
  private socketSub: Subscription | null = null;

  // Rechazar — disponible en cualquiera de los dos pasos (§4/§5.3: se
  // puede rechazar en cualquier estado "en curso", el backend lo valida).
  protected readonly mostrarRechazar = signal(false);
  protected readonly motivoRechazo = signal('');
  protected readonly rechazando = signal(false);
  protected readonly errorRechazar = signal<string | null>(null);

  // Ícono de info del paso 1 — reusa el mismo panel de detalle del Paso 2
  // en vez de duplicar los campos de solo lectura acá.
  protected readonly mostrarDetalle = signal(false);

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
    inject(DestroyRef).onDestroy(() => this.detenerEscucha());
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.paso.set(1);
    this.exito.set(false);
    this.llamadaIniciada.set(false);
    this.detenerEscucha();

    forkJoin({
      empresa: this.empresaService.obtenerUno(id),
      suscripciones: this.suscripcionService.listar('pendiente', id),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ empresa, suscripciones, planes }) => {
        this.empresa.set(empresa);
        this.nombre.set(empresa.nombre);
        this.telefono.set(empresa.telefonoContacto ?? '');
        this.planIdOriginal = suscripciones.data[0]?.planId ?? null;
        this.planId.set(this.planIdOriginal);
        this.planes.set(planes.data);
        this.cargando.set(false);

        if (empresa.estado === 'informacion_corroborada') {
          this.entrarPaso2();
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle de la Empresa. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected guardarDatos(): void {
    const actual = this.empresa();
    if (!actual || this.guardandoDatos() || !this.hayCambiosDatos()) {
      return;
    }

    this.guardandoDatos.set(true);
    this.errorGuardarDatos.set(null);

    const pedidos: Observable<unknown>[] = [];
    if (this.nombre().trim() !== actual.nombre) {
      pedidos.push(this.empresaService.corregirNombre(actual.id, this.nombre().trim()));
    }
    if (this.telefono().trim() !== (actual.telefonoContacto ?? '')) {
      pedidos.push(
        this.empresaService.actualizar(actual.id, {
          telefonoContacto: this.telefono().trim() || undefined,
        }),
      );
    }
    const planElegido = this.planId();
    if (planElegido !== null && planElegido !== this.planIdOriginal) {
      pedidos.push(this.suscripcionService.cambiarPlan(actual.id, planElegido));
    }

    forkJoin(pedidos).subscribe({
      next: () => {
        this.guardandoDatos.set(false);
        this.planIdOriginal = this.planId();
        this.empresa.update((e) =>
          e
            ? { ...e, nombre: this.nombre().trim(), telefonoContacto: this.telefono().trim() || null }
            : e,
        );
        this.actualizada.emit();
      },
      error: (err: unknown) => {
        this.guardandoDatos.set(false);
        this.errorGuardarDatos.set(this.mensajeDeError(err));
      },
    });
  }

  protected llamarAhora(): void {
    this.llamadaIniciada.set(true);
    this.mostrarFormularioProgramar.set(false);
  }

  protected abrirProgramarLlamada(): void {
    this.mostrarFormularioProgramar.set(true);
  }

  protected confirmarProgramarLlamada(): void {
    const actual = this.empresa();
    const fechaHora = this.fechaHoraProgramada();
    if (!actual || !fechaHora || this.programando()) {
      return;
    }

    this.programando.set(true);
    this.errorProgramar.set(null);
    this.empresaService.programarLlamada(actual.id, new Date(fechaHora).toISOString()).subscribe({
      next: () => {
        this.programando.set(false);
        this.mostrarFormularioProgramar.set(false);
        this.llamadaIniciada.set(true);
      },
      error: (err: unknown) => {
        this.programando.set(false);
        this.errorProgramar.set(this.mensajeDeError(err));
      },
    });
  }

  protected abrirConfirmarLlamadaFinalizada(): void {
    this.errorConfirmarLlamada.set(null);
    this.mostrarConfirmacionLlamada.set(true);
  }

  protected cancelarConfirmacionLlamada(): void {
    this.mostrarConfirmacionLlamada.set(false);
  }

  protected confirmarLlamadaFinalizada(): void {
    const actual = this.empresa();
    if (!actual || this.confirmandoLlamada()) {
      return;
    }

    this.confirmandoLlamada.set(true);
    this.errorConfirmarLlamada.set(null);
    this.empresaService.llamadaFinalizada(actual.id).subscribe({
      next: (empresaActualizada) => {
        this.confirmandoLlamada.set(false);
        this.mostrarConfirmacionLlamada.set(false);
        this.empresa.update((e) => (e ? { ...e, ...empresaActualizada } : e));
        this.actualizada.emit();
        this.entrarPaso2();
      },
      error: (err: unknown) => {
        this.confirmandoLlamada.set(false);
        this.mostrarConfirmacionLlamada.set(false);
        this.errorConfirmarLlamada.set(this.mensajeDeError(err));
      },
    });
  }

  private entrarPaso2(): void {
    this.paso.set(2);
    this.enlaceReenviado.set(false);
    this.escucharActivacion();
  }

  /** WebSocket (evento real) + polling cada 30s como red de seguridad
   * (§4: "un socket se puede desconectar en silencio") — lo que llegue
   * primero cierra el paso 2. */
  private escucharActivacion(): void {
    this.detenerEscucha();

    this.socketSub = this.realtimeService
      .escuchar<EventoEmpresaActivada>('empresa.activada')
      .subscribe((evento) => {
        if (evento.empresaId === this.empresaId()) {
          this.onActivada();
        }
      });

    this.pollingSub = new Subscription();
    const intervalId = setInterval(() => {
      this.empresaService.obtenerUno(this.empresaId()).subscribe({
        next: (empresa) => {
          if (empresa.estado === 'activa') {
            this.onActivada();
          }
        },
        // Un poll fallido no es motivo para tirar abajo el asistente —
        // el socket sigue escuchando y el próximo poll lo vuelve a
        // intentar solo.
        error: () => undefined,
      });
    }, 30_000);
    this.pollingSub.add(() => clearInterval(intervalId));
  }

  private onActivada(): void {
    this.detenerEscucha();
    this.exito.set(true);
    this.actualizada.emit();
  }

  private detenerEscucha(): void {
    this.pollingSub?.unsubscribe();
    this.socketSub?.unsubscribe();
    this.pollingSub = null;
    this.socketSub = null;
  }

  protected reenviarEnlace(): void {
    const actual = this.empresa();
    if (!actual || this.reenviando()) {
      return;
    }

    this.reenviando.set(true);
    this.errorReenviar.set(null);
    this.enlaceReenviado.set(false);
    this.empresaService.reenviarEnlace(actual.id).subscribe({
      next: () => {
        this.reenviando.set(false);
        this.enlaceReenviado.set(true);
      },
      error: (err: unknown) => {
        this.reenviando.set(false);
        this.errorReenviar.set(this.mensajeDeError(err));
      },
    });
  }

  protected abrirRechazar(): void {
    this.motivoRechazo.set('');
    this.errorRechazar.set(null);
    this.mostrarRechazar.set(true);
  }

  protected cancelarRechazar(): void {
    this.mostrarRechazar.set(false);
  }

  protected confirmarRechazar(): void {
    const actual = this.empresa();
    const motivo = this.motivoRechazo().trim();
    if (!actual || !motivo || this.rechazando()) {
      return;
    }

    this.rechazando.set(true);
    this.errorRechazar.set(null);
    this.empresaService.rechazar(actual.id, motivo).subscribe({
      next: () => {
        this.rechazando.set(false);
        this.mostrarRechazar.set(false);
        this.detenerEscucha();
        this.actualizada.emit();
        this.cerrar.emit();
      },
      error: (err: unknown) => {
        this.rechazando.set(false);
        this.errorRechazar.set(this.mensajeDeError(err));
      },
    });
  }

  protected abrirDetalle(): void {
    this.mostrarDetalle.set(true);
  }

  protected cerrarDetalle(): void {
    this.mostrarDetalle.set(false);
  }

  protected onDetalleActualizado(): void {
    this.actualizada.emit();
  }

  protected cerrarYSeguirTrabajando(): void {
    this.cerrar.emit();
  }

  protected cerrarConExito(): void {
    this.cerrar.emit();
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo completar la acción. Intenta de nuevo.';
  }
}
