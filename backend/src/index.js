require('dotenv').config()
const app = require('./app')

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`InsanVideo Downloader backend listening on port ${PORT}`)
})
