interface LoadingSpinnerProps {
   size?: "sm" | "md" | "lg";
   text?: string;
}

export function LoadingSpinner({ size = "md", text }: LoadingSpinnerProps) {
   const sizeClasses = {
      sm: "h-6 w-6",
      md: "h-12 w-12",
      lg: "h-16 w-16",
   };

   return (
      <div className="flex flex-col items-center justify-center py-12">
         <div
            className={`inline-block animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
         ></div>
         {text && <p className="mt-4 text-gray-600">{text}</p>}
      </div>
   );
}
