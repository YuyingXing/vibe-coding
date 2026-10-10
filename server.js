/**
 * Photography Portfolio — server
 * - Serves the public site (public/)
 * - Stores uploaded images in uploads/<collection>/ and metadata in data/db.json
 * - Collections: "works" (个人作品) and "inspiration" (灵感图集)
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hikari';

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const COLLECTIONS = ['works', 'inspiration'];
const EDITABLE_FIELDS = ['title', 'caption', 'location', 'year'];

for (const c of COLLECTIONS) fs.mkdirSync(path.join(UPLOAD_DIR, c), { recursive: true });
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

/* ---------------- data store ---------------- */

function seed() {
  const pic = (id, w, h) => `https://picsum.photos/id/${id}/${w}/${h}`;
  const works = [
    [1015, 'River at Dawn', 'Nikko, Tochigi', '2025'],
    [1036, 'Winter Path', 'Hakuba, Nagano', '2024'],
    [1043, 'Afterglow', 'Kamakura, Kanagawa', '2025'],
    [1039, 'Falling Water', 'Yakushima, Kagoshima', '2023'],
    [1044, 'Low Tide', 'Itoshima, Fukuoka', '2024'],
    [1047, 'City Between', 'Shibuya, Tokyo', '2025'],
    [1050, 'Northern Coast', 'Shiretoko, Hokkaido', '2023'],
    [1067, 'Lantern Street', 'Kyoto', '2024'],
    [1069, 'Deep Blue', 'Okinawa', '2025'],
    [1074, 'Quiet Gaze', 'Nara', '2022'],
  ].map(([id, title, location, year], i) => ({
    id: `seed-w${i}`,
    src: pic(id, 1200, 1600),
    title,
    caption: '',
    location,
    year,
    sample: true,
    createdAt: Date.now() - i,
  }));

  const inspoSizes = [[900, 1200], [1200, 800], [900, 900], [800, 1100], [1200, 900], [1000, 1300]];
  const inspoIds = [10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 27, 28, 29, 33, 37];
  const inspoCaps = [
    'Mist over the cedar forest', 'Morning tea, paper light', 'Salt and wind', 'An unhurried afternoon',
    'Lines of the shore', 'The colour of moss', 'Stillness in motion', 'A walk before rain',
    'Shadows on tatami', 'Field notes', 'The far mountain', 'Small things, kept',
    'Window, late summer', 'Grain of the wood', 'Between two tides', 'Evening hush',
    'Rooftops in snow', 'A letter of light',
  ];
  const inspiration = inspoIds.map((id, i) => {
    const [w, h] = inspoSizes[i % inspoSizes.length];
    return {
      id: `seed-i${i}`,
      src: pic(id, w, h),
      title: '',
      caption: inspoCaps[i],
      location: '',
      year: '',
      sample: true,
      createdAt: Date.now() - i,
    };
  });
  return { works, inspiration };
}

function readDB() {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
    return db;
  } catch {
    const db = seed();
    writeDB(db);
    return db;
  }
}

function writeDB(db) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

/* ---------------- auth (simple token) ---------------- */

const tokens = new Set();

function requireAuth(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token && tokens.has(token)) return next();
  res.status(401).json({ error: '未登录或登录已过期' });
}

function collectionParam(req, res, next) {
  if (!COLLECTIONS.includes(req.params.collection)) {
    return res.status(404).json({ error: 'Unknown collection' });
  }
  next();
}

/* ---------------- uploads ---------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, req.params.collection)),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
});

/* ---------------- app ---------------- */

const app = express();
app.use(express.json());

app.use('/vendor/gsap', express.static(path.join(ROOT, 'node_modules', 'gsap', 'dist')));
app.use('/vendor/lenis', express.static(path.join(ROOT, 'node_modules', 'lenis', 'dist')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(ROOT, 'public')));

app.post('/api/login', (req, res) => {
  if ((req.body && req.body.password) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  tokens.add(token);
  res.json({ token });
});

app.get('/api/session', requireAuth, (req, res) => res.json({ ok: true }));

app.get('/api/:collection', collectionParam, (req, res) => {
  res.json(readDB()[req.params.collection]);
});

app.post('/api/:collection', requireAuth, collectionParam, upload.array('images', 50), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: '请选择图片文件（jpg / png / webp / gif / avif）' });

  const db = readDB();
  const list = db[req.params.collection];
  const now = Date.now();
  const added = files.map((f, i) => {
    const base = path.basename(f.originalname, path.extname(f.originalname));
    return {
      id: crypto.randomUUID(),
      src: `/uploads/${req.params.collection}/${f.filename}`,
      title: (req.body.title || '').trim() || (req.params.collection === 'works' ? base : ''),
      caption: (req.body.caption || '').trim(),
      location: (req.body.location || '').trim(),
      year: (req.body.year || '').trim(),
      createdAt: now + i,
    };
  });
  // newest first
  list.unshift(...added);
  writeDB(db);
  res.status(201).json(added);
});

app.patch('/api/:collection/:id', requireAuth, collectionParam, (req, res) => {
  const db = readDB();
  const item = db[req.params.collection].find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  for (const k of EDITABLE_FIELDS) {
    if (typeof req.body[k] === 'string') item[k] = req.body[k].trim();
  }
  writeDB(db);
  res.json(item);
});

app.delete('/api/:collection/:id', requireAuth, collectionParam, (req, res) => {
  const db = readDB();
  const list = db[req.params.collection];
  const idx = list.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [item] = list.splice(idx, 1);
  if (item.src.startsWith('/uploads/')) {
    const file = path.join(UPLOAD_DIR, req.params.collection, path.basename(item.src));
    fs.rm(file, { force: true }, () => {});
  }
  writeDB(db);
  res.json({ ok: true });
});

app.put('/api/:collection/order', requireAuth, collectionParam, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const db = readDB();
  const list = db[req.params.collection];
  const byId = new Map(list.map((x) => [x.id, x]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const rest = list.filter((x) => !ids.includes(x.id));
  db[req.params.collection] = [...ordered, ...rest];
  writeDB(db);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  const msg = err.code === 'LIMIT_FILE_SIZE' ? '单张图片不能超过 25MB' : err.message || 'Server error';
  res.status(400).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`\n  Portfolio  →  http://localhost:${PORT}`);
  console.log(`  Admin      →  http://localhost:${PORT}/admin.html  (password: ${ADMIN_PASSWORD === 'hikari' ? 'hikari — set ADMIN_PASSWORD to change' : '******'})\n`);
});
