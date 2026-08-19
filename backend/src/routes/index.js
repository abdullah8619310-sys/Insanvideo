const express = require('express')
const healthRoutes = require('./healthRoutes')
const downloadRoutes = require('./downloadRoutes')

const router = express.Router()

router.use('/health', healthRoutes)
router.use('/download', downloadRoutes)

module.exports = router
