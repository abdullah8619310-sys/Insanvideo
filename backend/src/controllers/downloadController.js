const { errorResponse } = require('../utils/apiResponse')

// Placeholder only: media processing is implemented in a later step.
function requestDownload(req, res) {
  return errorResponse(res, {
    statusCode: 501,
    message: 'Media download processing is not implemented yet.',
  })
}

module.exports = { requestDownload }
