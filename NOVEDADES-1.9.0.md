# Tacos Enmascarados 1.9.0 — la Arena y los exteriores bien sólidos

## Exteriores de casas y negocios (el bug de "transparente")
- **Causa encontrada**: el zócalo (la base) de cada edificio se dibujaba con su "tapa" a la altura de la banqueta y esa tapa pintaba el color del piso **encima de las paredes**. Por eso casi toda la pared se veía gris y "transparente". Ya no pasa: el zócalo se dibuja solo con sus caras.
- Todos los edificios se rehicieron con detalle, como tus imágenes de referencia:
  - **Boutique**: ladrillo rosa, pilastres de piedra, toldos de rayas con festón, jardineras con flores, aparadores con vestidos, letrero, piso de ladrillo y macetas.
  - **Tienda de muebles**: paredes de tablón con base de piedra, ventanales con camas, sillones y mesas adentro, letrero grande "TIENDA MUEBLES", toldo verde, luces, y afuera un sillón y cajas sobre una plancha de concreto.
  - **Taquería**: pared amarilla con base de ladrillo, ventanas con menú, toldo rojo (dice ABIERTO/CERRADO según tu local) y la franja de colores.
  - **Cine**: fachada violeta con pilastres dorados, carteles de películas, marquesina con foquitos y letrero de neón.
  - Azoteas con borde (parapeto) hacia adentro, aparatos de aire con tubería, rejillas y tragaluz.
- **Casas**: paredes de madera con base de ladrillo, techo con tejas y fascia blanca, canalón, chimenea de ladrillo, ventanas con jardineras de flores, **porche con escalones, barandal y techito**, jardineras con flores, **cerca blanca de madera** a lo largo del caminito y el letrero rojo de SE VENDE con precio y nivel.

## Cajeros detrás del mostrador
- En el cine, la tienda de muebles, la boutique y la arena, el cajero ya se para **detrás** del mostrador (antes quedaba encima). El mostrador se corrió una loseta hacia dentro.

## Comales y parrillas
- Los comales y parrillas **girados** (los que van contra la pared izquierda) tenían los lugares de cocción fuera del mueble. Ya caen encima del mueble, sin salirse.

## NUEVO: Arena Enmascarada
- Está al final de la avenida, al este (más allá de la tienda de muebles). Afuera es grande y llamativa: pared roja con ladrillo, pilastres dorados, gran tablero "ARENA ENMASCARADA", marquesina con foquitos, banderas con máscaras, carteles, reflectores y una máscara gigante en el techo.
- Adentro: **gradas con unas 30 personas** (animadas, levantan los brazos cuando hay emoción), **cuadrilátero** con lona, cuerdas, postes y focos, bocinas, banderas y pancartas.
- **Boleto**: se compra en la taquilla junto a la puerta ($80 + $4 por nivel). Sin boleto solo se pasa al vestíbulo, detrás de las cuerdas de terciopelo.
- **La función**: leyendas (Rayo Azul, Oro Ardiente, Noche Negra, Tigre Dorado, La Catrina, Cosmos) pelean con árbitro: se estudian, llave, lanzamiento por los aires, vuelo desde la esquina, conteo "UNO, DOS, TRES" y festejo del ganador. Cada ronda trae otros luchadores y suena la campana, el azotón y la ovación.
- Toca un lugar de las gradas, sube a tu escalón y mira la función: recuperas **50 % de energía**, ganas experiencia y a veces una **gema**. Máximo **2 funciones al día** (después puedes mirar sin premio).
- Como los demás negocios, la arena cierra a las 11 PM.
- Para llegar caminando el pueblo es más ancho: la avenida sigue hasta el este.

## Revisión y pruebas
- 30 pruebas nuevas (ninguna caja baja tapa una pared, cajeros, comales girados, la arena completa: boleto, gradas, función, premio, límite diario, cierre nocturno, 400 posiciones de luchadores) y todas las anteriores siguen en verde (h14–h34, "mono tecleando" con 8 semillas).
