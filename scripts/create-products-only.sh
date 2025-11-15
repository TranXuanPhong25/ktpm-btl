#!/bin/bash

# Script to create only product catalog with fixed ID range
# ID format: 68f1f642023c5a0cd694xxxx (where xxxx is 4 hex digits: 0000-ffff)

# Configuration
API_URL="${API_URL:-http://localhost:80/api/product-catalog}"
PREFIX="68f1f642023c5a0cd694"
START_INDEX="${START_INDEX:-0}"
END_INDEX="${END_INDEX:-100}"

# Product templates
declare -a CATEGORIES=("Electronics" "Clothing" "Books" "Home & Garden" "Sports" "Toys" "Food & Beverage" "Beauty" "Automotive" "Pet Supplies")
declare -a PRODUCT_NAMES=(
    "Premium Laptop" "Wireless Headphones" "Smart Watch" "Digital Camera" "Bluetooth Speaker"
    "Gaming Console" "Tablet" "USB Cable" "Power Bank" "Monitor"
    "T-Shirt" "Jeans" "Sneakers" "Jacket" "Hat"
    "Novel Book" "Cookbook" "Magazine" "Comic Book" "Textbook"
    "Garden Tools" "Plant Pot" "Fertilizer" "Watering Can" "Seeds"
    "Yoga Mat" "Basketball" "Tennis Racket" "Dumbbell" "Running Shoes"
    "Action Figure" "Board Game" "Puzzle" "Doll" "Remote Control Car"
)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Creating Products (Catalog Only)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "API URL: $API_URL"
echo "ID Prefix: $PREFIX"
echo "Range: $START_INDEX to $((END_INDEX-1)) (Total: $((END_INDEX-START_INDEX)))"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
START_TIME=$(date +%s)

for ((i=$START_INDEX; i<$END_INDEX; i++)); do
    SUFFIX=$(printf "%04x" $i)
    PRODUCT_ID="${PREFIX}${SUFFIX}"
    
    # Random product details
    NAME_INDEX=$((RANDOM % ${#PRODUCT_NAMES[@]}))
    CATEGORY_INDEX=$((RANDOM % ${#CATEGORIES[@]}))
    PRODUCT_NAME="${PRODUCT_NAMES[$NAME_INDEX]} #$i"
    CATEGORY="${CATEGORIES[$CATEGORY_INDEX]}"
    PRICE=$((RANDOM % 900 + 100))
    DESCRIPTION="High quality $PRODUCT_NAME in $CATEGORY category. Product ID: $PRODUCT_ID"
    
    JSON_PAYLOAD=$(cat <<EOF
{
    "_id": "$PRODUCT_ID",
    "name": "$PRODUCT_NAME",
    "description": "$DESCRIPTION",
    "price": $PRICE,
    "category": "$CATEGORY"
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD" 2>/dev/null)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} [$((i-START_INDEX+1))/$((END_INDEX-START_INDEX))] $PRODUCT_ID - $PRODUCT_NAME (\$${PRICE})"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗${NC} [$((i-START_INDEX+1))/$((END_INDEX-START_INDEX))] Failed: $PRODUCT_ID [HTTP $HTTP_CODE]"
        ((FAIL_COUNT++))
    fi
    
    # Progress indicator every 10 items
    if [ $((($i - $START_INDEX + 1) % 10)) -eq 0 ]; then
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))
        RATE=$(echo "scale=2; ($i - $START_INDEX + 1) / $ELAPSED" | bc 2>/dev/null || echo "N/A")
        echo -e "${YELLOW}   Progress: $((i-START_INDEX+1))/$((END_INDEX-START_INDEX)) | Rate: ${RATE} items/sec${NC}"
    fi
done

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✓ Success: $SUCCESS_COUNT${NC}"
echo -e "${RED}✗ Failed:  $FAIL_COUNT${NC}"
echo -e "${BLUE}━ Total:   $((END_INDEX-START_INDEX))${NC}"
echo -e "${YELLOW}⏱ Time:    ${TOTAL_TIME}s${NC}"
if [ $TOTAL_TIME -gt 0 ]; then
    AVG_RATE=$(echo "scale=2; $SUCCESS_COUNT / $TOTAL_TIME" | bc 2>/dev/null || echo "N/A")
    echo -e "${YELLOW}⚡ Avg Rate: ${AVG_RATE} items/sec${NC}"
fi
echo ""
