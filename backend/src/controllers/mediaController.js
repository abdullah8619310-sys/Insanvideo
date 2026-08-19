const { getMediaInfo } = require('../services/mediaInfoService')
const { successResponse, errorResponse } = require('../utils/apiResponse')

async function postMediaInfo(req, res, next) {
  try {
    const { url } = req.body || {}
    const result = await getMediaInfo(url)

    if (!result.success) {
      return errorResponse(res, {
        statusCode: 501,
        message: result.message,
        data: result.data,
      })
    }

    return successResponse(res, { message: result.message, data: result.data })
  } catch (err) {
    return next(err)
  }
}

module.exports = { postMediaInfo }
