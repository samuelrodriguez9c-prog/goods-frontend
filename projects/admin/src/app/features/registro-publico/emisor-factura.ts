// projects/admin/src/app/features/registro-publico/emisor-factura.ts

/**
 * Datos de Goods como emisor en la pre-factura del registro público
 * (tirilla del aside, 2026-10-05).
 *
 * ⚠ DATOS DE EJEMPLO — reemplazar por los reales de Goods antes de salir a
 * producción (NIT con dígito de verificación, dirección, régimen de IVA y
 * correo de facturación). Es la página pública que ven los prospectos: no
 * puede quedar con datos fiscales inventados. Pendiente anotado en
 * `backend/MODULOS_PENDIENTES.md` (Preparación para producción).
 *
 * Cuando exista la facturación electrónica (punto 6 de ese documento),
 * conviene que estos datos vengan del backend (la misma fuente que use la
 * factura) en vez de vivir acá.
 */
export const EMISOR_FACTURA = {
  marca: 'GOODS',
  razonSocial: 'Goods S.A.S.',
  nit: '901.000.000-1',
  regimen: 'Responsable de IVA',
  direccion: 'Calle 100 # 0-00',
  ciudad: 'Bogotá D.C.',
  correo: 'facturacion@goods.example',
  /** `true` mientras los datos de arriba sean de ejemplo. */
  deEjemplo: true,
} as const;
