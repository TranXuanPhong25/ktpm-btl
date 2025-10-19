import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { User } from "../types";
import { apiClient } from "../lib/api";

interface AuthContextType {
   user: User | null;
   login: (email: string, password: string) => Promise<void>;
   register: (name: string, email: string, password: string) => Promise<void>;
   logout: () => void;
   isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
   const [user, setUser] = useState<User | null>(null);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      // Check if user is logged in from localStorage
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
         try {
            setUser(JSON.parse(savedUser));
         } catch (error) {
            console.error("Failed to parse saved user:", error);
            localStorage.removeItem("user");
         }
      }
      setIsLoading(false);
   }, []);

   const login = async (email: string, password: string) => {
      try {
         const data: any = await apiClient.login({ email, password });

         // Decode JWT to get user info (simple decode, not verification)
         const token = data.token;
         const payload = JSON.parse(atob(token.split(".")[1]));

         const userData: User = {
            _id: payload.userId,
            name: email.split("@")[0], // Fallback name
            email: email,
         };

         setUser(userData);
         localStorage.setItem("user", JSON.stringify(userData));
         localStorage.setItem("token", token);
      } catch (error) {
         console.error("Login error:", error);
         throw error;
      }
   };

   const register = async (name: string, email: string, password: string) => {
      try {
         const data: any = await apiClient.register({ name, email, password });

         // Decode JWT to get user info
         const token = data.token;
         const payload = JSON.parse(atob(token.split(".")[1]));

         const userData: User = {
            _id: payload.userId,
            name: name,
            email: email,
         };

         setUser(userData);
         localStorage.setItem("user", JSON.stringify(userData));
         localStorage.setItem("token", token);
      } catch (error) {
         console.error("Registration error:", error);
         throw error;
      }
   };

   const logout = () => {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
   };

   return (
      <AuthContext.Provider
         value={{ user, login, register, logout, isLoading }}
      >
         {children}
      </AuthContext.Provider>
   );
}

export function useAuth() {
   const context = useContext(AuthContext);
   if (context === undefined) {
      throw new Error("useAuth must be used within an AuthProvider");
   }
   return context;
}
