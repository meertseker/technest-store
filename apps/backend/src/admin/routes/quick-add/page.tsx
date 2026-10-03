import { Navigate } from "react-router-dom"

// This page moved into the Products page. No `config`, so it is not in the menu;
// old bookmarks and guide links still land on the right tab.
const Moved = () => <Navigate to="/shop-products?tab=add" replace />

export default Moved
