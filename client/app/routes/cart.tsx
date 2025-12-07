import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { apiClient } from "../lib/api";
import type { Cart, Product } from "../types";
import { Header } from "../components/Header";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

interface CartItemWithProduct {
   productId: string;
   quantity: number;
   product: Product;
}

export default function CartPage() {
   const [cart, setCart] = useState<Cart | null>(null);
   const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const { user, isLoading: authLoading } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      // Wait for auth to finish loading before checking user
      if (authLoading) return;

      if (!user) {
         navigate("/login");
         return;
      }
      loadCart();
   }, [user, authLoading, navigate]);

   const loadCart = async () => {
      if (!user) return;

      try {
         const cartData = await apiClient.getCart(user._id);
         setCart(cartData);

         // Fetch product details for each cart item
         const itemsWithProducts = await Promise.all(
            cartData.items.map(async (item: any) => {
               try {
                  const product = await apiClient.getProduct(item.productId);
                  return { ...item, product };
               } catch (error) {
                  console.error(
                     `Failed to load product ${item.productId}:`,
                     error
                  );
                  return null;
               }
            })
         );

         setCartItems(
            itemsWithProducts.filter(Boolean) as CartItemWithProduct[]
         );
      } catch (error: any) {
         console.error("Failed to load cart:", error);
         setError(error.message || "Failed to load cart");
      } finally {
         setLoading(false);
      }
   };

   const removeFromCart = async (productId: string) => {
      if (!user) return;

      try {
         await apiClient.removeFromCart(user._id, productId);
         await loadCart();
      } catch (error: any) {
         console.error("Failed to remove from cart:", error);
         toast.error(error.message || "Failed to remove item from cart");
      }
   };

   const clearCart = async () => {
      if (!user) return;

      try {
         await apiClient.clearCart(user._id);
         await loadCart();
      } catch (error: any) {
         console.error("Failed to clear cart:", error);
         toast.error(error.message || "Failed to clear cart");
      }
   };

   const checkout = async () => {
      if (!user || !cart || cartItems.length === 0) return;

      try {
         const orderData = {
            items: cartItems.map((item) => ({
               productId: item.productId,
               quantity: item.quantity,
            })),
         };

         const order = await apiClient.createOrder(user._id, orderData);
         // Cart will be cleared by backend cart service after receiving order success event

         toast.success("Order placed successfully!");
         navigate("/orders");
      } catch (error: any) {
         console.error("Failed to checkout:", error);
         toast.error(error.message || "Failed to place order");
      }
   };

   const calculateTotal = () => {
      return cartItems.reduce((total, item) => {
         return total + item.product.price * item.quantity;
      }, 0);
   };

   if (loading) {
      return (
         <div>
            <Header />
            <div className="max-w-7xl mx-auto px-4 py-8">
               <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading cart...</p>
               </div>
            </div>
         </div>
      );
   }

   if (error) {
      return (
         <div>
            <Header />
            <div className="max-w-7xl mx-auto px-4 py-8">
               <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-white">
         <Header />
         <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="mb-8">
               <h1 className="text-4xl font-black text-black uppercase mb-2 tracking-tight">
                  Shopping Cart
               </h1>
               <p className="text-base font-bold text-black">
                  Review your items
               </p>
            </div>

            {cartItems.length === 0 ? (
               <div className="text-center py-16 card-brutal bg-white">
                  <span className="text-6xl mb-6 block">🛒</span>
                  <p className="text-xl font-bold text-black mb-6 uppercase">
                     Your cart is empty
                  </p>
                  <button
                     onClick={() => navigate("/products")}
                     className="btn-brutal bg-black text-white"
                  >
                     Continue Shopping
                  </button>
               </div>
            ) : (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                     {cartItems.map((item) => (
                        <div
                           key={item.productId}
                           className="card-brutal bg-white p-6 flex items-center gap-4"
                        >
                           <div className="w-20 h-20 bg-gray-100 border-brutal flex items-center justify-center flex-shrink-0">
                              <span className="text-3xl">📦</span>
                           </div>
                           <div className="flex-1">
                              <h3 className="text-base font-black text-black uppercase mb-1">
                                 {item.product.name}
                              </h3>
                              <p className="text-sm font-bold text-black">
                                 ${item.product.price.toFixed(2)} ×{" "}
                                 {item.quantity}
                              </p>
                           </div>
                           <div className="text-right mr-4">
                              <p className="text-xl font-black text-black">
                                 $
                                 {(item.product.price * item.quantity).toFixed(
                                    2
                                 )}
                              </p>
                           </div>
                           <button
                              onClick={() => removeFromCart(item.productId)}
                              className="btn-brutal bg-black text-white"
                           >
                              Remove
                           </button>
                        </div>
                     ))}

                     <button
                        onClick={clearCart}
                        className="btn-brutal bg-black text-white mt-4"
                     >
                        Clear Cart
                     </button>
                  </div>

                  <div className="lg:col-span-1">
                     <div className="card-brutal bg-white p-6 sticky top-24">
                        <h2 className="text-xl font-black text-black mb-6 uppercase">
                           Summary
                        </h2>
                        <div className="space-y-3 mb-6">
                           <div className="flex justify-between text-black font-bold">
                              <span>Subtotal</span>
                              <span>${calculateTotal().toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-black font-bold">
                              <span>Shipping</span>
                              <span>FREE</span>
                           </div>
                           <div className="border-t-3 border-black pt-3 mt-3">
                              <div className="flex justify-between text-xl font-black text-black uppercase">
                                 <span>Total</span>
                                 <span>${calculateTotal().toFixed(2)}</span>
                              </div>
                           </div>
                        </div>
                        <button
                           onClick={checkout}
                           className="w-full btn-brutal bg-black text-white mb-3"
                        >
                           Checkout
                        </button>
                        <button
                           onClick={() => navigate("/products")}
                           className="w-full btn-brutal bg-white text-black"
                        >
                           Keep Shopping
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
