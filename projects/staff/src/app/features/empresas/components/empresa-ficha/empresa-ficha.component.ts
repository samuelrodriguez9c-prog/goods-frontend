import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBan,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconDeviceFloppy,
  IconLink,
  IconLock,
  IconPhone,
  IconPlayerPause,
  IconPlayerPlay,
  IconBulb,
  IconPencil,
  IconPuzzle,
  IconReceipt2,
  IconRefresh,
  IconSend,
  IconStack2,
  IconUserCheck,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ActividadEmpresa, EmpresaService } from '../../../../core/catalog/empresa.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { FacturacionService } from '../../../../core/facturacion/facturacion.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { Empresa, EmpresaConDueno } from '../../../../core/catalog/models/empresa.model';
import { DesgloseModuloEmpresa } from '../../../../core/catalog/models/modulo.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { EstadoCuenta, METODOS_PAGO, MetodoPago } from '../../../../core/facturacion/models/facturacion.model';
import { HojaPestanasComponent } from '../../../../shared/ui/lista-hoja/hoja-pestanas.component';
import { PestanaHoja } from '../../../../shared/ui/lista-hoja/lista-hoja.model';
import { MES_LARGO, dias, fmt, fmtY, hace, plata, pl } from '../../../../shared/ui/lista-hoja/formato';
import { EN_ALTA, ESTADO_EMPRESA, FilaEmpresa } from '../../pages/empresas-page/empresas-page.component';
import { Router } from '@angular/router';

type Pestana = 'resumen' | 'modulos' | 'actividad';
type AccionCuenta = 'suspender' | 'baja' | 'reactivar';
type TipoActividad = ActividadEmpresa['tipo'];

const ACCION_CUENTA: Record<AccionCuenta, { texto: string; sub: string; titulo: string; ayuda: string; boton: string; peligro: boolean }> = {
  suspender: { texto: 'Suspender…', sub: 'Corta el acceso hasta que se reactive', titulo: 'Suspender la Empresa', ayuda: 'No puede entrar a su panel. Los datos quedan intactos. Al dueño le llega un correo con este motivo.', boton: 'Suspender', peligro: true },
  baja: { texto: 'Dar de baja…', sub: 'Cierra la cuenta y la suscripción', titulo: 'Dar de baja', ayuda: 'Se cancela la suscripción vigente. Se puede reactivar más adelante.', boton: 'Dar de baja', peligro: true },
  reactivar: { texto: 'Reactivar…', sub: 'Vuelve a tener acceso con su plan', titulo: 'Reactivar la Empresa', ayuda: 'Recupera el acceso con el último plan. Al dueño le llega un correo avisando que volvió.', boton: 'Reactivar', peligro: false },
};

const MOTIVOS_MODULO = { conceder: ['Lo pidió en la llamada', 'Prueba por 30 días', 'Compensación'], revocar: ['No lo usa', 'Falta de pago del extra', 'Lo pidió el cliente'] };

/**
 * Ficha de la Empresa (hoja derecha de `Empresas - Lista y ficha v2`).
 * Reemplaza a `EmpresaDetallePanelComponent` dentro de la página; ese
 * componente puede quedar para otros lugares que lo abran como side panel.
 *
 * Carga al cambiar de Empresa: `obtenerUno` (dueño real), `estadoCuenta`
 * (ciclo + pagos; falla en silencio si no tiene suscripción) y
 * `listarDesglose` (módulos).
 */
@Component({
  selector: 'app-empresa-ficha',
  standalone: true,
  imports: [TablerIconComponent, HojaPestanasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresa-ficha.component.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class EmpresaFichaComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly router = inject(Router);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly moduloService = inject(ModuloService);
  private readonly facturacion = inject(FacturacionService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);

  readonly empresa = input.required<FilaEmpresa>();
  readonly planes = input<Plan[]>([]);
  readonly posicion = input('');
  readonly anterior = output<void>();
  readonly siguiente = output<void>();
  readonly actualizada = output<Partial<Empresa> & { id: number }>();
  readonly recargar = output<void>();

  protected readonly i = {
    arriba: IconChevronUp, abajo: IconChevronDown, derecha: IconChevronRight, copiar: IconCopy, check: IconCheck, x: IconX,
    flecha: IconArrowRight, enviar: IconSend, plan: IconStack2, reloj: IconClock, recibo: IconReceipt2, candado: IconLock,
    guardar: IconDeviceFloppy, alerta: IconAlertCircle, ok: IconCircleCheck, modulo: IconPuzzle, telefono: IconPhone,
    pausa: IconPlayerPause, play: IconPlayerPlay, ban: IconBan, refrescar: IconRefresh, enlace: IconLink, usuario: IconUserCheck,
  };
  protected readonly plata = plata;
  protected readonly metodos = METODOS_PAGO.slice(0, 3);
  protected readonly motivosModulo = MOTIVOS_MODULO;

  protected readonly detalle = signal<EmpresaConDueno | null>(null);
  protected readonly cuenta = signal<EstadoCuenta | null>(null);
  protected readonly modulos = signal<DesgloseModuloEmpresa[]>([]);
  protected readonly pestana = signal<Pestana>('resumen');
  protected readonly pop = signal<'estado' | 'plan' | null>(null);
  protected readonly accion = signal<AccionCuenta | null>(null);
  protected readonly motivo = signal('');
  protected readonly planElegido = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly idCopiado = signal(false);
  protected readonly formPago = signal<{ monto: string; ref: string; metodo: MetodoPago } | null>(null);
  protected readonly borrador = signal<{ correoContacto: string; telefonoContacto: string; rubro: string } | null>(null);
  protected readonly modEditando = signal<{ id: number; motivo: string } | null>(null);
  protected readonly filtroActividad = signal<TipoActividad | null>(null);

  constructor() {
    effect(() => {
      const id = this.empresa().id;
      untracked(() => this.cargar(id));
    });
  }

  private cargar(id: number): void {
    this.pestana.set('resumen');
    this.pop.set(null);
    this.accion.set(null);
    this.formPago.set(null);
    this.borrador.set(null);
    this.modEditando.set(null);
    this.detalle.set(null);
    this.cuenta.set(null);
    this.modulos.set([]);
    this.actividad.set([]);
    forkJoin({
      detalle: this.empresaService.obtenerUno(id),
      cuenta: this.facturacion.estadoCuenta(id).pipe(catchError(() => of(null))),
      modulos: this.moduloService.listarDesglose(id).pipe(catchError(() => of([]))),
      actividad: this.empresaService.actividad(id).pipe(catchError(() => of([] as ActividadEmpresa[]))),
    }).subscribe(({ detalle, cuenta, modulos, actividad }) => {
      if (this.empresa().id !== id) return;
      this.detalle.set(detalle);
      this.cuenta.set(cuenta);
      this.modulos.set(modulos);
      this.actividad.set(actividad);
    });
  }

  // ── Cabecera ─────────────────────────────────────────────────────────

  protected readonly estado = computed(() => ESTADO_EMPRESA[this.empresa().estado]);

  /** Próximo paso (mismo criterio que la lista anterior). */
  protected readonly paso = computed<{ texto: string; ejecutar: () => void } | null>(() => {
    const e = this.empresa();
    if (e.estado === 'solicitud_recibida') return { texto: 'Mandar a Altas pendientes', ejecutar: () => this.mandarAAltas() };
    // La llamada se hace en Altas pendientes (la hoja por fases), con este negocio elegido.
    if (e.estado === 'pendiente') return { texto: 'Llamar y verificar datos', ejecutar: () => this.router.navigate(['/altas-pendientes'], { queryParams: { empresa: e.id } }) };
    if (e.estado === 'informacion_corroborada') return { texto: 'Reenviar enlace', ejecutar: () => this.reenviarEnlace() };
    return null;
  });

  protected readonly antiguedad = computed(() => {
    const e = this.empresa();
    if (EN_ALTA.includes(e.estado)) return `Esperando ${hace(e.creadoEn).replace('hace ', '')}`;
    const meses = Math.max(0, Math.round(-dias(e.creadoEn) / 30));
    return meses < 1 ? 'Cliente nuevo' : `Cliente hace ${pl(meses, 'mes', 'meses')}`;
  });

  protected readonly accionesCuenta = computed<AccionCuenta[]>(() => {
    const est = this.empresa().estado;
    return est === 'activa' ? ['suspender', 'baja'] : est === 'suspendida' ? ['reactivar', 'baja'] : est === 'cancelada' ? ['reactivar'] : [];
  });
  protected readonly accionCuenta = ACCION_CUENTA;

  protected readonly notaEstado = computed(() => {
    const e = this.empresa();
    const desde = e.estadoCambiadoEn ? ` desde el ${fmt(e.estadoCambiadoEn)}` : '';
    if (e.estado === 'rechazada') return `Rechazada${desde}: ${e.motivoRechazo ?? 'sin motivo cargado'}.`;
    if (EN_ALTA.includes(e.estado)) return 'El estado avanza con el flujo de alta (Altas pendientes).';
    return `${this.estado().texto}${desde}${e.motivoEstado ? ` · “${e.motivoEstado}”` : ''}.`;
  });

  protected readonly planActual = computed(() => this.planes().find((p) => p.nombre === this.empresa().planNombre) ?? null);
  protected readonly planEditable = computed(() => this.empresa().estado === 'activa');

  protected readonly conAcceso = computed(() => this.modulos().filter((m) => m.efectivo).length);

  protected copiarId(): void {
    navigator.clipboard?.writeText(String(this.empresa().id)).catch(() => undefined);
    this.idCopiado.set(true);
    this.pista.hecho(`#${this.empresa().id} copiado`);
    setTimeout(() => this.idCopiado.set(false), 1400);
  }

  protected abrirPop(cual: 'estado' | 'plan'): void {
    if (cual === 'plan' && !this.planEditable()) return;
    this.pop.update((p) => (p === cual ? null : cual));
    this.accion.set(null);
    this.motivo.set('');
    this.planElegido.set(this.planActual()?.id ?? null);
  }

  protected cerrarPop(): void {
    this.pop.set(null);
    this.accion.set(null);
  }

  private mandarAAltas(): void {
    const e = this.empresa();
    this.ocupado.set(true);
    this.alertas
      .seguir(this.empresaService.enviarAAltasPendientes(e.id), {
        titulo: 'Mandando a Altas pendientes', texto: e.nombre,
        exito: { titulo: 'Enviada a Altas pendientes', texto: e.nombre },
        error: { titulo: 'No se pudo mandar la Empresa', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: (x) => { this.ocupado.set(false); this.actualizada.emit(x); }, error: () => this.ocupado.set(false) });
  }

  private reenviarEnlace(): void {
    const e = this.empresa();
    this.alertas
      .seguir(this.empresaService.reenviarEnlace(e.id), {
        titulo: 'Reenviando el enlace', texto: e.correoContacto,
        exito: { titulo: 'Enlace reenviado', texto: `Le llegó a ${e.duenoCorreo ?? e.correoContacto}.` },
        error: { titulo: 'No se pudo reenviar', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ error: () => undefined });
  }

  protected confirmarCuenta(): void {
    const a = this.accion();
    const e = this.empresa();
    const motivo = this.motivo().trim();
    if (!a || (a !== 'reactivar' && !motivo)) return;
    this.cerrarPop();
    const op =
      a === 'suspender' ? this.empresaService.suspender(e.id, motivo)
      : a === 'baja' ? this.empresaService.darDeBaja(e.id, motivo)
      : this.empresaService.reactivar(e.id, { motivo: motivo || undefined });
    const T = { suspender: ['Suspendiendo', 'Empresa suspendida'], baja: ['Dando de baja', 'Empresa dada de baja'], reactivar: ['Reactivando', 'Empresa reactivada'] }[a];
    this.alertas
      .seguir(op, { titulo: T[0], texto: e.nombre, exito: { titulo: T[1], texto: e.nombre }, error: { titulo: 'No se pudo cambiar el estado', texto: 'Intentá de nuevo.' } })
      .subscribe({ next: (x) => { this.actualizada.emit(x); this.recargar.emit(); }, error: () => undefined });
  }

  protected confirmarPlan(): void {
    const e = this.empresa();
    const plan = this.planes().find((p) => p.id === this.planElegido());
    if (!plan || plan.nombre === e.planNombre) return this.cerrarPop();
    this.cerrarPop();
    this.alertas
      .seguir(this.suscripcionService.cambiarPlan(e.id, plan.id), {
        titulo: 'Cambiando el plan', texto: `${e.nombre} → ${plan.nombre}`,
        exito: { titulo: 'Plan cambiado', texto: `${e.nombre} pasa a ${plan.nombre} desde hoy.` },
        error: { titulo: 'No se pudo cambiar el plan', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => { this.actualizada.emit({ id: e.id, planNombre: plan.nombre } as Partial<FilaEmpresa> & { id: number }); this.cargar(e.id); }, error: () => undefined });
  }

  // ── Recorrido de vida (franja bajo las pills) ─────────────────────────

  protected readonly vida = computed(() => {
    const e = this.empresa();
    const c = this.cuenta();
    const ini = new Date(e.creadoEn).getTime();
    const fin = Date.now();
    const total = Math.max(1, fin - ini);
    const pos = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - ini) / total) * 100));
    const activa = c?.suscripcion?.fechaInicio ?? null;
    const corte = e.estado !== 'activa' && !EN_ALTA.includes(e.estado) ? e.estadoCambiadoEn : null;
    const tramos: { left: number; ancho: number; color: string }[] = [];
    const finAlta = activa ? pos(activa) : 100;
    tramos.push({ left: 0, ancho: finAlta, color: '#f0b429' });
    if (activa) tramos.push({ left: finAlta, ancho: (corte ? pos(corte) : 100) - finAlta, color: '#303030' });
    if (corte) tramos.push({ left: pos(corte), ancho: 100 - pos(corte), color: '#d4d4d4' });
    const marcas = [{ left: 0, texto: 'Alta' }];
    if (activa) marcas.push({ left: finAlta, texto: 'Activa' });
    if (corte) marcas.push({ left: pos(corte), texto: this.estado().texto });
    return { tramos, marcas, desde: fmtY(e.creadoEn), hasta: 'Hoy' };
  });

  // ── Pestañas ──────────────────────────────────────────────────────────

  protected readonly pestanas = computed<PestanaHoja[]>(() => [
    { clave: 'resumen', texto: 'Resumen' },
    { clave: 'modulos', texto: 'Módulos', cuenta: this.modulos().length ? `${this.conAcceso()}/${this.modulos().length}` : null },
    { clave: 'actividad', texto: 'Actividad', cuenta: this.actividad().length || null },
  ]);

  protected elegirPestana(c: string): void {
    this.pestana.set(c as Pestana);
  }

  // ── Resumen ───────────────────────────────────────────────────────────

  protected readonly ahora = computed(() => {
    const e = this.empresa();
    const c = this.cuenta();
    if (e.estado === 'solicitud_recibida') return { icono: this.i.reloj, tinta: '#b45309', titulo: 'Llegó la solicitud', texto: `Se registró ${hace(e.creadoEn)}. Mandala a la cola para llamar al dueño.` };
    if (e.estado === 'pendiente') return { icono: this.i.telefono, tinta: '#b45309', titulo: 'Falta la llamada', texto: e.llamadaProgramadaPara ? `Agendada para el ${fmt(e.llamadaProgramadaPara)}.` : 'Está en la cola de Altas pendientes, sin agenda.' };
    if (e.estado === 'informacion_corroborada') return { icono: this.i.enlace, tinta: '#0094d5', titulo: 'Esperando al cliente', texto: 'Ya se llamó. Falta que abra el enlace y defina su contraseña.' };
    if (e.estado === 'activa' && e.acceso?.estado === 'en_mora') return { icono: this.i.alerta, tinta: '#d82c0d', titulo: 'En mora', texto: `Debe ${plata(c?.saldoPendiente ?? 0)}. Sigue operando dentro de la gracia.` };
    if (e.estado === 'activa' && e.acceso?.estado === 'bloqueada') return { icono: this.i.ban, tinta: '#d82c0d', titulo: 'Sin acceso', texto: e.acceso.motivo === 'sin_plan' ? 'No tiene una suscripción activa.' : 'La suscripción venció.' };
    if (e.estado === 'activa') return { icono: this.i.ok, tinta: '#087b5d', titulo: 'Operando con normalidad', texto: `Plan ${e.planNombre ?? '—'}${c?.cuotaMensual ? ` · ${plata(c.cuotaMensual.total)} por mes` : ''}.` };
    return { icono: this.i.pausa, tinta: '#6b7280', titulo: this.estado().texto, texto: e.motivoEstado ?? e.motivoRechazo ?? 'Sin motivo cargado.' };
  });

  protected readonly ciclo = computed(() => {
    const s = this.cuenta()?.suscripcion;
    if (!s?.fechaProximoVencimiento || !s.fechaInicio) return null;
    const venc = s.fechaProximoVencimiento;
    const d = dias(venc);
    const inicio = new Date(venc);
    inicio.setMonth(inicio.getMonth() - 1);
    const largo = Math.max(1, Math.round((new Date(venc).getTime() - inicio.getTime()) / 86_400_000));
    const pasados = largo - Math.max(0, d);
    const ultimo = this.cuenta()?.ultimoPago;
    return {
      grande: s.diasMora > 0 ? `${s.diasMora} días de mora` : d === 0 ? 'Vence hoy' : d < 0 ? `Venció hace ${pl(-d, 'día', 'días')}` : `Vence en ${pl(d, 'día', 'días')}`,
      chico: `el ${fmtY(venc)}`,
      tinta: s.diasMora > 0 ? '#d82c0d' : d <= 3 ? '#b45309' : '#111827',
      dias: Array.from({ length: largo }, (_, k) => (k < pasados - 1 ? '#303030' : k === pasados - 1 ? '#2be0d5' : '#ececec')),
      inicio: fmt(inicio.toISOString()),
      fin: fmt(venc),
      ultimo: ultimo ? `Último pago: ${plata(ultimo.monto)} el ${fmt(ultimo.fechaPago)}` : 'Sin pagos registrados',
    };
  });

  protected abrirPago(): void {
    const c = this.cuenta();
    this.formPago.set({ monto: String(c?.saldoPendiente || c?.cuotaMensual?.total || ''), ref: '', metodo: 'transferencia' });
  }

  protected registrarPago(): void {
    const f = this.formPago();
    const e = this.empresa();
    const monto = parseInt((f?.monto ?? '').replace(/\D/g, ''), 10) || 0;
    if (!f || !monto) return;
    this.formPago.set(null);
    this.alertas
      .seguir(this.facturacion.registrar({ empresaId: e.id, monto, fechaPago: new Date().toISOString(), metodo: f.metodo, referencia: f.ref.trim() || undefined }), {
        titulo: 'Registrando el pago', texto: `${e.nombre} · ${plata(monto)}`,
        exito: { titulo: 'Pago registrado', texto: `${e.nombre} · ${plata(monto)}` },
        error: { titulo: 'No se pudo registrar el pago', texto: 'Revisá los datos e intentá de nuevo.' },
      })
      .subscribe({ next: () => { this.cargar(e.id); this.recargar.emit(); }, error: () => this.formPago.set(f) });
  }

  protected parchePago(c: Partial<{ monto: string; ref: string; metodo: MetodoPago }>): void {
    this.formPago.update((f) => (f ? { ...f, ...c } : f));
  }

  /** Declarado en el registro vs. la cuenta real creada al terminar la llamada. */
  protected readonly duenio = computed(() => {
    const e = this.empresa();
    const real = this.detalle()?.duenoUsuario ?? null;
    const declarado = [e.duenoNombres, e.duenoApellidos].filter(Boolean).join(' ') || '—';
    const filas = [
      { dec: declarado, real: real ? `${real.nombres} ${real.apellidos}` : '—', igual: !!real && declarado.toLowerCase() === `${real.nombres} ${real.apellidos}`.toLowerCase() },
      { dec: e.duenoCorreo ?? '—', real: real?.correo ?? '—', igual: !!real && e.duenoCorreo?.toLowerCase() === real.correo.toLowerCase() },
    ];
    const veredicto = !real ? 'Todavía no hay cuenta real: se crea al terminar la llamada.' : filas.every((f) => f.igual) ? 'Coincide con lo declarado.' : 'Hay diferencias con lo declarado en el registro.';
    const checks = real
      ? [
          { ok: real.correoVerificado, texto: real.correoVerificado ? 'Correo verificado' : 'Correo sin verificar' },
          { ok: real.tieneContrasena, texto: real.tieneContrasena ? 'Definió su contraseña' : 'Falta que defina su contraseña' },
        ]
      : [];
    return { filas, veredicto, ok: !!real && filas.every((f) => f.igual), checks };
  });

  protected readonly campos = computed(() => {
    const e = this.empresa();
    const b = this.borrador();
    const valor = (k: 'correoContacto' | 'telefonoContacto' | 'rubro') => (b ? b[k] : (e[k] ?? ''));
    return [
      { clave: 'correoContacto' as const, etiqueta: 'Correo', valor: valor('correoContacto'), ph: 'correo@negocio.com', cambiado: !!b && b.correoContacto !== e.correoContacto },
      { clave: 'telefonoContacto' as const, etiqueta: 'Teléfono', valor: valor('telefonoContacto'), ph: '+57 300 000 0000', cambiado: !!b && b.telefonoContacto !== (e.telefonoContacto ?? '') },
      { clave: 'rubro' as const, etiqueta: 'Rubro', valor: valor('rubro'), ph: 'Rubro', cambiado: !!b && b.rubro !== (e.rubro ?? '') },
    ];
  });
  protected readonly nCambios = computed(() => this.campos().filter((c) => c.cambiado).length);

  protected editarCampo(clave: 'correoContacto' | 'telefonoContacto' | 'rubro', valor: string): void {
    const e = this.empresa();
    this.borrador.update((b) => ({ ...(b ?? { correoContacto: e.correoContacto, telefonoContacto: e.telefonoContacto ?? '', rubro: e.rubro ?? '' }), [clave]: valor }));
  }

  protected guardar(): void {
    const b = this.borrador();
    const e = this.empresa();
    if (!b) return;
    this.alertas
      .seguir(this.empresaService.actualizar(e.id, { correoContacto: b.correoContacto.trim(), telefonoContacto: b.telefonoContacto.trim(), rubro: b.rubro.trim() }), {
        titulo: 'Guardando cambios', texto: e.nombre,
        exito: { titulo: 'Cambios guardados', texto: pl(this.nCambios(), 'dato actualizado', 'datos actualizados') },
        error: { titulo: 'No se pudo guardar', texto: 'Revisá el correo y el teléfono.' },
      })
      .subscribe({ next: (x) => { this.borrador.set(null); this.actualizada.emit(x); }, error: () => undefined });
  }

  // ── Módulos ───────────────────────────────────────────────────────────

  protected readonly filasModulos = computed(() =>
    this.modulos().map((m) => ({
      ...m,
      tag: m.override ? (m.override.tipo === 'concedido' ? 'Extra' : 'Quitado') : null,
      tagFondo: m.override?.tipo === 'concedido' ? '#d9f7f5' : '#fde2dd',
      tagTinta: m.override?.tipo === 'concedido' ? '#00605b' : '#b42318',
      editando: this.modEditando()?.id === m.id,
    })),
  );

  /** El interruptor: si vuelve a lo del plan, quita la excepción (con
   *  Deshacer en la Pista); si se aparta, pide motivo inline. */
  protected alternarModulo(m: DesgloseModuloEmpresa): void {
    const nuevo = !m.efectivo;
    if (nuevo === m.desdePlan && m.override) return this.quitarExcepcion(m);
    this.modEditando.set({ id: m.id, motivo: '' });
  }

  protected confirmarModulo(m: DesgloseModuloEmpresa): void {
    const ed = this.modEditando();
    const e = this.empresa();
    if (!ed) return;
    const tipo = m.efectivo ? 'revocado' : 'concedido';
    this.modEditando.set(null);
    this.alertas
      .seguir(this.moduloService.gestionar(e.id, { moduloId: m.id, tipo, motivo: ed.motivo.trim() || undefined }), {
        titulo: tipo === 'concedido' ? 'Dando acceso' : 'Quitando acceso', texto: `${m.nombre} · ${e.nombre}`,
        exito: { titulo: tipo === 'concedido' ? 'Acceso concedido' : 'Acceso quitado', texto: m.nombre },
        error: { titulo: 'No se pudo cambiar el módulo', texto: 'Intentá de nuevo.' },
      })
      .subscribe({ next: () => this.recargarModulos(), error: () => undefined });
  }

  private quitarExcepcion(m: DesgloseModuloEmpresa): void {
    const e = this.empresa();
    const previa = m.override!;
    this.moduloService.quitar(e.id, m.id).subscribe({
      next: () => {
        this.recargarModulos();
        this.pista.hecho(`${m.nombre} vuelve a lo del plan`, () =>
          this.moduloService.gestionar(e.id, { moduloId: m.id, tipo: previa.tipo, motivo: previa.motivo ?? undefined }).subscribe(() => this.recargarModulos()),
        );
      },
      error: () => this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo quitar la excepción', texto: m.nombre }),
    });
  }

  private recargarModulos(): void {
    this.moduloService.listarDesglose(this.empresa().id).subscribe((xs) => this.modulos.set(xs));
  }

  protected parcheMod(motivo: string): void {
    this.modEditando.update((x) => (x ? { ...x, motivo } : x));
  }

  // ── Actividad ─────────────────────────────────────────────────────────

  /**
   * Historial completo desde el backend (2026-10-07, `GET /empresas/:id/actividad`):
   * todos los cambios de estado con quién y por qué, planes, pagos y
   * anulaciones, extras, módulos, solicitudes y datos editados. Antes se
   * armaba acá con lo cargado y solo se veía el último cambio de estado.
   */
  protected readonly actividad = signal<ActividadEmpresa[]>([]);

  /** Solo los filtros con algo adentro (más "Todo"). */
  protected readonly filtrosActividad = computed(() =>
    (
      [[null, 'Todo'], ['alta', 'Alta'], ['estado', 'Estado'], ['cobro', 'Cobros'], ['modulo', 'Módulos'], ['solicitud', 'Solicitudes'], ['datos', 'Datos']] as [TipoActividad | null, string][]
    )
      .map(([k, texto]) => ({ k, texto, n: k ? this.actividad().filter((x) => x.tipo === k).length : this.actividad().length }))
      .filter((x) => x.k === null || x.n > 0),
  );

  protected readonly actividadPorMes = computed(() => {
    const f = this.filtroActividad();
    const grupos = new Map<string, { dia: number; texto: string; quien: string | null; tipo: TipoActividad }[]>();
    this.actividad()
      .filter((x) => !f || x.tipo === f)
      .forEach((x) => {
        const d = new Date(x.fecha);
        const k = `${MES_LARGO[d.getMonth()]} ${d.getFullYear()}`;
        grupos.set(k, [...(grupos.get(k) ?? []), { dia: d.getDate(), texto: x.texto, quien: x.quien, tipo: x.tipo }]);
      });
    return [...grupos].map(([mes, items]) => ({ mes, items }));
  });

  protected readonly iconoActividad: Record<TipoActividad, typeof IconCheck> = {
    alta: IconUserCheck, estado: IconRefresh, cobro: IconReceipt2, modulo: IconPuzzle, solicitud: IconBulb, datos: IconPencil,
  };
}
