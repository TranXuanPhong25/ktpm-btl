import { useState, useEffect } from "react";
import { apiClient } from "../lib/api";
import { Product } from "../types";
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
      const data = await apiClient.getProducts();
      setProducts(data);
    } catch (error: any) {
      console.error("Failed to load products:", error);
      setError(error.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, productName: string) => {
    if (!user) {
      alert("Please login to add items to cart");
      navigate("/login");
      return;
    }

    try {
      await apiClient.addToCart(user._id, { productId, quantity: 1 });
      alert(`${productName} added to cart!`);
    } catch (error: any) {
      console.error("Failed to add to cart:", error);
      alert(error.message || "Failed to add product to cart");
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Our Products</h1>
          <p className="mt-2 text-gray-600">Discover our amazing collection</p>
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
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center">
                  <span className="text-6xl">📦</span>
                </div>
                <div className="p-6">
                  <div className="mb-2">
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {product.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-bold text-blue-600">
                      ${product.price.toFixed(2)}
                    </span>
                    <span
                      className={`text-sm ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {product.stock > 0
                        ? `${product.stock} in stock`
                        : "Out of stock"}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(product._id, product.name)}
                    disabled={product.stock === 0}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {product.stock === 0 ? "Out of Stock" : "🛒 Add to Cart"}
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
