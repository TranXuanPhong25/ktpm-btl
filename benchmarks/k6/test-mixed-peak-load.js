import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const failureCounter = new Counter("failed_requests");
const catalogFailure = new Counter("catalog_failed_requests");
const catalogSuccess = new Rate("catalog_success");

// Configuration
const BASE_URL = "http://localhost:80/api";
// Token này có thể hết hạn, nếu cần hãy cập nhật lại từ login response
const AUTH_TOKEN =
   "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZhZTZjZTZjYTZhNjJlNDUxZmFjM2EiLCJpYXQiOjE3NjUyNDI1NjUsImV4cCI6MTc2NTI0NjE2NX0.dcC-r-F3b4pOnugTqsnMuCnO3CtrRxPZfcdGGEPKoQw";

export const options = {
   discardResponseBodies: true,

   scenarios: {
      // Scenario 1: Order Stress Test
      order_stress: {
         executor: "ramping-vus",
         startVUs: 50,
         stages: [
            { duration: "1m", target: 500 }, // Ramp up nhanh
            { duration: "3m", target: 1000 }, // Giữ tải cao (1000 VUs)
            { duration: "1m", target: 0 }, // Ramp down
         ],
         gracefulRampDown: "30s",
      },

      // Scenario 2: Catalog Stress Test (Chạy đồng thời)
      catalog_stress: {
         exec: "catalogPeak", // Gọi function catalogPeak
         executor: "ramping-vus",
         startVUs: 50,
         stages: [
            { duration: "1m", target: 500 }, // Ramp up nhanh
            { duration: "3m", target: 1000 }, // Giữ tải cao (1000 VUs)
            { duration: "1m", target: 0 }, // Ramp down
         ],
         gracefulRampDown: "30s",
      },
   },

   thresholds: {
      http_req_duration: ["p(95)<3000", "p(99)<5000"], // Nới lỏng threshold vì chạy đồng thời tải cao
      http_req_failed: ["rate<0.1"],
      errors: ["rate<0.15"],
      catalog_success: ["rate>0.85"],
   },
};

const TEST_PRODUCTS = ["693776920f8605c1a93c9a6b"];
const TEST_USERS = ["68fae6ce6ca6a62e451fac3a"];
const SAMPLE_PRODUCT_ID = "693776920f8605c1a93c9a6b";

function randomChoice(arr) {
   return arr[Math.floor(Math.random() * arr.length)];
}

function randomPage(maxPage = 10) {
   return Math.floor(Math.random() * maxPage) + 1;
}

// Default function: Order Placement
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

   const success = check(response, {
      "status is 201": (r) => r.status === 201,
      "status is 200 or 201": (r) => r.status === 200 || r.status === 201,
      "response time < 3s": (r) => r.timings.duration < 3000,
   });

   errorRate.add(!success);

   if (!success) {
      failureCounter.add(1);
   }
}

// Function for Catalog Peak Load
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
   console.log("🚀 Starting Mixed Peak Load Test (Order + Catalog)");
}

export function teardown(data) {
   console.log("✅ Test completed");
}
