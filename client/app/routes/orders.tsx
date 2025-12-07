import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { apiClient } from "../lib/api";
import type { Order } from "../types";
import { Header } from "../components/Header";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

export default function Orders() {
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const [processingPayment, setProcessingPayment] = useState<string | null>(
      null
   );
   const { user, isLoading: authLoading } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      // Wait for auth to finish loading before checking user
      if (authLoading) return;

      if (!user) {
         navigate("/login");
         return;
      }
      loadOrders();
   }, [user, authLoading, navigate]);

   const loadOrders = async () => {
      if (!user) return;

      try {
         const response: any = await apiClient.getOrders(user._id);
         // Handle paginated response format
         const data = response.data || response;
         setOrders(Array.isArray(data) ? data : []);
      } catch (error: any) {
         console.error("Failed to load orders:", error);
         setError(error.message || "Failed to load orders");
      } finally {
         setLoading(false);
      }
   };

   const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
         case "pending":
            return "bg-[#ffeb3b] text-black border-2 border-black";
         case "confirmed":
            return "bg-[#3a86ff] text-white border-2 border-black";
         case "shipped":
            return "bg-[#8338ec] text-white border-2 border-black";
         case "delivered":
            return "bg-[#06ff8c] text-black border-2 border-black";
         case "cancelled":
            return "bg-[#ff0054] text-white border-2 border-black";
         default:
            return "bg-white text-black border-2 border-black";
      }
   };

   const formatDate = (dateString?: string) => {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString("en-US", {
         year: "numeric",
         month: "long",
         day: "numeric",
         hour: "2-digit",
         minute: "2-digit",
      });
   };

   const handleCheckout = async (orderId: string, amount: number) => {
      if (!user) return;

      setProcessingPayment(orderId);
      try {
         await apiClient.processPayment(orderId, {
            amount,
            userId: user._id,
         });
         toast.success("Payment processed successfully!");
         // Reload orders to see updated status
         await loadOrders();
         // Navigate to payments page to see the payment
         navigate("/payments");
      } catch (error: any) {
         console.error("Failed to process payment:", error);
         toast.error(error.message || "Failed to process payment");
      } finally {
         setProcessingPayment(null);
      }
   };

   if (loading) {
      return (
         <div>
            <Header />
            <div className="max-w-7xl mx-auto px-4 py-8">
               <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading orders...</p>
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
                  My Orders
               </h1>
               <p className="text-base font-bold text-black">
                  Track your orders
               </p>
            </div>

            {orders.length === 0 ? (
               <div className="text-center py-16 card-brutal bg-white">
                  <span className="text-6xl mb-6 block">📦</span>
                  <p className="text-xl font-bold text-black mb-6 uppercase">
                     No orders yet
                  </p>
                  <button
                     onClick={() => navigate("/products")}
                     className="btn-brutal bg-black text-white"
                  >
                     Start Shopping
                  </button>
               </div>
            ) : (
               <div className="space-y-4">
                  {orders.map((order) => (
                     <div key={order._id} className="card-brutal bg-white p-6">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <h3 className="text-lg font-black text-black uppercase mb-1">
                                 Order #{order._id.slice(-8)}
                              </h3>
                              <p className="text-sm font-bold text-black">
                                 {formatDate(order.createdAt)}
                              </p>
                              {(order.status.toLowerCase() === "failed" ||
                                 order.status.toLowerCase() === "cancelled") &&
                                 order.reason && (
                                    <p className="text-sm font-bold text-red-600 mt-1">
                                       Reason: {order.reason}
                                    </p>
                                 )}
                           </div>
                           <div className="flex items-center gap-3">
                              {order.status.toLowerCase() != "created" && (
                                 <span
                                    className={`px-3 py-1 text-xs font-black uppercase ${getStatusColor(order.status)}`}
                                 >
                                    {order.status}
                                 </span>
                              )}
                              {order.status.toLowerCase() === "created" && (
                                 <button
                                    onClick={() =>
                                       handleCheckout(
                                          order._id,
                                          order.totalAmount
                                       )
                                    }
                                    disabled={processingPayment === order._id}
                                    className="btn-brutal bg-black text-white disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
                                 >
                                    {processingPayment === order._id
                                       ? "Processing..."
                                       : "Checkout"}
                                 </button>
                              )}
                           </div>
                        </div>

                        <div className="border-t-3 border-black pt-4">
                           <div className="space-y-2">
                              {order.items.map((item, index) => (
                                 <div
                                    key={index}
                                    className="flex justify-between text-sm font-bold bg-gray-100 border-2 border-black p-3"
                                 >
                                    <span className="text-black">
                                       {item.name ||
                                          `Product ${item.productId.slice(-8)}`}
                                       {" × "}
                                       {item.quantity}
                                    </span>
                                    {item.price && (
                                       <span className="text-black">
                                          $
                                          {(item.price * item.quantity).toFixed(
                                             2
                                          )}
                                       </span>
                                    )}
                                 </div>
                              ))}
                           </div>

                           <div className="border-t-3 border-black mt-4 pt-4 flex justify-between items-center bg-white border-2 border-black p-3">
                              <span className="text-base font-black text-black uppercase">
                                 Total
                              </span>
                              <span className="text-2xl font-black text-black">
                                 ${order.totalAmount.toFixed(2)}
                              </span>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}
