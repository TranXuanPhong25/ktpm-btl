#!/bin/bash

# K6 Benchmark Test Runner
# This script runs all K6 tests for each microservice and saves results

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESULTS_DIR="./benchmarks/results"
SCRIPTS_DIR="./benchmarks/k6-scripts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Service configurations (name:port)
declare -A SERVICES=(
  ["user-service"]="5000"
  ["product-service"]="5001"
  ["cart-service"]="5002"
  ["order-service"]="5003"
  ["payment-service"]="5004"
  ["notification-service"]="5005"
)

# Create results directory if it doesn't exist
mkdir -p "$RESULTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}K6 Benchmark Test Suite${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Timestamp: $TIMESTAMP"
echo -e "Results directory: $RESULTS_DIR"
echo ""

# Function to check if k6 is installed
check_k6() {
  if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 from https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
  echo -e "${GREEN}✓ k6 is installed${NC}"
}

# Function to check if a service is running
check_service() {
  local service=$1
  local port=$2
  
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ $service is running on port $port${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠ Warning: $service may not be running on port $port${NC}"
    return 1
  fi
}

# Function to run a k6 test
run_test() {
  local service=$1
  local port=$2
  local script="${SCRIPTS_DIR}/${service}-test.js"
  local result_file="${RESULTS_DIR}/${service}_${TIMESTAMP}.json"
  local summary_file="${RESULTS_DIR}/${service}_${TIMESTAMP}_summary.txt"
  
  echo ""
  echo -e "${YELLOW}----------------------------------------${NC}"
  echo -e "${YELLOW}Testing: $service${NC}"
  echo -e "${YELLOW}----------------------------------------${NC}"
  
  if [ ! -f "$script" ]; then
    echo -e "${RED}Error: Script not found: $script${NC}"
    return 1
  fi
  
  echo "Script: $script"
  echo "Base URL: http://localhost:$port"
  echo "Results: $result_file"
  echo ""
  
  # Run k6 test
  BASE_URL="http://localhost:$port" k6 run \
    --out json="$result_file" \
    --summary-export="$summary_file" \
    "$script"
  
  local exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ Test completed successfully${NC}"
  else
    echo -e "${RED}✗ Test failed with exit code: $exit_code${NC}"
  fi
  
  return $exit_code
}

# Function to generate summary report
generate_summary() {
  local summary_file="${RESULTS_DIR}/test_summary_${TIMESTAMP}.txt"
  
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Generating Summary Report${NC}"
  echo -e "${GREEN}========================================${NC}"
  
  {
    echo "K6 Benchmark Test Summary"
    echo "========================="
    echo "Timestamp: $TIMESTAMP"
    echo ""
    echo "Test Results:"
    echo "-------------"
    
    for service in "${!SERVICES[@]}"; do
      local result_file="${RESULTS_DIR}/${service}_${TIMESTAMP}.json"
      if [ -f "$result_file" ]; then
        echo ""
        echo "Service: $service"
        echo "Status: Completed"
        echo "Results file: $result_file"
      else
        echo ""
        echo "Service: $service"
        echo "Status: Failed or Not Run"
      fi
    done
    
    echo ""
    echo "All results saved to: $RESULTS_DIR"
  } | tee "$summary_file"
  
  echo ""
  echo -e "${GREEN}Summary saved to: $summary_file${NC}"
}

# Main execution
main() {
  echo "Checking prerequisites..."
  check_k6
  
  echo ""
  echo "Checking services..."
  local all_running=true
  for service in "${!SERVICES[@]}"; do
    if ! check_service "$service" "${SERVICES[$service]}"; then
      all_running=false
    fi
  done
  
  if [ "$all_running" = false ]; then
    echo ""
    echo -e "${YELLOW}Warning: Some services may not be running${NC}"
    echo "Do you want to continue? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      echo "Test cancelled"
      exit 0
    fi
  fi
  
  echo ""
  echo "Starting tests..."
  
  local failed_tests=0
  local total_tests=${#SERVICES[@]}
  
  for service in "${!SERVICES[@]}"; do
    if ! run_test "$service" "${SERVICES[$service]}"; then
      ((failed_tests++))
    fi
  done
  
  generate_summary
  
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Test Suite Completed${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo "Total tests: $total_tests"
  echo "Passed: $((total_tests - failed_tests))"
  echo "Failed: $failed_tests"
  
  if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}All tests completed successfully!${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
  fi
}

# Run main function
main "$@"
