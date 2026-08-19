const express = require('express')
const cors = require('cors')
const apiRoutes = require('./routes')
const notFoundHandler = require('./middleware/notFoundHandler')
const errorHandler = require('./middleware/errorHandler')

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

const app = express()

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (e.g. curl, server-to-server) and configured origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      const corsError = new Error('Not allowed by CORS')
      corsError.statusCode = 403
      return callback(corsError)
    },
  })
)

app.use(express.json())

app.use('/api', apiRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
