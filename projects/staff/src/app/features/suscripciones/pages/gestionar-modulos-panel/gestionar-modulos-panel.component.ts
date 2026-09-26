import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import {
  IconCircleCheck,
  IconCircleOff,
  IconCircleX,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { DesgloseModuloEmpresa } from '../../../../core/catalog/models/modulo.model';

/** Vista de una fila del desglose, con el texto/tinta ya resueltos —
 * mismo criterio que `ESTADO_UI`/`FilaEmpresa` de `suscripciones-page` y
 * `gestionar-suscripcion-panel`: la pantalla no traduce estados crudos en
 * el template. */
interface FilaModulo extends DesgloseModuloEmpresa {
  estadoTexto: string;
  estadoTinta: string;
  estadoPunto: string;
}

function filaDe(modulo: DesgloseModuloEmpresa): FilaModulo {
  const o = modulo.override;
  if (o?.tipo === 'concedido') {
    return {
      ...modulo,
      estadoTexto: modulo.desdePlan ? 'Extra concedido (ya lo traía el plan)' : 'Extra concedido',
      estadoTinta: 'text-emerald-900',
      estadoPunto: 'bg-success-solid',
    };
  }
  if (o?.tipo === 'revocado') {
    return {
      ...modulo,
      estadoTexto: modulo.desdePlan ? 'Revocado (el plan lo incluye)' : 'Revocado',
      estadoTinta: 'text-badge-error-solid',
      estadoPunto: 'bg-badge-error-solid',
    };
  }
  if (modulo.desdePlan) {
    return {
      ...modulo,
      estadoTexto: 'Incluido en el plan',
      estadoTinta: 'text-gray-700',
      estadoPunto: 'bg-gray-400',
    };
  }
  return {
    ...modulo,
    estadoTexto: 'No incluido',
    estadoTinta: 'text-gray-400',
    estadoPunto: 'bg-gray-200',
  };
}

/**
 * Panel "Módulos extra" (§11.5 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md,
 * paso 4 de la Fase 2) — mismo patrón que
 * `GestionarSuscripcionPanelComponent`/`EmpresaDetallePanelComponent`:
 * recibe solo `[empresaId]` y carga todo por su cuenta (acá, un único
 * `GET /empresas/:id/modulos`, que ya trae el desglose completo del
 * catálogo — no hace falta un segundo pedido al catálogo de `Modulo`).
 *
 * A diferencia de `GestionarSuscripcionPanelComponent` (una sola decisión
 * por apertura: cambiar de plan o el estado, y se cierra), acá el staff
 * puede tocar VARIOS módulos en una misma sesión — conceder uno, revocar
 * otro — así que cada fila aplica su cambio al toque (con
 * `AlertaService.seguir()` para el aviso) y el panel se queda abierto;
 * solo el botón "Cerrar" lo cierra. Por eso `actualizada` se emite una
 * vez por cada cambio aplicado (no una sola vez al final): quien lo
 * escuche (hoy, `EmpresaDetallePanelComponent`, para refrescar su propio
 * resumen de solo lectura) decide qué hacer con cada aviso, sin que este
 * panel tenga que saber si alguien más está escuchando.
 *
 * Reusado en dos entradas (§11.5): el botón "Módulos extra" de
 * `SuscripcionesPageComponent` y la sección "Módulos" de
 * `EmpresaDetallePanelComponent` — mismo componente de edición para las
 * dos, en vez de un componente de solo-lectura más uno de edición: el
 * desglose que se puede LEER es exactamente el mismo que se puede
 * EDITAR, así que separar solo hubiera duplicado el template sin
 * ganar nada.
 */
@Component({
  selector: 'app-gestionar-modulos-panel',
  standalone: true,
  imports: [TablerIconComponent, PantallaEstadoComponent, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gestionar-modulos-panel.component.html',
})
export class GestionarModulosPanelComponent {
  private readonly moduloService = inject(ModuloService);
  private readonly empresaService = inject(EmpresaService);
  private readonly alertas = inject(AlertaService);

  readonly empresaId = input.required<number>();
  readonly cerrar = output<void>();
  /** Se emite una vez por cada cambio aplicado con éxito (conceder,
   * revocar, o quitar una excepción) — ver el docstring de la clase. */
  readonly actualizada = output<void>();

  protected readonly iconCerrar = IconX;
  protected readonly iconConceder = IconCircleCheck;
  protected readonly iconRevocar = IconCircleX;
  protected readonly iconQuitar = IconCircleOff;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly empresaNombre = signal('');
  private readonly modulos = signal<DesgloseModuloEmpresa[]>([]);
  protected readonly filas = computed(() => this.modulos().map(filaDe));

  /** Fila con el formulario de motivo abierto (conceder/revocar) —
   * `null` si ninguna fila está en edición. */
  protected readonly editandoCodigo = signal<string | null>(null);
  protected readonly tipoEnEdicion = signal<'concedido' | 'revocado' | null>(null);
  protected readonly motivoEnEdicion = signal('');
  /** Código del módulo con una request en curso (aplicar o quitar) — deshabilita
   * sus propios botones mientras tanto, sin bloquear el resto de las filas. */
  protected readonly guardandoCodigo = signal<string | null>(null);
  protected readonly errorFila = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      empresa: this.empresaService.obtenerUno(id),
      modulos: this.moduloService.listarDesglose(id),
    }).subscribe({
      next: ({ empresa, modulos }) => {
        this.empresaNombre.set(empresa.nombre);
        this.modulos.set(modulos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar los módulos de esta Empresa. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Recarga solo el desglose (no la Empresa, no cambia) tras aplicar un
   * cambio — sin tocar `cargando()`, el panel no vuelve a mostrar el
   * esqueleto por una fila que ya se actualizó sola. */
  private recargarDesglose(): void {
    this.moduloService.listarDesglose(this.empresaId()).subscribe({
      next: (modulos) => this.modulos.set(modulos),
      // Si falla el refresco silencioso, la fila se queda con el valor
      // anterior — no es grave, el próximo `reintentar()`/apertura lo
      // corrige, y la alerta de éxito ya le confirmó al staff que el
      // cambio se aplicó igual.
      error: () => {},
    });
  }

  /** `(reintentar)` de `app-pantalla-estado`. */
  protected reintentar(): void {
    this.cargar(this.empresaId());
  }

  protected iniciarConceder(fila: FilaModulo): void {
    if (this.guardandoCodigo()) {
      return;
    }
    this.editandoCodigo.set(fila.codigo);
    this.tipoEnEdicion.set('concedido');
    this.motivoEnEdicion.set(fila.override?.tipo === 'concedido' ? (fila.override.motivo ?? '') : '');
    this.errorFila.set(null);
  }

  protected iniciarRevocar(fila: FilaModulo): void {
    if (this.guardandoCodigo()) {
      return;
    }
    this.editandoCodigo.set(fila.codigo);
    this.tipoEnEdicion.set('revocado');
    this.motivoEnEdicion.set(fila.override?.tipo === 'revocado' ? (fila.override.motivo ?? '') : '');
    this.errorFila.set(null);
  }

  protected cancelarEdicion(): void {
    this.editandoCodigo.set(null);
    this.tipoEnEdicion.set(null);
    this.motivoEnEdicion.set('');
  }

  protected confirmarEdicion(): void {
    const codigo = this.editandoCodigo();
    const tipo = this.tipoEnEdicion();
    const fila = this.filas().find((f) => f.codigo === codigo);
    if (!codigo || !tipo || !fila || this.guardandoCodigo()) {
      return;
    }

    this.guardandoCodigo.set(codigo);
    this.errorFila.set(null);
    const motivo = this.motivoEnEdicion().trim();
    this.alertas
      .seguir(
        this.moduloService.gestionar(this.empresaId(), {
          moduloId: fila.id,
          tipo,
          motivo: motivo || undefined,
        }),
        {
          titulo: tipo === 'concedido' ? 'Concediendo el módulo' : 'Revocando el módulo',
          texto: fila.nombre,
          exito: { titulo: tipo === 'concedido' ? 'Módulo concedido' : 'Módulo revocado' },
          error: { titulo: 'No se pudo aplicar el cambio', texto: 'Intenta de nuevo.' },
        },
      )
      .subscribe({
        next: () => {
          this.guardandoCodigo.set(null);
          this.cancelarEdicion();
          this.recargarDesglose();
          this.actualizada.emit();
        },
        error: (err: unknown) => {
          this.guardandoCodigo.set(null);
          this.errorFila.set(this.mensajeDeError(err));
        },
      });
  }

  /** Vuelve al default del plan — borra la excepción, sin pedir motivo
   * (no hace falta justificar volver a lo normal). */
  protected quitarExcepcion(fila: FilaModulo): void {
    if (!fila.override || this.guardandoCodigo()) {
      return;
    }
    this.guardandoCodigo.set(fila.codigo);
    this.errorFila.set(null);
    this.alertas
      .seguir(this.moduloService.quitar(this.empresaId(), fila.id), {
        titulo: 'Quitando la excepción',
        texto: fila.nombre,
        exito: { titulo: 'Vuelve al default del plan' },
        error: { titulo: 'No se pudo quitar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardandoCodigo.set(null);
          this.recargarDesglose();
          this.actualizada.emit();
        },
        error: (err: unknown) => {
          this.guardandoCodigo.set(null);
          this.errorFila.set(this.mensajeDeError(err));
        },
      });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
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
