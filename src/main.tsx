/**
 * CBDC — একক entry point (শুধু index.html)
 *
 * এখন আর doner.html / admin.html / moderator.html নেই — চারটি পেজই .tsx
 * কম্পোনেন্ট হিসেবে থাকে। বুটের সময় resolveBootPage() বলে কোন পেজ মাউন্ট
 * হবে (URL হিন্ট, শেষ-ভিজিট বা ডিফল্ট home)। পেজ বদলাতে
 * navigateToPage() (src/lib/router.ts) ব্যবহার করা হয়।
 */
import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./lib/router";
import { resolveBootPage } from "./lib/router";
import Home from "./pages/Home";

/* প্যানেলগুলো lazy-load — হোমপেজ দ্রুত খোলে, প্যানেল দরকার হলেই ডাউনলোড হয় */
const Doner = lazy(() => import("./pages/Doner"));
const Admin = lazy(() => import("./pages/Admin"));
const Moderator = lazy(() => import("./pages/Moderator"));

const bootPage = resolveBootPage();

function ActivePage() {
  switch (bootPage) {
    case "doner":
      return <Doner />;
    case "admin":
      return <Admin />;
    case "moderator":
      return <Moderator />;
    default:
      return <Home />;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}
createRoot(rootEl).render(
  <Suspense fallback={<div style={{ padding: "32px 16px", textAlign: "center" }}>লোড হচ্ছে…</div>}>
    <ActivePage />
  </Suspense>
);
