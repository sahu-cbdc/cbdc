import { createRoot } from "react-dom/client";
import Home from "./pages/Home";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}
createRoot(rootEl).render(<Home />);
