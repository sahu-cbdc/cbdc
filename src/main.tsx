
import { Component, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/router";
import { resolveBootPage, navigateToPage } from "./lib/router";
import Home from "./pages/Home";


const importDoner = () => import("./pages/Doner");
const importAdmin = () => import("./pages/Admin");
const importModerator = () => import("./pages/Moderator");

const Doner = lazy(importDoner);
const Admin = lazy(importAdmin);
const Moderator = lazy(importModerator);

const bootPage = resolveBootPage();

/**
 * Prefetch the protected panel chunks AFTER the current page is interactive.
 * This costs nothing on the initial bundle (the chunks stay separate and are
 * fetched at idle priority) but removes the chunk-download stall when a
 * signed-in user navigates from the homepage into their panel.
 */
function prefetchPanels() {
  if (bootPage !== "home") return;
  const run = () => {
    void importDoner().catch(() => undefined);
    void importAdmin().catch(() => undefined);
    void importModerator().catch(() => undefined);
  };
  try {
    const conn = (navigator as any).connection;
    // Respect data-saver / very slow links.
    if (conn && (conn.saveData || /2g/i.test(String(conn.effectiveType || "")))) return;
    const idle = (window as any).requestIdleCallback;
    if (typeof idle === "function") idle(run, { timeout: 4000 });
    else setTimeout(run, 2500);
  } catch {
    setTimeout(run, 2500);
  }
}

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
        
      }
    }
  };

  private hardReload = () => {
    try {
      window.location.reload();
    } catch {
      
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
prefetchPanels();

createRoot(rootEl).render(
  <ErrorBoundary>
    <Suspense fallback={<div style={{ padding: "32px 16px", textAlign: "center" }}>লোড হচ্ছে…</div>}>
      <ActivePage />
    </Suspense>
  </ErrorBoundary>
);
