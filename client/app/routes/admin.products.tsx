import { useState, useEffect, Suspense } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { Header } from "~/components/Header";

const API_URL = "http://localhost:80";

interface Product {
   _id: string;
   name: string;
   description: string;
   price: number;
   category: string;
}

// Component riêng để hiển thị danh sách sản phẩm
function ProductsList({
   products,
   onDelete,
}: {
   products: Product[];
   onDelete: (id: string, name: string) => void;
}) {
   if (products.length === 0) {
      return (
         <div className="text-center py-16 border-4 border-dashed border-black">
            <p className="text-2xl font-black uppercase">No Products Yet</p>
            <p className="text-sm font-bold mt-2 uppercase">
               Create one above to get started
            </p>
         </div>
      );
   }

   return (
      <div className="space-y-6">
         {products.map((product) => (
            <div
               key={product._id}
               className="border-4 border-black p-6 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all"
            >
               <div className="flex justify-between items-start gap-6">
                  <div className="flex-1">
                     <h3 className="text-2xl font-black uppercase mb-3">
                        {product.name}
                     </h3>
                     <p className="font-bold mb-4 leading-relaxed">
                        {product.description}
                     </p>
                     <div className="flex gap-3 flex-wrap items-center">
                        <span className="bg-black text-white px-4 py-2 font-black uppercase text-sm border-4 border-black">
                           ${product.price}
                        </span>
                        <span className="bg-white border-4 border-black px-4 py-2 font-black uppercase text-sm">
                           {product.category}
                        </span>
                        <span className="text-xs font-mono font-bold uppercase opacity-50">
                           ID: {product._id}
                        </span>
                     </div>
                  </div>

                  <button
                     onClick={() => onDelete(product._id, product.name)}
                     className="bg-white border-4 border-black px-6 py-3 font-black uppercase text-sm hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] whitespace-nowrap"
                  >
                     Delete
                  </button>
               </div>
            </div>
         ))}
      </div>
   );
}

// Loading fallback component
function ProductsListSkeleton() {
   return (
      <div className="space-y-6">
         {[1, 2, 3].map((i) => (
            <div key={i} className="border-4 border-black p-6 animate-pulse">
               <div className="h-8 bg-gray-200 border-2 border-black mb-3 w-1/3"></div>
               <div className="h-4 bg-gray-200 border-2 border-black mb-2 w-full"></div>
               <div className="h-4 bg-gray-200 border-2 border-black mb-4 w-2/3"></div>
               <div className="flex gap-3">
                  <div className="h-10 w-24 bg-gray-200 border-2 border-black"></div>
                  <div className="h-10 w-32 bg-gray-200 border-2 border-black"></div>
               </div>
            </div>
         ))}
      </div>
   );
}

export default function AdminProducts() {
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(true);
   const [submitting, setSubmitting] = useState(false);

   const [formData, setFormData] = useState({
      name: "",
      description: "",
      price: "",
      category: "",
      stock: "",
   });

   useEffect(() => {
      loadProducts();
   }, []);

   const loadProducts = async () => {
      try {
         const response = await fetch(`${API_URL}/api/product-catalog?limit=6`);
         if (!response.ok) throw new Error("Failed to fetch products");
         const pagedData = await response.json();
         setProducts(pagedData.data);
      } catch (error) {
         console.error("Error loading products:", error);
         toast.error("Failed to load products");
      } finally {
         setLoading(false);
      }
   };

   const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);

      try {
         const response = await fetch(`${API_URL}/api/product-catalog`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               name: formData.name,
               description: formData.description,
               price: Number(formData.price),
               category: formData.category,
               stock: Number(formData.stock),
            }),
         });

         if (!response.ok) throw new Error("Failed to create product");

         const newProduct = await response.json();
         toast.success(`Product created: ${newProduct.name}`);
         setFormData({
            name: "",
            description: "",
            price: "",
            category: "",
            stock: "",
         });
         loadProducts();
      } catch (error) {
         console.error("Error creating product:", error);
         toast.error("Failed to create product");
      } finally {
         setSubmitting(false);
      }
   };

   const handleDelete = async (id: string, name: string) => {
      try {
         const response = await fetch(`${API_URL}/api/product-catalog/${id}`, {
            method: "DELETE",
         });

         if (!response.ok) throw new Error("Failed to delete product");

         toast.success("Product deleted successfully");
         loadProducts();
      } catch (error) {
         console.error("Error deleting product:", error);
         toast.error("Failed to delete product");
      }
   };

   const handleCreateRandom = async () => {
      const categories = [
         "Electronics",
         "Clothing",
         "Books",
         "Food",
         "Sports",
         "Home",
         "Toys",
         "Beauty",
      ];
      const adjectives = [
         "Premium",
         "Deluxe",
         "Ultimate",
         "Professional",
         "Elite",
         "Classic",
         "Modern",
         "Vintage",
      ];
      const nouns = [
         "Widget",
         "Gadget",
         "Device",
         "Tool",
         "Kit",
         "Set",
         "Bundle",
         "Package",
      ];

      const randomProduct = {
         name: `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${Math.floor(Math.random() * 1000)}`,
         description: `This is an amazing product with incredible features that you won't find anywhere else. Perfect for your needs!`,
         price: Math.floor(Math.random() * 50000) / 100,
         category: categories[Math.floor(Math.random() * categories.length)],
         stock: Math.floor(Math.random() * 100) + 1,
      };

      setSubmitting(true);

      try {
         const response = await fetch(`${API_URL}/api/product-catalog`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(randomProduct),
         });

         if (!response.ok) throw new Error("Failed to create random product");

         const newProduct = await response.json();
         toast.success(`Random product created: ${newProduct.name}`);
         loadProducts();
      } catch (error) {
         console.error("Error creating random product:", error);
         toast.error("Failed to create random product");
      } finally {
         setSubmitting(false);
      }
   };

   const handleInputChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
   ) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
   };

   return (
      <>
         <Header />
         <div className="min-h-screen bg-white p-8">
            <div className="max-w-7xl mx-auto">
               {/* Create Product Form */}
               <div className="bg-white border-4 border-black p-8 mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <h2 className="text-3xl font-black uppercase mb-8 pb-4 border-b-4 border-black">
                     Create New Product
                  </h2>

                  <form onSubmit={handleCreate} className="space-y-6">
                     <div>
                        <label
                           htmlFor="name"
                           className="block text-sm font-black uppercase tracking-wide mb-2"
                        >
                           Product Name
                        </label>
                        <input
                           type="text"
                           id="name"
                           name="name"
                           value={formData.name}
                           onChange={handleInputChange}
                           required
                           className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                           placeholder="ENTER PRODUCT NAME"
                        />
                     </div>

                     <div>
                        <label
                           htmlFor="description"
                           className="block text-sm font-black uppercase tracking-wide mb-2"
                        >
                           Description
                        </label>
                        <textarea
                           id="description"
                           name="description"
                           value={formData.description}
                           onChange={handleInputChange}
                           required
                           rows={3}
                           className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow resize-none"
                           placeholder="ENTER PRODUCT DESCRIPTION"
                        />
                     </div>

                     <div className="grid grid-cols-3 gap-6">
                        <div>
                           <label
                              htmlFor="price"
                              className="block text-sm font-black uppercase tracking-wide mb-2"
                           >
                              Price
                           </label>
                           <input
                              type="number"
                              id="price"
                              name="price"
                              value={formData.price}
                              onChange={handleInputChange}
                              required
                              step="0.01"
                              min="0"
                              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                              placeholder="0.00"
                           />
                        </div>

                        <div>
                           <label
                              htmlFor="category"
                              className="block text-sm font-black uppercase tracking-wide mb-2"
                           >
                              Category
                           </label>
                           <input
                              type="text"
                              id="category"
                              name="category"
                              value={formData.category}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                              placeholder="E.G., ELECTRONICS"
                           />
                        </div>

                        <div>
                           <label
                              htmlFor="stock"
                              className="block text-sm font-black uppercase tracking-wide mb-2"
                           >
                              Stock
                           </label>
                           <input
                              type="number"
                              id="stock"
                              name="stock"
                              value={formData.stock}
                              onChange={handleInputChange}
                              required
                              min="0"
                              step="1"
                              className="w-full px-4 py-3 border-4 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                              placeholder="0"
                           />
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <button
                           type="submit"
                           disabled={submitting}
                           className="flex-1 bg-black text-white py-4 px-6 border-4 border-black font-black uppercase text-lg hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:shadow-none active:shadow-none active:translate-x-[6px] active:translate-y-[6px]"
                        >
                           {submitting ? "Creating..." : "Create Product"}
                        </button>
                        <button
                           type="button"
                           onClick={handleCreateRandom}
                           disabled={submitting}
                           className="bg-yellow-400 text-black py-4 px-6 border-4 border-black font-black uppercase text-lg hover:bg-yellow-300 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:shadow-none active:shadow-none active:translate-x-[6px] active:translate-y-[6px] whitespace-nowrap"
                        >
                           🎲 Random
                        </button>
                     </div>
                  </form>
               </div>

               {/* Products List */}
               <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b-4 border-black">
                     <h2 className="text-3xl font-black uppercase">Products</h2>
                     <span className="bg-black text-white px-4 py-2 font-black uppercase text-sm border-4 border-black">
                        {products.length} Items
                     </span>
                  </div>

                  <Suspense fallback={<ProductsListSkeleton />}>
                     {!loading && (
                        <ProductsList
                           products={products}
                           onDelete={handleDelete}
                        />
                     )}
                     {loading && <ProductsListSkeleton />}
                  </Suspense>
               </div>
            </div>
         </div>
      </>
   );
}
