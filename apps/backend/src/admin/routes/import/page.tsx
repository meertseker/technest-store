import { Navigate } from "react-router-dom"

// This page moved into the Products page. No `config`, so it is not in the menu;
// old bookmarks and guide links still land on the right tab.
const Moved = () => <Navigate to="/shop-products?tab=import" replace />

export default Moved
