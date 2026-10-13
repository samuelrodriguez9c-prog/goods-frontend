/**
 * Tienda pública de cada Empresa (Fase 0 de PROPUESTA_WHATSAPP.md): solo
 * habla con los endpoints públicos `GET/POST /api/tiendas/:slug…`, sin
 * sesión. Reemplazado por `environment.production.ts` en el build de
 * producción (angular.json, target `tienda`).
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  /** "Tienda creada con Goods": a dónde lleva el pie de página. */
  goodsUrl: 'http://localhost:4200/registro',
};
