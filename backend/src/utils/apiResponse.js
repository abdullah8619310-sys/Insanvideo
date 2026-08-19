function successResponse(res, { statusCode = 200, message = 'Success', data = null } = {}) {
  return res.status(statusCode).json({ success: true, message, data })
}

function errorResponse(res, { statusCode = 500, message = 'An error occurred', data = null } = {}) {
  return res.status(statusCode).json({ success: false, message, data })
}

module.exports = { successResponse, errorResponse }
