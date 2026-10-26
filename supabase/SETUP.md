# Configuración de Supabase

1. Crea un proyecto y ejecuta `schema.sql` desde SQL Editor.
2. En Authentication, habilita acceso por correo y contraseña. Habilita el registro para que pueda crearse la cuenta inicial y configura la confirmación de correo/SMTP si vas a usar invitaciones.
3. Define en Supabase Functions los secretos privados. El correo inicial debe ser el mismo que se usará en el primer registro:

```sh
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SERVICE_ROLE INITIAL_ADMIN_EMAIL=admin@tu-institucion.gob.ec
```

Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` en `supabase-config.js`, en el HTML ni en el navegador.

4. Despliega las funciones protegidas:

```sh
supabase functions deploy claim-admin-registration
supabase functions deploy invite-admin
supabase functions deploy manage-staff
```

5. Copia la URL del proyecto y la clave pública `anon` en `supabase-config.js`.
6. Abre la página, selecciona **Conectarse como administrador** y regístrate usando exactamente el correo de `INITIAL_ADMIN_EMAIL`. Confirma el correo si Supabase lo solicita; después vuelve e inicia sesión. El registro crea el primer perfil de administrador.
7. Ya en el panel, el admin puede fijar los cupos permitidos para nuevos administradores. Cada registro o invitación de admin consume un cupo. Con cero cupos, no se aceptan cuentas administrativas nuevas.
8. Desde **Personal de soporte**, el administrador puede crear cuentas con contraseña inicial, activar/desactivar sus cuentas y eliminarlas. Comparte la contraseña inicial por un canal seguro; al desactivar o eliminar una cuenta se liberan sus asignaciones de tickets.
9. Para probar la página local, sírvela por HTTP; no abras el HTML con `file://` porque usa módulos JavaScript.

Las políticas RLS protegen tickets, perfiles y cupos. El primer admin está limitado por `INITIAL_ADMIN_EMAIL`; las operaciones privilegiadas usan la clave privada solo dentro de Supabase Functions.
