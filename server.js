const express = require('express');
const { default: makeWASocket, useSingleFileAuthState, generateWAMessageContent, generateWAMessageFromContent } = require('baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.static("public"));

app.get('/', (req, res) => {
  res.send('🚀 Ancore Pair Code Server is Live.');
});

// QR Code Session
app.get('/qr', async (req, res) => {
  const { state, saveState } = useSingleFileAuthState('./ancore-qr-session.json');

  const sock = makeWASocket({ auth: state });

  sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      res.send(`<h2>Scan This QR Code:</h2><img src="${qrImage}" style="width:300px;">`);
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp Connected via QR.');
    }

    if (lastDisconnect) {
      console.log('🔌 Disconnected, restarting...');
    }
  });

  sock.ev.on('creds.update', saveState);
});

// Pair Code Session
app.get('/code', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.json({ status: false, message: "Number is required." });

  const { state, saveState } = useSingleFileAuthState(`./ancore-pair-${number}.json`);
  const sock = makeWASocket({ auth: state });

  sock.ev.on('connection.update', async ({ pairingCode, connection, lastDisconnect }) => {
    if (pairingCode) {
      return res.json({ status: true, code: pairingCode });
    }

    if (connection === 'open') {
      console.log(`✅ WhatsApp connected via PairCode for ${number}.`);
    }

    if (lastDisconnect) {
      console.log(`🔌 Disconnected from ${number}`);
    }
  });

  sock.ev.on('creds.update', saveState);
});

app.listen(port, () => {
  console.log(`🔥 Ancore Pair Server running at http://localhost:${port}`);
});
