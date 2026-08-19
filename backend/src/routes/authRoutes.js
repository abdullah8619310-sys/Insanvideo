const express = require('express')
const { connect, callback } = require('../controllers/authController')

const router = express.Router()

router.get('/instagram/connect', connect)
router.get('/instagram/callback', callback)

module.exports = router
