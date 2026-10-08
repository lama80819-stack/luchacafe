package com.tucafe.luchacafe;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Actividad principal de Lucha Café (Android).
 * - Pantalla completa "edge to edge": el juego dibuja bajo la cámara perforada / muesca y las barras del sistema.
 *   Los márgenes seguros los publica Capacitor (SystemBars) como env(safe-area-inset-*) y --safe-area-inset-*; el juego los lee en fit().
 * - Modo inmersivo: barras ocultas; un deslizón desde el borde las muestra un momento (no cierra el juego).
 * - Pide a Android la tasa de refresco más alta de la pantalla (90 / 120 / 144 Hz).
 * - Botón / gesto "atrás" (incluido el gesto predictivo de Android 14+): se le pasa al juego (Esc); en el menú principal cierra la app.
 * Este archivo lo copia android-overlay/apply.sh sobre el proyecto que genera Capacitor.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        useDisplayCutout();
        preferHighRefreshRate();
        hideSystemBars();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    finish();
                    return;
                }
                bridge.getWebView().evaluateJavascript(
                    "(function(){try{return window.__onBack?window.__onBack():false}catch(e){return false}})()",
                    value -> {
                        if (!"true".equals(value)) {
                            finish();   // el juego no tenía nada que cerrar (menú principal): salir de la app
                        }
                    }
                );
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    /** Dibujar también bajo la cámara perforada o la muesca (en horizontal quedan a los lados). */
    private void useDisplayCutout() {
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                getWindow().setAttributes(lp);
            }
        } catch (Throwable ignored) {
        }
    }

    /** Barras del sistema ocultas (inmersivo); reaparecen un momento al deslizar desde el borde. */
    private void hideSystemBars() {
        try {
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            c.hide(WindowInsetsCompat.Type.systemBars());
        } catch (Throwable ignored) {
        }
    }

    /** Elige el modo de pantalla con más Hz que conserve la misma resolución. */
    private void preferHighRefreshRate() {
        try {
            Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (d == null) {
                return;
            }
            Display.Mode cur = d.getMode();
            Display.Mode best = cur;
            for (Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() == cur.getPhysicalWidth()
                    && m.getPhysicalHeight() == cur.getPhysicalHeight()
                    && m.getRefreshRate() > best.getRefreshRate()) {
                    best = m;
                }
            }
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.preferredDisplayModeId = best.getModeId();
            getWindow().setAttributes(lp);
        } catch (Throwable ignored) {
        }
    }
}
