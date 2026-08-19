const express = require('express')
const { requestDownload } = require('../controllers/downloadController')

const router = express.Router()

router.post('/', requestDownload)

module.exports = router
