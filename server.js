// ============================================================
//  NQ FUTURES DASHBOARD — Webhook Server
//  Deploy free on Render.com (render.com)
//  TradingView sends alert JSON here → dashboard reads it
// ============================================================

const express  = require('express')
const cors     = require('cors')
const app      = express()
const PORT     = process.env.PORT || 3000

// Secret token — set this as environment variable on Render
// TradingView alert URL must include ?token=YOUR_SECRET
const SECRET = process.env.WEBHOOK_SECRET || 'nq-dashboard-secret'

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Store latest data in memory (Render free tier resets periodically — that's fine)
let latestData = null
let lastUpdated = null
let history = []  // last 50 updates

// ── POST /webhook — TradingView sends alert here
app.post('/webhook', (req, res) => {
  const token = req.query.token || req.body.token
  if (token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // TradingView sends the alert message as a string in req.body
    // We parse it as JSON
    let data = req.body
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }

    // Validate required fields
    if (!data.price) {
      return res.status(400).json({ error: 'Missing price field' })
    }

    latestData  = data
    lastUpdated = new Date().toISOString()

    // Keep history (last 50)
    history.unshift({ ...data, receivedAt: lastUpdated })
    if (history.length > 50) history = history.slice(0, 50)

    console.log(`[${lastUpdated}] Received: ${JSON.stringify(data)}`)
    res.json({ ok: true, receivedAt: lastUpdated })

  } catch (err) {
    console.error('Parse error:', err)
    res.status(400).json({ error: 'Invalid JSON', details: err.message })
  }
})

// ── GET /data — Dashboard polls this
app.get('/data', (req, res) => {
  if (!latestData) {
    return res.json({ ok: false, message: 'No data received yet. Waiting for TradingView alert.' })
  }
  res.json({
    ok:          true,
    data:        latestData,
    lastUpdated: lastUpdated
  })
})

// ── GET /history — Last 50 updates
app.get('/history', (req, res) => {
  res.json({ ok: true, count: history.length, history })
})

// ── GET /health — Status check
app.get('/health', (req, res) => {
  res.json({
    ok:          true,
    uptime:      Math.round(process.uptime()) + 's',
    lastUpdated: lastUpdated || 'No data yet',
    dataFields:  latestData ? Object.keys(latestData) : []
  })
})

// ── GET / — Landing page
app.get('/', (req, res) => {
  res.send(`
    <html><head><title>NQ Dashboard Server</title>
    <style>body{font-family:monospace;background:#060a10;color:#cdd5dc;padding:40px;line-height:1.8}
    h1{color:#40c4ff}code{background:#101820;padding:2px 8px;border-radius:3px}
    .ok{color:#00e676}.warn{color:#ffd740}</style></head>
    <body>
    <h1>NQ Futures Dashboard — Webhook Server</h1>
    <p class="${latestData ? 'ok' : 'warn'}">Status: ${latestData ? '● LIVE — receiving data' : '○ Waiting for first TradingView alert'}</p>
    <p>Last update: ${lastUpdated || 'none yet'}</p>
    <hr style="border-color:#1e2d40;margin:20px 0">
    <p><strong>Endpoints:</strong></p>
    <p><code>POST /webhook?token=YOUR_SECRET</code> — TradingView sends here</p>
    <p><code>GET  /data</code> — Dashboard polls here</p>
    <p><code>GET  /history</code> — Last 50 updates</p>
    <p><code>GET  /health</code> — Server health check</p>
    </body></html>
  `)
})

app.listen(PORT, () => {
  console.log(`NQ Dashboard server running on port ${PORT}`)
  console.log(`Webhook secret: ${SECRET}`)
})
