const { errorResponse } = require('../utils/apiResponse')

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // express.json() throws this specific error type for malformed request bodies.
  if (err.type === 'entity.parse.failed') {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Malformed JSON in request body.',
    })
  }

  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) {
    console.error(err)
  }

  return errorResponse(res, {
    statusCode: err.statusCode || 500,
    message: isDev ? err.message : 'Internal server error.',
  })
}

module.exports = errorHandler
