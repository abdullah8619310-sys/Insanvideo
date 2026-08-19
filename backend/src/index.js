require('dotenv').config()
const express = require('express')

const app = express()
const PORT = process.env.PORT || 5000

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`InsanVideo Downloader backend listening on port ${PORT}`)
})
