import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const BASE_URL = __ENV.BASE_URL || "http://localhost:5005";

export const options = {
   scenarios: {
      // Read workload tests
      read_10k_rps_100_users: {
         executor: "constant-arrival-rate",
         rate: 10000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 100,
         maxVUs: 200,
         exec: "readWorkload",
         startTime: "0s",
         tags: { test_type: "read", rps: "10k", users: "100" },
      },
      read_25k_rps_500_users: {
         executor: "constant-arrival-rate",
         rate: 25000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 500,
         maxVUs: 1000,
         exec: "readWorkload",
         startTime: "40s",
         tags: { test_type: "read", rps: "25k", users: "500" },
      },
      read_50k_rps_1000_users: {
         executor: "constant-arrival-rate",
         rate: 50000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 1000,
         maxVUs: 2000,
         exec: "readWorkload",
         startTime: "80s",
         tags: { test_type: "read", rps: "50k", users: "1000" },
      },
      read_75k_rps_2500_users: {
         executor: "constant-arrival-rate",
         rate: 75000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 2500,
         maxVUs: 3500,
         exec: "readWorkload",
         startTime: "120s",
         tags: { test_type: "read", rps: "75k", users: "2500" },
      },
      read_100k_rps_5000_users: {
         executor: "constant-arrival-rate",
         rate: 100000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 5000,
         maxVUs: 7000,
         exec: "readWorkload",
         startTime: "160s",
         tags: { test_type: "read", rps: "100k", users: "5000" },
      },
      // Write workload tests
      write_10k_rps_100_users: {
         executor: "constant-arrival-rate",
         rate: 10000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 100,
         maxVUs: 200,
         exec: "writeWorkload",
         startTime: "200s",
         tags: { test_type: "write", rps: "10k", users: "100" },
      },
      write_25k_rps_500_users: {
         executor: "constant-arrival-rate",
         rate: 25000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 500,
         maxVUs: 1000,
         exec: "writeWorkload",
         startTime: "240s",
         tags: { test_type: "write", rps: "25k", users: "500" },
      },
      write_50k_rps_1000_users: {
         executor: "constant-arrival-rate",
         rate: 50000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 1000,
         maxVUs: 2000,
         exec: "writeWorkload",
         startTime: "280s",
         tags: { test_type: "write", rps: "50k", users: "1000" },
      },
      write_75k_rps_2500_users: {
         executor: "constant-arrival-rate",
         rate: 75000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 2500,
         maxVUs: 3500,
         exec: "writeWorkload",
         startTime: "320s",
         tags: { test_type: "write", rps: "75k", users: "2500" },
      },
      write_100k_rps_5000_users: {
         executor: "constant-arrival-rate",
         rate: 100000,
         timeUnit: "1s",
         duration: "30s",
         preAllocatedVUs: 5000,
         maxVUs: 7000,
         exec: "writeWorkload",
         startTime: "360s",
         tags: { test_type: "write", rps: "100k", users: "5000" },
      },
   },
   thresholds: {
      http_req_duration: ["p(95)<500", "p(99)<1000"],
      http_req_failed: ["rate<0.1"],
      errors: ["rate<0.1"],
   },
};

// Read workload - GET notification status
export function readWorkload() {
   const notificationId = Math.floor(Math.random() * 10000) + 1;
   const res = http.get(`${BASE_URL}/api/notifications/${notificationId}`);

   const result = check(res, {
      "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
      "response time < 500ms": (r) => r.timings.duration < 500,
   });

   errorRate.add(!result);
   sleep(0.1);
}

// Write workload - POST notification
export function writeWorkload() {
   const notificationType = ["email", "sms"][Math.floor(Math.random() * 2)];
   const payload = JSON.stringify({
      type: notificationType,
      recipient:
         notificationType === "email"
            ? `user${Math.floor(Math.random() * 10000)}@test.com`
            : `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      subject: `Test Notification ${Math.floor(Math.random() * 1000)}`,
      message: `This is a test notification message ${Math.floor(Math.random() * 1000)}`,
   });

   const params = {
      headers: {
         "Content-Type": "application/json",
      },
   };

   const res = http.post(`${BASE_URL}/api/notifications/send`, payload, params);

   const result = check(res, {
      "status is 201 or 200": (r) => r.status === 201 || r.status === 200,
      "response time < 1000ms": (r) => r.timings.duration < 1000,
   });

   errorRate.add(!result);
   sleep(0.1);
}
