import { useEffect } from "react";
import Home from "./pages/Home";
import Doner from "./pages/Doner";
import Admin from "./pages/Admin";
import Moderator from "./pages/Moderator";

/**
 * চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC)
 *
 * মূল HTML-এর মতোই এটি একটি multi-page অ্যাপ্লিকেশন:
 *   index.html      →  "/"          →  Home.tsx
 *   doner.html      →  "/doner"     →  Doner.tsx
 *   admin.html      →  "/admin"     →  Admin.tsx
 *   moderator.html  →  "/moderator" →  Moderator.tsx
 *
 * পেজগুলোর মধ্যে নেভিগেশন মূল HTML-এর মতোই full page-load হয়
 * (state localStorage + Firebase-এ থাকে, তাই কিছু হারায় না)।
 */

type PageDef = {
  component: () => JSX.Element;
  title: string;
};

const ROUTES: Record<string, PageDef> = {
  "/": {
    component: Home,
    title: "চকবাজার ব্লাড ডোনার'স ক্লাব | CBDC",
  },
  "/doner": {
    component: Doner,
    title: "চকবাজার ব্লাড ডোনার'স ক্লাব",
  },
  "/admin": {
    component: Admin,
    title: "অ্যাডমিন প্যানেল — চকবাজার ব্লাড ডোনার'স ক্লাব",
  },
  "/moderator": {
    component: Moderator,
    title: "মডারেটর প্যানেল — চকবাজার ব্লাড ডোনার'স ক্লাব",
  },
};

function normalizePath(pathname: string): string {
  // trailing slash (e.g. "/admin/") → "/admin"
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return ROUTES[pathname] ? pathname : "/";
}

export default function App() {
  const path = normalizePath(window.location.pathname);
  const page = ROUTES[path] || ROUTES["/"];
  const Page = page.component;

  useEffect(() => {
    document.title = page.title;
  }, [page.title]);

  return <Page />;
}
