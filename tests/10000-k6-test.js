import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Metrics
const businessSuccess = new Rate('business_success');
const systemErrors    = new Counter('system_errors');
const txDuration      = new Trend('transaction_duration', true);

export const options = {
  scenarios: {
    task_test: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 10000,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    business_success:  ['rate==1.0'],   // ALL outcomes must be valid
    system_errors:     ['count==0'],    // zero unexpected errors
  },
};

const BASE_URL = 'http://192.168.0.13:3000';

export function setup() {
  const res = http.get(`${BASE_URL}/reset`);
  if (res.status !== 200) {
    throw new Error('Failed to reset balance');
  }
}

export default function () {
  const payload = JSON.stringify({ amount: -2 });

  const res = http.put(`${BASE_URL}/users/1/balance`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });

  txDuration.add(res.timings.duration);

  let body;
  try {
    body = JSON.parse(res.body);
  } catch (e) {
    systemErrors.add(1);
    businessSuccess.add(false);
    return;
  }

  // BUSINESS LOGIC VALIDATION
  if (res.status === 200) {
    businessSuccess.add(true);

    check(body, {
      'success message': (b) =>
        b.message === 'Balance updated successfully',
    });

  } else if (res.status === 400) {
    businessSuccess.add(true);

    check(body, {
      'insufficient funds': (b) =>
        b.error === 'Insufficient funds',
    });

  } else {
    // TRUE failure
    systemErrors.add(1);
    businessSuccess.add(false);
  }
}

export function teardown() {
  const res = http.get(`${BASE_URL}/users`);
  const users = JSON.parse(res.body);
  const balance = users[0]?.balance;

  console.log(`Final balance: ${balance}`);
}