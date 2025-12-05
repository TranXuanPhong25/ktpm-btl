import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { apiClient } from "../lib/api";
import type { Product } from "../types";
import { Header } from "../components/Header";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

export default function Products() {
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const { user } = useAuth();
   const navigate = useNavigate();

   useEffect(() => {
      loadProducts();
   }, []);

   const loadProducts = async () => {
      try {
         const response: any = await apiClient.getProducts();
         // Handle paginated response format
         const data = response.data || response;
         setProducts(Array.isArray(data) ? data : []);
      } catch (error: any) {
         console.error("Failed to load products:", error);
         setError(error.message || "Failed to load products");
      } finally {
         setLoading(false);
      }
   };

   const addToCart = async (productId: string, productName: string) => {
      if (!user) {
         toast.error("Please login to add items to cart");
         navigate("/login");
         return;
      }

      try {
         await apiClient.addToCart(user._id, { productId, quantity: 1 });
         toast.success(`${productName} added to cart!`);
      } catch (error: any) {
         console.error("Failed to add to cart:", error);
         toast.error(error.message || "Failed to add product to cart");
      }
   };

   if (loading) {
      return (
         <div>
            <Header />
            <div className="max-w-7xl mx-auto px-4 py-8">
               <LoadingSpinner text="Loading products..." />
            </div>
         </div>
      );
   }

   if (error) {
      return (
         <div>
            <Header />
            <div className="max-w-7xl mx-auto px-4 py-8">
               <ErrorMessage message={error} onRetry={loadProducts} />
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-white">
         <Header />
         <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="mb-12">
               <h1 className="text-4xl font-black text-black uppercase mb-2 tracking-tight">
                  Products
               </h1>
               <p className="text-base font-bold text-black">
                  Discover our collection
               </p>
            </div>

            {products.length === 0 ? (
               <EmptyState
                  icon="📦"
                  title="No products available"
                  description="Check back later for new products"
                  action={{
                     label: "Go Home",
                     onClick: () => navigate("/"),
                  }}
               />
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                     <div
                        key={product._id}
                        className="card-brutal bg-white overflow-hidden"
                     >
                        <div className="h-48 bg-gray-100 border-b-brutal flex items-center justify-center">
                           <span className="text-6xl">📦</span>
                        </div>
                        <div className="p-6">
                           <div className="mb-3">
                              <span className="inline-block bg-black text-white text-xs font-bold px-2 py-1 uppercase">
                                 {product.category}
                              </span>
                           </div>
                           <h3 className="text-lg font-black text-black mb-2 uppercase">
                              {product.name}
                           </h3>
                           <p className="text-black text-sm mb-4 line-clamp-2">
                              {product.description}
                           </p>
                           <div className="flex justify-between items-center mb-4">
                              <span className="text-2xl font-black text-black">
                                 ${product.price.toFixed(2)}
                              </span>
                              <span
                                 className={`text-xs font-bold px-2 py-1 ${product.stock > 0 ? "bg-white border-2 border-black text-black" : "bg-black text-white"}`}
                              >
                                 {product.stock > 0
                                    ? `${product.stock} in stock`
                                    : "SOLD OUT"}
                              </span>
                           </div>
                           <button
                              onClick={() =>
                                 addToCart(product._id, product.name)
                              }
                              disabled={product.stock === 0}
                              className="w-full btn-brutal bg-black text-white disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
                           >
                              {product.stock === 0
                                 ? "Out of Stock"
                                 : "Add to Cart"}
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}
