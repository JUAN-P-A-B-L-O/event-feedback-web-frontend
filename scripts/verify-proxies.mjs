// HTTP transport tests with synthetic upstreams; this is not a backend E2E test.
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { once } from 'node:events'

const mode = process.argv[2] ?? 'vite'
const servers = []
let vite

async function fixture(service, port) {
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const url = new URL(req.url, 'http://fixture')
    const status = Number(url.searchParams.get('status') ?? 200)
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Upstream-Service': service,
      'Set-Cookie': [
        'SESSION=synthetic-session; Path=/; HttpOnly; SameSite=Lax',
        'XSRF-TOKEN=synthetic-csrf; Path=/; SameSite=Lax',
      ],
      ...(status === 302 ? { Location: `http://${service === 'organizer' ? '127.0.0.1:8080' : 'ef-survey:8087'}/api/events` } : {}),
    })
    res.end(JSON.stringify({ service, url: req.url, method: req.method, headers: req.headers, body }))
  })
  server.listen(port, '0.0.0.0')
  await once(server, 'listening')
  servers.push(server)
}

function send(base, path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, base), {
      method,
      headers: { Host: 'localhost:5173', Accept: 'text/html', ...headers },
    }, async res => {
      let text = ''
      for await (const chunk of res) text += chunk
      resolve({ status: res.statusCode, headers: res.headers, text })
    })
    req.on('error', reject)
    req.end(body)
  })
}

async function verify(base) {
  const csrfHeaders = {
    Cookie: 'SESSION=synthetic-session; XSRF-TOKEN=synthetic-csrf',
    'X-XSRF-TOKEN': 'synthetic-csrf',
    Origin: 'http://localhost:5173',
  }
  const routes = [
    ['/api/auth/csrf', 'organizer'],
    ['/api/auth?probe=1', 'organizer'],
    ['/api/auth/me', 'organizer'],
    ['/api/auth/login', 'organizer', 'POST', 'username=synthetic%40example.test&password=synthetic', 'application/x-www-form-urlencoded'],
    ['/api/auth/logout', 'organizer', 'POST', ''],
    ['/api/events', 'survey'],
    ['/api/events?probe=1', 'survey'],
    ['/api/public?probe=1', 'survey'],
    ['/api/events', 'survey', 'POST', '{"name":"Synthetic event"}', 'application/json'],
    ['/api/events/synthetic/publish', 'survey', 'POST', '{}', 'application/json'],
    ['/api/events/synthetic/results/comments?page=2&size=10', 'survey'],
    ['/api/public/surveys/synthetic%2Ftoken%3F?value=a%2Bb&value=c', 'survey'],
    ['/api/public/surveys/synthetic/responses', 'survey', 'POST', '{"phone":"11900000000","answers":[]}', 'application/json'],
  ]
  for (const [path, service, method = 'GET', body, contentType] of routes) {
    const response = await send(base, path, { method, body,
      headers: { ...csrfHeaders, ...(contentType ? { 'Content-Type': contentType } : {}) } })
    assert.equal(response.status, 200)
    assert.match(response.headers['content-type'], /application\/json/)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers['set-cookie'].length, 2)
    assert.equal(response.headers['set-cookie'][0], 'SESSION=synthetic-session; Path=/; HttpOnly; SameSite=Lax')
    assert.equal(response.headers['set-cookie'][1], 'XSRF-TOKEN=synthetic-csrf; Path=/; SameSite=Lax')
    const echo = JSON.parse(response.text)
    assert.equal(echo.service, service)
    assert.equal(echo.url, path)
    assert.equal(echo.method, method)
    assert.equal(echo.body, body ?? '')
    assert.equal(echo.headers.cookie, csrfHeaders.Cookie)
    assert.equal(echo.headers['x-xsrf-token'], csrfHeaders['X-XSRF-TOKEN'])
    assert.equal(echo.headers.origin, csrfHeaders.Origin)
    assert.equal(echo.headers.host, 'localhost:5173')
    if (contentType) assert.equal(echo.headers['content-type'], contentType)
  }
  for (const status of [201, 204, 400, 401, 403, 404, 409, 429, 500, 502, 503]) {
    for (const path of ['/api/auth/me', '/api/events', '/api/public/surveys/missing']) {
      const response = await send(base, `${path}?status=${status}`)
      assert.equal(response.status, status)
      assert.match(response.headers['content-type'], /application\/json/)
      if (status === 204) assert.equal(response.text, '')
      else assert.equal(JSON.parse(response.text).url, `${path}?status=${status}`)
    }
  }
  const redirectPath = mode === 'vite' ? '/api/auth/me' : '/api/events'
  const redirect = await send(base, `${redirectPath}?status=302`)
  assert.equal(redirect.status, 302)
  assert.ok(['/api/events', 'http://localhost:5173/api/events'].includes(redirect.headers.location))
  for (const path of ['/api', '/api/unknown', '/api/authentication', '/api/events-other']) {
    const response = await send(base, path)
    assert.equal(response.status, 404)
    assert.doesNotMatch(response.text, /<!doctype html|<html/i)
  }
  for (const path of ['/', '/s/synthetic-token']) {
    const response = await send(base, path)
    assert.equal(response.status, 200)
    assert.match(response.text, /<div id="root">/)
  }
  console.log(`PASS: ${mode === 'vite' ? 'Vite' : 'Nginx'} routes, methods, bodies, cookies, CSRF, headers, queries, statuses, redirects and SPA isolation (synthetic upstreams)`)
}

try {
  if (mode === 'vite' || mode === 'fixtures') {
    await fixture('organizer', 8080)
    await fixture('survey', 8087)
  }
  if (mode === 'fixtures') {
    console.log('Synthetic upstreams ready')
  } else {
    if (mode === 'vite') {
      const { createServer: createViteServer } = await import('vite')
      vite = await createViteServer({ server: { host: '127.0.0.1' } })
      await vite.listen()
      const duplicate = await createViteServer({ server: { host: '127.0.0.1' } })
      try {
        await assert.rejects(duplicate.listen(), /Port 5173 is already in use/)
      } finally {
        await duplicate.close()
      }
    }
    if (process.argv[3] === '--unavailable') {
      for (const path of ['/api/auth/me', '/api/events', '/api/public/surveys/synthetic']) {
        const response = await send(mode, path)
        assert.equal(response.status, 502)
        assert.match(response.headers['content-type'], /application\/json/)
        assert.equal(JSON.parse(response.text).error, 'API unavailable')
      }
      console.log('PASS: unavailable upstreams return JSON 502 without SPA fallback')
    } else {
      await verify(mode === 'vite' ? 'http://127.0.0.1:5173' : mode)
    }
  }
} finally {
  if (mode !== 'fixtures') {
    await vite?.close()
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))))
  }
}
