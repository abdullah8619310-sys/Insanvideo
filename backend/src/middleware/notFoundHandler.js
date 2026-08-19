const { errorResponse } = require('../utils/apiResponse')

function notFoundHandler(req, res) {
  return errorResponse(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

module.exports = notFoundHandler
