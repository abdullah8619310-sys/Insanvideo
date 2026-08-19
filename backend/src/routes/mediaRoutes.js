const express = require('express')
const { postMediaInfo } = require('../controllers/mediaController')

const router = express.Router()

router.post('/info', postMediaInfo)

module.exports = router
