#!/bin/bash

# Master script to create both products and inventory
# ID format: 68f1f642023c5a0cd694xxxx (where xxxx is 4 hex digits: 0000-ffff)

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NUM_PRODUCTS="${NUM_PRODUCTS:-10000}"
CATALOG_API="${CATALOG_API:-http://localhost:80/api/product-catalog}"
INVENTORY_API="${INVENTORY_API:-http://localhost:80/api/product-inventory}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Master Script: Create Products & Inventory${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Total products to create: $NUM_PRODUCTS"
echo ""

# Make scripts executable
chmod +x "$SCRIPT_DIR/create-products-only.sh" 2>/dev/null
chmod +x "$SCRIPT_DIR/create-inventory-only.sh" 2>/dev/null

# Step 1: Create product catalog
echo -e "${YELLOW}[1/2] Creating Product Catalog...${NC}"
echo ""
API_URL="$CATALOG_API" START_INDEX=0 END_INDEX="$NUM_PRODUCTS" "$SCRIPT_DIR/create-products-only.sh"
CATALOG_EXIT=$?

if [ $CATALOG_EXIT -ne 0 ]; then
    echo -e "${RED}✗ Product catalog creation failed!${NC}"
    exit 1
fi

# Small delay between operations
echo ""
echo -e "${YELLOW}Waiting 2 seconds before creating inventory...${NC}"
sleep 2
echo ""

# Step 2: Create product inventory
echo -e "${YELLOW}[2/2] Creating Product Inventory...${NC}"
echo ""
API_URL="$INVENTORY_API" START_INDEX=0 END_INDEX="$NUM_PRODUCTS" "$SCRIPT_DIR/create-inventory-only.sh"
INVENTORY_EXIT=$?

if [ $INVENTORY_EXIT -ne 0 ]; then
    echo -e "${RED}✗ Product inventory creation failed!${NC}"
    exit 1
fi

# Final summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  All Done!${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}✓ Product catalog created${NC}"
echo -e "${GREEN}✓ Product inventory created${NC}"
echo -e "${YELLOW}  Total products: $NUM_PRODUCTS${NC}"
echo -e "${YELLOW}  ID Range: 68f1f642023c5a0cd6940000 - 68f1f642023c5a0cd694$(printf "%04x" $((NUM_PRODUCTS-1)))${NC}"
echo ""
