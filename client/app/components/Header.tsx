import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export function Header() {
   const { user, logout } = useAuth();

   return (
      <header className="bg-white border-brutal border-b-[5px] border-b-black sticky top-0 z-50">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
               <div className="flex items-center gap-8">
                  <Link
                     to="/"
                     className="text-xl font-black text-black uppercase tracking-tight"
                  >
                     E-Commerce
                  </Link>
                  <nav className="flex gap-6">
                     <Link
                        to="/products"
                        className="text-black font-bold uppercase text-sm hover:underline"
                     >
                        Products
                     </Link>
                     {user && (
                        <>
                           <Link
                              to="/cart"
                              className="text-black font-bold uppercase text-sm hover:underline"
                           >
                              Cart
                           </Link>
                           <Link
                              to="/orders"
                              className="text-black font-bold uppercase text-sm hover:underline"
                           >
                              Orders
                           </Link>
                           <Link
                              to="/payments"
                              className="text-black font-bold uppercase text-sm hover:underline"
                           >
                              Payments
                           </Link>
                        </>
                     )}
                  </nav>
               </div>
               <div className="flex items-center gap-4">
                  {user ? (
                     <>
                        <span className="text-black font-bold">
                           {user.name}
                        </span>
                        <button
                           onClick={logout}
                           className="btn-brutal bg-black text-white"
                        >
                           Logout
                        </button>
                     </>
                  ) : (
                     <>
                        <Link
                           to="/login"
                           className="text-black font-bold uppercase text-sm hover:underline"
                        >
                           Login
                        </Link>
                        <Link
                           to="/register"
                           className="btn-brutal bg-black text-white"
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
