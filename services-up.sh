#!/bin/bash
# Start all business services (without relays/sync)


docker compose up \
  auth-service \
  user-service \
  product-catalog \
  product-inventory \
  shopping-cart-service \
  order-service \
  payment-service \
  notification-service \

