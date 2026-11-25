# Desafíos 侍 — Cómo usar

Tu app: **https://santei-pixel.github.io/App-desafios/**

---

## 1. Instalarla en el iPhone

1. Abrí **Safari** (tiene que ser Safari, no Chrome) y entrá al link de arriba.
2. Tocá el botón **Compartir** (el cuadrado con una flecha para arriba, abajo en el centro o arriba a la derecha).
3. Bajá y tocá **"Agregar a pantalla de inicio"**.
4. Dejá el nombre "Desafíos" y tocá **Agregar**.
5. Listo: aparece el ícono (sol rojo con una katana). **Usala siempre desde ese ícono**, no desde Safari: son dos "cajones" de datos distintos.

### Comprobar que funciona sin internet
1. Abrí la app desde el ícono y esperá unos segundos (en la primera carga guarda todo).
2. Cerrala del todo (deslizá desde abajo y empujala para arriba).
3. Activá el **modo avión**.
4. Abrila de nuevo: tiene que funcionar igual. Marcá un día de prueba y desmarcalo.
5. Sacá el modo avión.

---

## 2. Cómo se juega

- **Desafíos**: activá los que quieras con el interruptor. Al activarlos podés cambiar la meta en días. Con ↑ ↓ cambiás el orden.
  Si desactivás uno, su historial queda guardado.
- **Hoy**: tocá el círculo grande para marcar el día. Arriba podés elegir **Hoy** o **Ayer** (más atrás no se puede, para que el juego sea honesto). Tocá de nuevo para desmarcar. **✎ Nota** guarda una línea por día.
- **Seiza**: "Empezar 5:00" pone la pantalla en negro; al terminar suena una campana y el día se marca solo. Si salís de la app, el tiempo sigue contando y se marca cuando volvés.
- **Ola de 90 s**: usala las veces que quieras; el día cuenta con un uso.
- **Ganbaru**: marcá cada día que avanzás. Cuando lo termines, tocá **完 Terminado** (+1.500 ki). Después podés empezar otro proyecto.
- **Shugyo**: regla estricta. Si pasa un día entero sin marcarlo (ni hoy ni como "ayer"), el contador vuelve a 0. Tus medallas y tu récord no se pierden.

### Ki (puntos)
| Dificultad | Ki por día | Multiplicador de hitos |
|---|---|---|
| Baja | 10 | ×1 |
| Media | 20 | ×2 |
| Alta | 30 | ×3 |

- **Bonus de racha**: +5 % cada 7 días seguidos (día 7: +5 %, día 14: +10 %…), hasta +50 %.
- **Hitos**: al 25 % / 50 % / 75 % / 100 % de la meta → 50 / 100 / 200 / 500 ki × multiplicador, y una medalla (sello 銅 銀 金 極).
- Todo se calcula a partir de tu historial: si desmarcás un día o cambiás una meta, los números se acomodan solos.

### Rangos
| Rango | Ki |
|---|---|
| 弟子 Deshi — Aprendiz | 0 |
| 足軽 Ashigaru — Soldado de a pie | 300 |
| 浪人 Rōnin — Guerrero errante | 1.500 |
| 侍 Samurái — Guerrero de honor | 5.000 |
| 大名 Daimyō — Señor del clan | 12.000 |
| 将軍 Shōgun — Comandante supremo | 25.000 |
| 剣聖 Kensei — Santo de la espada | 50.000 |

---

## 3. Backup (importante)

Tus datos viven **solo dentro de la app en tu iPhone**. No hay cuenta ni nube. Se pierden si:
- borrás el ícono de la app (iOS borra sus datos sin preguntar),
- cambiás de iPhone o lo restaurás.

**Cómo hacer backup** (cada dos semanas está bien; la app te avisa si pasó más de un mes):
1. Ajustes → **Exportar backup**.
2. En el menú que aparece, elegí **Guardar en Archivos** → iCloud Drive (o mandátelo por mail).

**Cómo recuperarlo**:
1. Ajustes → **Importar backup**.
2. Elegí el archivo `desafios-backup-AAAA-MM-DD.json`. Reemplaza todo lo que haya en la app por lo del backup.

---

## 4. Recordatorio diario

La app no manda notificaciones. En **Ajustes → Recordatorio diario** están los pasos para hacerlo con la app **Recordatorios** o con **Atajos**.

---

## 5. Pedirle cambios a Claude en el futuro

1. Abrí Claude Code (claude.ai/code) con este repositorio: `santei-pixel/App-desafios`.
2. Escribí lo que querés en criollo. Ejemplos:
   - "Agregá un décimo desafío que se llame X, dificultad media, meta 21 días."
   - "Quiero que el Seiza dure 10 minutos."
   - "Cambiá el rojo por un azul índigo."
3. Pedile que **pruebe los cambios** (`npm test` y `npm run e2e`) y que **suba la versión** (ver abajo).

Dónde está cada cosa, por si te sirve:
- `js/challenges.js` → los desafíos, rangos, hitos (textos y números).
- `js/logic.js` → reglas de rachas y puntos.
- `js/app.js` → pantallas y botones.
- `styles.css` → colores y diseño.

---

## 6. Publicar una actualización (y que el iPhone la tome)

1. En cada cambio hay que subir el número de versión en **dos lugares** (Claude lo hace si se lo pedís):
   - `sw.js` → `const VERSION = '1.0.1';`
   - `js/app.js` → `export const APP_VERSION = '1.0.1';`
   Si no se cambia `sw.js`, el iPhone sigue usando la versión vieja guardada.
2. Los cambios tienen que llegar a la rama **main** (Claude abre un pull request; vos entrás a GitHub y tocás **Merge pull request** → **Confirm merge**).
3. Esperá 1–2 minutos a que GitHub Pages publique.
4. En el iPhone, abrí la app **con internet**. A los segundos aparece arriba: **"Hay una versión nueva de la app. Actualizar"**. Tocalo.
   Si no aparece: cerrá la app del todo y abrila de nuevo, o andá a Ajustes → **Buscar actualización**.

Tus datos no se tocan al actualizar.

---

## 7. Para desarrolladores (opcional)

- Sin frameworks ni build: HTML + CSS + JavaScript puro.
- Probar en la compu: `python3 -m http.server 8000` y abrir http://localhost:8000
- Tests de lógica: `npm test` (Node 18+, sin instalar nada).
- Prueba completa en tamaño iPhone: `npm run e2e` (necesita Playwright).
- Regenerar el ícono: editar `tools/icon.svg` y correr `node tools/make-icons.mjs`.
