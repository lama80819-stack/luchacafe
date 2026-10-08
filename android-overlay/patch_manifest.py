#!/usr/bin/env python3
"""Ajusta el AndroidManifest.xml que genera Capacitor: horizontal, redimensionable (plegables / ventanas), mando opcional, gesto atrás moderno."""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    if old not in s:
        sys.exit("No se encontró en el manifiesto: " + old)
    s = s.replace(old, new, count)


# Actividad: horizontal por sensor (en pantallas grandes de Android 16 el sistema lo ignora y la app se adapta), redimensionable y con gesto "atrás" predictivo
rep(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"\n'
    '            android:screenOrientation="sensorLandscape"\n'
    '            android:resizeableActivity="true"\n'
    '            android:hardwareAccelerated="true"\n'
    '            android:enableOnBackInvokedCallback="true"',
)

# Características de hardware: el juego se puede jugar sin pantalla táctil (ratón / mando en Chromebook, Android TV o PC) y con mando
features = (
    '\n    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />'
    '\n    <uses-feature android:name="android.hardware.gamepad" android:required="false" />'
    '\n    <uses-feature android:name="android.hardware.screen.landscape" android:required="false" />\n'
)
i = s.index("<manifest")
j = s.index(">", i) + 1
s = s[:j] + features + s[j:]

open(path, "w", encoding="utf-8").write(s)
print("manifiesto listo")
