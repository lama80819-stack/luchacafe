#!/usr/bin/env bash
# Aplica la personalización de Lucha Café al proyecto de Android que genera "npx cap add android".
# Uso (desde la raíz del repositorio): VERSION_CODE=12 VERSION_NAME=1.2.0 bash android-overlay/apply.sh
set -euo pipefail

APP=android/app
APPID=$(node -p "require('./capacitor.config.json').appId")
JAVA_DIR="$APP/src/main/java/$(echo "$APPID" | tr . /)"
[ -d "$JAVA_DIR" ] || { echo "No existe $JAVA_DIR"; exit 1; }

# 1. Actividad principal (pantalla completa, inmersivo, alta tasa de refresco, botón atrás)
cp android-overlay/MainActivity.java "$JAVA_DIR/MainActivity.java"
sed -i "s/^package .*;/package ${APPID};/" "$JAVA_DIR/MainActivity.java"

# 2. Íconos (adaptable + redondo + antiguos) y color de fondo del ícono adaptable
cp -R android-overlay/res/. "$APP/src/main/res/"
mkdir -p "$APP/src/main/res/mipmap-anydpi-v26" "$APP/src/main/res/values"
for n in ic_launcher ic_launcher_round; do
cat > "$APP/src/main/res/mipmap-anydpi-v26/$n.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
done
cat > "$APP/src/main/res/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0D0720</color>
</resources>
XML

# 3. Manifiesto
python3 android-overlay/patch_manifest.py "$APP/src/main/AndroidManifest.xml"

# 4. Versión (versionCode debe subir en cada subida a Google Play) y firma
sed -i "s/versionCode 1/versionCode ${VERSION_CODE:-1}/; s/versionName \"1.0\"/versionName \"${VERSION_NAME:-1.0}\"/" "$APP/build.gradle"
cp android-overlay/signing.gradle "$APP/signing.gradle"
echo "apply from: 'signing.gradle'" >> "$APP/build.gradle"
grep -n "versionCode\|versionName\|signing.gradle" "$APP/build.gradle"
echo "Proyecto Android personalizado."
