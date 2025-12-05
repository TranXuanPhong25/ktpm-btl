import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const { login } = useAuth();
   const navigate = useNavigate();

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
         await login(email, password);
         navigate("/products");
      } catch (error: any) {
         setError(error.message || "Invalid email or password");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
         <div className="max-w-md w-full card-brutal bg-white p-8">
            <div className="mb-8">
               <h2 className="text-3xl font-black text-black uppercase text-center mb-2 tracking-tight">
                  Sign In
               </h2>
               <p className="text-center text-sm font-bold text-black">
                  Welcome back
               </p>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
               {error && (
                  <div className="bg-black border-brutal text-white px-4 py-3 font-bold text-sm">
                     {error}
                  </div>
               )}
               <div className="space-y-4">
                  <div>
                     <label
                        htmlFor="email"
                        className="block text-sm font-black text-black mb-2 uppercase"
                     >
                        Email
                     </label>
                     <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="appearance-none relative block w-full px-4 py-3 border-brutal bg-white text-black font-bold placeholder-gray-400 focus:outline-none"
                        placeholder="your@email.com"
                     />
                  </div>
                  <div>
                     <label
                        htmlFor="password"
                        className="block text-sm font-black text-black mb-2 uppercase"
                     >
                        Password
                     </label>
                     <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none relative block w-full px-4 py-3 border-brutal bg-white text-black font-bold placeholder-gray-400 focus:outline-none"
                        placeholder="••••••••"
                     />
                  </div>
               </div>
               <div>
                  <button
                     type="submit"
                     disabled={loading}
                     className="w-full btn-brutal bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {loading ? "Signing in..." : "Sign In"}
                  </button>
               </div>
               <div className="text-center pt-4 border-t-3 border-black">
                  <Link
                     to="/register"
                     className="text-black font-black hover:underline uppercase text-sm"
                  >
                     Don't have an account? Sign up
                  </Link>
               </div>
            </form>
         </div>
      </div>
   );
}
