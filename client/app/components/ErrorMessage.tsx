interface ErrorMessageProps {
   message: string;
   onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
   return (
      <div className="bg-red-50 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
         <div className="flex items-start">
            <div className="flex-shrink-0">
               <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3 flex-1">
               <h3 className="text-sm font-medium">Error</h3>
               <p className="mt-1 text-sm">{message}</p>
               {onRetry && (
                  <button
                     onClick={onRetry}
                     className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition text-sm"
                  >
                     Try Again
                  </button>
               )}
            </div>
         </div>
      </div>
   );
}
