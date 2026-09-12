# Frontend — Goods Admin

Admin de e-commerce (Angular workspace) para **Goods**, calcado
visualmente de Shopify Admin sobre datos y flujos propios. Hoy contiene
un único proyecto Angular, `admin`; el día que exista una tienda
pública para clientes se suma como una segunda app (`tienda`) dentro
del mismo workspace, reusando una librería de componentes compartida.

Ver **[`ADMIN_DISENO.md`](./ADMIN_DISENO.md)** para el detalle completo:
tokens de diseño extraídos de las capturas de Shopify, qué compara
contra qué captura, y las decisiones técnicas tomadas a medida que se
construyó cada composite (por qué `p-table` no se puede envolver en un
componente propio, por qué `SelectionCheckboxComponent` es manual, la
estructura de carpetas de `features/`/`core`/`layout`/`shared`, etc.).
Es el documento de referencia de este repo — no un README aparte que se
desactualiza.

## Stack

- **Angular 21** (standalone components, signals — sin `NgModule`).
- **PrimeNG 21** con `theme: 'none'` — solo se usa por comportamiento
  (overlays, positioning, accesibilidad), el estilo visual completo es
  Tailwind vía la API `pt` (pass-through) de PrimeNG.
- **Tailwind CSS v4** — tokens de diseño como bloque `@theme` en
  `projects/admin/src/styles.css`, calcados con pipeta de las capturas
  reales de Shopify (ver `ADMIN_DISENO.md`).
- **npm** como gestor de paquetes (usar `--legacy-peer-deps` al instalar
  — ver nota abajo).

## Arrancar en desarrollo

```bash
npm install --legacy-peer-deps
ng serve admin
```

Abrir `http://localhost:4200`.

> El flag `--legacy-peer-deps` hace falta por un conflicto de peers de
> `vitest` al instalar, no por PrimeNG — hay que repetirlo en cada
> instalación nueva de paquetes en este proyecto.

## Estructura

```
projects/admin/src/app/
├── core/                # servicios singleton de toda la app (auth/http/layout state)
├── layout/               # el shell: shell/ (topbar+sidebar+router-outlet), sidebar/, topbar/
├── features/             # una carpeta por área de negocio (dashboard, orders, products, customers)
│   └── <feature>/         # pages/ (atadas a ruta) + components/ + services/ + models/
├── shared/
│   ├── ui/                 # composites propios: status-badge, data-table, order-line-item, quick-adjust-popover
│   ├── utils/               # funciones puras cross-feature (ej. formatMoney)
│   └── models/               # tipos genéricos cross-feature
├── app.routes.ts           # lazy-load de cada features/*/*.routes.ts, bajo el shell
└── app.ts / app.html        # `<router-outlet />` — el layout real vive en layout/shell
```

`features/dev-showcase` (ruta `/dev`, fuera del sidebar) no es una
pantalla de negocio — es donde se comparan los composites de
`shared/ui/` contra las capturas de Shopify antes de darlos por
buenos. Se mantiene aparte para no ensuciar el shell real.

Más contexto de cada decisión de estructura (por qué en inglés, por qué
`shared/ui` no es todavía una librería Angular separada, etc.) está en
`ADMIN_DISENO.md`.

## Build

```bash
ng build admin
```

## Tests

```bash
ng test admin
```

## Flujo de ramas

Repo privado, GitHub Flow:

- `main` siempre queda en un estado andante (`ng build admin` sin errores).
- Todo cambio va en una rama nueva desde `main`, nombrada `Gds.<número>`
  (ej. `Gds.001`, `Gds.002`) — un correlativo propio y **compartido
  entre este repo y `goods-backend`** (un solo contador para los dos,
  no uno por repo). Reemplaza al esquema anterior (`feature/<algo>`/
  `fix/<algo>`): no hay Issues de GitHub en uso todavía como para
  numerar contra eso, así que el número es simplemente el siguiente
  disponible del contador compartido. El nombre de la rama **ya no dice
  de qué se trata ni si es feature o fix** — esa información vive
  entera en el commit/PR (ver el punto siguiente), nunca en el nombre
  de la rama. Ramas creadas antes de este cambio (`feature/algo`) no se
  renombran retroactivamente.
- Commits con prefijo de tipo — `feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:` — ayuda a que el historial de `main` se lea como una
  lista de cambios, aunque no haya changelog automático todavía.
- Al terminar: Pull Request a `main`. Revisar el diff (aunque sea de uno
  mismo), mergear con **squash** para que cada feature quede como un
  commit en `main`, borrar la rama.
- Repo hermano: [`goods-backend`](../goods-backend) (NestJS + PostgreSQL).
