function getHealthStatus() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
}

module.exports = { getHealthStatus }
