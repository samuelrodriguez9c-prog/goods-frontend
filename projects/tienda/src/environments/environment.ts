/**
 * Solo habla con los endpoints públicos `GET/POST /api/tiendas/:slug…`, sin
 * sesión. En el build de producción se reemplaza por `environment.production.ts`.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  /** Enlaces a Goods: «Crear mi tienda gratis» y «Tienda creada con Goods» llevan al registro. */
  goodsRegistro: 'http://localhost:4200/registro',
  goodsInicio: 'http://localhost:4200/',
  goodsLogin: 'http://localhost:4200/login',
};
