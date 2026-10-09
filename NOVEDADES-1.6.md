# Tacos Enmascarados 1.6 — cocineros, inventario, estacionamiento y luces

## Cocineros (pestaña PERSONAL de la tienda)
Personajes normales (no luchadores), con gorro. **Cocinan solos**: se paran junto al comal, ven qué piden los clientes y qué se está acabando, y arrancan una tanda cuando hay lugar libre y alcanza el dinero (la tanda se paga de la caja, igual que si la cocinaras tú). No cocinan cuando falta poco para cerrar, para no tirar comida.

| Cocinero | Nivel | Precio | Sueldo | Qué hace |
|---|---|---|---|---|
| **Doña Chuy, la Cocinera** (pañuelo rojo) | 8 | $1,500 | **$100 por semana** | Comal y antojitos, tandas de hasta $60 (pastor, suadero, gordita, tripa, elote, tostada, quesadilla). Decide cada 2.6 s. Tiempo y costo normales |
| **Chef Ramiro** (gorro de chef) | 20 | $9,000 | **pago único** | Comal, antojitos y bebidas (tandas de hasta $150: todo menos el pozole). Decide cada 1.5 s; cocina **15 % más rápido** y gasta **8 % menos** |
| **Gran Chef Ibarra** (gorro altísimo) | 35 | $28,000 | **pago único** | Todo el menú. Decide cada 0.8 s; **30 % más rápido** y gasta **20 % menos** |

- El que cobra sueldo entra en la nómina semanal (se puede despedir con dos toques; si no alcanza el dinero, renuncia). Los de pago único ya no cuestan nada más.
- Primero cocinan lo que piden los clientes que esperan; si no, lo que tiene menos de 2 porciones y sí se vende. Con varios cocineros se reparten los lugares libres.

## Ampliar inventario: 10 escalones (antes 4)
| Lugares | Nivel | Precio |
|---|---|---|
| 6 | 5 | $600 |
| 7 | 10 | $2,500 |
| 8 | 16 | $4,500 |
| 9 | 22 | $7,000 |
| 10 | 30 | $9,000 |
| 12 | 38 | $15,000 |
| 14 | 50 | $25,000 |
| 16 | 58 | $38,000 |
| 18 | 64 | $50,000 |
| 20 | 70 | $60,000 |

(Los 6 nuevos son 6, 8, 9, 12, 16 y 18 lugares. Quien ya tenía 7, 10 o 14 sigue desde ahí.)

## Estacionamiento más grande y coches del tamaño de los personajes
- Cajones de 1.3 losetas, carril doble de 1.5 y fondo de 2.5: **5.2 × 4 losetas** (antes 4 × 3). Raya central, topes y tres postes de luz propios.
- Cuatro modelos de coche (sedán, hatchback, pickup y van) de ≈ 2 a 2.4 losetas de largo y 1 de ancho, casi tan altos como un luchador, con llantas, ventanas, defensas, faros y luces de freno. De noche los faros alumbran el piso.
- Como es más grande, puede asomar un poco por abajo o por la izquierda de la pantalla: acerca o mueve la cámara (o aléjala con el botón −).

## Luces de la calle y faroles
- De noche cada poste deja un **círculo de luz de verdad sobre el piso** (banqueta, calle, la gente que pasa y los coches), con un cono que baja desde el foco. Ya no es un resplandor flotando arriba.
- **Faroles nuevos** en TIENDA › OBRAS (nivel 6): hasta 6, a $300, $450, $650 (nivel 6) y $900, $1,300, $1,800 (nivel 16). Se plantan en la calle, junto a la banqueta, en modo EDITAR (a una loseta de distancia entre ellos).
- El estacionamiento trae tres postes propios que iluminan sus cajones.

## Revisión y pruebas
- 65 pruebas nuevas (cocineros: contratar, nivel, sueldos, cocinar solos, velocidad y costo, bebidas, dinero y cierre del día, guardar y cargar, dibujo; inventario; estacionamiento y coches; faroles: colocar, límites, guardar, noche) y todas las anteriores siguen en verde.
- Pruebas de "mono tecleando" con cocineros, faroles, inventario y la hora del día al azar: sin errores.
