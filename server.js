const express = require('express');
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.static('public'));

// Home route
app.get('/', (req, res) => {
  res.send('🔥 Ancore MD Pair & QR Session Portal is running.');
});

// QR Code session
app.get('/qr', async (req, res) => {
  const { state, saveState } = useSingleFileAuthState('./Ancore_QRSession.json');
  const sock = makeWASocket({ auth: state });

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      res.send(`<h2>Scan QR:</h2><img src="${qrImage}" style="width:300px;">`);
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected via QR.');
    }

    if (lastDisconnect) {
      console.log('🔌 QR Disconnected, restarting...');
    }
  });

  sock.ev.on('creds.update', saveState);
});

// Pair Code session
app.get('/code', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.json({ status: false, message: "⚠️ Number query is required." });

  const sessionFile = `./Ancore_${number}.json`;
  const { state, saveState } = useSingleFileAuthState(sessionFile);
  const sock = makeWASocket({ auth: state });

  sock.ev.on('connection.update', async ({ pairingCode, connection, lastDisconnect }) => {
    if (pairingCode) {
      return res.json({ status: true, code: pairingCode });
    }

    if (connection === 'open') {
      console.log(`✅ Connected via PairCode for ${number}`);
    }

    if (lastDisconnect) {
      console.log(`🔌 Disconnected from ${number}`);
    }
  });

  sock.ev.on('creds.update', saveState);
});

// Serve static pages
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pair.html'));
});

app.get('/qr-page', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/qr.html'));
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Ancore Pair Server running at http://localhost:${port}`);
});
