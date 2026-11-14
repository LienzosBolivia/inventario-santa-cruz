# Asistencia acústica · inventario-santa-cruz

## Probar el piloto

- Aplicación existente: https://lienzosbolivia.github.io/inventario-santa-cruz/
- Piloto entre celulares: https://lienzosbolivia.github.io/inventario-santa-cruz/piloto/

El botón de la página principal abre el piloto. Todo el código del piloto está en `piloto/`; no requiere ChatGPT, paquetes, compilación ni servicios externos para la comunicación acústica.

En dos celulares: abrir el piloto con internet, esperar «Archivos listos para uso sin conexión», elegir un anfitrión y un participante con ID 1, usar la misma banda, activar audio en ambos e iniciar la prueba desde el anfitrión con la lista `1`. Empezar a un metro, volumen multimedia adecuado, sin auriculares y con las pantallas abiertas. Comprobar «Recibido» en anfitrión y «Asistencia confirmada» en participante. Repetir con datos y Wi-Fi apagados. Se pueden descargar CSV y diagnóstico JSON.

## Google Sheets / Apps Script

`Apps script.gs` y `db.js` se conservan sin cambios. La aplicación original en la raíz sigue usando el mismo contrato de padrón y envío de sesiones. No es necesario pegar código nuevo ni volver a implementar Apps Script por este piloto. No se verificó el despliegue real de Google porque su URL y permisos no se proporcionaron.

El piloto es independiente: guarda perfil y sesiones en el navegador y exporta CSV/JSON. Aún no registra usuarios en Google Sheets ni sincroniza sesiones. Tampoco retransmite IDs por celulares intermedios. Su objetivo es medir la comunicación directa POLL → REPLY → ACK sin internet. CRC detecta errores, no autentica identidades.

## Verificación

Ejecutar `node --test tests/*.test.mjs`. Más detalles del protocolo y límites en `piloto/README.md`. El service worker del piloto tiene alcance `piloto/`. El de la aplicación original conserva únicamente sus propias cachés y se actualizó para mostrar el nuevo acceso sin eliminar las del piloto.
