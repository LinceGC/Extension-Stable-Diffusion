# Mini Preview SD

Mini Preview SD es una extensión ligera para Stable Diffusion WebUI / Forge que añade una previsualización flotante interna de tipo Imagen en imagen para las imágenes generadas.

## Funciones

- Añade la opción **Imagen en imagen** al menú contextual al hacer clic derecho sobre imágenes de preview o galería.
- Añade un botón **Imagen en imagen** cerca de la zona de preview o galería cuando detecta una interfaz compatible.
- Abre un panel flotante interno con la imagen seleccionada o con la última imagen generada.
- Actualiza automáticamente el panel flotante cada vez que aparece una nueva preview o generación mientras **Seguir** está activado.
- Incluye botón de cerrar, cabecera arrastrable, panel redimensionable y guardado de posición/tamaño.

## Instalación

Clona o copia esta carpeta dentro del directorio `extensions` de Stable Diffusion WebUI y reinicia la interfaz.

```bash
git clone <url-de-este-repositorio> extensions/mini-preview-sd
```

## Uso

1. Genera o selecciona una imagen en la WebUI.
2. Pulsa **Imagen en imagen**, o haz clic derecho sobre una imagen generada y elige **Imagen en imagen**.
3. Mueve el panel flotante arrastrando su cabecera.
4. Cambia su tamaño desde el tirador de redimensión del navegador en la esquina inferior derecha.
5. Mantén **Seguir** activado si quieres que el panel se actualice automáticamente con cada nueva preview o generación.

## Notas

Esta extensión usa un panel flotante interno en vez de la API nativa de Picture-in-Picture para video del navegador. Esto permite trabajar con imágenes normales generadas por Stable Diffusion y evita limitaciones específicas de cada navegador.
