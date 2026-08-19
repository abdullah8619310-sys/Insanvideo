const { getHealthStatus } = require('../services/healthService')
const { successResponse } = require('../utils/apiResponse')

function getHealth(req, res) {
  const health = getHealthStatus()
  return successResponse(res, { message: 'InsanVideo API is running', data: health })
}

module.exports = { getHealth }
