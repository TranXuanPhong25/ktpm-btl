#!/bin/bash

# Quick test runner for individual services
# Usage: ./run-test.sh <service-name> [base-url]

SERVICE=$1
BASE_URL=${2:-"http://localhost"}

if [ -z "$SERVICE" ]; then
  echo "Usage: ./run-test.sh <service-name> [base-url]"
  echo ""
  echo "Available services:"
  echo "  - user-service (default port: 5000)"
  echo "  - product-service (default port: 5001)"
  echo "  - order-service (default port: 5003)"
  echo "  - cart-service (default port: 5002)"
  echo "  - payment-service (default port: 5004)"
  echo "  - notification-service (default port: 5005)"
  echo ""
  echo "Example: ./run-test.sh user-service"
  echo "Example: ./run-test.sh user-service http://my-domain.com"
  exit 1
fi

# Set default ports
case $SERVICE in
  "user-service")
    PORT=5000
    ;;
  "product-service")
    PORT=5001
    ;;
  "order-service")
    PORT=5003
    ;;
  "cart-service")
    PORT=5002
    ;;
  "payment-service")
    PORT=5004
    ;;
  "notification-service")
    PORT=5005
    ;;
  *)
    echo "Unknown service: $SERVICE"
    exit 1
    ;;
esac

SCRIPT="./k6-scripts/${SERVICE}-test.js"
RESULTS_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULTS_DIR}/${SERVICE}_${TIMESTAMP}.json"

if [ ! -f "$SCRIPT" ]; then
  echo "Error: Test script not found: $SCRIPT"
  exit 1
fi

mkdir -p "$RESULTS_DIR"

echo "Running K6 test for $SERVICE"
echo "Base URL: ${BASE_URL}:${PORT}"
echo "Results will be saved to: $RESULT_FILE"
echo ""

BASE_URL="${BASE_URL}:${PORT}" k6 run --out json="$RESULT_FILE" "$SCRIPT"

echo ""
echo "Test completed. Results saved to: $RESULT_FILE"
