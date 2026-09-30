// projects/staff/src/app/shared/ui/modulos/modulo-ui.ts
import { DesgloseModuloEmpresa } from '../../../core/catalog/models/modulo.model';

/**
 * Traducción visual del desglose de módulos — compartida por
 * `EmpresaDetallePanelComponent` (sección Módulos), `GestionarModulosPanelComponent`
 * (panel de Suscripciones) y la cabecera de ambos (la "huella").
 *
 * Tres posiciones posibles por módulo:
 *   0 = revocado (sin acceso aunque el plan lo traiga)
 *   1 = según plan (sin excepción)
 *   2 = concedido (con acceso aunque el plan no lo traiga)
 */
export type PosicionModulo = 0 | 1 | 2;

export interface EstadoModuloUi {
  texto: string;
  /** Clase de tinta del texto. */
  tinta: string;
  /** Clase de fondo del punto. */
  punto: string;
  /** Etiqueta corta (chip) + clases. */
  tag: string;
  tagClase: string;
  /** Clase de fondo de la barrita de la huella. */
  huella: string;
}

export function posicionDe(m: DesgloseModuloEmpresa): PosicionModulo {
  if (m.override?.tipo === 'concedido') return 2;
  if (m.override?.tipo === 'revocado') return 0;
  return 1;
}

export function estadoModulo(m: DesgloseModuloEmpresa): EstadoModuloUi {
  if (m.override?.tipo === 'concedido') {
    return {
      texto: m.desdePlan ? 'Extra · ya lo traía el plan' : 'Extra concedido',
      tinta: 'text-success-solid',
      punto: 'bg-success-solid',
      tag: 'Extra',
      tagClase: 'bg-badge-success-bg text-emerald-900',
      huella: 'bg-success-solid',
    };
  }
  if (m.override?.tipo === 'revocado') {
    return {
      texto: m.desdePlan ? 'Revocado · el plan lo incluye' : 'Revocado',
      tinta: 'text-badge-error-solid',
      punto: 'bg-badge-error-solid',
      tag: 'Revocado',
      tagClase: 'bg-field-error-bg text-badge-error-solid',
      huella: 'bg-badge-error-solid',
    };
  }
  if (m.desdePlan) {
    return {
      texto: 'Incluido en el plan',
      tinta: 'text-gray-700',
      punto: 'bg-gray-400',
      tag: 'Plan',
      tagClase: 'bg-badge-neutral-bg text-gray-700',
      huella: 'bg-primary-button',
    };
  }
  return {
    texto: 'No incluido',
    tinta: 'text-gray-400',
    punto: 'bg-gray-200',
    tag: '—',
    tagClase: 'text-gray-400',
    huella: 'bg-gray-200',
  };
}

/** Conteos para la barra de composición / las celdas de la cabecera. */
export function resumenModulos(modulos: DesgloseModuloEmpresa[]) {
  const total = modulos.length;
  const conAcceso = modulos.filter((m) => m.efectivo).length;
  const extras = modulos.filter((m) => m.override?.tipo === 'concedido').length;
  const revocados = modulos.filter((m) => m.override?.tipo === 'revocado').length;
  const delPlan = modulos.filter((m) => m.efectivo && !m.override).length;
  const excepciones = extras + revocados;
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  return {
    total,
    conAcceso,
    sinAcceso: total - conAcceso,
    extras,
    revocados,
    delPlan,
    excepciones,
    barra: [
      { ancho: pct(delPlan), clase: 'bg-primary-button' },
      { ancho: pct(extras), clase: 'bg-success-solid' },
      { ancho: pct(revocados), clase: 'bg-badge-error-solid' },
    ],
  };
}

/** Motivos sugeridos al conceder/revocar — chips de un toque. */
export const MOTIVOS_RAPIDOS: Record<'concedido' | 'revocado', string[]> = {
  concedido: ['Piloto pagado aparte', 'Cortesía comercial', 'Migración en curso'],
  revocado: ['Pago pendiente', 'Uso indebido', 'Pedido del cliente'],
};
