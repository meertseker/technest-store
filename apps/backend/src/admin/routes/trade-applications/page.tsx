import { Navigate } from "react-router-dom"

// This page moved into the Orders page. No `config`, so it is not in the menu;
// old bookmarks and guide links still land on the right tab.
const Moved = () => <Navigate to="/shop-orders?tab=trade" replace />

export default Moved
