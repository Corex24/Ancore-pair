import express from 'express';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const log = pino({ transport: { target: 'pino-pretty' } });
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

app.get('/pair', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pair.html'));
});

app.get('/qr', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/qr.html'));
});

app.get('/code', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.status(400).json({ error: 'No number provided' });

  const sessionId = `Ancore_${Date.now()}`;
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, pairingCode, lastDisconnect } = update;

    if (qr) {
      qrcode.toDataURL(qr, (err, url) => {
        if (err) return res.status(500).json({ error: 'QR generation failed' });
        return res.json({ qr: url });
      });
    }

    if (pairingCode) {
      res.json({ code: pairingCode });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      log.info(`Connection closed. Reconnect? ${shouldReconnect}`);
      if (fs.existsSync(`./sessions/${sessionId}`)) {
        fs.rmSync(`./sessions/${sessionId}`, { recursive: true, force: true });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
});

app.listen(PORT, () => {
  log.info(`✅ Ancore MD Session Portal running at http://localhost:${PORT}`);
});
