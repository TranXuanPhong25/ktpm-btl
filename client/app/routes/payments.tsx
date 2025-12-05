import { useState, useEffect } from "react";
import { apiClient } from "../lib/api";
import type { Payment } from "../types";
import { Header } from "../components/Header";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

export default function Payments() {
   const [payments, setPayments] = useState<Payment[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const [statusFilter, setStatusFilter] = useState<string>("");
   const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");
   const { user, isLoading: authLoading } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      // Wait for auth to finish loading before checking user
      if (authLoading) return;

      if (!user) {
         navigate("/login");
         return;
      }
      loadPayments();
   }, [user, authLoading, navigate, statusFilter, paymentMethodFilter]);

   const loadPayments = async () => {
      if (!user) return;

      try {
         const response: any = await apiClient.getPayments({
            status: statusFilter || undefined,
            paymentMethod: paymentMethodFilter || undefined,
            page: 1,
            limit: 50,
         });
         // Handle paginated response format
         const data = response.data || response;
         setPayments(Array.isArray(data) ? data : []);
      } catch (error: any) {
         console.error("Failed to load payments:", error);
         setError(error.message || "Failed to load payments");
      } finally {
         setLoading(false);
      }
   };

   const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
         case "pending":
            return "bg-[#ffeb3b] text-black border-2 border-black";
         case "completed":
         case "success":
            return "bg-[#06ff8c] text-black border-2 border-black";
         case "failed":
            return "bg-[#ff0054] text-white border-2 border-black";
         case "processing":
            return "bg-[#3a86ff] text-white border-2 border-black";
         case "refunded":
            return "bg-[#8338ec] text-white border-2 border-black";
         default:
            return "bg-white text-black border-2 border-black";
      }
   };

   const getPaymentMethodIcon = (method: string) => {
      switch (method.toLowerCase()) {
         case "credit_card":
         case "card":
            return "💳";
         case "paypal":
            return "🅿️";
         case "bank_transfer":
            return "🏦";
         case "cash":
            return "💵";
         default:
            return "💰";
      }
   };

   const formatDate = (dateString?: string) => {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString("en-US", {
         year: "numeric",
         month: "short",
         day: "numeric",
         hour: "2-digit",
         minute: "2-digit",
      });
   };

   if (authLoading || loading) {
      return (
         <div>
            <Header />
            <div className="flex justify-center items-center min-h-screen">
               <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading payments...</p>
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
               <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
                  Payment History
               </h1>
               <p className="text-base font-bold text-black">
                  View and manage your payments
               </p>
            </div>

            {/* Filters */}
            <div className="card-brutal bg-white p-6 mb-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-black text-black mb-2 uppercase">
                        Status
                     </label>
                     <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-3 border-brutal bg-white font-bold focus:outline-none"
                     >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                        <option value="processing">Processing</option>
                        <option value="refunded">Refunded</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-black text-black mb-2 uppercase">
                        Payment Method
                     </label>
                     <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="w-full px-4 py-3 border-brutal bg-white font-bold focus:outline-none"
                     >
                        <option value="">All Methods</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="card">Card</option>
                        <option value="paypal">PayPal</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                     </select>
                  </div>
               </div>
            </div>

            {/* Payment Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
               <div className="card-brutal bg-white p-4">
                  <div className="text-xs font-black text-black mb-1 uppercase">
                     Total
                  </div>
                  <div className="text-2xl font-black text-black">
                     {payments.length}
                  </div>
               </div>
               <div className="card-brutal bg-gray-100 p-4">
                  <div className="text-xs font-black text-black mb-1 uppercase">
                     Amount
                  </div>
                  <div className="text-2xl font-black text-black">
                     $
                     {payments
                        .reduce((sum, p) => sum + (p.amount || 0), 0)
                        .toFixed(2)}
                  </div>
               </div>
               <div className="card-brutal bg-white p-4">
                  <div className="text-xs font-black text-black mb-1 uppercase">
                     Success
                  </div>
                  <div className="text-2xl font-black text-black">
                     {
                        payments.filter((p) =>
                           ["completed", "succeeded"].includes(
                              p.status.toLowerCase()
                           )
                        ).length
                     }
                  </div>
               </div>
               <div className="card-brutal bg-white p-4">
                  <div className="text-xs font-black text-black mb-1 uppercase">
                     Failed
                  </div>
                  <div className="text-2xl font-black text-black">
                     {
                        payments.filter(
                           (p) => p.status.toLowerCase() === "failed"
                        ).length
                     }
                  </div>
               </div>
            </div>

            {/* Payments List */}
            {payments.length === 0 ? (
               <div className="text-center py-16 card-brutal bg-white">
                  <span className="text-6xl mb-6 block">💳</span>
                  <p className="text-xl font-bold text-black mb-6 uppercase">
                     No payments found
                  </p>
                  <button
                     onClick={() => navigate("/orders")}
                     className="btn-brutal bg-black text-white"
                  >
                     View Orders
                  </button>
               </div>
            ) : (
               <div className="card-brutal bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="min-w-full">
                        <thead className="bg-gray-100 border-b-3 border-black">
                           <tr>
                              <th className="px-6 py-3 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Payment ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Order ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Amount
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Method
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Status
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-black text-black uppercase tracking-wider">
                                 Date
                              </th>
                           </tr>
                        </thead>
                        <tbody className="bg-white">
                           {payments.map((payment, idx) => (
                              <tr
                                 key={payment._id}
                                 className={`border-b-2 border-black hover:bg-gray-100 transition-colors`}
                              >
                                 <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-black">
                                    #{payment._id.slice(-8)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                                    <button
                                       onClick={() => navigate("/orders")}
                                       className="font-black text-black hover:text-gray-600 underline"
                                    >
                                       #{payment.orderId.slice(-8)}
                                    </button>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-black">
                                    ${payment.amount.toFixed(2)}
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                                    <span className="inline-flex items-center gap-1 font-bold">
                                       {getPaymentMethodIcon(
                                          payment.paymentMethod
                                       )}
                                       <span className="uppercase">
                                          {payment.paymentMethod.replace(
                                             "_",
                                             " "
                                          )}
                                       </span>
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                    <span
                                       className={`px-3 py-1 text-xs font-black uppercase ${getStatusColor(payment.status)}`}
                                    >
                                       {payment.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-black font-bold">
                                    {formatDate(payment.paymentDate)}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
