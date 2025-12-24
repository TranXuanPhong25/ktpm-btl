import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
   stages: [
      { duration: "30s", target: 300 }, // Ramp up to 400 users
      { duration: "1m", target: 500 }, // Peak load - 800 users
      { duration: "30s", target: 200 }, // Ramp down to 400 users
      { duration: "30s", target: 0 }, // Ramp down to 0
   ],
   thresholds: {
      http_req_duration: ["p(95)<2000", "p(99)<3000"], // 95% under 2s, 99% under 3s
      errors: ["rate<0.05"], // Error rate should be less than 5%
      http_req_failed: ["rate<0.05"], // Failed requests should be less than 5%
   },
};

const BASE_URL = "http://localhost";

// Product IDs with high stock
const PRODUCT_IDS = [
   "694800137b13aef06ae52dfa",
   "694800147b13aef06ae52e01",
   "6948002a7b13aef06ae52e5c",
   "6948002a7b13aef06ae52e63",
   "6948002d7b13aef06ae52e6a",
];

// Test user credentials (make sure these exist in your system)
const TEST_USER = {
   email: "testuser@example.com",
   password: "testpass123",
};

let authToken =
   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZhZTZjZTZjYTZhNjJlNDUxZmFjM2EiLCJpYXQiOjE3NjU5ODMwMjMsImV4cCI6MTc2NTk4NjYyM30.T9vw_n2rcUHaOgLlxJUcme62nipXvmSvhmMa3KBXeJA";

export default function (data) {
   const token = authToken;
   const headers = token
      ? {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
        }
      : {
           "Content-Type": "application/json",
        };

   // GET random product by ID from catalog
   const productId =
      PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
   const catalogRes = http.get(`${BASE_URL}/api/product-catalog/${productId}`);

   const catalogCheck = check(catalogRes, {
      "catalog status is 200": (r) => r.status === 200,
      "catalog has product": (r) => {
         try {
            const body = JSON.parse(r.body);
            return body._id || body.id;
         } catch (e) {
            return false;
         }
      },
   });

   errorRate.add(!catalogCheck);

   // GET inventory for the same product
   // const inventoryRes = http.get(
   //    `${BASE_URL}/api/product-inventory/${productId}`
   // );

   // const inventoryCheck = check(inventoryRes, {
   //    "inventory status is 200": (r) => r.status === 200,
   //    "inventory has quantity": (r) => {
   //       try {
   //          const body = JSON.parse(r.body);
   //          return body.quantity !== undefined || body.stock !== undefined;
   //       } catch (e) {
   //          return false;
   //       }
   //    },
   // });

   // errorRate.add(!inventoryCheck);

   // Place order if we have a token
   if (token) {
      const orderPayload = JSON.stringify({
         items: [
            {
               productId: productId,
               quantity: 1,
               price: 99.99,
            },
         ],
         totalAmount: 99.99,
         shippingAddress: {
            street: "123 Test St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "Test Country",
         },
      });

      const orderRes = http.post(
         `${BASE_URL}/api/orders/68fae6ce6ca6a62e451fac3a`,
         orderPayload,
         {
            headers,
         }
      );

      const orderCheck = check(orderRes, {
         "order status is 200 or 201": (r) =>
            r.status === 200 || r.status === 201,
         "order created successfully": (r) => {
            try {
               const body = JSON.parse(r.body);
               return body.orderId || body.id || body._id;
            } catch (e) {
               return false;
            }
         },
         "no 503 error": (r) => r.status !== 503,
         "no 404 error": (r) => r.status !== 404,
         "no 500 error": (r) => r.status !== 500,
      });

      errorRate.add(!orderCheck);
   }
}
