import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics"; // Import thêm Counter

// Custom metrics
const errorRate = new Rate("errors");
const failureCounter = new Counter("failed_requests");
const catalogFailure = new Counter("catalog_failed_requests");
const catalogSuccess = new Rate("catalog_success");

// Configuration
const BASE_URL = "http://localhost:80/api";
const AUTH_TOKEN =
   "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZhZTZjZTZjYTZhNjJlNDUxZmFjM2EiLCJpYXQiOjE3NjUyODMyNTAsImV4cCI6MTc2NTI4Njg1MH0.gT4hKbI2AEc7K3TcQrXSe-qqgG3wMNyC1yis-gYTf4I"; // (Đã rút gọn)

export const options = {
   // 1. SỬA LỖI: Đưa config này vào trong options
   discardResponseBodies: true,

   scenarios: {
      warm_up: {
         executor: "ramping-vus",
         startVUs: 0,
         stages: [
            { duration: "30s", target: 50 },
            { duration: "1m", target: 50 },
         ],
         gracefulRampDown: "10s",
      },
      peak_spike: {
         executor: "ramping-vus",
         startTime: "1m30s",
         startVUs: 50,
         stages: [
            { duration: "10s", target: 200 },
            { duration: "2m", target: 200 },
            { duration: "30s", target: 300 },
            { duration: "1m", target: 300 },
            { duration: "30s", target: 50 },
         ],
         gracefulRampDown: "20s",
      },
      stress_test: {
         executor: "ramping-arrival-rate",
         startTime: "5m40s",
         preAllocatedVUs: 500,
         maxVUs: 2000,
         stages: [
            { duration: "1m", target: 100 },
            { duration: "2m", target: 500 },
            { duration: "1m", target: 1000 },
            { duration: "30s", target: 0 },
         ],
      },

      catalog_peak: {
         exec: "catalogPeak",
         executor: "ramping-vus",
         startTime: "7m",
         startVUs: 0,
         stages: [
            { duration: "30s", target: 100 },
            { duration: "1m", target: 250 },
            { duration: "90s", target: 250 },
            { duration: "30s", target: 0 },
         ],
         gracefulRampDown: "15s",
      },
   },

   thresholds: {
      http_req_duration: ["p(95)<2000", "p(99)<5000"],
      http_req_failed: ["rate<0.1"],
      errors: ["rate<0.15"],
      catalog_success: ["rate>0.85"],
   },
};

const TEST_PRODUCTS = ["693776920f8605c1a93c9a6b"];
const TEST_USERS = ["68fae6ce6ca6a62e451fac3a"];
const SAMPLE_PRODUCT_ID = "693776920f8605c1a93c9a6b"; // For single product detail test

function randomChoice(arr) {
   return arr[Math.floor(Math.random() * arr.length)];
}

function randomPage(maxPage = 10) {
   return Math.floor(Math.random() * maxPage) + 1;
}

export default function () {
   const productId = randomChoice(TEST_PRODUCTS);
   const userId = randomChoice(TEST_USERS);

   const payload = JSON.stringify({
      items: [
         {
            productId: productId,
            quantity: Math.floor(Math.random() * 3) + 1,
            category: "Electronics",
            price: Math.floor(Math.random() * 500) + 100,
         },
      ],
   });

   const params = {
      headers: {
         "Content-Type": "application/json",
         Authorization: AUTH_TOKEN,
      },
      tags: { name: "CreateOrder" },
   };

   const response = http.post(`${BASE_URL}/orders/${userId}`, payload, params);

   // 2. SỬA LỖI: Bỏ check body vì discardResponseBodies = true
   const success = check(response, {
      "status is 201": (r) => r.status === 201,
      "status is 200 or 201": (r) => r.status === 200 || r.status === 201,
      // "response has orderId": ... -> Đã bỏ check này để tối ưu performance
      "response time < 3s": (r) => r.timings.duration < 3000,
   });

   errorRate.add(!success);

   // 3. SỬA LỖI: Thay console.error bằng Counter để tránh lag máy
   if (!success) {
      failureCounter.add(1);
      // Chỉ in log nếu muốn debug kỹ (nên comment lại khi chạy stress test thật)
      // console.error(`Failed: ${response.status}`);
   }
}

// Test function for catalog peak load
export function catalogPeak() {
   const testType = Math.random();
   let response;
   let params = {
      headers: {
         "Content-Type": "application/json",
         Authorization: AUTH_TOKEN,
      },
   };

   // 30% get all products with limit=10
   if (testType < 0.3) {
      const page = randomPage(20);
      response = http.get(
         `${BASE_URL}/product-catalog?limit=10&page=${page}`,
         params
      );
      params.tags = { name: "GetAllProducts" };
   }
   // 30% get random page with different limits
   else if (testType < 0.6) {
      const page = randomPage(15);
      const limit = [10, 20, 50][Math.floor(Math.random() * 3)];
      response = http.get(
         `${BASE_URL}/product-catalog?limit=${limit}&page=${page}`,
         params
      );
      params.tags = { name: "GetPaginatedProducts" };
   }
   // 40% get single catalog detail
   else {
      response = http.get(
         `${BASE_URL}/product-catalog/${SAMPLE_PRODUCT_ID}`,
         params
      );
      params.tags = { name: "GetSingleProduct" };
   }

   const success = check(response, {
      "status is 200": (r) => r.status === 200,
      "response time < 1s": (r) => r.timings.duration < 1000,
   });

   catalogSuccess.add(success);

   if (!success) {
      catalogFailure.add(1);
   }
}

export function setup() {
   console.log("🚀 Starting Order Service Peak Load Test");
}

export function teardown(data) {
   console.log("✅ Test completed");
}
