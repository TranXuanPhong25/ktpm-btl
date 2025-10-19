export interface User {
   _id: string;
   name: string;
   email: string;
   createdAt?: string;
}

export interface Product {
   _id: string;
   name: string;
   description: string;
   price: number;
   category: string;
   stock: number;
   createdAt?: string;
}

export interface CartItem {
   productId: string;
   quantity: number;
   product?: Product;
}

export interface Cart {
   _id: string;
   userId: string;
   items: CartItem[];
   updatedAt?: string;
}

export interface OrderItem {
   productId: string;
   quantity: number;
   price?: number;
}

export interface Order {
   _id: string;
   userId: string;
   items: OrderItem[];
   totalAmount: number;
   status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
   createdAt?: string;
}

export interface Payment {
   _id: string;
   orderId: string;
   amount: number;
   status: string;
   paymentMethod: string;
   createdAt?: string;
}
