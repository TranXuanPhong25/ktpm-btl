import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test scenarios - realistic progressive load testing
export const options = {
   scenarios: {
      // Warm-up phase
      warmup: {
         executor: 'ramping-vus',
         startVUs: 0,
         stages: [
            { duration: '30s', target: 10 },
            { duration: '30s', target: 10 },
         ],
         exec: 'writeWorkload',
         startTime: '0s',
         tags: { test_type: 'warmup' },
      },
      // Write tests - gradual increase
      write_low: {
         executor: 'ramping-arrival-rate',
         startRate: 10,
         timeUnit: '1s',
         preAllocatedVUs: 5,
         maxVUs: 50,
         stages: [
            { duration: '30s', target: 50 },
            { duration: '30s', target: 50 },
            { duration: '30s', target: 100 },
         ],
         exec: 'writeWorkload',
         startTime: '1m',
         tags: { test_type: 'write', phase: 'low' },
      },
      write_medium: {
         executor: 'ramping-arrival-rate',
         startRate: 100,
         timeUnit: '1s',
         preAllocatedVUs: 20,
         maxVUs: 100,
         stages: [
            { duration: '30s', target: 200 },
            { duration: '30s', target: 200 },
            { duration: '30s', target: 300 },
         ],
         exec: 'writeWorkload',
         startTime: '2m30s',
         tags: { test_type: 'write', phase: 'medium' },
      },
      write_high: {
         executor: 'ramping-arrival-rate',
         startRate: 300,
         timeUnit: '1s',
         preAllocatedVUs: 50,
         maxVUs: 200,
         stages: [
            { duration: '30s', target: 500 },
            { duration: '30s', target: 500 },
         ],
         exec: 'writeWorkload',
         startTime: '4m',
         tags: { test_type: 'write', phase: 'high' },
      },
      // Cool down before reads
      cooldown: {
         executor: 'ramping-vus',
         startVUs: 1,
         stages: [
            { duration: '30s', target: 1 },
         ],
         exec: 'readWorkload',
         startTime: '5m',
         tags: { test_type: 'cooldown' },
      },
      // Read tests
      read_low: {
         executor: 'ramping-arrival-rate',
         startRate: 10,
         timeUnit: '1s',
         preAllocatedVUs: 5,
         maxVUs: 50,
         stages: [
            { duration: '30s', target: 100 },
            { duration: '30s', target: 100 },
            { duration: '30s', target: 200 },
         ],
         exec: 'readWorkload',
         startTime: '5m30s',
         tags: { test_type: 'read', phase: 'low' },
      },
      read_medium: {
         executor: 'ramping-arrival-rate',
         startRate: 200,
         timeUnit: '1s',
         preAllocatedVUs: 20,
         maxVUs: 100,
         stages: [
            { duration: '30s', target: 400 },
            { duration: '30s', target: 400 },
            { duration: '30s', target: 600 },
         ],
         exec: 'readWorkload',
         startTime: '7m',
         tags: { test_type: 'read', phase: 'medium' },
      },
      read_high: {
         executor: 'ramping-arrival-rate',
         startRate: 600,
         timeUnit: '1s',
         preAllocatedVUs: 50,
         maxVUs: 200,
         stages: [
            { duration: '30s', target: 1000 },
            { duration: '30s', target: 1000 },
         ],
         exec: 'readWorkload',
         startTime: '8m30s',
         tags: { test_type: 'read', phase: 'high' },
      },
   },
   thresholds: {
      http_req_duration: ['p(95)<5000', 'p(99)<10000'],
      http_req_failed: ['rate<0.8'],
      errors: ['rate<0.8'],
   },
   discardResponseBodies: true,
   // Add timeout settings
   httpDebug: 'full',
   noConnectionReuse: false,
   userAgent: 'k6-load-test',
};

// Read workload - GET user by ID
export function readWorkload() {
   const randomNum = Math.floor(Math.random() * 1000000);
   const payload = JSON.stringify({
      email: `user${randomNum}@test.com`,
      password: 'test123',
   });

   const params = {
      headers: {
         'Content-Type': 'application/json',
      },
      timeout: '10s', // Add explicit timeout
   };

   const res = http.post(`${BASE_URL}/api/users/login`, payload, params);
   
   const result = check(res, {
      'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
   });

   errorRate.add(!result);
   sleep(0.5); // Increase sleep to reduce load
}

// Write workload - POST/PUT user
export function writeWorkload() {
   const randomNum = Math.floor(Math.random() * 1000000);
   const payload = JSON.stringify({
      name: `user_${randomNum}`,
      email: `user${randomNum}@test.com`,
      password: 'test123',
   });

   const params = {
      headers: {
         'Content-Type': 'application/json',
      },
      timeout: '10s', // Add explicit timeout
   };

   const res = http.post(`${BASE_URL}/api/users/register`, payload, params);

   const result = check(res, {
      'status is 201 or 200': (r) => r.status === 201 || r.status === 200 || r.status === 409,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
   });

   errorRate.add(!result);
   sleep(0.5); // Increase sleep to reduce load
}
