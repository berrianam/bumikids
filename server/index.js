import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'vouchers.json');

app.use(express.json({ limit: '1mb' }));

const ensureDataFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
};

const readVouchers = async () => {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeVouchers = async (vouchers) => {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(vouchers, null, 2), 'utf8');
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/vouchers', async (_req, res) => {
  try {
    const vouchers = await readVouchers();
    res.json({ vouchers });
  } catch (error) {
    res.status(500).json({ message: 'Failed to read vouchers file.' });
  }
});

app.put('/api/vouchers', async (req, res) => {
  const { vouchers } = req.body || {};

  if (!Array.isArray(vouchers)) {
    res.status(400).json({ message: 'Invalid payload. vouchers must be an array.' });
    return;
  }

  try {
    await writeVouchers(vouchers);
    res.json({ message: 'Vouchers saved.', total: vouchers.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save vouchers file.' });
  }
});

app.listen(PORT, HOST, async () => {
  await ensureDataFile();
  console.log(`Voucher API running on http://${HOST}:${PORT}`);
});
