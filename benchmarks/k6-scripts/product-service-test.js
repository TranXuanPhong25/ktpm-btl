import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";

// Test scenarios - READ ONLY workload testing for Product Service
export const options = {
   scenarios: {
      // Read tests only - get products
      read_low: {
         executor: "ramping-vus",
         startVUs: 5,
         stages: [
            { duration: "30s", target: 1000 },
            { duration: "30s", target: 500 },
            { duration: "30s", target: 1000 },
         ],
         exec: "readWorkload",
         startTime: "0s",
         tags: { test_type: "read", phase: "low" },
      },
      read_medium: {
         executor: "ramping-vus",
         startVUs: 30,
         stages: [
            { duration: "30s", target: 1000 },
            { duration: "30s", target: 1000 },
            { duration: "30s", target: 1000 },
         ],
         exec: "readWorkload",
         startTime: "1m30s",
         tags: { test_type: "read", phase: "medium" },
      },
      read_high: {
         executor: "ramping-vus",
         startVUs: 70,
         stages: [
            { duration: "30s", target: 1000 },
            { duration: "30s", target: 1000 },
         ],
         exec: "readWorkload",
         startTime: "3m",
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
   userAgent: "k6-product-service-test",
   batch: 10,
   summaryTrendStats: ["avg", "min", "max", "p(95)", "p(99)"],
   systemTags: ["status", "method", "url", "name", "group", "check", "error"],
};

// Read workload - GET products with batching for higher throughput
export function readWorkload() {
   // MongoDB ObjectIds are 24 character hexadecimal strings
   // Creating a function to generate a random ObjectId-like string
   function generateRandomObjectId() {
      return Array.from(Array(24))
         .map(() => Math.floor(Math.random() * 16).toString(16))
         .join("");
   }

   // Use batch to send multiple requests in parallel - 3x throughput!
   // Use URL grouping to reduce cardinality
   // const responses = http.batch([
   //   ['GET', `${BASE_URL}/api/products/${generateRandomObjectId()}`, null, {
   //     timeout: '5s',
   //     tags: { name: 'GetProductById' } // Group all get-by-id requests
   //   }],
   //    ['GET', `${BASE_URL}/api/products/${generateRandomObjectId()}`, null, {
   //     timeout: '5s',
   //     tags: { name: 'GetProductById' } // Group all get-by-id requests
   //   }],
   // ]);
   const responses = http.batch([
      [
         "GET",
         `http://localhost:8081/webflux/${generateRandomObjectId()}`,
         null,
         {
            timeout: "5s",
            tags: { name: "GetProductById" }, // Group all get-by-id requests
         },
      ],
      [
         "GET",
         `http://localhost:8081/webflux/${generateRandomObjectId()}`,
         null,
         {
            timeout: "5s",
            tags: { name: "GetProductById" }, // Group all get-by-id requests
         },
      ],
   ]);

   // Check all responses
   responses.forEach((res) => {
      const result = check(res, {
         "status ok": (r) => r.status === 200 || r.status === 404,
      });
      errorRate.add(!result);
   });

   // No sleep for maximum throughput
} // Write workload - POST/PUT products
export function writeWorkload() {
   const randomNum = Math.floor(Math.random() * 1000000);
   const payload = JSON.stringify({
      name: `Product ${randomNum}`,
      description: `Test product description ${randomNum}`,
      price: Math.floor(Math.random() * 1000) + 10,
      category: ["electronics", "clothing", "books", "toys"][
         Math.floor(Math.random() * 4)
      ],
      stock: Math.floor(Math.random() * 100) + 1,
   });

   const params = {
      headers: {
         "Content-Type": "application/json",
      },
      timeout: "5s",
      tags: { name: "CreateProduct" }, // Group all POST requests
   };

   const res = http.post(`${BASE_URL}/api/products`, payload, params);

   const result = check(res, {
      "status ok": (r) => r.status === 201 || r.status === 200,
   });

   errorRate.add(!result);
   // No sleep for maximum throughput
}
