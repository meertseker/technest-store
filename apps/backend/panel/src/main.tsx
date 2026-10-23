import { Toaster, TooltipProvider } from "@medusajs/ui"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => (error as { status?: number }).status !== 401 && count < 2,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
