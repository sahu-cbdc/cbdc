// @ts-nocheck — এই ফাইলটি মূল HTML-এর JavaScript-এর verbatim (হুবহু) port।
// রূপান্তরের সময় runtime আচরণ ১০০% অপরিবর্তিত রাখাই লক্ষ্য; তাই legacy logic-কে
// TypeScript টাইপ-চেকিং থেকে মুক্ত রাখা হয়েছে। React shell ও shared store সম্পূর্ণ
// typed (src/lib/store.ts ও src/lib/firebase.ts দেখুন)।
/**
 * Moderator.tsx
 * React + TypeScript port of moderator.html — মডারেটর প্যানেল (mod)।
 */
import { useEffect } from "react";
import "../lib/store";
import { initFirebase as initSharedFirebase } from "../lib/firebase";
import { navigateToPage } from "../lib/router";
import { authErrorMessage } from "../lib/authx";
import SITE from "../config/site";

/* ═══════════════════════════════════════════════════════════════════
   CSS — মূল moderator.html-এর <style> ব্লক হুবহু কপি
   ═══════════════════════════════════════════════════════════════════ */
const pageCss = `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --grn:#087a4b; --grn-d:#065c39; --grn-s:#e8f6ef;
  --red:#e0242f; --red-d:#b0161f; --red-s:#fdeced;
  --amb:#b3760a; --amb-s:#fff6e3;
  --blu:#2563eb; --blu-s:#eef4ff;
  --ink:#141d1a; --ink2:#3d4c47; --mut:#6b7b76;
  --line:#e4ebe8; --bg:#f2f5f4; --card:#fff; --card2:#f7faf9;
  --nav-h:58px; --bar-h:56px; --wrap:760px;
  --sh:0 1px 2px rgba(20,29,26,.06),0 1px 3px rgba(20,29,26,.04);
  --sh2:0 4px 16px rgba(20,29,26,.09);
  --r:14px; --r2:10px;
}
[data-theme="dark"]{
  --ink:#e8f0ec; --ink2:#c2d0cb; --mut:#8b9c96;
  --line:#22302c; --bg:#0c1412; --card:#141f1c; --card2:#1a2724;
  --grn-s:#0d2c20; --red-s:#2b1214; --amb-s:#2a2109; --blu-s:#111d33;
  --sh:0 1px 3px rgba(0,0,0,.4); --sh2:0 4px 16px rgba(0,0,0,.5);
}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.65;
  font-family:"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",system-ui,-apple-system,"Segoe UI",sans-serif;
  overscroll-behavior-y:none}
body[data-dense="1"]{font-size:14px;line-height:1.55}
[data-anim="0"] *{animation:none!important;transition:none!important}
.hide{display:none!important}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none}
a{color:inherit;text-decoration:none}
svg{display:block;flex:none}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:#c5d2cd;border-radius:8px}
[data-theme="dark"]::-webkit-scrollbar-thumb{background:#2b3d38}
:focus-visible{outline:2px solid var(--grn);outline-offset:2px;border-radius:6px}


/* ═══════════ TOP BAR ═══════════ */
.top{position:fixed;top:0;left:0;right:0;z-index:60;height:var(--bar-h);
  display:flex;align-items:center;gap:10px;padding:0 14px;
  background:var(--card);border-bottom:1px solid var(--line);
  padding-top:env(safe-area-inset-top)}
.top.sub{gap:6px}
.brand{display:flex;align-items:center;gap:9px;min-width:0}
.brand .lg{width:36px;height:36px;border-radius:50%;background:#fff;display:grid;place-items:center;flex:none;
  overflow:hidden;box-shadow:0 1px 4px rgba(8,60,42,.16)}
.brand .lg img{width:34px;height:34px;object-fit:contain;display:block}
.brand b{font-size:.94rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.2px}
.back{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;color:var(--ink);flex:none}
.back:hover{background:var(--card2)}
.top h1{margin:0;font-size:1rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top .sp{flex:1}
.bell{position:relative;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;color:var(--ink2);flex:none}
.bell:hover{background:var(--card2)}
.bell .bd{position:absolute;top:3px;right:3px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;
  background:var(--red);color:#fff;font-size:.62rem;font-weight:800;display:grid;place-items:center;
  border:2px solid var(--card);line-height:1}

/* desktop nav inside topbar (Facebook style) */
.dnav{display:none;flex:1;justify-content:center;gap:4px}
.dnav button{position:relative;width:88px;height:calc(var(--bar-h) - 2px);display:grid;place-items:center;gap:2px;
  color:var(--mut);border-radius:8px;transition:background .15s}
.dnav button:hover{background:var(--card2)}
.dnav button span{font-size:.66rem;font-weight:700}
.dnav button.on{color:var(--grn)}
.dnav button.on:after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:3px;
  border-radius:3px 3px 0 0;background:var(--grn)}

/* ═══════════ BOTTOM NAV (mobile) ═══════════ */
.bnav{position:fixed;bottom:0;left:0;right:0;z-index:60;display:flex;
  background:var(--card);border-top:1px solid var(--line);
  padding-bottom:env(safe-area-inset-bottom)}
.bnav button{flex:1;height:var(--nav-h);display:grid;place-items:center;gap:2px;color:var(--mut);position:relative}
.bnav button span{font-size:.63rem;font-weight:700;letter-spacing:-.2px}
.bnav button.on{color:var(--grn)}
.bnav button.on:before{content:"";position:absolute;top:0;left:22%;right:22%;height:3px;border-radius:0 0 3px 3px;background:var(--grn)}

/* ═══════════ LAYOUT ═══════════ */
.app{padding-top:calc(var(--bar-h) + env(safe-area-inset-top));
     padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);min-height:100vh}
.wrap{max-width:var(--wrap);margin:0 auto;padding:14px}
.scr{display:none;animation:in .2s ease}
.scr.on{display:block}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

@media(min-width:900px){
  .dnav{display:flex}
  .bnav{display:none}
  .app{padding-bottom:34px}
  .brand b{max-width:230px}
  .top{padding:0 20px}
}
@media(max-width:899px){
  .brand b{font-size:.88rem;max-width:calc(100vw - 130px)}
}

/* ═══════════ UI PARTS ═══════════ */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);
  padding:15px;margin-bottom:12px}
.card.flat{box-shadow:none}
.card.pad0{padding:0;overflow:hidden}
.h2{margin:0 0 2px;font-size:.98rem;font-weight:800}
.mut{color:var(--mut);font-size:.78rem;margin:0}
/* every screen shares one rhythm: same top gap, same title size, same edges */
.scr>*:first-child{margin-top:0}
.scr>h2,.ptitle{margin:0 0 12px;padding:0 2px;font-size:1.1rem;font-weight:800;line-height:1.3}
.ptitle small{display:block;margin-top:3px;font-size:.78rem;font-weight:600;color:var(--mut)}
.sec-t{margin:20px 0 8px;padding:0 2px;font-size:.72rem;font-weight:800;color:var(--mut);letter-spacing:.4px}
.scr>.sec-t:first-child{margin-top:0}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 18px;
  border-radius:var(--r2);background:var(--grn);color:#fff;font-size:.85rem;font-weight:800;transition:.14s;border:1px solid transparent}
.btn:hover{background:var(--grn-d)}
.btn:active{transform:scale(.985)}
.btn:disabled{opacity:.5;pointer-events:none}
.btn.red{background:var(--red)} .btn.red:hover{background:var(--red-d)}
.btn.gh{background:var(--card);border-color:var(--line);color:var(--ink)}
.btn.gh:hover{background:var(--card2)}
.btn.w{width:100%}
.btn.lnk{background:none;color:var(--grn);min-height:auto;padding:2px 0;font-weight:800}

.row{display:flex;align-items:center;gap:11px;width:100%;padding:13px 15px;text-align:left;
  border-bottom:1px solid var(--line);transition:background .12s}
.row:last-child{border-bottom:0}
button.row:hover,a.row:hover{background:var(--card2)}
.row .ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:var(--card2);color:var(--ink2);flex:none}
.row .tx{flex:1;min-width:0}
.row .tx b{display:block;font-size:.86rem;font-weight:700}
.row .tx small{display:block;font-size:.74rem;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .rt{color:var(--mut);font-size:.79rem;display:flex;align-items:center;gap:6px;flex:none}

.pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:.68rem;font-weight:800;white-space:nowrap}
.pill:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.g{color:var(--grn);background:var(--grn-s)}
.pill.a{color:var(--amb);background:var(--amb-s)}
.pill.r{color:var(--red-d);background:var(--red-s)}
.pill.b{color:var(--blu);background:var(--blu-s)}
.pill.m{color:var(--mut);background:var(--card2)}
.pill.n:before{display:none}
.bg{display:inline-grid;place-items:center;min-width:40px;height:26px;padding:0 8px;border-radius:8px;
  background:var(--red-s);color:var(--red-d);font-weight:800;font-size:.78rem}

.note{display:flex;gap:9px;padding:12px 14px;border-radius:var(--r2);font-size:.79rem;line-height:1.6;margin-bottom:12px}
.note svg{margin-top:2px}
.note.i{background:var(--blu-s);color:#1c4b96}
.note.w{background:var(--amb-s);color:#8a5c07}
.note.g{background:var(--grn-s);color:var(--grn-d)}
.note.r{background:var(--red-s);color:var(--red-d)}
[data-theme="dark"] .note.i{color:#8fb8f7}[data-theme="dark"] .note.w{color:#e8c67a}
[data-theme="dark"] .note.g{color:#7fd6ab}[data-theme="dark"] .note.r{color:#f3a0a6}

.f{margin-bottom:13px}
.f label{display:block;margin-bottom:5px;font-size:.76rem;font-weight:700;color:var(--ink2)}
.f label i{color:var(--red);font-style:normal}
.f input[readonly],.f input:disabled,.f select:disabled{background:var(--card2);color:var(--mut)}
.f .hint{display:block;margin-top:5px;font-size:.72rem;color:var(--mut)}
.f .hint.ok{color:var(--grn)} .f .hint.er{color:var(--red-d)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
@media(max-width:520px){.f2{grid-template-columns:1fr}}

.tabs::-webkit-scrollbar{display:none}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}
@media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat{padding:12px 11px;background:var(--card);border:1px solid var(--line);border-radius:var(--r2);text-align:center}
.stat b{display:block;font-size:1.3rem;font-weight:800;line-height:1.2}
.stat span{display:block;font-size:.69rem;color:var(--mut);font-weight:600}

.per{display:flex;align-items:center;gap:11px}
.per img{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--card2);flex:none}
.per.lg img{width:62px;height:62px}
.per .i{flex:1;min-width:0}
.per b{display:block;font-size:.88rem;font-weight:800}
.per small{display:block;font-size:.75rem;color:var(--mut)}

.empty{padding:44px 20px;text-align:center}
.empty .ic{width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:var(--card2);
  display:grid;place-items:center;color:var(--mut)}
.empty b{display:block;font-size:.92rem;margin-bottom:4px}
.empty p{margin:0 0 15px;font-size:.79rem;color:var(--mut)}

.sk{background:linear-gradient(90deg,var(--card2) 25%,var(--line) 50%,var(--card2) 75%);
  background-size:200% 100%;animation:sh 1.3s infinite;border-radius:8px}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ---------- guidance / intro block ---------- */
.intro{border:1px solid var(--line);border-radius:var(--r);padding:14px 15px;margin-bottom:14px;
  background:linear-gradient(150deg,var(--grn-s),var(--card))}
.intro .ih{display:flex;gap:10px;align-items:flex-start}
.intro .ih .ic{color:var(--grn);flex:none;margin-top:1px}
.intro .ih b{font-size:.92rem;display:block}
.intro .ih small{display:block;color:var(--mut);font-size:.79rem;margin-top:2px;line-height:1.45}
.steps{list-style:none;counter-reset:st;margin:12px 0 0;padding:0;display:grid;gap:9px}
.steps li{counter-increment:st;position:relative;padding-left:29px;font-size:.8rem;line-height:1.5}
.steps li::before{content:counter(st);position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:50%;
  background:var(--grn);color:#fff;font-size:.68rem;font-weight:800;display:grid;place-items:center}
.steps li b{display:block;font-size:.83rem}
.steps li span{color:var(--mut)}
.steps li em{font-style:normal;color:var(--grn);font-weight:700}
.statrow{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:4px}
@media(max-width:420px){.statrow{grid-template-columns:1fr 1fr}.statrow .st:last-child{grid-column:1/-1}}
.statrow .st{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);padding:11px 8px;text-align:center}
.statrow .st b{display:block;font-size:1.18rem;font-weight:800;line-height:1.1}
.statrow .st small{display:block;color:var(--mut);font-size:.68rem;margin-top:3px;line-height:1.3}
.statrow .st.good b{color:var(--grn)}
.statrow .st.warn b{color:var(--amb)}
.chk{display:flex;gap:9px;align-items:flex-start;margin-top:12px;font-size:.81rem;line-height:1.45;cursor:pointer}
.chk input{width:17px;height:17px;flex:none;margin-top:1px;accent-color:var(--grn)}
.lnk{background:none;border:0;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;padding:2px 4px}

/* sheet / modal */
.ov{position:fixed;inset:0;z-index:90;background:rgba(8,20,16,.5);animation:fade .16s;backdrop-filter:blur(2px)}
@keyframes fade{from{opacity:0}to{opacity:1}}
.sheet{position:fixed;z-index:95;background:var(--card);box-shadow:0 -8px 40px rgba(0,0,0,.25)}
@media(max-width:719px){
  .sheet{left:0;right:0;bottom:0;max-height:92vh;overflow-y:auto;border-radius:20px 20px 0 0;animation:up .24s cubic-bezier(.2,.9,.3,1);
    padding-bottom:env(safe-area-inset-bottom)}
  @keyframes up{from{transform:translateY(100%)}to{transform:none}}
  .sheet .grab{width:38px;height:4px;border-radius:9px;background:var(--line);margin:9px auto 2px}
}
@media(min-width:720px){
  .sheet{top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));
    max-height:88vh;overflow-y:auto;border-radius:16px;animation:pop .2s}
  @keyframes pop{from{opacity:0;transform:translate(-50%,-46%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%)}}
  .sheet .grab{display:none}
}
.sheet .hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;position:sticky;top:0;background:var(--card);z-index:2}
.sheet .hd h3{margin:0;font-size:1rem;font-weight:800;flex:1}
.sheet .bd{padding:0 16px 16px}
.sheet .ft{display:flex;gap:9px;padding:12px 16px;border-top:1px solid var(--line);position:sticky;bottom:0;background:var(--card)}
.sheet .ft .btn{flex:1}
.x{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--mut)}
.x:hover{background:var(--card2)}

/* toast */
.toasts{position:fixed;left:50%;transform:translateX(-50%);z-index:120;display:flex;flex-direction:column;gap:8px;
  width:calc(100vw - 28px);max-width:400px;pointer-events:none;
  bottom:calc(var(--nav-h) + env(safe-area-inset-bottom) + 14px)}
@media(min-width:900px){.toasts{bottom:22px}}
.toasts div{display:flex;align-items:center;gap:9px;padding:12px 15px;border-radius:11px;
  background:#182924;color:#fff;font-size:.81rem;font-weight:600;box-shadow:var(--sh2);animation:tin .2s}
.toasts div.ok{background:var(--grn)} .toasts div.er{background:var(--red-d)}
/* ═══════════ ADMIN EXTRAS ═══════════
   The shell above is app.html's, unchanged. Only genuinely new
   admin components live here — nothing that already exists is redefined. */

/* brand subtitle under the club name */
.brand .btx{min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.15}
.brand .btx b{display:block;font-size:.92rem;font-weight:800;line-height:1.2;letter-spacing:-.2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand .btx small{display:block;font-size:.66rem;font-weight:800;color:var(--grn);letter-spacing:.4px;line-height:1.2;margin-top:1px}
@media(max-width:899px){.brand .btx b{font-size:.84rem;max-width:calc(100vw - 150px)}}
@media(max-width:380px){.brand .btx b{max-width:calc(100vw - 160px)}}

/* nav badge on the bottom/desktop nav (pending counter) */
.bnav button .nb,.dnav button .nb{position:absolute;top:5px;left:50%;margin-left:6px;min-width:16px;height:16px;
  padding:0 4px;border-radius:99px;background:var(--red);color:#fff;font-size:.6rem;font-weight:800;
  display:grid;place-items:center;font-style:normal;line-height:1;border:2px solid var(--card)}
.dnav button .nb{top:7px;margin-left:8px}

/* stat strip — 4 small numbers, same rhythm as app's .statrow */
.astat{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}
@media(max-width:520px){.astat{grid-template-columns:1fr 1fr}}
.astat button{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);padding:12px 9px;
  text-align:center;transition:.14s}
.astat button:hover{background:var(--card2);border-color:var(--grn)}
.astat b{display:block;font-size:1.32rem;font-weight:800;line-height:1.15}
.astat span{display:block;font-size:.68rem;color:var(--mut);font-weight:700;margin-top:2px;line-height:1.3}
.astat .g b{color:var(--grn)} .astat .r b{color:var(--red)} .astat .a b{color:var(--amb)} .astat .b b{color:var(--blu)}

/* work item card — one pending task */
.wk{display:flex;gap:11px;align-items:flex-start;width:100%;padding:13px 15px;text-align:left;
  border-bottom:1px solid var(--line)}
.wk:last-child{border-bottom:0}
.wk:hover{background:var(--card2)}
.wk .bd2{flex:1;min-width:0}
.wk .kd{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px}
.wk .nm{display:block;font-size:.9rem;font-weight:800;line-height:1.35}
.wk .ms{display:block;font-size:.76rem;color:var(--mut);line-height:1.5}
.wk .go{color:var(--mut);flex:none;align-self:center}
.wk.urg{background:linear-gradient(90deg,rgba(224,36,47,.05),transparent 60%)}

/* selection action bar */
.selbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:var(--grn);color:#fff;border-radius:var(--r2);
  padding:9px 12px;margin-bottom:10px;box-shadow:var(--sh2)}
.selbar b{font-size:.82rem;color:#fff}
.selbar .sa{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.selbar button{padding:8px 13px;min-height:38px;border-radius:8px;
  background:rgba(255,255,255,.2);color:#fff;font-size:.76rem;font-weight:800;
  display:inline-flex;align-items:center;gap:5px}
.selbar button:hover{background:rgba(255,255,255,.32)}

/* key-value grid inside cards */
@media(max-width:440px){.kv{grid-template-columns:1fr}}
/* blood availability bars */
.bars{display:grid;gap:8px}
.bar{display:flex;align-items:center;gap:10px}
.bar .bl{width:36px;font-size:.77rem;font-weight:800;color:var(--ink2);flex:none}
.bar .bt{flex:1;height:10px;border-radius:9px;background:var(--card2);overflow:hidden}
.bar .bt i{display:block;height:100%;border-radius:9px;transition:width .3s}
.bar .bv{width:26px;text-align:right;font-size:.77rem;font-weight:800;flex:none}
.bar .bv.low{color:var(--red)}

/* 7-day / 6-month column chart */
.spark{display:flex;align-items:flex-end;gap:6px;height:104px;padding-top:6px}
.spark i{flex:1;background:var(--grn-s);border-radius:6px 6px 0 0;position:relative;min-height:5px;
  display:flex;align-items:flex-start;justify-content:center}
.spark i:after{content:"";position:absolute;inset:auto 0 0 0;height:38%;background:var(--grn);
  border-radius:0 0 6px 6px;opacity:.9}
.spark i b{position:relative;z-index:1;font-size:.64rem;font-weight:800;color:var(--grn);margin-top:-15px}
.sparkx{display:flex;gap:6px;margin-top:5px}
.sparkx span{flex:1;text-align:center;font-size:.62rem;color:var(--mut);font-weight:700}

/* donut */
.donut{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center}
.donut .dw{width:118px;height:118px;border-radius:50%;position:relative;flex:none}
.donut .dw:after{content:"";position:absolute;inset:23px;border-radius:50%;background:var(--card)}
.donut .dw b{position:absolute;inset:0;display:grid;place-items:center;z-index:1;font-size:1.15rem;font-weight:800}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:.73rem;font-weight:700}
.legend div{display:flex;align-items:center;gap:6px}
.legend i{width:9px;height:9px;border-radius:3px;flex:none}

/* timeline (audit / activity) */
.tl{position:relative;padding-left:17px}
.tl:before{content:"";position:absolute;left:4px;top:5px;bottom:5px;width:2px;background:var(--line)}
.tl .ti{position:relative;padding:0 0 13px}
.tl .ti:last-child{padding-bottom:0}
.tl .ti:before{content:"";position:absolute;left:-17px;top:5px;width:10px;height:10px;border-radius:50%;
  background:var(--grn);border:2px solid var(--card);box-shadow:0 0 0 2px var(--grn-s)}
.tl .ti.a:before{background:var(--amb);box-shadow:0 0 0 2px var(--amb-s)}
.tl .ti b{display:block;font-size:.83rem;font-weight:700;line-height:1.45}
.tl .ti small{display:block;font-size:.72rem;color:var(--mut)}

/* progress steps for a live request */
.stp{display:flex;gap:4px;margin-top:11px}
.stp span{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.63rem;
  font-weight:700;color:var(--mut);position:relative}
.stp span i{width:20px;height:20px;border-radius:50%;background:var(--card2);color:var(--mut);
  display:grid;place-items:center;font-size:.63rem;font-weight:800;font-style:normal;z-index:1}
.stp span:before{content:"";position:absolute;top:10px;right:50%;left:-50%;height:2px;background:var(--line)}
.stp span:first-child:before{display:none}
.stp span.ok{color:var(--grn)}
.stp span.ok i{background:var(--grn);color:#fff}
.stp span.ok:before{background:var(--grn)}

/* filter row */
/* chip filters */
/* small tag */
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:var(--card2);
  color:var(--mut);font-size:.68rem;font-weight:800;white-space:nowrap}
.tag.r{background:var(--red-s);color:var(--red-d)}
.tag.g{background:var(--grn-s);color:var(--grn)}
.tag.a{background:var(--amb-s);color:var(--amb)}
.tag.b{background:var(--blu-s);color:var(--blu)}

/* person row */
.prow{display:flex;align-items:center;gap:11px;width:100%;padding:12px 15px;text-align:left;
  border-bottom:1px solid var(--line)}
.prow:last-child{border-bottom:0}
button.prow:hover{background:var(--card2)}
.prow .bg2{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;
  background:var(--red-s);color:var(--red-d);font-size:.82rem;font-weight:800}
.prow .tx{flex:1;min-width:0}
.prow .tx b{display:block;font-size:.85rem;font-weight:700}
.prow .tx small{display:block;font-size:.73rem;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* live website preview */
.pv{border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;background:var(--card2)}
.pv .pvb{display:flex;align-items:center;gap:5px;padding:8px 11px;background:var(--card2);border-bottom:1px solid var(--line)}
.pv .pvb i{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
.pv .pvb span{margin-left:7px;font-size:.68rem;color:var(--mut);font-weight:700}
.pv iframe{width:100%;height:390px;border:0;background:#fff;display:block}
.pvsz{display:flex;gap:4px;margin-bottom:9px}
.pvsz button{flex:1;padding:7px;border-radius:8px;background:var(--card2);border:1px solid var(--line);
  font-size:.74rem;font-weight:700;color:var(--mut)}
.pvsz button.on{background:var(--grn-s);border-color:var(--grn);color:var(--grn)}

/* gallery grid */
.ggrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(min-width:640px){.ggrid{grid-template-columns:repeat(3,1fr)}}
.gi2{border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;background:var(--card)}
.gi2 img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:var(--card2)}
.gi2 .gt{padding:9px 10px}
.gi2 .gt b{display:block;font-size:.78rem;font-weight:700;line-height:1.35}
.gi2 .gt small{display:block;font-size:.68rem;color:var(--mut)}
.gi2 .gx{display:flex;border-top:1px solid var(--line)}
.gi2 .gx button{flex:1;padding:8px;font-size:.72rem;font-weight:700;color:var(--ink2);min-height:var(--ctl-sm)}
.gi2 .gx button:hover{background:var(--card2)}
.gi2 .gx button+button{border-left:1px solid var(--line)}

/* upload dropzone */
.dz{border:2px dashed var(--line);border-radius:var(--r2);padding:24px 16px;text-align:center;
  display:grid;gap:5px;justify-items:center;color:var(--mut);cursor:pointer}
.dz:hover,.dz.on{border-color:var(--grn);background:var(--grn-s)}
.dz b{font-size:.85rem;color:var(--ink)}
.dz small{font-size:.72rem}
.pgb{height:7px;border-radius:9px;background:var(--card2);overflow:hidden;margin-top:11px}
.pgb i{display:block;height:100%;width:0;background:var(--grn);border-radius:9px;transition:width .2s}

/* permission chips */
.pms{display:flex;gap:5px;flex-wrap:wrap}
.pms span{padding:4px 9px;border-radius:7px;background:var(--card2);color:var(--mut);
  font-size:.68rem;font-weight:700}
.pms span.on{background:var(--grn-s);color:var(--grn)}

/* mini search results */
.sres{border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;margin-top:10px}
.sres .sh2{padding:7px 12px;font-size:.66rem;font-weight:800;color:var(--mut);background:var(--card2)}

/* warning list */
.wl{margin:0;padding-left:17px;font-size:.8rem;line-height:1.9;color:var(--ink2)}
.wl li::marker{color:var(--amb)}

/* form fields (matches app.html .f) */
a.btn{text-decoration:none}
.hint2{font-size:.75rem;color:var(--mut);line-height:1.6;margin:0}

/* ---------- donor workspace tabs ---------- */
.per.lg img{width:62px;height:62px}
.per img{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--card2);flex:none}
.per .i small{display:block;font-size:.75rem;color:var(--mut);line-height:1.5}
body[data-dense="1"]{font-size:14px;line-height:1.55}
body[data-dense="1"] .card{padding:12px;margin-bottom:9px}
body[data-anim="0"] *{animation:none!important;transition:none!important}

/* ═══════════════════════════════════════════════════════════════
   COMMON UI SYSTEM  —  one source of truth for every panel
   (admin.html, moderator.html … and app.html later)

   Everything below fixes a ROOT CAUSE, never a single screen:
   1. one scroll-strip primitive   → .strip
   2. one minimum hit area         → .hit
   3. one field/control height     → --ctl
   4. one page rhythm              → .scr spacing
   No component re-declares these; they inherit.
   ═══════════════════════════════════════════════════════════════ */
:root{
  --ctl:44px;        /* every tappable control is at least this tall */
  --ctl-sm:36px;     /* dense variant, still ≥ minimum hit area via .hit */
  --gap:10px;
  --pad-x:14px;      /* the single horizontal page padding */
  --strip-fade:22px;
}

/* ───────── 1. SCROLL STRIP ─────────
   Tabs, chips and segmented controls are all the same thing:
   a horizontal row that may overflow. One class, one behaviour. */
.strip{
  display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;
  scroll-behavior:smooth;scroll-snap-type:x proximity;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;
  padding:2px 0;margin-bottom:12px;
  /* fade the right edge so it is obvious more content exists */
  -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - var(--strip-fade)),transparent);
  mask-image:linear-gradient(90deg,#000 calc(100% - var(--strip-fade)),transparent);
}
.strip::-webkit-scrollbar{display:none}
.strip.at-end{-webkit-mask-image:none;mask-image:none}
.strip>*{flex:none;scroll-snap-align:start}
/* strips that fit never fade or scroll */
.strip.fits{-webkit-mask-image:none;mask-image:none;overflow-x:visible}
/* wrapping variant — used inside sheets where vertical room is cheap */
.strip.wrap{flex-wrap:wrap;overflow:visible;-webkit-mask-image:none;mask-image:none}

/* the three flavours are only skins on top of .strip */
.chips>button{
  min-height:var(--ctl-sm);padding:9px 14px;border-radius:99px;
  border:1px solid var(--line);background:var(--card);
  font-size:.78rem;font-weight:700;color:var(--ink2);white-space:nowrap;
  display:inline-flex;align-items:center;gap:5px;transition:.14s}
.chips>button:hover{background:var(--card2)}
.chips>button.on{background:var(--grn);border-color:var(--grn);color:#fff}
.chips>button .c{opacity:.8;font-size:.72rem;font-style:normal}

.tabs{gap:2px;border-bottom:1px solid var(--line);margin-bottom:13px;padding-bottom:0}
.tabs>button{
  min-height:var(--ctl);padding:11px 15px;font-size:.81rem;font-weight:700;
  color:var(--mut);white-space:nowrap;border-bottom:2px solid transparent;
  background:none;transition:color .14s,border-color .14s}
.tabs>button:hover{color:var(--ink2)}
.tabs>button.on{color:var(--grn);border-bottom-color:var(--grn)}

.seg{gap:3px;padding:3px;border-radius:11px;background:var(--card2);
  border:1px solid var(--line);overflow:hidden}
.seg>button{
  flex:1 1 0;min-width:0;min-height:var(--ctl-sm);padding:8px 10px;border-radius:8px;
  color:var(--mut);font-size:.78rem;font-weight:700;white-space:nowrap;
  text-overflow:ellipsis;overflow:hidden;transition:.14s}
.seg>button.on{background:var(--card);color:var(--grn);box-shadow:var(--sh)}
.seg>button:disabled{opacity:.45}

/* ───────── 2. MINIMUM HIT AREA ─────────
   ROOT CAUSE: controls painted at 24–38px are hard to tap.

   The honest fix is to make the CONTROL itself 44px and shrink only what
   is painted, instead of layering an invisible pseudo-element that the
   parent's stacking context can swallow. Padding grows the box; the visual
   size is held by the inner glyph or by background-clip.
   One rule set, applied to every panel.                                */

/* icon buttons: 44px box, icon stays centred and visually the same size */
.bell,.back,.x,.tbtn{
  min-width:var(--ctl);min-height:var(--ctl);
  display:inline-grid;place-items:center;border-radius:50%;flex:none}

/* toggle: 44px tap box, 28px painted track drawn with a pseudo-element */
.tg{
  position:relative;width:48px;height:var(--ctl);flex:none;border:0;
  background:none;cursor:pointer;padding:0}
.tg::before{                       /* the visible track */
  content:"";position:absolute;left:0;top:50%;translate:0 -50%;
  width:48px;height:28px;border-radius:99px;background:#cad6d1;transition:background .18s}
.tg::after{                        /* the knob */
  content:"";position:absolute;left:3px;top:50%;translate:0 -50%;
  width:22px;height:22px;border-radius:50%;background:#fff;
  transition:left .18s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.tg.on::before{background:var(--grn)}
.tg.on::after{left:23px}
.tg:disabled{opacity:.45;cursor:default}
[data-theme="dark"] .tg::before{background:#31443e}

/* checkbox: 44px tap box, 24px painted square */
.ck{
  position:relative;width:var(--ctl);height:var(--ctl);flex:none;border:0;
  background:none;display:grid;place-items:center;padding:0;cursor:pointer;
  margin:-10px}                    /* keep the visual gap unchanged */
.ck::before{
  content:"";position:absolute;left:50%;top:50%;translate:-50% -50%;
  width:24px;height:24px;border-radius:7px;border:1.6px solid var(--line);
  background:var(--card);transition:background .14s,border-color .14s}
.ck.on::before{background:var(--grn);border-color:var(--grn)}
.ck>svg{position:relative;z-index:1;color:#fff}

/* Small buttons: the BOX is 40px (comfortable), the painted pill stays
   compact because the label keeps its own smaller line-box. Going below
   40px is what made them hard to press, so 40 is the floor everywhere. */
.btn.sm{min-height:40px;padding:8px 13px;font-size:.78rem;border-radius:9px}
.btn.sm.w{min-height:var(--ctl)}

/* strip buttons already sized in section 1 */
label.row,.row:has(.tg),.mrow:has(.tg){cursor:pointer}

/* every strip button is a real 40px+ target */
.strip>button{min-height:40px}

/* ───────── UNIVERSAL FLOOR ─────────
   Any clickable thing inside a panel is at least 40px tall. Components no
   longer need to remember this — and no future component can regress it.
   Inline text links and the tiny colour swatches opt out explicitly.   */
.scr button:not(.lnk):not(.tg):not(.ck),
.scr a.btn,.sheet button:not(.lnk):not([data-close].x),.top button,.bnav button{
  min-height:40px}
.scr .btn.lnk,.sheet .btn.lnk{min-height:0}

/* ───────── 3. CONTROLS ─────────
   One height, one radius, one focus ring — everywhere. */
.f input,.f select,.f textarea,
.frow input,.frow select,
.sheet input,.sheet select,.sheet textarea{
  min-height:var(--ctl);border-radius:10px;border:1px solid var(--line);
  background:var(--card);color:var(--ink);font-family:inherit;font-size:.86rem;
  outline:0;width:100%;padding:10px 13px}
.f textarea,.sheet textarea{min-height:80px;resize:vertical;line-height:1.6}
.f input:focus,.f select:focus,.f textarea:focus,
.frow input:focus,.frow select:focus,
.sheet input:focus,.sheet select:focus,.sheet textarea:focus{
  border-color:var(--grn);box-shadow:0 0 0 3px rgba(8,122,75,.1)}
.f input:disabled,.f select:disabled,.f textarea:disabled{background:var(--card2);color:var(--mut)}
select{appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b7b76' stroke-width='2' stroke-linecap='round'><path d='M4 6l4 4 4-4'/></svg>");
  background-repeat:no-repeat;background-position:right 12px center;padding-right:34px!important}
.btn{min-height:var(--ctl)}

/* ───────── 4. FILTER ROW ─────────
   Wraps instead of overflowing; every control shares one height. */
.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.frow input,.frow select{width:auto;min-width:0;flex:1 1 150px;min-height:var(--ctl)}
.frow input.gw{flex:1 1 100%}
@media(min-width:560px){.frow input.gw{flex:1 1 220px}}
.frow>.btn{flex:0 0 auto}

/* ───────── 5. PAGE RHYTHM ─────────
   Identical spacing on every screen, so pages never look different sizes. */
.scr>*:first-child{margin-top:0}
.scr>.card,.scr>.astat,.scr>.strip,.scr>.panel{margin-bottom:12px}
.scr>.sec-t{margin:18px 0 8px}
.scr>.sec-t:first-child{margin-top:0}
.scr>.btn.w+.btn.w{margin-top:8px}
.scr::after{content:"";display:block;height:6px}

/* ───────── 6. TEXT SAFETY ─────────
   Long Bangla words, IDs and emails can never push a layout wider. */
.scr,.sheet{overflow-wrap:anywhere}
.row .tx b,.row .tx small,.prow .tx b,.prow .tx small,
.wk .nm,.wk .ms,.kv b,.alert .tx b,.alert .tx small{min-width:0;overflow-wrap:anywhere}
.row .tx small,.prow .tx small{white-space:normal}
/* key–value grid: label above value, never side by side */
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px 14px}
.kv>div{min-width:0}
.kv span{display:block;font-size:.7rem;color:var(--mut);font-weight:700;line-height:1.5}
.kv b{display:block;font-size:.83rem;font-weight:700;line-height:1.5;word-break:break-word}

/* ───────── 7. STICKY SAFETY ─────────
   Sticky bars must clear the fixed top bar on every screen size. */
.selbar,.bulkbar{position:sticky;top:calc(var(--bar-h) + env(safe-area-inset-top) + 6px);z-index:40}

/* ───────── 8. SHEET ─────────
   Full-width on phones, centred card above; footer always reachable. */
.sheet .ft{display:flex;gap:9px;padding:12px 16px;border-top:1px solid var(--line);
  position:sticky;bottom:0;background:var(--card);
  padding-bottom:calc(12px + env(safe-area-inset-bottom))}
.sheet .ft .btn{flex:1;min-height:var(--ctl)}
.sheet .bd{padding:0 16px 16px}
.sheet .bd>*:first-child{margin-top:0}

/* ───────── 9. SMALL SCREENS ─────────
   One breakpoint set, shared by every panel. */
@media(max-width:420px){
  :root{--pad-x:12px}
  .wrap{padding:12px}
  .astat{grid-template-columns:1fr 1fr!important}
  .phead .pa{width:100%}
  .phead .pa .btn{flex:1}
  .ggrid{grid-template-columns:1fr 1fr}
}
@media(max-width:340px){
  .astat{grid-template-columns:1fr!important}
  .seg>button{font-size:.72rem;padding:8px 6px}
}

/* ───────── LOGOUT ─────────
   Present in every panel, directly under account management. Styled as a
   quiet danger action: obvious, but not competing with primary buttons. */
.logout-btn{color:var(--red-d);border-color:rgba(224,36,47,.28);font-weight:800;margin-bottom:4px}
.logout-btn:hover{background:var(--red-s);border-color:var(--red)}
.logout-btn svg{color:var(--red-d)}


/* ───────── ACTION COLOUR CODING ─────────
   One meaning, one colour, everywhere in both panels:
     green  = approve / confirm      (.btn        — the default)
     amber  = reject / caution       (.btn.amb)
     red    = delete / destructive   (.btn.red)
     ghost  = neutral, no consequence(.btn.gh)
   Ghost buttons that carry a *meaning* get a tinted label + border so a
   destructive or cautionary choice can never look like plain "close". */
.btn.amb{background:var(--amb);color:#fff}
.btn.amb:hover{background:#8f5e08}
.btn.gh.amb{background:var(--card);color:var(--amb);border-color:rgba(179,118,10,.4)}
.btn.gh.amb:hover{background:var(--amb-s);border-color:var(--amb)}
.btn.gh.amb svg{color:var(--amb)}
.btn.gh.red{background:var(--card);color:var(--red-d);border-color:rgba(224,36,47,.4)}
.btn.gh.red:hover{background:var(--red-s);border-color:var(--red)}
.btn.gh.red svg{color:var(--red)}
.btn.gh.grn{background:var(--card);color:var(--grn-d);border-color:rgba(8,122,75,.4)}
.btn.gh.grn:hover{background:var(--grn-s);border-color:var(--grn)}
.btn.gh.grn svg{color:var(--grn)}
/* selection bar sits on a green field, so its actions are tinted chips */
.selbar button.ok{background:#fff;color:var(--grn-d)}
.selbar button.ok:hover{background:#eafaf2}
.selbar button.no{background:rgba(255,255,255,.18);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55)}
.selbar button.no:hover{background:rgba(255,255,255,.3)}
.selbar button.cl{background:transparent;color:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)}
.selbar button.cl:hover{background:rgba(255,255,255,.16);color:#fff}
.selbar button svg{display:inline-block;vertical-align:-2px}`;

/* ═══════════════════════════════════════════════════════════════════
   Static UI — মূল moderator.html-এর <body> মার্কআপ হুবহু JSX-এ
   ═══════════════════════════════════════════════════════════════════ */
function StaticShell() {
  return (
    <>
      {" "}
      {/* ══════════ TOP BAR ══════════ */}
      {" "}
      <header className="top" id="top">
      </header>
      {" "}
      {/* ══════════ APP ══════════ */}
      {" "}
      <main className="app">
        {" "}
        <div className="wrap">
          {" "}
          <section className="scr on" id="s-home">
          </section>
          {" "}
          <section className="scr" id="s-work">
          </section>
          {" "}
          <section className="scr" id="s-people">
          </section>
          {" "}
          <section className="scr" id="s-set">
          </section>
          {" "}
          <section className="scr" id="s-sub">
          </section>
          {" "}
        </div>
        {" "}
      </main>
      {" "}
      {/* ══════════ BOTTOM NAV ══════════ */}
      {" "}
      <nav className="bnav" id="bnav">
      </nav>
      {" "}
      <div className="toasts" id="toasts">
      </div>
      {" "}
      {/* Shared live state: same donors, requests and moderation queue across all pages (Firestore) */}
      {" "}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Page logic — মূল moderator.html-এর <script type="module"> হুবহু port
   ═══════════════════════════════════════════════════════════════════ */
function initPage() {
  /* which panel this build is */
  const PANEL={id:"mod",role:"mod",label:"মডারেটর প্যানেল"};
  const LOGO = "./img/logo.png";  /* img/logo.png ফাইল থেকে লোগো — ফাইল বদলালেই সর্বত্র নতুন লোগো */
  const I=(p,sz=22)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON={
    logo:`<img src="${LOGO}" alt="CBDC" width="20" height="20" style="display:block;object-fit:contain">`,
    home:s=>I(`<path d="M3 10.2 12 3l9 7.2"/><path d="M5.5 9.4V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.4"/>`,s),
    drop:s=>I(`<path d="M12 3s6 6.7 6 10.7A6 6 0 0 1 6 13.7C6 9.7 12 3 12 3z"/><path d="M12 17.2a3.2 3.2 0 0 1-3.2-3.2"/>`,s),
    plus:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M12 8.2v7.6M8.2 12h7.6"/>`,s),
    gear:s=>I(`<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.09A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.09A1.6 1.6 0 0 0 15 4.6a1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v0a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47 1z"/>`,s),
    bell:s=>I(`<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>`,s),
    back:s=>I(`<path d="M15 19l-7-7 7-7"/>`,s),
    right:s=>I(`<path d="M9 5l7 7-7 7"/>`,s),
    x:s=>I(`<path d="M18 6 6 18M6 6l12 12"/>`,s),
    user:s=>I(`<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>`,s),
    lock:s=>I(`<rect x="4" y="10.5" width="16" height="10.5" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>`,s),
    shield:s=>I(`<path d="M12 22s8-3.6 8-9.5V5.5L12 2.5 4 5.5v7c0 5.9 8 9.5 8 9.5z"/>`,s),
    eye:s=>I(`<path d="M2.2 12.3a1 1 0 0 1 0-.6 10.5 10.5 0 0 1 19.6 0 1 1 0 0 1 0 .6 10.5 10.5 0 0 1-19.6 0z"/><circle cx="12" cy="12" r="3"/>`,s),
    eyeOff:s=>I(`<path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c5 0 8.4 3.5 9.8 6.7a1 1 0 0 1 0 .6 12.6 12.6 0 0 1-2.2 3.3"/><path d="M6.6 6.6A13.2 13.2 0 0 0 2.2 11.7a1 1 0 0 0 0 .6C3.6 15.5 7 19 12 19a10.3 10.3 0 0 0 5.3-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>`,s),
    paint:s=>I(`<path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 13.7 21z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>`,s),
    help:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.4-2.5 2.4"/><path d="M12 17.1h.01"/>`,s),
    warn:s=>I(`<path d="M10.3 3.9 2.4 17.4A1.9 1.9 0 0 0 4 20.3h16a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0z"/><path d="M12 9.3v4M12 16.8h.01"/>`,s),
    info:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>`,s),
    check:s=>I(`<path d="M20 6.5 9.4 17.1 4 11.7"/>`,s),
    checkC:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M8.4 12.2l2.5 2.5 4.7-4.7"/>`,s),
    phone:s=>I(`<path d="M21.6 16.8v2.7a1.8 1.8 0 0 1-2 1.8 17.9 17.9 0 0 1-7.8-2.8 17.6 17.6 0 0 1-5.4-5.4A17.9 17.9 0 0 1 3.6 5.2a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.5 1.8z"/>`,s),
    chat:s=>I(`<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.8l1.7-5a8.4 8.4 0 0 1-.8-3.8 8.4 8.4 0 0 1 8.4-9 8.4 8.4 0 0 1 8.7 8.5z"/>`,s),
    card:s=>I(`<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 9.8h19"/><path d="M6.5 14.5h4"/>`,s),
    device:s=>I(`<rect x="4" y="3" width="10" height="18" rx="2"/><path d="M8.5 18h1"/><path d="M17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3"/>`,s),
    clock:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M12 7.2v5l3 1.6"/>`,s),
    bellS:s=>I(`<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>`,s),
    logout:s=>I(`<path d="M9.5 21H5.4A2.4 2.4 0 0 1 3 18.6V5.4A2.4 2.4 0 0 1 5.4 3h4.1"/><path d="M16 16.5l4.5-4.5L16 7.5"/><path d="M20.5 12H9.5"/>`,s),
    trash:s=>I(`<path d="M3.5 6.5h17"/><path d="M8.5 6.5V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7"/><path d="M18.3 6.5 17.6 19a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.7 6.5"/>`,s),
    down:s=>I(`<path d="M12 3.5v12"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M4 20.5h16"/>`,s),
    cam:s=>I(`<path d="M21 18.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3l1.6-2.4h4.8L16 6.5h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.6"/>`,s),
    search:s=>I(`<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>`,s),
    heart:s=>I(`<path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z"/>`,s),
    hospital:s=>I(`<path d="M4 21V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V21"/><path d="M2.5 21h19"/><path d="M12 8.5v5M9.5 11h5"/><path d="M9.5 21v-3.5h5V21"/>`,s),
    pin:s=>I(`<path d="M20 10.5c0 5.6-8 11.5-8 11.5s-8-5.9-8-11.5a8 8 0 0 1 16 0z"/><circle cx="12" cy="10.3" r="2.8"/>`,s),
    mail:s=>I(`<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 6.5l9 6 9-6"/>`,s),
    file:s=>I(`<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>`,s),
    share:s=>I(`<circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M8.3 10.8l7.4-4"/><path d="M8.3 13.2l7.4 4"/>`,s),
    globe:s=>I(`<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>`,s),
    print:s=>I(`<path d="M6.5 9V3.5h11V9"/><rect x="3" y="9" width="18" height="7.5" rx="2"/><path d="M6.5 14h11v6.5h-11z"/>`,s),
    refresh:s=>I(`<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4v5h-5"/>`,s)
  };
  /* ---------- avatar ---------- */
  const AV=(g,p)=>p||("data:image/svg+xml;utf8,"+encodeURIComponent(g==="মহিলা"
   ?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#ffe4ef"/><path d="M18 25c0-9 7-13 22-13s22 4 22 13v8c0 9-7 13-22 13S18 42 18 33z" fill="#d76a9a"/><circle cx="40" cy="53" r="14" fill="#e8a8c2"/><path d="M22 70c0-11 8-17 18-17s18 6 18 17z" fill="#d76a9a"/></svg>`
   :`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#dcedfb"/><circle cx="40" cy="29" r="17" fill="#4a90d9"/><path d="M20 69c0-14 9-22 20-22s20 8 20 22z" fill="#4a90d9"/></svg>`));
  /* ══════════ i18n — DOM-level translation layer ══════════
     Bangla stays the source of truth in every template; when English is on,
     the rendered DOM is translated in place. New features get translated
     automatically as long as their strings exist in DICT.               */
  const DICT_EN={
  "পাসওয়ার্ড ভুলে গেছেন?":"Forgot password?",
  "ইমেইল বা মোবাইলে OTP পাঠানো হবে":"An OTP will be sent to your email or phone",
  "এই অ্যাকাউন্টের ইমেইলেই লিংক যাবে।":"The link goes to this account's email.",
  "OTP চাওয়া হয়েছে":"OTP requested",
  "ইমেইল না পেলে স্প্যাম ফোল্ডার দেখুন।":"If you don't see it, check your spam folder.",
  "এই ঠিকানায় OTP পাঠানো হয়েছে।":"An OTP has been sent to this address.",
  "OTP পাঠানো হয়েছে":"OTP sent",
  "লিংক পাঠানো হয়েছে":"Link sent",
  "লিংক পাঠান":"Send link",
  "সঠিক ইমেইল ঠিকানা দিন":"Enter a valid email address",
  "ইমেইল ঠিকানা":"Email address",
  "অ্যাকাউন্ট, দায়িত্ব ও আচরণবিধি":"Account, duties and code of conduct",
  "আপনার তথ্য কীভাবে ব্যবহার হয়":"How your information is used",
  "যোগ্যতা, প্রস্তুতি ও নিরাপত্তা":"Eligibility, preparation and safety",
  "সর্বশেষ হালনাগাদ:":"Last updated:",
  "১ আগস্ট ২০২৬":"1 August 2026",
  "তথ্য নামান, অ্যাকাউন্ট মুছুন":"Download data, delete account",
  "অনুরোধ করার পর ২৪ ঘণ্টার মধ্যে অ্যাকাউন্ট ও এর সাথে সম্পর্কিত সকল ডাটা মুছে যাবে":"The account and all related data will be deleted within 24 hours of the request",
  "অনুরোধ গ্রহণ করা হয়েছে":"Request received",
  "অনুরোধ পাঠানো হয়েছে":"Request sent",
  "অ্যাকাউন্ট মুছে ফেলার অনুরোধ":"Account deletion request",
  "২৪ ঘণ্টার মধ্যে কার্যকর":"Takes effect within 24 hours",
  "এর ভিত্তিতেই ৯০ দিনের বিশ্রামের হিসাব হয় — বিশ্রামে থাকলে আপনাকে জরুরি ডাক পাঠানো হবে না।":"It drives the 90-day rest countdown — while you are resting you will not receive emergency calls.",
  "শেষ রক্তদানের পর অন্তত ৯০ দিন বিরতি দিতে হবে। এর মধ্যে নতুন তারিখ দিলে সতর্কবার্তা দেখাবে।":"You must wait at least 90 days after your last donation. Adding a closer date shows a warning.",
  "ভুল তথ্য দিলে রেকর্ড বাতিল হবে এবং বারবার হলে ডোনার তালিকা থেকে সরিয়ে দেওয়া হতে পারে।":"False entries will be rejected, and repeated cases may get you removed from the donor list.",
  "আপনি অতীতে বা সম্প্রতি যে রক্তদান করেছেন তার তারিখ ও স্থান। একবারে একটি রক্তদান।":"The date and place of a donation you made, past or recent. One donation at a time.",
  "অ্যাকাউন্ট থাকবে, শুধু ডোনার তথ্য ও কার্ড সরে যাবে। চাইলে আবার যুক্ত হতে পারবেন।":"Your account stays; only donor details and the card go away. You can rejoin any time.",
  "ব্লাড ব্যাগের রসিদ বা ছবি থাকলে যাচাই দ্রুত হয়। না থাকলেও যোগ করা যাবে।":"A receipt or photo of the blood bag speeds up verification. You can still add it without one.",
  "এই সেটিংস শুধু দেখানোর নিয়ম নয় — পাবলিক তালিকা ও সার্চেও প্রয়োগ হবে।":"These settings are enforced in the public list and search too, not just on screen.",
  "যেকোনো ফোনের ক্যামেরা দিয়ে QR স্ক্যান করলে উপরের সব তথ্য দেখা যাবে এবং":"Scanning the QR with any phone camera shows all of the above and offers to",
  "QR স্ক্যান করে কার্ডধারীর সাথে যোগাযোগ করুন অথবা উপরের হটলাইনে জানান।":"Scan the QR to contact the card holder, or call the hotline above.",
  "যাচাইয়ের আগে নিজেই মুছতে পারবেন। যাচাই হয়ে গেলে ক্লাবকে জানাতে হবে।":"You can delete it yourself before verification. After that, tell the club.",
  "রক্তদানের রেকর্ড (নাম ছাড়া) — কারণ এগুলো অন্যের চিকিৎসার সাথে যুক্ত":"Donation records (without your name) — they are tied to other people's treatment",
  "ছাপানোর কার্ড ৮৬×৫৪ মিমি — ATM কার্ডের মাপ, মানিব্যাগে রাখা যায়।":"The printable card is 86×54 mm — ATM card size, fits in a wallet.",
  "আমি নিশ্চিত করছি প্রদত্ত তথ্য সঠিক এবং স্বেচ্ছায় রক্তদানে সম্মত।":"I confirm the information is correct and I consent to donate blood voluntarily.",
  "নাম, লিঙ্গ, বয়স, এলাকা ও মোবাইল আবার অ্যাকাউন্ট থেকে নেওয়া হবে।":"Name, gender, age, area and mobile will be taken from your account again.",
  "আমি নিশ্চিত করছি তথ্যগুলো সত্য এবং আমি নিজেই এই রক্তদান করেছি।":"I confirm this information is true and that I made this donation myself.",
  "একই তারিখ ও একই স্থানের রেকর্ড দ্বিতীয়বার যোগ করা যাবে না।":"A record with the same date and place cannot be added twice.",
  "সাধারণত ৯০ দিন (৩ মাস) পর পর। অ্যাপে কাউন্টডাউন দেখানো হয়।":"Usually every 90 days (3 months). The app shows a countdown.",
  "পাবলিক তালিকায় শুধু এলাকা দেখানো হয়, সম্পূর্ণ ঠিকানা নয়।":"Only your area is shown publicly, never the full address.",
  "নিচের ফর্মে আপনার দেওয়া প্রতিটি রক্তদানের হিসাব যোগ করুন।":"Use the form below to record each blood donation you have made.",
  "রক্তদানের হিসাব রাখতে আপনার রক্তের গ্রুপ ও তথ্য দরকার":"We need your blood group and details to track donations",
  "বয়স ১৮–৬০ বছর, ওজন কমপক্ষে ৫০ কেজি এবং সুস্থ শরীর।":"Age 18–60, at least 50 kg, and good health.",
  "অ্যাডমিন যাচাইয়ের পর এটি আপনার রেকর্ডে যুক্ত হবে।":"It will be added to your record after an admin verifies it.",
  "সেটিংস → ডোনার → রক্তের গ্রুপ → পরিবর্তনের অনুরোধ।":"Settings → Donor → Blood group → request a change.",
  "সেটিংস → গোপনীয়তা থেকে আপনি নিজে ঠিক করতে পারেন।":"You decide, in Settings → Privacy.",
  "ফেসবুক ও WhatsApp-এ শেয়ারের জন্য · ৯০০×১৬০০ px":"For Facebook and WhatsApp · 900×1600 px",
  "৩–২০ অক্ষর · ছোট হাতের ইংরেজি, সংখ্যা, _ এবং .":"3–20 characters · lowercase letters, numbers, _ and .",
  "কারো রক্তের প্রয়োজন হলে এখান থেকে আবেদন করুন":"If someone needs blood, request it from here",
  "আপনার অ্যাকাউন্টের তথ্য নিচে দেখানো হয়েছে —":"Your account details are shown below —",
  "অ্যাকাউন্ট মুছে ফেলার প্রক্রিয়া শুরু হয়েছে":"Account deletion has started",
  "ক্লাবের স্বেচ্ছাসেবক যাচাই করবেন। যাচাই হলে":"A club volunteer will verify it. Once verified,",
  "রসিদ / ব্যাগের ছবি · সর্বোচ্চ ৪ MB · ঐচ্ছিক":"Receipt / bag photo · max 4 MB · optional",
  "এই তথ্যটি ডোনার তালিকা ও কার্ডে দেখানো হবে।":"This detail appears in the donor list and on your card.",
  "আপনার অ্যাকাউন্টের পরিবর্তন এখানে দেখা যাবে":"Changes to your account appear here",
  "অনুরোধ পাঠানো হয়েছে — অ্যাডমিন যাচাই করবেন":"Request sent — an admin will review it",
  "মুছে ফেলার বদলে এই বিকল্পগুলো ভেবে দেখুন —":"Consider these options instead of deleting —",
  "শুধু রক্ত-সম্পর্কিত কয়েকটি তথ্য দিলেই হবে":"Just a few blood-related details are needed",
  "সম্পূর্ণ সুস্থ, কোনো দীর্ঘমেয়াদি রোগ নেই।":"Fully healthy, no chronic illness.",
  "রোগীর অনুমতি ছাড়া পুরো নাম না লেখাই ভালো":"Better not to write a full name without the patient's consent",
  "৮৬×৫৪ মিমি, ATM কার্ডের মাপ · ১০১৬×৬৩৮ px":"86×54 mm, ATM card size · 1016×638 px",
  "লিংকে ক্লিক করলেই নতুন ইমেইল সক্রিয় হবে।":"The new email becomes active once you click the link.",
  "আপনার গ্রুপের জরুরি ডাক সরাসরি এখানে আসবে":"Emergency calls for your group land right here",
  "এই ডিভাইসসহ সব জায়গা থেকে বেরিয়ে যাবেন।":"You'll be signed out everywhere, including this device.",
  "আপনার তথ্য যাচাইয়ের জন্য পাঠানো হয়েছে।":"Your details have been sent for verification.",
  "সিদ্ধান্ত। এগোনোর আগে ভালোভাবে দেখে নিন।":"decision. Please review it carefully before continuing.",
  "যুক্ত হলে এখানে ডোনার সেটিংস দেখতে পাবেন":"Once you join, donor settings appear here",
  "সাধারণত ২৪–৪৮ ঘণ্টার মধ্যে অনুমোদন হয়।":"Approval usually takes 24–48 hours.",
  "আপনার গ্রুপের নতুন আবেদন এলে জানানো হবে":"You'll be notified about new requests for your group",
  "বন্ধ থাকলে জরুরি তালিকায় নাম দেখাবে না":"When off, your name won't appear in emergency lists",
  "ঐচ্ছিক — যেমন: ক্লাবের ক্যাম্পে দিয়েছি":"Optional — e.g. donated at the club camp",
  "রক্তের গ্রুপ ভুল দিয়েছি, বদলাব কীভাবে?":"I entered the wrong blood group — how do I fix it?",
  "প্রশ্ন থাকলে ক্লাবের হটলাইনে কল করুন —":"Questions? Call the club hotline —",
  "যে হাসপাতাল বা ব্লাড ব্যাংকে দিয়েছেন":"The hospital or blood bank where you donated",
  "রাত ১০টা — সকাল ৭টা (অতিজরুরি ছাড়া)":"10 pm — 7 am (except critical)",
  "কয়েকটি তথ্য দিলেই যুক্ত হতে পারবেন":"Just a few details and you're in",
  "আপনি অ্যাকাউন্ট থেকে বেরিয়ে যাবেন।":"You will be signed out of your account.",
  "বয়স ১৮ থেকে ৬০ বছরের মধ্যে হতে হবে":"Age must be between 18 and 60",
  "একই তারিখ ও স্থানের রেকর্ড আগেই আছে":"A record with that date and place already exists",
  "সম্পূর্ণ ঠিকানা কখনো দেখানো হয় না":"full address is never shown",
  "করার অপশন আসবে — ইন্টারনেট ছাড়াই।":"— no internet needed.",
  "সব তথ্য অ্যাকাউন্ট থেকে নেওয়া হবে":"Everything now comes from your account",
  "তারকা (*) চিহ্নিত ঘরগুলো পূরণ করুন":"Please fill in the fields marked *",
  "১২৩/এ, চকবাজার মেইন রোড, চট্টগ্রাম":"123/A, Chawkbazar Main Road, Chattogram",
  "অচেনা ডিভাইসে লগইন হলে জানানো হবে":"You'll be notified about logins from unknown devices",
  "-এর সম্পত্তি · হস্তান্তরযোগ্য নয়":"· not transferable",
  "রক্তদানের রেকর্ড মুছে ফেলা হয়েছে":"Donation record deleted",
  "যোগ হয়েছে — যাচাইয়ের অপেক্ষায়":"Added — awaiting verification",
  "এখনো কোনো রক্তদান যোগ করা হয়নি।":"No donations have been added yet.",
  "নিরাপত্তার জন্য বন্ধ করা যায় না":"Cannot be turned off, for your security",
  "অ্যাকাউন্টে বদলালে এখানেও বদলাবে":"Changing it in your account changes it here too",
  "রিপোর্ট পাঠানো হয়েছে — ধন্যবাদ!":"Report sent — thank you!",
  "একবার বদলালে সব জায়গায় বদলায়।":"change it once and it changes everywhere.",
  "আপনার কার্যক্রম এখানে দেখা যাবে":"Your activity will appear here",
  "শুধু যারা এখন রক্তদানে প্রস্তুত":"Only those ready to donate now",
  "লেখা উঠবে ও মোট গণনায় যোগ হবে।":"will appear and it will count towards your total.",
  "রক্তের গ্রুপ জানালে আবেদন দেখাব":"Tell us your blood group and we'll show requests",
  "রক্ত পাওয়া গেছে নিশ্চিত করছেন।":"You are confirming that blood was found.",
  "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর":"The new password needs at least 6 characters",
  "নাম, এলাকা বা আইডি দিয়ে খুঁজুন":"Search by name, area or ID",
  "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল":"Chittagong Medical College Hospital",
  "স্ক্যান করে কন্টাক্টে যোগ করুন":"Scan to save as a contact",
  "সামনে ও পেছনে — দুটি ছবি নামবে":"Front and back — two images will download",
  "আমাদের সাথে থাকার জন্য ধন্যবাদ":"Thank you for being with us",
  "কার্ড তৈরি করতে ডোনার তথ্য দিন":"Add your donor details to create a card",
  "ওই ডিভাইসে আবার লগইন করতে হবে।":"That device will have to log in again.",
  "এখন অ্যাকাউন্ট থেকে নেওয়া হবে":"now comes from your account",
  "রক্তের গ্রুপ পরিবর্তনের অনুরোধ":"Blood group change requested",
  "ভবিষ্যতের তারিখ দেওয়া যাবে না":"You can't use a future date",
  "পাসওয়ার্ড দিয়ে নিশ্চিত করুন":"Confirm with your password",
  "নাম কমপক্ষে ২ অক্ষরের হতে হবে":"Name must be at least 2 characters",
  "ফিল্টার বদলে আবার চেষ্টা করুন":"Try changing the filters",
  "Google অ্যাকাউন্ট থেকে নেওয়া":"Taken from your Google account",
  "নতুন কিছু এলে এখানে দেখা যাবে":"Anything new will show up here",
  "পাসওয়ার্ড, ডিভাইস, কার্যকলাপ":"Password, devices, activity",
  "সম্পন্ন হিসেবে চিহ্নিত করবেন?":"Mark as completed?",
  "রক্তদাতারা আর দেখতে পাবেন না।":"Donors will no longer see it.",
  "৩–২০ অক্ষর · শুধু a-z 0-9 _ .":"3–20 characters · only a-z 0-9 _ .",
  "রোগীর অবস্থা, বিশেষ নির্দেশনা":"Patient's condition, special instructions",
  "স্থান বা হাসপাতালের নাম লিখুন":"Enter the place or hospital",
  "আপনার ডোনার প্রোফাইল অনুমোদিত":"Your donor profile is approved",
  "আগে রক্তদাতা হিসেবে যুক্ত হন":"Join as a donor first",
  "ঐচ্ছিক — না জানলে খালি রাখুন":"Optional — leave blank if unknown",
  "অন্য গ্রুপের আবেদন দেখাবে না":"Requests for other groups are hidden",
  "কতদিন পরপর রক্ত দেওয়া যায়?":"How often can I donate?",
  "তথ্য যাচাই হতে কত সময় লাগে?":"How long does verification take?",
  "ডোনার তালিকা থেকে সরে যাবেন?":"Leave the donor list?",
  "এই username ইতিমধ্যে ব্যবহৃত":"That username is taken",
  "কোনো রক্তদাতা পাওয়া যায়নি":"No donors found",
  "আমার প্রোফাইল কে দেখতে পাবে":"Who can see my profile",
  "তথ্য বদলাতে অ্যাকাউন্টে যান":"To change them, go to your account",
  "আপনি এখনো কোনো আবেদন করেননি":"You haven't made any requests yet",
  "আপনার তালিকা থেকে সরে যাবে।":"It will disappear from your list.",
  "৪ ঘণ্টার জন্য বন্ধ রাখা হলো":"Paused for 4 hours",
  "ডোনার তালিকা থেকে সরে গেছেন":"You left the donor list",
  "পরে আবার আবেদন করতে পারবেন।":"You can apply again later.",
  "কোনো রোগ বা ওষুধ চলছে কি না":"Any illness or medication",
  "শুধু এলাকা/জেলা দেখানো হয়।":"only the area/district is shown.",
  "ম্যাক্স হাসপাতাল, মেহেদীবাগ":"Max Hospital, Mehedibag",
  "চকবাজার ব্লাড ডোনার'স ক্লাব":"Chawkbazar Blood Donor's Club",
  "আপনার তথ্য যাচাই করা হচ্ছে":"Your details are being verified",
  "ডোনার তালিকায় দেখানো তথ্য":"Details shown in the donor list",
  "৩০ দিনের মধ্যে ফেরানো যাবে":"Recoverable within 30 days",
  "১১ সংখ্যার বাংলাদেশি নম্বর":"11-digit Bangladeshi number",
  "রসিদ থাকলে যাচাই দ্রুত হয়":"A receipt speeds up verification",
  "স্ক্যান করলে সব তথ্য পাবেন":"Scan for all the details",
  "এটি আপনার বর্তমান username":"That is already your username",
  "পাসওয়ার্ড পরিবর্তন হয়েছে":"Password changed",
  "রক্তের গ্রুপ নির্বাচন করুন":"Choose your blood group",
  "তথ্য সত্য — এই ঘরে টিক দিন":"Please tick the box confirming it's true",
  "রেড ক্রিসেন্ট ব্লাড ব্যাংক":"Red Crescent Blood Bank",
  "এখন থেকে তালিকায় দৃশ্যমান":"You're now visible in the list",
  "সঠিক ১১ সংখ্যার নম্বর দিন":"Enter a valid 11-digit number",
  "ডোনার তালিকা থেকে সরে যান":"Leave the donor list",
  "বন্ধ করলে সার্চে আসবেন না":"Turn off and you won't appear in search",
  "আমি এখন রক্তদানে প্রস্তুত":"I'm ready to donate now",
  "নতুন আবেদন এলে জানানো হবে":"You'll be told about new requests",
  "আমার নম্বর কে দেখতে পায়?":"Who can see my number?",
  "সংরক্ষণ থেকে সরানো হয়েছে":"Removed from saved",
  "প্রোফাইল ছবি সরানো হয়েছে":"Profile photo removed",
  "প্রাপ্যতা বন্ধ করা হয়েছে":"Availability turned off",
  "বিজ্ঞপ্তি বন্ধ করা হয়েছে":"Notifications turned off",
  "রক্তদাতা হিসেবে যুক্ত হন":"Join as a donor",
  "নতুন username দিয়ে লগইন":"log in with the new username",
  "যাচাই মেইল পাঠানো হয়েছে":"Verification email sent",
  "স্বাস্থ্য সম্পর্কিত তথ্য":"Health information",
  "অন্য ব্যবহারকারীর অভিযোগ":"Report another user",
  "এখন কোনো জরুরি আবেদন নেই":"No emergency requests right now",
  "প্রশ্ন, সমস্যা, নীতিমালা":"Questions, problems, policies",
  "তথ্য নামান, লগআউট, মুছুন":"Download data, log out, delete",
  "রক্তদাতা হতে কী কী লাগে?":"What do I need to become a donor?",
  "মনে না থাকলে খালি রাখুন।":"Leave blank if you don't remember.",
  "Username পরিবর্তন হয়েছে":"Username changed",
  "দুটি পাসওয়ার্ড মিলছে না":"The passwords don't match",
  "নতুন গ্রুপ নির্বাচন করুন":"Choose a new group",
  "যোগাযোগের নম্বর সঠিক নয়":"That contact number isn't valid",
  "প্রোফাইল গোপন করা হয়েছে":"Profile hidden",
  "হুবহু \"মুছে ফেলুন\" লিখুন":"Type \"মুছে ফেলুন\" exactly",
  "যেমন: চমেক ব্লাড ব্যাংক":"e.g. CMCH Blood Bank",
  "আপনার জন্য গুরুত্বপূর্ণ":"Important for you",
  "অতিরিক্ত নিরাপত্তা স্তর":"An extra layer of security",
  "ছাপানোর কার্ড — দুই পাশ":"Printable card — both sides",
  "শুধু ডোনার তালিকার জন্য":"For the donor list only",
  "সর্বশেষ রক্তদানের তারিখ":"Date of your last donation",
  "নাম, ছবি, ইমেইল, মোবাইল":"Name, photo, email, mobile",
  "রক্তের তথ্য ও প্রাপ্যতা":"Blood details and availability",
  "রক্তদাতা তালিকায় দেখান":"Show me in the donor list",
  "জরুরি আবেদনের বিজ্ঞপ্তি":"Emergency request alerts",
  "বিজ্ঞপ্তির সংখ্যা দেখান":"Show notification count",
  "আবেদন প্রত্যাহার করবেন?":"Withdraw your application?",
  "এটি আপনার বর্তমান ইমেইল":"That is already your email",
  "ইমেইল পরিবর্তনের অনুরোধ":"Email change requested",
  "WhatsApp নম্বর সঠিক নয়":"That WhatsApp number isn't valid",
  "ক্লাবের রক্তদান ক্যাম্প":"Club donation camp",
  "চকবাজার রক্তদান ক্যাম্প":"Chawkbazar donation camp",
  "রক্ত দিন · জীবন বাঁচান":"Give blood · Save lives",
  "রক্তদান যোগ করা হয়েছে":"Donation added",
  "গ্রুপ ও এলাকা অনুযায়ী":"By group and area",
  "রক্তদাতা / জরুরি আবেদন":"Donors / emergency requests",
  "আপনি অনুমোদিত রক্তদাতা":"You are an approved donor",
  "আপনার তথ্য যাচাই চলছে।":"Your details are being verified.",
  "শুরু করার আগে পড়ে নিন":"Read this before you start",
  "যাচাই না হওয়া পর্যন্ত":"Until it is verified,",
  "অন্য কারো পক্ষে আবেদন?":"Requesting on someone's behalf?",
  "সব বিজ্ঞপ্তি বন্ধ করুন":"Turn off all notifications",
  "অ্যাকাউন্ট ব্যবস্থাপনা":"Account management",
  "শুধু আমার রক্তের গ্রুপ":"Only my blood group",
  "অনুমোদন, যাচাই ইত্যাদি":"Approvals, verifications and so on",
  "চলমান প্রভাব চালু/বন্ধ":"Turn motion effects on or off",
  "দুই পাশই নামানো হয়েছে":"Both sides downloaded",
  "সব পড়া হিসেবে চিহ্নিত":"Marked all as read",
  "ছবি ৪ MB এর কম হতে হবে":"The photo must be under 4 MB",
  "বর্তমান পাসওয়ার্ড দিন":"Enter your current password",
  "ছবি ৪ MB-এর কম হতে হবে":"The photo must be under 4 MB",
  "প্রোফাইল তথ্য পরিবর্তন":"Profile details changed",
  "আপনি এখনো রক্তদাতা নন":"You are not a donor yet",
  "নতুন ডিভাইস থেকে লগইন":"Login from a new device",
  "নতুন রক্তদানের রেকর্ড":"New donation record",
  "কী কী পরিবর্তন হয়েছে":"What has changed",
  "মোবাইল নম্বর কে দেখবে":"Who can see my mobile number",
  "শুধু যারা আবেদন করেছে":"Only those who requested blood",
  "পাবলিক তালিকায় আপনার":"In the public list your",
  "অ্যাকাউন্ট মুছে ফেলুন":"Delete account",
  "এখন রক্তদানে প্রস্তুত":"Ready to donate now",
  "ডিভাইস বের করা হয়েছে":"Device signed out",
  "ডাউনলোড ব্যর্থ হয়েছে":"Download failed",
  "প্রত্যাহার করা হয়েছে":"Withdrawn",
  "সব ডিভাইস থেকে লগআউট?":"Log out everywhere?",
  "প্রোফাইল ছবি পরিবর্তন":"Change profile photo",
  "মোবাইল নম্বর পরিবর্তন":"Change mobile number",
  "রক্তের গ্রুপ পরিবর্তন":"Change blood group",
  "রক্তদাতা হিসেবে আবেদন":"Donor application",
  "কী সমস্যা হচ্ছে লিখুন":"Tell us what's wrong",
  "O+ রক্তের জরুরি আবেদন":"Urgent O+ blood request",
  "রক্তদান যাচাই সম্পন্ন":"Donation verified",
  "সাম্প্রতিক কার্যক্রম":"Recent activity",
  "অ্যাকাউন্ট কার্যকলাপ":"Account activity",
  "শুধু প্রয়োজনের সময়":"Only when needed",
  "সব ডিভাইস থেকে লগআউট":"Log out of all devices",
  "৮৬×৫৪ মিমি · ১টি ছবি":"86×54 mm · 1 image",
  "শেয়ার কার্ড — লম্বা":"Share card — portrait",
  "প্রাপ্যতা বন্ধ রাখুন":"Turn availability off",
  "রক্তদাতা খোঁজা হচ্ছে":"Searching for donors",
  "WhatsApp নম্বর দেখান":"Show my WhatsApp number",
  "দূরের আবেদন বাদ যাবে":"Distant requests are skipped",
  "রাতে বিরক্ত করবেন না":"Do not disturb at night",
  "সাধারণত ২৪–৪৮ ঘণ্টা।":"Usually 24–48 hours.",
  "আবেদন সম্পন্ন হয়েছে":"Request completed",
  "শারীরিক অবস্থা / রোগ":"Medical conditions",
  "নম্বর সংরক্ষণ হয়েছে":"Number saved",
  "ফর্ম খালি করা হয়েছে":"Form cleared",
  "অ্যাকাউন্ট মুছে ফেলা":"Account deletion",
  "অবস্থা বদলানো হয়েছে":"Status changed",
  "রক্তদাতা পাওয়া গেছে":"donors found",
  "ইম্পেরিয়াল হাসপাতাল":"Imperial Hospital",
  "মেট্রোপলিটন হাসপাতাল":"Metropolitan Hospital",
  "স্বেচ্ছায় রক্তদাতা":"Voluntary blood donor",
  "পাসওয়ার্ড পরিবর্তন":"Change password",
  "ডোনার তথ্য পরিবর্তন":"Donor details changed",
  "রক্তদানের প্রস্তুতি":"Donation readiness",
  "রোগীর জন্য রক্ত চান":"Request blood for a patient",
  "দুই-ধাপ যাচাই (2FA)":"Two-factor authentication (2FA)",
  "শুধু লগইন করা সদস্য":"Logged-in members only",
  "রক্ত সম্পর্কিত তথ্য":"Blood information",
  "যাচাইয়ের অপেক্ষায়":"Awaiting verification",
  "যেদিন রক্ত দিয়েছেন":"The day you gave blood",
  "কন্টাক্ট হিসেবে সেভ":"save it as a contact",
  "অ্যাকাউন্ট থেকে নিন":"Use my account value",
  "জরুরি (আজকের মধ্যে)":"Urgent (today)",
  "আমি নিজেই আবেদনকারী":"I am the requester",
  "তালিকা নামানো হচ্ছে":"Downloading the list",
  "✓ রক্তদানে প্রস্তুত":"✓ Ready to donate",
  "থিম, ভাষা, প্রদর্শন":"Theme, language, display",
  "ডিভাইসটি বের করবেন?":"Sign this device out?",
  "ডিভাইস সরানো হয়েছে":"Device removed",
  "ডিজিটাল ডোনার কার্ড":"DIGITAL DONOR CARD",
  "কার্ড নামানো হয়েছে":"Card downloaded",
  "ডোনার কার্ড ডাউনলোড":"Donor card downloaded",
  "সাড়া জানানো হয়েছে":"Your response was sent",
  "রক্তদানের তারিখ দিন":"Enter the donation date",
  "চট্টগ্রাম, বাংলাদেশ":"Chattogram, Bangladesh",
  "জরুরি রক্তের আবেদন":"Emergency blood requests",
  "আমার সব তথ্য নামান":"Download all my data",
  "CBDC · সংস্করণ ১.০":"CBDC · Version 1.0",
  "অ্যাকাউন্ট রিকভারি":"Account recovery",
  "কোনো বিজ্ঞপ্তি নেই":"No notifications",
  "ভবিষ্যতে এই নম্বরে":"In future this number will get",
  "বর্তমান পাসওয়ার্ড":"Current password",
  "মনে নেই / প্রথমবার":"Don't remember / first time",
  "পরেও বদলাতে পারবেন":"You can change this later",
  "অতিজরুরি (২ ঘণ্টা)":"Critical (within 2 hours)",
  "প্রোফাইল গোপন করুন":"Hide your profile",
  "কোনো কার্যকলাপ নেই":"No activity",
  "রক্তের গ্রুপ দেখান":"Show my blood group",
  "দিন পর দিতে পারবেন":"days until you can donate",
  "একই দান দুইবার নয়":"No duplicate donations",
  "প্রোফাইল সম্পর্কিত":"Profile related",
  "ব্যবহারের শর্তাবলী":"Terms of use",
  "রক্তদান নির্দেশিকা":"Blood donation guide",
  "চকবাজার, চট্টগ্রাম":"Chawkbazar, Chattogram",
  "সংরক্ষণ করা হয়েছে":"Saved",
  "জরুরি আবেদনে সাড়া":"Responded to an emergency request",
  "আবেদন বাতিল করবেন?":"Cancel this request?",
  "আবেদন বাতিল হয়েছে":"Request cancelled",
  "সঠিক জন্মতারিখ দিন":"Enter a valid date of birth",
  "পরীক্ষা করা হচ্ছে…":"Checking…",
  "রক্তদানে প্রস্তুত":"Ready to donate",
  "Username পরিবর্তন":"Change username",
  "নতুন লগইন সতর্কতা":"New login alerts",
  "নিরাপত্তা সতর্কতা":"Security alerts",
  "Google অ্যাকাউন্ট":"Google account",
  "আবার লিখতে হবে না":"no need to type them again",
  "হাসপাতালের ঠিকানা":"Hospital address",
  "কার্ড তৈরি হচ্ছে…":"Creating your card…",
  "এই আবেদন লুকাবেন?":"Hide this request?",
  "৯০ দিনের কম বিরতি":"Less than 90 days apart",
  "তারিখ ও স্থান দিন":"Enter the date and place",
  "তথ্য নামানো হচ্ছে":"Downloading your data",
  "চমেক ব্লাড ব্যাংক":"CMCH Blood Bank",
  "সিএসসিআর হাসপাতাল":"CSCR Hospital",
  "পার্কভিউ হাসপাতাল":"Parkview Hospital",
  "চট্টগ্রাম মেডিকেল":"Chittagong Medical",
  "রক্তদান যোগ করুন":"Add a donation",
  "স্থান / হাসপাতাল":"Place / hospital",
  "আবেদন জমা হয়েছে":"Request submitted",
  "জীবন বাঁচিয়েছেন":"lives saved",
  "আবেদন প্রত্যাহার":"Withdraw application",
  "প্রমাণ দিলে ভালো":"Proof helps",
  "যাচাইকৃত রক্তদান":"Verified donations",
  "প্রদর্শনের ঘনত্ব":"Display density",
  "যাচাই মেইল পাঠান":"Send verification email",
  "ভুল রক্তের গ্রুপ":"A wrong blood group",
  "রিপোর্ট / প্রমাণ":"Report / proof",
  "প্রয়োজনের তারিখ":"Date needed",
  "আগামীকালের মধ্যে":"By tomorrow",
  "অ্যাকাউন্ট মুছুন":"Delete account",
  "কে কী দেখতে পাবে":"Who can see what",
  "আইকনে লাল সংখ্যা":"A red number on the icon",
  "ছবি সরানো হয়েছে":"Photo removed",
  "বিস্তারিত ঠিকানা":"Full address",
  "ছবি আপডেট হয়েছে":"Photo updated",
  "সম্মতিতে টিক দিন":"Please tick the consent box",
  "নতুন জরুরি আবেদন":"New emergency request",
  "ছবি যুক্ত হয়েছে":"Photo attached",
  "রেকর্ডটি মুছবেন?":"Delete this record?",
  "মুছে ফেলা হয়েছে":"Deleted",
  "CSV নামানো হচ্ছে":"Downloading CSV",
  "ম্যাক্স হাসপাতাল":"Max Hospital",
  "স্বেচ্ছা ক্যাম্প":"Voluntary camp",
  "বর্তমানে সক্রিয়":"Active now",
  "সর্বশেষ রক্তদান":"Last donation",
  "রক্তদাতা খুঁজুন":"Find donors",
  "ক্লাবের যোগাযোগ":"Club contact",
  "আবেদনগুলো দেখুন":"View requests",
  "পরবর্তী রক্তদান":"Next donation",
  "অ্যাকাউন্ট থেকে":"taken from your account",
  "রক্তদানের তারিখ":"Date of donation",
  "সাধারণত ১ ব্যাগ":"Usually 1 bag",
  "বাগ বা ভুল তথ্য":"Bug or wrong information",
  "সাধারণ জিজ্ঞাসা":"Frequently asked questions",
  "স্ক্যান করলে সব":"Scan for all",
  "শুধু সামনের পাশ":"Front side only",
  "নতুন পাসওয়ার্ড":"New password",
  "যোগাযোগের নম্বর":"Contact number",
  "এখন দিতে পারবেন":"You can donate now",
  "তথ্য কারা দেখবে":"Who sees this",
  "শুধু আমার এলাকা":"Only my area",
  "চালু করা হয়েছে":"Turned on",
  "বন্ধ করা হয়েছে":"Turned off",
  "তথ্য কপি হয়েছে":"Details copied",
  "সব রিসেট করবেন?":"Reset everything?",
  "ছবি পড়া যায়নি":"Could not read the image",
  "✓ পাওয়া যাচ্ছে":"✓ Available",
  "কমপক্ষে ৬ অক্ষর":"At least 6 characters",
  "রোগীর পূর্ণ নাম":"Patient's full name",
  "জরুরি আবেদন জমা":"Emergency request submitted",
  "বিস্তারিত লিখুন":"Please add details",
  "WhatsApp নম্বর":"WhatsApp number",
  "স্বাস্থ্য তথ্য":"Health information",
  "সংরক্ষণ হয়েছে":"Saved",
  "পাসওয়ার্ড দিন":"Enter your password",
  "প্রাপ্যতা বন্ধ":"Availability off",
  "ব্যাকআপ পদ্ধতি":"Backup method",
  "রক্তদানের তথ্য":"Donation details",
  "QR কোডে কী আছে":"What the QR contains",
  "এই ডিভাইস থেকে":"From this device",
  "সব পড়া হয়েছে":"Mark all read",
  "সক্রিয় থাকবে।":"active.",
  "আবেদনকারীর নাম":"Requester's name",
  "না, মুছেই ফেলব":"No, delete it",
  "৩০ দিনের সুযোগ":"You have 30 days",
  "মেয়াদোত্তীর্ণ":"Expired",
  "কখন জানানো হবে":"When you get notified",
  "৯০ দিনের নিয়ম":"The 90-day rule",
  "গোপনীয়তা নীতি":"Privacy policy",
  "কপি করা যায়নি":"Could not copy",
  "সাড়া দিয়েছেন":"Responded",
  "ইমেইল পরিবর্তন":"Change email",
  "সঠিক ইমেইল দিন":"Enter a valid email",
  "হাসপাতালের নাম":"Hospital name",
  "ঢাকা, বাংলাদেশ":"Dhaka, Bangladesh",
  "সাদিয়া আক্তার":"Sadia Akter",
  "ফারহানা তানজিম":"Farhana Tanzim",
  "প্রাপ্যতা চালু":"Availability on",
  "লগইন ও ডিভাইস":"Logins & devices",
  "পরিবর্তন করুন":"Change",
  "বর্তমান ইমেইল":"Current email",
  "নির্বাচন করুন":"Select",
  "আবেদন জমা দিন":"Submit request",
  "এখনো কিছু নেই":"Nothing here yet",
  "ফিল্টার মুছুন":"Clear filters",
  "এগুলো সাধারণত":"These are normally",
  "পাওয়া যায়নি":"not found",
  "আলাদা মান দিন":"Set a different value",
  "নতুন username":"New username",
  "পুরোনো ইমেইলই":"the old email stays",
  "বর্তমান নম্বর":"Current number",
  "বর্তমান গ্রুপ":"Current group",
  "অতিরিক্ত তথ্য":"Additional information",
  "বাগ বা ত্রুটি":"Bug or error",
  "বিশ্রামে আছেন":"Resting",
  "অ্যাপের পছন্দ":"App preferences",
  "লুকানো হয়েছে":"Hidden",
  "সব থেকে লগআউট":"Log out everywhere",
  "তবুও যোগ করুন":"Add anyway",
  "সব রিসেট করুন":"Reset all",
  "সন্ধানী, চমেক":"Sandhani, CMCH",
  "জরুরি ক্যাম্প":"Emergency camp",
  "শাহাদাত আহমেদ":"Shahadat Ahmed",
  "রেহানা পারভীন":"Rehana Parvin",
  "তানভীর হোসাইন":"Tanvir Hossain",
  "রক্তের গ্রুপ":"Blood group",
  "দেওয়া হয়নি":"Not provided",
  "প্রমাণ (ছবি)":"Proof (photo)",
  "সমস্যা জানান":"Report a problem",
  "স্ক্যান করুন":"Scan me",
  "কার্ডটি পেলে":"If you find this card",
  "মোবাইল নম্বর":"Mobile number",
  "লগইন সুরক্ষা":"Login protection",
  "কী যোগ করবেন":"What to add",
  "আগের রক্তদান":"Previous donations",
  "আপলোড হচ্ছে…":"Uploading…",
  "অনুরোধ পাঠান":"Send request",
  "যা মুছে যাবে":"What gets deleted",
  "নিশ্চিত করতে":"To confirm, type",
  "লগআউট করবেন?":"Log out?",
  "সংরক্ষণ করুন":"Save",
  "সক্রিয় সেশন":"active sessions",
  "নেওয়া হয় —":"—",
  "তাহমিনা বেগম":"Tahmina Begum",
  "রোকেয়া বেগম":"Rokeya Begum",
  "মেহরাব হোসেন":"Mehrab Hossen",
  "নুসরাত জাহান":"Nusrat Jahan",
  "ইকবাল মাহমুদ":"Iqbal Mahmud",
  "নাজমুল সাকিব":"Nazmul Sakib",
  "ডোনার অবস্থা":"Donor state",
  "সাড়াদাতারা":"Responders",
  "ডোনার কার্ড":"Donor card",
  "মোট রক্তদান":"Total donations",
  "রক্তদাতা হন":"Become a donor",
  "এরপর কী হয়":"What happens next",
  "দ্রুত উত্তর":"Quick answers",
  "আপনার ইমেইল":"Your email",
  "শুভ সন্ধ্যা":"Good evening",
  "এলাকা দেখান":"Show my area",
  "মিথ্যা তথ্য":"False information",
  "ডোনার আপডেট":"Donor updates",
  "সবসময় চালু":"Always on",
  "কার্ড নামান":"Download card",
  "শীঘ্রই আসছে":"Coming soon",
  "খালি অবস্থা":"Empty state",
  "রক্তদান যোগ":"Add donation",
  "রফিক উদ্দিন":"Rafiq Uddin",
  "সালমা খাতুন":"Salma Khatun",
  "জসিম উদ্দিন":"Jasim Uddin",
  "আব্দুল করিম":"Abdul Karim",
  "মুছে ফেলুন":"Delete",
  "অ্যাকাউন্ট":"Account",
  "যাচাই চলছে":"Under review",
  "আপাতত বন্ধ":"Currently off",
  "আমার আবেদন":"My requests",
  "ডোনার তথ্য":"Donor information",
  "✓ যাচাইকৃত":"✓ Verified",
  "কার্ডের রং":"Card colour",
  "তথ্য পাবেন":"the details",
  "নতুন ইমেইল":"New email",
  "নতুন নম্বর":"New number",
  "আবার লিখুন":"Repeat it",
  "নতুন গ্রুপ":"New group",
  "এই সপ্তাহে":"This week",
  "ডোনার আইডি":"Donor ID",
  "শুভ রাত্রি":"Good night",
  "পাসওয়ার্ড":"Password",
  "অ্যানিমেশন":"Animations",
  "বাতিল করুন":"Cancel it",
  "রিসেট করুন":"Reset",
  "প্রত্যাহার":"Withdraw",
  "খুব দুর্বল":"Very weak",
  "এলাকা, শহর":"Area, city",
  "ঘণ্টা বাকি":"hours left",
  "কবির আহমেদ":"Kabir Ahmed",
  "নুরুল আমিন":"Nurul Amin",
  "বিজ্ঞপ্তি":"Notifications",
  "রোগীর নাম":"Patient name",
  "জন্মতারিখ":"Date of birth",
  "নিরাপত্তা":"Security",
  "দ্রুত কাজ":"Quick actions",
  "ব্যক্তিগত":"Personal",
  "এই ডিভাইস":"This device",
  "প্রাপ্যতা":"Availability",
  "কেন দরকার":"Why it matters",
  "খালি করুন":"Clear form",
  "স্বাভাবিক":"Normal",
  "হেল্পলাইন":"Helpline",
  "করতে হবে।":"from then on.",
  "OTP যাচাই":"OTP verification",
  "জীবনঝুঁকি":"can be life-threatening",
  "আবেদনকারী":"Requester",
  "বন্ধ করুন":"Close",
  "বিস্তারিত":"Details",
  "স্ক্রিনশট":"Screenshot",
  "শুভ দুপুর":"Good afternoon",
  "নতুন দাতা":"New donor",
  "শুরু করুন":"Get started",
  "গোপনীয়তা":"Privacy",
  "কার্যকলাপ":"Activity",
  "পূর্ণ নাম":"Full name",
  "সরে গেছেন":"You have left",
  "ছবি আপলোড":"Upload a photo",
  "শক্তিশালী":"Strong",
  "আমার জন্য":"For me",
  "সাড়া দিন":"Respond",
  "ছবি বদলান":"Change photo",
  "কোতোয়ালী":"Kotwali",
  "পাহাড়তলী":"Pahartali",
  "চট্টগ্রাম":"Chattogram",
  "মেহেদীবাগ":"Mehedibag",
  "ঘণ্টা আগে":"hours ago",
  "মিনিট আগে":"min ago",
  "ডোনার নয়":"Not a donor",
  "রক্তদাতা":"Donors",
  "অন্যান্য":"Other",
  "কত ব্যাগ":"How many bags",
  "বের করুন":"Sign out",
  "নীতিমালা":"Policies",
  "যাচাইকৃত":"Verified",
  "বিশ্রামে":"Resting",
  "সব দেখুন":"See all",
  "সব গ্রুপ":"All groups",
  "সব এলাকা":"All areas",
  "প্রোফাইল":"Profile",
  "সব রিসেট":"Reset all",
  "বিপজ্জনক":"Danger zone",
  "ধন্যবাদ!":"Thank you!",
  "নির্বাচন":"Select",
  "হাসপাতাল":"Hospital",
  "যোগ করুন":"Add",
  "এটি একটি":"This is a",
  "যা থাকবে":"What stays",
  "ভুল তথ্য":"Wrong information",
  "প্রস্তুত":"Ready",
  "অতিজরুরি":"Critical",
  "আগামীকাল":"Tomorrow",
  "শুভ সকাল":"Good morning",
  "প্রকাশিত":"Published",
  "সংরক্ষিত":"Saved",
  "এই কার্ড":"This card is the property of",
  "পরিবর্তন":"Change",
  "বাকলিয়া":"Bakalia",
  "চাঁদগাঁও":"Chandgaon",
  "পাঁচলাইশ":"Panchlaish",
  "অনুমোদিত":"Approved",
  "সংরক্ষণ":"Save",
  "সম্পন্ন":"Completed",
  "মনে নেই":"Don't remember",
  "যোগাযোগ":"Contact",
  "মন্তব্য":"Note",
  "বর্তমান":"Current",
  "জরুরিতা":"Urgency",
  "স্থায়ী":"permanent",
  "পরবর্তী":"Next",
  "পরামর্শ":"Suggestion",
  "সহায়তা":"Help",
  "সর্বশেষ":"Last",
  "ভুল হলে":"If you make a mistake",
  "সিস্টেম":"System",
  "সরে যান":"Leave",
  "মান দিন":"Enter a value",
  "সংস্করণ":"Version",
  "কল করুন":"Call",
  "প্রিন্ট":"Print",
  "ঠিক আছে":"OK",
  "চকবাজার":"Chawkbazar",
  "হালিশহর":"Halishahar",
  "শাহাদাত":"Shahadat",
  "দিন আগে":"days ago",
  "সেটিংস":"Settings",
  "মোবাইল":"Mobile",
  "শেয়ার":"Share",
  "অবস্থা":"Status",
  "বুঝেছি":"Got it",
  "ঠিকানা":"Address",
  "শীঘ্রই":"Soon",
  "হটলাইন":"Hotline",
  "পরিচয়":"Identity",
  "কেউ না":"Nobody",
  "চেহারা":"Appearance",
  "দুর্বল":"Weak",
  "মাঝারি":"Medium",
  "শক্তি:":"Strength:",
  "ঐচ্ছিক":"Optional",
  "প্রিয়":"Save",
  "খুঁজুন":"Search",
  "তানভীর":"Tanvir",
  "আবেদন":"Requests",
  "বাতিল":"Cancel",
  "এলাকা":"Area",
  "পুরুষ":"Male",
  "মহিলা":"Female",
  "লিঙ্গ":"Gender",
  "পেছনে":"Back",
  "সামনে":"Front",
  "জরুরি":"Urgent",
  "গতকাল":"Yesterday",
  "লুকান":"Hide",
  "মুছুন":"Delete",
  "লগআউট":"Log out",
  "তারিখ":"Date",
  "ইমেইল":"Email",
  "হ্যাঁ":"Yes",
  "উন্নত":"Advanced",
  "আলাদা":"Custom",
  "বাংলা":"বাংলা",
  "লিখুন":"below",
  "পাঠান":"Send",
  "সংগঠন":"Organisation",
  "ডোনার":"Donor",
  "আঁধার":"Dark",
  "ওয়েব":"Web",
  "কার্ড":"Card",
  "ব্যাগ":"bags",
  "ফলাফল":"results",
  "নামান":"Download",
  "দেখুন":"View",
  "রহমান":"Rahman",
  "সাকিব":"Sakib",
  "ইমরান":"Imran",
  "যাচাই":"Pending",
  "বন্ধ":"off",
  "বয়স":"Age",
  "সবাই":"Everyone",
  "আইডি":"ID",
  "সরান":"Remove",
  "সময়":"Timing",
  "ভাষা":"Language",
  "সেশন":"sessions",
  "কারণ":"Reason",
  "এখনই":"Just now",
  "সবুজ":"Green",
  "গাঢ়":"Dark",
  "তথ্য":"Details",
  "লগইন":"Login",
  "চালু":"on",
  "কিমি":"km",
  "ডেটা":"Data",
  "খালি":"Empty",
  "হোম":"Home",
  "নাম":"Name",
  "বছর":"yrs",
  "সফল":"Success",
  "পরে":"Later",
  "থিম":"Theme",
  "ধরন":"Type",
  "লাল":"Red",
  "আলো":"Light",
  "দিন":"days",
  "যোগ":"Add",
  "ভরা":"Full",
  "আজ":"Today",
  "ঘন":"Compact",
  "না":"No",
  "সব":"All",
  "জন":"",
  "কল":"Call"
  };
  const EN_NUM={"০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9"};
  const TOKEN_EN=[["পুরুষ","Male"],["মহিলা","Female"],["অন্যান্য","Other"],["জরুরি","Urgent"],
    ["অতিজরুরি","Critical"],["প্রস্তুত","Ready"],["বিশ্রামে","Resting"],["বন্ধ","Off"],["চালু","On"],
    ["সম্পন্ন","Done"],["যাচাই","Pending"],["সেশন","sessions"],["বাতিল","Cancelled"]];
  const UNIT_EN=[["বছর","yrs"],["ব্যাগ","bags"],["কিমি","km"],["দিন","days"],["ঘণ্টা","hours"],
    ["মিনিট","min"],["সেশন","sessions"],["জন","people"],["মাস","months"],["সপ্তাহ","weeks"]];
  const EN_MON={"জানুয়ারি":"January","ফেব্রুয়ারি":"February","মার্চ":"March","এপ্রিল":"April","মে":"May",
    "জুন":"June","জুলাই":"July","আগস্ট":"August","সেপ্টেম্বর":"September","অক্টোবর":"October",
    "নভেম্বর":"November","ডিসেম্বর":"December"};
  const isEN=()=>ME&&ME.prefs&&ME.prefs.lang==="en";
  const BN_RE=/[\u0980-\u09FF]/;
  /* longest-first key list, built once */
  const DICT_KEYS=Object.keys(DICT_EN).sort((a,b)=>b.length-a.length);
  /* Proper nouns registered at runtime (donor names, areas, hospitals).
     Anything on this list is never touched by any rule. */
  const NO_TR=new Set();
  function protectNames(list){list.forEach(n=>String(n||"").split(/[\s,·]+/).forEach(w=>{
    if(w&&/[\u0980-\u09FF]/.test(w))NO_TR.add(w)}))}
  function tText(raw){
    const trimmed=raw.trim();
    if(!trimmed)return raw;
    const lead=raw.match(/^\s*/)[0], tail=raw.match(/\s*$/)[0];
    /* 1. exact match — the safe, normal path */
    if(DICT_EN[trimmed]!==undefined)return lead+DICT_EN[trimmed]+tail;
    /* 2. sentence built from a known phrase plus a dynamic value:
          translate the longest known phrase that covers most of the string. */
    let out=trimmed, hit=false;
    for(const k of DICT_KEYS){
      if(k.length<6)continue;                 /* short keys are unsafe inside names */
      if(!out.includes(k))continue;
      /* NEVER translate inside a proper noun: a key that lands in the middle of a
         Bangla word ("সংরক্ষণ" hides inside "প্রিয়াঙ্কা") would mangle names.
         Only replace when the match is bounded by a non-Bangla character. */
      if(NO_TR.has(k))continue;
      const re=new RegExp("(^|[^\\u0980-\\u09FF])"+k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
        +"($|[^\\u0980-\\u09FF])","g");
      if(!re.test(out))continue;
      out=out.replace(re,(m,a,b)=>a+DICT_EN[k]+b);hit=true;
    }
    /* 3a. short words isolated by separators (· , | space) — safe: whole-token match */
    for(const [k,v] of TOKEN_EN){
      if(NO_TR.has(k))continue;
      const re=new RegExp("(^|[\\s·,|(])"+k+"($|[\\s·,|)])","g");
      if(re.test(out)){out=out.replace(re,(x,a,b)=>a+v+b);hit=true;}
    }
    /* 3. unit words that follow a number — safe because a digit precedes them */
    for(const [k,v] of UNIT_EN){
      const re=new RegExp("(\\d\\s*)"+k+"(?![\\u0980-\\u09FF])","g");
      if(re.test(out)){out=out.replace(re,(m,n)=>n+v);hit=true;}
    }
    out=out.replace(/(\d)\s*টি(?![\u0980-\u09FF])/g,"$1");
    /* 4. dates: only whole month words surrounded by non-letters */
    for(const m in EN_MON){
      const re=new RegExp("(^|[^\\u0980-\\u09FF])"+m+"($|[^\\u0980-\\u09FF])","g");
      if(re.test(out)){out=out.replace(re,(x,a,b)=>a+EN_MON[m]+b);hit=true;}
    }
    /* 4. Bangla digits are always safe to convert */
    if(/[০-৯]/.test(out)){out=out.replace(/[০-৯]/g,c=>EN_NUM[c]);hit=true;}
    return hit?lead+out+tail:raw;
  }
  /* tp(bnFn, enFn) — for sentences with values inside; picked at render time */
  const tp=(bn,en)=>isEN()?en:bn;
  const T_ATTR=["placeholder","title","aria-label","alt","value"];
  function translateNode(root){
    if(!isEN()||!root)return;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode:n=>{
        if(!BN_RE.test(n.nodeValue))return NodeFilter.FILTER_REJECT;
        const p=n.parentElement;
        if(!p||p.closest("[data-noi18n]"))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
    const list=[];while(w.nextNode())list.push(w.currentNode);
    list.forEach(n=>{const v=tText(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v});
    const els=[root,...root.querySelectorAll("*")];
    els.forEach(el=>{
      if(el.closest&&el.closest("[data-noi18n]"))return;
      T_ATTR.forEach(a=>{
        if(!el.getAttribute)return;
        const v=el.getAttribute(a);
        if(v&&BN_RE.test(v)&&!(a==="value"&&el.tagName==="OPTION"))el.setAttribute(a,tText(v));
      });
    });
  }
  /* re-render everything in the active language */
  function applyLang(){
    document.documentElement.lang=isEN()?"en":"bn";
    document.body.dataset.lang=ME.prefs.lang;
    if(typeof CUR!=="undefined"&&CUR)go(CUR,SUB,false,ARG);
    typeof paintTop==="function"&&paintTop();
    typeof paintNav==="function"&&paintNav();
    if(isEN())translateNode(document.body);
  }
  /* auto-translate any sheet/toast that gets added later */
  function watchI18n(){
    new MutationObserver(ms=>{
      if(!isEN())return;
      ms.forEach(m=>m.addedNodes.forEach(n=>{
        if(n.nodeType===1)translateNode(n);
        else if(n.nodeType===3&&BN_RE.test(n.nodeValue))n.nodeValue=tText(n.nodeValue);
      }));
    }).observe(document.body,{childList:true,subtree:true});
  }
  
  /* ══════════ admin-only translations ══════════
     Two lists, on purpose:
     • DICT_EN  — long phrases, matched anywhere in a string.
     • TOKEN_EN — short words that also appear INSIDE Bangla names
       ("সংরক্ষণ" is a substring of "প্রিয়াঙ্কা"). These are only replaced
       when they stand alone between separators, never mid-word.        */
  Object.assign(DICT_EN,{
  "অ্যাডমিন প্যানেল":"Admin Panel",
  "চকবাজার ব্লাড ডোনার'স ক্লাব":"Chawkbazar Blood Donor's Club",
  "শুভ সকাল":"Good morning",
  "শুভ দুপুর":"Good afternoon",
  "শুভ সন্ধ্যা":"Good evening",
  "শুভ রাত্রি":"Good night",
  "যা এখনই দেখা দরকার":"Needs your attention now",
  "সব ঠিক আছে":"All clear",
  "এই মুহূর্তে জরুরি কোনো কাজ নেই":"Nothing urgent is waiting right now",
  "দ্রুত কাজ":"Quick actions",
  "কাজ শুরু করুন":"Start working",
  "খুঁজুন":"Search",
  "নোটিশ দিন":"Post a notice",
  "রক্তের ভাণ্ডার":"Blood availability",
  "বিস্তারিত পরিসংখ্যান":"Detailed statistics",
  "বিশ্রামের সময় শেষ হয়েছে এমন ডোনার":"Donors whose rest period is over",
  "গত ৭ দিনের রক্তদান":"Donations in the last 7 days",
  "সাম্প্রতিক কাজ":"Recent actions",
  "পুরো অডিট লগ":"Full audit log",
  "চলমান জরুরি আবেদন":"Active emergency requests",
  "মোট রক্তদাতা":"Total donors",
  "এখন প্রস্তুত":"Ready now",
  "অপেক্ষমাণ কাজ":"Pending work",
  "চলমান আবেদন":"Active requests",
  "সব দেখুন":"See all",
  "রোগীর জীবন জড়িত — আগে দেখুন":"A life is at stake — handle these first",
  "৩ জনের কম প্রস্তুত ডোনার আছে":"Fewer than 3 ready donors available",
  "যাচাই করে অনুমোদন দিন":"Review and approve",
  "ওয়েবসাইটের যোগাযোগ ফর্ম থেকে":"From the website contact form",
  "গ্রুপে ডোনার কম":"groups are running low",
  "নতুন ডোনার আবেদন":"new donor applications",
  "জরুরি আবেদন অপেক্ষমাণ":"emergency requests waiting",
  "নতুন বার্তা":"new messages",
  "ডোনার অ্যাপ থেকে আসা সব আবেদন এক জায়গায়":"Every request from the donor app, in one place",
  "ডোনার আবেদন":"Donor application",
  "রক্তদান যাচাই":"Verify donations",
  "জরুরি আবেদন":"Emergency request",
  "গ্রুপ বদল":"Blood group change",
  "রিপোর্ট":"Report",
  "কোনো অপেক্ষমাণ কাজ নেই":"No pending work",
  "নতুন আবেদন এলে এখানে দেখা যাবে":"New requests will appear here",
  "অতিজরুরি":"Critical",
  "সতর্কতা":"Warnings",
  "বিস্তারিত":"Details",
  "সিদ্ধান্তের নোট (ঐচ্ছিক)":"Decision note (optional)",
  "টিমের জন্য নোট…":"A note for the team…",
  "বাতিলের কারণ":"Reason for rejection",
  "বিস্তারিত কারণ…":"Detailed reason…",
  "কারণ লিখতে হবে":"A reason is required",
  "ফিরে যান":"Go back",
  "বাতিল করুন":"Reject",
  "মিলে যাওয়া রক্তদাতা":"Matching donors",
  "এই মুহূর্তে প্রস্তুত ডোনার নেই":"No ready donors right now",
  "অন্য এলাকায় খোঁজ নিন বা ক্যাম্পের ঘোষণা দিন":"Try another area or announce a camp",
  "তথ্য অসম্পূর্ণ":"Incomplete information",
  "বয়স নিয়ম মানেনি":"Age outside the allowed range",
  "বিশ্রামের সময় শেষ হয়নি":"Rest period not finished",
  "স্বাস্থ্যগত কারণে অযোগ্য":"Not eligible on health grounds",
  "প্রমাণ সংযুক্ত নেই":"No proof attached",
  "ভুয়া বা সন্দেহজনক তথ্য":"False or suspicious information",
  "একই আবেদন আগে জমা হয়েছে":"A duplicate application already exists",
  "অনুমোদন করা হয়েছে":"Approved",
  "বাতিল করা হয়েছে":"Rejected",
  "রক্তদাতা, ব্যবহারকারী ও টিম":"Donors, users and team",
  "রক্তদাতা তালিকা":"Donor list",
  "ব্যবহারকারী ও অভিযোগ":"Users and reports",
  "টিম ও ভূমিকা":"Team and roles",
  "শীর্ষ রক্তদাতা":"Top donors",
  "এলাকাভিত্তিক":"By area",
  "খুঁজুন, সম্পাদনা করুন, স্থগিত করুন":"Search, edit, suspend",
  "অ্যাকাউন্ট ও রিপোর্ট":"Accounts and reports",
  "ওয়েবসাইটের যোগাযোগ ফর্ম":"Website contact form",
  "কে কী করতে পারবে":"Who can do what",
  "টিম সদস্য":"Team members",
  "নতুন রক্তদাতা যোগ করুন":"Add a new donor",
  "নতুন রক্তদাতা":"New donor",
  "কোনো রক্তদাতা মেলেনি":"No donors matched",
  "ফিল্টার বদলে আবার চেষ্টা করুন":"Change the filters and try again",
  "জন পাওয়া গেছে":"donors found",
  "সব গ্রুপ":"All groups",
  "সব এলাকা":"All areas",
  "সব অবস্থা":"All statuses",
  "যাচাই বাকি":"Not verified",
  "বিশ্রামে":"Resting",
  "আগের":"Previous",
  "পরের":"Next",
  "পৃষ্ঠা":"Page",
  "রক্তদাতার প্রোফাইল":"Donor profile",
  "রক্ত দিতে প্রস্তুত":"Ready to donate",
  "নিজে বন্ধ রেখেছেন":"Turned off by the donor",
  "রক্তদানের প্রস্তুতি":"Donation readiness",
  "কারা এই রক্ত নিতে পারবেন":"Who can receive this blood",
  "রক্ত দিতে পারবেন":"can donate to",
  "মোট রক্তদান":"Total donations",
  "দিন আগে শেষ দান":"days since last",
  "শেষ দানের তথ্য নেই":"No last-donation date",
  "সাড়া দিয়েছেন":"Responded",
  "মাস ধরে আছেন":"months as a member",
  "অ্যাকাউন্ট স্থগিত — পাবলিক তালিকায় নেই।":"Account suspended — hidden from the public list.",
  "এখনই রক্ত দিতে পারবেন, পাবলিক তালিকায় দেখা যাচ্ছে।":"Can donate now and is visible in the public list.",
  "ডোনার নিজে প্রাপ্যতা বন্ধ রেখেছেন — তাই তালিকায় আসছেন না।":"The donor turned availability off, so they are not listed.",
  "রক্তদানে প্রস্তুত":"Available to donate",
  "স্থগিত করলে কোথাও দেখা যাবে না":"When suspended they appear nowhere",
  "যাচাই করলে পাবলিক তালিকায় দেখা যাবে":"Verifying makes them visible publicly",
  "ডোনার নিজে চালু রেখেছেন":"The donor turned this on",
  "ডোনার নিজে বন্ধ রেখেছেন":"The donor turned this off",
  "রক্ত ও অবস্থান":"Blood and location",
  "ডোনার আইডি":"Donor ID",
  "রক্তদান যোগ করুন":"Add a donation",
  "কোনো রক্তদানের রেকর্ড নেই":"No donation records",
  "এখনো রক্ত দেননি":"Has not donated yet",
  "হাসপাতাল বা ক্যাম্পের নাম":"Hospital or camp name",
  "কোনো আবেদনে সাড়া দেননি":"Has not responded to any request",
  "তথ্য কপি করুন":"Copy details",
  "এই প্রোফাইল নামান":"Download this profile",
  "মুছে ফেলুন":"Delete",
  "শুধু সুপার অ্যাডমিন পারেন":"Super admin only",
  "যাচাইকৃত করুন":"Mark as verified",
  "যাচাই বাতিল":"Remove verification",
  "স্থগিত করুন":"Suspend",
  "স্থগিত তুলুন":"Unsuspend",
  "স্থায়ীভাবে মুছবেন?":"Delete permanently?",
  "তথ্য মুছবে না, শুধু লুকানো থাকবে":"Nothing is deleted, only hidden",
  "হোমপেজ ও তথ্য":"Homepage and info",
  "শিরোনাম, যোগাযোগ, কোন অংশ দেখাবে":"Headline, contact, visible sections",
  "ছবি যোগ, প্রকাশ বা লুকানো":"Add, publish or hide photos",
  "নোটিশ ও ঘোষণা":"Notices and announcements",
  "ওয়েবসাইট ও অ্যাপে পাঠান":"Send to the website and app",
  "সরাসরি পূর্বরূপ":"Live preview",
  "লেখা বদলালেই এখানে সঙ্গে সঙ্গে দেখা যায়।":"Edits show up here instantly.",
  "বড় শিরোনাম":"Main headline",
  "সংক্ষিপ্ত পরিচিতি":"Short introduction",
  "যোগাযোগের তথ্য":"Contact information",
  "হটলাইন নম্বর":"Hotline number",
  "ফেসবুক পেজ":"Facebook page",
  "কোন অংশ দেখা যাবে":"Which sections are visible",
  "পরিসংখ্যান ব্লক":"Statistics block",
  "জরুরি হটলাইন ব্যানার":"Emergency hotline banner",
  "এখন দেখা যাচ্ছে":"Visible now",
  "এখন লুকানো":"Hidden now",
  "সংরক্ষণ করুন":"Save",
  "ওয়েবসাইট হালনাগাদ হয়েছে":"Website updated",
  "ছবি যোগ করুন":"Add a photo",
  "ছবি বেছে নিন":"Choose a photo",
  "কোনো ছবি নেই":"No photos yet",
  "নতুন নোটিশ":"New notice",
  "কারা দেখবে":"Who sees it",
  "কোনো নোটিশ নেই":"No notices",
  "কোথায় দেখা যাবে":"Where it appears",
  "কোনো বার্তা নেই":"No messages",
  "সব পড়া হিসেবে চিহ্নিত করুন":"Mark all as read",
  "গ্রুপ, এলাকা, প্রবণতা":"Groups, areas, trends",
  "অডিট লগ":"Audit log",
  "কে কখন কী করেছে":"Who did what, and when",
  "তথ্য রপ্তানি":"Export data",
  "CSV ফাইলে নামান":"Download as CSV",
  "গ্রুপের অনুপাত":"Group distribution",
  "গ্রুপ অনুযায়ী প্রস্তুত ডোনার":"Ready donors by group",
  "গত ৬ মাসে রক্তদান":"Donations over 6 months",
  "ঘাটতি সতর্কতা":"Shortage alerts",
  "সব গ্রুপে যথেষ্ট ডোনার আছে":"Every group has enough donors",
  "ক্যাম্পের ঘোষণা দিন":"Announce a camp",
  "মোট দান":"Donations",
  "নিয়মিত":"Regular",
  "অডিট লগ একবার লেখা হলে আর বদলানো যায় না।":"Audit entries can never be edited once written.",
  "এই ধরনের কোনো রেকর্ড নেই":"No records of this kind",
  "নিয়ম ও সেটিংস":"Rules and settings",
  "বয়স, বিশ্রাম, অনুমোদন, সংযোগ":"Age, rest, approvals, integrations",
  "রক্তদানের নিয়ম":"Donation rules",
  "সর্বনিম্ন বয়স":"Minimum age",
  "সর্বোচ্চ বয়স":"Maximum age",
  "দুই দানের মাঝে বিশ্রাম (দিন)":"Rest between donations (days)",
  "অনুমোদন প্রক্রিয়া":"Approval process",
  "নতুন ডোনার অনুমোদন লাগবে":"New donors need approval",
  "জরুরি আবেদন অনুমোদন লাগবে":"Emergency requests need approval",
  "কী পেস্ট করুন":"Paste the key",
  "অডিট রেকর্ড":"Audit records",
  "আমার অ্যাকাউন্ট":"My account",
  "আমার অনুমতি":"My permissions",
  "অ্যাকাউন্ট ব্যবস্থাপনা":"Account management",
  "নাম, ছবি, ইমেইল, মোবাইল":"Name, photo, email, mobile",
  "পাসওয়ার্ড, ডিভাইস, কার্যকলাপ":"Password, devices, activity",
  "কে কী দেখতে পাবে":"Who can see what",
  "কখন জানানো হবে":"When you get notified",
  "থিম, প্রদর্শন, শুরুর পাতা":"Theme, display, start page",
  "এই প্যানেলে কী কী করতে পারবেন":"What you can do in this panel",
  "তথ্য নামান, লগআউট":"Download data, sign out",
  "ছবি বদলান":"Change photo",
  "ডেটাবেজ থেকে নির্ধারিত হয়":"Set from the database",
  "যুক্ত হয়েছেন":"Joined",
  "রক্তদাতা হিসেবে":"As a donor",
  "আমিও একজন রক্তদাতা":"I am a donor too",
  "রক্তদাতা তালিকায় আমার নামও থাকবে":"Include me in the donor list",
  "সর্বশেষ রক্তদান":"Last donation",
  "রক্তের গ্রুপ":"Blood group",
  "নাম বদলান":"Change name",
  "পুরো নাম":"Full name",
  "Username বদলান":"Change username",
  "ইমেইল বদলান":"Change email",
  "মোবাইল বদলান":"Change mobile",
  "মোবাইল নম্বর":"Mobile number",
  "জন্মতারিখ":"Date of birth",
  "সম্পূর্ণ ঠিকানা":"Full address",
  "সংগঠনে আপনার পদবি":"Your designation in the club",
  "পাসওয়ার্ড বদলান":"Change password",
  "বর্তমান পাসওয়ার্ড":"Current password",
  "নতুন পাসওয়ার্ড":"New password",
  "আবার লিখুন":"Repeat it",
  "কমপক্ষে ৬ অক্ষর":"At least 6 characters",
  "বড় হাতের অক্ষর, সংখ্যা ও চিহ্ন মিশিয়ে দিন।":"Mix uppercase letters, numbers and symbols.",
  "খুব দুর্বল":"Very weak",
  "দুর্বল":"Weak",
  "মোটামুটি":"Fair",
  "ভালো":"Good",
  "শক্তিশালী":"Strong",
  "সর্বশেষ পরিবর্তন":"Last changed",
  "লগইন সুরক্ষা":"Login protection",
  "নতুন লগইন সতর্কতা":"New login alerts",
  "অচেনা ডিভাইসে লগইন হলে জানানো হবে":"Get told when an unknown device signs in",
  "লগইন ও ডিভাইস":"Logins and devices",
  "সক্রিয় সেশন":"active sessions",
  "আমার কার্যকলাপ":"My activity",
  "আমার অ্যাকাউন্টে কী কী বদলেছে":"What changed in my account",
  "দুই-ধাপ যাচাই (2FA)":"Two-factor authentication (2FA)",
  "অ্যাডমিনদের জন্য বিশেষভাবে জরুরি":"Especially important for admins",
  "অ্যাকাউন্ট রিকভারি":"Account recovery",
  "ব্যাকআপ পদ্ধতি":"Backup method",
  "এই ডিভাইস":"This device",
  "বের করুন":"Sign out",
  "সব ডিভাইস থেকে লগআউট":"Sign out of all devices",
  "এই ডিভাইস বের করবেন?":"Sign this device out?",
  "ডিভাইস বের করা হয়েছে":"Device signed out",
  "টিমে আমার প্রোফাইল":"My profile in the team",
  "টিম তালিকায় আমাকে দেখান":"Show me in the team list",
  "বন্ধ করলে শুধু সুপার অ্যাডমিন দেখবেন":"When off, only super admins can see you",
  "রক্তের গ্রুপ দেখান":"Show blood group",
  "মোবাইল নম্বর কে দেখবে":"Who can see my mobile",
  "ইমেইল কে দেখবে":"Who can see my email",
  "শুধু টিমের সদস্য":"Team members only",
  "কেউ না":"Nobody",
  "কাজের বিজ্ঞপ্তি":"Work notifications",
  "নতুন অপেক্ষমাণ কাজ":"New pending work",
  "ডোনার আবেদন, রক্তদান যাচাই ইত্যাদি":"Donor applications, donation checks and so on",
  "জরুরি রক্তের আবেদন":"Emergency blood requests",
  "অতিজরুরি হলে সবসময় জানানো হবে":"Critical ones always notify you",
  "নতুন ব্যবহারকারী":"New users",
  "কেউ নিবন্ধন করলে":"When someone registers",
  "আমাকে উল্লেখ করলে":"When I am mentioned",
  "টিমের কেউ কাজ দিলে":"When a teammate assigns work",
  "দৈনিক সারসংক্ষেপ":"Daily digest",
  "প্রতিদিন সকালে এক নজরে সব":"Everything at a glance each morning",
  "শব্দ ও সময়":"Sound and timing",
  "বিজ্ঞপ্তির শব্দ":"Notification sound",
  "নিরাপত্তা সতর্কতা":"Security alerts",
  "নিরাপত্তার জন্য বন্ধ করা যায় না":"Cannot be turned off, for safety",
  "প্রদর্শনের ঘনত্ব":"Display density",
  "অ্যানিমেশন":"Animations",
  "চলমান প্রভাব চালু/বন্ধ":"Turn motion effects on or off",
  "বিজ্ঞপ্তির সংখ্যা দেখান":"Show notification counts",
  "আইকনে লাল সংখ্যা":"The red number on the icon",
  "শুরুর পাতা":"Start page",
  "লগইনের পর কোন পাতা খুলবে":"Which page opens after sign-in",
  "আমার তথ্য":"My data",
  "আমার তথ্য নামান":"Download my data",
  "প্রোফাইল ও কার্যকলাপ JSON ফাইলে":"Profile and activity as a JSON file",
  "এই ডিভাইস থেকে বের হন":"Sign out on this device",
  "আমার সেটিংস রিসেট":"Reset my settings",
  "প্রোফাইল ডিফল্ট অবস্থায় ফিরবে":"Your profile returns to its defaults",
  "সুপার অ্যাডমিন":"Super Admin",
  "অ্যাডমিন":"Admin",
  "মডারেটর":"Moderator",
  "টি অনুমতি":"permissions",
  "হালনাগাদ হয়েছে":"Updated",
  "সংরক্ষণ হয়েছে":"Saved",
  "চালু করা হয়েছে":"Turned on",
  "বন্ধ করা হয়েছে":"Turned off",
  "মুছে ফেলা হয়েছে":"Deleted",
  "কপি হয়েছে":"Copied",
  "ফাইল নামছে":"Downloading",
  "শীঘ্রই আসছে":"Coming soon",
  "আপনার অনুমতি নেই":"You do not have permission",
  "এই অংশে আপনার অনুমতি নেই":"You do not have permission for this section",
  "প্রয়োজন হলে সুপার অ্যাডমিনকে বলুন":"Ask a super admin if you need it",
  "শুধু দেখার অনুমতি":"View-only access",
  "আপনার শুধু দেখার অনুমতি আছে।":"You have view-only access.",
  "রিসেট হয়েছে":"Reset complete",
  "জরুরিতা":"Urgency",
  "আবেদনকারী":"Requested by",
  "ডোনার খোঁজা হচ্ছে":"Searching for donors",
  "ডোনার পাওয়া গেছে":"Donor found",
  "ডোনার মেলান":"Match donors",
  "ডোনার মেলানো":"Donor matching",
  "আবেদন বাতিল":"Cancel request",
  "আবেদন সম্পন্ন?":"Mark request as done?",
  "কোনো চলমান আবেদন নেই":"No active requests",
  "অনুমোদিত জরুরি আবেদন এখানে দেখা যাবে":"Approved emergency requests appear here",
  "নিরাপত্তা নিয়ম":"Security rules",
  "আপনার অনুমতি":"Your permissions",
  "সদস্য যোগ":"Add member",
  "ভূমিকা ও অনুমতি":"Role and permissions",
  "এই ভূমিকা যা পারবে":"What this role can do",
  "ভূমিকা অনুযায়ী অনুমতি":"Permissions by role",
  "ভূমিকা হালনাগাদ হয়েছে":"Role updated",
  "বার দান":"donations",
  "রক্তদাতার তথ্য সম্পাদনা":"Edit donor details",
  "ডোনার আবেদন অনুমোদন":"Approve donor applications",
  "রক্তদাতা দেখা":"View donors",
  "ফোন নম্বর দেখা":"Reveal phone numbers",
  "আবেদন দেখা":"View requests",
  "আবেদন অনুমোদন":"Approve requests",
  "আবেদন সম্পন্ন/বাতিল":"Resolve or cancel requests",
  "ব্যবহারকারী দেখা":"View users",
  "অ্যাকাউন্ট স্থগিত":"Suspend accounts",
  "গ্রুপ বদল অনুমোদন":"Approve group changes",
  "অভিযোগ নিষ্পত্তি":"Resolve reports",
  "ওয়েবসাইট দেখা":"View website",
  "ওয়েবসাইট সম্পাদনা":"Edit website",
  "গ্যালারি ব্যবস্থাপনা":"Manage gallery",
  "নোটিশ ব্যবস্থাপনা":"Manage notices",
  "টিম দেখা":"View team",
  "ভূমিকা বদল":"Change roles",
  "সেটিংস বদল":"Change settings",
  "অডিট লগ দেখা":"View audit log",
  "ওয়েবসাইট ও সিস্টেম":"Website and system",
  "রক্তদাতা তালিকা দেখুন":"Open the donor list",
  "সব ব্যবহারকারী":"All users",
  "খোঁজা, ফিল্টার ও সম্পাদনা":"Search, filter and edit",
  "ডোনার খোঁজা":"Finding donors",
  "ডোনার পাওয়া":"Donor found",
  "অনুমোদিত":"Approved",
  "ImgBB সংযোগ":"ImgBB connection",
  "ImgBB API কী":"ImgBB API key",
  "সর্বোচ্চ আকার":"Maximum size",
  "কী সংরক্ষিত":"Key saved",
  "কী দেওয়া হয়নি":"No key provided",
  "এখন সক্রিয়":"Active now",
  "তথ্য নেই":"Not recorded",
  "দ্রুত বদল — বিস্তারিত পছন্দে":"Quick switch — full options in Preferences",
  "নিজের আবেদন নিজে অনুমোদন করা যায় না":"You cannot approve your own application",
  "নিজের ভূমিকা নিজে বাড়ানো যায় না":"You cannot raise your own role",
  "শেষ সুপার অ্যাডমিনকে সরানো যায় না":"The last super admin cannot be removed",
  "অডিট লগ একবার লেখা হলে বদলানো যায় না":"Audit entries cannot be changed once written",
  "ফোন নম্বর দেখলে তা লগে থেকে যায়":"Revealing a phone number is always logged",
  "ওয়েবসাইটের হোমপেজে ব্যানার হিসেবে":"As a banner on the website homepage",
  "ডোনার অ্যাপের হোম স্ক্রিনে":"On the donor app home screen",
  "নির্দিষ্ট গ্রুপ বা এলাকা বেছে দিলে শুধু তাদের কাছে":"Only to the chosen blood group or area"
  });
  [
  ["হোম","Home"],
  ["কাজ","Work"],
  ["মানুষ","People"],
  ["নিয়ন্ত্রণ","Control"],
  ["ওয়েবসাইট","Website"],
  ["নির্বাচিত","selected"],
  ["অনুমোদন","Approve"],
  ["বাতিল","Reject"],
  ["মুছুন","Clear"],
  ["বার্তা","Messages"],
  ["রক্তদাতা","Donors"],
  ["প্রস্তুত","Ready"],
  ["অভিযোগ","Reports"],
  ["স্থগিত","Suspended"],
  ["সংক্ষিপ্ত","Overview"],
  ["তথ্য","Details"],
  ["রক্তদান","Donations"],
  ["আবেদন","Requests"],
  ["কার্যকলাপ","Activity"],
  ["কল","Call"],
  ["সম্পাদনা","Edit"],
  ["আরও","More"],
  ["যাচাইকৃত","Verified"],
  ["সিস্টেম","System"],
  ["গ্যালারি","Gallery"],
  ["ডেস্কটপ","Desktop"],
  ["ট্যাব","Tablet"],
  ["মোবাইল","Mobile"],
  ["হেডলাইন","Headline"],
  ["প্রকাশিত","Published"],
  ["খসড়া","Draft"],
  ["প্রকাশ","Publish"],
  ["লুকান","Hide"],
  ["সবাই","Everyone"],
  ["শুরু","From"],
  ["শেষ","To"],
  ["পরিসংখ্যান","Statistics"],
  ["সংযোগ","Integrations"],
  ["অপেক্ষায়","Pending"],
  ["সক্রিয়","Active"],
  ["অ্যাকাউন্ট","Account"],
  ["নিরাপত্তা","Security"],
  ["গোপনীয়তা","Privacy"],
  ["বিজ্ঞপ্তি","Notifications"],
  ["পছন্দ","Preferences"],
  ["সরান","Remove"],
  ["পরিচয়","Identity"],
  ["ব্যক্তিগত","Personal"],
  ["সংগঠনে","In the organisation"],
  ["পদবি","Designation"],
  ["ভূমিকা","Role"],
  ["লিঙ্গ","Gender"],
  ["এলাকা","Area"],
  ["ঠিকানা","Address"],
  ["উন্নত","Advanced"],
  ["যোগাযোগ","Contact"],
  ["সারসংক্ষেপ","Summary"],
  ["চেহারা","Appearance"],
  ["থিম","Theme"],
  ["আলো","Light"],
  ["আঁধার","Dark"],
  ["স্বাভাবিক","Normal"],
  ["ঘন","Compact"],
  ["ভাষা","Language"],
  ["অন্যান্য","Other"],
  ["সেশন","Session"],
  ["লগআউট","Sign out"],
  ["বিপজ্জনক","Danger zone"],
  ["আছে","Yes"],
  ["নেই","No"],
  ["সংরক্ষণ","Save"],
  ["সংরক্ষিত","Saved"],
  ["বন্ধ","Close"],
  ["হ্যাঁ","Yes"],
  ["যোগ করুন","Add"],
  ["নামান","Download"],
  ["রপ্তানি","Export"],
  ["রিফ্রেশ","Refresh"],
  ["দেখুন","View"],
  ["শীঘ্রই","Soon"],
  ["অপেক্ষমাণ","Pending"],
  ["সংস্করণ","Version"],
  ["স্থান","Place"],
  ["তারিখ","Date"],
  ["ব্যাগ","bags"],
  ["রোগী","Patient"],
  ["সময়","Time"],
  ["সম্পন্ন","Done"],
  ["জন","people"],
  ["টি",""],
  ["সব","All"],
  ["নাম","Name"],
  ["ইমেইল","Email"],
  ["ফোন","Phone"],
  ["বয়স","Age"],
  ["পুরুষ","Male"],
  ["মহিলা","Female"],
  ["বছর","years"],
  ["অবস্থা","Status"],
  ["গ্রুপ","Group"],
  ["নিষ্ক্রিয়","Inactive"],
  ["বিশ্লেষণ","Analytics"],
  ["টিম","Team"],
  ["নোটিশ","Notices"],
  ["ব্যবহারকারী","Users"],
  ["নতুন","new"],
  ["বার","times"],
  ["জানুয়া","Jan"],
  ["ফেব্রু","Feb"],
  ["মার্চ","Mar"],
  ["এপ্রি","Apr"],
  ["মে","May"],
  ["জুন","Jun"],
  ["জুল","Jul"],
  ["আগ","Aug"],
  ["সেপ","Sep"],
  ["অক্টো","Oct"],
  ["নভে","Nov"],
  ["ডিসে","Dec"]
  ].forEach(pair=>TOKEN_EN.unshift(pair));
  DICT_KEYS.length=0;
  Object.keys(DICT_EN).sort((a,b)=>b.length-a.length).forEach(k=>DICT_KEYS.push(k));
  
  /* counted phrases: the engine strips "টি" after a digit, so register the
     remainder as whole tokens */
  [["অনুমতি","permissions"],["সদস্য","members"],["ছবি","photos"],["অ্যাপ","app"],
   ["ক্যাম্প","camp"],["আপনি","you"],["এখনই","now"],["মাত্র","only"],["কোনো","No"],
   ["হবে","will be"],["ও","and"],["অনুমোদন","approval"],["যোগ","added"],["গ্যালারিতে","to the gallery"]
  ].forEach(pair=>TOKEN_EN.unshift(pair));
  
  /* full sentences that must never be assembled from fragments */
  Object.assign(DICT_EN,{
  "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না। কিছু দরকার হলে সুপার অ্যাডমিনকে বলুন।":
    "Your role is set from the database and cannot be changed by you. Ask a super admin if you need more access.",
  "আসল সিস্টেমে ভূমিকা ডেটাবেজ থেকে আসবে। এখন পরীক্ষার জন্য বদলে দেখতে পারেন।":
    "In the real system the role comes from the database. Switch it here to test the panel.",
  "রক্তদাতা, অপেক্ষমাণ আবেদন ও চলমান আবেদন — সব একসাথে খোঁজা হবে।":
    "Donors, pending applications and active requests are all searched together.",
  "নিয়ন্ত্রণ → নিয়ম ও সেটিংস থেকে API কী দিলে সরাসরি আপলোড চালু হবে।":
    "Add an API key under Control → Rules and settings to turn on direct uploads.",
  "আপনার অ্যাকাউন্টে":"Your account has","পাসওয়ার্ড কারও সাথে ভাগ করবেন না।":"Never share your password with anyone.",
  "এই নিয়মগুলো আবেদন যাচাইয়ের সময় সতর্কতা হিসেবে দেখানো হয়।":
    "These rules are shown as warnings while reviewing an application.",
  "আমি নতুন ডোনার হিসেবে যুক্ত হতে চাই, কীভাবে করব?":
    "I would like to join as a new donor — how do I do that?",
  "আমার মায়ের জন্য B− রক্ত দরকার, কাল সকালে।":"My mother needs B− blood tomorrow morning.",
  "ঈদের ছুটিতে জরুরি হটলাইন চালু":"Emergency hotline open through the Eid holidays",
  "ঈদের ছুটিতেও ২৪ ঘণ্টা হটলাইন খোলা থাকবে":"The hotline stays open 24 hours during the Eid holidays",
  "রক্তদান ক্যাম্প ২০২৬":"Blood donation camp 2026","স্বেচ্ছাসেবক দল":"Volunteer team",
  "নতুন ডোনার অনুমোদন":"New donor approval","ডোনার অনুমোদন":"Donor approved",
  "জরুরি আবেদন অনুমোদন":"Emergency request approved","রক্তদান যাচাই":"Donation verified",
  "গ্যালারিতে ছবি যোগ":"Photo added to the gallery","ভূমিকা পরিবর্তন":"Role changed",
  "আমার এলাকা ভুল দেখাচ্ছে — পাঁচলাইশ হবে, চকবাজার নয়।":
    "My area is wrong — it should be Panchlaish, not Chawkbazar.",
  "নম্বরের ডোনার টাকা চেয়েছেন বলে অভিযোগ।":"A complaint says this donor asked for money.",
  "হাসপাতালের রিপোর্টে ভিন্ন গ্রুপ এসেছে":"The hospital report shows a different group",
  "সম্পূর্ণ সুস্থ।":"Completely healthy.","কোনো রোগ নেই।":"No illnesses.","সুস্থ।":"Healthy.",
  "থাইরয়েডের ওষুধ চলছে।":"Currently on thyroid medication.",
  "নতুন যোগ করতে নিচে দেখুন":"scroll down to add a new one",
  "ভুল তথ্য":"Wrong information","অন্য ব্যবহারকারীর অভিযোগ":"Complaint about another user",
  "ক্লাবের রক্তদান ক্যাম্প":"Club blood donation camp","চমেক ব্লাড ব্যাংক":"CMCH Blood Bank"
  });
  DICT_KEYS.length=0;
  Object.keys(DICT_EN).sort((a,b)=>b.length-a.length).forEach(k=>DICT_KEYS.push(k));
  
  /* last pass — long notes, exact strings */
  Object.assign(DICT_EN,{
  "অ্যাডমিন অ্যাকাউন্ট নিজে থেকে মুছে ফেলা যায় না — শেষ সুপার অ্যাডমিন হারিয়ে গেলে পুরো সিস্টেম আটকে যাবে। সুপার অ্যাডমিনকে বলুন।":
    "An admin account cannot delete itself — losing the last super admin would lock the whole system. Ask a super admin.",
  "এই সেটিংস আপনার নিজের তথ্যের জন্য — টিমের অন্য সদস্য ও পাবলিক তালিকায় কী দেখা যাবে তা ঠিক করে।":
    "These settings cover your own details — they control what teammates and the public list can see.",
  "অ্যাডমিন হিসেবে আপনি যা যা করেন তা":"Everything you do as an admin",
  "অডিট লগে থেকেই যায় — এটি গোপনীয়তা সেটিংস দিয়ে বন্ধ করা যায় না।":
    "stays in the audit log — privacy settings cannot switch that off.",
  "আপনার অ্যাকাউন্টে যেসব ডিভাইসে লগইন আছে তার তালিকা। অচেনা কিছু দেখলে সাথে সাথে বের করে দিন।":
    "Devices currently signed in to your account. If you see anything unfamiliar, sign it out immediately.",
  "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না।":
    "Your role is set from the database and cannot be changed by you.",
  "কিছু দরকার হলে সুপার অ্যাডমিনকে বলুন।":"Ask a super admin if you need more access.",
  "শাহাদাত আহমেদ":"Shahadat Ahmed","শাহাদাত":"Shahadat"
  });
  DICT_KEYS.length=0;
  Object.keys(DICT_EN).sort((a,b)=>b.length-a.length).forEach(k=>DICT_KEYS.push(k));
  
  /* ---- access & roles, More screen, logout ---- */
  Object.assign(DICT_EN,{
  "অ্যাক্সেস ও ভূমিকা":"Access and roles","কাকে অ্যাডমিন বা মডারেটর করবেন":"Who becomes an admin or moderator",
  "অ্যাকাউন্ট ও নিয়ন্ত্রণ":"Account and controls","ব্যবস্থাপনা":"Management",
  "নাম, ইউজারনেম বা ইমেইল…":"Name, username or email…",
  "সবাই":"Everyone","টিমে আছে":"On the team","সাধারণ":"Regular",
  "কেউ মেলেনি":"Nobody matched","অন্য নাম, ইউজারনেম বা ইমেইল দিয়ে চেষ্টা করুন":"Try another name, username or email",
  "সাধারণ ব্যবহারকারী":"Regular user","শুধু ডোনার অ্যাপ ব্যবহার করতে পারবেন":"Can only use the donor app",
  "সব দেখতে পারবেন, কিছু বদলাতে পারবেন না":"Can see everything, change nothing",
  "অপেক্ষমাণ আবেদন যাচাই ও অনুমোদন করবেন":"Reviews and approves the pending queue",
  "ওয়েবসাইট ও রক্তদাতা ব্যবস্থাপনা করবেন":"Manages the website and donors",
  "সবকিছু — ভূমিকা দেওয়াসহ":"Everything, including granting roles",
  "বর্তমান ভূমিকা":"Current role","নতুন ভূমিকা":"New role","কারণ":"Reason",
  "কেন এই পরিবর্তন করছেন…":"Why are you making this change…",
  "যা পারবেন":"Can do","যা পারবেন না":"Cannot do","এটিই বর্তমান ভূমিকা।":"This is the current role.",
  "ভূমিকা বদলানো হয়নি":"Role unchanged","কারণ লিখতে হবে":"A reason is required",
  "অ্যাক্সেস দেবেন?":"Grant access?","অ্যাক্সেস তুলে নেবেন?":"Revoke access?",
  "অ্যাক্সেস দিন":"Grant access","তুলে নিন":"Revoke",
  "অ্যাক্সেস দেওয়া হয়েছে":"Access granted","অ্যাক্সেস তুলে নেওয়া হয়েছে":"Access revoked",
  "নিয়ম":"Rules","আরও":"More",
  "লগআউট করবেন?":"Sign out?",
  "প্যানেল থেকে বের হয়ে মূল ওয়েবসাইটে ফিরে যাবেন। আবার ঢুকতে হলে নতুন করে লগইন করতে হবে।":
    "You will leave the panel and return to the main website. You must log in again to come back.",
  "লগআউট হয়েছে — মূল ওয়েবসাইটে ফিরে যাচ্ছেন":"Signed out — returning to the main website",
  "প্যানেল থেকে বের হয়েছেন":"Left the panel",
  "যাকে অ্যাক্সেস দেবেন তার অ্যাকাউন্ট আগে থেকেই থাকতে হবে। নাম, ইউজারনেম বা ইমেইল দিয়ে খুঁজুন।":
    "The person must already have an account. Search by name, username or email.",
  "সুপার অ্যাডমিন ভূমিকা শুধু ডেটাবেজ থেকে দেওয়া হয়":"Super admin is granted from the database only",
  "প্রতিটি পরিবর্তন কারণসহ অডিট লগে থাকে":"Every change is logged with its reason",
  "সুপার অ্যাডমিনের ভূমিকা এখান থেকে বদলানো যায় না।":"A super admin's role cannot be changed from here.",
  "ইনিই একমাত্র সুপার অ্যাডমিন — নামালে সিস্টেম নিয়ন্ত্রণহীন হয়ে যাবে।":
    "This is the only super admin — demoting them would leave the system without an owner.",
  "ডোনার আইডি":"Donor ID"
  });
  DICT_KEYS.length=0;
  Object.keys(DICT_EN).sort((a,b)=>b.length-a.length).forEach(k=>DICT_KEYS.push(k));
  
  /* ═══════════════════════════════════════════════════════════════
     COMMON UI RUNTIME — shared by every panel
     Solves, once and for all:
       • an active tab/chip that sits outside the visible strip
       • strips that fade even when nothing is hidden
       • components added later (sheets, re-renders) getting no wiring
     It is driven by a MutationObserver, so ANY future feature is covered
     without touching this file again.
     ═══════════════════════════════════════════════════════════════ */
  const UI=(()=>{
    /* keep the active item of a scroll strip in view */
    function centreActive(strip,smooth){
      const on=strip.querySelector(".on");
      if(!on)return;
      if(strip.scrollWidth<=strip.clientWidth+2)return;
      const s=strip.getBoundingClientRect(), a=on.getBoundingClientRect();
      if(a.left>=s.left-1&&a.right<=s.right+1)return;      /* already visible */
      const target=strip.scrollLeft+(a.left-s.left)-(s.width-a.width)/2;
      strip.scrollTo({left:Math.max(0,target),behavior:smooth?"smooth":"auto"});
    }
    /* a strip that fits should not fade or scroll */
    function measure(strip){
      const fits=strip.scrollWidth<=strip.clientWidth+2;
      strip.classList.toggle("fits",fits);
      if(fits){strip.classList.remove("at-end");return}
      const atEnd=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2;
      strip.classList.toggle("at-end",atEnd);
    }
    const wired=new WeakSet();
    function wire(strip){
      if(wired.has(strip))return;
      wired.add(strip);
      strip.addEventListener("scroll",()=>measure(strip),{passive:true});
      /* clicking a chip makes it active — bring it into view next frame */
      strip.addEventListener("click",e=>{
        const btn=e.target.closest("button");
        if(!btn||!strip.contains(btn))return;
        requestAnimationFrame(()=>{centreActive(strip,true);measure(strip)});
        setTimeout(()=>{centreActive(strip,true);measure(strip)},60);
      });
      /* keyboard: arrows move between chips */
      strip.addEventListener("keydown",e=>{
        if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
        const btns=[...strip.querySelectorAll("button:not([disabled])")];
        const i=btns.indexOf(document.activeElement);
        if(i<0)return;
        e.preventDefault();
        const n=btns[i+(e.key==="ArrowRight"?1:-1)];
        if(n){n.focus();centreActive(strip,true)}
      });
      measure(strip);centreActive(strip,false);
    }
    /* every horizontal control row is a strip — no per-screen wiring */
    const SEL=".strip,.chips,.tabs,.seg";
    function scan(root){
      (root||document).querySelectorAll?.(SEL).forEach(el=>{
        if(!el.classList.contains("strip"))el.classList.add("strip");
        wire(el);
      });
    }
    /* keep everything correct after re-renders, sheets and resizes */
    function observe(){
      new MutationObserver(ms=>{
        let touched=false;
        ms.forEach(m=>{
          m.addedNodes.forEach(n=>{if(n.nodeType===1){scan(n);
            if(n.matches&&n.matches(SEL)){if(!n.classList.contains("strip"))n.classList.add("strip");wire(n)}
            touched=true}});
          if(m.type==="attributes"&&m.target.classList?.contains("on")){
            const s=m.target.closest(SEL);if(s){centreActive(s,true);measure(s)}
          }
        });
        if(touched)requestAnimationFrame(()=>document.querySelectorAll(SEL).forEach(s=>{measure(s);centreActive(s,false)}));
      }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
      let t;addEventListener("resize",()=>{clearTimeout(t);
        t=setTimeout(()=>document.querySelectorAll(SEL).forEach(s=>{measure(s);centreActive(s,false)}),120)},{passive:true});
    }
    /* reflect the real viewport height — mobile browser chrome lies about 100vh */
    function vh(){
      const set=()=>document.documentElement.style.setProperty("--vh",innerHeight*0.01+"px");
      set();addEventListener("resize",set,{passive:true});
      addEventListener("orientationchange",()=>setTimeout(set,120));
    }
    function init(){scan(document);observe();vh();}
    return {init,scan,centreActive:()=>document.querySelectorAll(SEL).forEach(s=>centreActive(s,false))};
  })();
  
  /* ══════════════════════════════════════════════════════════════
     CBDC ADMIN PANEL
     Built on exactly the same system as the donor app (app.html):
     fixed top bar → 4 nav items → screens → sub-pages with a back
     button → sheets for detail work. Nothing here re-invents the
     shell; only the screens are new.
     Data source: Firestore (live sync)
     later touches seed()/persist()/restore()/logAudit() only.
     ══════════════════════════════════════════════════════════════ */
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const D9=["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  const bn=v=>String(v??"").replace(/\d/g,d=>D9[d]);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const now=()=>new Date();
  const iso=d=>new Date(d).toISOString().slice(0,10);
  const dL=v=>v?new Date(v+"T00:00:00").toLocaleDateString("bn-BD",{year:"numeric",month:"long",day:"numeric"}):"—";
  const dS=v=>v?new Date(v+"T00:00:00").toLocaleDateString("bn-BD",{day:"numeric",month:"short"}):"—";
  const dayDiff=a=>Math.floor((new Date().setHours(0,0,0,0)-new Date(a+"T00:00:00").setHours(0,0,0,0))/864e5);
  const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return iso(x)};
  const phoneOK=v=>/^01[3-9]\d{8}$/.test(String(v||"").replace(/\s/g,""));
  const pad=(n,l=4)=>String(n).padStart(l,"0");
  function timeAgo(t){
    const s=Math.floor((Date.now()-new Date(t))/1000);
    if(s<60)return "এখনই";
    if(s<3600)return bn(Math.floor(s/60))+" মিনিট আগে";
    if(s<86400)return bn(Math.floor(s/3600))+" ঘণ্টা আগে";
    return bn(Math.floor(s/86400))+" দিন আগে";
  }
  
  /* ══════════ PERMISSIONS ══════════ */
  const PERM_GROUPS={
    "রক্তদাতা":["donor.view","donor.edit","donor.approve","donation.verify","contact.reveal"],
    "আবেদন":["request.view","request.approve","request.resolve"],
    "ব্যবহারকারী":["user.view","user.suspend","group.approve","report.resolve"],
    "ওয়েবসাইট":["website.view","website.edit","gallery.manage","notice.manage"],
    "নিয়ন্ত্রণ":["team.view","team.manage","access.manage","settings.manage","audit.view","data.export"]
  };
  const PERMS=Object.values(PERM_GROUPS).flat();
  const ROLES={
    super:{label:"সুপার অ্যাডমিন",icon:"👑",perms:PERMS.slice()},
    admin:{label:"অ্যাডমিন",icon:"🛡️",perms:PERMS.filter(p=>!["team.manage","access.manage","settings.manage"].includes(p))},
    /* A moderator exists to clear the pending queue — nothing else.
       They may read a donor's details while judging an application
       (the review sheet), but cannot browse or manage the donor list. */
    mod:{label:"মডারেটর",icon:"🔧",perms:["donor.approve","donation.verify","contact.reveal",
      "request.view","request.approve","group.approve","report.resolve"]}
  };
  let ME={uid:"",name:"",role:PANEL.role};
  const myPerms=()=>new Set((ME.permissions&&ME.permissions.length)?ME.permissions:ROLES[ME.role].perms);
  const can=p=>myPerms().has(p);
  
  /* ══════════ BLOOD COMPATIBILITY ══════════ */
  const CAN_GIVE={"O-":["O-","O+","A-","A+","B-","B+","AB-","AB+"],"O+":["O+","A+","B+","AB+"],
    "A-":["A-","A+","AB-","AB+"],"A+":["A+","AB+"],"B-":["B-","B+","AB-","AB+"],"B+":["B+","AB+"],
    "AB-":["AB-","AB+"],"AB+":["AB+"]};
  const donorsFor=g=>Object.keys(CAN_GIVE).filter(d=>CAN_GIVE[d].includes(g));
  
  /* ══════════ DATA ══════════ */
  const LS="cbdc.admin";   /* shared work data — both panels see the same queue */
  const GROUPS=SITE.bloodGroups.slice();
  const AREAS=SITE.areas.slice();
  const HOSPITALS=["চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল","ম্যাক্স হাসপাতাল, মেহেদীবাগ","সিএসসিআর হাসপাতাল",
    "পার্কভিউ হাসপাতাল","ইম্পেরিয়াল হাসপাতাল","চমেক ব্লাড ব্যাংক"];
  const FIRST=["আরিফুর","সাদিয়া","তানভীর","নুসরাত","ইকবাল","ফারহানা","মেহরাব","রিফাতুল","শাকিল","জাহিদুল",
    "সাবরিনা","কামরুল","আশরাফুল","নাবিলা","তাসনিম","রায়হান","সুমাইয়া","জুবায়ের","মাহমুদা","সাইফুল",
    "রুবেল","নাফিসা","হাসান","তানিয়া","ইমরান","শারমিন","ফাহিম","রুমানা","আসিফ","প্রিয়াঙ্কা"];
  const LAST=["রহমান","আক্তার","হোসাইন","জাহান","মাহমুদ","তানজিম","হোসেন","করিম","আহমেদ","ইসলাম",
    "মুস্তফা","হাসান","আলম","চৌধুরী","উদ্দিন","নূর","খাতুন","বেগম","সুলতানা"];
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  
  function seed(){
    /* Firebase is the single source of truth — no seeded/dummy records.
       The shape is kept so every consumer finds the same keys. */
    return {donors:[],queue:[],live:[],audit:[],notices:[],messages:[],
      team:[],gallery:[],
      site:{heroTitle:SITE.hero.title,
        heroText:SITE.hero.text,
        phone:SITE.phone,email:SITE.email,address:SITE.address,
        facebook:SITE.facebookHandle,showStats:true,showGallery:true,showEmergency:true},
      rules:{minAge:SITE.rules.minAge,maxAge:SITE.rules.maxAge,interval:SITE.rules.interval,donorApproval:true,reqApproval:true},
      integr:{imgbbKey:"",firebase:true}};
  }
  let DB=seed(), SHARED_PULLING=false;
  function publishSharedState(){
    if(SHARED_PULLING||!window.CBDCShared)return;
    CBDCShared.update(st=>{
      st.donors=DB.donors.map(CBDCShared.fromAdminDonor);
      st.queue=DB.queue.map(x=>CBDCShared.clone(x));
      st.requests=DB.live.map(r=>({id:r.id,patientName:r.patient,bloodGroup:r.group,bags:r.bags,
        urgency:r.urgency,status:"approved",workflowStatus:r.status||"searching",hospitalName:r.hospital,
        hospitalAddress:r.area,requesterName:r.requester||"স্বজন",phone:r.phone,whatsapp:r.whatsapp||r.phone,
        createdAt:r.at||new Date().toISOString(),expiresAt:r.expiresAt||"",responders:r.responders||0}));
      st.gallery=DB.gallery.map((g,i)=>({...g,imageUrl:g.imageUrl||g.url,url:g.url||g.imageUrl,order:g.order??i+1}));
      st.notices=DB.notices.map(x=>CBDCShared.clone(x));
      if(DB.accounts)st.accounts=DB.accounts.map(x=>CBDCShared.clone(x));
      return st;
    },"panel:"+PANEL.id);
  }
  function pullSharedState(){
    if(!window.CBDCShared)return;
    SHARED_PULLING=true;
    const st=CBDCShared.load();
    DB.donors=st.donors.map(CBDCShared.toAdminDonor);
    DB.queue=st.queue.map(x=>CBDCShared.clone(x));
    DB.live=st.requests.filter(r=>r.status!=="cancelled"&&r.status!=="resolved").map(r=>({
      id:r.id,patient:r.patientName,group:r.bloodGroup,bags:r.bags,urgency:r.urgency,
      status:r.workflowStatus||"searching",responders:r.responders||0,hospital:r.hospitalName,
      area:r.hospitalAddress,requester:r.requesterName||"স্বজন",phone:r.phone,whatsapp:r.whatsapp||"",
      at:r.createdAt||new Date().toISOString(),expiresAt:r.expiresAt||""}));
    if(st.gallery.length)DB.gallery=st.gallery.map(g=>({...g,url:g.url||g.imageUrl}));
    DB.notices=st.notices.map(x=>CBDCShared.clone(x));
    if(st.accounts.length)DB.accounts=st.accounts.map(x=>CBDCShared.clone(x));
    SHARED_PULLING=false;
  }
  function persist(){publishSharedState()}
  pullSharedState();persist();
  function logAudit(act,target,mod){
    DB.audit.unshift({at:new Date().toISOString(),who:ME.name,role:ME.role,act,target,mod});
    if(DB.audit.length>300)DB.audit.length=300;persist();
  }
  const maskPhone=p=>can("contact.reveal")?p:String(p).slice(0,5)+"•••••";
  const REST=()=>DB.rules.interval;
  const readyOf=d=>d.available&&!d.suspended&&(!d.last||dayDiff(d.last)>=REST());
  const qCount=k=>DB.queue.filter(q=>q.kind===k).length;
  const unread=()=>DB.messages.filter(m=>!m.read).length;
  function bloodCounts(){const c={};GROUPS.forEach(g=>c[g]=0);DB.donors.filter(readyOf).forEach(d=>c[d.group]++);return c}
  
  /* ══════════ extra icons ══════════ */
  const SI=Object.assign({},ICON,{
    grid:s=>I(`<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>`,s),
    users:s=>I(`<circle cx="9" cy="8" r="3.6"/><path d="M2.8 20c0-3.6 2.8-5.8 6.2-5.8s6.2 2.2 6.2 5.8"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.4"/><path d="M18 14.6c2 .7 3.3 2.5 3.3 5.4"/>`,s),
    chart:s=>I(`<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="11" width="3.2" height="6" rx="1"/><rect x="13" y="7" width="3.2" height="10" rx="1"/>`,s),
    up:s=>I(`<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>`,s),
    dl:s=>I(`<path d="M12 4v11"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M4.5 19.5h15"/>`,s),
    edit:s=>I(`<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z"/>`,s),
    send:s=>I(`<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8z"/>`,s),
    bolt:s=>I(`<path d="M13.2 2.5 4.8 13.4h6L10 21.5l8.6-11h-6.2z"/>`,s),
    target:s=>I(`<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>`,s),
    moon:s=>I(`<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>`,s),
    more:s=>I(`<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>`,s),
    key:s=>I(`<circle cx="7.5" cy="12" r="3.8"/><path d="M11.3 12H21"/><path d="M17.5 12v3.6"/><path d="M20.5 12v2.4"/>`,s)
  });
  
  /* ══════════ NAVIGATION ══════════
     The tab bar is DERIVED from permissions, never hand-written.
     A moderator (queue-only) gets 3 tabs; an admin gets 4. When someone's
     permissions change the menu follows automatically — no code edit. */
  const NAV_ALL=[
    {id:"home",label:"হোম",icon:SI.home,perm:null},
    {id:"work",label:"কাজ",icon:SI.clock,count:()=>DB.queue.length,perm:null},
    {id:"people",label:"মানুষ",icon:SI.users,perm:"donor.view"},
    {id:"set",label:"আরও",icon:SI.more,perm:null}
  ];
  const NAV=()=>NAV_ALL.filter(n=>!n.perm||can(n.perm));
  /* sub-pages: opened from a screen, top bar turns into back + title */
  const SUBS={
    donors:{title:"রক্তদাতা তালিকা",perm:"donor.view"},
    live:{title:"চলমান আবেদন",perm:"request.view"},
    users:{title:"ব্যবহারকারী",perm:"user.view"},
    team:{title:"টিম ও ভূমিকা",perm:"team.view"},
    site:{title:"ওয়েবসাইট",perm:"website.view"},
    gallery:{title:"গ্যালারি",perm:"website.view"},
    notice:{title:"নোটিশ",perm:"website.view"},
    inbox:{title:"বার্তা",perm:"user.view"},
    stats:{title:"পরিসংখ্যান",perm:"donor.view"},
    audit:{title:"অডিট লগ",perm:"audit.view"},
    rules:{title:"নিয়ম ও সেটিংস",perm:"settings.manage"},
    access:{title:"অ্যাক্সেস ও ভূমিকা",perm:"access.manage"},
    search:{title:"খুঁজুন",perm:null}
  };
  let CUR="home", SUB=null, ARG=null;
  
  function go(id,sub=null,push=true,arg=null){
    /* a screen the current role cannot see always falls back to home */
    const nav=NAV_ALL.find(n=>n.id===id);
    if(nav&&nav.perm&&!can(nav.perm))id="home";
    if(sub&&SUBS[sub]&&SUBS[sub].perm&&!can(SUBS[sub].perm)){toast("এই অংশে আপনার অনুমতি নেই","er");sub=null}
    CUR=id;SUB=sub;ARG=arg;
    $$(".scr").forEach(s=>s.classList.remove("on"));
    if(sub){$("#s-sub").classList.add("on");renderSub(sub)}
    else{$("#s-"+id).classList.add("on");RENDER[id]()}
    paintTop();paintNav();
    if(push){const h=sub?`#${id}/${sub}`:`#${id}`;if(location.hash!==h)location.hash=h}
    window.scrollTo({top:0,behavior:"instant"});
  }
  function paintNav(){
    const showN=!ME.prefs||ME.prefs.badge!==false;
    const html=n=>{const c=showN&&n.count?n.count():0;
      return `<button data-nav="${n.id}" class="${CUR===n.id?"on":""}" aria-label="${n.label}">
        ${n.icon(23)}${c?`<i class="nb">${bn(c)}</i>`:""}<span>${n.label}</span></button>`};
    $("#bnav").innerHTML=NAV().map(html).join("");
  }
  function paintTop(){
    const t=$("#top");
    if(SUB){
      t.className="top sub";
      t.innerHTML=`<button class="back" id="tback" aria-label="পেছনে">${SI.back(22)}</button>
        <h1>${esc(SUBS[SUB]?SUBS[SUB].title:"")}</h1><div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${SI.bell(21)}${badge()}</button>`;
    }else{
      t.className="top";
      t.innerHTML=`<a class="brand" href="#home" data-nav="home">
          <span class="lg"><img src="${LOGO}" alt="CBDC লোগো"></span>
          <span class="btx"><b>চকবাজার ব্লাড ডোনার'স ক্লাব</b><small>${esc(PANEL.label)}</small></span></a>
        <nav class="dnav">${NAV().map(n=>{const c=(!ME.prefs||ME.prefs.badge!==false)&&n.count?n.count():0;
          return `<button data-nav="${n.id}" class="${CUR===n.id?"on":""}" title="${n.label}">
            ${n.icon(22)}${c?`<i class="nb">${bn(c)}</i>`:""}<span>${n.label}</span></button>`}).join("")}</nav>
        <div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${SI.bell(21)}${badge()}</button>`;
    }
  }
  const badge=()=>{const u=DB.queue.length+unread();
    return u&&(!ME.prefs||ME.prefs.badge!==false)?`<span class="bd">${bn(u)}</span>`:""};
  
  document.addEventListener("click",e=>{
    const n=e.target.closest("[data-nav]");
    if(n){e.preventDefault();go(n.dataset.nav);return}
    if(e.target.closest("#tback")){go(CUR);return}
    if(e.target.closest("#tbell")){openNotifs();return}
    const s=e.target.closest("[data-sub]");
    if(s){go(CUR,s.dataset.sub);return}
  });
  window.addEventListener("hashchange",()=>{
    const [a,b]=location.hash.replace("#","").split("/");
    if(!a)return go("home",null,false);
    if(RENDER[a]&&(a!==CUR||(b||null)!==SUB))go(a,b||null,false);
  });
  
  /* ══════════ notification panel (same shape as the app's) ══════════ */
  function openNotifs(){
    const items=[];
    DB.queue.filter(q=>q.kind==="request").forEach(q=>items.push({ic:"warn",cl:"var(--red)",
      b:"জরুরি আবেদন অপেক্ষমাণ",s:`${q.patient} · ${q.group} · ${bn(q.bags)} ব্যাগ`,at:q.at,
      go:()=>{wTab="request";go("work")}}));
    DB.queue.filter(q=>q.kind==="donor").slice(0,3).forEach(q=>items.push({ic:"user",cl:"var(--grn)",
      b:"নতুন ডোনার আবেদন",s:q.name+" · "+q.group,at:q.at,go:()=>{wTab="donor";go("work")}}));
    DB.messages.filter(m=>!m.read).forEach(m=>items.push({ic:"mail",cl:"var(--blu)",
      b:"নতুন বার্তা",s:m.name+" — "+m.text.slice(0,40),at:m.at,go:()=>go(CUR,"inbox")}));
    const low=GROUPS.filter(g=>bloodCounts()[g]<3);
    if(low.length)items.push({ic:"drop",cl:"var(--amb)",b:"রক্তের ঘাটতি",
      s:low.join(", ")+" গ্রুপে ৩ জনের কম প্রস্তুত",at:new Date().toISOString(),go:()=>go(CUR,"stats")});
    items.sort((a,b)=>new Date(b.at)-new Date(a.at));
  
    const s=sheet("বিজ্ঞপ্তি",items.length
      ? `<div class="card pad0" style="margin:0">${items.map((x,i)=>`<button class="row" data-n="${i}">
          <span class="ic" style="color:${x.cl}">${SI[x.ic](18)}</span>
          <span class="tx"><b>${esc(x.b)}</b><small>${esc(x.s)}</small></span>
          <span class="rt">${timeAgo(x.at)}</span></button>`).join("")}</div>`
      : `<div class="empty"><div class="ic">${SI.check(26)}</div><b>নতুন কিছু নেই</b>
         <p>সব কাজ শেষ — চমৎকার!</p></div>`,
      `<button class="btn gh w" data-close>বন্ধ</button>`);
    s.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{s.close();items[+b.dataset.n].go()});
  }
  
  /* ══════════ shared bits ══════════ */
  const QK={donor:{t:"ডোনার আবেদন",ic:"drop",cl:"g"},donation:{t:"রক্তদান যাচাই",ic:"checkC",cl:"b"},
    request:{t:"জরুরি আবেদন",ic:"warn",cl:"r"},group:{t:"গ্রুপ বদল",ic:"refresh",cl:"a"},
    report:{t:"রিপোর্ট",ic:"help",cl:"m"}};
  const ptitle=(t,s)=>`<h2 class="ptitle">${esc(t)}${s?`<small>${esc(s)}</small>`:""}</h2>`;
  const emptyBox=(ic,t,p,btn)=>`<div class="empty"><div class="ic">${SI[ic](26)}</div><b>${esc(t)}</b>
    ${p?`<p>${esc(p)}</p>`:""}${btn||""}</div>`;
  const noPerm=()=>`<div class="card">${emptyBox("lock","এই অংশে আপনার অনুমতি নেই","প্রয়োজন হলে সুপার অ্যাডমিনকে বলুন")}</div>`;
  const statusPill=s=>({searching:`<span class="pill b">ডোনার খোঁজা হচ্ছে</span>`,
    matched:`<span class="pill g">ডোনার পাওয়া গেছে</span>`,done:`<span class="pill m">সম্পন্ন</span>`}[s]||"");
  function bloodBars(){
    const c=bloodCounts(),max=Math.max(4,...Object.values(c));
    return `<div class="bars">${GROUPS.map(g=>{const v=c[g],low=v<3;
      return `<div class="bar"><span class="bl">${g}</span>
        <span class="bt"><i style="width:${Math.max(3,Math.round(v/max*100))}%;background:${low?"var(--red)":"var(--grn)"}"></i></span>
        <span class="bv ${low?"low":""}">${bn(v)}</span></div>`}).join("")}</div>`;
  }
  function toCSV(rows,headers){
    const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    return "\uFEFF"+[headers.map(q).join(","),...rows.map(r=>r.map(q).join(","))].join("\n");
  }
  function dlFile(name,text){
    const b=new Blob([text],{type:"text/csv"});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1500);
  }
  
  /* screen + sub-page registries — declared early so every later
     block can add to them regardless of file order */
  const RENDER={};
  const SUBP={};
  
  /* proper nouns must survive translation — register them once */
  (function(){
    if(typeof protectNames!=="function")return;
    protectNames([...FIRST,...LAST,...AREAS,...HOSPITALS]);
    protectNames(DB.donors.map(d=>d.name));
    protectNames(DB.team.map(t=>t.name));
    protectNames(DB.queue.map(q=>q.name||q.patient));
    protectNames(DB.live.map(r=>r.patient));
    protectNames(DB.messages.map(m=>m.name));
    protectNames([ME&&ME.name,ME&&ME.area,ME&&ME.designation]);
  })();
  
  /* ══════════════════════════════════════════════════════════════
     MY ACCOUNT — the admin's own account, exactly like a normal user's
     Admin and Moderator both get the full personal-settings system:
     profile, identity, security, privacy, notifications, preferences.
     Work permissions are separate and shown read-only here.
     ══════════════════════════════════════════════════════════════ */
  const ACC_LS="cbdc."+PANEL.id+".me";   /* each panel keeps its own profile */
  const defaultMe=()=>({
    uid:"",role:PANEL.role,
    name:"",username:"",email:"",emailVerified:false,
    phone:"",phoneVerified:false,
    gender:"",dob:"",area:"",address:"",
    photo:"",photoSource:"",
    designation:"",joined:"",
    bloodGroup:"",lastDonation:"",isDonor:true,
    security:{passwordChangedAt:"2026-06-02",loginAlert:true,twoFA:false},
    privacy:{showInTeam:true,showPhone:"team",showEmail:"team",showBlood:true},
    notif:{work:true,urgent:true,mentions:true,digest:true,newUser:true,quiet:false,sound:true},
    prefs:{theme:"light",lang:"bn",dense:false,anim:true,badge:true,startPage:"home"},
    sessions:[],
    activity:[]
  });
  function loadMe(){
    try{const d=JSON.parse(localStorage.getItem(ACC_LS)||"null");
      if(d&&d.uid)return Object.assign(defaultMe(),d,{
        security:Object.assign(defaultMe().security,d.security||{}),
        privacy:Object.assign(defaultMe().privacy,d.privacy||{}),
        notif:Object.assign(defaultMe().notif,d.notif||{}),
        prefs:Object.assign(defaultMe().prefs,d.prefs||{})})}catch(e){}
    return defaultMe();
  }
  function saveMe(){try{localStorage.setItem(ACC_LS,JSON.stringify(ME))}catch(e){}
    const t=DB.team.find(x=>x.uid===ME.uid);
    if(t){t.name=ME.name;t.role=ME.role;persist()}}
  function logMe(title,detail,type="account"){
    ME.activity.unshift({at:new Date().toISOString(),title,detail,type});
    if(ME.activity.length>60)ME.activity.length=60;saveMe();
  }
  /* replaces the plain object created in the data block */
  ME=Object.assign(loadMe(),{role:ME.role||PANEL.role});
  if(!ROLES[ME.role])ME.role=PANEL.role;
  
  /* ---------- small shared rows (same look as app.html) ---------- */
  const sRow=(t,v,act,flag)=>`<button class="row" data-act="${act}">
    <span class="tx"><b>${esc(t)}</b>${v?`<small>${esc(v)}</small>`:""}</span>
    <span class="rt">${flag==="ok"?`<span style="color:var(--grn)">${SI.checkC(15)}</span>`
      :flag==="lock"?SI.lock(14):""}${SI.right(17)}</span></button>`;
  const tgRow=(t,s2,path)=>{const v=path.split(".").reduce((o,k)=>o[k],ME);
    return `<div class="row"><span class="tx"><b>${esc(t)}</b>${s2?`<small>${esc(s2)}</small>`:""}</span>
    <button class="tg ${v?"on":""}" data-tgl="${path}" role="switch" aria-checked="${!!v}"></button></div>`};
  const rowLine=(t,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:.82rem">
    <span style="color:var(--mut)">${esc(t)}</span><b style="text-align:right">${esc(v||"—")}</b></div>`;
  
  /* ---------- account sub-pages ---------- */
  const ACC_PAGES=[
    {id:"account",title:"অ্যাকাউন্ট",desc:"নাম, ছবি, ইমেইল, মোবাইল",icon:"user"},
    {id:"security",title:"নিরাপত্তা",desc:"পাসওয়ার্ড, ডিভাইস, কার্যকলাপ",icon:"shield"},
    {id:"privacy",title:"গোপনীয়তা",desc:"কে কী দেখতে পাবে",icon:"eye"},
    {id:"mynotif",title:"বিজ্ঞপ্তি",desc:"কখন জানানো হবে",icon:"bellS"},
    {id:"prefs",title:"পছন্দ",desc:"থিম, প্রদর্শন, শুরুর পাতা",icon:"paint"},
    {id:"myperm",title:"আমার অনুমতি",desc:"এই প্যানেলে কী কী করতে পারবেন",icon:"lock"},
    {id:"manage",title:"অ্যাকাউন্ট ব্যবস্থাপনা",desc:"তথ্য নামান, অ্যাকাউন্ট মুছুন",icon:"warn"}
  ];
  ACC_PAGES.forEach(p=>SUBS[p.id]={title:p.title,perm:null});
  SUBS.devices={title:"লগইন ও ডিভাইস",perm:null};
  SUBS.myactivity={title:"আমার কার্যকলাপ",perm:null};
  
  /* ---------- profile header card, reused in a few places ---------- */
  function meHeader(){
    return `<button class="card" style="display:block;width:100%;text-align:left" data-sub="account">
      <div class="per lg"><img src="${AV(ME.gender,ME.photo)}" alt="">
        <div class="i"><b style="font-size:.95rem">${esc(ME.name)}</b>
          <small>@${esc(ME.username)} · ${ROLES[ME.role].label}</small>
          <small>${esc(ME.email)}</small></div>
        <span style="color:var(--mut)">${SI.right(19)}</span></div></button>`;
  }
  
  SUBP.account=el=>{
    el.innerHTML=`
      <div class="card" style="text-align:center">
        <img src="${AV(ME.gender,ME.photo)}" alt="প্রোফাইল ছবি"
          style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:11px">
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn gh sm" data-act="photo">${SI.cam(15)} ছবি বদলান</button>
          ${ME.photo?`<button class="btn gh sm" data-act="photoRm">সরান</button>`:""}</div>
        <p class="hint2" style="margin-top:9px">${ROLES[ME.role].icon} ${ROLES[ME.role].label}
          ${ME.designation?" · "+esc(ME.designation):""}</p>
      </div>
      <div class="sec-t">পরিচয়</div>
      <div class="card pad0">
        ${sRow("নাম",ME.name,"editName")}
        ${sRow("Username","@"+ME.username,"editUser")}
        ${sRow("ইমেইল",ME.email,"editMail",ME.emailVerified?"ok":"")}
        ${sRow("মোবাইল",ME.phone,"editPhone",ME.phoneVerified?"ok":"")}
      </div>
      <div class="sec-t">ব্যক্তিগত</div>
      <div class="card pad0">
        ${sRow("জন্মতারিখ",ME.dob?dL(ME.dob):"দেওয়া হয়নি","editDob")}
        ${sRow("লিঙ্গ",ME.gender,"editGender")}
        ${sRow("এলাকা",ME.area,"editArea")}
        ${sRow("ঠিকানা",ME.address||"দেওয়া হয়নি","editAddr")}
      </div>
      <div class="sec-t">সংগঠনে</div>
      <div class="card pad0">
        ${sRow("পদবি",ME.designation||"দেওয়া হয়নি","editDesig")}
        <div class="row"><span class="tx"><b>ভূমিকা</b><small>ডেটাবেজ থেকে নির্ধারিত হয়</small></span>
          <span class="rt"><span class="tag g">${ROLES[ME.role].label}</span></span></div>
        <div class="row"><span class="tx"><b>যুক্ত হয়েছেন</b><small>${dL(ME.joined)}</small></span></div>
      </div>
      <div class="sec-t">রক্তদাতা হিসেবে</div>
      <div class="card pad0">
        ${tgRow("আমিও একজন রক্তদাতা","রক্তদাতা তালিকায় আমার নামও থাকবে","isDonor")}
        ${ME.isDonor?sRow("রক্তের গ্রুপ",ME.bloodGroup,"editBlood"):""}
        ${ME.isDonor?sRow("সর্বশেষ রক্তদান",ME.lastDonation?dL(ME.lastDonation):"তথ্য নেই","editLastD"):""}
      </div>`;
    bindMe(el,"account");
  };
  
  SUBP.security=el=>{
    el.innerHTML=`
      <div class="card pad0">
        ${sRow("পাসওয়ার্ড","সর্বশেষ পরিবর্তন "+dL(ME.security.passwordChangedAt),"editPass")}
        ${sRow("পাসওয়ার্ড ভুলে গেছেন?","ইমেইল বা মোবাইলে OTP পাঠানো হবে","forgotPass")}
      </div>
      <div class="sec-t">লগইন সুরক্ষা</div>
      <div class="card pad0">
        <div class="row"><span class="ic">${SI.bellS(19)}</span>
          <span class="tx"><b>নতুন লগইন সতর্কতা</b><small>অচেনা ডিভাইসে লগইন হলে জানানো হবে</small></span>
          <button class="tg ${ME.security.loginAlert?"on":""}" data-tgl="security.loginAlert"></button></div>
        <button class="row" data-sub="devices"><span class="ic">${SI.device(19)}</span>
          <span class="tx"><b>লগইন ও ডিভাইস</b><small>${tp(bn(ME.sessions.length)+"টি সক্রিয় সেশন",ME.sessions.length+" active sessions")}</small></span>
          <span class="rt">${SI.right(17)}</span></button>
        <button class="row" data-sub="myactivity"><span class="ic">${SI.clock(19)}</span>
          <span class="tx"><b>আমার কার্যকলাপ</b><small>আমার অ্যাকাউন্টে কী কী বদলেছে</small></span>
          <span class="rt">${SI.right(17)}</span></button>
      </div>
      <div class="note w">${SI.warn(17)}<span>${tp("আপনার অ্যাকাউন্টে","Your account has")} <b>${tp(bn(myPerms().size)+"টি অনুমতি",myPerms().size+" permissions")}</b>${tp(" আছে","")} —
        পাসওয়ার্ড কারও সাথে ভাগ করবেন না।</span></div>`;
    bindMe(el,"security");
  };
  
  SUBP.devices=el=>{
    el.innerHTML=`<div class="note i" data-noi18n>${SI.info(17)}<span>${tp(
        "আপনার অ্যাকাউন্টে যেসব ডিভাইসে লগইন আছে তার তালিকা। অচেনা কিছু দেখলে সাথে সাথে বের করে দিন।",
        "Devices currently signed in to your account. If you see anything unfamiliar, sign it out immediately.")}</span></div>
      ${ME.sessions.map(s=>`<div class="card" style="padding:13px">
        <div style="display:flex;align-items:center;gap:11px">
          <span class="ic" style="width:38px;height:38px;border-radius:10px;
            background:${s.cur?"var(--grn-s)":"var(--card2)"};color:${s.cur?"var(--grn)":"var(--mut)"};
            display:grid;place-items:center">${SI.device(19)}</span>
          <div style="flex:1;min-width:0"><b style="font-size:.85rem;display:block">${esc(s.name)}</b>
            <small class="mut" style="font-size:.74rem">${esc(s.place)}</small></div>
          ${s.cur?`<span class="pill g">এই ডিভাইস</span>`
            :`<button class="btn gh sm" data-kick="${s.id}">বের করুন</button>`}</div>
        <p class="mut" style="margin-top:7px;font-size:.73rem">${esc(s.last)}</p></div>`).join("")}
      <button class="btn red w" data-act="logoutAll" style="margin-top:6px">${SI.logout(17)} সব ডিভাইস থেকে লগআউট</button>`;
    bindMe(el,"devices");
  };
  
  SUBP.myactivity=el=>{
    if(!ME.activity.length)return el.innerHTML=`<div class="card">
      ${emptyBox("clock","কোনো কার্যকলাপ নেই","আপনার অ্যাকাউন্টের পরিবর্তন এখানে দেখা যাবে")}</div>`;
    const groups={};
    ME.activity.forEach(x=>{const d=new Date(x.at),k=dayDiff(iso(d))===0?"আজ":dayDiff(iso(d))===1?"গতকাল":dL(iso(d));
      (groups[k]=groups[k]||[]).push(x)});
    el.innerHTML=Object.entries(groups).map(([k,list])=>`
      <div class="sec-t">${esc(k)}</div>
      <div class="card pad0">${list.map(x=>`<div class="row">
        <span class="ic" style="background:${x.type==="security"?"var(--blu-s)":x.type==="donor"?"var(--red-s)":"var(--card2)"};
          color:${x.type==="security"?"var(--blu)":x.type==="donor"?"var(--red)":"var(--mut)"}">
          ${x.type==="security"?SI.shield(18):x.type==="donor"?SI.drop(18):SI.user(18)}</span>
        <span class="tx"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span>
        <span class="rt">${new Date(x.at).toLocaleTimeString("bn-BD",{hour:"2-digit",minute:"2-digit"})}</span>
      </div>`).join("")}</div>`).join("");
  };
  
  SUBP.privacy=el=>{
    el.innerHTML=`<div class="note i" data-noi18n>${SI.info(17)}<span>${tp(
        "এই সেটিংস আপনার নিজের তথ্যের জন্য — টিমের অন্য সদস্য ও পাবলিক তালিকায় কী দেখা যাবে তা ঠিক করে।",
        "These settings cover your own details — they control what teammates and the public list can see.")}</span></div>
      <div class="sec-t">টিমে আমার প্রোফাইল</div>
      <div class="card pad0">
        ${tgRow("টিম তালিকায় আমাকে দেখান","বন্ধ করলে শুধু সুপার অ্যাডমিন দেখবেন","privacy.showInTeam")}
        ${ME.isDonor?tgRow("রক্তের গ্রুপ দেখান","","privacy.showBlood"):""}
      </div>
      <div class="sec-t">যোগাযোগ</div>
      <div class="card">
        <div class="f"><label>মোবাইল নম্বর কে দেখবে</label>
          <select data-pv="showPhone">
            <option value="all" ${ME.privacy.showPhone==="all"?"selected":""}>সবাই</option>
            <option value="team" ${ME.privacy.showPhone==="team"?"selected":""}>শুধু টিমের সদস্য</option>
            <option value="none" ${ME.privacy.showPhone==="none"?"selected":""}>কেউ না</option>
          </select></div>
        <div class="f"><label>ইমেইল কে দেখবে</label>
          <select data-pv="showEmail">
            <option value="all" ${ME.privacy.showEmail==="all"?"selected":""}>সবাই</option>
            <option value="team" ${ME.privacy.showEmail==="team"?"selected":""}>শুধু টিমের সদস্য</option>
            <option value="none" ${ME.privacy.showEmail==="none"?"selected":""}>কেউ না</option>
          </select></div>
      </div>
      <div class="note w" data-noi18n>${SI.warn(17)}<span>${tp(
        "অ্যাডমিন হিসেবে আপনি যা যা করেন তা <b>অডিট লগে থেকেই যায়</b> — এটি গোপনীয়তা সেটিংস দিয়ে বন্ধ করা যায় না।",
        "Everything you do as an admin <b>stays in the audit log</b> — privacy settings cannot switch that off.")}</span></div>`;
    bindMe(el,"privacy");
  };
  
  SUBP.mynotif=el=>{
    el.innerHTML=`<div class="sec-t">কাজের বিজ্ঞপ্তি</div>
      <div class="card pad0">
        ${tgRow("নতুন অপেক্ষমাণ কাজ","ডোনার আবেদন, রক্তদান যাচাই ইত্যাদি","notif.work")}
        ${tgRow("জরুরি রক্তের আবেদন","অতিজরুরি হলে সবসময় জানানো হবে","notif.urgent")}
        ${tgRow("নতুন ব্যবহারকারী","কেউ নিবন্ধন করলে","notif.newUser")}
        ${tgRow("আমাকে উল্লেখ করলে","টিমের কেউ কাজ দিলে","notif.mentions")}
      </div>
      <div class="sec-t">সারসংক্ষেপ</div>
      <div class="card pad0">
        ${tgRow("দৈনিক সারসংক্ষেপ","প্রতিদিন সকালে এক নজরে সব","notif.digest")}
      </div>
      <div class="sec-t">শব্দ ও সময়</div>
      <div class="card pad0">
        ${tgRow("বিজ্ঞপ্তির শব্দ","","notif.sound")}
        ${tgRow("রাতে বিরক্ত করবেন না","রাত ১০টা — সকাল ৭টা (অতিজরুরি ছাড়া)","notif.quiet")}
        <div class="row"><span class="ic">${SI.shield(19)}</span>
          <span class="tx"><b>নিরাপত্তা সতর্কতা</b><small>নিরাপত্তার জন্য বন্ধ করা যায় না</small></span>
          <button class="tg on" disabled aria-label="সবসময় চালু"></button></div>
      </div>`;
    bindMe(el,"mynotif");
  };
  
  SUBP.prefs=el=>{
    el.innerHTML=`
      <div class="sec-t">চেহারা</div>
      <div class="card">
        <div class="f"><label>থিম</label><div class="strip seg" id="pth">
          ${[["light","আলো"],["dark","আঁধার"]].map(([v,l])=>
            `<button data-th="${v}" class="${ME.prefs.theme===v?"on":""}">${l}</button>`).join("")}</div></div>
        <div class="f" style="margin-bottom:0"><label>প্রদর্শনের ঘনত্ব</label><div class="strip seg" id="pdn">
          <button data-dn="0" class="${!ME.prefs.dense?"on":""}">স্বাভাবিক</button>
          <button data-dn="1" class="${ME.prefs.dense?"on":""}">ঘন</button></div></div>
      </div>
      <div class="sec-t">ভাষা</div>
      <div class="card"><div class="strip seg" id="plg">
        <button data-lg="bn" class="${ME.prefs.lang==="bn"?"on":""}" data-noi18n>বাংলা</button>
        <button data-lg="en" class="${ME.prefs.lang==="en"?"on":""}" data-noi18n>English</button></div>
        <p class="hint2" style="margin-top:9px" data-noi18n>${tp(
          "ভাষা বদলালে পুরো প্যানেল সেই ভাষায় দেখা যাবে।",
          "Changing the language switches the entire panel.")}</p></div>
      <div class="sec-t">শুরুর পাতা</div>
      <div class="card">
        <div class="f" style="margin-bottom:0"><label>লগইনের পর কোন পাতা খুলবে</label>
          <select data-pv2="startPage">
            <option value="home" ${ME.prefs.startPage==="home"?"selected":""}>হোম</option>
            <option value="work" ${ME.prefs.startPage==="work"?"selected":""}>কাজ</option>
            <option value="people" ${ME.prefs.startPage==="people"?"selected":""}>মানুষ</option>
          </select></div>
      </div>
      <div class="sec-t">অন্যান্য</div>
      <div class="card pad0">
        ${tgRow("অ্যানিমেশন","চলমান প্রভাব চালু/বন্ধ","prefs.anim")}
        ${tgRow("বিজ্ঞপ্তির সংখ্যা দেখান","আইকনে লাল সংখ্যা","prefs.badge")}
      </div>`;
    bindMe(el,"prefs");
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>{
      ME.prefs.dense=b.dataset.dn==="1";saveMe();applyPrefs();paintTop();paintNav();renderSub("prefs")});
    el.querySelectorAll("[data-lg]").forEach(b=>b.onclick=()=>{
      if(ME.prefs.lang===b.dataset.lg)return;
      ME.prefs.lang=b.dataset.lg;saveMe();applyLang();
      toast(isEN()?"Language changed to English":"ভাষা বাংলা করা হয়েছে","ok")});
  };
  
  SUBP.myperm=el=>{
    const mine=myPerms();
    el.innerHTML=`<div class="card">
        <div class="per"><span class="bg2" style="width:46px;height:46px;border-radius:50%;
          background:var(--grn-s);color:var(--grn);font-size:1.1rem">${ROLES[ME.role].icon}</span>
          <div class="i"><b>${esc(ME.name)}</b><small>${ROLES[ME.role].label} · ${tp(bn(mine.size)+"টি অনুমতি",mine.size+" permissions")}</small></div></div>
        <p class="hint2" style="margin-top:10px" data-noi18n>${tp(
          "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না। কিছু দরকার হলে সুপার অ্যাডমিনকে বলুন।",
          "Your role is set from the database and cannot be changed by you. Ask a super admin if you need more access.")}</p></div>
      ${Object.entries(PERM_GROUPS).map(([g,ps])=>`
        <div class="sec-t">${esc(g)}</div>
        <div class="card pad0">${ps.map(p=>`<div class="row">
          <span class="ic" style="color:${mine.has(p)?"var(--grn)":"var(--mut)"}">
            ${mine.has(p)?SI.checkC(18):SI.lock(16)}</span>
          <span class="tx"><b>${PERM_LABEL[p]||p}</b><small>${p}</small></span>
          <span class="rt">${mine.has(p)?`<span class="pill g">আছে</span>`:`<span class="pill m">নেই</span>`}</span>
        </div>`).join("")}</div>`).join("")}`;
  };
  
  SUBP.manage=el=>{
    el.innerHTML=`<div class="sec-t">আমার তথ্য</div>
      <div class="card pad0">
        <button class="row" data-act="dlMe"><span class="ic">${SI.dl(19)}</span>
          <span class="tx"><b>আমার তথ্য নামান</b><small>প্রোফাইল ও কার্যকলাপ JSON ফাইলে</small></span>
          <span class="rt">${SI.right(17)}</span></button>
      </div>
      <div class="sec-t">বিপজ্জনক</div>
      <div class="card pad0">
        <button class="row" data-act="resetMe"><span class="ic" style="color:var(--red)">${SI.refresh(19)}</span>
          <span class="tx"><b>আমার সেটিংস রিসেট</b><small>প্রোফাইল ডিফল্ট অবস্থায় ফিরবে</small></span>
          <span class="rt">${SI.right(17)}</span></button>
      </div>
      <div class="sec-t" style="color:var(--red-d)">অ্যাকাউন্ট মুছে ফেলুন</div>
      <div class="card pad0" style="border-color:rgba(224,36,47,.3)">
        <button class="row" data-act="delMe"><span class="ic" style="background:var(--red-s);color:var(--red)">${SI.trash(19)}</span>
          <span class="tx"><b style="color:var(--red-d)">অ্যাকাউন্ট মুছে ফেলুন</b>
          <small style="white-space:normal">অনুরোধ করার পর ২৪ ঘণ্টার মধ্যে অ্যাকাউন্ট ও এর সাথে সম্পর্কিত সকল ডাটা মুছে যাবে</small></span>
          <span class="rt">${SI.right(17)}</span></button>
      </div>
      <div class="note w" data-noi18n>${SI.warn(17)}<span>${tp(
        "অ্যাডমিন অ্যাকাউন্ট নিজে থেকে মুছে ফেলা যায় না — শেষ সুপার অ্যাডমিন হারিয়ে গেলে পুরো সিস্টেম আটকে যাবে। সুপার অ্যাডমিনকে বলুন।",
        "An admin account cannot delete itself — losing the last super admin would lock the whole system. Ask a super admin.")}</span></div>`;
    bindMe(el,"manage");
  };
  
  /* ---------- one binder for every account page ---------- */
  function bindMe(el,page){
    el.querySelectorAll("[data-tgl]").forEach(b=>b.onclick=()=>{
      const p=b.dataset.tgl.split("."),o=p.slice(0,-1).reduce((x,k)=>x[k],ME),k=p[p.length-1];
      o[k]=!o[k];b.classList.toggle("on",o[k]);b.setAttribute("aria-checked",o[k]);
      saveMe();applyPrefs();
      /* anything that changes the shell must repaint it */
      if(p[0]==="prefs"){paintTop();paintNav()}
      toast(o[k]?"চালু করা হয়েছে":"বন্ধ করা হয়েছে",o[k]?"ok":"");
      if(k==="isDonor"||k==="dense"||k==="anim")renderSub(page);
    });
    el.querySelectorAll("[data-pv]").forEach(s=>s.onchange=()=>{
      ME.privacy[s.dataset.pv]=s.value;saveMe();toast("সংরক্ষিত","ok")});
    el.querySelectorAll("[data-pv2]").forEach(s=>s.onchange=()=>{
      ME.prefs[s.dataset.pv2]=s.value;saveMe();toast("সংরক্ষিত","ok")});
    el.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{
      ME.prefs.theme=b.dataset.th;saveMe();applyPrefs();renderSub(page)});
    el.querySelectorAll("[data-kick]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"এই ডিভাইস বের করবেন?",desc:"ওই ডিভাইসে আবার লগইন করতে হবে।",danger:true}))return;
      ME.sessions=ME.sessions.filter(x=>x.id!==b.dataset.kick);
      logMe("ডিভাইস বের করা হয়েছে","একটি সেশন বন্ধ","security");saveMe();renderSub("devices");
      toast("ডিভাইস বের করা হয়েছে","ok")});
    el.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>meAction(b.dataset.act,page));
  }
  function applyPrefs(){
    /* ডিফল্ট ও স্থায়ী Theme = Light; System (Dark/Light) auto-follow বন্ধ */
    const t=(ME.prefs.theme==="dark")?"dark":"light";
    document.documentElement.dataset.theme=t;
    localStorage.setItem("cbdc.admin.theme",ME.prefs.theme);
    document.body.dataset.dense=ME.prefs.dense?"1":"0";
    document.body.dataset.anim=ME.prefs.anim?"1":"0";
    document.documentElement.lang=ME.prefs.lang==="en"?"en":"bn";
    document.body.dataset.lang=ME.prefs.lang;
  }
  
  /* ---------- every account action ---------- */
  function meAction(a,page){
    const back=()=>{saveMe();renderSub(page);paintTop()};
    const askText=(title,label,val,ok,opts={})=>{
      const s=sheet(title,`<div class="f"><label>${esc(label)}</label>
        ${opts.type==="date"?`<input id="mi" type="date" value="${esc(val||"")}" max="${iso(now())}">`
          :opts.type==="select"?`<select id="mi">${opts.options.map(o=>
            `<option ${o===val?"selected":""}>${esc(o)}</option>`).join("")}</select>`
          :opts.type==="textarea"?`<textarea id="mi" rows="3">${esc(val||"")}</textarea>`
          :`<input id="mi" value="${esc(val||"")}" ${opts.max?`maxlength="${opts.max}"`:""}
             ${opts.mode?`inputmode="${opts.mode}"`:""} placeholder="${esc(opts.ph||"")}">`}
        </div>${opts.hint?`<p class="hint2" style="margin-top:8px">${esc(opts.hint)}</p>`:""}`,
        `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="mok">সংরক্ষণ</button>`);
      s.q("#mok").onclick=()=>{const v=s.q("#mi").value.trim();if(ok(v,s)!==false)s.close()};
      return s;
    };
    if(a==="editName")askText("নাম বদলান","পুরো নাম",ME.name,v=>{
      if(v.length<3){toast("নাম খুব ছোট","er");return false}
      ME.name=v;logMe("নাম পরিবর্তন",v);back();toast("নাম হালনাগাদ হয়েছে","ok")});
    if(a==="editUser")askText("Username বদলান","Username",ME.username,v=>{
      if(!/^[a-z0-9._]{3,20}$/.test(v)){toast("৩–২০ অক্ষর, ছোট হাতের ইংরেজি/সংখ্যা","er");return false}
      ME.username=v;logMe("Username পরিবর্তন","@"+v);back();toast("হালনাগাদ হয়েছে","ok")},
      {hint:"ছোট হাতের ইংরেজি অক্ষর, সংখ্যা, . ও _ ব্যবহার করা যাবে"});
    if(a==="editMail")askText("ইমেইল বদলান","ইমেইল",ME.email,v=>{
      if(!/^\S+@\S+\.\S+$/.test(v)){toast("সঠিক ইমেইল দিন","er");return false}
      ME.email=v;ME.emailVerified=false;logMe("ইমেইল পরিবর্তন",v,"security");back();
      toast("ইমেইল বদলেছে — যাচাই করতে হবে")},
      {hint:"নতুন ইমেইলে একটি যাচাই লিংক পাঠানো হবে।"});
    if(a==="editPhone")askText("মোবাইল বদলান","মোবাইল নম্বর",ME.phone,v=>{
      if(!phoneOK(v)){toast("সঠিক নম্বর দিন (০১…, ১১ সংখ্যা)","er");return false}
      ME.phone=v;ME.phoneVerified=false;logMe("মোবাইল পরিবর্তন",v,"security");back();
      toast("নম্বর হালনাগাদ হয়েছে","ok")},{max:11,mode:"numeric"});
    if(a==="editDob")askText("জন্মতারিখ","জন্মতারিখ",ME.dob,v=>{
      ME.dob=v;logMe("জন্মতারিখ হালনাগাদ",v?dL(v):"—");back();toast("সংরক্ষিত","ok")},{type:"date"});
    if(a==="editGender")askText("লিঙ্গ","লিঙ্গ",ME.gender,v=>{
      ME.gender=v;logMe("লিঙ্গ হালনাগাদ",v);back();toast("সংরক্ষিত","ok")},
      {type:"select",options:["পুরুষ","মহিলা"]});
    if(a==="editArea")askText("এলাকা","এলাকা",ME.area,v=>{
      ME.area=v;logMe("এলাকা হালনাগাদ",v);back();toast("সংরক্ষিত","ok")},
      {type:"select",options:AREAS});
    if(a==="editAddr")askText("ঠিকানা","সম্পূর্ণ ঠিকানা",ME.address,v=>{
      ME.address=v;logMe("ঠিকানা হালনাগাদ",v||"—");back();toast("সংরক্ষিত","ok")},
      {type:"textarea",hint:"পাবলিক তালিকায় সম্পূর্ণ ঠিকানা কখনো দেখানো হয় না।"});
    if(a==="editDesig")askText("পদবি","সংগঠনে আপনার পদবি",ME.designation,v=>{
      ME.designation=v;logMe("পদবি হালনাগাদ",v||"—");back();toast("সংরক্ষিত","ok")});
    if(a==="editBlood")askText("রক্তের গ্রুপ","রক্তের গ্রুপ",ME.bloodGroup,v=>{
      ME.bloodGroup=v;logMe("রক্তের গ্রুপ হালনাগাদ",v,"donor");back();toast("সংরক্ষিত","ok")},
      {type:"select",options:GROUPS});
    if(a==="editLastD")askText("সর্বশেষ রক্তদান","তারিখ",ME.lastDonation,v=>{
      ME.lastDonation=v;logMe("রক্তদানের তারিখ হালনাগাদ",v?dL(v):"—","donor");back();toast("সংরক্ষিত","ok")},
      {type:"date"});
  
    if(a==="editPass"){
      const s=sheet("পাসওয়ার্ড বদলান",`<div class="f">
        <label>বর্তমান পাসওয়ার্ড</label><input id="p0" type="password" placeholder="••••••••">
        <label>নতুন পাসওয়ার্ড</label><input id="p1" type="password" minlength="6" placeholder="কমপক্ষে ৬ অক্ষর">
        <label>আবার লিখুন</label><input id="p2" type="password" minlength="6"></div>
        <div id="pstr" class="pgb" style="margin-top:10px"><i></i></div>
        <p class="hint2" id="pmsg" style="margin-top:6px">বড় হাতের অক্ষর, সংখ্যা ও চিহ্ন মিশিয়ে দিন।</p>
        <button class="btn lnk" id="fgt" style="font-size:.8rem;padding:2px 0;margin-top:4px">পাসওয়ার্ড ভুলে গেছেন?</button>`,
        `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="pok">বদলান</button>`);
      s.q("#fgt").onclick=()=>{s.close();sheetForgot()};
      const bar=s.q("#pstr").firstElementChild,msg=s.q("#pmsg");
      s.q("#p1").oninput=e=>{const v=e.target.value;
        let sc=0;if(v.length>=6)sc++;if(/[A-Z]/.test(v))sc++;if(/\d/.test(v))sc++;if(/[^A-Za-z0-9]/.test(v))sc++;
        bar.style.width=(sc*25)+"%";
        bar.style.background=sc<2?"var(--red)":sc<4?"var(--amb)":"var(--grn)";
        msg.textContent=["খুব দুর্বল","দুর্বল","মোটামুটি","ভালো","শক্তিশালী"][sc]};
      s.q("#pok").onclick=async()=>{
        const p0=s.q("#p0").value,p1=s.q("#p1").value,p2=s.q("#p2").value;
        if(!p0)return toast("বর্তমান পাসওয়ার্ড দিন","er");
        if(p1.length<6)return toast("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর","er");
        if(p1!==p2)return toast("দুটি পাসওয়ার্ড মিলছে না","er");
        try{
          await panelChangePassword(p0,p1);
          ME.security.passwordChangedAt=iso(now());
          logMe("পাসওয়ার্ড পরিবর্তন","এই ডিভাইস থেকে","security");
          s.close();renderSub("security");toast("পাসওয়ার্ড বদলানো হয়েছে","ok");
        }catch(e){
          const code=e&&e.code||"";
          toast(code==="auth/wrong-password"||code==="auth/invalid-credential"?"বর্তমান পাসওয়ার্ড সঠিক নয়":code==="auth/configuration-not-found"?"Firebase Authentication সঠিকভাবে কনফিগার করা হয়নি।":(e&&e.message?e.message:"পাসওয়ার্ড পরিবর্তন করা যায়নি"),"er");
        }};
    }
    if(a==="photo"){
      const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
      inp.onchange=()=>{const f=inp.files[0];if(!f)return;
        if(f.size>5*1024*1024)return toast("ছবি ৫ MB-র কম হতে হবে","er");
        const r=new FileReader();
        r.onload=()=>{ME.photo=r.result;ME.photoSource="upload";
          logMe("প্রোফাইল ছবি বদলানো হয়েছে","");back();toast("ছবি হালনাগাদ হয়েছে","ok")};
        r.readAsDataURL(f)};
      inp.click();
    }
    if(a==="photoRm"){ME.photo="";ME.photoSource="";logMe("প্রোফাইল ছবি সরানো হয়েছে","");
      back();toast("ছবি সরানো হয়েছে")}
    if(a==="dlMe"){
      const data={profile:{name:ME.name,username:ME.username,email:ME.email,phone:ME.phone,
        gender:ME.gender,dob:ME.dob,area:ME.area,address:ME.address,designation:ME.designation,
        role:ROLES[ME.role].label,joined:ME.joined},
        privacy:ME.privacy,notif:ME.notif,prefs:ME.prefs,
        sessions:ME.sessions,activity:ME.activity};
      const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const u=URL.createObjectURL(b),el2=document.createElement("a");
      el2.href=u;el2.download=`cbdc-আমার-তথ্য-${iso(now())}.json`;el2.click();
      setTimeout(()=>URL.revokeObjectURL(u),1500);
      logMe("নিজের তথ্য নামানো হয়েছে","JSON");toast("ফাইল নামছে","ok");
    }
    if(a==="forgotPass")sheetForgot();
    if(a==="delMe")sheetDeleteMe();
    if(a==="pol_terms"||a==="pol_privacy"||a==="pol_donate")sheetPolicy(a);
    if(a==="logout")doLogout();
    if(a==="logoutAll")confirmS({title:"সব ডিভাইস থেকে লগআউট?",
      desc:"এই ডিভাইস ছাড়া বাকি সব সেশন বন্ধ হবে।",danger:true}).then(y=>{
      if(!y)return;ME.sessions=ME.sessions.filter(s=>s.cur);
      logMe("সব ডিভাইস থেকে লগআউট","","security");saveMe();
      renderSub(page==="devices"?"devices":page);toast("বাকি সব সেশন বন্ধ হয়েছে","ok")});
    if(a==="resetMe")confirmS({title:"আমার সেটিংস রিসেট?",
      desc:"নাম, ছবি, গোপনীয়তা ও পছন্দ ডিফল্ট অবস্থায় ফিরবে। কাজের ডেটা মুছবে না।",danger:true}).then(y=>{
      if(!y)return;const role=ME.role;ME=defaultMe();ME.role=role;saveMe();applyPrefs();
      go("set");toast("রিসেট হয়েছে","ok")});
  }
  
  /* ---------- policies (full text, shared with the donor app) ---------- */
  /* built per call so tp() picks up the current language */
  const POLICY=()=>({
    pol_terms:{title:"ব্যবহারের শর্তাবলী",updated:tp("১ আগস্ট ২০২৬","1 August 2026"),
      intro:tp("চকবাজার ব্লাড ডোনার\u0027স ক্লাবের অ্যাপ ও ওয়েবসাইট ব্যবহার করার আগে এই শর্তগুলো পড়ে নিন। অ্যাকাউন্ট খোলা বা অ্যাপ ব্যবহার করার অর্থ আপনি এই শর্তগুলো মেনে নিয়েছেন।","Please read these terms before using the Chakbazar Blood Donor's Club app and website. Creating an account or using the app means you accept these terms."),
      sec:[
        [tp("সেবার উদ্দেশ্য","Purpose of the service"),tp("এই অ্যাপ স্বেচ্ছায় রক্তদাতা ও রক্তের প্রয়োজন আছে এমন মানুষের মধ্যে যোগাযোগ তৈরি করে। ক্লাব কোনো হাসপাতাল, ব্লাড ব্যাংক বা চিকিৎসাসেবা প্রতিষ্ঠান নয় এবং রক্ত সংগ্রহ, সংরক্ষণ বা বিক্রি করে না।","This app connects voluntary blood donors with people who need blood. The club is not a hospital, blood bank or medical provider, and does not collect, store or sell blood.")],
        [tp("অ্যাকাউন্ট","Your account"),tp("একজন ব্যক্তি একটি অ্যাকাউন্ট খুলতে পারবেন। দেওয়া সব তথ্য সত্য ও হালনাগাদ হতে হবে। অ্যাকাউন্টের নিরাপত্তা ও পাসওয়ার্ড গোপন রাখার দায়িত্ব আপনার। অন্যের নামে বা ভুয়া তথ্য দিয়ে অ্যাকাউন্ট খোলা যাবে না।","One person may hold one account. All information you give must be true and up to date. Keeping your password safe is your responsibility. Accounts using someone else's identity or false information are not allowed.")],
        [tp("বয়স ও যোগ্যতা","Age and eligibility"),tp("রক্তদাতা হিসেবে যুক্ত হতে হলে বয়স কমপক্ষে ১৮ বছর হতে হবে এবং রক্তদানের শারীরিক যোগ্যতা থাকতে হবে। ভুল তথ্য দিয়ে তালিকাভুক্ত হলে অ্যাকাউন্ট স্থগিত করা হবে।","To join as a donor you must be at least 18 years old and physically fit to donate. Accounts listed with false information will be suspended.")],
        [tp("রক্ত বেচাকেনা নিষিদ্ধ","Selling blood is forbidden"),tp("রক্তদান সম্পূর্ণ স্বেচ্ছায় ও বিনামূল্যে। রক্তের বিনিময়ে টাকা বা কোনো সুবিধা চাওয়া বা দেওয়া কঠোরভাবে নিষিদ্ধ এবং আইনত দণ্ডনীয়। এমন অভিযোগ প্রমাণিত হলে অ্যাকাউন্ট স্থায়ীভাবে বাতিল হবে।","Blood donation is entirely voluntary and free. Asking for or offering money or any benefit in exchange for blood is strictly forbidden and punishable by law. A proven complaint results in permanent account cancellation.")],
        [tp("আচরণবিধি","Code of conduct"),tp("অন্য ব্যবহারকারীর সাথে সম্মানজনক আচরণ করুন। হয়রানি, হুমকি, অশালীন বার্তা, অপ্রয়োজনীয় ফোন বা যোগাযোগের তথ্য অন্যত্র ছড়িয়ে দেওয়া নিষিদ্ধ। রক্তদাতার নম্বর শুধু রক্তসংক্রান্ত প্রয়োজনেই ব্যবহার করা যাবে।","Treat other users with respect. Harassment, threats, indecent messages, unnecessary calls and sharing someone's contact details elsewhere are forbidden. A donor's number may only be used for blood-related needs.")],
        [tp("ভুল বা অপব্যবহার","Misuse"),tp("মিথ্যা জরুরি আবেদন, ভুয়া রক্তদানের রেকর্ড বা অন্যের ছবি-তথ্য ব্যবহার করা যাবে না। ক্লাব যেকোনো সময় যাচাই চাইতে পারে এবং প্রয়োজনে অ্যাকাউন্ট স্থগিত বা বাতিল করতে পারে।","False emergency requests, fake donation records and using another person's photo or information are not allowed. The club may ask for verification at any time and may suspend or cancel an account when needed.")],
        [tp("দায়সীমা","Limits of liability"),tp("ক্লাব রক্তদাতা ও গ্রহীতার মধ্যে শুধু যোগাযোগের সুযোগ করে দেয়। রক্তদানের সিদ্ধান্ত, শারীরিক পরীক্ষা, ক্রসম্যাচিং ও চিকিৎসা সংক্রান্ত সব দায়িত্ব সংশ্লিষ্ট হাসপাতাল ও ব্যক্তির। এ থেকে উদ্ভূত কোনো ক্ষতির জন্য ক্লাব দায়ী থাকবে না।","The club only creates the opportunity for donor and recipient to contact each other. The decision to donate, physical screening, cross-matching and all medical matters are the responsibility of the hospital and the individuals involved. The club is not liable for any resulting harm.")],
        [tp("শর্ত পরিবর্তন","Changes to these terms"),tp("প্রয়োজনে এই শর্তাবলী হালনাগাদ করা হতে পারে। বড় পরিবর্তন হলে অ্যাপে বিজ্ঞপ্তির মাধ্যমে জানানো হবে।","These terms may be updated when necessary. Significant changes will be announced through an in-app notification.")],
        [tp("যোগাযোগ","Contact"),tp(`শর্তাবলী নিয়ে কোনো প্রশ্ন থাকলে হেল্পলাইন ${bn(SITE.phone)} নম্বরে যোগাযোগ করুন।`,`If you have questions about these terms, call the helpline on ${SITE.phone}.`)]]},
  
    pol_privacy:{title:"গোপনীয়তা নীতি",updated:tp("১ আগস্ট ২০২৬","1 August 2026"),
      intro:tp("আপনার তথ্য আমাদের কাছে গুরুত্বপূর্ণ। কী তথ্য নেওয়া হয়, কেন নেওয়া হয় এবং কে দেখতে পায় — এই নীতিতে তা পরিষ্কারভাবে বলা আছে।","Your information matters to us. This policy explains clearly what is collected, why it is collected and who can see it."),
      sec:[
        [tp("কী তথ্য সংগ্রহ করা হয়","What we collect"),tp("অ্যাকাউন্টের জন্য: নাম, ইউজারনেম, ইমেইল, মোবাইল নম্বর, জন্মতারিখ, লিঙ্গ ও এলাকা। রক্তদাতা হলে অতিরিক্ত: রক্তের গ্রুপ, ওজন, সর্বশেষ রক্তদানের তারিখ ও স্বাস্থ্য সংক্রান্ত সংক্ষিপ্ত তথ্য।","For your account: name, username, email, mobile number, date of birth, gender and area. If you are a donor, additionally: blood group, weight, last donation date and brief health information.")],
        [tp("কেন সংগ্রহ করা হয়","Why we collect it"),tp("জরুরি প্রয়োজনে সঠিক গ্রুপের রক্তদাতা খুঁজে বের করা, রক্তদানের হিসাব রাখা, বিশ্রামের সময় গণনা করা এবং আপনাকে প্রয়োজনীয় বিজ্ঞপ্তি পাঠানোর জন্য।","To find the right blood group quickly in an emergency, to keep a record of donations, to count your rest period, and to send you the notifications you need.")],
        [tp("পাবলিক তালিকায় কী দেখা যায়","What the public list shows"),tp("আপনার নাম, রক্তের গ্রুপ ও এলাকা দেখা যায়। সম্পূর্ণ ঠিকানা, জন্মতারিখ, ইমেইল ও স্বাস্থ্য তথ্য কখনো প্রকাশ করা হয় না। মোবাইল নম্বর দেখা যাবে কি না তা আপনি গোপনীয়তা সেটিংস থেকে নিজে ঠিক করতে পারবেন।","Your name, blood group and area are visible. Your full address, date of birth, email and health information are never made public. Whether your mobile number is visible is your own choice in privacy settings.")],
        [tp("আপনার নিয়ন্ত্রণ","Your control"),tp("যেকোনো সময় প্রোফাইল লুকাতে পারবেন, প্রাপ্যতা বন্ধ রাখতে পারবেন, তথ্য সম্পাদনা করতে পারবেন, সব তথ্য JSON বা CSV ফাইলে নামাতে পারবেন এবং অ্যাকাউন্ট মুছে ফেলতে পারবেন।","At any time you can hide your profile, turn off availability, edit your information, download everything as a JSON or CSV file, and delete your account.")],
        [tp("তথ্য কার সাথে ভাগ করা হয়","Who we share with"),tp("আপনার তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি বা ভাড়া দেওয়া হয় না। শুধু ক্লাবের অনুমোদিত স্বেচ্ছাসেবক ও অ্যাডমিনরা প্রয়োজনের সময় তথ্য দেখতে পান, এবং প্রতিটি দেখা কার্যকলাপ লগে রাখা হয়।","Your information is never sold or rented to any third party. Only authorised club volunteers and admins can see it when needed, and every such view is written to the activity log.")],
        [tp("তথ্য সংরক্ষণ","How long we keep it"),tp("অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত তথ্য সংরক্ষিত থাকে। অ্যাকাউন্ট মুছে ফেলার অনুরোধ করলে ২৪ ঘণ্টার মধ্যে সব ব্যক্তিগত তথ্য মুছে যায়। শুধু নামবিহীন রক্তদানের পরিসংখ্যান থেকে যায়, কারণ তা অন্য রোগীর চিকিৎসার রেকর্ডের সাথে যুক্ত।","Information is kept while the account is active. If you request deletion, all personal information is removed within 24 hours. Only anonymous donation statistics remain, because they are tied to other patients' treatment records.")],
        [tp("নিরাপত্তা","Security"),tp("পাসওয়ার্ড এনক্রিপ্ট করে রাখা হয়। অচেনা ডিভাইসে লগইন হলে আপনাকে জানানো হয় এবং যেকোনো ডিভাইস থেকে দূর থেকে লগআউট করতে পারবেন।","Passwords are stored encrypted. You are alerted when a login happens on an unknown device, and you can sign out of any device remotely.")],
        [tp("শিশুদের তথ্য","Children"),tp("১৮ বছরের কম বয়সীদের জন্য এই সেবা নয় এবং আমরা জেনেশুনে তাদের তথ্য সংগ্রহ করি না।","This service is not for anyone under 18, and we do not knowingly collect their information.")],
        [tp("যোগাযোগ","Contact"),tp(`গোপনীয়তা নিয়ে কোনো প্রশ্ন বা অনুরোধ থাকলে হেল্পলাইন ${bn(SITE.phone)} নম্বরে জানান।`,`For any privacy question or request, call the helpline on ${SITE.phone}.`)]]},
  
    pol_donate:{title:"রক্তদান নির্দেশিকা",updated:tp("১ আগস্ট ২০২৬","1 August 2026"),
      intro:tp("নিরাপদ রক্তদানের জন্য নিচের নির্দেশনাগুলো মেনে চলুন। এগুলো সাধারণ পরামর্শ — চূড়ান্ত সিদ্ধান্ত সবসময় হাসপাতালের চিকিৎসকের।","Follow the guidance below for safe donation. These are general suggestions — the final decision always rests with the doctor at the hospital."),
      sec:[
        [tp("কারা রক্ত দিতে পারবেন","Who can donate"),tp("বয়স ১৮ থেকে ৬০ বছর · ওজন কমপক্ষে ৫০ কেজি · হিমোগ্লোবিন কমপক্ষে ১২.৫ গ্রাম/ডেসিলিটার · সাধারণভাবে সুস্থ শরীর ও স্বাভাবিক রক্তচাপ।","Age 18 to 60 · Weight at least 50 kg · Haemoglobin at least 12.5 g/dL · Generally good health and normal blood pressure.")],
        [tp("কারা দিতে পারবেন না","Who cannot donate"),tp("হেপাটাইটিস বি বা সি, এইচআইভি বা অন্য রক্তবাহিত রোগ থাকলে · হৃদরোগ, ক্যান্সার বা অনিয়ন্ত্রিত ডায়াবেটিস থাকলে · গর্ভবতী বা সন্তান জন্মের ছয় মাসের মধ্যে · সাম্প্রতিক বড় অস্ত্রোপচার বা রক্ত গ্রহণের ইতিহাস থাকলে।","People with hepatitis B or C, HIV or another blood-borne disease · People with heart disease, cancer or uncontrolled diabetes · Anyone pregnant or within six months of childbirth · Anyone with recent major surgery or a history of receiving blood.")],
        [tp("কতদিন পর পর","How often"),tp("পুরুষরা ৩ মাস (৯০ দিন) পর পর এবং নারীরা ৪ মাস পর পর রক্ত দিতে পারেন। অ্যাপে আপনার পরবর্তী রক্তদানের তারিখের কাউন্টডাউন দেখানো হয়।","Men can donate every 3 months (90 days) and women every 4 months. The app shows a countdown to your next donation date.")],
        [tp("রক্তদানের আগে","Before donating"),tp("আগের রাতে অন্তত ৭ ঘণ্টা ঘুমান · খালি পেটে রক্ত দেবেন না, হালকা খাবার খেয়ে যান · প্রচুর পানি পান করুন · রক্তদানের ২৪ ঘণ্টা আগে থেকে ধূমপান ও মদ্যপান এড়িয়ে চলুন · জাতীয় পরিচয়পত্র সাথে নিন।","Sleep at least 7 hours the night before · Never donate on an empty stomach, eat a light meal first · Drink plenty of water · Avoid smoking and alcohol for 24 hours beforehand · Bring your national ID card.")],
        [tp("রক্তদানের সময়","During donation"),tp("পুরো প্রক্রিয়ায় ৮ থেকে ১০ মিনিট সময় লাগে এবং ৩৫০ থেকে ৪৫০ মিলিলিটার রক্ত নেওয়া হয়। প্রতিবার নতুন ও জীবাণুমুক্ত সুচ ব্যবহার করা হয়, তাই সংক্রমণের কোনো ঝুঁকি নেই। শরীর ২৪ থেকে ৪৮ ঘণ্টার মধ্যে রক্তের তরল অংশ পূরণ করে নেয়।","The whole process takes 8 to 10 minutes and 350 to 450 millilitres of blood is taken. A fresh sterile needle is used every time, so there is no risk of infection. Your body replaces the fluid within 24 to 48 hours.")],
        [tp("রক্তদানের পর","After donating"),tp("১০ থেকে ১৫ মিনিট শুয়ে বা বসে বিশ্রাম নিন · পানি, শরবত বা ফলের রস পান করুন · হাতের ব্যান্ডেজ ৪ ঘণ্টা রাখুন · ওই দিন ভারী কাজ, ব্যায়াম বা দীর্ঘ ভ্রমণ এড়িয়ে চলুন · মাথা ঘোরালে সাথে সাথে শুয়ে পড়ুন ও পা উঁচু করে রাখুন।","Rest lying down or seated for 10 to 15 minutes · Drink water, sherbet or fruit juice · Keep the bandage on for 4 hours · Avoid heavy work, exercise and long journeys that day · If you feel dizzy, lie down at once and raise your legs.")],
        [tp("রক্তদানের উপকারিতা","Benefits of donating"),tp("প্রতিবার রক্তদানে তিনজন পর্যন্ত মানুষের জীবন বাঁচতে পারে। নিয়মিত রক্তদানে শরীরে নতুন রক্তকণিকা তৈরি হয় এবং প্রতিবার রক্তদানের আগে বিনামূল্যে কয়েকটি স্বাস্থ্য পরীক্ষা হয়ে যায়।","Each donation can save up to three lives. Regular donation helps your body make fresh blood cells, and you get a few free health checks before every donation.")],
        [tp("জরুরি সতর্কতা","Important warning"),tp("রক্ত কখনো টাকার বিনিময়ে দেবেন না বা নেবেন না। অচেনা কেউ হাসপাতালের বাইরে দেখা করতে বললে সতর্ক থাকুন — রক্তদান সবসময় স্বীকৃত হাসপাতাল বা ব্লাড ব্যাংকে করুন।","Never give or take blood in exchange for money. Be careful if a stranger asks to meet outside a hospital — always donate at a recognised hospital or blood bank.")]]}
  });
  function sheetPolicy(key){
    const d=POLICY()[key]; if(!d)return;
    const s=sheet(d.title,`
      <div data-noi18n>
      <p class="mut" style="font-size:.75rem;margin:-2px 0 12px">${tp("সর্বশেষ হালনাগাদ:","Last updated:")} ${esc(d.updated)}</p>
      <p style="font-size:.85rem;line-height:1.75;margin-bottom:4px">${esc(d.intro)}</p>
      ${d.sec.map((x,i)=>`<div style="margin-top:15px">
        <b style="display:block;font-size:.87rem;margin-bottom:5px">${isEN()?(i+1)+".":bn(i+1)+"."} ${esc(x[0])}</b>
        <p class="mut" style="font-size:.82rem;line-height:1.8;margin:0">${esc(x[1])}</p></div>`).join("")}
      </div>
      <p class="mut" style="font-size:.74rem;margin-top:18px;padding-top:12px;border-top:1px solid var(--line)">
        ${SITE.name} · হেল্পলাইন ${bn(SITE.phone)}</p>`,
      `<button class="btn" data-close style="flex:1">বুঝেছি</button>`);
    return s;
  }
  
  
  /* ---------- forgot password (OTP verification) ---------- */
  /* Firebase Authentication — change password (re-auth + updatePassword) */
  async function panelChangePassword(currentPassword,newPassword){
    const shared=initSharedFirebase();
    const {EmailAuthProvider, reauthenticateWithCredential, updatePassword}=await import("firebase/auth");
    const user=shared.auth && shared.auth.currentUser;
    if(!user)throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
    const email=user.email||ME.email;
    if(!email)throw new Error("এই অ্যাকাউন্টে ইমেইল নেই।");
    const cred=EmailAuthProvider.credential(email,currentPassword);
    await reauthenticateWithCredential(user,cred);
    await updatePassword(user,newPassword);
  }
  function sheetForgot(){
    const s=sheet("পাসওয়ার্ড ভুলে গেছেন?","",`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="fo_send">রিসেট লিংক পাঠান</button>`);
    const bd=s.q(".bd"),ft=s.q(".ft");
    const start=()=>{
      bd.innerHTML=`<div class="note i">${SI.info(17)}<span>Firebase Authentication থেকে একটি <b>পাসওয়ার্ড রিসেট লিংক</b> ইমেইলে পাঠানো হবে।</span></div>
        <div class="f"><label>ইমেইল</label>
          <input id="fo_rec" value="${esc(ME.email||"")}" placeholder="you@example.com"></div>`;
      ft.innerHTML=`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="fo_send">রিসেট লিংক পাঠান</button>`;
      s.q("#fo_send").onclick=send;
    };
    const send=async()=>{
      const recipient=s.q("#fo_rec").value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient))return toast("সঠিক ইমেইল দিন","er");
      const btn=s.q("#fo_send");btn.disabled=true;btn.textContent="পাঠানো হচ্ছে…";
      try{
        const shared=initSharedFirebase();
        const {sendPasswordResetEmail}=await import("firebase/auth");
        await sendPasswordResetEmail(shared.auth, recipient);
        bd.innerHTML=`<div class="note g">${SI.check(17)}<span>${esc(recipient)} ঠিকানায় রিসেট লিংক পাঠানো হয়েছে। ইমেইল খুলে নতুন পাসওয়ার্ড সেট করুন।</span></div>`;
        ft.innerHTML=`<button class="btn" data-close>বন্ধ করুন</button>`;
      }catch(e){btn.disabled=false;btn.textContent="রিসেট লিংক পাঠান";toast(authErrorMessage(e,{fallback:"রিসেট লিংক পাঠানো যায়নি"}),"er")}
    };
    start();
  }
  /* ---------- delete my own admin account ----------
     A staff account is never deleted silently: the last super admin must stay,
     and every request is written to the audit trail for the rest of the team. */
  function sheetDeleteMe(){
    const supers=DB.accounts?DB.accounts.filter(a=>a.role==="super").length:1;
    const lastSuper=ME.role==="super"&&supers<=1;
    const s=sheet("অ্যাকাউন্ট মুছে ফেলুন",
      lastSuper
      ? `<div class="note r">${SI.warn(17)}<span>আপনিই <b>একমাত্র সুপার অ্যাডমিন</b>।
          আপনার অ্যাকাউন্ট মুছে ফেললে পুরো সিস্টেম নিয়ন্ত্রণহীন হয়ে যাবে।
          আগে অন্য কাউকে সুপার অ্যাডমিন করুন, তারপর মুছুন।</span></div>`
      : `<div class="note r">${SI.warn(17)}<span>অনুরোধ করার পর <b>২৪ ঘণ্টার মধ্যে</b> অ্যাকাউন্ট এবং
          অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা মুছে যাবে। এটি ফেরানো যাবে না।</span></div>
        <b style="display:block;margin:14px 0 6px;font-size:.86rem">যা মুছে যাবে</b>
        <p class="mut" style="font-size:.81rem;margin-bottom:12px">আপনার প্রোফাইল ও ব্যক্তিগত তথ্য ·
          লগইন ও ডিভাইসের তালিকা · আপনার ব্যক্তিগত পছন্দ ও বিজ্ঞপ্তির সেটিংস</p>
        <b style="display:block;margin-bottom:6px;font-size:.86rem">যা থাকবে</b>
        <p class="mut" style="font-size:.81rem;margin-bottom:14px">আপনার করা অনুমোদন ও অডিট লগ (নাম ছাড়া) —
          কারণ এগুলো ক্লাবের কাজের রেকর্ডের অংশ</p>
        <div class="f"><label>নিশ্চিত করতে <b style="color:var(--red)">মুছে ফেলুন</b> লিখুন</label>
          <input id="dmt" placeholder="মুছে ফেলুন" autocapitalize="off"></div>`,
      lastSuper
      ? `<button class="btn" data-close style="flex:1">বুঝেছি</button>`
      : `<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="dmok">অনুরোধ পাঠান</button>`);
    if(lastSuper)return;
    s.q("#dmok").onclick=()=>{
      if(s.q("#dmt").value.trim()!=="মুছে ফেলুন")return toast('হুবহু "মুছে ফেলুন" লিখুন',"er");
      logMe("অ্যাকাউন্ট মুছে ফেলার অনুরোধ","২৪ ঘণ্টার মধ্যে কার্যকর","security");
      if(typeof logAudit==="function")logAudit("অ্যাকাউন্ট মুছে ফেলার অনুরোধ",ME.name+" নিজের অ্যাকাউন্ট মুছতে চেয়েছেন");
      s.q(".bd").innerHTML=`<div style="text-align:center;padding:8px 0">
        <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:var(--card2);
          color:var(--mut);display:grid;place-items:center">${SI.clock(26)}</div>
        <b style="display:block;margin-bottom:6px">অনুরোধ গ্রহণ করা হয়েছে</b>
        <p class="mut" style="font-size:.83rem">২৪ ঘণ্টার মধ্যে আপনার অ্যাকাউন্ট এবং এর সাথে সম্পর্কিত
          সকল ডাটা মুছে ফেলা হবে। বাকি টিমকে জানিয়ে দেওয়া হয়েছে।</p></div>`;
      s.q(".ft").innerHTML=`<button class="btn" data-close style="flex:1">বন্ধ করুন</button>`;
      toast("অনুরোধ পাঠানো হয়েছে","ok");
    };
  }
  
  /* readable labels for permission strings */
  const PERM_LABEL={
    "donor.view":"রক্তদাতা দেখা","donor.edit":"রক্তদাতার তথ্য সম্পাদনা","donor.approve":"ডোনার আবেদন অনুমোদন",
    "donation.verify":"রক্তদান যাচাই","contact.reveal":"ফোন নম্বর দেখা",
    "request.view":"আবেদন দেখা","request.approve":"আবেদন অনুমোদন","request.resolve":"আবেদন সম্পন্ন/বাতিল",
    "user.view":"ব্যবহারকারী দেখা","user.suspend":"অ্যাকাউন্ট স্থগিত","group.approve":"গ্রুপ বদল অনুমোদন",
    "report.resolve":"অভিযোগ নিষ্পত্তি","website.view":"ওয়েবসাইট দেখা","website.edit":"ওয়েবসাইট সম্পাদনা",
    "gallery.manage":"গ্যালারি ব্যবস্থাপনা","notice.manage":"নোটিশ ব্যবস্থাপনা",
    "team.view":"টিম দেখা","team.manage":"ভূমিকা বদল","settings.manage":"সেটিংস বদল",
    "audit.view":"অডিট লগ দেখা","data.export":"তথ্য রপ্তানি"
  };
  
  /* ══════════════════ SCREEN 1: HOME ══════════════════ */
  RENDER.home=()=>{
    const el=$("#s-home");
    const hr=new Date().getHours();
    const greet=tp(hr<12?"শুভ সকাল":hr<17?"শুভ দুপুর":hr<20?"শুভ সন্ধ্যা":"শুভ রাত্রি",
      hr<12?"Good morning":hr<17?"Good afternoon":hr<20?"Good evening":"Good night");
    const c=bloodCounts(),ready=DB.donors.filter(readyOf).length;
    const low=GROUPS.filter(g=>c[g]<3);
  
    const alerts=[];
    if(qCount("request"))alerts.push({cl:"var(--red)",ic:"warn",b:tp(`${bn(qCount("request"))}টি জরুরি আবেদন অপেক্ষমাণ`,`${qCount("request")} emergency requests waiting`),
      s:"রোগীর জীবন জড়িত — আগে দেখুন",fn:()=>{wTab="request";go("work")}});
    if(low.length)alerts.push({cl:"var(--amb)",ic:"drop",b:tp(`${low.join(", ")} গ্রুপে ডোনার কম`,`${low.join(", ")} running low on donors`),
      s:"৩ জনের কম প্রস্তুত ডোনার আছে",fn:()=>go("home","stats")});
    if(qCount("donor"))alerts.push({cl:"var(--grn)",ic:"user",b:tp(`${bn(qCount("donor"))}টি নতুন ডোনার আবেদন`,`${qCount("donor")} new donor applications`),
      s:"যাচাই করে অনুমোদন দিন",fn:()=>{wTab="donor";go("work")}});
    if(unread())alerts.push({cl:"var(--blu)",ic:"mail",b:tp(`${bn(unread())}টি নতুন বার্তা`,`${unread()} new messages`),
      s:"ওয়েবসাইটের যোগাযোগ ফর্ম থেকে",fn:()=>go("home","inbox")});
  
    const week=[...Array(7)].map((_,i)=>{const d=addD(new Date(),i-6);
      return {d,v:DB.donors.filter(x=>x.last===d).length+ri(0,3)}});
    const wMax=Math.max(3,...week.map(w=>w.v));
  
    el.innerHTML=ptitle(greet+", "+ME.name.split(" ")[0],
      tp(`${ROLES[ME.role].label} · আজ ${dL(iso(now()))}`,`${ROLES[ME.role].label} · today, ${dL(iso(now()))}`))
  
    +`<div class="astat">
        <button class="g" data-sub="donors"><b>${bn(DB.donors.length)}</b><span>মোট রক্তদাতা</span></button>
        <button class="r" data-sub="donors"><b>${bn(ready)}</b><span>এখন প্রস্তুত</span></button>
        <button class="a" data-goto="work"><b>${bn(DB.queue.length)}</b><span>অপেক্ষমাণ কাজ</span></button>
        <button class="b" data-sub="live"><b>${bn(DB.live.length)}</b><span>চলমান আবেদন</span></button>
      </div>`
  
    +(alerts.length?`<div class="sec-t">যা এখনই দেখা দরকার</div>
      <div class="card pad0">${alerts.map((a,i)=>`<button class="row" data-al="${i}">
        <span class="ic" style="color:${a.cl}">${SI[a.ic](18)}</span>
        <span class="tx"><b>${a.b}</b><small>${esc(a.s)}</small></span>
        <span class="rt">${SI.right(16)}</span></button>`).join("")}</div>`
     :`<div class="card">${emptyBox("check","সব ঠিক আছে","এই মুহূর্তে জরুরি কোনো কাজ নেই")}</div>`)
  
    +`<div class="sec-t">দ্রুত কাজ</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="btn sm" data-goto="work">${SI.bolt(15)} কাজ শুরু করুন</button>
        <button class="btn gh sm" data-sub="search">${SI.search(15)} খুঁজুন</button>
        <button class="btn gh sm" data-sub="site">${SI.globe(15)} ওয়েবসাইট</button>
        <button class="btn gh sm" data-sub="notice">${SI.bell(15)} নোটিশ দিন</button>
      </div>`
  
    +`<div class="sec-t">রক্তের ভাণ্ডার</div>
      <div class="card"><p class="hint2" style="margin-bottom:11px">বিশ্রামের সময় শেষ হয়েছে এমন ডোনার</p>
        ${bloodBars()}
        <button class="btn gh sm w" style="margin-top:12px" data-sub="stats">${SI.chart(15)} বিস্তারিত পরিসংখ্যান</button></div>`
  
    +`<div class="sec-t">গত ৭ দিনের রক্তদান</div>
      <div class="card">
        <div class="spark">${week.map(w=>`<i style="height:${Math.max(7,Math.round(w.v/wMax*100))}%"><b>${bn(w.v)}</b></i>`).join("")}</div>
        <div class="sparkx">${week.map(w=>`<span>${dS(w.d)}</span>`).join("")}</div></div>`
  
    +(DB.live.length?`<div class="sec-t">চলমান জরুরি আবেদন</div>
      <div class="card pad0">${DB.live.slice(0,3).map(r=>`<button class="prow" data-lv="${r.id}">
        <span class="bg2">${r.group}</span>
        <span class="tx"><b>${esc(r.patient)}</b><small>${esc(r.hospital)} · ${bn(r.bags)} ব্যাগ</small></span>
        ${statusPill(r.status)}</button>`).join("")}
        <button class="row" data-sub="live"><span class="tx"><b>সব দেখুন</b></span>
          <span class="rt">${SI.right(16)}</span></button></div>`:"")
  
    +`<div class="sec-t">সাম্প্রতিক কাজ</div>
      <div class="card"><div class="tl">${DB.audit.slice(0,4).map(a=>`<div class="ti ${/বাতিল|মুছে|স্থগিত/.test(a.act)?"a":""}">
        <b>${esc(a.act)}</b><small>${esc(a.target)} · ${esc(a.who)} · ${timeAgo(a.at)}</small></div>`).join("")}</div>
        <button class="btn gh sm w" style="margin-top:12px" data-sub="audit">${SI.file(15)} পুরো অডিট লগ</button></div>`;
  
    el.querySelectorAll("[data-al]").forEach(b=>b.onclick=()=>alerts[+b.dataset.al].fn());
    el.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>go(b.dataset.goto));
    el.querySelectorAll("[data-lv]").forEach(b=>b.onclick=()=>{liveSheet(b.dataset.lv)});
  };
  
  /* ══════════════════ SCREEN 2: WORK QUEUE ══════════════════ */
  let wTab="all", wSel=new Set();
  RENDER.work=()=>{
    const el=$("#s-work");
    const kinds=["all","donor","donation","request","group","report"];
    const list=DB.queue.filter(q=>wTab==="all"||q.kind===wTab)
      .sort((a,b)=>(b.kind==="request")-(a.kind==="request")||new Date(a.at)-new Date(b.at));
  
    el.innerHTML=ptitle("অপেক্ষমাণ কাজ","ডোনার অ্যাপ থেকে আসা সব আবেদন এক জায়গায়")
    +`<div class="strip chips" id="wtabs">${kinds.map(k=>{
        const n=k==="all"?DB.queue.length:qCount(k);
        return `<button data-w="${k}" class="${wTab===k?"on":""}">${k==="all"?"সব":QK[k].t}
          ${n?`<i class="c">${bn(n)}</i>`:""}</button>`}).join("")}</div>`
    +(wSel.size?`<div class="selbar"><b>${bn(wSel.size)}টি নির্বাচিত</b>
        <span class="sa"><button class="ok" id="skOk">অনুমোদন</button><button class="no" id="skNo">বাতিল</button>
        <button class="cl" id="skC">${SI.x(13)} বাদ</button></span></div>`:"")
    +(list.length?`<div class="card pad0">${list.map(wkItem).join("")}</div>`
      :`<div class="card">${emptyBox("check","কোনো অপেক্ষমাণ কাজ নেই","নতুন আবেদন এলে এখানে দেখা যাবে")}</div>`);
  
    el.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{wTab=b.dataset.w;wSel.clear();RENDER.work()});
    el.querySelectorAll("[data-ck]").forEach(b=>b.onclick=e=>{e.stopPropagation();
      const id=b.dataset.ck;wSel.has(id)?wSel.delete(id):wSel.add(id);RENDER.work()});
    el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openReview(b.dataset.open));
    if(wSel.size){
      $("#skC").onclick=()=>{wSel.clear();RENDER.work()};
      $("#skOk").onclick=()=>bulkDo(true);
      $("#skNo").onclick=()=>bulkDo(false);
    }
  };
  function wkItem(q){
    const k=QK[q.kind],urg=q.kind==="request"&&q.urgency==="অতিজরুরি",sel=wSel.has(q.id);
    const meta={donor:`${q.group} · ${q.area} · ${bn(q.age)} বছর`,
      donation:`${q.place} · ${dL(q.date)}`,
      request:`${q.group} · ${bn(q.bags)} ব্যাগ · ${q.hospital}`,
      group:`${q.from} → ${q.to}`,report:q.type}[q.kind];
    return `<div class="wk ${urg?"urg":""}">
      <button class="ck ${sel?"on":""}" data-ck="${q.id}" aria-label="নির্বাচন">${sel?SI.check(13):""}</button>
      <button class="bd2" data-open="${q.id}" style="text-align:left">
        <span class="kd"><span class="pill ${k.cl==="m"?"m":k.cl}">${k.t}</span>
          ${urg?`<span class="tag r">অতিজরুরি</span>`:""}</span>
        <b class="nm">${esc(q.name||q.patient)}</b>
        <span class="ms">${esc(meta)}</span>
        <span class="ms" style="font-size:.7rem;margin-top:2px">${q.id} · ${timeAgo(q.at)}</span>
      </button>
      <span class="go">${SI.right(17)}</span></div>`;
  }
  function bulkDo(ok){
    if(!can("donor.approve"))return toast("আপনার অনুমতি নেই","er");
    if(!ok)return rejectSheet([...wSel],()=>{wSel.clear();RENDER.work()});
    const n=wSel.size;[...wSel].forEach(id=>decide(id,true,"",true));
    wSel.clear();persist();RENDER.work();paintNav();paintTop();
    toast(bn(n)+"টি অনুমোদন করা হয়েছে","ok");
  }
  function reviewWarning(q){
    const w=[];
    if(q.kind==="donor"){
      if(q.age<DB.rules.minAge)w.push(`বয়স ${bn(q.age)} — নিয়ম অনুযায়ী কমপক্ষে ${bn(DB.rules.minAge)} বছর`);
      if(q.age>DB.rules.maxAge)w.push(`বয়স ${bn(q.age)} — সর্বোচ্চ ${bn(DB.rules.maxAge)} বছর`);
      if(q.last&&dayDiff(q.last)<DB.rules.interval)w.push(`শেষ রক্তদানের পর মাত্র ${bn(dayDiff(q.last))} দিন হয়েছে`);
      if(/ওষুধ|রোগ|থাইরয়েড|ডায়াবেটিস/.test(q.health)&&!/কোনো রোগ নেই/.test(q.health))
        w.push("স্বাস্থ্য তথ্যে ওষুধ/রোগের উল্লেখ আছে — যাচাই করুন");
      if(!phoneOK(q.phone))w.push("ফোন নম্বরের ধরন ঠিক নেই");
    }
    if(q.kind==="donation"&&!q.proof)w.push("রক্তদানের কোনো প্রমাণ সংযুক্ত নেই");
    if(q.kind==="group"&&!q.proof)w.push("গ্রুপ বদলের রিপোর্ট সংযুক্ত নেই");
    if(q.kind==="request"&&!phoneOK(q.phone))w.push("যোগাযোগ নম্বর সন্দেহজনক");
    return w;
  }
  function matchBlock(group){
    const ok=donorsFor(group);
    const pool=DB.donors.filter(d=>ok.includes(d.group)&&readyOf(d));
    return `<div class="sec-t">মিলে যাওয়া রক্তদাতা</div>
      <p class="hint2" style="margin-bottom:8px">${group} রোগী ${ok.join(", ")} গ্রুপ থেকে রক্ত নিতে পারেন।</p>
      ${pool.length?`<div class="card pad0" style="margin:0">${pool.slice(0,5).map(d=>`<div class="prow">
        <span class="bg2">${d.group}</span>
        <span class="tx"><b>${esc(d.name)}</b><small>${esc(d.area)} · ${d.last?tp(dL(d.last)+" শেষ দান","last donated "+dL(d.last)):tp("প্রথমবার","first time")}</small></span>
        <span class="tag">${esc(maskPhone(d.phone))}</span></div>`).join("")}</div>
        ${pool.length>5?`<p class="hint2" style="margin-top:7px">আরও ${bn(pool.length-5)} জন আছেন</p>`:""}`
      :`<div class="card" style="margin:0">${emptyBox("warn","এই মুহূর্তে প্রস্তুত ডোনার নেই","অন্য এলাকায় খোঁজ নিন বা ক্যাম্পের ঘোষণা দিন")}</div>`}`;
  }
  function openReview(id){
    const q=DB.queue.find(x=>x.id===id);if(!q)return;
    const k=QK[q.kind],w=reviewWarning(q);
    const rows={
      donor:[["নাম",q.name],["রক্তের গ্রুপ",q.group],["এলাকা",q.area],["বয়স",bn(q.age)+" বছর"],
        ["লিঙ্গ",q.gender],["ফোন",maskPhone(q.phone)],["শেষ রক্তদান",q.last?dL(q.last):"কখনো দেননি"],
        ["স্বাস্থ্য",q.health]],
      donation:[["ডোনার",q.name],["স্থান",q.place],["তারিখ",dL(q.date)],["ব্যাগ",bn(q.bags)],
        ["প্রমাণ",q.proof?"সংযুক্ত আছে":"নেই"]],
      request:[["রোগী",q.patient],["গ্রুপ",q.group],["ব্যাগ",bn(q.bags)],["জরুরিতা",q.urgency],
        ["হাসপাতাল",q.hospital],["এলাকা",q.area],["যোগাযোগ",maskPhone(q.phone)],["আবেদনকারী",q.requester]],
      group:[["ব্যবহারকারী",q.name],["বর্তমান গ্রুপ",q.from],["নতুন গ্রুপ",q.to],["কারণ",q.reason],
        ["রিপোর্ট",q.proof?"সংযুক্ত":"নেই"]],
      report:[["জানিয়েছেন",q.name],["ধরন",q.type],["বিবরণ",q.text]]
    }[q.kind];
    const may=can("donor.approve")||can("request.approve");
    const s=sheet(k.t,`
      <div class="per"><span class="bg2" style="width:44px;height:44px;border-radius:12px">${q.group||SI[k.ic](20)}</span>
        <div class="i"><b>${esc(q.name||q.patient)}</b><small>${q.id} · ${timeAgo(q.at)}</small></div></div>
      ${w.length?`<div class="sec-t" style="color:var(--amb)">সতর্কতা</div>
        <ul class="wl">${w.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
      <div class="sec-t">বিস্তারিত</div>
      <div class="kv">${rows.map(([a,b])=>`<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("")}</div>
      ${q.kind==="request"?matchBlock(q.group):""}
      <p class="hint2" style="margin-top:12px">${can("contact.reveal")
        ?"নম্বর দেখা হয়েছে — এটি অডিট লগে থেকে যাবে।":"ফোন নম্বর দেখার অনুমতি আপনার নেই।"}</p>
      ${may?`<div class="sec-t">সিদ্ধান্তের নোট (ঐচ্ছিক)</div>
        <textarea id="rv_note" rows="2" placeholder="টিমের জন্য নোট…"></textarea>`:""}`,
      may?`<button class="btn gh amb" id="rv_no">${SI.x(16)} বাতিল</button>
           <button class="btn" id="rv_yes">${SI.check(16)} অনুমোদন</button>`
         :`<button class="btn gh w" data-close>বন্ধ</button>`);
    if(can("contact.reveal"))logAudit("যোগাযোগ দেখা হয়েছে",q.id,q.kind);
    if(may){
      s.q("#rv_yes").onclick=()=>{decide(id,true,s.q("#rv_note").value);s.close()};
      s.q("#rv_no").onclick=()=>{s.close();rejectSheet([id])};
    }
  }
  function rejectSheet(ids,after){
    const reasons=["তথ্য অসম্পূর্ণ","বয়স নিয়ম মানেনি","বিশ্রামের সময় শেষ হয়নি","স্বাস্থ্যগত কারণে অযোগ্য",
      "প্রমাণ সংযুক্ত নেই","ভুয়া বা সন্দেহজনক তথ্য","একই আবেদন আগে জমা হয়েছে"];
    const s=sheet("বাতিলের কারণ",`
      <p class="hint2" style="margin-bottom:10px">কারণটি ব্যবহারকারীর অ্যাপে দেখানো হবে, তাই স্পষ্ট করে লিখুন। কারণ ছাড়া বাতিল করা যাবে না।</p>
      <div class="strip wrap chips" id="rj_chips">
        ${reasons.map(r=>`<button data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      <textarea id="rj_txt" rows="3" placeholder="বিস্তারিত কারণ…"></textarea>`,
      `<button class="btn gh" data-close>ফিরে যান</button>
       <button class="btn amb" id="rj_ok">${SI.x(16)} বাতিল করুন</button>`);
    s.querySelectorAll("#rj_chips button").forEach(b=>b.onclick=()=>{
      s.querySelectorAll("#rj_chips button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");const t=s.q("#rj_txt");if(!t.value.trim())t.value=b.dataset.r});
    s.q("#rj_ok").onclick=()=>{
      const txt=s.q("#rj_txt").value.trim();
      if(!txt)return toast("কারণ লিখতে হবে","er");
      ids.forEach(id=>decide(id,false,txt,true));
      persist();s.close();after?after():RENDER.work();paintNav();paintTop();
      toast(bn(ids.length)+"টি বাতিল করা হয়েছে")};
  }
  function decide(id,ok,note,quiet){
    const i=DB.queue.findIndex(x=>x.id===id);if(i<0)return;
    const q=DB.queue[i];
    if(q.kind==="donor"&&ok)DB.donors.unshift({id:q.donorId||("CBDC-2026-"+pad(DB.donors.length+1)),
      name:q.name,group:q.group,area:q.area,phone:q.phone,whatsapp:q.whatsapp||q.phone,gender:q.gender,age:q.age,last:q.last,
      ownerUid:q.ownerUid||"",available:true,verified:true,suspended:false,joined:iso(now()),donations:q.last?1:0});
    if(q.kind==="donation"&&ok){const d=DB.donors.find(x=>x.name===q.name);
      if(d){d.donations++;if(!d.last||q.date>d.last)d.last=q.date}}
    if(q.kind==="request"&&ok)DB.live.unshift({id:q.id,patient:q.patient,group:q.group,bags:q.bags,
      urgency:q.urgency,status:"searching",responders:0,hospital:q.hospital,area:q.area,requester:q.requester||"স্বজন",
      phone:q.phone,whatsapp:q.whatsapp||q.phone,expiresAt:q.expiresAt||"",at:new Date().toISOString()});
    if(q.kind==="group"&&ok){const d=DB.donors.find(x=>x.name===q.name);if(d)d.group=q.to}
    DB.queue.splice(i,1);
    logAudit(ok?QK[q.kind].t+" অনুমোদন":QK[q.kind].t+" বাতিল",id+(note?" — "+note.slice(0,40):""),q.kind);
    if(!quiet){persist();RENDER.work();paintNav();paintTop();toast(ok?"অনুমোদন করা হয়েছে":"বাতিল করা হয়েছে",ok?"ok":"")}
  }
  
  /* ══════════════════ SCREEN 3: PEOPLE ══════════════════ */
  RENDER.people=()=>{
    const el=$("#s-people");
    const ready=DB.donors.filter(readyOf).length;
    const susp=DB.donors.filter(d=>d.suspended).length;
    el.innerHTML=ptitle("মানুষ","রক্তদাতা, ব্যবহারকারী ও টিম")
    +`<div class="astat">
        <button class="g" data-sub="donors"><b>${bn(DB.donors.length)}</b><span>রক্তদাতা</span></button>
        <button class="r" data-sub="donors"><b>${bn(ready)}</b><span>প্রস্তুত</span></button>
        <button class="a" data-sub="users"><b>${bn(qCount("report"))}</b><span>অভিযোগ</span></button>
        <button class="b" data-sub="team"><b>${bn(DB.team.length)}</b><span>টিম সদস্য</span></button>
      </div>`
    +sect("",[
        row("donor.view","donors","drop","রক্তদাতা তালিকা","খুঁজুন, সম্পাদনা করুন, স্থগিত করুন",bn(DB.donors.length)),
        row("user.view","users","users","ব্যবহারকারী ও অভিযোগ","অ্যাকাউন্ট ও রিপোর্ট",qCount("report")?bn(qCount("report")):""),
        row("user.view","inbox","mail","বার্তা","ওয়েবসাইটের যোগাযোগ ফর্ম",unread()?`<span class="tag r">${bn(unread())} নতুন</span>`:""),
        row("team.view","team","shield","টিম ও ভূমিকা","কে কী করতে পারবে","")])
    +`<div class="sec-t">শীর্ষ রক্তদাতা</div>
      <div class="card pad0">${DB.donors.slice().sort((a,b)=>b.donations-a.donations).slice(0,5)
        .map((d,i)=>`<button class="prow" data-dn="${d.id}">
          <span class="bg2" style="background:var(--grn-s);color:var(--grn)">${bn(i+1)}</span>
          <span class="tx"><b>${esc(d.name)}</b><small>${d.group} · ${esc(d.area)}</small></span>
          <span class="tag g">${bn(d.donations)} বার</span></button>`).join("")}</div>`
    +`<div class="sec-t">এলাকাভিত্তিক</div>
      <div class="card">${(()=>{
        const a={};DB.donors.forEach(d=>a[d.area]=(a[d.area]||0)+1);
        const mx=Math.max(...Object.values(a));
        return `<div class="bars">${Object.entries(a).sort((x,y)=>y[1]-x[1]).map(([n,v])=>
          `<div class="bar"><span class="bl" style="width:70px;font-size:.73rem">${esc(n)}</span>
           <span class="bt"><i style="width:${Math.round(v/mx*100)}%;background:var(--blu)"></i></span>
           <span class="bv">${bn(v)}</span></div>`).join("")}</div>`})()}</div>`;
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>openDonor(b.dataset.dn));
  };
  
  /* rows are hidden when the admin lacks the permission — never show a
     door that cannot be opened */
  const row=(perm,sub,ic,t,sub2,rt)=>(!perm||can(perm))?`<button class="row" data-sub="${sub}">
    <span class="ic">${SI[ic](18)}</span>
    <span class="tx"><b>${esc(t)}</b><small>${esc(sub2)}</small></span>
    <span class="rt">${rt||""} ${SI.right(16)}</span></button>`:"";
  const rowAct=(perm,act,ic,t,sub2,rt)=>(!perm||can(perm))?`<button class="row" data-act="${act}">
    <span class="ic">${SI[ic](18)}</span>
    <span class="tx"><b>${esc(t)}</b><small>${esc(sub2)}</small></span>
    <span class="rt">${rt||""} ${SI.right(16)}</span></button>`:"";
  const sect=(title,rows)=>{const r=rows.filter(Boolean).join("");
    return r?`<div class="sec-t">${esc(title)}</div><div class="card pad0">${r}</div>`:""};
  
  /* ══════════════════ SCREEN 4: CONTROL ══════════════════ */
  RENDER.set=()=>{
    const el=$("#s-set");
    /* "More" is the home of everything that is not day-to-day work:
       own account first, then the things you manage. Groups hide
       themselves when the role cannot use any row inside them. */
    el.innerHTML=ptitle("আরও","অ্যাকাউন্ট ও নিয়ন্ত্রণ")
    +meHeader()
    +sect("",ACC_PAGES.map(a=>row(null,a.id,a.icon,a.title,a.desc,"")))
    +sect("ব্যবস্থাপনা",[
        row("access.manage","access","key","অ্যাক্সেস ও ভূমিকা","কাকে অ্যাডমিন বা মডারেটর করবেন",""),
        row("team.view","team","shield","টিম ও ভূমিকা","কে কী করতে পারবে",""),
        row("settings.manage","rules","gear","নিয়ম ও সেটিংস","বয়স, বিশ্রাম, অনুমোদন, সংযোগ","")])
    +sect("ওয়েবসাইট",[
        row("website.view","site","globe","হোমপেজ ও তথ্য","শিরোনাম, যোগাযোগ, কোন অংশ দেখাবে",""),
        row("website.view","gallery","cam","গ্যালারি","ছবি যোগ, প্রকাশ বা লুকানো",bn(DB.gallery.length)),
        row("website.view","notice","bell","নোটিশ ও ঘোষণা","ওয়েবসাইট ও অ্যাপে পাঠান",bn(DB.notices.length))])
    +sect("বিশ্লেষণ",[
        row("donor.view","stats","chart","পরিসংখ্যান","গ্রুপ, এলাকা, প্রবণতা",""),
        row("audit.view","audit","file","অডিট লগ","কে কখন কী করেছে",bn(DB.audit.length)),
        rowAct("data.export","export","dl","তথ্য রপ্তানি","CSV ফাইলে নামান")])
    +sect("নীতিমালা",[
        rowAct(null,"pol_terms","file","ব্যবহারের শর্তাবলী","অ্যাকাউন্ট, দায়িত্ব ও আচরণবিধি"),
        rowAct(null,"pol_privacy","eye","গোপনীয়তা নীতি","আপনার তথ্য কীভাবে ব্যবহার হয়"),
        rowAct(null,"pol_donate","drop","রক্তদান নির্দেশিকা","যোগ্যতা, প্রস্তুতি ও নিরাপত্তা")])
    +`<button class="btn gh w logout-btn" data-act="logout" style="margin-top:16px">${SI.logout(17)} লগআউট</button>`
    +`<p class="mut" style="text-align:center;margin:16px 0 4px;font-size:.72rem">
        চকবাজার ব্লাড ডোনার'স ক্লাব · ${esc(PANEL.label)} · সংস্করণ ১.০</p>`;
  
    el.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
      const a=b.dataset.act;
      if(a==="pol_terms"||a==="pol_privacy"||a==="pol_donate")sheetPolicy(a);
      if(a==="export")exportSheet();
      if(a==="logout")doLogout();
    });
  };
  
  /* ══════════ LOGOUT — same behaviour in every panel ══════════
     Firebase Auth signOut + স্থানীয় সেশন পরিষ্কার করে মূল ওয়েবসাইটে ফেরত। */
  async function doLogout(){
    if(!await confirmS({title:"লগআউট করবেন?",
      desc:"প্যানেল থেকে বের হয়ে মূল ওয়েবসাইটে ফিরে যাবেন। আবার ঢুকতে হলে নতুন করে লগইন করতে হবে।",
      ok:"লগআউট",danger:true}))return;
    logMe("লগআউট","প্যানেল থেকে বের হয়েছেন","security");
    try{
      /* the session ends; work data stays for the next person who logs in */
      localStorage.removeItem(ACC_LS);
      sessionStorage.clear();
    }catch(e){}
    try{(async()=>{try{const shared=initSharedFirebase();const {signOut}=await import("firebase/auth");if(shared.auth)await signOut(shared.auth)}catch(e){}})()}catch(e){}
    toast("লগআউট হয়েছে — মূল ওয়েবসাইটে ফিরে যাচ্ছেন","ok");
    setTimeout(()=>{navigateToPage("home")},700);
  }
  function exportSheet(){
    if(!can("data.export"))return toast("রপ্তানির অনুমতি নেই","er");
    let pick="donors";
    const s=sheet("তথ্য রপ্তানি",`
      <p class="hint2" style="margin-bottom:10px">যে তালিকা নামাতে চান বেছে নিন। CSV ফাইল হবে, এক্সেলে খোলা যাবে।</p>
      <div class="strip wrap chips" id="ex_c">
        <button data-x="donors" class="on">রক্তদাতা (${bn(DB.donors.length)})</button>
        <button data-x="queue">অপেক্ষমাণ (${bn(DB.queue.length)})</button>
        <button data-x="live">চলমান আবেদন (${bn(DB.live.length)})</button>
        <button data-x="audit">অডিট লগ (${bn(DB.audit.length)})</button></div>
      <p class="hint2">ফোন নম্বর ${can("contact.reveal")?"সম্পূর্ণ":"আংশিক গোপন করে"} রপ্তানি হবে।</p>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ex_ok">${SI.dl(15)} নামান</button>`);
    s.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{
      s.querySelectorAll("[data-x]").forEach(x=>x.classList.remove("on"));b.classList.add("on");pick=b.dataset.x});
    s.q("#ex_ok").onclick=()=>{
      let csv="";
      if(pick==="donors")csv=toCSV(DB.donors.map(d=>[d.id,d.name,d.group,d.area,maskPhone(d.phone),
        d.age,d.gender,d.last,d.donations,d.suspended?"স্থগিত":"সক্রিয়"]),
        ["আইডি","নাম","গ্রুপ","এলাকা","ফোন","বয়স","লিঙ্গ","শেষ দান","মোট দান","অবস্থা"]);
      if(pick==="queue")csv=toCSV(DB.queue.map(q=>[q.id,QK[q.kind].t,q.name||q.patient,q.group||"",iso(q.at)]),
        ["আইডি","ধরন","নাম","গ্রুপ","তারিখ"]);
      if(pick==="live")csv=toCSV(DB.live.map(r=>[r.id,r.patient,r.group,r.bags,r.hospital,r.urgency,r.status]),
        ["আইডি","রোগী","গ্রুপ","ব্যাগ","হাসপাতাল","জরুরিতা","অবস্থা"]);
      if(pick==="audit")csv=toCSV(DB.audit.map(a=>[a.at,a.who,ROLES[a.role].label,a.act,a.target]),
        ["সময়","কে","ভূমিকা","কাজ","লক্ষ্য"]);
      dlFile(`cbdc-${pick}-${iso(now())}.csv`,csv);
      logAudit("তথ্য রপ্তানি",pick,"data");persist();s.close();toast("ফাইল নামছে","ok")};
  }
  
  /* ══════════════════ SUB-PAGES ══════════════════ */
  let dF={q:"",g:"",area:"",st:""}, dPage=0, aFil="", pvSize="mob";
  
  function renderSub(id){
    const el=$("#s-sub");
    const meta=SUBS[id];
    if(meta&&meta.perm&&!can(meta.perm))return el.innerHTML=noPerm();
    (SUBP[id]||(()=>el.innerHTML=noPerm()))(el);
  }
  
  /* ---------- donors list ---------- */
  SUBP.donors=el=>{
    let list=DB.donors.filter(d=>{
      if(dF.q&&![d.name,d.id,d.phone,d.area].join(" ").toLowerCase().includes(dF.q.toLowerCase()))return false;
      if(dF.g&&d.group!==dF.g)return false;
      if(dF.area&&d.area!==dF.area)return false;
      if(dF.st==="ready"&&!readyOf(d))return false;
      if(dF.st==="rest"&&(readyOf(d)||d.suspended))return false;
      if(dF.st==="susp"&&!d.suspended)return false;
      if(dF.st==="unver"&&d.verified)return false;
      return true});
    const per=15,pages=Math.max(1,Math.ceil(list.length/per));
    dPage=Math.min(dPage,pages-1);
    const rows=list.slice(dPage*per,dPage*per+per);
    el.innerHTML=`<div class="frow">
        <input class="gw" id="dq" placeholder="নাম, আইডি, এলাকা বা ফোন…" value="${esc(dF.q)}">
        <select id="dg"><option value="">সব গ্রুপ</option>${GROUPS.map(g=>`<option ${dF.g===g?"selected":""}>${g}</option>`).join("")}</select>
        <select id="da"><option value="">সব এলাকা</option>${AREAS.map(a=>`<option ${dF.area===a?"selected":""}>${a}</option>`).join("")}</select>
        <select id="ds"><option value="">সব অবস্থা</option>
          <option value="ready" ${dF.st==="ready"?"selected":""}>প্রস্তুত</option>
          <option value="rest" ${dF.st==="rest"?"selected":""}>বিশ্রামে</option>
          <option value="unver" ${dF.st==="unver"?"selected":""}>যাচাই বাকি</option>
          <option value="susp" ${dF.st==="susp"?"selected":""}>স্থগিত</option></select>
      </div>
      <p class="hint2" style="margin-bottom:9px">${tp(bn(list.length)+" জন পাওয়া গেছে",list.length+" donors found")}${can("donor.edit")?tp(" · নতুন যোগ করতে নিচে দেখুন"," · add a new one below"):""}</p>`
    +(rows.length?`<div class="card pad0">${rows.map(d=>`<button class="prow" data-dn="${d.id}">
        <span class="bg2">${d.group}</span>
        <span class="tx"><b>${esc(d.name)}</b><small>${d.id} · ${esc(d.area)} · ${d.last?tp(dS(d.last)+" শেষ দান","last donated "+dS(d.last)):tp("দান করেননি","never donated")}</small></span>
        ${d.suspended?`<span class="pill r">স্থগিত</span>`:readyOf(d)?`<span class="pill g">প্রস্তুত</span>`
          :!d.verified?`<span class="pill a">যাচাই বাকি</span>`:`<span class="pill m">বিশ্রামে</span>`}
        </button>`).join("")}</div>
      ${pages>1?`<div class="frow" style="justify-content:space-between;align-items:center;margin-top:11px">
        <button class="btn gh sm" id="pPrev" ${dPage===0?"disabled":""}>আগের</button>
        <span class="hint2">পৃষ্ঠা ${bn(dPage+1)} / ${bn(pages)}</span>
        <button class="btn gh sm" id="pNext" ${dPage>=pages-1?"disabled":""}>পরের</button></div>`:""}`
      :`<div class="card">${emptyBox("search","কোনো রক্তদাতা মেলেনি","ফিল্টার বদলে আবার চেষ্টা করুন")}</div>`)
    +(can("donor.edit")?`<button class="btn w" style="margin-top:12px" id="dAdd">${SI.plus(16)} নতুন রক্তদাতা যোগ করুন</button>`:"")
    +(can("data.export")?`<button class="btn gh w" style="margin-top:8px" id="dExp">${SI.dl(15)} CSV রপ্তানি</button>`:"");
  
    let t;$("#dq").oninput=e=>{dF.q=e.target.value;clearTimeout(t);
      t=setTimeout(()=>{dPage=0;renderSub("donors");const i=$("#dq");i.focus();i.setSelectionRange(i.value.length,i.value.length)},300)};
    $("#dg").onchange=e=>{dF.g=e.target.value;dPage=0;renderSub("donors")};
    $("#da").onchange=e=>{dF.area=e.target.value;dPage=0;renderSub("donors")};
    $("#ds").onchange=e=>{dF.st=e.target.value;dPage=0;renderSub("donors")};
    $("#pPrev")&&($("#pPrev").onclick=()=>{dPage--;renderSub("donors")});
    $("#pNext")&&($("#pNext").onclick=()=>{dPage++;renderSub("donors")});
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>openDonor(b.dataset.dn));
    $("#dAdd")&&($("#dAdd").onclick=()=>donorForm());
    $("#dExp")&&($("#dExp").onclick=exportSheet);
  };
  function donorForm(id){
    const d=id?DB.donors.find(x=>x.id===id):{name:"",group:"O+",area:AREAS[0],phone:"",age:20,gender:"পুরুষ",last:""};
    const s=sheet(id?"তথ্য সম্পাদনা":"নতুন রক্তদাতা",`<div class="f">
      <label>নাম</label><input id="f_n" value="${esc(d.name)}">
      <label>রক্তের গ্রুপ</label><select id="f_g">${GROUPS.map(g=>`<option ${d.group===g?"selected":""}>${g}</option>`).join("")}</select>
      <label>এলাকা</label><select id="f_a">${AREAS.map(a=>`<option ${d.area===a?"selected":""}>${a}</option>`).join("")}</select>
      <label>ফোন</label><input id="f_p" value="${esc(d.phone)}" placeholder="01XXXXXXXXX" inputmode="numeric">
      <label>বয়স</label><input id="f_ag" type="number" value="${d.age}">
      <label>লিঙ্গ</label><select id="f_s"><option ${d.gender==="পুরুষ"?"selected":""}>পুরুষ</option><option ${d.gender==="মহিলা"?"selected":""}>মহিলা</option></select>
      <label>শেষ রক্তদান</label><input id="f_l" type="date" value="${d.last||""}">
    </div>`,`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="f_ok">সংরক্ষণ</button>`);
    s.q("#f_ok").onclick=()=>{
      const n=s.q("#f_n").value.trim(),p=s.q("#f_p").value.trim();
      if(n.length<3)return toast("নাম লিখুন","er");
      if(!phoneOK(p))return toast("সঠিক ফোন নম্বর দিন (০১…, ১১ সংখ্যা)","er");
      const o={name:n,group:s.q("#f_g").value,area:s.q("#f_a").value,phone:p,
        age:+s.q("#f_ag").value||20,gender:s.q("#f_s").value,last:s.q("#f_l").value};
      if(id){Object.assign(d,o);logAudit("ডোনার তথ্য সম্পাদনা",id,"donor")}
      else{DB.donors.unshift({id:"CBDC-2026-"+pad(DB.donors.length+1),...o,available:true,verified:true,
        suspended:false,joined:iso(now()),donations:0});logAudit("নতুন ডোনার যোগ",n,"donor")}
      persist();s.close();renderSub("donors");toast("সংরক্ষণ হয়েছে","ok")};
  }
  
  /* ---------- live requests ---------- */
  SUBP.live=el=>{
    el.innerHTML=DB.live.length
      ? DB.live.map(r=>{
        const stage=["pending","searching","matched","done"].indexOf(r.status);
        return `<div class="card">
          <div class="per"><span class="bg2" style="width:44px;height:44px;border-radius:12px">${r.group}</span>
            <div class="i"><b>${esc(r.patient)}</b><small>${esc(r.hospital)}</small></div>
            ${statusPill(r.status)}</div>
          <div class="kv" style="margin-top:11px">
            <div><span>ব্যাগ</span><b>${bn(r.bags)}</b></div>
            <div><span>জরুরিতা</span><b>${esc(r.urgency)}</b></div>
            <div><span>এলাকা</span><b>${esc(r.area)}</b></div>
            <div><span>সাড়া দিয়েছেন</span><b>${bn(r.responders)} জন</b></div>
            <div><span>যোগাযোগ</span><b>${esc(maskPhone(r.phone))}</b></div>
            <div><span>সময়</span><b>${timeAgo(r.at)}</b></div></div>
          <div class="stp">${["যাচাই","ডোনার খোঁজা","ডোনার পাওয়া","সম্পন্ন"].map((t,i)=>
            `<span class="${i<=stage?"ok":""}"><i>${i<=stage?"✓":bn(i+1)}</i>${t}</span>`).join("")}</div>
          <div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap">
            <button class="btn gh sm" style="flex:1" data-mt="${r.id}">${SI.target(15)} ডোনার মেলান</button>
            ${can("request.resolve")?`<button class="btn sm" style="flex:1" data-dn2="${r.id}">${SI.check(15)} সম্পন্ন</button>`:""}
          </div>
          ${can("request.resolve")?`<button class="btn gh sm w" style="margin-top:7px" data-cx="${r.id}">আবেদন বাতিল</button>`:""}
        </div>`}).join("")
      : `<div class="card">${emptyBox("check","কোনো চলমান আবেদন নেই","অনুমোদিত জরুরি আবেদন এখানে দেখা যাবে")}</div>`;
    el.querySelectorAll("[data-mt]").forEach(b=>b.onclick=()=>{
      const r=DB.live.find(x=>x.id===b.dataset.mt);
      sheet("ডোনার মেলানো — "+r.patient,matchBlock(r.group),`<button class="btn gh w" data-close>বন্ধ</button>`)});
    el.querySelectorAll("[data-dn2]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"আবেদন সম্পন্ন?",desc:"রোগী রক্ত পেয়েছেন বলে চিহ্নিত হবে।"}))return;
      const r=DB.live.find(x=>x.id===b.dataset.dn2);
      DB.live=DB.live.filter(x=>x.id!==r.id);
      logAudit("আবেদন সম্পন্ন",r.id,"request");persist();renderSub("live");paintTop();
      toast("সম্পন্ন হিসেবে চিহ্নিত","ok")});
    el.querySelectorAll("[data-cx]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.cx;
      const s=sheet("আবেদন বাতিল",`<p class="hint2" style="margin-bottom:9px">কারণ লিখুন — আবেদনকারীর অ্যাপে দেখানো হবে।</p>
        <textarea id="lv_t" rows="3" placeholder="কারণ…"></textarea>`,
        `<button class="btn gh" data-close>ফিরে যান</button><button class="btn red" id="lv_ok">বাতিল করুন</button>`);
      s.q("#lv_ok").onclick=()=>{
        if(!s.q("#lv_t").value.trim())return toast("কারণ লিখতে হবে","er");
        DB.live=DB.live.filter(x=>x.id!==id);logAudit("আবেদন বাতিল",id,"request");
        persist();s.close();renderSub("live");paintTop();toast("বাতিল করা হয়েছে")}});
  };
  function liveSheet(id){go(CUR,"live")}
  
  /* ---------- users & reports ---------- */
  SUBP.users=el=>{
    const reports=DB.queue.filter(q=>q.kind==="report");
    el.innerHTML=`<div class="astat">
        <button class="g"><b>${bn(DB.donors.length)}</b><span>অ্যাকাউন্ট</span></button>
        <button class="a"><b>${bn(reports.length)}</b><span>অভিযোগ</span></button>
        <button class="r"><b>${bn(DB.donors.filter(d=>d.suspended).length)}</b><span>স্থগিত</span></button>
        <button class="b"><b>${bn(DB.donors.filter(d=>!d.verified).length)}</b><span>যাচাই বাকি</span></button>
      </div>
      <div class="sec-t">অভিযোগ ও রিপোর্ট</div>`
    +(reports.length?`<div class="card pad0">${reports.map(q=>`<button class="row" data-open="${q.id}">
        <span class="ic" style="color:var(--amb)">${SI.help(18)}</span>
        <span class="tx"><b>${esc(q.type)} — ${esc(q.name)}</b><small>${esc(q.text)}</small></span>
        <span class="rt">${timeAgo(q.at)}</span></button>`).join("")}</div>`
      :`<div class="card">${emptyBox("check","কোনো অভিযোগ নেই")}</div>`)
    +`<div class="sec-t">স্থগিত অ্যাকাউন্ট</div>`
    +(DB.donors.filter(d=>d.suspended).length
      ?`<div class="card pad0">${DB.donors.filter(d=>d.suspended).map(d=>`<button class="prow" data-dn="${d.id}">
          <span class="bg2">${d.group}</span>
          <span class="tx"><b>${esc(d.name)}</b><small>${d.id} · ${esc(d.area)}</small></span>
          <span class="pill r">স্থগিত</span></button>`).join("")}</div>`
      :`<div class="card">${emptyBox("check",tp("কোনো স্থগিত অ্যাকাউন্ট নেই","No suspended accounts"))}</div>`)
    +`<div class="sec-t">সব ব্যবহারকারী</div>
      <div class="card pad0">
        <button class="row" data-sub="donors"><span class="ic">${SI.users(18)}</span>
          <span class="tx"><b>${tp("রক্তদাতা তালিকা দেখুন","Open the donor list")}</b><small>খোঁজা, ফিল্টার ও সম্পাদনা</small></span>
          <span class="rt">${SI.right(16)}</span></button></div>`;
    el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openReview(b.dataset.open));
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>openDonor(b.dataset.dn));
  };
  
  /* ---------- team & roles ---------- */
  SUBP.team=el=>{
    el.innerHTML=`<div class="card pad0">${DB.team.map(t=>`<div class="prow">
        <span class="bg2" style="background:var(--grn-s);color:var(--grn)">${ROLES[t.role].icon}</span>
        <span class="tx"><b>${esc(t.name)}${t.uid===ME.uid?tp(" (আপনি)"," (you)"):""}</b>
          <small>${ROLES[t.role].label} · ${tp(timeAgo(t.last)+" সক্রিয়","active "+timeAgo(t.last))}</small></span>
        ${can("team.manage")?`<button class="btn gh sm" data-mr="${t.uid}">${SI.edit(14)}</button>`
          :`<span class="tag">${ROLES[t.role].label}</span>`}</div>`).join("")}</div>`
    +`<div class="sec-t">ভূমিকা অনুযায়ী অনুমতি</div>
      <div class="card pad0">${Object.entries(ROLES).map(([k,r])=>`<div class="row">
        <span class="ic">${r.icon}</span>
        <span class="tx"><b>${r.label}</b><small>${tp(bn(r.perms.length)+"টি অনুমতি",r.perms.length+" permissions")}</small></span>
        <span class="rt">${tp(bn(DB.team.filter(t=>t.role===k).length)+" জন",DB.team.filter(t=>t.role===k).length+" people")}</span></div>`).join("")}</div>`
    +`<div class="sec-t">নিরাপত্তা নিয়ম</div>
      <div class="card"><ul class="wl">
        <li>নিজের আবেদন নিজে অনুমোদন করা যায় না</li>
        <li>নিজের ভূমিকা নিজে বাড়ানো যায় না</li>
        <li>শেষ সুপার অ্যাডমিনকে সরানো যায় না</li>
        <li>অডিট লগ একবার লেখা হলে বদলানো যায় না</li>
        <li>ফোন নম্বর দেখলে তা লগে থেকে যায়</li></ul></div>`
    +`<div class="sec-t">আপনার অনুমতি</div>
      <div class="card">${Object.entries(PERM_GROUPS).map(([g,ps])=>`
        <div class="sec-t" style="margin:10px 0 6px">${g}</div>
        <div class="pms">${ps.map(p=>`<span class="${can(p)?"on":""}">${p}</span>`).join("")}</div>`).join("")}</div>`
    +(can("team.manage")?`<button class="btn gh w" style="margin-top:12px" id="tAdd">${SI.plus(15)} সদস্য যোগ</button>`:"");
    el.querySelectorAll("[data-mr]").forEach(b=>b.onclick=()=>roleSheet(b.dataset.mr));
    $("#tAdd")&&($("#tAdd").onclick=()=>toast("সদস্য যোগ ডেটাবেজ যুক্ত হলে চালু হবে — শীঘ্রই আসছে"));
  };
  function roleSheet(uid){
    const t=DB.team.find(x=>x.uid===uid);if(!t)return;
    const isMe=uid===ME.uid;
    let pick=t.role;
    const s=sheet("ভূমিকা ও অনুমতি",`
      <div class="per"><span class="bg2" style="width:44px;height:44px;border-radius:50%;background:var(--grn-s);color:var(--grn);font-size:1.05rem">${ROLES[t.role].icon}</span>
        <div class="i"><b>${esc(t.name)}</b><small>${ROLES[t.role].label}</small></div></div>
      ${isMe?`<p class="hint2" style="margin-top:10px">নিরাপত্তার জন্য নিজের ভূমিকা নিজে বদলানো যায় না।</p>`:""}
      <div class="sec-t">ভূমিকা</div>
      <div class="strip wrap chips" id="rl">${Object.entries(ROLES).map(([k,r])=>
        `<button data-r="${k}" class="${t.role===k?"on":""}" ${isMe?"disabled style=opacity:.5":""}>${r.icon} ${r.label}</button>`).join("")}</div>
      <div class="sec-t">এই ভূমিকা যা পারবে</div>
      <div class="pms">${PERMS.map(p=>`<span class="${ROLES[t.role].perms.includes(p)?"on":""}">${p}</span>`).join("")}</div>`,
      isMe?`<button class="btn gh w" data-close>বন্ধ</button>`
        :`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="rl_ok">সংরক্ষণ</button>`);
    s.querySelectorAll("#rl button").forEach(b=>b.onclick=()=>{
      if(isMe)return;
      s.querySelectorAll("#rl button").forEach(x=>x.classList.remove("on"));b.classList.add("on");pick=b.dataset.r});
    s.q("#rl_ok")&&(s.q("#rl_ok").onclick=()=>{
      if(t.role==="super"&&pick!=="super"&&DB.team.filter(x=>x.role==="super").length<2)
        return toast("শেষ সুপার অ্যাডমিনকে সরানো যাবে না","er");
      t.role=pick;logAudit("ভূমিকা পরিবর্তন",t.name+" → "+ROLES[pick].label,"team");
      persist();s.close();renderSub("team");toast("ভূমিকা হালনাগাদ হয়েছে","ok")});
  }
  
  /* ══════════════════════════════════════════════════════════════
     DONOR WORKSPACE — one page, tabbed, for everything about a donor
     Overview · Info (editable) · Donations · Requests · Activity
     Approve / suspend / delete all live in the same header, so a new
     feature only adds a tab — it never needs a new page.
     ══════════════════════════════════════════════════════════════ */
  SUBS.donor={title:"রক্তদাতার প্রোফাইল",perm:"donor.view"};
  let dvTab="over", dvId=null;
  
  function openDonor(id){dvId=id;dvTab="over";go(CUR,"donor",true,id)}
  
  SUBP.donor=el=>{
    const d=DB.donors.find(x=>x.id===(ARG||dvId));
    if(!d)return el.innerHTML=`<div class="card">${emptyBox("search","রক্তদাতা পাওয়া যায়নি")}</div>`;
    dvId=d.id;
    const rest=d.last?Math.max(0,DB.rules.interval-dayDiff(d.last)):0;
    const ready=readyOf(d);
    const tabs=[["over","সংক্ষিপ্ত"],["info","তথ্য"],["don","রক্তদান"],["req","আবেদন"],["act","কার্যকলাপ"]];
  
    el.innerHTML=`
      <div class="card">
        <div class="per lg">
          <img src="${AV(d.gender,d.photo)}" alt="">
          <div class="i">
            <b style="font-size:1rem">${esc(d.name)}</b>
            <small>${d.id} · ${esc(d.area)}</small>
            <small>${esc(d.gender)} · ${bn(d.age)} বছর</small>
          </div>
          <span class="bg2" style="width:46px;height:46px;border-radius:12px;font-size:1rem">${d.group}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:11px">
          ${d.suspended?`<span class="pill r">স্থগিত</span>`
            :ready?`<span class="pill g">রক্ত দিতে প্রস্তুত</span>`
            :rest?`<span class="pill m">বিশ্রামে · ${bn(rest)} দিন বাকি</span>`
            :`<span class="pill a">নিজে বন্ধ রেখেছেন</span>`}
          ${d.verified?`<span class="pill b">যাচাইকৃত</span>`:`<span class="pill a">যাচাই বাকি</span>`}
          <span class="tag">${bn(d.donations)} বার দান</span>
        </div>
        <div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap">
          ${can("contact.reveal")?`<a class="btn sm" style="flex:1" href="tel:${esc(d.phone)}">${SI.phone(15)} কল</a>`:""}
          ${can("donor.edit")?`<button class="btn gh sm" style="flex:1" data-dact="edit">${SI.edit(15)} সম্পাদনা</button>`:""}
          <button class="btn gh sm" style="flex:1" data-dact="more">${SI.gear(15)} আরও</button>
        </div>
      </div>
      <div class="strip tabs" id="dvt">${tabs.map(([k,t])=>
        `<button data-dv="${k}" class="${dvTab===k?"on":""}">${t}</button>`).join("")}</div>
      <div id="dvbody"></div>`;
  
    const body=$("#dvbody");
    const P={};
  
    P.over=()=>`
      <div class="astat">
        <button class="r"><b>${bn(d.donations)}</b><span>মোট রক্তদান</span></button>
        <button class="g"><b>${d.last?bn(dayDiff(d.last)):"—"}</b><span>${d.last?"দিন আগে শেষ দান":"শেষ দানের তথ্য নেই"}</span></button>
        <button class="b"><b>${bn(donorReqs(d).length)}</b><span>সাড়া দিয়েছেন</span></button>
        <button class="a"><b>${bn(Math.max(0,Math.floor((Date.now()-new Date(d.joined))/864e5/30)))}</b><span>মাস ধরে আছেন</span></button>
      </div>
      <div class="sec-t">রক্তদানের প্রস্তুতি</div>
      <div class="card">
        <div class="stp">${["আবেদন","যাচাই","অনুমোদিত",ready?"প্রস্তুত":rest?"বিশ্রামে":"বন্ধ"].map((t,i)=>
          `<span class="${i<=(d.suspended?1:d.verified?(ready?3:2):1)?"ok":""}"><i>${
            i<=(d.suspended?1:d.verified?(ready?3:2):1)?"✓":bn(i+1)}</i>${t}</span>`).join("")}</div>
        <p class="hint2" style="margin-top:11px">${d.suspended?"অ্যাকাউন্ট স্থগিত — পাবলিক তালিকায় নেই।"
          :ready?"এখনই রক্ত দিতে পারবেন, পাবলিক তালিকায় দেখা যাচ্ছে।"
          :rest?`${dL(addD(d.last,DB.rules.interval))} তারিখে আবার দিতে পারবেন (${bn(rest)} দিন বাকি)।`
          :!d.available?"ডোনার নিজে প্রাপ্যতা বন্ধ রেখেছেন — তাই তালিকায় আসছেন না।"
          :"শেষ রক্তদানের তথ্য নেই।"}</p>
      </div>
      <div class="sec-t">যোগাযোগ</div>
      <div class="card pad0">
        <div class="row"><span class="ic">${SI.phone(18)}</span>
          <span class="tx"><b>${esc(maskPhone(d.phone))}</b><small>মোবাইল</small></span>
          ${can("contact.reveal")?`<span class="rt"><a class="btn gh sm" href="tel:${esc(d.phone)}">কল</a></span>`
            :`<span class="rt"><span class="tag">গোপন</span></span>`}</div>
        <div class="row"><span class="ic">${SI.pin(18)}</span>
          <span class="tx"><b>${esc(d.area)}</b><small>এলাকা</small></span></div>
      </div>
      <div class="sec-t">কারা এই রক্ত নিতে পারবেন</div>
      <div class="card">
        <p class="hint2" style="margin-bottom:9px">${d.group} রক্ত দিতে পারবেন —</p>
        <div class="pms">${CAN_GIVE[d.group].map(g=>`<span class="on">${g}</span>`).join("")}</div>
      </div>`;
  
    P.info=()=>{
      const ro=!can("donor.edit");
      return `${ro?`<div class="note i">${SI.info(17)}<span>আপনার শুধু দেখার অনুমতি আছে।</span></div>`:""}
      <div class="sec-t">পরিচয়</div>
      <div class="card pad0">
        ${dRow("নাম",d.name,"name",ro)}
        ${dRow("লিঙ্গ",d.gender,"gender",ro)}
        ${dRow("বয়স",bn(d.age)+" বছর","age",ro)}
        ${dRow("মোবাইল",maskPhone(d.phone),"phone",ro)}
      </div>
      <div class="sec-t">রক্ত ও অবস্থান</div>
      <div class="card pad0">
        ${dRow("রক্তের গ্রুপ",d.group,"group",ro)}
        ${dRow("এলাকা",d.area,"area",ro)}
        ${dRow("সর্বশেষ রক্তদান",d.last?dL(d.last):"তথ্য নেই","last",ro)}
      </div>
      <div class="sec-t">অবস্থা</div>
      <div class="card pad0">
        <div class="row"><span class="tx"><b>রক্তদানে প্রস্তুত</b>
          <small>${d.available?"ডোনার নিজে চালু রেখেছেন":"ডোনার নিজে বন্ধ রেখেছেন"}</small></span>
          <button class="tg ${d.available?"on":""}" ${ro?"disabled":""} data-dtg="available"></button></div>
        <div class="row"><span class="tx"><b>যাচাইকৃত</b>
          <small>যাচাই করলে পাবলিক তালিকায় দেখা যাবে</small></span>
          <button class="tg ${d.verified?"on":""}" ${ro?"disabled":""} data-dtg="verified"></button></div>
        <div class="row"><span class="tx"><b>স্থগিত</b>
          <small>স্থগিত করলে কোথাও দেখা যাবে না</small></span>
          <button class="tg ${d.suspended?"on":""}" ${ro?"disabled":""} data-dtg="suspended"></button></div>
      </div>
      <div class="sec-t">সিস্টেম</div>
      <div class="card pad0">
        <div class="row"><span class="tx"><b>ডোনার আইডি</b><small>${d.id}</small></span></div>
        <div class="row"><span class="tx"><b>যুক্ত হয়েছেন</b><small>${dL(d.joined)}</small></span></div>
      </div>`;
    };
  
    P.don=()=>{
      const list=donorDonations(d);
      return `${can("donor.edit")?`<button class="btn w" style="margin-bottom:12px" data-dact="addDon">
          ${SI.plus(16)} রক্তদান যোগ করুন</button>`:""}
        ${list.length?`<div class="card pad0">${list.map(x=>`<div class="row">
          <span class="ic" style="background:var(--red-s);color:var(--red)">${SI.drop(18)}</span>
          <span class="tx"><b>${esc(x.place)}</b><small>${dL(x.date)} · ${bn(x.bags)} ব্যাগ</small></span>
          <span class="rt">${x.ok?`<span class="pill g">যাচাইকৃত</span>`:`<span class="pill a">অপেক্ষমাণ</span>`}</span>
        </div>`).join("")}</div>`
        :`<div class="card">${emptyBox("drop","কোনো রক্তদানের রেকর্ড নেই",
          d.donations?"পুরনো "+bn(d.donations)+" বারের বিস্তারিত নেই":"এখনো রক্ত দেননি")}</div>`}
        ${d.last?`<div class="note g">${SI.checkC(17)}<span>সর্বশেষ রক্তদান <b>${dL(d.last)}</b> —
          ${rest?`আর ${bn(rest)} দিন পর আবার দিতে পারবেন।`:"এখন আবার দিতে পারবেন।"}</span></div>`:""}`;
    };
  
    P.req=()=>{
      const list=donorReqs(d);
      return list.length?`<div class="card pad0">${list.map(r=>`<button class="prow" data-rq="${r.id}">
          <span class="bg2">${r.group}</span>
          <span class="tx"><b>${esc(r.patient)}</b><small>${esc(r.hospital)} · ${timeAgo(r.at)}</small></span>
          ${statusPill(r.status)}</button>`).join("")}</div>`
        :`<div class="card">${emptyBox("warn","কোনো আবেদনে সাড়া দেননি",
          "এই ডোনার যেসব জরুরি আবেদনে সাড়া দেবেন তা এখানে দেখা যাবে")}</div>`;
    };
  
    P.act=()=>{
      const list=DB.audit.filter(a=>a.target===d.id||a.target.includes(d.name));
      return `<div class="card"><div class="tl">
        ${list.map(a=>`<div class="ti ${/বাতিল|মুছে|স্থগিত/.test(a.act)?"a":""}">
          <b>${esc(a.act)}</b><small>${esc(a.who)} · ${timeAgo(a.at)}</small></div>`).join("")}
        <div class="ti"><b>অ্যাকাউন্ট তৈরি</b><small>${dL(d.joined)}</small></div>
      </div></div>`;
    };
  
    const paint=()=>{
      body.innerHTML=(P[dvTab]||P.over)();
      body.querySelectorAll("[data-de]").forEach(b=>b.onclick=()=>editDonorField(d,b.dataset.de));
      body.querySelectorAll("[data-dtg]").forEach(b=>b.onclick=()=>{
        const k=b.dataset.dtg;
        d[k]=!d[k];b.classList.toggle("on",d[k]);
        logAudit(({available:"প্রাপ্যতা",verified:"যাচাই",suspended:"স্থগিত"})[k]+" পরিবর্তন",d.id,"donor");
        persist();paint();toast("হালনাগাদ হয়েছে","ok")});
      body.querySelectorAll("[data-rq]").forEach(b=>b.onclick=()=>go(CUR,"live"));
      body.querySelectorAll("[data-dact]").forEach(b=>b.onclick=()=>donorAction(b.dataset.dact,d));
    };
    paint();
    el.querySelectorAll("[data-dv]").forEach(b=>b.onclick=()=>{dvTab=b.dataset.dv;
      el.querySelectorAll("[data-dv]").forEach(x=>x.classList.toggle("on",x===b));paint()});
    el.querySelectorAll("[data-dact]").forEach(b=>b.onclick=()=>donorAction(b.dataset.dact,d));
  };
  const dRow=(t,v,key,ro)=>ro
    ? `<div class="row"><span class="tx"><b>${esc(t)}</b><small>${esc(v)}</small></span></div>`
    : `<button class="row" data-de="${key}"><span class="tx"><b>${esc(t)}</b><small>${esc(v)}</small></span>
       <span class="rt">${SI.right(17)}</span></button>`;
  /* donations & requests linked to a donor */
  function donorDonations(d){
    d.log=d.log||[];
    if(!d.log.length&&d.last)d.log.push({date:d.last,place:"চমেক ব্লাড ব্যাংক",bags:1,ok:true});
    return d.log.slice().sort((a,b)=>b.date.localeCompare(a.date));
  }
  function donorReqs(d){
    return DB.live.filter(r=>CAN_GIVE[d.group].includes(r.group)&&r.area===d.area);
  }
  function editDonorField(d,key){
    const F={
      name:{t:"নাম",type:"text"},gender:{t:"লিঙ্গ",type:"select",options:["পুরুষ","মহিলা"]},
      age:{t:"বয়স",type:"number"},phone:{t:"মোবাইল",type:"text",max:11},
      group:{t:"রক্তের গ্রুপ",type:"select",options:GROUPS},
      area:{t:"এলাকা",type:"select",options:AREAS},
      last:{t:"সর্বশেষ রক্তদান",type:"date"}
    }[key];
    const cur=key==="age"?d.age:d[key];
    const s=sheet(F.t+" বদলান",`<div class="f"><label>${esc(F.t)}</label>
      ${F.type==="select"?`<select id="di">${F.options.map(o=>
          `<option ${o===cur?"selected":""}>${esc(o)}</option>`).join("")}</select>`
        :F.type==="date"?`<input id="di" type="date" value="${esc(cur||"")}" max="${iso(now())}">`
        :`<input id="di" type="${F.type}" value="${esc(cur||"")}" ${F.max?`maxlength="${F.max}"`:""}>`}
      </div>`,`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="dok">সংরক্ষণ</button>`);
    s.q("#dok").onclick=()=>{
      let v=s.q("#di").value.trim();
      if(key==="name"&&v.length<3)return toast("নাম খুব ছোট","er");
      if(key==="phone"&&!phoneOK(v))return toast("সঠিক নম্বর দিন","er");
      if(key==="age"){v=+v;if(v<15||v>75)return toast("বয়স ১৫–৭৫ এর মধ্যে হতে হবে","er")}
      d[key]=v;logAudit("ডোনার তথ্য সম্পাদনা — "+F.t,d.id,"donor");persist();
      s.close();renderSub("donor");toast("সংরক্ষণ হয়েছে","ok")};
  }
  function donorAction(a,d){
    if(a==="edit"){dvTab="info";renderSub("donor");return}
    if(a==="addDon"){
      const s=sheet("রক্তদান যোগ করুন",`<div class="f">
        <label>তারিখ</label><input id="ad_d" type="date" value="${iso(now())}" max="${iso(now())}">
        <label>স্থান</label><input id="ad_p" placeholder="হাসপাতাল বা ক্যাম্পের নাম">
        <label>ব্যাগ</label><input id="ad_b" type="number" value="1" min="1" max="3"></div>`,
        `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ad_ok">যোগ করুন</button>`);
      s.q("#ad_ok").onclick=()=>{
        const dt=s.q("#ad_d").value,pl=s.q("#ad_p").value.trim()||"অজানা স্থান";
        if(!dt)return toast("তারিখ দিন","er");
        d.log=d.log||[];d.log.push({date:dt,place:pl,bags:+s.q("#ad_b").value||1,ok:true});
        d.donations++;if(!d.last||dt>d.last)d.last=dt;
        logAudit("রক্তদান যোগ",d.id+" — "+dL(dt),"donation");persist();
        s.close();renderSub("donor");toast("রক্তদান যোগ হয়েছে","ok")};
      return;
    }
    if(a==="more"){
      const s=sheet(d.name,`<div class="card pad0" style="margin:0">
        ${can("donor.edit")?`<button class="row" data-m="verify"><span class="ic" style="background:var(--grn-s);color:var(--grn)">${SI.checkC(18)}</span>
          <span class="tx"><b style="color:var(--grn-d)">${d.verified?"যাচাই বাতিল":"যাচাইকৃত করুন"}</b>
          <small>${d.verified?"পাবলিক তালিকা থেকে সরবে":"পাবলিক তালিকায় দেখা যাবে"}</small></span></button>`:""}
        ${can("user.suspend")?`<button class="row" data-m="susp"><span class="ic" style="background:var(--amb-s);color:var(--amb)">${SI.lock(18)}</span>
          <span class="tx"><b style="color:var(--amb)">${d.suspended?"স্থগিত তুলুন":"স্থগিত করুন"}</b>
          <small>তথ্য মুছবে না, শুধু লুকানো থাকবে</small></span></button>`
         :`<button class="row" data-m="flag"><span class="ic" style="color:var(--amb)">${SI.warn(18)}</span>
          <span class="tx"><b>অ্যাডমিনের নজরে আনুন</b>
          <small>স্থগিত করার অনুমতি আপনার নেই — অ্যাডমিনকে জানান</small></span></button>`}
        <button class="row" data-m="copy"><span class="ic">${SI.card(18)}</span>
          <span class="tx"><b>তথ্য কপি করুন</b><small>নাম, গ্রুপ, এলাকা, নম্বর</small></span></button>
        ${can("data.export")?`<button class="row" data-m="csv"><span class="ic">${SI.dl(18)}</span>
          <span class="tx"><b>এই প্রোফাইল নামান</b><small>CSV ফাইল</small></span></button>`:""}
        ${ROLES[ME.role].perms.includes("team.manage")?`<button class="row" data-m="del">
          <span class="ic" style="background:var(--red-s);color:var(--red)">${SI.trash(18)}</span>
          <span class="tx"><b style="color:var(--red-d)">মুছে ফেলুন</b><small>শুধু সুপার অ্যাডমিন পারেন</small></span></button>`:""}
      </div>`,`<button class="btn gh w" data-close>বন্ধ</button>`);
      s.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{
        const m=b.dataset.m;s.close();
        if(m==="verify"){d.verified=!d.verified;
          logAudit(d.verified?"ডোনার যাচাই":"যাচাই বাতিল",d.id,"donor");persist();renderSub("donor");
          toast("হালনাগাদ হয়েছে","ok")}
        if(m==="susp"){
          if(!await confirmS({title:d.suspended?"স্থগিত তুলবেন?":"অ্যাকাউন্ট স্থগিত?",
            desc:d.suspended?"আবার পাবলিক তালিকায় দেখা যাবে।":"পাবলিক তালিকা থেকে লুকানো হবে।",
            danger:!d.suspended}))return;
          d.suspended=!d.suspended;logAudit(d.suspended?"ডোনার স্থগিত":"স্থগিত প্রত্যাহার",d.id,"donor");
          persist();renderSub("donor");toast("হালনাগাদ হয়েছে","ok")}
        if(m==="flag"){
          const fs=sheet("অ্যাডমিনের নজরে আনুন",
            `<p class="hint2" style="margin-bottom:9px">কেন এই রক্তদাতাকে অ্যাডমিনের দেখা দরকার তা লিখুন।
               এটি অপেক্ষমাণ কাজে রিপোর্ট হিসেবে যুক্ত হবে।</p>
             <textarea id="fl_t" rows="3" placeholder="কারণ…"></textarea>`,
            `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="fl_ok">${SI.send(15)} পাঠান</button>`);
          fs.q("#fl_ok").onclick=()=>{
            const t=fs.q("#fl_t").value.trim();
            if(!t)return toast("কারণ লিখতে হবে","er");
            DB.queue.unshift({kind:"report",id:"RP-"+(600+DB.queue.length),name:d.name,
              type:"মডারেটরের রিপোর্ট",text:t+" ("+d.id+")",at:new Date().toISOString()});
            logAudit("অ্যাডমিনের নজরে আনা",d.id,"report");persist();
            fs.close();paintTop();paintNav();toast("অ্যাডমিনকে জানানো হয়েছে","ok")};
        }
        if(m==="copy"){
          const t=`${d.name}\n${d.group} · ${d.area}\n${maskPhone(d.phone)}\n${d.id}`;
          navigator.clipboard?.writeText(t).then(()=>toast("কপি হয়েছে","ok"),()=>toast("কপি করা যায়নি","er"))}
        if(m==="csv"){
          dlFile(`${d.id}.csv`,toCSV([[d.id,d.name,d.group,d.area,maskPhone(d.phone),d.age,d.gender,
            d.last,d.donations,d.suspended?"স্থগিত":"সক্রিয়"]],
            ["আইডি","নাম","গ্রুপ","এলাকা","ফোন","বয়স","লিঙ্গ","শেষ দান","মোট দান","অবস্থা"]));
          logAudit("প্রোফাইল রপ্তানি",d.id,"data");toast("ফাইল নামছে","ok")}
        if(m==="del"){
          if(!await confirmS({title:"স্থায়ীভাবে মুছবেন?",
            desc:"এই রক্তদাতার সব তথ্য মুছে যাবে। সাধারণত স্থগিত করাই ভালো — মুছলে ফেরানো যায় না।",
            ok:"মুছে ফেলুন",danger:true}))return;
          DB.donors=DB.donors.filter(x=>x.id!==d.id);
          logAudit("ডোনার মুছে ফেলা",d.id+" — "+d.name,"donor");persist();
          go(CUR,"donors");toast("মুছে ফেলা হয়েছে")}
      });
    }
  }
  
  /* ══════════════════════════════════════════════════════════════
     ACCESS & ROLES  —  grant panel access to an existing account
  
     Only a super admin reaches this page. It lists every account in the
     system (team members and ordinary users alike), searchable by name,
     @username or email, and lets one be promoted or demoted.
  
     Deliberate rules, all enforced here and echoed in the audit log:
       • you cannot change your own role
       • the last super admin can never be demoted
       • "super admin" is NOT grantable from the UI — it comes from the
         database only, so a compromised session cannot mint peers
       • a reason is mandatory and travels into the audit trail
       • the exact powers of the new role are shown BEFORE confirming
     ══════════════════════════════════════════════════════════════ */
  
  /* ---- the account directory ----------------------------------------
     Accounts are people who signed up. Some are donors, some are not.
     Donor records and accounts are linked by uid, never duplicated. */
  function seedAccounts(){
    /* Firebase is the single source of truth for accounts — no seeding. */
    return [];
  }
  if(!Array.isArray(DB.accounts))DB.accounts=[];

  
  const ROLE_ORDER=["user","mod","admin","super"];
  const ROLE_META={
    user:{label:"সাধারণ ব্যবহারকারী",icon:"🩸",desc:"শুধু ডোনার অ্যাপ ব্যবহার করতে পারবেন"},
    mod:{label:"মডারেটর",icon:"🔧",desc:"অপেক্ষমাণ আবেদন যাচাই ও অনুমোদন করবেন"},
    admin:{label:"অ্যাডমিন",icon:"🛡️",desc:"ওয়েবসাইট ও রক্তদাতা ব্যবস্থাপনা করবেন"},
    super:{label:"সুপার অ্যাডমিন",icon:"👑",desc:"সবকিছু — ভূমিকা দেওয়াসহ"}
  };
  /* super admin is intentionally absent: it is granted from the database */
  const GRANTABLE=["user","mod","admin"];
  const roleLabel=r=>(ROLE_META[r]||{}).label||r;
  const roleIcon=r=>(ROLE_META[r]||{}).icon||"🩸";
  const isStaff=r=>r&&r!=="user";
  const superCount=()=>DB.accounts.filter(a=>a.role==="super").length;
  
  let acFilter="all", acQuery="";
  
  SUBP.access=el=>{
    if(!can("access.manage"))return el.innerHTML=noPerm();
    const q=acQuery.trim().toLowerCase();
    let list=DB.accounts.filter(a=>{
      if(acFilter==="staff"&&!isStaff(a.role))return false;
      if(acFilter==="user"&&isStaff(a.role))return false;
      if(!q)return true;
      return [a.name,a.username,a.email,a.donorId].join(" ").toLowerCase().includes(q);
    });
    /* staff first, then alphabetical — the people you manage are on top */
    list.sort((a,b)=>(ROLE_ORDER.indexOf(b.role)-ROLE_ORDER.indexOf(a.role))
      ||a.name.localeCompare(b.name,"bn"));
    const staffN=DB.accounts.filter(a=>isStaff(a.role)).length;
    const userN=DB.accounts.length-staffN;
  
    el.innerHTML=`
      <div class="note i">${SI.info(17)}<span>${tp(
        "যাকে অ্যাক্সেস দেবেন তার অ্যাকাউন্ট আগে থেকেই থাকতে হবে। নাম, ইউজারনেম বা ইমেইল দিয়ে খুঁজুন।",
        "The person must already have an account. Search by name, username or email.")}</span></div>
      <div class="f"><input id="acq" placeholder="নাম, ইউজারনেম বা ইমেইল…"
        value="${esc(acQuery)}" autocomplete="off"></div>
      <div class="strip chips" id="acf">
        <button data-f="all" class="${acFilter==="all"?"on":""}">সবাই <i class="c">${bn(DB.accounts.length)}</i></button>
        <button data-f="staff" class="${acFilter==="staff"?"on":""}">টিমে আছে <i class="c">${bn(staffN)}</i></button>
        <button data-f="user" class="${acFilter==="user"?"on":""}">সাধারণ <i class="c">${bn(userN)}</i></button>
      </div>`
    +(list.length
      ? `<div class="card pad0">${list.map(a=>`<button class="prow" data-ac="${a.uid}">
          <span class="bg2" style="${isStaff(a.role)
            ?"background:var(--grn-s);color:var(--grn)":"background:var(--red-s);color:var(--red-d)"}"
            >${roleIcon(a.role)}</span>
          <span class="tx"><b>${esc(a.name)}${a.uid===ME.uid?tp(" (আপনি)"," (you)"):""}</b>
            <small>@${esc(a.username)} · ${esc(a.email)}</small></span>
          <span class="tag ${a.role==="super"?"a":isStaff(a.role)?"g":""}">${roleLabel(a.role)}</span>
        </button>`).join("")}</div>`
      : `<div class="card">${emptyBox("search","কেউ মেলেনি",
          "অন্য নাম, ইউজারনেম বা ইমেইল দিয়ে চেষ্টা করুন")}</div>`)
    +`<div class="sec-t">নিয়ম</div>
      <div class="card"><ul class="wl">
        <li>${tp("নিজের ভূমিকা নিজে বদলানো যায় না","You cannot change your own role")}</li>
        <li>${tp("শেষ সুপার অ্যাডমিনকে নামানো যায় না","The last super admin cannot be demoted")}</li>
        <li>${tp("সুপার অ্যাডমিন ভূমিকা শুধু ডেটাবেজ থেকে দেওয়া হয়","Super admin is granted from the database only")}</li>
        <li>${tp("প্রতিটি পরিবর্তন কারণসহ অডিট লগে থাকে","Every change is logged with its reason")}</li>
      </ul></div>`;
  
    let t;
    $("#acq").oninput=e=>{acQuery=e.target.value;clearTimeout(t);
      t=setTimeout(()=>{renderSub("access");
        const i=$("#acq");i.focus();i.setSelectionRange(i.value.length,i.value.length)},280)};
    el.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{acFilter=b.dataset.f;renderSub("access")});
    el.querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>accessSheet(b.dataset.ac));
  };
  
  /* what a role can and cannot do, in plain Bangla */
  function rolePowers(role){
    if(role==="user")return {can:["ডোনার অ্যাপ ব্যবহার","নিজের তথ্য বদলানো"],
      cant:["প্যানেলে ঢোকা"]};
    const perms=ROLES[role]?ROLES[role].perms:[];
    const nice=p=>PERM_LABEL[p]||p;
    const all=PERMS;
    return {can:perms.slice(0,6).map(nice),
      cant:all.filter(p=>!perms.includes(p)).slice(0,4).map(nice)};
  }
  
  function accessSheet(uid){
    const a=DB.accounts.find(x=>x.uid===uid);if(!a)return;
    const isMe=uid===ME.uid;
    const lastSuper=a.role==="super"&&superCount()<2;
    const donor=a.donorId?DB.donors.find(d=>d.id===a.donorId):null;
    let pick=a.role;
  
    const body=()=>`
      <div class="per"><span class="bg2" style="width:46px;height:46px;border-radius:50%;
        ${isStaff(a.role)?"background:var(--grn-s);color:var(--grn)":"background:var(--red-s);color:var(--red-d)"};
        font-size:1.15rem">${roleIcon(a.role)}</span>
        <div class="i"><b>${esc(a.name)}</b><small>@${esc(a.username)}</small>
          <small>${esc(a.email)}</small></div></div>
      <div class="kv" style="margin-top:12px">
        <div><span>বর্তমান ভূমিকা</span><b>${roleLabel(a.role)}</b></div>
        <div><span>যুক্ত হয়েছেন</span><b>${dL(a.joined)}</b></div>
        ${donor?`<div><span>ডোনার আইডি</span><b>${donor.id}</b></div>
          <div><span>রক্তের গ্রুপ</span><b>${donor.group} · ${esc(donor.area)}</b></div>`:
          `<div><span>ডোনার</span><b>${tp("নন","No")}</b></div>`}
      </div>
      ${isMe?`<div class="note w" data-noi18n>${SI.warn(17)}<span>${tp(
          "নিরাপত্তার জন্য নিজের ভূমিকা নিজে বদলানো যায় না।",
          "For safety you cannot change your own role.")}</span></div>`:""}
      ${lastSuper&&!isMe?`<div class="note w" data-noi18n>${SI.warn(17)}<span>${tp(
          "ইনিই একমাত্র সুপার অ্যাডমিন — নামালে সিস্টেম নিয়ন্ত্রণহীন হয়ে যাবে।",
          "This is the only super admin — demoting them would leave the system without an owner.")}</span></div>`:""}
      ${a.role==="super"?`<p class="hint2" style="margin-top:10px">${tp(
        "সুপার অ্যাডমিনের ভূমিকা এখান থেকে বদলানো যায় না।",
        "A super admin's role cannot be changed from here.")}</p>`:`
        <div class="sec-t">নতুন ভূমিকা</div>
        <div class="strip wrap chips" id="acr">${GRANTABLE.map(r=>
          `<button data-r="${r}" class="${pick===r?"on":""}" ${isMe?"disabled":""}
            >${ROLE_META[r].icon} ${ROLE_META[r].label}</button>`).join("")}</div>
        <div id="acpw"></div>
        <div class="sec-t">কারণ <i style="color:var(--red)">*</i></div>
        <textarea id="acwhy" rows="2" placeholder="কেন এই পরিবর্তন করছেন…" ${isMe?"disabled":""}></textarea>`}`;
  
    const s=sheet("অ্যাক্সেস ও ভূমিকা",body(),
      (isMe||a.role==="super")
        ? `<button class="btn gh w" data-close>বন্ধ</button>`
        : `<button class="btn gh" data-close>বাতিল</button>
           <button class="btn" id="acok">${SI.key(15)} সংরক্ষণ</button>`);
  
    const paintPowers=()=>{
      const box=s.q("#acpw");if(!box)return;
      if(pick===a.role){box.innerHTML=
        `<p class="hint2" style="margin-top:10px">${tp("এটিই বর্তমান ভূমিকা।","This is the current role.")}</p>`;return}
      const p=rolePowers(pick);
      box.innerHTML=`
        <div class="card flat" style="margin-top:11px;background:var(--card2)">
          <b style="font-size:.82rem;display:block;margin-bottom:6px">${ROLE_META[pick].icon} ${ROLE_META[pick].label}</b>
          <p class="hint2" style="margin-bottom:8px">${esc(ROLE_META[pick].desc)}</p>
          <div style="font-size:.78rem;line-height:1.85">
            <b style="color:var(--grn)">${tp("যা পারবেন","Can do")}</b>
            <ul class="wl" style="margin:2px 0 8px">${p.can.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
            ${p.cant.length?`<b style="color:var(--red-d)">${tp("যা পারবেন না","Cannot do")}</b>
            <ul class="wl" style="margin:2px 0 0">${p.cant.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
          </div></div>`;
    };
    paintPowers();
  
    s.querySelectorAll("#acr button").forEach(b=>b.onclick=()=>{
      if(isMe)return;
      s.querySelectorAll("#acr button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");pick=b.dataset.r;paintPowers()});
  
    const ok=s.q("#acok");
    if(ok)ok.onclick=async()=>{
      if(pick===a.role)return toast(tp("ভূমিকা বদলানো হয়নি","Role unchanged"));
      const why=(s.q("#acwhy").value||"").trim();
      if(why.length<4)return toast(tp("কারণ লিখতে হবে","A reason is required"),"er");
      if(a.role==="super"&&superCount()<2)
        return toast(tp("শেষ সুপার অ্যাডমিনকে নামানো যাবে না","The last super admin cannot be demoted"),"er");
      const grant=isStaff(pick);
      if(!await confirmS({
        title:grant?tp("অ্যাক্সেস দেবেন?","Grant access?"):tp("অ্যাক্সেস তুলে নেবেন?","Revoke access?"),
        desc:grant
          ?`${a.name} ${tp("এখন থেকে","will now be a")} ${ROLE_META[pick].label} ${tp("হিসেবে প্যানেলে ঢুকতে পারবেন।","and can sign in to the panel.")}`
          :`${a.name} ${tp("আর প্যানেলে ঢুকতে পারবেন না। ডোনার অ্যাকাউন্ট ঠিক থাকবে।","will no longer reach the panel. Their donor account is untouched.")}`,
        ok:grant?tp("অ্যাক্সেস দিন","Grant"):tp("তুলে নিন","Revoke"),danger:!grant}))return;
  
      const before=a.role;
      a.role=pick;
      /* keep the team list in step: staff appear there, users do not */
      const tIdx=DB.team.findIndex(t=>t.uid===a.uid);
      if(isStaff(pick)){
        if(tIdx<0)DB.team.push({uid:a.uid,name:a.name,role:pick,last:new Date().toISOString()});
        else DB.team[tIdx].role=pick;
      }else if(tIdx>=0)DB.team.splice(tIdx,1);
  
      logAudit(grant?"অ্যাক্সেস দেওয়া হয়েছে":"অ্যাক্সেস তুলে নেওয়া হয়েছে",
        `${a.name} · ${roleLabel(before)} → ${roleLabel(pick)} — ${why.slice(0,60)}`,"access");
      persist();s.close();renderSub("access");paintNav();paintTop();
      toast(grant?tp(a.name+" এখন "+ROLE_META[pick].label,a.name+" is now "+ROLE_META[pick].label)
                 :tp("অ্যাক্সেস তুলে নেওয়া হয়েছে","Access revoked"),"ok");
    };
  }
  
  /* ---------- website editor + live preview ---------- */
  function previewDoc(){
    const s=DB.site,c=bloodCounts();
    return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:"SolaimanLipi",system-ui,sans-serif;background:#f6f7f8;color:#16181c}
      .nv{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid #e6e8eb}
      .nv i{width:26px;height:26px;border-radius:7px;background:#e0242f;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;font-style:normal}
      .nv b{font-size:12px}
      .hr{padding:30px 16px;text-align:center;background:linear-gradient(160deg,#e0242f,#8f1119);color:#fff}
      .hr h1{font-size:23px;margin-bottom:7px;line-height:1.3}
      .hr p{font-size:12px;opacity:.93;max-width:480px;margin:0 auto 14px;line-height:1.6}
      .cta{display:inline-block;padding:8px 18px;border-radius:8px;background:#fff;color:#e0242f;font-size:12px;font-weight:800}
      .st{display:flex;gap:8px;padding:14px}
      .st div{flex:1;background:#fff;border:1px solid #e6e8eb;border-radius:11px;padding:11px 6px;text-align:center}
      .st b{display:block;font-size:18px;color:#087a4b}
      .st span{font-size:10px;color:#6b7280}
      .em{margin:0 14px 14px;padding:12px 14px;border-radius:11px;background:#fdecec;border:1px solid #f6c9cb;font-size:11.5px;line-height:1.6}
      .em b{color:#b3181f}
      .gl{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 14px 14px}
      .gl i{display:block;aspect-ratio:4/3;border-radius:9px;background:#dfe3e8}
      .ft{padding:15px;background:#16181c;color:#c9ced6;font-size:11px;line-height:1.95}
    </style></head><body>
    <div class="nv"><i>CB</i><b>চকবাজার ব্লাড ডোনার'স ক্লাব</b></div>
    <div class="hr"><h1>${esc(s.heroTitle)}</h1><p>${esc(s.heroText)}</p><span class="cta">রক্তদাতা খুঁজুন</span></div>
    ${s.showStats?`<div class="st">
      <div><b>${bn(DB.donors.length)}</b><span>রক্তদাতা</span></div>
      <div><b>${bn(DB.donors.reduce((a,d)=>a+d.donations,0))}</b><span>রক্তদান</span></div>
      <div><b>${bn(Object.values(c).reduce((a,b)=>a+b,0))}</b><span>প্রস্তুত</span></div></div>`:""}
    ${s.showEmergency?`<div class="em"><b>জরুরি হটলাইন:</b> ${esc(s.phone)} — ২৪ ঘণ্টা খোলা</div>`:""}
    ${s.showGallery?`<div class="gl">${DB.gallery.filter(g=>g.status==="published").map(()=>`<i></i>`).join("")||"<i></i><i></i><i></i>"}</div>`:""}
    <div class="ft">${esc(s.address)}<br>${esc(s.phone)} · ${esc(s.email)}<br>${esc(s.facebook)}</div>
    </body></html>`;
  }
  SUBP.site=el=>{
    const s=DB.site,ro=!can("website.edit");
    el.innerHTML=`<div class="card">
        <div class="strip seg pvsz" id="pvs">
          <button data-v="mob" class="${pvSize==="mob"?"on":""}">মোবাইল</button>
          <button data-v="tab" class="${pvSize==="tab"?"on":""}">ট্যাব</button>
          <button data-v="desk" class="${pvSize==="desk"?"on":""}">ডেস্কটপ</button></div>
        <div class="pv"><div class="pvb"><i></i><i></i><i></i><span>cbdc.example.com</span></div>
          <iframe id="pvf" title="ওয়েবসাইটের পূর্বরূপ"></iframe></div>
        <p class="hint2" style="margin-top:8px">লেখা বদলালেই এখানে সঙ্গে সঙ্গে দেখা যায়।</p></div>
      <div class="sec-t">হেডলাইন</div>
      <div class="card"><div class="f">
        <label>বড় শিরোনাম</label><input id="s_ht" value="${esc(s.heroTitle)}" ${ro?"disabled":""}>
        <label>সংক্ষিপ্ত পরিচিতি</label><textarea id="s_hx" rows="3" ${ro?"disabled":""}>${esc(s.heroText)}</textarea>
      </div></div>
      <div class="sec-t">যোগাযোগের তথ্য</div>
      <div class="card"><div class="f">
        <label>হটলাইন নম্বর</label><input id="s_ph" value="${esc(s.phone)}" ${ro?"disabled":""}>
        <label>ইমেইল</label><input id="s_em" value="${esc(s.email)}" ${ro?"disabled":""}>
        <label>ঠিকানা</label><input id="s_ad" value="${esc(s.address)}" ${ro?"disabled":""}>
        <label>ফেসবুক পেজ</label><input id="s_fb" value="${esc(s.facebook)}" ${ro?"disabled":""}>
      </div></div>
      <div class="sec-t">কোন অংশ দেখা যাবে</div>
      <div class="card pad0">${[["showStats","পরিসংখ্যান ব্লক"],["showGallery","গ্যালারি"],["showEmergency","জরুরি হটলাইন ব্যানার"]]
        .map(([k,t])=>`<label class="row" style="cursor:pointer">
          <span class="tx"><b>${t}</b><small>${s[k]?"এখন দেখা যাচ্ছে":"এখন লুকানো"}</small></span>
          <input type="checkbox" data-tg="${k}" ${s[k]?"checked":""} ${ro?"disabled":""}
            style="width:20px;height:20px;accent-color:var(--grn);flex:none"></label>`).join("")}</div>
      ${ro?`<p class="hint2" style="margin-top:12px">আপনার শুধু দেখার অনুমতি আছে।</p>`
         :`<button class="btn w" style="margin-top:12px" id="stSave">${SI.check(16)} সংরক্ষণ করুন</button>`}`;
    const setSize=()=>{const f=$("#pvf");if(!f)return;
      f.style.width=pvSize==="mob"?"100%":pvSize==="tab"?"100%":"100%";
      f.style.height=pvSize==="mob"?"420px":pvSize==="tab"?"360px":"330px"};
    const pv=()=>{const f=$("#pvf");if(f){f.srcdoc=previewDoc();setSize()}};
    pv();
    el.querySelectorAll("#pvs button").forEach(b=>b.onclick=()=>{pvSize=b.dataset.v;renderSub("site")});
    if(ro)return;
    const live=()=>{s.heroTitle=$("#s_ht").value;s.heroText=$("#s_hx").value;s.phone=$("#s_ph").value;pv()};
    ["s_ht","s_hx","s_ph"].forEach(i=>$("#"+i).oninput=live);
    el.querySelectorAll("[data-tg]").forEach(c=>c.onchange=()=>{s[c.dataset.tg]=c.checked;persist();pv()});
    $("#stSave").onclick=()=>{
      Object.assign(s,{heroTitle:$("#s_ht").value.trim(),heroText:$("#s_hx").value.trim(),
        phone:$("#s_ph").value.trim(),email:$("#s_em").value.trim(),
        address:$("#s_ad").value.trim(),facebook:$("#s_fb").value.trim()});
      logAudit("ওয়েবসাইটের তথ্য হালনাগাদ","হোমপেজ","website");persist();
      toast("ওয়েবসাইট হালনাগাদ হয়েছে","ok")};
  };
  
  /* ---------- gallery ---------- */
  SUBP.gallery=el=>{
    const may=can("gallery.manage");
    el.innerHTML=(DB.gallery.length
      ?`<div class="ggrid">${DB.gallery.map(g=>`<div class="gi2">
          <img src="${esc(g.url)}" alt="${esc(g.title)}" loading="lazy"
            onerror="this.style.background='#e9edf1';this.removeAttribute('src')">
          <div class="gt"><b>${esc(g.title)}</b><small>${g.status==="published"?"প্রকাশিত":"খসড়া"}</small></div>
          ${may?`<div class="gx"><button data-gt="${g.id}">${g.status==="published"?"লুকান":"প্রকাশ"}</button>
            <button data-gd="${g.id}">মুছুন</button></div>`:""}
        </div>`).join("")}</div>`
      :`<div class="card">${emptyBox("cam","কোনো ছবি নেই","নিচের বাটন থেকে প্রথম ছবি যোগ করুন")}</div>`)
    +(may?`<button class="btn w" style="margin-top:12px" id="gUp">${SI.up(16)} ছবি যোগ করুন</button>`:"")
    +`<div class="sec-t">ImgBB সংযোগ</div>
      <div class="card"><div class="kv">
        <div><span>অবস্থা</span><b>${DB.integr.imgbbKey?"কী সংরক্ষিত":"কী দেওয়া হয়নি"}</b></div>
        <div><span>সর্বোচ্চ আকার</span><b>৩২ MB</b></div></div>
        <p class="hint2" style="margin-top:9px">নিয়ন্ত্রণ → নিয়ম ও সেটিংস থেকে API কী দিলে সরাসরি আপলোড চালু হবে।</p></div>`;
    el.querySelectorAll("[data-gt]").forEach(b=>b.onclick=()=>{
      const g=DB.gallery.find(x=>x.id===b.dataset.gt);
      g.status=g.status==="published"?"draft":"published";
      logAudit("গ্যালারি "+(g.status==="published"?"প্রকাশ":"লুকানো"),g.title,"gallery");
      persist();renderSub("gallery");toast("হালনাগাদ হয়েছে","ok")});
    el.querySelectorAll("[data-gd]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"ছবি মুছবেন?",desc:"ওয়েবসাইট থেকে সরে যাবে।",danger:true}))return;
      DB.gallery=DB.gallery.filter(x=>x.id!==b.dataset.gd);
      logAudit("গ্যালারি ছবি মুছে ফেলা",b.dataset.gd,"gallery");persist();renderSub("gallery");toast("মুছে ফেলা হয়েছে")});
    $("#gUp")&&($("#gUp").onclick=uploadSheet);
  };
  function uploadSheet(){
    const s=sheet("ছবি যোগ করুন",`
      <div class="dz" id="dz"><span>${SI.up(24)}</span><b>ছবি বেছে নিন</b>
        <small>JPG / PNG · সর্বোচ্চ ৩২ MB</small>
        <input type="file" id="fi" accept="image/*" hidden></div>
      <div class="f" style="margin-top:12px"><label>শিরোনাম</label>
        <input id="up_t" placeholder="যেমন: রক্তদান ক্যাম্প ২০২৬"></div>
      <div class="pgb hide" id="pg"><i></i></div>
      <p class="hint2" style="margin-top:9px">${DB.integr.imgbbKey
        ?"ImgBB কী পাওয়া গেছে — আপলোড হবে।":"ImgBB কী নেই — ছবিটি সাময়িকভাবে এই ডিভাইস থেকে দেখা যাবে।"}</p>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="up_ok">${SI.up(15)} আপলোড</button>`);
    const dz=s.q("#dz"),fi=s.q("#fi");let file=null,url="";
    dz.onclick=()=>fi.click();
    dz.ondragover=e=>{e.preventDefault();dz.classList.add("on")};
    dz.ondragleave=()=>dz.classList.remove("on");
    dz.ondrop=e=>{e.preventDefault();dz.classList.remove("on");if(e.dataTransfer.files[0])take(e.dataTransfer.files[0])};
    fi.onchange=()=>fi.files[0]&&take(fi.files[0]);
    function take(f){
      if(!/^image\//.test(f.type))return toast("ছবি ফাইল দিন","er");
      if(f.size>32*1024*1024)return toast("ফাইল ৩২ MB-র বেশি","er");
      file=f;url=URL.createObjectURL(f);
      dz.innerHTML=`<img src="${url}" style="max-height:110px;border-radius:9px"><b>${esc(f.name)}</b>
        <small>${bn((f.size/1024).toFixed(0))} KB</small>`;
      if(!s.q("#up_t").value)s.q("#up_t").value=f.name.replace(/\.[^.]+$/,"");
    }
    s.q("#up_ok").onclick=()=>{
      if(!file)return toast("আগে একটি ছবি বাছুন","er");
      const t=s.q("#up_t").value.trim()||"শিরোনামহীন";
      const pg=s.q("#pg");pg.classList.remove("hide");
      let p=0;const iv=setInterval(()=>{p+=ri(9,24);pg.firstElementChild.style.width=Math.min(100,p)+"%";
        if(p>=100){clearInterval(iv);
          DB.gallery.push({id:"IMG-"+(20+DB.gallery.length),title:t,url,status:"draft"});
          logAudit("গ্যালারিতে ছবি যোগ",t,"gallery");persist();s.close();renderSub("gallery");
          toast("ছবি যোগ হয়েছে — খসড়া অবস্থায়","ok")}},210);
    };
  }
  
  /* ---------- notices ---------- */
  SUBP.notice=el=>{
    const may=can("notice.manage");
    el.innerHTML=(DB.notices.length
      ?`<div class="card pad0">${DB.notices.map(n=>`<div class="row">
          <span class="ic" style="color:var(--grn)">${SI.bell(18)}</span>
          <span class="tx"><b>${esc(n.title)}</b><small>${esc(n.audience)} · ${dS(n.from)} – ${dS(n.to)}</small></span>
          <span class="rt"><span class="pill ${n.status==="published"?"g":"m"}">${n.status==="published"?"প্রকাশিত":"খসড়া"}</span>
          ${may?`<button class="btn gh sm" data-nd="${n.id}">${SI.trash(14)}</button>`:""}</span></div>`).join("")}</div>`
      :`<div class="card">${emptyBox("bell","কোনো নোটিশ নেই","ঘোষণা দিলে ওয়েবসাইট ও অ্যাপে দেখা যাবে")}</div>`)
    +(may?`<button class="btn w" style="margin-top:12px" id="nAdd">${SI.plus(16)} নতুন নোটিশ</button>`:"")
    +`<div class="sec-t">কোথায় দেখা যাবে</div>
      <div class="card"><ul class="wl">
        <li>ওয়েবসাইটের হোমপেজে ব্যানার হিসেবে</li>
        <li>ডোনার অ্যাপের হোম স্ক্রিনে</li>
        <li>নির্দিষ্ট গ্রুপ বা এলাকা বেছে দিলে শুধু তাদের কাছে</li></ul></div>`;
    el.querySelectorAll("[data-nd]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"নোটিশ মুছবেন?",danger:true}))return;
      DB.notices=DB.notices.filter(x=>x.id!==b.dataset.nd);
      logAudit("নোটিশ মুছে ফেলা",b.dataset.nd,"notice");persist();renderSub("notice");toast("মুছে ফেলা হয়েছে")});
    $("#nAdd")&&($("#nAdd").onclick=()=>{
      const s=sheet("নতুন নোটিশ",`<div class="f">
        <label>শিরোনাম</label><input id="n_t" placeholder="যেমন: রক্তদান ক্যাম্প ১৫ আগস্ট">
        <label>বিবরণ</label><textarea id="n_b" rows="3" placeholder="সংক্ষেপে লিখুন…"></textarea>
        <label>কারা দেখবে</label><select id="n_a"><option>সবাই</option>
          ${GROUPS.map(g=>`<option>${g} গ্রুপ</option>`).join("")}
          ${AREAS.map(a=>`<option>${a} এলাকা</option>`).join("")}</select>
        <label>শুরু</label><input id="n_f" type="date" value="${iso(now())}">
        <label>শেষ</label><input id="n_e" type="date" value="${addD(iso(now()),7)}">
      </div>`,`<button class="btn gh" id="n_dr">খসড়া</button><button class="btn" id="n_ok">${SI.send(15)} প্রকাশ</button>`);
      const save=st=>{
        const t=s.q("#n_t").value.trim();if(t.length<4)return toast("শিরোনাম লিখুন","er");
        DB.notices.unshift({id:"NT-"+(DB.notices.length+2),title:t,body:s.q("#n_b").value.trim(),
          audience:s.q("#n_a").value,status:st,from:s.q("#n_f").value,to:s.q("#n_e").value});
        logAudit(st==="published"?"নোটিশ প্রকাশ":"নোটিশ খসড়া",t,"notice");
        persist();s.close();renderSub("notice");toast(st==="published"?"নোটিশ প্রকাশিত":"খসড়া সংরক্ষিত","ok")};
      s.q("#n_ok").onclick=()=>save("published");
      s.q("#n_dr").onclick=()=>save("draft")});
  };
  
  /* ---------- inbox ---------- */
  SUBP.inbox=el=>{
    el.innerHTML=(DB.messages.length
      ?`<div class="card pad0">${DB.messages.map(m=>`<button class="row" data-ms="${m.id}">
          <span class="ic" style="color:${m.read?"var(--mut)":"var(--blu)"}">${SI.mail(18)}</span>
          <span class="tx"><b>${esc(m.name)}${m.read?"":" •"}</b><small>${esc(m.text)}</small></span>
          <span class="rt">${timeAgo(m.at)}</span></button>`).join("")}</div>`
      :`<div class="card">${emptyBox("mail","কোনো বার্তা নেই")}</div>`)
    +(unread()?`<button class="btn gh w" style="margin-top:12px" id="mAll">সব পড়া হিসেবে চিহ্নিত করুন</button>`:"");
    el.querySelectorAll("[data-ms]").forEach(b=>b.onclick=()=>{
      const m=DB.messages.find(x=>x.id===b.dataset.ms);m.read=true;persist();paintTop();
      sheet(m.name,`<div class="kv"><div><span>ফোন</span><b>${esc(maskPhone(m.phone))}</b></div>
        <div><span>সময়</span><b>${timeAgo(m.at)}</b></div></div>
        <div class="sec-t">বার্তা</div>
        <p style="font-size:.86rem;line-height:1.9">${esc(m.text)}</p>`,
        `<button class="btn gh" data-close>বন্ধ</button>
         <a class="btn" href="tel:${esc(m.phone)}">${SI.phone(15)} কল করুন</a>`);
      renderSub("inbox")});
    $("#mAll")&&($("#mAll").onclick=()=>{DB.messages.forEach(m=>m.read=true);persist();
      renderSub("inbox");paintTop();toast("সব পড়া হিসেবে চিহ্নিত","ok")});
  };
  
  /* ---------- stats ---------- */
  SUBP.stats=el=>{
    const c=bloodCounts(),tot=Object.values(c).reduce((a,b)=>a+b,0)||1;
    const months=[...Array(6)].map((_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));
      return {m:d.toLocaleDateString("bn-BD",{month:"short"}),v:ri(4,22)}});
    const mMax=Math.max(...months.map(m=>m.v));
    const colors=["#e0242f","#087a4b","#2563eb","#b3760a","#7c3aed","#0891b2","#be185d","#4d7c0f"];
    let acc=0;const seg=GROUPS.map((g,i)=>{const p=c[g]/tot*100;const t=`${colors[i]} ${acc}% ${acc+p}%`;acc+=p;return t});
    const low=GROUPS.filter(g=>c[g]<3);
    el.innerHTML=`<div class="astat">
        <button class="g"><b>${bn(DB.donors.length)}</b><span>রক্তদাতা</span></button>
        <button class="r"><b>${bn(tot)}</b><span>প্রস্তুত</span></button>
        <button class="b"><b>${bn(DB.donors.reduce((a,d)=>a+d.donations,0))}</b><span>মোট দান</span></button>
        <button class="a"><b>${bn(Math.round(DB.donors.filter(d=>d.donations>2).length/DB.donors.length*100))}%</b><span>নিয়মিত</span></button>
      </div>
      <div class="sec-t">গ্রুপের অনুপাত</div>
      <div class="card"><div class="donut">
        <div class="dw" style="background:conic-gradient(${seg.join(",")})"><b>${bn(tot)}</b></div>
        <div class="legend">${GROUPS.map((g,i)=>`<div><i style="background:${colors[i]}"></i>${g} — ${bn(c[g])}</div>`).join("")}</div>
      </div></div>
      <div class="sec-t">গ্রুপ অনুযায়ী প্রস্তুত ডোনার</div>
      <div class="card">${bloodBars()}</div>
      <div class="sec-t">গত ৬ মাসে রক্তদান</div>
      <div class="card">
        <div class="spark">${months.map(m=>`<i style="height:${Math.round(m.v/mMax*100)}%"><b>${bn(m.v)}</b></i>`).join("")}</div>
        <div class="sparkx">${months.map(m=>`<span>${m.m}</span>`).join("")}</div></div>
      <div class="sec-t">ঘাটতি সতর্কতা</div>
      <div class="card">${low.length
        ?`<ul class="wl">${low.map(g=>`<li><b>${g}</b> — ${tp(`মাত্র ${bn(c[g])} জন প্রস্তুত`,`only ${c[g]} ready`)}</li>`).join("")}</ul>
          <button class="btn sm w" style="margin-top:11px" data-sub="notice">${SI.bell(15)} ক্যাম্পের ঘোষণা দিন</button>`
        :emptyBox("check","সব গ্রুপে যথেষ্ট ডোনার আছে")}</div>
      ${can("data.export")?`<button class="btn gh w" style="margin-top:12px" id="sExp">${SI.dl(15)} রপ্তানি</button>`:""}`;
    $("#sExp")&&($("#sExp").onclick=exportSheet);
  };
  
  /* ---------- audit ---------- */
  SUBP.audit=el=>{
    const mods={donor:"ডোনার",donation:"রক্তদান",request:"আবেদন",gallery:"গ্যালারি",
      team:"টিম",website:"ওয়েবসাইট",notice:"নোটিশ",data:"তথ্য",settings:"সেটিংস"};
    const list=DB.audit.filter(a=>!aFil||a.mod===aFil);
    el.innerHTML=`<div class="strip chips" id="afil">
        <button class="${aFil===""?"on":""}" data-f="">সব</button>
        ${Object.entries(mods).map(([k,v])=>`<button class="${aFil===k?"on":""}" data-f="${k}">${v}</button>`).join("")}
      </div>
      <p class="hint2" style="margin-bottom:11px">অডিট লগ একবার লেখা হলে আর বদলানো যায় না।</p>`
    +(list.length?`<div class="card"><div class="tl">${list.slice(0,60).map(a=>`
        <div class="ti ${/বাতিল|মুছে|স্থগিত/.test(a.act)?"a":""}">
          <b>${esc(a.act)}</b>
          <small>${esc(a.target)} · ${esc(a.who)} (${ROLES[a.role].label}) · ${timeAgo(a.at)}</small></div>`).join("")}</div></div>`
      :`<div class="card">${emptyBox("file","এই ধরনের কোনো রেকর্ড নেই")}</div>`)
    +(can("data.export")?`<button class="btn gh w" style="margin-top:12px" id="aExp">${SI.dl(15)} রপ্তানি</button>`:"");
    el.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{aFil=b.dataset.f;renderSub("audit")});
    $("#aExp")&&($("#aExp").onclick=exportSheet);
  };
  
  /* ---------- rules & settings ---------- */
  SUBP.rules=el=>{
    const r=DB.rules;
    el.innerHTML=`<div class="sec-t">রক্তদানের নিয়ম</div>
      <div class="card"><div class="f">
        <label>সর্বনিম্ন বয়স</label><input id="r_min" type="number" value="${r.minAge}">
        <label>সর্বোচ্চ বয়স</label><input id="r_max" type="number" value="${r.maxAge}">
        <label>দুই দানের মাঝে বিশ্রাম (দিন)</label><input id="r_int" type="number" value="${r.interval}">
      </div>
      <p class="hint2" style="margin-top:9px">এই নিয়মগুলো আবেদন যাচাইয়ের সময় সতর্কতা হিসেবে দেখানো হয়।</p></div>
      <div class="sec-t">অনুমোদন প্রক্রিয়া</div>
      <div class="card pad0">${[["donorApproval","নতুন ডোনার অনুমোদন লাগবে"],["reqApproval","জরুরি আবেদন অনুমোদন লাগবে"]]
        .map(([k,t])=>`<label class="row" style="cursor:pointer">
          <span class="tx"><b>${t}</b><small>${r[k]?"চালু":"বন্ধ"}</small></span>
          <input type="checkbox" data-rl="${k}" ${r[k]?"checked":""}
            style="width:20px;height:20px;accent-color:var(--grn);flex:none"></label>`).join("")}</div>
      <div class="sec-t">সংযোগ</div>
      <div class="card"><div class="f">
        <label>ImgBB API কী</label><input id="i_key" value="${esc(DB.integr.imgbbKey)}" placeholder="কী পেস্ট করুন"></div>
        <div class="row" style="padding-left:0;padding-right:0;border:0;margin-top:6px">
          <span class="tx"><b>Firebase / Firestore</b>
            <small>"যুক্ত"</small></span>
          <span class="pill ${DB.integr.firebase?"g":"a"}">${DB.integr.firebase?"সক্রিয়":"অপেক্ষায়"}</span></div></div>
      <div class="sec-t">ডেটা</div>
      <div class="card"><div class="kv">
          <div><span>রক্তদাতা</span><b>${bn(DB.donors.length)}</b></div>
          <div><span>অপেক্ষমাণ</span><b>${bn(DB.queue.length)}</b></div>
          <div><span>অডিট রেকর্ড</span><b>${bn(DB.audit.length)}</b></div>
          <div><span>সংরক্ষণ</span><b>Firebase Cloud</b></div></div></div>
      <button class="btn w" style="margin-top:12px" id="rSave">${SI.check(16)} সংরক্ষণ করুন</button>`;
    el.querySelectorAll("[data-rl]").forEach(c=>c.onchange=()=>{r[c.dataset.rl]=c.checked;persist();renderSub("rules")});
    $("#rSave").onclick=()=>{
      r.minAge=+$("#r_min").value||18;r.maxAge=+$("#r_max").value||60;r.interval=+$("#r_int").value||90;
      DB.integr.imgbbKey=$("#i_key").value.trim();
      logAudit("সেটিংস হালনাগাদ","নিয়ম ও সংযোগ","settings");persist();
      toast("সেটিংস সংরক্ষিত","ok")};
  };
  
  /* ---------- global search ---------- */
  SUBP.search=el=>{
    el.innerHTML=`<div class="f"><input id="sq" placeholder="নাম, আইডি, এলাকা বা ফোন নম্বর…" autocomplete="off"></div>
      <div id="sout"><p class="hint2" style="margin-top:12px">রক্তদাতা, অপেক্ষমাণ আবেদন ও চলমান আবেদন — সব একসাথে খোঁজা হবে।</p></div>`;
    const inp=$("#sq"),out=$("#sout");
    inp.focus();
    const run=q=>{
      q=q.trim().toLowerCase();
      if(!q)return out.innerHTML=`<p class="hint2" style="margin-top:12px">রক্তদাতা, অপেক্ষমাণ আবেদন ও চলমান আবেদন — সব একসাথে খোঁজা হবে।</p>`;
      const dn=DB.donors.filter(d=>[d.name,d.id,d.area,d.phone].join(" ").toLowerCase().includes(q)).slice(0,8);
      const qq=DB.queue.filter(x=>[x.name,x.patient,x.id].join(" ").toLowerCase().includes(q)).slice(0,6);
      const lv=DB.live.filter(r=>[r.patient,r.id,r.group].join(" ").toLowerCase().includes(q)).slice(0,6);
      if(!dn.length&&!qq.length&&!lv.length)
        return out.innerHTML=`<div class="card">${emptyBox("search","কিছু পাওয়া যায়নি","অন্য শব্দ দিয়ে চেষ্টা করুন")}</div>`;
      out.innerHTML=
        (dn.length?`<div class="sec-t">রক্তদাতা (${bn(dn.length)})</div><div class="card pad0">${dn.map(d=>
          `<button class="prow" data-sd="${d.id}"><span class="bg2">${d.group}</span>
           <span class="tx"><b>${esc(d.name)}</b><small>${d.id} · ${esc(d.area)}</small></span>
           ${readyOf(d)?`<span class="pill g">প্রস্তুত</span>`:""}</button>`).join("")}</div>`:"")
       +(qq.length?`<div class="sec-t">অপেক্ষমাণ (${bn(qq.length)})</div><div class="card pad0">${qq.map(x=>
          `<button class="row" data-sq="${x.id}"><span class="ic">${SI[QK[x.kind].ic](18)}</span>
           <span class="tx"><b>${esc(x.name||x.patient)}</b><small>${QK[x.kind].t} · ${x.id}</small></span>
           <span class="rt">${SI.right(16)}</span></button>`).join("")}</div>`:"")
       +(lv.length?`<div class="sec-t">চলমান আবেদন (${bn(lv.length)})</div><div class="card pad0">${lv.map(r=>
          `<button class="prow" data-sl="${r.id}"><span class="bg2">${r.group}</span>
           <span class="tx"><b>${esc(r.patient)}</b><small>${esc(r.hospital)}</small></span>
           ${statusPill(r.status)}</button>`).join("")}</div>`:"");
      out.querySelectorAll("[data-sd]").forEach(b=>b.onclick=()=>openDonor(b.dataset.sd));
      out.querySelectorAll("[data-sq]").forEach(b=>b.onclick=()=>openReview(b.dataset.sq));
      out.querySelectorAll("[data-sl]").forEach(b=>b.onclick=()=>go(CUR,"live"));
    };
    let t;inp.oninput=e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>run(v),240)};
  };
  
  /* ══════════ BOOT ══════════ */
  (function boot(){
    applyPrefs();
    UI.init();          /* common UI runtime: strips, hit areas, viewport */
    watchI18n();
    if(isEN())document.documentElement.lang="en";
    const proceed=()=>{
      const [a,b]=location.hash.replace("#","").split("/");
      go(RENDER[a]?a:"home",b||null,false);
      if(isEN())translateNode(document.body);
    };
    /* Firebase Auth gate + ME identity/role/permission from Firestore (`admins`) */
    (async function authorize(){
      try{
        const shared=initSharedFirebase();
        const {onAuthStateChanged}=await import("firebase/auth");
        onAuthStateChanged(shared.auth, async (user)=>{
          if(!user){
            navigateToPage("home");
            return;
          }
          const email=String(user.email||"").toLowerCase();
          const {collection,query,where,getDocs,limit}=await import("firebase/firestore");
          let admin=null;
          try{
            const snap=await getDocs(query(collection(shared.db,"admins"),where("email","==",email),limit(1)));
            if(!snap.empty)admin={id:snap.docs[0].id,...snap.docs[0].data()};
          }catch(e){console.warn("admins lookup:",e&&e.message)}
          const r=String(admin&&admin.role||"").toLowerCase();
          const ok=PANEL.id==="super" ? (r==="super"||r==="admin") : (r==="mod"||r==="moderator");
          if(!ok){
            navigateToPage("home");
            return;
          }
          ME.uid=user.uid;
          ME.email=email||ME.email;
          ME.name=admin&&admin.name||user.displayName||ME.name;
          ME.username=admin&&admin.username||ME.username||"";
          ME.designation=admin&&admin.designation||ME.designation||"";
          ME.permissions=admin&&Array.isArray(admin.permissions)?admin.permissions:null;
          ME.role=PANEL.id==="super"?(r==="admin"?"admin":"super"):"mod";
          if(user.photoURL)ME.photo=ME.photo||user.photoURL;
          saveMe();
          paintTop();paintNav();
          proceed();
        });
      }catch(e){ console.warn("panel auth:", e&&e.message); proceed(); }
    })();
    window.DB=DB;window.ME=ME;window.go=go;window.toast=toast;window.persist=persist;
    window.setTab=v=>{wTab=v;go("work")};window.getTab=()=>wTab;
    window.getSub=()=>SUB;window.getCur=()=>CUR;window.saveMe=saveMe;window.isEN=isEN;window.applyLang=applyLang;window.setME=o=>{Object.assign(ME,o);saveMe()};
    if(window.CBDCShared)CBDCShared.subscribe((st,meta)=>{
      if(meta&&meta.source==="panel:"+PANEL.id)return;
      pullSharedState();
      if(!document.querySelector(".sheet"))go(CUR,SUB,false,ARG);
      paintNav();paintTop();
    });
  })();
  
  /* ══════════ SHEETS / MODALS ══════════ */
  function sheet(title,body,footer,opts={}){
    const ov=document.createElement("div");ov.className="ov";
    const sh=document.createElement("div");sh.className="sheet";
    sh.innerHTML=`<div class="grab"></div>
      <div class="hd"><h3>${esc(title)}</h3>${opts.lock?"":
        `<button class="x" data-close aria-label="বন্ধ">${ICON.x(19)}</button>`}</div>
      <div class="bd">${body}</div>${footer?`<div class="ft">${footer}</div>`:""}`;
    document.body.append(ov,sh);
    document.body.style.overflow="hidden";
    /* only restore scrolling when the LAST sheet closes — stacked sheets used to
       leave a dead overlay swallowing every click */
    const close=()=>{
      ov.remove();sh.remove();
      if(!document.querySelector(".sheet"))document.body.style.overflow="";
      document.querySelectorAll(".ov").forEach(o=>{if(!o.nextElementSibling?.classList.contains("sheet"))o.remove()});
    };
    if(!opts.lock)ov.onclick=close;
    sh.addEventListener("click",e=>{if(e.target.closest("[data-close]"))close()});
    sh.close=close;sh.q=s=>sh.querySelector(s);
    setTimeout(()=>sh.querySelector("input,select,textarea")?.focus(),120);
    return sh;
  }
  function confirmS({title,desc,ok="হ্যাঁ",cancel="বাতিল",danger}){
    return new Promise(res=>{
      const s=sheet(title,`<p class="mut" style="font-size:.83rem">${esc(desc||"")}</p>`,
        `<button class="btn gh" data-close>${esc(cancel)}</button>
         <button class="btn ${danger?"red":""}" id="cy">${esc(ok)}</button>`);
      s.q("#cy").onclick=()=>{s.close();res(true)};
      s.addEventListener("click",e=>{if(e.target.closest("[data-close]"))res(false)});
      document.querySelector(".ov").addEventListener("click",()=>res(false));
    });
  }
  
  /* ---------- toast ---------- */
  function toast(msg,kind=""){
    /* never assume the host exists — a toast must never be able to throw and
       abort the caller (logout used to die here when #toasts was missing) */
    let b=$("#toasts");
    if(!b){b=document.createElement("div");b.id="toasts";document.body.append(b)}
    if(b.lastElementChild&&b.lastElementChild.dataset.m===msg)return;
    const t=document.createElement("div");t.className=kind;t.dataset.m=msg;
    t.innerHTML=(kind==="ok"?ICON.checkC(17):kind==="er"?ICON.warn(17):ICON.info(17))+`<span>${esc(msg)}</span>`;
    b.append(t);setTimeout(()=>t.remove(),3200);
  }
  
}

export default function Moderator() {
  useEffect(() => {
    document.body.dataset.panel = "mod";
    initPage();
  }, []);

  return (
    <>
      <style>{pageCss}</style>
      <StaticShell />
    </>
  );
}
