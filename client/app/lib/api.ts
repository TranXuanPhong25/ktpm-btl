// API base configuration
const API_BASE_URL = "http://localhost:80";

class ApiClient {
   private baseURL: string;

   constructor(baseURL: string) {
      this.baseURL = baseURL;
   }

   private async request<T>(
      endpoint: string,
      options: RequestInit = {}
   ): Promise<T> {
      const url = `${this.baseURL}${endpoint}`;

      const token = localStorage.getItem("token");
      const config: RequestInit = {
         headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
         },
         ...options,
      };

      try {
         const response = await fetch(url, config);

         if (!response.ok) {
            const error = await response
               .json()
               .catch(() => ({ error: "Request failed" }));
            console.log(error);
            throw new Error(
               error.msg || `HTTP error! status: ${response.status}`
            );
         }

         return await response.json();
      } catch (error) {
         console.error("API request failed:", error);
         throw error;
      }
   }

   // Auth API
   async register(userData: { name: string; email: string; password: string }) {
      return this.request("/api/auth/register", {
         method: "POST",
         body: JSON.stringify(userData),
      });
   }

   async login(credentials: { email: string; password: string }) {
      return this.request("/api/auth/login", {
         method: "POST",
         body: JSON.stringify(credentials),
      });
   }

   // Product API (using product-catalog service)
   async getProducts() {
      return this.request("/api/product-catalog/");
   }

   async getProduct(id: string) {
      return this.request(`/api/product-catalog/${id}`);
   }

   async createProduct(product: {
      name: string;
      description: string;
      price: number;
      category: string;
      stock: number;
   }) {
      return this.request("/api/product-catalog/", {
         method: "POST",
         body: JSON.stringify(product),
      });
   }

   async updateProduct(
      id: string,
      product: Partial<{
         name: string;
         description: string;
         price: number;
         category: string;
         stock: number;
      }>
   ) {
      return this.request(`/api/product-catalog/${id}`, {
         method: "PUT",
         body: JSON.stringify(product),
      });
   }

   async deleteProduct(id: string) {
      return this.request(`/api/product-catalog/${id}`, {
         method: "DELETE",
      });
   }

   // Cart API
   async getCart(userId: string) {
      return this.request(`/api/cart/${userId}`);
   }

   async addToCart(
      userId: string,
      item: {
         productId: string;
         quantity: number;
      }
   ) {
      return this.request(`/api/cart/${userId}/items`, {
         method: "POST",
         body: JSON.stringify(item),
      });
   }

   async removeFromCart(userId: string, productId: string) {
      return this.request(`/api/cart/${userId}/items/${productId}`, {
         method: "DELETE",
      });
   }

   async clearCart(userId: string) {
      return this.request(`/api/cart/${userId}`, {
         method: "DELETE",
      });
   }

   // Order API
   async createOrder(
      userId: string,
      orderData: {
         items: Array<{
            productId: string;
            quantity: number;
         }>;
      }
   ) {
      return this.request(`/api/orders/${userId}`, {
         method: "POST",
         body: JSON.stringify(orderData),
      });
   }

   async getOrders(userId: string) {
      return this.request(`/api/orders/${userId}`);
   }

   async getOrder(userId: string, orderId: string) {
      return this.request(`/api/orders/${userId}/${orderId}`);
   }

   async updateOrderStatus(orderId: string, status: string) {
      return this.request(`/api/orders/${orderId}/status`, {
         method: "PUT",
         body: JSON.stringify({ status }),
      });
   }

   // Payment API
   async processPayment(
      orderId: string,
      paymentData: {
         amount: number;
         userId: string;
      }
   ) {
      return this.request(`/api/payments/order/${orderId}`, {
         method: "POST",
         body: JSON.stringify(paymentData),
      });
   }

   async getPayment(paymentId: string) {
      return this.request(`/api/payments/${paymentId}`);
   }

   async getOrderPayments(orderId: string) {
      return this.request(`/api/payments/order/${orderId}`);
   }

   async getPayments(params?: {
      status?: string;
      paymentMethod?: string;
      page?: number;
      limit?: number;
   }) {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set("status", params.status);
      if (params?.paymentMethod)
         queryParams.set("paymentMethod", params.paymentMethod);
      if (params?.page) queryParams.set("page", params.page.toString());
      if (params?.limit) queryParams.set("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.request(
         `/api/payments${queryString ? `?${queryString}` : ""}`
      );
   }
}

export const apiClient = new ApiClient(API_BASE_URL);
