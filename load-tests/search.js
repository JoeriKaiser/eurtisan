import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/search?q=ceramic`)
  check(res, { 'status is 200': (r) => r.status === 200 })
  sleep(1)
}
