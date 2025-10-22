import { useState, useEffect } from "react";
import { apiClient } from "../lib/api";
import { Cart, Product } from "../types";
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
   const { user } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      if (!user) {
         navigate("/login");
         return;
      }
      loadCart();
   }, [user, navigate]);

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
         alert(error.message || "Failed to remove item from cart");
      }
   };

   const clearCart = async () => {
      if (!user) return;

      if (!confirm("Are you sure you want to clear your cart?")) return;

      try {
         await apiClient.clearCart(user._id);
         await loadCart();
      } catch (error: any) {
         console.error("Failed to clear cart:", error);
         alert(error.message || "Failed to clear cart");
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
            totalAmount: calculateTotal(),
         };

         const order = await apiClient.createOrder(user._id, orderData);
         await apiClient.clearCart(user._id);

         alert("Order placed successfully!");
         navigate("/orders");
      } catch (error: any) {
         console.error("Failed to checkout:", error);
         alert(error.message || "Failed to place order");
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
      <div className="min-h-screen bg-gray-50">
         <Header />
         <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
               <h1 className="text-3xl font-bold text-gray-900">
                  Shopping Cart
               </h1>
               <p className="mt-2 text-gray-600">
                  Review your items before checkout
               </p>
            </div>

            {cartItems.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-lg shadow">
                  <span className="text-6xl mb-4 block">🛒</span>
                  <p className="text-gray-600 mb-4">Your cart is empty</p>
                  <button
                     onClick={() => navigate("/products")}
                     className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                     Continue Shopping
                  </button>
               </div>
            ) : (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                     <div className="bg-white rounded-lg shadow">
                        {cartItems.map((item) => (
                           <div
                              key={item.productId}
                              className="p-6 border-b last:border-b-0 flex items-center"
                           >
                              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-lg flex items-center justify-center mr-4">
                                 <span className="text-3xl">📦</span>
                              </div>
                              <div className="flex-1">
                                 <h3 className="text-lg font-semibold text-gray-900">
                                    {item.product.name}
                                 </h3>
                                 <p className="text-sm text-gray-600 mt-1">
                                    ${item.product.price.toFixed(2)} ×{" "}
                                    {item.quantity}
                                 </p>
                              </div>
                              <div className="text-right mr-4">
                                 <p className="text-lg font-bold text-gray-900">
                                    $
                                    {(
                                       item.product.price * item.quantity
                                    ).toFixed(2)}
                                 </p>
                              </div>
                              <button
                                 onClick={() => removeFromCart(item.productId)}
                                 className="text-red-600 hover:text-red-700 p-2"
                              >
                                 🗑️
                              </button>
                           </div>
                        ))}
                     </div>

                     <button
                        onClick={clearCart}
                        className="mt-4 text-red-600 hover:text-red-700"
                     >
                        Clear Cart
                     </button>
                  </div>

                  <div className="lg:col-span-1">
                     <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                           Order Summary
                        </h2>
                        <div className="space-y-2 mb-4">
                           <div className="flex justify-between text-gray-600">
                              <span>Subtotal</span>
                              <span>${calculateTotal().toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-gray-600">
                              <span>Shipping</span>
                              <span>Free</span>
                           </div>
                           <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between text-lg font-bold text-gray-900">
                                 <span>Total</span>
                                 <span>${calculateTotal().toFixed(2)}</span>
                              </div>
                           </div>
                        </div>
                        <button
                           onClick={checkout}
                           className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold"
                        >
                           Proceed to Checkout
                        </button>
                        <button
                           onClick={() => navigate("/products")}
                           className="w-full mt-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition"
                        >
                           Continue Shopping
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
