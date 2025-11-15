#!/bin/bash

# Script to create products with fixed ID range
# ID format: 68f1f642023c5a0cd694xxxx (where xxxx is 4 hex digits)

# Configuration
API_URL="http://localhost:80/api/product-catalog"
PREFIX="68f1f642023c5a0cd694"
NUM_PRODUCTS=65555  # Number of products to create

# Product templates
declare -a CATEGORIES=("Electronics" "Clothing" "Books" "Home & Garden" "Sports" "Toys")
declare -a PRODUCT_NAMES=(
    "Premium Laptop"
    "Wireless Headphones"
    "Smart Watch"
    "Digital Camera"
    "Bluetooth Speaker"
    "Gaming Console"
    "T-Shirt"
    "Jeans"
    "Sneakers"
    "Jacket"
    "Novel Book"
    "Cookbook"
    "Garden Tools"
    "Yoga Mat"
    "Basketball"
    "Action Figure"
)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Creating Products with Fixed ID Range${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "API URL: $API_URL"
echo "ID Prefix: $PREFIX"
echo "Number of products: $NUM_PRODUCTS"
echo ""

# Counter for success/failure
SUCCESS_COUNT=0
FAIL_COUNT=0

# Create products
for ((i=0; i<$NUM_PRODUCTS; i++)); do
    # Generate 4-digit hex suffix (0000 to ffff)
    SUFFIX=$(printf "%04x" $i)
    PRODUCT_ID="${PREFIX}${SUFFIX}"
    
    # Random product details
    NAME_INDEX=$((RANDOM % ${#PRODUCT_NAMES[@]}))
    CATEGORY_INDEX=$((RANDOM % ${#CATEGORIES[@]}))
    PRODUCT_NAME="${PRODUCT_NAMES[$NAME_INDEX]} #$((i+1))"
    CATEGORY="${CATEGORIES[$CATEGORY_INDEX]}"
    PRICE=$((RANDOM % 900 + 100))  # Price between 100 and 1000
    DESCRIPTION="High quality $PRODUCT_NAME in $CATEGORY category"
    
    # Create JSON payload
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
    
    # Make POST request
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    # Extract HTTP status code
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
    
    # Check if successful
    if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} Created product $PRODUCT_ID - $PRODUCT_NAME (${PRICE}$) [HTTP $HTTP_CODE]"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗${NC} Failed to create $PRODUCT_ID [HTTP $HTTP_CODE]"
        echo "   Response: $RESPONSE_BODY"
        ((FAIL_COUNT++))
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.1
done

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Success: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo -e "${BLUE}Total: $NUM_PRODUCTS${NC}"
echo ""

# Now create inventory for these products
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Creating Product Inventory${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

INVENTORY_API_URL="http://localhost:80/api/product-inventory"
INVENTORY_SUCCESS=0
INVENTORY_FAIL=0

for ((i=0; i<$NUM_PRODUCTS; i++)); do
    SUFFIX=$(printf "%04x" $i)
    PRODUCT_ID="${PREFIX}${SUFFIX}"
    STOCK=$((RANDOM % 900 + 100))  # Stock between 100 and 1000
    
    JSON_PAYLOAD=$(cat <<EOF
{
    "_id": "$PRODUCT_ID",
    "stock": $STOCK
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$INVENTORY_API_URL" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "${GREEN}✓${NC} Created inventory for $PRODUCT_ID - Stock: $STOCK [HTTP $HTTP_CODE]"
        ((INVENTORY_SUCCESS++))
    else
        echo -e "${RED}✗${NC} Failed to create inventory for $PRODUCT_ID [HTTP $HTTP_CODE]"
        echo "   Response: $RESPONSE_BODY"
        ((INVENTORY_FAIL++))
    fi
    
    sleep 0.1
done

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Inventory Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Success: $INVENTORY_SUCCESS${NC}"
echo -e "${RED}Failed: $INVENTORY_FAIL${NC}"
echo -e "${BLUE}Total: $NUM_PRODUCTS${NC}"
echo ""
echo -e "${GREEN}Done!${NC}"
