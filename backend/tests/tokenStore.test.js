const test = require('node:test')
const assert = require('node:assert/strict')
const { createTokenStore } = require('../src/db/tokenStore')

test('getConnection returns null when nothing has been saved', () => {
  const store = createTokenStore(':memory:')
  assert.equal(store.getConnection(), null)
  store.close()
})

test('saveConnection then getConnection round-trips the data', () => {
  const store = createTokenStore(':memory:')
  const expiresAt = Date.now() + 1000
  store.saveConnection({ accessToken: 'TOKEN_A', igUserId: '123', expiresAt })

  const connection = store.getConnection()
  assert.equal(connection.accessToken, 'TOKEN_A')
  assert.equal(connection.igUserId, '123')
  assert.equal(connection.expiresAt, expiresAt)
  assert.ok(typeof connection.connectedAt === 'number')

  store.close()
})

test('saveConnection called twice overwrites the single stored row', () => {
  const store = createTokenStore(':memory:')
  store.saveConnection({ accessToken: 'FIRST', igUserId: '1', expiresAt: 111 })
  store.saveConnection({ accessToken: 'SECOND', igUserId: '2', expiresAt: 222 })

  const connection = store.getConnection()
  assert.equal(connection.accessToken, 'SECOND')
  assert.equal(connection.igUserId, '2')
  assert.equal(connection.expiresAt, 222)

  store.close()
})

test('clearConnection removes the stored row', () => {
  const store = createTokenStore(':memory:')
  store.saveConnection({ accessToken: 'X', igUserId: '1', expiresAt: 111 })
  store.clearConnection()
  assert.equal(store.getConnection(), null)
  store.close()
})
