const express = require("express");
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// Auth file
const { state, saveState } = useSingleFileAuthState("./session.json");

// Express app
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static("public"));

// WebSocket + Baileys setup
let sock;

const connectWA = async () => {
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    version
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect, isNewLogin }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectWA();
      }
    }

    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
    }
  });
};

let currentQR = null;

connectWA();

// Routes

app.get("/qr", async (req, res) => {
  if (currentQR) {
    res.json({ qr: currentQR });
  } else {
    res.json({ qr: "https://via.placeholder.com/300?text=QR+Not+Ready" });
  }
});

// Dummy Pair Code API
app.get("/code", async (req, res) => {
  const number = req.query.number;
  if (!number) return res.status(400).json({ error: "No number provided." });

  // Here you should integrate actual pair code generation if your fork supports it
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  res.json({ number, code });
});

// Fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Ancore session portal running on http://localhost:${PORT}`);
});
