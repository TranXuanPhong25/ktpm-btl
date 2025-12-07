import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
   const [name, setName] = useState("");
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const { register } = useAuth();
   const navigate = useNavigate();

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      if (password !== confirmPassword) {
         setError("Passwords do not match");
         setLoading(false);
         return;
      }

      if (password.length < 6) {
         setError("Password must be at least 6 characters long");
         setLoading(false);
         return;
      }

      try {
         await register(name, email, password);
         navigate("/products");
      } catch (error: any) {
         setError(error.message || "Registration failed. Please try again.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
         <div className="max-w-md w-full card-brutal bg-white p-8">
            <div className="mb-8">
               <h2 className="text-3xl font-black text-black uppercase text-center mb-2 tracking-tight">
                  Sign Up
               </h2>
               <p className="text-center text-sm font-bold text-black">
                  Create your account
               </p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
               {error && (
                  <div className="bg-black border-brutal text-white px-4 py-3 font-bold text-sm">
                     {error}
                  </div>
               )}
               <div className="space-y-4">
                  <div>
                     <label
                        htmlFor="name"
                        className="block text-sm font-black text-black mb-2 uppercase"
                     >
                        Full Name
                     </label>
                     <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="appearance-none relative block w-full px-4 py-3 border-brutal bg-white text-black font-bold placeholder-gray-400 focus:outline-none"
                        placeholder="John Doe"
                     />
                  </div>
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
                        placeholder="Min 6 characters"
                     />
                  </div>
                  <div>
                     <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-black text-black mb-2 uppercase"
                     >
                        Confirm Password
                     </label>
                     <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="appearance-none relative block w-full px-4 py-3 border-brutal bg-white text-black font-bold placeholder-gray-400 focus:outline-none"
                        placeholder="Same as above"
                     />
                  </div>
               </div>
               <div>
                  <button
                     type="submit"
                     disabled={loading}
                     className="w-full btn-brutal bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {loading ? "Creating account..." : "Create Account"}
                  </button>
               </div>
               <div className="text-center pt-4 border-t-3 border-black">
                  <Link
                     to="/login"
                     className="text-black font-black hover:underline uppercase text-sm"
                  >
                     Have an account? Sign in
                  </Link>
               </div>
            </form>
         </div>
      </div>
   );
}
