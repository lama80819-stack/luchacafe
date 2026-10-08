# Lucha Café en tu iPhone (desde Windows)

## Qué hay en esta carpeta

| Archivo / carpeta | Para qué sirve |
|---|---|
| `www/index.html`, `www/css/style.css`, `www/js/game.js` | El juego (HTML + CSS + JS, sin librerías) |
| `config.xml` | Nombre, ID, horizontal fijo, pantalla completa (para VoltBuilder / Cordova) |
| `voltbuilder.json` | Plataforma para VoltBuilder (`ios`) |
| `icon.png` (1024), `splash.png` (2732) | Ícono y pantalla de arranque originales |
| `res/ios/` | Todos los tamaños de ícono ya generados |
| `package.json`, `capacitor.config.json`, `.github/workflows/build-ipa.yml` | Ruta B: compilar gratis en un Mac de GitHub |

- Nombre de la app: **Lucha Café**
- Bundle ID: **com.tucafe.luchacafe** (los IDs no admiten acentos: por eso no es `com.tucafé…`; cámbialo por uno tuyo, p. ej. `com.tunombre.luchacafe`, en `config.xml` y `capacitor.config.json`)
- Orientación: solo horizontal · Pantalla completa: sí (barra de estado oculta)

## Íconos (ya están en `res/ios/`)

Todos son PNG **sin transparencia**. Si quieres otro diseño, solo cambia `icon-1024.png` y vuelve a exportar los demás tamaños.

| Archivo | Tamaño px |
|---|---|
| icon-1024.png (App Store / base) | 1024 × 1024 |
| icon-60@3x.png · icon-60@2x.png | 180 · 120 |
| icon-83.5@2x.png (iPad Pro) | 167 |
| icon-76@2x.png · icon-76.png (iPad) | 152 · 76 |
| icon-40@3x · @2x · 1x (Spotlight) | 120 · 80 · 40 |
| icon-29@3x · @2x · 1x (Ajustes) | 87 · 58 · 29 |
| icon-20@3x · @2x · 1x (Notificaciones) | 60 · 40 · 20 |
| splash.png (pantalla de arranque) | 2732 × 2732 |

## Importante antes de elegir ruta

Un iPhone solo instala apps **firmadas**. Sideloadly firma por ti con tu Apple ID gratuito, pero para eso necesita un `.ipa` sin firmar o firmado con cualquier cosa.
**VoltBuilder pide tus certificados de Apple (cuenta de desarrollador de pago) para compilar iOS**, así que con una cuenta gratuita probablemente no te entregue el `.ipa`. Por eso incluyo una **Ruta B** que sí es gratis de punta a punta. Ninguna de las dos rutas pude probarla desde aquí (no hay Mac ni cuenta de VoltBuilder en esta máquina).

## Ruta A · VoltBuilder (si tienes certificado de Apple)

1. Selecciona dentro de esta carpeta: `www`, `res`, `config.xml`, `voltbuilder.json`, `icon.png`, `splash.png` → clic derecho → *Enviar a → Carpeta comprimida (en zip)*.
   (Ya te dejé listo `luchacafe-voltbuilder.zip` con eso.) `config.xml` debe quedar en la **raíz** del zip.
2. Entra a voltbuilder.com → crea cuenta → *Build* → sube el zip → plataforma iOS.
3. Sube tu certificado (`.p12`), su contraseña y el perfil (`.mobileprovision`) cuando lo pida. Revisa en su documentación el formato exacto de `voltbuilder.json` para firmar: el que incluyo solo indica `"platform": "ios"`.
4. Descarga el `.ipa` y pasa al paso Sideloadly.

## Ruta B · GitHub Actions (gratis, sin Mac ni pago)

1. Crea una cuenta en github.com y un repositorio nuevo **público** (los Mac son gratis en repos públicos).
2. Sube **todo el contenido** de esta carpeta (incluida `.github`; si arrastras en la web, activa "archivos ocultos" o usa GitHub Desktop).
3. Pestaña **Actions** → *Compilar IPA (sin firmar)* → **Run workflow**. Tarda unos 10–15 min.
4. Al terminar, abre la ejecución → **Artifacts** → descarga `LuchaCafe-ipa` (zip con `LuchaCafe.ipa`) y descomprímelo.
   Si falla, copia el error del paso que se puso rojo y dímelo para ajustarlo.

## Sideloadly en Windows

1. Instala **iTunes** y **iCloud** desde apple.com (no las versiones de Microsoft Store) y **Sideloadly** desde sideloadly.io.
2. En el iPhone (iOS 16 o más): *Ajustes → Privacidad y seguridad → Modo de desarrollador* → activar y reiniciar.
3. Conecta el iPhone con el cable, desbloquéalo y toca **Confiar**.
4. Abre Sideloadly → arrastra `LuchaCafe.ipa` → escribe tu **Apple ID** → *Start* (puede pedir contraseña o contraseña de app).
5. En el iPhone: *Ajustes → General → VPN y administración de dispositivos* → tu Apple ID → **Confiar**.
6. Abre **Lucha Café**. Con Apple ID gratuito la app caduca a los **7 días**: vuelve a instalar con Sideloadly (tu partida se conserva si no desinstalas la app) y hay un máximo de 3 apps.

## Notas del código

- Los toques usan *Pointer Events*, que en iOS 13+ cubren dedo y lápiz **sin retraso de 300 ms**. Además se bloquean zoom por pellizco, doble toque, rebote y selección (`touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `gesturestart` y `touchmove` cancelados).
- El lienzo siempre se ajusta al área segura (`viewport-fit=cover` + `env(safe-area-inset-*)`), así que el notch o la Dynamic Island no tapan el HUD.
- La tipografía viene de Google Fonts; sin internet se usan tipos de respaldo (el juego funciona igual).
- Las partidas se guardan en el almacenamiento local de la app.
