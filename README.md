# VINKI

Tu lienzo de ideas, links y notas. PWA hecha con React + Vite, conectada a Supabase.

## Requisitos

- Node.js 18 o superior
- Una cuenta de Supabase con el esquema de `vinki_schema.sql` ya aplicado

## Instalación

```bash
npm install
```

## Configuración

El archivo `.env` ya viene con la URL y la `anon key` del proyecto Supabase
`hvdwnqageoavegmauhqg`. Si en algún momento creás otro proyecto, copiá
`.env.example` a `.env` y completá tus propios valores:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

## Desarrollo

```bash
npm run dev
```

Abre la app en `http://localhost:5173`.

## Build de producción

```bash
npm run build
npm run preview
```

## Qué incluye este scaffold

- **`src/lib/supabaseClient.js`**: cliente de Supabase configurado con las
  variables de entorno.
- **`src/lib/useSession.js`**: hook que escucha el estado de autenticación.
- **`src/pages/Login.jsx`**: pantalla de login / registro con email y
  contraseña. Al registrarse, crea la fila correspondiente en la tabla
  `users` (con `auth_id` = id de auth y `name`).
- **`src/pages/Canvas.jsx`**: placeholder del lienzo principal, ya protegido
  por sesión.
- **`src/styles/global.css`**: paleta "papel viejo amarillo con puntos",
  tipografías Baloo 2 (display) y Nunito (cuerpo), y estilos base de
  formularios/tarjetas tipo nota pegada.
- **PWA**: configurado con `vite-plugin-pwa`, manifest e iconos básicos en
  `public/`.

## Próximos pasos sugeridos

1. Verificar en Supabase → Authentication que el método **Email** esté
   habilitado (y decidir si pedís confirmación de email o no).
2. Construir el lienzo real: tarjetas arrastrables (`cards`), límites de 5
   lienzos / 40 tarjetas, etc.
3. Implementar el modo VINKI-VINKI (`sessions` + `session_participants`) con
   Supabase Realtime para sincronizar cambios en vivo.
4. Implementar "Vrop It" (buffer rotativo de 15 ítems por conversación).
