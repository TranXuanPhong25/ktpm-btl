import type { Route } from "./+types/home";
import { Header } from "../components/Header";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
   return [
      { title: "E-Commerce App" },
      { name: "description", content: "Welcome to our E-Commerce platform!" },
   ];
}

export default function Home() {
   return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
         <Header />
      </div>
   );
}
