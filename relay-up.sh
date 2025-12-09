#!/bin/bash
# Start all relay publishers and sync workers

docker compose up  \
  catalog-relay-publisher \
  order-relay-publisher \
  payment-relay-publisher \
  inventory-relay-publisher \
  inventory-catalog-sync

