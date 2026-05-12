# Mini Preview SD

Mini Preview SD es una extensión ligera para Stable Diffusion WebUI / Forge que añade una previsualización **Picture-in-Picture nativa** para las imágenes generadas. Cuando el navegador no soporta Picture-in-Picture nativo para el método usado por la extensión, se usa un panel flotante interno como respaldo.

## Funciones

- Añade la opción **Imagen en imagen** al menú contextual al hacer clic derecho sobre imágenes de preview o galería.
- Añade un botón **Imagen en imagen** cerca de la zona de preview o galería cuando detecta una interfaz compatible.
- Abre la imagen en el Picture-in-Picture nativo del navegador usando un `canvas` convertido a `video`, para que la preview pueda seguir visible al cambiar de pestaña.
- Mantiene un panel flotante interno como fallback si el navegador bloquea o no soporta Picture-in-Picture nativo.
- Actualiza automáticamente la ventana Picture-in-Picture o el panel fallback cada vez que aparece una nueva preview o generación mientras **Seguir** está activado.
- En el fallback interno incluye botón de cerrar, cabecera arrastrable, panel redimensionable y guardado de posición/tamaño.

## Instalación

Clona o copia esta carpeta dentro del directorio `extensions` de Stable Diffusion WebUI y reinicia la interfaz.

```bash
git clone <url-de-este-repositorio> extensions/mini-preview-sd
```

## Uso

1. Genera o selecciona una imagen en la WebUI.
2. Pulsa **Imagen en imagen**, o haz clic derecho sobre una imagen generada y elige **Imagen en imagen**.
3. Si tu navegador soporta el modo nativo, la imagen aparecerá en una ventana Picture-in-Picture que puede mantenerse visible aunque cambies de pestaña.
4. Mantén **Seguir** activado si quieres que la ventana se actualice automáticamente con cada nueva preview o generación.
5. Si aparece el panel interno de respaldo, puedes moverlo arrastrando su cabecera y redimensionarlo desde la esquina inferior derecha.

## Notas

El modo principal usa la API nativa de Picture-in-Picture sobre un `video` generado desde un `canvas`, porque los navegadores no suelen permitir Picture-in-Picture directamente sobre etiquetas `img`. Chrome y Edge suelen soportar este flujo; otros navegadores pueden usar el panel interno de respaldo.
