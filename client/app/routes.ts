import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/login", "routes/login.tsx"),
  route("/register", "routes/register.tsx"),
  route("/products", "routes/products.tsx"),
  route("/cart", "routes/cart.tsx"),
  route("/orders", "routes/orders.tsx"),
] satisfies RouteConfig;
