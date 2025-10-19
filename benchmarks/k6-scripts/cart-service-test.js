import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const BASE_URL = __ENV.BASE_URL || "http://localhost:5002";

// Test scenarios - realistic progressive load testing for Cart Service
export const options = {
   scenarios: {
      // Warm-up phase - starts after 5 minutes
      warmup: {
         executor: "ramping-vus",
         startVUs: 0,
         stages: [
            { duration: "30s", target: 20 },
            { duration: "30s", target: 20 },
         ],
         exec: "writeWorkload",
         startTime: "5m",
         tags: { test_type: "warmup" },
      },
      // Write tests - QUADRUPLED (4x original)
      write_low: {
         executor: "ramping-arrival-rate",
         startRate: 40,
         timeUnit: "1s",
         preAllocatedVUs: 20,
         maxVUs: 200,
         stages: [
            { duration: "30s", target: 200 },
            { duration: "30s", target: 200 },
            { duration: "30s", target: 400 },
         ],
         exec: "writeWorkload",
         startTime: "6m",
         tags: { test_type: "write", phase: "low" },
      },
      write_medium: {
         executor: "ramping-arrival-rate",
         startRate: 400,
         timeUnit: "1s",
         preAllocatedVUs: 80,
         maxVUs: 400,
         stages: [
            { duration: "30s", target: 800 },
            { duration: "30s", target: 800 },
            { duration: "30s", target: 1200 },
         ],
         exec: "writeWorkload",
         startTime: "7m30s",
         tags: { test_type: "write", phase: "medium" },
      },
      write_high: {
         executor: "ramping-arrival-rate",
         startRate: 1200,
         timeUnit: "1s",
         preAllocatedVUs: 200,
         maxVUs: 800,
         stages: [
            { duration: "30s", target: 2000 },
            { duration: "30s", target: 2000 },
         ],
         exec: "writeWorkload",
         startTime: "9m",
         tags: { test_type: "write", phase: "high" },
      },
      // Cool down before reads
      cooldown: {
         executor: "ramping-vus",
         startVUs: 1,
         stages: [{ duration: "30s", target: 1 }],
         exec: "readWorkload",
         startTime: "10m",
         tags: { test_type: "cooldown" },
      },
      // Read tests - QUADRUPLED (4x original)
      read_low: {
         executor: "ramping-arrival-rate",
         startRate: 40,
         timeUnit: "1s",
         preAllocatedVUs: 20,
         maxVUs: 200,
         stages: [
            { duration: "30s", target: 400 },
            { duration: "30s", target: 400 },
            { duration: "30s", target: 800 },
         ],
         exec: "readWorkload",
         startTime: "10m30s",
         tags: { test_type: "read", phase: "low" },
      },
      read_medium: {
         executor: "ramping-arrival-rate",
         startRate: 800,
         timeUnit: "1s",
         preAllocatedVUs: 80,
         maxVUs: 400,
         stages: [
            { duration: "30s", target: 1600 },
            { duration: "30s", target: 1600 },
            { duration: "30s", target: 2400 },
         ],
         exec: "readWorkload",
         startTime: "12m",
         tags: { test_type: "read", phase: "medium" },
      },
      read_high: {
         executor: "ramping-arrival-rate",
         startRate: 2400,
         timeUnit: "1s",
         preAllocatedVUs: 200,
         maxVUs: 800,
         stages: [
            { duration: "30s", target: 4000 },
            { duration: "30s", target: 4000 },
         ],
         exec: "readWorkload",
         startTime: "13m30s",
         tags: { test_type: "read", phase: "high" },
      },
   },
   thresholds: {
      http_req_duration: ["p(95)<5000", "p(99)<10000"],
      http_req_failed: ["rate<0.8"],
      errors: ["rate<0.8"],
   },
   discardResponseBodies: true,
   noConnectionReuse: false,
   userAgent: "k6-cart-service-test",
};

// Read workload - GET cart
export function readWorkload() {
   const userId = Math.floor(Math.random() * 10000) + 1;

   const params = {
      timeout: "10s",
   };

   const res = http.get(`${BASE_URL}/api/cart/${userId}`, params);

   const result = check(res, {
      "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
      "response time < 2000ms": (r) => r.timings.duration < 2000,
   });

   errorRate.add(!result);
   sleep(0.5);
}

// Write workload - POST/PUT cart items
export function writeWorkload() {
   const userId = Math.floor(Math.random() * 10000) + 1;
   const payload = JSON.stringify({
      userId: userId,
      productId: "68e8a35e172f34a33d7dfdf1",
      quantity: Math.floor(Math.random() * 5) + 1,
   });

   const params = {
      headers: {
         "Content-Type": "application/json",
      },
      timeout: "10s",
   };

   const res = http.post(
      `${BASE_URL}/api/cart/68e8d840aa6f96ba9ff5b772/items`,
      payload,
      params
   );

   const result = check(res, {
      "status is 201 or 200": (r) => r.status === 201 || r.status === 200,
      "response time < 2000ms": (r) => r.timings.duration < 2000,
   });

   errorRate.add(!result);
   sleep(0.5);
}
