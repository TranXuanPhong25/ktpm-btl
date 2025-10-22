import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export function Header() {
   const { user, logout } = useAuth();

   return (
      <header className="bg-white shadow-sm border-b">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
               <div className="flex items-center">
                  <Link to="/" className="text-xl font-bold text-blue-600">
                     🛒 E-Commerce
                  </Link>
                  <nav className="ml-10 space-x-8">
                     <Link
                        to="/products"
                        className="text-gray-700 hover:text-blue-600 transition"
                     >
                        Products
                     </Link>
                     {user && (
                        <>
                           <Link
                              to="/cart"
                              className="text-gray-700 hover:text-blue-600 transition"
                           >
                              Cart
                           </Link>
                           <Link
                              to="/orders"
                              className="text-gray-700 hover:text-blue-600 transition"
                           >
                              Orders
                           </Link>
                        </>
                     )}
                  </nav>
               </div>
               <div className="flex items-center space-x-4">
                  {user ? (
                     <>
                        <span className="text-gray-700">
                           Welcome, {user.name}!
                        </span>
                        <button
                           onClick={logout}
                           className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                        >
                           Logout
                        </button>
                     </>
                  ) : (
                     <>
                        <Link
                           to="/login"
                           className="text-gray-700 hover:text-blue-600 transition"
                        >
                           Login
                        </Link>
                        <Link
                           to="/register"
                           className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                           Register
                        </Link>
                     </>
                  )}
               </div>
            </div>
         </div>
      </header>
   );
}
