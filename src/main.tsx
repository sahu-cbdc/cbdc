/**
 * CBDC — একক entry point (শুধু index.html)
 *
 * এখন আর doner.html / admin.html / moderator.html নেই — চারটি পেজই .tsx
 * কম্পোনেন্ট হিসেবে থাকে। বুটের সময় resolveBootPage() বলে কোন পেজ মাউন্ট
 * হবে (URL হিন্ট, শেষ-ভিজিট বা ডিফল্ট home)। পেজ বদলাতে
 * navigateToPage() (src/lib/router.ts) ব্যবহার করা হয়।
 */
import { Component, Suspense, lazy, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./lib/router";
import { resolveBootPage, navigateToPage } from "./lib/router";
import { initSEO } from "./lib/seo";
import Home from "./pages/Home";

/* প্যানেলগুলো lazy-load — হোমপেজ দ্রুত খোলে, প্যানেল দরকার হলেই ডাউনলোড হয় */
const Doner = lazy(() => import("./pages/Doner"));
const Admin = lazy(() => import("./pages/Admin"));
const Moderator = lazy(() => import("./pages/Moderator"));

const bootPage = resolveBootPage();

function ActivePage() {
  // SEO init — home এর জন্য dynamic SEO, admin/moderator/doner এর জন্য noindex
  useEffect(() => {
    try {
      initSEO();
    } catch {}
    // Private panels should not be indexed
    if (bootPage !== "home") {
      try {
        let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
        if (!metaRobots) {
          metaRobots = document.createElement("meta");
          metaRobots.name = "robots";
          document.head.appendChild(metaRobots);
        }
        metaRobots.content = "noindex, nofollow";
      } catch {}
    }
  }, []);

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

/**
 * Error boundary — যে-কোনো প্যানেল/পেজ মাউন্ট বা render-এর সময় অপ্রত্যাশিত
 * ত্রুটি ঘটলেও **blank/সাদা পেজ না দেখিয়ে** একটি পরিষ্কার recoverable UI দেখায়।
 * Refresh-এর পরেও যদি কোনো কারণে মাউন্ট ব্যর্থ হয়, ব্যবহারকারী এখান থেকে
 * home-এ ফিরে গিয়ে পুনরায় চেষ্টা করতে পারেন — সাইট পুরোপুরি অচল থাকে না।
 */
interface EBState {
  error: Error | null;
}
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[app] render error:", error && error.message, error);
  }

  private reload = () => {
    try {
      navigateToPage("home");
    } catch {
      try {
        window.location.assign(window.location.origin + "/");
      } catch {
        /* ignore */
      }
    }
  };

  private hardReload = () => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            background: "#f2f5f4",
            color: "#141d1a",
            fontFamily: "inherit",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "420px" }}>
            <h1 style={{ fontSize: "1.25rem", margin: "0 0 10px" }}>একটি সমস্যা হয়েছে</h1>
            <p style={{ color: "#6b7b76", fontSize: ".9rem", lineHeight: 1.7, margin: "0 0 18px" }}>
              পেজটি লোড হতে পারেনি। পেজ রিফ্রেশ করুন অথবা হোমপেজে ফিরে যান।
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.reload}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "0",
                  background: "#087a4b",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                হোমপেজে যান
              </button>
              <button
                onClick={this.hardReload}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "1px solid #e4ebe8",
                  background: "#fff",
                  color: "#141d1a",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                রিফ্রেশ করুন
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}
createRoot(rootEl).render(
  <ErrorBoundary>
    <Suspense fallback={<div style={{ padding: "32px 16px", textAlign: "center" }}>লোড হচ্ছে…</div>}>
      <ActivePage />
    </Suspense>
  </ErrorBoundary>
);
