// Los 9 desafíos precargados. Para agregar o cambiar textos, editá esta lista.
// difficulty: 'baja' | 'media' | 'alta'
// defaultGoal: cantidad de días (null = sin meta en días, como Ganbaru)

export const CHALLENGES = [
  {
    id: 'shugyo',
    kanji: '修行',
    name: 'Shugyo',
    short: 'Elegir UNA cosa y hacerla todos los días.',
    long: 'El entrenamiento del guerrero: una sola práctica, todos los días, sin excepción. Regla estricta: si faltás un día, el contador vuelve a cero.',
    difficulty: 'alta',
    defaultGoal: 100,
    strict: true,
    textLabel: '¿Cuál es tu práctica?',
    textPlaceholder: 'Ej.: 20 flexiones, leer 10 páginas…',
  },
  {
    id: 'ganbaru',
    kanji: '頑張る',
    name: 'Ganbaru',
    short: 'Terminar algo aunque ya no tengas ganas, solo porque dijiste que lo harías.',
    long: 'Perseverar hasta el final. Marcá cada día que avanzás y, cuando lo termines, tocá "Terminado" para ganar un bonus grande.',
    difficulty: 'alta',
    defaultGoal: null,
    project: true,
    textLabel: '¿Qué proyecto vas a terminar?',
    textPlaceholder: 'Ej.: el curso de inglés, ordenar el placard…',
  },
  {
    id: 'seiza',
    kanji: '正座',
    name: 'Seiza',
    short: '5 minutos sentado quieto, espalda recta, sin teléfono.',
    long: 'Sentate quieto con la espalda recta durante 5 minutos. El temporizador pone la pantalla en negro; al terminar, el día se marca solo.',
    difficulty: 'media',
    defaultGoal: 30,
    timer: 300,
  },
  {
    id: 'harahachibu',
    kanji: '腹八分',
    name: 'Hara Hachi Bu',
    short: 'Dejar de comer al 80 % de saciedad.',
    long: 'Pará de comer cuando te sientas lleno al 80 %. El cuerpo agradece el espacio vacío.',
    difficulty: 'media',
    defaultGoal: 30,
  },
  {
    id: 'shokunin',
    kanji: '職人',
    name: 'Shokunin',
    short: 'Hacer una tarea aburrida con precisión total.',
    long: 'El espíritu del artesano: tomá una tarea aburrida y hacela con precisión y cuidado absolutos.',
    difficulty: 'baja',
    defaultGoal: 30,
    notePlaceholder: '¿Qué tarea fue? (opcional)',
  },
  {
    id: 'gaman',
    kanji: '我慢',
    name: 'Gaman',
    short: 'Atravesar algo difícil sin quejarte con nadie.',
    long: 'Soportar con dignidad. No se trata de reprimir lo que sentís, sino de no descargarlo en otros.',
    difficulty: 'alta',
    defaultGoal: 30,
  },
  {
    id: 'ola90',
    kanji: '波',
    name: 'Ola de 90 segundos',
    short: 'Cuando aparece una emoción fuerte, dejarla pasar 90 segundos sin alimentarla.',
    long: 'Una emoción química dura unos 90 segundos si no la alimentás. Usá el temporizador cuantas veces quieras; el día cuenta con un uso.',
    difficulty: 'baja',
    defaultGoal: 30,
    timer: 90,
    multiUse: true,
  },
  {
    id: 'camaralenta',
    kanji: '緩',
    name: 'Reset en cámara lenta',
    short: 'Hacer una tarea cotidiana a media velocidad, con atención plena.',
    long: 'Elegí algo cotidiano (lavar una taza, caminar, vestirte) y hacelo a la mitad de velocidad, prestando atención a cada movimiento.',
    difficulty: 'baja',
    defaultGoal: 30,
  },
  {
    id: 'repaso',
    kanji: '省',
    name: 'Repaso antes de dormir',
    short: 'En el último minuto despierto, repasar un momento en que fuiste la versión de vos que querés ser.',
    long: 'Antes de dormir, recordá un momento del día en el que actuaste como la persona que querés ser. Si lo hacés pasada la medianoche, marcalo como "ayer".',
    difficulty: 'baja',
    defaultGoal: 30,
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export const DIFFICULTY = {
  baja: { label: 'Baja', points: 10, mult: 1 },
  media: { label: 'Media', points: 20, mult: 2 },
  alta: { label: 'Alta', points: 30, mult: 3 },
};

// Rangos samurái. min = ki total necesario.
export const LEVELS = [
  { name: 'Deshi', kanji: '弟子', title: 'Aprendiz', min: 0 },
  { name: 'Ashigaru', kanji: '足軽', title: 'Soldado de a pie', min: 300 },
  { name: 'Rōnin', kanji: '浪人', title: 'Guerrero errante', min: 1500 },
  { name: 'Samurái', kanji: '侍', title: 'Guerrero de honor', min: 5000 },
  { name: 'Daimyō', kanji: '大名', title: 'Señor del clan', min: 12000 },
  { name: 'Shōgun', kanji: '将軍', title: 'Comandante supremo', min: 25000 },
  { name: 'Kensei', kanji: '剣聖', title: 'Santo de la espada', min: 50000 },
];

export const MILESTONES = [
  { pct: 25, bonus: 50, label: 'Primer paso', medal: '銅' },
  { pct: 50, bonus: 100, label: 'Mitad del camino', medal: '銀' },
  { pct: 75, bonus: 200, label: 'Recta final', medal: '金' },
  { pct: 100, bonus: 500, label: 'Completado', medal: '極' },
];

export const FINISH_BONUS = 500; // × multiplicador de dificultad (Ganbaru: 1500)
