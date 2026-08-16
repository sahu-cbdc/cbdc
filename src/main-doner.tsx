import { createRoot } from "react-dom/client";
import Doner from "./pages/Doner";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}
createRoot(rootEl).render(<Doner />);
