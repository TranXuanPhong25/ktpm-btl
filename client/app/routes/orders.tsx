import { useState, useEffect } from "react";
import { apiClient } from "../lib/api";
import { Order } from "../types";
import { Header } from "../components/Header";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

export default function Orders() {
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const { user } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      if (!user) {
         navigate("/login");
         return;
      }
      loadOrders();
   }, [user, navigate]);

   const loadOrders = async () => {
      if (!user) return;

      try {
         const data = await apiClient.getOrders(user._id);
         setOrders(data);
      } catch (error: any) {
         console.error("Failed to load orders:", error);
         setError(error.message || "Failed to load orders");
      } finally {
         setLoading(false);
      }
   };

   const getStatusColor = (status: string) => {
      switch (status) {
         case "pending":
            return "bg-yellow-100 text-yellow-800";
         case "confirmed":
            return "bg-blue-100 text-blue-800";
         case "shipped":
            return "bg-purple-100 text-purple-800";
         case "delivered":
            return "bg-green-100 text-green-800";
         case "cancelled":
            return "bg-red-100 text-red-800";
         default:
            return "bg-gray-100 text-gray-800";
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
      <div className="min-h-screen bg-gray-50">
         <Header />
         <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
               <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
               <p className="mt-2 text-gray-600">
                  Track and manage your orders
               </p>
            </div>

            {orders.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-lg shadow">
                  <span className="text-6xl mb-4 block">📦</span>
                  <p className="text-gray-600 mb-4">
                     You haven't placed any orders yet
                  </p>
                  <button
                     onClick={() => navigate("/products")}
                     className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                     Start Shopping
                  </button>
               </div>
            ) : (
               <div className="space-y-4">
                  {orders.map((order) => (
                     <div
                        key={order._id}
                        className="bg-white rounded-lg shadow p-6"
                     >
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                 Order #{order._id.slice(-8).toUpperCase()}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                 Placed on {formatDate(order.createdAt)}
                              </p>
                           </div>
                           <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                           >
                              {order.status.toUpperCase()}
                           </span>
                        </div>

                        <div className="border-t pt-4">
                           <div className="space-y-2">
                              {order.items.map((item, index) => (
                                 <div
                                    key={index}
                                    className="flex justify-between text-sm"
                                 >
                                    <span className="text-gray-600">
                                       Product ID: {item.productId.slice(-8)} ×{" "}
                                       {item.quantity}
                                    </span>
                                    {item.price && (
                                       <span className="text-gray-900">
                                          $
                                          {(item.price * item.quantity).toFixed(
                                             2
                                          )}
                                       </span>
                                    )}
                                 </div>
                              ))}
                           </div>

                           <div className="border-t mt-4 pt-4 flex justify-between items-center">
                              <span className="text-gray-900 font-semibold">
                                 Total Amount
                              </span>
                              <span className="text-xl font-bold text-blue-600">
                                 ${order.totalAmount.toFixed(2)}
                              </span>
                           </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                           <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                              View Details
                           </button>
                           {order.status === "pending" && (
                              <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                                 Cancel Order
                              </button>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}
