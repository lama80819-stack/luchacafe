# Lucha Café en Android y PC

Esta guía explica cómo el juego se adapta a cualquier pantalla (celulares Android de cualquier marca, plegables, tabletas, laptops, monitores ultra-anchos), cómo se controla con dedo, teclado + ratón o mando, cómo se compila y qué revisar antes de subirlo a Google Play.

> Tu plantilla de petición hablaba de Unity / Godot / C# (`#if`, `DisplayCutout` en C#…). Este juego es **HTML5 con canvas** y se empaqueta así:
> **Android** = Capacitor 8 (WebView) · **Windows** = Electron · **iPhone** = Capacitor 6. Abajo está el equivalente de cada punto.

## 1. Qué hay y dónde

| Pedido | Dónde está en este proyecto |
|---|---|
| Safe area, cámara perforada, muesca, barra de gestos | `www/js/game.js` → `safeInsets()` y `fit()` · `android-overlay/MainActivity.java` · `capacitor.config.json` (`plugins.SystemBars`) |
| Fondo borde a borde + interfaz segura | `fit()` (variables `CW, CH, EX, EY, SL, GL, GR`) · CSS `html.full …` en `www/css/style.css` |
| Relaciones 16:9, 16:10, 3:2, 19.5:9, 20:9, 21:9, 32:9, plegables | `fit()` se recalcula en **cada cuadro**: cambia al abrir/cerrar un plegable, girar, redimensionar la ventana o activar pantalla completa |
| Ventana redimensionable / pantalla completa sin bordes | `desktop/main.js` (Electron: F11, Alt+Enter, recuerda tamaño y posición) · en el navegador: tecla **F** o F11 · botón **Pantalla** en Ajustes |
| Calidad gráfica y tasa de refresco | Ajustes → **Calidad** (AUTO / ALTA / MEDIA / BAJA) y **Cuadros / seg** (AUTO / 60 / 30) · `Gfx` y `frame()` en `game.js` |
| Controles unificados (táctil, teclado + ratón, mando) | objeto `Input` en `game.js` |
| Compilar para Google Play | `.github/workflows/build-android.yml` + `android-overlay/` |
| Compilar para Windows | `.github/workflows/build-windows.yml` + `desktop/` |
| Compilar para iPhone | `.github/workflows/build-ipa.yml` (ver `GUIA-INSTALAR-EN-IPHONE.md`) |

## 2. Pantalla y cámara adaptable

### Cómo funciona (`fit()`, se ejecuta en cada cuadro)

1. **Modo completo.** El lienzo ocupa toda la ventana (`html.full`) cuando es celular o tableta, app nativa (Capacitor / Electron), pantalla completa del navegador o app instalada. En una ventana normal de PC se ve con marco y la guía de juego debajo.
2. **Márgenes seguros en vivo.** Se miden con `env(safe-area-inset-*)` (cámara perforada, muesca, Dynamic Island, barra de gestos). En Android, Capacitor además los deja en `--safe-area-inset-*` para WebViews antiguos. No hay lista de modelos.
3. **El diseño (960 × 600) se escala sin deformarse** para caber en el área segura y se centra: `escala = min(anchoSeguro / 960, altoSeguro / 600)`.
4. **FOV horizontal adaptable.** Lo que sobra a los lados (pantallas anchas) o arriba y abajo (pantallas altas, 4:3, plegable cuadrado) se rellena extendiendo el decorado: cielo, pasto, calle, público. Nada se estira.
5. **El HUD se ancla a los bordes seguros** pero nunca más allá de una proporción 2.4:1: en 32:9 los botones no quedan lejísimos del escenario.

```js
// Núcleo de fit() (game.js)
const sc = Math.min(sw / W, sh / H);                   // sw, sh = ventana menos márgenes seguros
CW = vw / sc; CH = vh / sc;                            // tamaño lógico del lienzo (más ancho o más alto que 960 x 600)
EX = (ins.l + (sw - W * sc) / 2) / sc;                 // esquina del diseño dentro del lienzo
EY = (ins.t + (sh - H * sc) / 2) / sc;
const side = (H * 2.4 - W) / 2;                        // tope del HUD (2.4:1)
GL = Math.min(side, Math.max(0, EX - SL));             // espacio útil a la izquierda / derecha para anclar el HUD
GR = Math.min(side, Math.max(0, CW - EX - W - ins.r / sc));
```

### Resultado según la pantalla

| Pantalla | Lienzo lógico | Qué se ve |
|---|---|---|
| 16:10 (1920×1200) | 960 × 600 | Exacto, sin bordes |
| 16:9 (1920×1080) | 1067 × 600 | Un poco más de decorado a los lados |
| 3:2 (laptop 1500×1000) | 960 × 640 | Un poco más arriba y abajo |
| 19.5:9 – 20:9 (celulares) | ~1300 × 600 | Más decorado a los lados; HUD en los bordes seguros |
| 21:9 (2560×1080) | 1422 × 600 | Igual, HUD dentro de 2.4:1 |
| 32:9 (3840×1080) | 2133 × 600 | Decorado extendido; HUD no se aleja más de 2.4:1 |
| Plegable abierto (casi cuadrado) | 960 × ~900 | Decorado arriba y abajo |

### Android nativo (`android-overlay/MainActivity.java`)

- `WindowCompat.setDecorFitsSystemWindows(window, false)` → edge-to-edge (obligatorio con Android 15+).
- `layoutInDisplayCutoutMode = ALWAYS` (Android 11+) / `SHORT_EDGES` (9–10): dibuja bajo la cámara perforada o la muesca.
- Barras del sistema ocultas con `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`: un deslizón desde el borde las muestra un momento, no cierra el juego.
- Pide el modo de pantalla de más Hz con la misma resolución (`preferredDisplayModeId`): 90 / 120 / 144 Hz.
- Botón y gesto **atrás** (incluido el predictivo de Android 14+): llama a `window.__onBack()`; el juego lo traduce a Esc, y en el menú principal cierra la app.
- Manifiesto (`patch_manifest.py`): `sensorLandscape`, `resizeableActivity="true"` (plegables y ventanas), `enableOnBackInvokedCallback="true"`, y `touchscreen`, `gamepad` y `screen.landscape` como **no obligatorios** (así también instala en Chromebooks y Android TV).
- Android 16 (API 36) en pantallas de 600 dp o más **ignora** los bloqueos de orientación: el juego ya se adapta porque `fit()` reacciona a cualquier tamaño.

### Windows (`desktop/main.js`)

- Ventana redimensionable (mínimo 640 × 400) que recuerda tamaño, posición y si estaba maximizada o en pantalla completa; si el monitor guardado ya no existe, vuelve al principal.
- **F11** o **Alt+Enter** = pantalla completa sin bordes (borderless). Chromium no ofrece "pantalla completa exclusiva" como los motores de PC; en Windows moderno la sin bordes tiene el mismo rendimiento.
- Tasa de refresco: el juego sigue al monitor (60 / 144 / 240 Hz). Ajustes → *Cuadros / seg* lo limita a 60 o 30 para ahorrar batería. Para pruebas sin límite ni V-Sync: ejecutar con la variable `LUCHA_SIN_LIMITE=1`.

### Calidad gráfica

- **AUTO** arranca en resolución interna 2× (1.5× si el equipo tiene ≤ 3 GB de RAM o ≤ 4 núcleos) y **baja sola** a 1.5× y a 1× si en dos tramos seguidos de 120 cuadros (unos 4 segundos cada uno) promedia menos de ~36 cuadros por segundo.
- ALTA = 2×, MEDIA = 1.5×, BAJA = 1×. La resolución nunca pasa de lo que la pantalla puede mostrar.

## 3. Controles unificados (`Input` en `game.js`)

El esquema activo cambia **en cuanto usas otro aparato** (también con un mando que se conecta a mitad de partida):

| Esquema | Cómo se activa | Qué cambia |
|---|---|---|
| **Táctil** | tocar la pantalla | botones con margen extra de toque, edición con dos toques, botones de zoom `+ − 1:1`, pellizco = zoom |
| **Teclado + ratón** | mover el ratón o pulsar una tecla | rueda = zoom, arrastrar = mover la cámara, `R` = girar, `+ − 0` = zoom, `F` / `Alt+Enter` = pantalla completa, `Esc` = ajustes |
| **Mando** (Xbox, PlayStation, genéricos con mapeo estándar) | pulsar un botón o mover un stick | cursor propio en pantalla, se ocultan los botones táctiles de zoom, aparece una chuleta de botones durante 8 s |

Mando: **stick izquierdo** = cursor · **A** = tocar · **B / Start** = atrás · **X** = girar mueble · **LB / RB** o gatillos = zoom · **stick derecho** = mover la cámara · **cruceta** = moverse por los menús (A = Enter) · **R3 / Select** = zoom 1:1. Un "drift" leve del stick no cambia el esquema.

Todo se traduce a las mismas funciones del puntero (`pointerDown/Move/Up`, `key`), así que el juego no sabe qué aparato se usa.

## 4. Configuración de compilación

### Android (Capacitor 8)

| Ajuste | Valor |
|---|---|
| `compileSdk` / `targetSdk` | **36** (Android 16): lo exige Google Play para apps nuevas y actualizaciones desde el 31 de agosto de 2026 |
| `minSdk` | 24 (Android 7.0) |
| Formato para Google Play | **Android App Bundle (.aab)**: `./gradlew bundleRelease` |
| Para probar en el celular | `app-debug.apk`: `./gradlew assembleDebug` |
| 64 bits | El juego **no tiene código nativo propio** (todo es JavaScript sobre el WebView del sistema, que ya es de 64 bits), así que el .aab cumple el requisito de 64 bits y el de páginas de 16 KB sin hacer nada |
| `versionCode` | `1000 + número de ejecución de GitHub` (sube solo en cada compilación) · `versionName` = 1.2.0 |
| Firma | Variables `ANDROID_KEYSTORE_PATH / _PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (el flujo las llena desde 4 secretos del repositorio) |
| Permisos | Solo `INTERNET` (Capacitor sirve el juego desde un servidor local interno; el juego no usa la red) |

**"Compilación condicional" (`#if` / `ifdef`).** En vez de directivas del compilador se separa por plataforma así:
- En el código: `IS_NATIVE` (Capacitor), `IS_ELECTRON` (Windows), `isFull()` (modo pantalla completa), `Input.mode` (táctil / ratón / mando). Ejemplo: el botón *Pantalla* de Ajustes se desactiva en Android porque ya es pantalla completa.
- En la compilación: cada plataforma tiene su flujo (`build-android.yml`, `build-windows.yml`, `build-ipa.yml`); el código nativo propio está solo en `android-overlay/` y `desktop/`. El juego (`www/`) es el mismo para las tres.

**APIs gráficas (Vulkan / OpenGL ES).** Esto lo decide Chromium dentro del WebView del teléfono (usa Vulkan o GLES según el equipo): una app no lo puede forzar. Lo que sí controlas es la **calidad** y los **cuadros por segundo** (Ajustes), y `hardwareAccelerated="true"` en el manifiesto. En Windows, Electron usa Direct3D (ANGLE) y se pide la GPU potente en laptops con dos tarjetas.

### Windows (Electron 44 + electron-builder)

- Genera `LuchaCafe-Setup-<versión>.exe` (instalador) y `LuchaCafe-Portable-<versión>.exe`, más la carpeta `win-unpacked` para Steam / itch.io.
- Seguridad: sin Node en la página, `contextIsolation`, `sandbox`, sin navegación ni ventanas nuevas, y política CSP (`default-src 'self'`).
- Sin firma digital: Windows SmartScreen avisará "editor desconocido". Para quitarlo hace falta un certificado de firma de código (de pago).

## 5. Subir a Google Play: paso a paso

1. **Cuenta de desarrollador** de Google Play (pago único de 25 USD) y verificación de identidad. Las cuentas personales nuevas deben hacer una **prueba cerrada** con testers antes de pasar a producción (hoy: 12 testers durante 14 días seguidos; confírmalo en Play Console porque Google ajusta la cifra).
2. **Decide el ID de la app** (`appId` en `capacitor.config.json`, ahora `com.tucafe.luchacafe`). **Es permanente**: no se puede cambiar después de la primera subida. Cámbialo antes (por ejemplo `com.acpproduccion.luchacafe`; en iPhone obligará a reinstalar con Sideloadly).
3. **Crea tu llave de subida** (una sola vez, guárdala y respáldala: sin ella no puedes actualizar la app):
   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   (`keytool` viene con Java / Android Studio.) Después, en PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | Set-Clipboard`
4. En GitHub: *Settings → Secrets and variables → Actions → New repository secret* y crea `ANDROID_KEYSTORE_B64` (lo copiado), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`) y `ANDROID_KEY_PASSWORD`.
5. Ejecuta el flujo **Compilar Android** (pestaña *Actions → Run workflow*) y descarga `app-release.aab` del artefacto `LuchaCafe-android`. Ya sale firmado.
6. En Play Console crea la app, activa **Play App Signing** (Google guarda la llave final; tú solo la de subida) y sube el `.aab` a *Prueba cerrada* primero.
7. Completa las secciones de abajo.

### Lista de verificación (compliance) antes de subir

**Técnico**
- [ ] `targetSdk` 36 y `compileSdk` 36 (viene así con Capacitor 8; el flujo muestra `targetSdkVersion` en el paso *Revisar el resultado*).
- [ ] Formato `.aab` firmado con la llave de subida; `versionCode` mayor que el anterior.
- [ ] 64 bits: sin bibliotecas nativas propias (cumple). Si algún día agregas un plugin con código nativo, incluye `arm64-v8a` y revisa la compatibilidad con páginas de 16 KB.
- [ ] Edge-to-edge (obligatorio con API 35+): `fit()` respeta los márgenes seguros. Probar en emulador con cámara perforada y con muesca.
- [ ] Gesto atrás predictivo: `enableOnBackInvokedCallback="true"` y `OnBackPressedDispatcher` (hecho).
- [ ] Pantallas grandes y plegables (API 36 ignora el bloqueo de orientación): probar el emulador "Resizable" y un plegable abierto, cerrado y a mitad.
- [ ] Informe previo al lanzamiento (*Pre-launch report*) de Play Console sin fallos; si puedes, prueba en dispositivos reales de Samsung, Motorola, Xiaomi y Oppo.

**Ficha y políticas**
- [ ] **Política de privacidad** con URL pública (hay un borrador en `PRIVACIDAD.md`; publícalo, por ejemplo con GitHub Pages, y pega la URL).
- [ ] **Seguridad de los datos** (Data safety): el juego no recopila ni comparte datos, no tiene cuentas, anuncios ni compras; la partida se guarda solo en el dispositivo (`localStorage`). Las tipografías van incluidas: la app no se conecta a Google Fonts.
- [ ] **Clasificación de contenido** (IARC): responde con sinceridad. El juego tiene **bebidas alcohólicas simuladas** (cervezas, micheladas) y **violencia caricaturesca** (llaves, sillazos de lucha libre); es probable una clasificación para adolescentes (PEGI 12 / Teen).
- [ ] **Público objetivo:** 13 años o más (no marcarlo para niños evita las reglas de Familias).
- [ ] Ficha: nombre, descripción corta (80) y larga, **ícono 512 × 512**, **gráfico de función 1024 × 500**, mínimo 2 capturas de teléfono (y capturas de tableta 7" y 10" recomendadas por la calidad en pantallas grandes).
- [ ] Declaraciones: sin permisos sensibles, sin anuncios, sin acceso a ubicación / cámara / micrófono. Marca el contenido de **copyright**: todo el arte, música y sonidos son propios (sintetizados por el juego).
- [ ] Si Google Play pide **acceso a la app**: no hay inicio de sesión.

## 6. Validación en dispositivos (qué probar)

**Android**
- [ ] Teléfono con **cámara perforada** central y con **cámara en una esquina**: HUD y botones no quedan bajo la cámara; el fondo llega hasta los bordes.
- [ ] Teléfono con **muesca** y con **barra de gestos**: primer deslizón desde abajo solo muestra la barra.
- [ ] Pantalla 16:9 clásica, 19.5:9 y 20:9+: sin deformar; decorado extendido a los lados.
- [ ] **Plegable**: abrir y cerrar con la partida en curso; el juego se reacomoda sin reiniciar. Dos paneles / pantalla dividida: tamaño pequeño y cambia en caliente.
- [ ] Pantalla de **90 / 120 Hz**: fluido; Ajustes → *Cuadros / seg* 60 reduce el consumo.
- [ ] Mando Bluetooth conectado a mitad de partida: aparece el cursor y la chuleta; al tocar la pantalla vuelve el modo táctil.
- [ ] Botón / gesto atrás: en partida abre Ajustes; en el menú principal sale.
- [ ] Sin internet: el juego se ve igual (tipografías incluidas).

**PC**
- [ ] Redimensionar la ventana de 640 × 400 a pantalla completa: sin deformar, el juego sigue en marcha.
- [ ] 16:9, 16:10, 3:2, ultra-ancho 21:9 y 32:9: el HUD queda cerca del escenario.
- [ ] F11, Alt+Enter, tecla F y botón *Pantalla* en Ajustes alternan pantalla completa; la ventana recuerda tamaño y posición al cerrarla.
- [ ] Mando Xbox o PlayStation: cursor, A, B, LB / RB, stick derecho.
- [ ] Monitor de 144 / 240 Hz: sigue al monitor; con *Cuadros / seg* en 60 o 30 se limita.

## 7. Lo que NO se puede (por ser un juego web empaquetado)

- **Pantalla completa exclusiva** como en motores de PC: Chromium solo ofrece pantalla completa sin bordes (equivalente en Windows moderno).
- **Elegir Vulkan u OpenGL ES** o la resolución interna del WebView: lo decide el sistema; se controla con la calidad y los cuadros por segundo.
- **"Sin límite" de cuadros con V-Sync opcional** en el celular: el WebView siempre sincroniza con la pantalla. En Windows solo con `LUCHA_SIN_LIMITE=1` (pruebas).
- Lo de Android y Windows se compila y se prueba en GitHub Actions; las pruebas en celulares y plegables reales las tienes que hacer tú (o con Firebase Test Lab).
