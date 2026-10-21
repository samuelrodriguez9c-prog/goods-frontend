/**
 * Environment de producción. `socketUrl` va sin `/api` (ver `environment.ts`).
 */
// TODO(infra): reemplazar los dominios de ejemplo por los del despliegue real.
export const environment = {
  production: true,
  apiUrl: 'https://api.goods.example.com/api',
  socketUrl: 'https://api.goods.example.com',
  registroPublicoUrl: 'https://app.goods.example.com/registro',
};
