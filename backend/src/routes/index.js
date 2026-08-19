const express = require('express')
const healthRoutes = require('./healthRoutes')
const downloadRoutes = require('./downloadRoutes')
const mediaRoutes = require('./mediaRoutes')
const authRoutes = require('./authRoutes')

const router = express.Router()

router.use('/health', healthRoutes)
router.use('/download', downloadRoutes)
router.use('/media', mediaRoutes)
router.use('/auth', authRoutes)

module.exports = router
