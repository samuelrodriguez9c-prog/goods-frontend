import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import {
  IconBan,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconCopy,
  IconPlus,
  IconPuzzle,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { DesgloseModuloEmpresa } from '../../../../core/catalog/models/modulo.model';
import {
  EstadoModuloUi,
  MOTIVOS_RAPIDOS,
  PosicionModulo,
  estadoModulo,
  posicionDe,
  resumenModulos,
} from '../../../../shared/ui/modulos/modulo-ui';

interface FilaModulo extends DesgloseModuloEmpresa {
  ui: EstadoModuloUi;
  posicion: PosicionModulo;
}

type FiltroModulos = 'todos' | 'con' | 'excepciones' | 'sin';

const PASA: Record<FiltroModulos, (f: FilaModulo) => boolean> = {
  todos: () => true,
  con: (f) => f.efectivo,
  excepciones: (f) => !!f.override,
  sin: (f) => !f.efectivo,
};

/**
 * Panel "Módulos extra" (§11.5 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md).
 *
 * Rediseño 2026-09-27:
 * - Cabecera con ID copiable, "huella" (una barrita por módulo con el color
 *   de su estado) y cuatro celdas que son a la vez conteo y filtro.
 * - Cada fila tiene un selector de tres posiciones: Quitar (revocado) ·
 *   Plan (sin excepción) · Dar (concedido). Ir a Quitar/Dar abre el motivo
 *   inline con chips sugeridos; volver a Plan quita la excepción al toque,
 *   con la alerta en línea global.
 *
 * Sigue aplicando cada cambio al toque y emitiendo `actualizada` por cada
 * uno, igual que antes — `EmpresaDetallePanelComponent` lo escucha.
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
  private readonly pista = inject(PistaService);

  readonly empresaId = input.required<number>();
  readonly cerrar = output<void>();
  readonly actualizada = output<void>();

  protected readonly iconCerrar = IconX;
  protected readonly iconCopiar = IconCopy;
  protected readonly iconModulos = IconPuzzle;
  protected readonly iconConceder = IconCircleCheck;
  protected readonly iconRevocar = IconCircleX;
  protected readonly iconPlanSi = IconCircleCheck;
  protected readonly iconPlanNo = IconCircleDashed;

  protected readonly segmentos: { posicion: PosicionModulo; texto: string; titulo: string; icono: typeof IconBan }[] = [
    { posicion: 0, texto: 'Quitar', titulo: 'Revocar aunque el plan lo incluya', icono: IconBan },
    { posicion: 1, texto: 'Plan', titulo: 'Según plan', icono: IconCircleCheck },
    { posicion: 2, texto: 'Dar', titulo: 'Conceder fuera del plan', icono: IconPlus },
  ];
  protected readonly indicadorClase: Record<PosicionModulo, string> = {
    0: 'bg-field-error-bg',
    1: 'bg-card-bg',
    2: 'bg-badge-success-bg',
  };
  protected readonly tintaActiva: Record<PosicionModulo, string> = {
    0: 'text-badge-error-solid',
    1: 'text-gray-900',
    2: 'text-emerald-900',
  };

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly empresaNombre = signal('');
  private readonly modulos = signal<DesgloseModuloEmpresa[]>([]);
  protected readonly filas = computed<FilaModulo[]>(() =>
    this.modulos().map((m) => ({ ...m, ui: estadoModulo(m), posicion: posicionDe(m) })),
  );
  protected readonly resumen = computed(() => resumenModulos(this.modulos()));

  protected readonly filtro = signal<FiltroModulos>('todos');
  protected readonly filasVisibles = computed(() => this.filas().filter(PASA[this.filtro()]));
  protected readonly celdas = computed(() => {
    const f = this.filas();
    const n = (k: FiltroModulos) => f.filter(PASA[k]).length;
    return [
      { clave: 'todos' as const, texto: 'Todos', n: n('todos') },
      { clave: 'con' as const, texto: 'Con acceso', n: n('con') },
      { clave: 'excepciones' as const, texto: 'Excepciones', n: n('excepciones') },
      { clave: 'sin' as const, texto: 'Sin acceso', n: n('sin') },
    ];
  });

  protected readonly editandoCodigo = signal<string | null>(null);
  protected readonly tipoEnEdicion = signal<'concedido' | 'revocado' | null>(null);
  protected readonly motivoEnEdicion = signal('');
  protected readonly motivosRapidos = computed(() => {
    const t = this.tipoEnEdicion();
    return t ? MOTIVOS_RAPIDOS[t] : [];
  });
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

  private recargarDesglose(): void {
    this.moduloService.listarDesglose(this.empresaId()).subscribe({
      next: (modulos) => this.modulos.set(modulos),
      error: () => {},
    });
  }

  protected reintentar(): void {
    this.cargar(this.empresaId());
  }

  protected copiarId(): void {
    navigator.clipboard?.writeText(String(this.empresaId()));
    this.pista.hecho(`ID #${this.empresaId()} copiado`);
  }

  /** Click en una de las tres posiciones del selector. */
  protected elegirPosicion(fila: FilaModulo, posicion: PosicionModulo): void {
    if (posicion === fila.posicion || this.guardandoCodigo()) {
      return;
    }
    if (posicion === 1) {
      this.quitarExcepcion(fila);
      return;
    }
    const tipo = posicion === 2 ? 'concedido' : 'revocado';
    this.editandoCodigo.set(fila.codigo);
    this.tipoEnEdicion.set(tipo);
    this.motivoEnEdicion.set(fila.override?.tipo === tipo ? (fila.override.motivo ?? '') : '');
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
    this.aplicar(fila, tipo, this.motivoEnEdicion().trim() || undefined);
  }

  private aplicar(fila: DesgloseModuloEmpresa, tipo: 'concedido' | 'revocado', motivo?: string): void {
    this.guardandoCodigo.set(fila.codigo);
    this.errorFila.set(null);
    this.alertas
      .seguir(this.moduloService.gestionar(this.empresaId(), { moduloId: fila.id, tipo, motivo }), {
        titulo: tipo === 'concedido' ? 'Concediendo el módulo' : 'Revocando el módulo',
        texto: fila.nombre,
        exito: { titulo: tipo === 'concedido' ? 'Módulo concedido' : 'Módulo revocado' },
        error: { titulo: 'No se pudo aplicar el cambio', texto: 'Intenta de nuevo.' },
      })
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

  /** Vuelve al default del plan — sin motivo. Solo avisa la alerta en
   * línea global: la Pista con "Deshacer" que salía en paralelo se quitó
   * (2026-10-02) porque duplicaba el aviso. */
  private quitarExcepcion(fila: FilaModulo): void {
    if (!fila.override) {
      return;
    }
    this.guardandoCodigo.set(fila.codigo);
    this.cancelarEdicion();
    this.alertas
      .seguir(this.moduloService.quitar(this.empresaId(), fila.id), {
        titulo: 'Quitando la excepción',
        texto: fila.nombre,
        exito: { titulo: 'Vuelve al default del plan', texto: fila.nombre },
        error: { titulo: 'No se pudo quitar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
      next: () => {
        this.guardandoCodigo.set(null);
        this.recargarDesglose();
        this.actualizada.emit();
      },
      error: () => this.guardandoCodigo.set(null),
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
    return 'No se pudo aplicar el cambio. Intenta de nuevo.';
  }
}
