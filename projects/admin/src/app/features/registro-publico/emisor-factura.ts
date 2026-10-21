
/**
 * Datos de Goods como emisor en la pre-factura del registro público.
 *
 * @remarks
 * Es la página pública que ven los prospectos: no puede salir a producción
 * con datos fiscales inventados.
 */
// TODO(backend): reemplazar por los datos reales de Goods (NIT con dígito de
// verificación, dirección, régimen de IVA y correo de facturación) y poner
// `deEjemplo: false`. Con la facturación electrónica, que vengan del backend.
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
