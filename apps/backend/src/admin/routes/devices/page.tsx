import { Navigate } from "react-router-dom"

// This page moved into Shop settings. No `config`, so it is not in the menu;
// old bookmarks and guide links still land on the right tab.
const Moved = () => <Navigate to="/shop-settings?tab=devices" replace />

export default Moved
