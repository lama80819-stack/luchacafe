# Tacos Enmascarados 1.5 — manos y obras

## Manos (cuadros de carga)
Abajo, en medio de la pantalla, hay una barra con **cuadros de manos**. Cada cuadro carga **un platillo**: así, si agarras una quesadilla y ya nadie la quiere, no tienes que regresarla a la barra; la dejas en su cuadro, cambias a otro cuadro y atiendes lo que te piden.

| Mano | Nivel | Precio |
|---|---|---|
| Primera | desde el inicio | gratis |
| Segunda | 4 | $400 |
| Tercera | 12 | $2,000 |
| Cuarta | 22 | $7,000 |

- Los cuadros bloqueados muestran un candado con el nivel que falta; al llegar al nivel muestran el precio y, al tocarlos, abren la tienda en **OBRAS**.
- **Cambiar de mano:** tocar el cuadro, teclas **1 a 4**, tecla **Tab** (siguiente mano) o botón **Y** del mando.
- **Tocar un cliente:** si alguna de tus manos ya lleva lo que pidió, el Novato cambia solo a esa mano y se lo sirve. Si no lo lleva y tienes una mano libre, va por el pedido a la barra **sin soltar** lo que ya cargas.
- **Tocar la barra:** con la mano libre agarra el platillo; si la mano elegida ya lleva algo y hay otra mano libre, lo agarra con la otra. Con todas las manos llenas devuelve a la barra lo que lleva la mano elegida.
- **Devolver a propósito:** tocar el cuadro de la mano elegida (con platillo) lo regresa a la barra.
- Cada mañana las manos amanecen vacías. Al guardar la partida, lo que llevas en las manos **no se pierde** (vuelve a contar en la barra).
- Con una sola mano todo funciona como antes.
- La barra se esconde en la tienda, el modo EDITAR, las ventanas y el tutorial. La pista de abajo sube y se corre a la derecha de los botones de zoom para no taparla.

## OBRAS
- La pestaña **OBRAS** de la tienda ahora abre en el nivel **4** (antes, nivel 15).
- Ahí están, en este orden: **Ampliar inventario**, **Segunda / Tercera / Cuarta mano**, **Estacionamiento**, **Remodelar Changarro** y **Mega Ampliación: Arena**. El inventario y el estacionamiento ya no aparecen en MUEBLES.

## Revisión y pruebas
- 54 pruebas nuevas de las manos (compra por nivel y dinero, cambio de mano, servir con la mano correcta, manos llenas, devolver, teclado, toques, ocultar la barra, día nuevo, guardar y cargar, dibujo) y todas las anteriores siguen en verde.
- Las pruebas de "mono tecleando" ahora también compran manos y cambian de mano al azar, con revisiones de que el estado de las manos nunca queda raro.
