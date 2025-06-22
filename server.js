import express from 'express'
import pino from 'pino'
import cors from 'cors'
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logger = pino({ transport: { target: 'pino-pretty' } })

const app = express()
app.use(cors())
app.use(express.static('public'))

const PORT = process.env.PORT || 5000

// Session generation endpoint
app.get('/pair', async (req, res) => {
  const { number } = req.query
  if (!number) return res.status(400).json({ error: 'Phone number required' })

  const sessionName = `Ancore_${number}`
  const sessionDir = path.join(__dirname, 'sessions', sessionName)

  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, pairingCode } = update
    if (connection === 'open') logger.info(`✅ Connected: ${number}`)

    if (pairingCode) {
      res.json({ code: pairingCode })
      logger.info(`Pair code for ${number}: ${pairingCode}`)
    }
  })

  sock.ev.on('creds.update', saveCreds)
})

// QR code generation endpoint
app.get('/qr', async (req, res) => {
  const sessionName = 'Ancore_QR'
  const sessionDir = path.join(__dirname, 'sessions', sessionName)

  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update
    if (qr) {
      qrcode.toDataURL(qr, (err, url) => {
        if (err) return res.status(500).json({ error: 'Failed to generate QR' })
        res.json({ qr: url })
      })
    }
    if (connection === 'open') logger.info('✅ QR Session connected')
  })

  sock.ev.on('creds.update', saveCreds)
})

app.listen(PORT, () => logger.info(`🚀 Ancore MD server running on http://localhost:${PORT}`))
