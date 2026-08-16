// @ts-nocheck — এই ফাইলটি মূল HTML-এর JavaScript-এর verbatim (হুবহু) port।
// রূপান্তরের সময় runtime আচরণ ১০০% অপরিবর্তিত রাখাই লক্ষ্য; তাই legacy logic-কে
// TypeScript টাইপ-চেকিং থেকে মুক্ত রাখা হয়েছে। React shell ও shared store সম্পূর্ণ
// typed (src/lib/store.ts ও src/lib/firebase.ts দেখুন)।
/**
 * Doner.tsx
 * React + TypeScript port of doner.html — ডোনার (রক্তদাতা) প্যানেল।
 */
import { useEffect } from "react";
import "../lib/store";
import { initFirebase as initSharedFirebase } from "../lib/firebase";
import SITE from "../config/site";
import { uploadImage as imgbbUploadImage } from "../lib/imgbb";

/* ═══════════════════════════════════════════════════════════════════
   CSS — মূল doner.html-এর <style> ব্লক হুবহু কপি
   ═══════════════════════════════════════════════════════════════════ */
const pageCss = `/* ═══════════ TOKENS ═══════════ */
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
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
.btn.sm{min-height:36px;padding:7px 13px;font-size:.77rem;border-radius:9px}
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
.f input,.f select,.f textarea{width:100%;min-height:46px;padding:11px 13px;border:1px solid var(--line);
  border-radius:var(--r2);background:var(--card);font-size:.87rem}
.f textarea{min-height:84px;resize:vertical}
.f input:focus,.f select:focus,.f textarea:focus{outline:0;border-color:var(--grn);box-shadow:0 0 0 3px rgba(8,122,75,.1)}
.f input[readonly],.f input:disabled,.f select:disabled{background:var(--card2);color:var(--mut)}
.f .hint{display:block;margin-top:5px;font-size:.72rem;color:var(--mut)}
.f .hint.ok{color:var(--grn)} .f .hint.er{color:var(--red-d)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
@media(max-width:520px){.f2{grid-template-columns:1fr}}

.tg{position:relative;width:46px;height:27px;border-radius:99px;background:#cad6d1;transition:.18s;flex:none}
[data-theme="dark"] .tg{background:#31443e}
.tg:after{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;
  transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.tg.on{background:var(--grn)} .tg.on:after{left:22px}
.tg:disabled{opacity:.45}

.seg{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--card2);border:1px solid var(--line)}
.seg button{flex:1;padding:7px 10px;border-radius:8px;color:var(--mut);font-size:.76rem;font-weight:700}
.seg button.on{background:var(--card);color:var(--grn);box-shadow:var(--sh)}

.tabs{display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs button{padding:11px 15px;color:var(--mut);font-size:.83rem;font-weight:800;white-space:nowrap;
  border-bottom:3px solid transparent;margin-bottom:-1px}
.tabs button.on{color:var(--grn);border-bottom-color:var(--grn)}
.tabs .c{margin-left:5px;padding:1px 6px;border-radius:99px;background:var(--card2);font-size:.68rem}

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

/* ══════════ donor ID card (86×54mm ratio) ══════════ */
.cardwrap{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%}
.idc{width:100%;max-width:none;aspect-ratio:86/54;position:relative;overflow:hidden;border-radius:14px;color:#fff;
  display:block;flex:none;
  box-shadow:0 14px 34px rgba(4,42,30,.28);font-feature-settings:"lnum";
  background:linear-gradient(140deg,#0d7a52 0%,#075c3c 46%,#03301f 100%)}
.idc[data-t="red"]{background:linear-gradient(140deg,#c62630,#8d1017 46%,#4d060b)}
.idc[data-t="dark"]{background:linear-gradient(140deg,#2b3a35,#18241f 46%,#0a110e)}
.idc::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 88% -14%,rgba(255,255,255,.19),transparent 46%),
             radial-gradient(circle at 4% 108%,rgba(255,255,255,.09),transparent 42%)}
.idc::after{content:"";position:absolute;right:-52px;bottom:-74px;width:210px;height:210px;border-radius:50%;
  border:26px solid rgba(255,255,255,.05);pointer-events:none}
.idc>*{position:relative;z-index:2}
/* header strip */
.idc .hd{position:absolute;left:0;right:0;top:0;height:14.5%;display:flex;align-items:center;gap:7px;
  padding:0 3.3%;border-bottom:1px solid rgba(255,255,255,.16)}
.idc .hd .lg{width:22px;height:22px;border-radius:50%;background:#fff;display:grid;place-items:center;flex:none}
.idc .hd .lg svg{width:14px;height:14px}
.idc .hd b{font-size:clamp(.55rem,2.3vw,.72rem);font-weight:800;line-height:1.18;letter-spacing:.1px;display:block}
.idc .hd i{display:block;font-style:normal;font-size:clamp(.4rem,1.7vw,.5rem);font-weight:700;opacity:.68;letter-spacing:.5px}
.idc .hd .vf{margin-left:auto;display:flex;align-items:center;gap:3px;padding:2.5px 7px;border-radius:20px;flex:none;
  background:rgba(255,255,255,.15);font-size:.46rem;font-weight:800;white-space:nowrap}
.idc .hd .vf svg{width:9px;height:9px}
/* body */
.idc .bd{position:absolute;left:0;right:0;top:14.5%;bottom:10.8%;display:grid;grid-template-columns:auto 1fr auto;
  gap:3.2%;padding:0 3.3%;align-items:center}
.idc .ph{display:flex;flex-direction:column;justify-content:center}
.idc .ph img{width:min(21vw,74px);height:min(21vw,74px);aspect-ratio:1;border-radius:11px;object-fit:cover;
  border:2px solid rgba(255,255,255,.85);display:block}
.idc .bg{margin-top:6px;width:min(21vw,74px);height:21px;border-radius:7px;display:grid;place-items:center;
  background:#fff;color:#c8101d;font-size:.78rem;font-weight:800;letter-spacing:.3px}
.idc[data-t="red"] .bg{background:#fff;color:#8d1017}
.idc .nm{font-size:clamp(.78rem,3.4vw,1rem);font-weight:800;line-height:1.2;margin:0 0 2px;word-break:break-word}
.idc .rl{font-size:clamp(.46rem,1.9vw,.58rem);font-weight:700;opacity:.72;letter-spacing:.3px;margin-bottom:7px}
.idc .kv{display:grid;gap:4px;font-size:clamp(.48rem,2vw,.62rem);line-height:1.3}
.idc .kv div{display:flex;gap:6px;padding-bottom:3.5px;border-bottom:1px solid rgba(255,255,255,.1)}
.idc .kv div:last-child{border-bottom:0}
.idc .kv span{opacity:.6;flex:none;min-width:24%;font-weight:600}
.idc .kv b{font-weight:800;word-break:break-word}
.idc .qrbox{display:flex;flex-direction:column;align-items:center}
.idc .qrbox .q{width:min(26vw,96px);height:min(26vw,96px);aspect-ratio:1;padding:4px;border-radius:7px;background:#fff;display:block}
.idc .qrbox .q svg{display:block;width:100%;height:100%}
.idc .qrbox small{display:block;text-align:center;font-size:clamp(.4rem,1.6vw,.5rem);opacity:.66;margin-top:4px;font-weight:700}
/* footer strip */
.idc .ft{position:absolute;left:0;right:0;bottom:0;height:10.8%;display:flex;align-items:center;justify-content:space-between;
  gap:8px;padding:0 3.3%;background:rgba(0,0,0,.26);font-size:clamp(.42rem,1.7vw,.53rem);font-weight:700}
.idc .ft .id{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:clamp(.48rem,2vw,.62rem);letter-spacing:.5px;opacity:.96}
.idc .ft .st{display:flex;align-items:center;gap:3.5px;opacity:.85}
.idc .ft .dot{width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.24)}
.idc .ft .dot.rest{background:#fbbf24;box-shadow:0 0 0 2px rgba(251,191,36,.24)}
.idc .ft .dot.off{background:#94a3b8;box-shadow:none}
/* back side */
.idc.rev{background:linear-gradient(140deg,#f7faf9,#e8f2ee);color:#123024;box-shadow:0 12px 30px rgba(4,42,30,.16);
  display:block;aspect-ratio:86/54}
.idc.rev[data-t="red"]{background:linear-gradient(140deg,#fdf6f6,#f6e6e7);color:#4a1013}
.idc.rev[data-t="dark"]{background:linear-gradient(140deg,#eef1f0,#dee4e2);color:#131c19}
.idc.rev::before,.idc.rev::after{display:none}
.idc.rev .bh{position:absolute;left:0;right:0;top:0;height:14.5%;display:flex;align-items:center;justify-content:center;
  gap:6px;background:#075c3c;color:#fff;font-size:clamp(.5rem,2.1vw,.66rem);font-weight:800}
.idc.rev[data-t="red"] .bh{background:#8d1017}
.idc.rev[data-t="dark"] .bh{background:#18241f}
.idc.rev .bh svg{width:12px;height:12px}
.idc.rev .bh .bl{width:clamp(16px,5vw,22px);height:clamp(16px,5vw,22px);object-fit:contain;
  background:#fff;border-radius:50%;padding:1px;flex:none}
.idc.rev .bb{position:absolute;left:0;right:0;top:14.5%;bottom:8%;display:grid;grid-template-columns:1fr auto;
  gap:4%;padding:3.5% 3.5% 0;align-items:center}
.idc.rev .ct{display:grid;gap:5px;font-size:clamp(.47rem,1.95vw,.6rem);line-height:1.34;align-content:center}
.idc.rev .ct .h{font-size:.5rem;font-weight:800;opacity:.55;letter-spacing:.6px;text-transform:uppercase}
.idc.rev .ct div.r{display:flex;gap:5px;align-items:flex-start}
.idc.rev .ct svg{width:10px;height:10px;flex:none;margin-top:1.5px;opacity:.6}
.idc.rev .ct b{font-weight:800}
.idc.rev .bq{text-align:center}
.idc.rev .bq .q{width:min(30vw,116px);height:min(30vw,116px);aspect-ratio:1;padding:5px;border-radius:9px;
  background:#fff;box-shadow:0 2px 8px rgba(6,60,40,.14);display:block;margin:0 auto}
.idc.rev .bq .q svg{display:block;width:100%;height:100%}
.idc.rev .bq small{display:block;font-size:.435rem;font-weight:800;opacity:.6;margin-top:3px;line-height:1.25}
.idc.rev .bf{position:absolute;left:0;right:0;bottom:0;height:8%;display:flex;align-items:center;justify-content:center;
  padding:0 4%;font-size:clamp(.38rem,1.6vw,.48rem);font-weight:700;text-align:center;opacity:.6}
/* share (portrait) preview */
.idc.tall{aspect-ratio:9/16;max-width:330px;display:block;padding:0;margin:0 auto}
.idc.tall .hd{position:static;height:auto}
.idc.tall .kv div{border-bottom:1px solid rgba(255,255,255,.14)}
.idc.tall .hd{justify-content:center;padding:14px 14px 10px;border-bottom:none;position:relative}
.idc.tall .hd b{font-size:.72rem}
.idc.tall .hd .vf{position:absolute;top:11px;right:11px;margin:0}
.idc.tall .tb{text-align:center;padding:4px 18px 0}
.idc.tall .tb img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.88)}
.idc.tall .tb .nm{font-size:1.02rem;margin-top:9px}
.idc.tall .tb .rl{font-size:.58rem;margin-bottom:0}
.idc.tall .tb .big{width:64px;height:64px;margin:11px auto 3px;border-radius:50%;display:grid;place-items:center;
  background:#fff;color:#c8101d;font-size:1.28rem;font-weight:800;box-shadow:0 5px 16px rgba(0,0,0,.22)}
.idc.tall .kv{padding:11px 22px 0;font-size:.62rem;gap:4px}
.idc.tall .kv div{justify-content:space-between;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.14)}
.idc.tall .kv span{min-width:0}
.idc.tall .qrbox{width:auto;margin:12px auto 0;text-align:center}
.idc.tall .qrbox .q{width:96px;height:96px;margin:0 auto;padding:5px;border-radius:8px}
.idc.tall .qrbox small{font-size:.5rem}
/* card screen chrome */
.cardsw{display:flex;gap:6px;padding:4px;border-radius:11px;background:var(--card2);border:1px solid var(--line)}
.cardsw button{flex:1;padding:8px 6px;border:0;border-radius:8px;background:transparent;color:var(--mut);
  font:inherit;font-size:.76rem;font-weight:700;cursor:pointer}
.cardsw button.on{background:var(--card);color:var(--grn);box-shadow:0 1px 4px rgba(8,40,28,.1)}
@media(max-width:400px){.idc .kv{font-size:.5rem}.idc .nm{font-size:.76rem}}
@media print{
  @page{size:86mm 54mm;margin:0}
  html,body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;
    overflow:visible!important}
  /* hide the whole app, keep only the print area — display:none so nothing
     reserves space and no blank pages are produced */
  body>*{display:none!important}
  body>#printarea{display:block!important}
  #printarea{position:static!important;margin:0!important;padding:0!important;background:#fff!important}
  #printarea .idc{width:86mm!important;max-width:86mm!important;height:54mm!important;
    margin:0!important;border-radius:0!important;box-shadow:none!important;
    break-after:page;page-break-after:always;overflow:hidden!important;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  #printarea .idc:last-child{break-after:auto;page-break-after:auto}
}

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
@keyframes tin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

/* notification panel */
.npanel{position:fixed;z-index:95;background:var(--card);overflow-y:auto}
@media(max-width:719px){.npanel{inset:0;padding-top:env(safe-area-inset-top);animation:in .2s}}
@media(min-width:720px){
  .npanel{top:calc(var(--bar-h) + 6px);right:16px;width:370px;max-height:74vh;
    border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh2);animation:pop2 .16s}
  @keyframes pop2{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
}
.nitem{display:flex;gap:11px;padding:12px 15px;border-bottom:1px solid var(--line);width:100%;text-align:left}
.nitem:hover{background:var(--card2)}
.nitem.un{background:var(--grn-s)}
[data-theme="dark"] .nitem.un{background:#10241c}
.nitem .ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none}
.nitem b{display:block;font-size:.82rem;font-weight:700;line-height:1.45}
.nitem small{display:block;font-size:.72rem;color:var(--mut)}

/* ===== Donor card (same as public site) ===== */
.dcard-item{width:100%;max-width:560px;margin:0 auto 11px;padding:16px 20px 13px;position:relative;overflow:hidden;
  background:radial-gradient(circle at 100% 0%,rgba(18,160,112,.14),transparent 32%),
             radial-gradient(circle at 0% 100%,rgba(229,30,50,.06),transparent 28%),
             linear-gradient(135deg,#fff,#eaf8f2);
  border:1px solid rgba(18,130,91,.13);border-radius:18px;box-shadow:0 6px 20px rgba(8,100,70,.06)}
[data-theme="dark"] .dcard-item{background:linear-gradient(135deg,#16211e,#12251d);border-color:#22352e;box-shadow:none}
.dc-top{display:grid;grid-template-columns:1fr 110px;gap:12px;align-items:start}
.dc-id{color:#66736e;font-size:12.5px;font-weight:700}
.dc-name{margin-top:2px;color:#172e27;font-size:20px;font-weight:800;line-height:1.2}
.dc-st{margin-top:3px;color:#168158;font-size:13px;font-weight:700}
.dc-st.rest{color:#a5720c}
.dc-meta{display:grid;gap:5px;margin-top:10px;color:#5d6d67;font-size:13.5px}
.dc-meta div{display:flex;align-items:center;gap:6px}
.dc-meta svg{opacity:.62;flex:none}
.dc-meta strong{color:#20352e}
[data-theme="dark"] .dc-id{color:#8fa39c}[data-theme="dark"] .dc-name{color:#eaf5f0}
[data-theme="dark"] .dc-meta{color:#a9bcb5}[data-theme="dark"] .dc-meta strong{color:#e2efe9}
.dc-blood{display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:4px}
.dc-grp{width:52px;height:52px;display:flex;align-items:center;justify-content:center;border-radius:50%;
  background:#ffe6e8;border:2px solid #ffd0d3;color:#d92338;font-size:20px;font-weight:800}
.dc-age{margin-top:6px;color:#68746f;font-size:12.5px;font-weight:700;white-space:nowrap}
[data-theme="dark"] .dc-age{color:#93a5a0}
.dc-div{height:1px;margin:12px 0 10px;background:rgba(55,100,82,.08)}
[data-theme="dark"] .dc-div{background:#22352e}
.dc-act{display:grid;grid-template-columns:minmax(0,1fr) 46px auto;gap:8px;align-items:stretch}
.dc-call,.dc-ico{min-height:38px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;
  font-size:13.5px;font-weight:700;text-decoration:none;cursor:pointer;transition:all .18s ease}
.dc-call{color:#fff;background:linear-gradient(135deg,#0c9c69,#07855a);border:0}
.dc-call:hover{filter:brightness(1.05);transform:translateY(-1px)}
.dc-ico{color:#596660;background:#fff;border:1px solid #e5ebe8}
.dc-ico:hover{background:#f4f9f6;color:var(--grn-d);border-color:#bfe0cd;transform:translateY(-1px)}
[data-theme="dark"] .dc-ico{background:#182724;border-color:#26382f;color:#a9bcb5}
.dc-ico.fav{color:var(--red);border-color:#f3c9cc}
@media(max-width:520px){
  .dcard-item{padding:13px 14px 10px;border-radius:14px}
  .dc-top{grid-template-columns:1fr 80px;gap:6px}
  .dc-name{font-size:17.5px}.dc-id{font-size:11.5px}.dc-st{font-size:12px}
  .dc-meta{font-size:12px;gap:4px;margin-top:7px}
  .dc-grp{width:44px;height:44px;font-size:17px}
  .dc-age{font-size:11.5px;margin-top:4px}
  .dc-div{margin:9px 0 8px}
  .dc-act{grid-template-columns:minmax(0,1fr) 42px auto;gap:6px}
  .dc-call,.dc-ico{min-height:34px;font-size:12px;border-radius:8px}
}
.opt{display:flex;gap:11px;align-items:flex-start;padding:13px;margin-bottom:9px;border:1.5px solid var(--line);
  border-radius:12px;background:var(--card);transition:.15s}
.opt:hover{border-color:#b9d9c9;background:var(--card2)}
.opt.on{border-color:var(--grn);background:var(--grn-s)}
.opt .dot{width:19px;height:19px;border-radius:50%;border:2px solid var(--line);flex:none;margin-top:2px;position:relative;transition:.15s}
.opt.on .dot{border-color:var(--grn)}
.opt.on .dot:after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--grn)}
.opt b{display:block;font-size:.85rem}
.opt small{display:block;font-size:.76rem;color:var(--ink2);margin-top:1px}
.reqc{padding:14px;border:1px solid var(--line);border-left:3px solid var(--red);border-radius:var(--r2);
  background:var(--card);margin-bottom:10px}
.reqc.mt{border-left-color:var(--grn)}
.reqc h4{margin:0 0 3px;font-size:.89rem;font-weight:800;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.reqc p{margin:2px 0 0;font-size:.75rem;color:var(--mut)}
.reqc .a{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}

.tl{padding-left:20px;position:relative}
.tl:before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--line)}
.tli{position:relative;padding-bottom:14px}
.tli:last-child{padding-bottom:0}
.tli:before{content:"";position:absolute;left:-19px;top:5px;width:10px;height:10px;border-radius:50%;
  background:var(--grn);box-shadow:0 0 0 3px var(--card)}
.tli.r:before{background:var(--red)} .tli.b:before{background:var(--blu)}
.tli b{display:block;font-size:.82rem;font-weight:700}
.tli small{font-size:.73rem;color:var(--mut)}

/* logout button — danger styling, matches the admin panel */
/* toggle — real box is 48x40 so the tap target is finger-sized;
   only the painted pill inside is 46x27 (background-clip trick, no
   invisible ::before expander which the shell's stacking contexts eat) */
.btn.logout-btn{color:var(--red-d);border-color:rgba(224,36,47,.35)}
.btn.logout-btn svg{color:var(--red)}
.btn.logout-btn:hover{background:var(--red-s);border-color:var(--red);color:var(--red-d)}
.tg{width:48px;height:40px;background:none!important;border-radius:0;display:grid;place-items:center}
.tg:before{content:"";width:46px;height:27px;border-radius:99px;background:#cad6d1;transition:.18s}
[data-theme="dark"] .tg:before{background:#31443e}
.tg.on:before{background:var(--grn)}
.tg:after{top:50%;left:calc(50% - 20px);transform:translateY(-50%)}
.tg.on:after{left:calc(50% + 1px)}

/* ───────── PROFILE ─────────
   Same card language as the rest of the app: one white card, a soft brand
   cover, avatar overlapping it. Everything below reuses .card/.row/.sec-t
   so the profile inherits every future design change for free. */
.pcard{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  box-shadow:var(--sh);overflow:hidden;margin-bottom:12px}
/* no cover band: the header is a plain card, avatar and blood group on one
   row, the name on the next — so a long Bangla name always has full width */
.phead2{display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:16px 14px 0}
.pav{width:78px;height:78px;border-radius:50%;object-fit:cover;flex:none;
  border:3px solid var(--card);background:var(--card2);box-shadow:var(--sh)}
.pnm{padding:9px 14px 0;min-width:0}
.pnm b{display:flex;align-items:center;gap:5px;font-size:1.05rem;font-weight:800;
  line-height:1.35;word-break:break-word}
.pnm small{display:block;color:var(--mut);font-size:.74rem;margin-top:2px}
.pvf{color:var(--grn);display:inline-flex;flex:none}
.pgrp{background:var(--red-s);color:var(--red);font-weight:800;
  font-size:1.05rem;padding:7px 13px;border-radius:11px;flex:none}
.pbio{margin:9px 14px 0;font-size:.85rem;color:var(--ink2);line-height:1.6}
.pchips{display:flex;flex-wrap:wrap;gap:6px;padding:11px 14px 0}
.pchip{display:inline-flex;align-items:center;gap:4px;background:var(--card2);
  border:1px solid var(--line);color:var(--ink2);font-size:.75rem;font-weight:700;
  padding:5px 10px;border-radius:99px}
.pchip.ok{background:var(--grn-s);border-color:transparent;color:var(--grn)}
.pchip.rest{background:var(--amb-s);border-color:transparent;color:var(--amb)}
.pacts{display:flex;gap:8px;padding:13px 14px 14px}
.pacts .btn.on{background:var(--red-s);border-color:var(--red);color:var(--red)}
.pacts .btn.on svg{color:var(--red)}
.pstats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:2px}
.pstat{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);
  padding:12px 8px;text-align:center;box-shadow:var(--sh)}
.pstat b{display:block;font-size:1.15rem;font-weight:800;color:var(--grn);line-height:1.25}
.pstat b.sm{font-size:.88rem;line-height:1.45}
.pstat span{display:block;font-size:.7rem;color:var(--mut);margin-top:3px;line-height:1.35}
/* profile button inside a donor card */
.dc-prof{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:40px;padding:9px 13px;border-radius:10px;font-size:.8rem;font-weight:800;
  background:var(--card2);border:1px solid var(--line);color:var(--ink)}
.dc-prof:hover{background:var(--grn-s);border-color:var(--grn);color:var(--grn)}
.dc-prof svg{color:var(--grn)}
.dc-name{cursor:pointer}
@media(max-width:380px){
  .pstat b{font-size:1rem}
  .pgrp{font-size:.95rem;padding:6px 10px}
}

/* ───────── TOUCH TARGET FLOOR ─────────
   Every tappable control in the app is at least 40px tall. Small buttons
   only *look* small — the box stays finger-sized. .lnk is exempt: it is
   inline text, not a target of its own. */
.btn.sm{min-height:40px}
.dc-call,.dc-ico,.dc-prof{min-height:40px}
@media(max-width:420px){.dc-call,.dc-ico,.dc-prof{min-height:40px}}
.btn.lnk{min-height:0}

/* profile sits where "save" used to be. It is a labelled button, so the
   grid gives it its own content width instead of a 46px icon slot, and the
   row collapses to two columns when the donor hides WhatsApp. */
.dc-act:not(:has(.dc-ico)){grid-template-columns:minmax(0,1fr) auto}
.dc-prof{white-space:nowrap;padding:9px 14px}
.dc-call{min-width:0;padding:0 10px}
.dc-call span,.dc-prof span{overflow:hidden;text-overflow:ellipsis}
.dc-call.off{background:var(--card2);color:var(--mut);border:1px solid var(--line)}
.dc-call.off svg{color:var(--mut)}

/* a disabled-looking action that still explains itself when tapped */
.btn.gh.off{color:var(--mut);border-style:dashed}
.btn.gh.off svg{color:var(--mut)}
.btn.gh.off:hover{background:var(--card2);border-color:var(--line)}

/* ───────── PUBLIC PROFILE MODE ─────────
   app.html?uid=… is a single donor profile for visitors: no bottom nav, no
   desktop nav, no notification bell — just the header, the profile and the
   download action. Everything else in the app is untouched. */
body[data-pub="1"] .bnav,
body[data-pub="1"] .dnav,
body[data-pub="1"] .bell,
body[data-pub="1"] .back{display:none!important}
body[data-pub="1"] .app{padding-bottom:28px}
body[data-pub="1"] .top .brand b{font-size:.9rem}
body[data-pub="1"] .wrap{padding-top:4px}
@media(min-width:900px){
  body[data-pub="1"] .app{padding-bottom:40px}
}`;

/* ═══════════════════════════════════════════════════════════════════
   Static UI — মূল doner.html-এর <body> মার্কআপ হুবহু JSX-এ
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
          <section className="scr" id="s-find">
          </section>
          {" "}
          <section className="scr" id="s-req">
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
   Page logic — মূল doner.html-এর <script type="module"> হুবহু port
   ═══════════════════════════════════════════════════════════════════ */
function initPage() {
  
  /* ══════════ i18n — DOM-level translation layer ══════════
     Bangla stays the source of truth in every template; when English is on,
     the rendered DOM is translated in place. New features get translated
     automatically as long as their strings exist in DICT.               */
  const DICT_EN={
  "কার্ড ডাউনলোড":"Download card",
  "এই রক্তদাতার তথ্য ও QR কোড সহ কার্ড ছবি হিসেবে নামান।":"Download this donor's card as an image, with their details and QR code.",
  "মেসেজ":"Message",
  "এই রক্তদাতা WhatsApp-এ যোগাযোগের জন্য নম্বর প্রকাশ করেননি":"This donor has not shared a number for WhatsApp",
  "প্রোফাইল কার্ড":"Profile card",
  "কার্ড দেখুন":"View card",
  "আপনার তথ্য ও QR কোড সহ ডোনার কার্ড ছবি হিসেবে নামান — মানিব্যাগে রাখুন, প্রিন্ট করুন বা প্রয়োজনে শেয়ার করুন।":"Download your donor card as an image with your details and QR code — keep it in your wallet, print it, or share it when needed.",
  "প্রোফাইল কার্ড নামান":"Download profile card",
  "রক্তদাতা তালিকায় থাকলে আপনার মোবাইল নম্বর সবাই দেখতে পাবেন — জরুরি প্রয়োজনে যোগাযোগ করার জন্য এটি দরকার। নম্বর লুকাতে চাইলে উপরের রক্তদাতা তালিকায় দেখান বন্ধ করুন।":"While you are on the donor list your mobile number is visible to everyone — that is what makes you reachable in an emergency. To hide it, turn off \"Show on the donor list\" above.",
  "এখনো দেননি":"Not added yet",
  "আপনার প্রোফাইল এখনো অসম্পূর্ণ — রক্তের গ্রুপ ও এলাকা দিলে অন্যরা জরুরি প্রয়োজনে আপনাকে খুঁজে পাবেন।":"Your profile is incomplete — add your blood group and area so others can find you in an emergency.",
  "তথ্য পূরণ করুন":"Complete your details",
  "আমার প্রোফাইল দেখুন":"View my profile",
  "আমার প্রোফাইল":"My profile",
  "প্রোফাইল সম্পাদনা":"Edit profile",
  "প্রোফাইল দেখুন":"View profile",
  "জীবন বাঁচাতে সাহায্য":"Lives helped",
  "শেষ রক্তদান":"Last donation",
  "যুক্ত হয়েছেন":"Joined",
  "দেখানো হয়নি":"Not shown",
  "গোপন রাখা হয়েছে":"Kept private",
  "এই রক্তদাতা নম্বর গোপন রেখেছেন":"This donor keeps their number private",
  "সংরক্ষণ সরানো হয়েছে":"Removed from saved",
  "প্রোফাইল পাওয়া যায়নি":"Profile not found",
  "রক্তদাতাটি আর তালিকায় নেই":"This donor is no longer listed",
  "শুধু রক্তসংক্রান্ত প্রয়োজনে যোগাযোগ করুন":"Please make contact only for blood-related needs",
  "অন্যরা আপনার প্রোফাইলে কী দেখতে পাবে তা গোপনীয়তা সেটিংস থেকে ঠিক করতে পারবেন।":"You control what others see on your profile from Privacy settings.",
  "গোপনীয়তা সেটিংস":"Privacy settings",
  "তথ্য নামান, অ্যাকাউন্ট মুছুন":"Download data, delete account",
  "পাসওয়ার্ড ভুলে গেছেন?":"Forgot password?",
  "ইমেইল বা মোবাইলে OTP পাঠানো হবে":"An OTP will be sent to your email or phone",
  "OTP চাওয়া হয়েছে":"OTP requested",
  "OTP পাঠানো হয়েছে":"OTP sent",
  "সঠিক ইমেইল ঠিকানা দিন":"Enter a valid email address",
  "অ্যাকাউন্ট, দায়িত্ব ও আচরণবিধি":"Account, duties and code of conduct",
  "আপনার তথ্য কীভাবে ব্যবহার হয়":"How your information is used",
  "যোগ্যতা, প্রস্তুতি ও নিরাপত্তা":"Eligibility, preparation and safety",
  "১ আগস্ট ২০২৬":"1 August 2026",
  "লগআউট হয়েছে":"Logged out",
  "লিংক পাঠান":"Send link",
  "লিংক পাঠানো হয়েছে":"Link sent",
  "ইমেইল ঠিকানা":"Email address",
  "এই অ্যাকাউন্টের ইমেইলেই লিংক যাবে।":"The link goes to this account's email.",
  "আপনার ইমেইল বা মোবাইলে ৬ সংখ্যার OTP পাঠানো হবে। OTP ২ মিনিট পর্যন্ত কাজ করবে।":"A 6-digit OTP will be sent to your email or phone. It works for 2 minutes.",
  "ইমেইল না পেলে স্প্যাম ফোল্ডার দেখুন।":"If you don't see it, check your spam folder.",
  "এই ঠিকানায় OTP পাঠানো হয়েছে।":"An OTP has been sent to this address.",
  "সর্বশেষ হালনাগাদ:":"Last updated:",
  "অনুরোধ করার পর ২৪ ঘণ্টার মধ্যে অ্যাকাউন্ট ও এর সাথে সম্পর্কিত সকল ডাটা মুছে যাবে":"The account and all related data will be deleted within 24 hours of the request",
  "২৪ ঘণ্টার মধ্যে মুছে যাবে":"Will be deleted within 24 hours",
  "অনুরোধ করার পর ২৪ ঘণ্টার মধ্যে অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা মুছে যাবে।":"Within 24 hours of the request, the account and all data related to it will be deleted.",
  "অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা ২৪ ঘণ্টার মধ্যে স্থায়ীভাবে মুছে ফেলা হবে।":"The account and all data related to it will be permanently deleted within 24 hours.",
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
  const isEN=()=>STORE.prefs.lang==="en";
  const BN_RE=/[\u0980-\u09FF]/;
  /* longest-first key list, built once */
  const DICT_KEYS=Object.keys(DICT_EN).sort((a,b)=>b.length-a.length);
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
      out=out.split(k).join(DICT_EN[k]);hit=true;
    }
    /* 3a. short words isolated by separators (· , | space) — safe: whole-token match */
    for(const [k,v] of TOKEN_EN){
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
    document.body.dataset.lang=STORE.prefs.lang;
    if(CUR)go(CUR,SUB,false);
    paintTop&&paintTop();paintNav&&paintNav();
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
  
  /* ---------- club logo (official, embedded) ---------- */
  const LOGO = "./img/logo.png";  /* img/logo.png ফাইল থেকে লোগো — ফাইল বদলালেই সর্বত্র নতুন লোগো */
  
  /* ══════════════════════════════════════════════════
     CBDC Application
     TopBar · Nav(4) · Screens · Settings registry
     ══════════════════════════════════════════════════ */
  
  /* ---------- helpers ---------- */
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const D9=["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  /* Bangla digits — kept Latin when the app is in English */
  const bn=v=>(typeof STORE!=="undefined"&&STORE.prefs.lang==="en")?String(v??""):String(v??"").replace(/\d/g,d=>D9[d]);
  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const iso=d=>d.toISOString().slice(0,10);
  const now=()=>new Date();
  const LOC=()=>(typeof STORE!=="undefined"&&STORE.prefs.lang==="en")?"en-GB":"bn-BD";
  const dL=v=>v?new Date(v+"T00:00:00").toLocaleDateString(LOC(),{year:"numeric",month:"long",day:"numeric"}):"—";
  const dS=v=>v?new Date(v+"T00:00:00").toLocaleDateString(LOC(),{year:"numeric",month:"short",day:"numeric"}):"—";
  const dayDiff=a=>Math.floor((new Date().setHours(0,0,0,0)-new Date(a+"T00:00:00").setHours(0,0,0,0))/864e5);
  const addD=(d,n)=>{const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return iso(x)};
  const phoneOK=v=>/^01[3-9]\d{8}$/.test(String(v||"").replace(/\s/g,""));
  const mailOK=v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v||"");
  const sleep=m=>new Promise(r=>setTimeout(r,m));
  
  /* ---------- ICONS (SVG only, no emoji) ---------- */
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
  
  /* ---------- QR (real, scannable, offline) ---------- */
  /* QR Code Generator — (c) 2009 Kazuhiko Arase, MIT license. http://www.d-project.com/ */
  const QRLIB=(function(){
  //---------------------------------------------------------------------
  //
  // QR Code Generator for JavaScript
  //
  // Copyright (c) 2009 Kazuhiko Arase
  //
  // URL: http://www.d-project.com/
  //
  // Licensed under the MIT license:
  //  http://www.opensource.org/licenses/mit-license.php
  //
  // The word 'QR Code' is registered trademark of
  // DENSO WAVE INCORPORATED
  //  http://www.denso-wave.com/qrcode/faqpatent-e.html
  //
  //---------------------------------------------------------------------
  
  var qrcode = function() {
  
    //---------------------------------------------------------------------
    // qrcode
    //---------------------------------------------------------------------
  
    /**
     * qrcode
     * @param typeNumber 1 to 40
     * @param errorCorrectionLevel 'L','M','Q','H'
     */
    var qrcode = function(typeNumber, errorCorrectionLevel) {
  
      var PAD0 = 0xEC;
      var PAD1 = 0x11;
  
      var _typeNumber = typeNumber;
      var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
      var _modules = null;
      var _moduleCount = 0;
      var _dataCache = null;
      var _dataList = [];
  
      var _this = {};
  
      var makeImpl = function(test, maskPattern) {
  
        _moduleCount = _typeNumber * 4 + 17;
        _modules = function(moduleCount) {
          var modules = new Array(moduleCount);
          for (var row = 0; row < moduleCount; row += 1) {
            modules[row] = new Array(moduleCount);
            for (var col = 0; col < moduleCount; col += 1) {
              modules[row][col] = null;
            }
          }
          return modules;
        }(_moduleCount);
  
        setupPositionProbePattern(0, 0);
        setupPositionProbePattern(_moduleCount - 7, 0);
        setupPositionProbePattern(0, _moduleCount - 7);
        setupPositionAdjustPattern();
        setupTimingPattern();
        setupTypeInfo(test, maskPattern);
  
        if (_typeNumber >= 7) {
          setupTypeNumber(test);
        }
  
        if (_dataCache == null) {
          _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
        }
  
        mapData(_dataCache, maskPattern);
      };
  
      var setupPositionProbePattern = function(row, col) {
  
        for (var r = -1; r <= 7; r += 1) {
  
          if (row + r <= -1 || _moduleCount <= row + r) continue;
  
          for (var c = -1; c <= 7; c += 1) {
  
            if (col + c <= -1 || _moduleCount <= col + c) continue;
  
            if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
                || (0 <= c && c <= 6 && (r == 0 || r == 6) )
                || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      };
  
      var getBestMaskPattern = function() {
  
        var minLostPoint = 0;
        var pattern = 0;
  
        for (var i = 0; i < 8; i += 1) {
  
          makeImpl(true, i);
  
          var lostPoint = QRUtil.getLostPoint(_this);
  
          if (i == 0 || minLostPoint > lostPoint) {
            minLostPoint = lostPoint;
            pattern = i;
          }
        }
  
        return pattern;
      };
  
      var setupTimingPattern = function() {
  
        for (var r = 8; r < _moduleCount - 8; r += 1) {
          if (_modules[r][6] != null) {
            continue;
          }
          _modules[r][6] = (r % 2 == 0);
        }
  
        for (var c = 8; c < _moduleCount - 8; c += 1) {
          if (_modules[6][c] != null) {
            continue;
          }
          _modules[6][c] = (c % 2 == 0);
        }
      };
  
      var setupPositionAdjustPattern = function() {
  
        var pos = QRUtil.getPatternPosition(_typeNumber);
  
        for (var i = 0; i < pos.length; i += 1) {
  
          for (var j = 0; j < pos.length; j += 1) {
  
            var row = pos[i];
            var col = pos[j];
  
            if (_modules[row][col] != null) {
              continue;
            }
  
            for (var r = -2; r <= 2; r += 1) {
  
              for (var c = -2; c <= 2; c += 1) {
  
                if (r == -2 || r == 2 || c == -2 || c == 2
                    || (r == 0 && c == 0) ) {
                  _modules[row + r][col + c] = true;
                } else {
                  _modules[row + r][col + c] = false;
                }
              }
            }
          }
        }
      };
  
      var setupTypeNumber = function(test) {
  
        var bits = QRUtil.getBCHTypeNumber(_typeNumber);
  
        for (var i = 0; i < 18; i += 1) {
          var mod = (!test && ( (bits >> i) & 1) == 1);
          _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
        }
  
        for (var i = 0; i < 18; i += 1) {
          var mod = (!test && ( (bits >> i) & 1) == 1);
          _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      };
  
      var setupTypeInfo = function(test, maskPattern) {
  
        var data = (_errorCorrectionLevel << 3) | maskPattern;
        var bits = QRUtil.getBCHTypeInfo(data);
  
        // vertical
        for (var i = 0; i < 15; i += 1) {
  
          var mod = (!test && ( (bits >> i) & 1) == 1);
  
          if (i < 6) {
            _modules[i][8] = mod;
          } else if (i < 8) {
            _modules[i + 1][8] = mod;
          } else {
            _modules[_moduleCount - 15 + i][8] = mod;
          }
        }
  
        // horizontal
        for (var i = 0; i < 15; i += 1) {
  
          var mod = (!test && ( (bits >> i) & 1) == 1);
  
          if (i < 8) {
            _modules[8][_moduleCount - i - 1] = mod;
          } else if (i < 9) {
            _modules[8][15 - i - 1 + 1] = mod;
          } else {
            _modules[8][15 - i - 1] = mod;
          }
        }
  
        // fixed module
        _modules[_moduleCount - 8][8] = (!test);
      };
  
      var mapData = function(data, maskPattern) {
  
        var inc = -1;
        var row = _moduleCount - 1;
        var bitIndex = 7;
        var byteIndex = 0;
        var maskFunc = QRUtil.getMaskFunction(maskPattern);
  
        for (var col = _moduleCount - 1; col > 0; col -= 2) {
  
          if (col == 6) col -= 1;
  
          while (true) {
  
            for (var c = 0; c < 2; c += 1) {
  
              if (_modules[row][col - c] == null) {
  
                var dark = false;
  
                if (byteIndex < data.length) {
                  dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
                }
  
                var mask = maskFunc(row, col - c);
  
                if (mask) {
                  dark = !dark;
                }
  
                _modules[row][col - c] = dark;
                bitIndex -= 1;
  
                if (bitIndex == -1) {
                  byteIndex += 1;
                  bitIndex = 7;
                }
              }
            }
  
            row += inc;
  
            if (row < 0 || _moduleCount <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      };
  
      var createBytes = function(buffer, rsBlocks) {
  
        var offset = 0;
  
        var maxDcCount = 0;
        var maxEcCount = 0;
  
        var dcdata = new Array(rsBlocks.length);
        var ecdata = new Array(rsBlocks.length);
  
        for (var r = 0; r < rsBlocks.length; r += 1) {
  
          var dcCount = rsBlocks[r].dataCount;
          var ecCount = rsBlocks[r].totalCount - dcCount;
  
          maxDcCount = Math.max(maxDcCount, dcCount);
          maxEcCount = Math.max(maxEcCount, ecCount);
  
          dcdata[r] = new Array(dcCount);
  
          for (var i = 0; i < dcdata[r].length; i += 1) {
            dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
          }
          offset += dcCount;
  
          var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
          var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
  
          var modPoly = rawPoly.mod(rsPoly);
          ecdata[r] = new Array(rsPoly.getLength() - 1);
          for (var i = 0; i < ecdata[r].length; i += 1) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length;
            ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
          }
        }
  
        var totalCodeCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalCodeCount += rsBlocks[i].totalCount;
        }
  
        var data = new Array(totalCodeCount);
        var index = 0;
  
        for (var i = 0; i < maxDcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < dcdata[r].length) {
              data[index] = dcdata[r][i];
              index += 1;
            }
          }
        }
  
        for (var i = 0; i < maxEcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < ecdata[r].length) {
              data[index] = ecdata[r][i];
              index += 1;
            }
          }
        }
  
        return data;
      };
  
      var createData = function(typeNumber, errorCorrectionLevel, dataList) {
  
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
  
        var buffer = qrBitBuffer();
  
        for (var i = 0; i < dataList.length; i += 1) {
          var data = dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
          data.write(buffer);
        }
  
        // calc num max data.
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalDataCount += rsBlocks[i].dataCount;
        }
  
        if (buffer.getLengthInBits() > totalDataCount * 8) {
          throw 'code length overflow. ('
            + buffer.getLengthInBits()
            + '>'
            + totalDataCount * 8
            + ')';
        }
  
        // end code
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
          buffer.put(0, 4);
        }
  
        // padding
        while (buffer.getLengthInBits() % 8 != 0) {
          buffer.putBit(false);
        }
  
        // padding
        while (true) {
  
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD0, 8);
  
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD1, 8);
        }
  
        return createBytes(buffer, rsBlocks);
      };
  
      _this.addData = function(data, mode) {
  
        mode = mode || 'Byte';
  
        var newData = null;
  
        switch(mode) {
        case 'Numeric' :
          newData = qrNumber(data);
          break;
        case 'Alphanumeric' :
          newData = qrAlphaNum(data);
          break;
        case 'Byte' :
          newData = qr8BitByte(data);
          break;
        case 'Kanji' :
          newData = qrKanji(data);
          break;
        default :
          throw 'mode:' + mode;
        }
  
        _dataList.push(newData);
        _dataCache = null;
      };
  
      _this.isDark = function(row, col) {
        if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
          throw row + ',' + col;
        }
        return _modules[row][col];
      };
  
      _this.getModuleCount = function() {
        return _moduleCount;
      };
  
      _this.make = function() {
        if (_typeNumber < 1) {
          var typeNumber = 1;
  
          for (; typeNumber < 40; typeNumber++) {
            var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
            var buffer = qrBitBuffer();
  
            for (var i = 0; i < _dataList.length; i++) {
              var data = _dataList[i];
              buffer.put(data.getMode(), 4);
              buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
              data.write(buffer);
            }
  
            var totalDataCount = 0;
            for (var i = 0; i < rsBlocks.length; i++) {
              totalDataCount += rsBlocks[i].dataCount;
            }
  
            if (buffer.getLengthInBits() <= totalDataCount * 8) {
              break;
            }
          }
  
          _typeNumber = typeNumber;
        }
  
        makeImpl(false, getBestMaskPattern() );
      };
  
      _this.createTableTag = function(cellSize, margin) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var qrHtml = '';
  
        qrHtml += '<table style="';
        qrHtml += ' border-width: 0px; border-style: none;';
        qrHtml += ' border-collapse: collapse;';
        qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
        qrHtml += '">';
        qrHtml += '<tbody>';
  
        for (var r = 0; r < _this.getModuleCount(); r += 1) {
  
          qrHtml += '<tr>';
  
          for (var c = 0; c < _this.getModuleCount(); c += 1) {
            qrHtml += '<td style="';
            qrHtml += ' border-width: 0px; border-style: none;';
            qrHtml += ' border-collapse: collapse;';
            qrHtml += ' padding: 0px; margin: 0px;';
            qrHtml += ' width: ' + cellSize + 'px;';
            qrHtml += ' height: ' + cellSize + 'px;';
            qrHtml += ' background-color: ';
            qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
            qrHtml += ';';
            qrHtml += '"/>';
          }
  
          qrHtml += '</tr>';
        }
  
        qrHtml += '</tbody>';
        qrHtml += '</table>';
  
        return qrHtml;
      };
  
      _this.createSvgTag = function(cellSize, margin, alt, title) {
  
        var opts = {};
        if (typeof arguments[0] == 'object') {
          // Called by options.
          opts = arguments[0];
          // overwrite cellSize and margin.
          cellSize = opts.cellSize;
          margin = opts.margin;
          alt = opts.alt;
          title = opts.title;
        }
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        // Compose alt property surrogate
        alt = (typeof alt === 'string') ? {text: alt} : alt || {};
        alt.text = alt.text || null;
        alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;
  
        // Compose title property surrogate
        title = (typeof title === 'string') ? {text: title} : title || {};
        title.text = title.text || null;
        title.id = (title.text) ? title.id || 'qrcode-title' : null;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var c, mc, r, mr, qrSvg='', rect;
  
        rect = 'l' + cellSize + ',0 0,' + cellSize +
          ' -' + cellSize + ',0 0,-' + cellSize + 'z ';
  
        qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
        qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
        qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
        qrSvg += ' preserveAspectRatio="xMinYMin meet"';
        qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
            escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
        qrSvg += '>';
        qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
            escapeXml(title.text) + '</title>' : '';
        qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
            escapeXml(alt.text) + '</description>' : '';
        qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
        qrSvg += '<path d="';
  
        for (r = 0; r < _this.getModuleCount(); r += 1) {
          mr = r * cellSize + margin;
          for (c = 0; c < _this.getModuleCount(); c += 1) {
            if (_this.isDark(r, c) ) {
              mc = c*cellSize+margin;
              qrSvg += 'M' + mc + ',' + mr + rect;
            }
          }
        }
  
        qrSvg += '" stroke="transparent" fill="black"/>';
        qrSvg += '</svg>';
  
        return qrSvg;
      };
  
      _this.createDataURL = function(cellSize, margin) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        return createDataURL(size, size, function(x, y) {
          if (min <= x && x < max && min <= y && y < max) {
            var c = Math.floor( (x - min) / cellSize);
            var r = Math.floor( (y - min) / cellSize);
            return _this.isDark(r, c)? 0 : 1;
          } else {
            return 1;
          }
        } );
      };
  
      _this.createImgTag = function(cellSize, margin, alt) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
  
        var img = '';
        img += '<img';
        img += '\u0020src="';
        img += _this.createDataURL(cellSize, margin);
        img += '"';
        img += '\u0020width="';
        img += size;
        img += '"';
        img += '\u0020height="';
        img += size;
        img += '"';
        if (alt) {
          img += '\u0020alt="';
          img += escapeXml(alt);
          img += '"';
        }
        img += '/>';
  
        return img;
      };
  
      var escapeXml = function(s) {
        var escaped = '';
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charAt(i);
          switch(c) {
          case '<': escaped += '&lt;'; break;
          case '>': escaped += '&gt;'; break;
          case '&': escaped += '&amp;'; break;
          case '"': escaped += '&quot;'; break;
          default : escaped += c; break;
          }
        }
        return escaped;
      };
  
      var _createHalfASCII = function(margin) {
        var cellSize = 1;
        margin = (typeof margin == 'undefined')? cellSize * 2 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        var y, x, r1, r2, p;
  
        var blocks = {
          '██': '█',
          '█ ': '▀',
          ' █': '▄',
          '  ': ' '
        };
  
        var blocksLastLineNoMargin = {
          '██': '▀',
          '█ ': '▀',
          ' █': ' ',
          '  ': ' '
        };
  
        var ascii = '';
        for (y = 0; y < size; y += 2) {
          r1 = Math.floor((y - min) / cellSize);
          r2 = Math.floor((y + 1 - min) / cellSize);
          for (x = 0; x < size; x += 1) {
            p = '█';
  
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
              p = ' ';
            }
  
            if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
              p += ' ';
            }
            else {
              p += '█';
            }
  
            // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
            ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
          }
  
          ascii += '\n';
        }
  
        if (size % 2 && margin > 0) {
          return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
        }
  
        return ascii.substring(0, ascii.length-1);
      };
  
      _this.createASCII = function(cellSize, margin) {
        cellSize = cellSize || 1;
  
        if (cellSize < 2) {
          return _createHalfASCII(margin);
        }
  
        cellSize -= 1;
        margin = (typeof margin == 'undefined')? cellSize * 2 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        var y, x, r, p;
  
        var white = Array(cellSize+1).join('██');
        var black = Array(cellSize+1).join('  ');
  
        var ascii = '';
        var line = '';
        for (y = 0; y < size; y += 1) {
          r = Math.floor( (y - min) / cellSize);
          line = '';
          for (x = 0; x < size; x += 1) {
            p = 1;
  
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
              p = 0;
            }
  
            // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
            line += p ? white : black;
          }
  
          for (r = 0; r < cellSize; r += 1) {
            ascii += line + '\n';
          }
        }
  
        return ascii.substring(0, ascii.length-1);
      };
  
      _this.renderTo2dContext = function(context, cellSize) {
        cellSize = cellSize || 2;
        var length = _this.getModuleCount();
        for (var row = 0; row < length; row++) {
          for (var col = 0; col < length; col++) {
            context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
            context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      }
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrcode.stringToBytes
    //---------------------------------------------------------------------
  
    qrcode.stringToBytesFuncs = {
      'default' : function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          bytes.push(c & 0xff);
        }
        return bytes;
      }
    };
  
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];
  
    //---------------------------------------------------------------------
    // qrcode.createStringToBytes
    //---------------------------------------------------------------------
  
    /**
     * @param unicodeData base64 string of byte array.
     * [16bit Unicode],[16bit Bytes], ...
     * @param numChars
     */
    qrcode.createStringToBytes = function(unicodeData, numChars) {
  
      // create conversion map.
  
      var unicodeMap = function() {
  
        var bin = base64DecodeInputStream(unicodeData);
        var read = function() {
          var b = bin.read();
          if (b == -1) throw 'eof';
          return b;
        };
  
        var count = 0;
        var unicodeMap = {};
        while (true) {
          var b0 = bin.read();
          if (b0 == -1) break;
          var b1 = read();
          var b2 = read();
          var b3 = read();
          var k = String.fromCharCode( (b0 << 8) | b1);
          var v = (b2 << 8) | b3;
          unicodeMap[k] = v;
          count += 1;
        }
        if (count != numChars) {
          throw count + ' != ' + numChars;
        }
  
        return unicodeMap;
      }();
  
      var unknownChar = '?'.charCodeAt(0);
  
      return function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          if (c < 128) {
            bytes.push(c);
          } else {
            var b = unicodeMap[s.charAt(i)];
            if (typeof b == 'number') {
              if ( (b & 0xff) == b) {
                // 1byte
                bytes.push(b);
              } else {
                // 2bytes
                bytes.push(b >>> 8);
                bytes.push(b & 0xff);
              }
            } else {
              bytes.push(unknownChar);
            }
          }
        }
        return bytes;
      };
    };
  
    //---------------------------------------------------------------------
    // QRMode
    //---------------------------------------------------------------------
  
    var QRMode = {
      MODE_NUMBER :    1 << 0,
      MODE_ALPHA_NUM : 1 << 1,
      MODE_8BIT_BYTE : 1 << 2,
      MODE_KANJI :     1 << 3
    };
  
    //---------------------------------------------------------------------
    // QRErrorCorrectionLevel
    //---------------------------------------------------------------------
  
    var QRErrorCorrectionLevel = {
      L : 1,
      M : 0,
      Q : 3,
      H : 2
    };
  
    //---------------------------------------------------------------------
    // QRMaskPattern
    //---------------------------------------------------------------------
  
    var QRMaskPattern = {
      PATTERN000 : 0,
      PATTERN001 : 1,
      PATTERN010 : 2,
      PATTERN011 : 3,
      PATTERN100 : 4,
      PATTERN101 : 5,
      PATTERN110 : 6,
      PATTERN111 : 7
    };
  
    //---------------------------------------------------------------------
    // QRUtil
    //---------------------------------------------------------------------
  
    var QRUtil = function() {
  
      var PATTERN_POSITION_TABLE = [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
      ];
      var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
      var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
      var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
  
      var _this = {};
  
      var getBCHDigit = function(data) {
        var digit = 0;
        while (data != 0) {
          digit += 1;
          data >>>= 1;
        }
        return digit;
      };
  
      _this.getBCHTypeInfo = function(data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
          d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
        }
        return ( (data << 10) | d) ^ G15_MASK;
      };
  
      _this.getBCHTypeNumber = function(data) {
        var d = data << 12;
        while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
          d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
        }
        return (data << 12) | d;
      };
  
      _this.getPatternPosition = function(typeNumber) {
        return PATTERN_POSITION_TABLE[typeNumber - 1];
      };
  
      _this.getMaskFunction = function(maskPattern) {
  
        switch (maskPattern) {
  
        case QRMaskPattern.PATTERN000 :
          return function(i, j) { return (i + j) % 2 == 0; };
        case QRMaskPattern.PATTERN001 :
          return function(i, j) { return i % 2 == 0; };
        case QRMaskPattern.PATTERN010 :
          return function(i, j) { return j % 3 == 0; };
        case QRMaskPattern.PATTERN011 :
          return function(i, j) { return (i + j) % 3 == 0; };
        case QRMaskPattern.PATTERN100 :
          return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
        case QRMaskPattern.PATTERN101 :
          return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
        case QRMaskPattern.PATTERN110 :
          return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
        case QRMaskPattern.PATTERN111 :
          return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };
  
        default :
          throw 'bad maskPattern:' + maskPattern;
        }
      };
  
      _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
        var a = qrPolynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i += 1) {
          a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
        }
        return a;
      };
  
      _this.getLengthInBits = function(mode, type) {
  
        if (1 <= type && type < 10) {
  
          // 1 - 9
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 10;
          case QRMode.MODE_ALPHA_NUM : return 9;
          case QRMode.MODE_8BIT_BYTE : return 8;
          case QRMode.MODE_KANJI     : return 8;
          default :
            throw 'mode:' + mode;
          }
  
        } else if (type < 27) {
  
          // 10 - 26
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 12;
          case QRMode.MODE_ALPHA_NUM : return 11;
          case QRMode.MODE_8BIT_BYTE : return 16;
          case QRMode.MODE_KANJI     : return 10;
          default :
            throw 'mode:' + mode;
          }
  
        } else if (type < 41) {
  
          // 27 - 40
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 14;
          case QRMode.MODE_ALPHA_NUM : return 13;
          case QRMode.MODE_8BIT_BYTE : return 16;
          case QRMode.MODE_KANJI     : return 12;
          default :
            throw 'mode:' + mode;
          }
  
        } else {
          throw 'type:' + type;
        }
      };
  
      _this.getLostPoint = function(qrcode) {
  
        var moduleCount = qrcode.getModuleCount();
  
        var lostPoint = 0;
  
        // LEVEL1
  
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount; col += 1) {
  
            var sameCount = 0;
            var dark = qrcode.isDark(row, col);
  
            for (var r = -1; r <= 1; r += 1) {
  
              if (row + r < 0 || moduleCount <= row + r) {
                continue;
              }
  
              for (var c = -1; c <= 1; c += 1) {
  
                if (col + c < 0 || moduleCount <= col + c) {
                  continue;
                }
  
                if (r == 0 && c == 0) {
                  continue;
                }
  
                if (dark == qrcode.isDark(row + r, col + c) ) {
                  sameCount += 1;
                }
              }
            }
  
            if (sameCount > 5) {
              lostPoint += (3 + sameCount - 5);
            }
          }
        };
  
        // LEVEL2
  
        for (var row = 0; row < moduleCount - 1; row += 1) {
          for (var col = 0; col < moduleCount - 1; col += 1) {
            var count = 0;
            if (qrcode.isDark(row, col) ) count += 1;
            if (qrcode.isDark(row + 1, col) ) count += 1;
            if (qrcode.isDark(row, col + 1) ) count += 1;
            if (qrcode.isDark(row + 1, col + 1) ) count += 1;
            if (count == 0 || count == 4) {
              lostPoint += 3;
            }
          }
        }
  
        // LEVEL3
  
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount - 6; col += 1) {
            if (qrcode.isDark(row, col)
                && !qrcode.isDark(row, col + 1)
                &&  qrcode.isDark(row, col + 2)
                &&  qrcode.isDark(row, col + 3)
                &&  qrcode.isDark(row, col + 4)
                && !qrcode.isDark(row, col + 5)
                &&  qrcode.isDark(row, col + 6) ) {
              lostPoint += 40;
            }
          }
        }
  
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount - 6; row += 1) {
            if (qrcode.isDark(row, col)
                && !qrcode.isDark(row + 1, col)
                &&  qrcode.isDark(row + 2, col)
                &&  qrcode.isDark(row + 3, col)
                &&  qrcode.isDark(row + 4, col)
                && !qrcode.isDark(row + 5, col)
                &&  qrcode.isDark(row + 6, col) ) {
              lostPoint += 40;
            }
          }
        }
  
        // LEVEL4
  
        var darkCount = 0;
  
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount; row += 1) {
            if (qrcode.isDark(row, col) ) {
              darkCount += 1;
            }
          }
        }
  
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
  
        return lostPoint;
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // QRMath
    //---------------------------------------------------------------------
  
    var QRMath = function() {
  
      var EXP_TABLE = new Array(256);
      var LOG_TABLE = new Array(256);
  
      // initialize tables
      for (var i = 0; i < 8; i += 1) {
        EXP_TABLE[i] = 1 << i;
      }
      for (var i = 8; i < 256; i += 1) {
        EXP_TABLE[i] = EXP_TABLE[i - 4]
          ^ EXP_TABLE[i - 5]
          ^ EXP_TABLE[i - 6]
          ^ EXP_TABLE[i - 8];
      }
      for (var i = 0; i < 255; i += 1) {
        LOG_TABLE[EXP_TABLE[i] ] = i;
      }
  
      var _this = {};
  
      _this.glog = function(n) {
  
        if (n < 1) {
          throw 'glog(' + n + ')';
        }
  
        return LOG_TABLE[n];
      };
  
      _this.gexp = function(n) {
  
        while (n < 0) {
          n += 255;
        }
  
        while (n >= 256) {
          n -= 255;
        }
  
        return EXP_TABLE[n];
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // qrPolynomial
    //---------------------------------------------------------------------
  
    function qrPolynomial(num, shift) {
  
      if (typeof num.length == 'undefined') {
        throw num.length + '/' + shift;
      }
  
      var _num = function() {
        var offset = 0;
        while (offset < num.length && num[offset] == 0) {
          offset += 1;
        }
        var _num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i += 1) {
          _num[i] = num[i + offset];
        }
        return _num;
      }();
  
      var _this = {};
  
      _this.getAt = function(index) {
        return _num[index];
      };
  
      _this.getLength = function() {
        return _num.length;
      };
  
      _this.multiply = function(e) {
  
        var num = new Array(_this.getLength() + e.getLength() - 1);
  
        for (var i = 0; i < _this.getLength(); i += 1) {
          for (var j = 0; j < e.getLength(); j += 1) {
            num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
          }
        }
  
        return qrPolynomial(num, 0);
      };
  
      _this.mod = function(e) {
  
        if (_this.getLength() - e.getLength() < 0) {
          return _this;
        }
  
        var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );
  
        var num = new Array(_this.getLength() );
        for (var i = 0; i < _this.getLength(); i += 1) {
          num[i] = _this.getAt(i);
        }
  
        for (var i = 0; i < e.getLength(); i += 1) {
          num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
        }
  
        // recursive call
        return qrPolynomial(num, 0).mod(e);
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // QRRSBlock
    //---------------------------------------------------------------------
  
    var QRRSBlock = function() {
  
      var RS_BLOCK_TABLE = [
  
        // L
        // M
        // Q
        // H
  
        // 1
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
  
        // 2
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
  
        // 3
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
  
        // 4
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
  
        // 5
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
  
        // 6
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
  
        // 7
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
  
        // 8
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
  
        // 9
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
  
        // 10
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
  
        // 11
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
  
        // 12
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
  
        // 13
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
  
        // 14
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
  
        // 15
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12, 7, 37, 13],
  
        // 16
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
  
        // 17
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
  
        // 18
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
  
        // 19
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
  
        // 20
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
  
        // 21
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
  
        // 22
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
  
        // 23
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
  
        // 24
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
  
        // 25
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
  
        // 26
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
  
        // 27
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
  
        // 28
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
  
        // 29
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
  
        // 30
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
  
        // 31
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
  
        // 32
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
  
        // 33
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
  
        // 34
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
  
        // 35
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
  
        // 36
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
  
        // 37
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
  
        // 38
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
  
        // 39
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
  
        // 40
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
      ];
  
      var qrRSBlock = function(totalCount, dataCount) {
        var _this = {};
        _this.totalCount = totalCount;
        _this.dataCount = dataCount;
        return _this;
      };
  
      var _this = {};
  
      var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
  
        switch(errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default :
          return undefined;
        }
      };
  
      _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
  
        var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
  
        if (typeof rsBlock == 'undefined') {
          throw 'bad rs block @ typeNumber:' + typeNumber +
              '/errorCorrectionLevel:' + errorCorrectionLevel;
        }
  
        var length = rsBlock.length / 3;
  
        var list = [];
  
        for (var i = 0; i < length; i += 1) {
  
          var count = rsBlock[i * 3 + 0];
          var totalCount = rsBlock[i * 3 + 1];
          var dataCount = rsBlock[i * 3 + 2];
  
          for (var j = 0; j < count; j += 1) {
            list.push(qrRSBlock(totalCount, dataCount) );
          }
        }
  
        return list;
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // qrBitBuffer
    //---------------------------------------------------------------------
  
    var qrBitBuffer = function() {
  
      var _buffer = [];
      var _length = 0;
  
      var _this = {};
  
      _this.getBuffer = function() {
        return _buffer;
      };
  
      _this.getAt = function(index) {
        var bufIndex = Math.floor(index / 8);
        return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
      };
  
      _this.put = function(num, length) {
        for (var i = 0; i < length; i += 1) {
          _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
        }
      };
  
      _this.getLengthInBits = function() {
        return _length;
      };
  
      _this.putBit = function(bit) {
  
        var bufIndex = Math.floor(_length / 8);
        if (_buffer.length <= bufIndex) {
          _buffer.push(0);
        }
  
        if (bit) {
          _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
        }
  
        _length += 1;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrNumber
    //---------------------------------------------------------------------
  
    var qrNumber = function(data) {
  
      var _mode = QRMode.MODE_NUMBER;
      var _data = data;
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _data.length;
      };
  
      _this.write = function(buffer) {
  
        var data = _data;
  
        var i = 0;
  
        while (i + 2 < data.length) {
          buffer.put(strToNum(data.substring(i, i + 3) ), 10);
          i += 3;
        }
  
        if (i < data.length) {
          if (data.length - i == 1) {
            buffer.put(strToNum(data.substring(i, i + 1) ), 4);
          } else if (data.length - i == 2) {
            buffer.put(strToNum(data.substring(i, i + 2) ), 7);
          }
        }
      };
  
      var strToNum = function(s) {
        var num = 0;
        for (var i = 0; i < s.length; i += 1) {
          num = num * 10 + chatToNum(s.charAt(i) );
        }
        return num;
      };
  
      var chatToNum = function(c) {
        if ('0' <= c && c <= '9') {
          return c.charCodeAt(0) - '0'.charCodeAt(0);
        }
        throw 'illegal char :' + c;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrAlphaNum
    //---------------------------------------------------------------------
  
    var qrAlphaNum = function(data) {
  
      var _mode = QRMode.MODE_ALPHA_NUM;
      var _data = data;
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _data.length;
      };
  
      _this.write = function(buffer) {
  
        var s = _data;
  
        var i = 0;
  
        while (i + 1 < s.length) {
          buffer.put(
            getCode(s.charAt(i) ) * 45 +
            getCode(s.charAt(i + 1) ), 11);
          i += 2;
        }
  
        if (i < s.length) {
          buffer.put(getCode(s.charAt(i) ), 6);
        }
      };
  
      var getCode = function(c) {
  
        if ('0' <= c && c <= '9') {
          return c.charCodeAt(0) - '0'.charCodeAt(0);
        } else if ('A' <= c && c <= 'Z') {
          return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
        } else {
          switch (c) {
          case ' ' : return 36;
          case '$' : return 37;
          case '%' : return 38;
          case '*' : return 39;
          case '+' : return 40;
          case '-' : return 41;
          case '.' : return 42;
          case '/' : return 43;
          case ':' : return 44;
          default :
            throw 'illegal char :' + c;
          }
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qr8BitByte
    //---------------------------------------------------------------------
  
    var qr8BitByte = function(data) {
  
      var _mode = QRMode.MODE_8BIT_BYTE;
      var _data = data;
      var _bytes = qrcode.stringToBytes(data);
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _bytes.length;
      };
  
      _this.write = function(buffer) {
        for (var i = 0; i < _bytes.length; i += 1) {
          buffer.put(_bytes[i], 8);
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrKanji
    //---------------------------------------------------------------------
  
    var qrKanji = function(data) {
  
      var _mode = QRMode.MODE_KANJI;
      var _data = data;
  
      var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
      if (!stringToBytes) {
        throw 'sjis not supported.';
      }
      !function(c, code) {
        // self test for sjis support.
        var test = stringToBytes(c);
        if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
          throw 'sjis not supported.';
        }
      }('\u53cb', 0x9746);
  
      var _bytes = stringToBytes(data);
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return ~~(_bytes.length / 2);
      };
  
      _this.write = function(buffer) {
  
        var data = _bytes;
  
        var i = 0;
  
        while (i + 1 < data.length) {
  
          var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);
  
          if (0x8140 <= c && c <= 0x9FFC) {
            c -= 0x8140;
          } else if (0xE040 <= c && c <= 0xEBBF) {
            c -= 0xC140;
          } else {
            throw 'illegal char at ' + (i + 1) + '/' + c;
          }
  
          c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);
  
          buffer.put(c, 13);
  
          i += 2;
        }
  
        if (i < data.length) {
          throw 'illegal char at ' + (i + 1);
        }
      };
  
      return _this;
    };
  
    //=====================================================================
    // GIF Support etc.
    //
  
    //---------------------------------------------------------------------
    // byteArrayOutputStream
    //---------------------------------------------------------------------
  
    var byteArrayOutputStream = function() {
  
      var _bytes = [];
  
      var _this = {};
  
      _this.writeByte = function(b) {
        _bytes.push(b & 0xff);
      };
  
      _this.writeShort = function(i) {
        _this.writeByte(i);
        _this.writeByte(i >>> 8);
      };
  
      _this.writeBytes = function(b, off, len) {
        off = off || 0;
        len = len || b.length;
        for (var i = 0; i < len; i += 1) {
          _this.writeByte(b[i + off]);
        }
      };
  
      _this.writeString = function(s) {
        for (var i = 0; i < s.length; i += 1) {
          _this.writeByte(s.charCodeAt(i) );
        }
      };
  
      _this.toByteArray = function() {
        return _bytes;
      };
  
      _this.toString = function() {
        var s = '';
        s += '[';
        for (var i = 0; i < _bytes.length; i += 1) {
          if (i > 0) {
            s += ',';
          }
          s += _bytes[i];
        }
        s += ']';
        return s;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // base64EncodeOutputStream
    //---------------------------------------------------------------------
  
    var base64EncodeOutputStream = function() {
  
      var _buffer = 0;
      var _buflen = 0;
      var _length = 0;
      var _base64 = '';
  
      var _this = {};
  
      var writeEncoded = function(b) {
        _base64 += String.fromCharCode(encode(b & 0x3f) );
      };
  
      var encode = function(n) {
        if (n < 0) {
          // error.
        } else if (n < 26) {
          return 0x41 + n;
        } else if (n < 52) {
          return 0x61 + (n - 26);
        } else if (n < 62) {
          return 0x30 + (n - 52);
        } else if (n == 62) {
          return 0x2b;
        } else if (n == 63) {
          return 0x2f;
        }
        throw 'n:' + n;
      };
  
      _this.writeByte = function(n) {
  
        _buffer = (_buffer << 8) | (n & 0xff);
        _buflen += 8;
        _length += 1;
  
        while (_buflen >= 6) {
          writeEncoded(_buffer >>> (_buflen - 6) );
          _buflen -= 6;
        }
      };
  
      _this.flush = function() {
  
        if (_buflen > 0) {
          writeEncoded(_buffer << (6 - _buflen) );
          _buffer = 0;
          _buflen = 0;
        }
  
        if (_length % 3 != 0) {
          // padding
          var padlen = 3 - _length % 3;
          for (var i = 0; i < padlen; i += 1) {
            _base64 += '=';
          }
        }
      };
  
      _this.toString = function() {
        return _base64;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // base64DecodeInputStream
    //---------------------------------------------------------------------
  
    var base64DecodeInputStream = function(str) {
  
      var _str = str;
      var _pos = 0;
      var _buffer = 0;
      var _buflen = 0;
  
      var _this = {};
  
      _this.read = function() {
  
        while (_buflen < 8) {
  
          if (_pos >= _str.length) {
            if (_buflen == 0) {
              return -1;
            }
            throw 'unexpected end of file./' + _buflen;
          }
  
          var c = _str.charAt(_pos);
          _pos += 1;
  
          if (c == '=') {
            _buflen = 0;
            return -1;
          } else if (c.match(/^\s$/) ) {
            // ignore if whitespace.
            continue;
          }
  
          _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
          _buflen += 6;
        }
  
        var n = (_buffer >>> (_buflen - 8) ) & 0xff;
        _buflen -= 8;
        return n;
      };
  
      var decode = function(c) {
        if (0x41 <= c && c <= 0x5a) {
          return c - 0x41;
        } else if (0x61 <= c && c <= 0x7a) {
          return c - 0x61 + 26;
        } else if (0x30 <= c && c <= 0x39) {
          return c - 0x30 + 52;
        } else if (c == 0x2b) {
          return 62;
        } else if (c == 0x2f) {
          return 63;
        } else {
          throw 'c:' + c;
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // gifImage (B/W)
    //---------------------------------------------------------------------
  
    var gifImage = function(width, height) {
  
      var _width = width;
      var _height = height;
      var _data = new Array(width * height);
  
      var _this = {};
  
      _this.setPixel = function(x, y, pixel) {
        _data[y * _width + x] = pixel;
      };
  
      _this.write = function(out) {
  
        //---------------------------------
        // GIF Signature
  
        out.writeString('GIF87a');
  
        //---------------------------------
        // Screen Descriptor
  
        out.writeShort(_width);
        out.writeShort(_height);
  
        out.writeByte(0x80); // 2bit
        out.writeByte(0);
        out.writeByte(0);
  
        //---------------------------------
        // Global Color Map
  
        // black
        out.writeByte(0x00);
        out.writeByte(0x00);
        out.writeByte(0x00);
  
        // white
        out.writeByte(0xff);
        out.writeByte(0xff);
        out.writeByte(0xff);
  
        //---------------------------------
        // Image Descriptor
  
        out.writeString(',');
        out.writeShort(0);
        out.writeShort(0);
        out.writeShort(_width);
        out.writeShort(_height);
        out.writeByte(0);
  
        //---------------------------------
        // Local Color Map
  
        //---------------------------------
        // Raster Data
  
        var lzwMinCodeSize = 2;
        var raster = getLZWRaster(lzwMinCodeSize);
  
        out.writeByte(lzwMinCodeSize);
  
        var offset = 0;
  
        while (raster.length - offset > 255) {
          out.writeByte(255);
          out.writeBytes(raster, offset, 255);
          offset += 255;
        }
  
        out.writeByte(raster.length - offset);
        out.writeBytes(raster, offset, raster.length - offset);
        out.writeByte(0x00);
  
        //---------------------------------
        // GIF Terminator
        out.writeString(';');
      };
  
      var bitOutputStream = function(out) {
  
        var _out = out;
        var _bitLength = 0;
        var _bitBuffer = 0;
  
        var _this = {};
  
        _this.write = function(data, length) {
  
          if ( (data >>> length) != 0) {
            throw 'length over';
          }
  
          while (_bitLength + length >= 8) {
            _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
            length -= (8 - _bitLength);
            data >>>= (8 - _bitLength);
            _bitBuffer = 0;
            _bitLength = 0;
          }
  
          _bitBuffer = (data << _bitLength) | _bitBuffer;
          _bitLength = _bitLength + length;
        };
  
        _this.flush = function() {
          if (_bitLength > 0) {
            _out.writeByte(_bitBuffer);
          }
        };
  
        return _this;
      };
  
      var getLZWRaster = function(lzwMinCodeSize) {
  
        var clearCode = 1 << lzwMinCodeSize;
        var endCode = (1 << lzwMinCodeSize) + 1;
        var bitLength = lzwMinCodeSize + 1;
  
        // Setup LZWTable
        var table = lzwTable();
  
        for (var i = 0; i < clearCode; i += 1) {
          table.add(String.fromCharCode(i) );
        }
        table.add(String.fromCharCode(clearCode) );
        table.add(String.fromCharCode(endCode) );
  
        var byteOut = byteArrayOutputStream();
        var bitOut = bitOutputStream(byteOut);
  
        // clear code
        bitOut.write(clearCode, bitLength);
  
        var dataIndex = 0;
  
        var s = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
  
        while (dataIndex < _data.length) {
  
          var c = String.fromCharCode(_data[dataIndex]);
          dataIndex += 1;
  
          if (table.contains(s + c) ) {
  
            s = s + c;
  
          } else {
  
            bitOut.write(table.indexOf(s), bitLength);
  
            if (table.size() < 0xfff) {
  
              if (table.size() == (1 << bitLength) ) {
                bitLength += 1;
              }
  
              table.add(s + c);
            }
  
            s = c;
          }
        }
  
        bitOut.write(table.indexOf(s), bitLength);
  
        // end code
        bitOut.write(endCode, bitLength);
  
        bitOut.flush();
  
        return byteOut.toByteArray();
      };
  
      var lzwTable = function() {
  
        var _map = {};
        var _size = 0;
  
        var _this = {};
  
        _this.add = function(key) {
          if (_this.contains(key) ) {
            throw 'dup key:' + key;
          }
          _map[key] = _size;
          _size += 1;
        };
  
        _this.size = function() {
          return _size;
        };
  
        _this.indexOf = function(key) {
          return _map[key];
        };
  
        _this.contains = function(key) {
          return typeof _map[key] != 'undefined';
        };
  
        return _this;
      };
  
      return _this;
    };
  
    var createDataURL = function(width, height, getPixel) {
      var gif = gifImage(width, height);
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          gif.setPixel(x, y, getPixel(x, y) );
        }
      }
  
      var b = byteArrayOutputStream();
      gif.write(b);
  
      var base64 = base64EncodeOutputStream();
      var bytes = b.toByteArray();
      for (var i = 0; i < bytes.length; i += 1) {
        base64.writeByte(bytes[i]);
      }
      base64.flush();
  
      return 'data:image/gif;base64,' + base64;
    };
  
    //---------------------------------------------------------------------
    // returns qrcode function.
  
    return qrcode;
  }();
  
  // multibyte support
  !function() {
  
    qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
      // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
      function toUTF8Array(str) {
        var utf8 = [];
        for (var i=0; i < str.length; i++) {
          var charcode = str.charCodeAt(i);
          if (charcode < 0x80) utf8.push(charcode);
          else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
          }
          else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
          }
          // surrogate pair
          else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
              | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18),
                0x80 | ((charcode>>12) & 0x3f),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
          }
        }
        return utf8;
      }
      return toUTF8Array(s);
    };
  
  }();
  qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
  return qrcode;
  })();
  
  function qrSVG(txt,size=72,opt={}){
    const ecl=opt.ecl||"M", dark=opt.dark||"#0b1f19", light=opt.light||"#ffffff", quiet=opt.quiet??2;
    let q=null;
    for(const lv of [ecl,"L"]){ try{ const t=QRLIB(0,lv); t.addData(txt,"Byte"); t.make(); q=t; break; }catch(e){} }
    if(!q)return `<svg width="${size}" height="${size}"></svg>`;
    const n=q.getModuleCount(), t=n+quiet*2; let d="";
    for(let r=0;r<n;r++){ let c=0;
      while(c<n){ if(q.isDark(r,c)){ let w=1; while(c+w<n&&q.isDark(r,c+w))w++; d+=`M${c+quiet} ${r+quiet}h${w}v1h-${w}z`; c+=w; } else c++; } }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${size}" height="${size}" shape-rendering="crispEdges">`
      +`<rect width="${t}" height="${t}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }
  /* vCard payload — scanning saves the donor as a phone contact.
     Kept compact on purpose: Bangla is 3 bytes/char in UTF-8, and a smaller
     payload means fewer QR modules, which is what makes the printed
     22mm card QR reliably scannable by a phone camera. */
  function vcardText(){
    const d=STORE.donor, ec=v=>String(v??"").replace(/([,;\\])/g,"\\$1").replace(/\n/g,"\\n");
    const ph=String(dv("phone")||"").replace(/\D/g,""), intl=ph.length===11?"+88"+ph:ph;
    const L=["BEGIN:VCARD","VERSION:3.0",
      "FN:"+ec(dv("name")),
      "ORG:CBDC",
      "TITLE:"+ec(d.bloodGroup+" রক্তদাতা")];
    if(intl)L.push("TEL;CELL:"+intl);
    L.push("NOTE:"+ec(d.donorId+" · "+dv("area")+" · "+(restLeft()>0?"বিশ্রামে":d.available?"প্রস্তুত":"বন্ধ")));
    L.push("END:VCARD");
    return L.join("\r\n");
  }
  /* human-readable list of exactly what the QR carries — shown on the card screen */
  function qrFields(){
    const d=STORE.donor;
    return [["নাম",dv("name")],["রক্তের গ্রুপ",d.bloodGroup],["মোবাইল",dv("phone")],
      ["সংগঠন","CBDC"],["ডোনার আইডি",d.donorId],["এলাকা",dv("area")],
      ["অবস্থা",restLeft()>0?"বিশ্রামে":d.available?"রক্তদানে প্রস্তুত":"আপাতত বন্ধ"]];
  }
  const qr=(txt,size=72)=>qrSVG(txt,size);
  
  /* ---------- toast ---------- */
  function toast(msg,kind=""){
    const b=$("#toasts");
    if(b.lastElementChild&&b.lastElementChild.dataset.m===msg)return;
    const t=document.createElement("div");t.className=kind;t.dataset.m=msg;
    t.innerHTML=(kind==="ok"?ICON.checkC(17):kind==="er"?ICON.warn(17):ICON.info(17))+`<span>${esc(msg)}</span>`;
    b.append(t);setTimeout(()=>t.remove(),3200);
  }
  
  /* ══════════ STORE (single source of truth) ══════════ */
  const LS="cbdc.app";
  const STORE={
    account:{
      uid:"", name:"", username:"", email:"",
      phone:"", photo:"", photoSource:"none",
      emailVerified:false, phoneVerified:false,
      dob:"", gender:"", area:"",
      address:"",
      joined:iso(now())
    },
    donor:{
      is:false, status:"none", donorId:"",
      bloodGroup:"", whatsapp:"", lastDonation:"",
      health:"",
      available:true, appliedAt:"", cardTheme:"green",
      /* ডোনার তালিকার জন্য আলাদা মান — null মানে অ্যাকাউন্টের তথ্যই ব্যবহার হবে */
      ov:{name:null,gender:null,age:null,area:null,phone:null}
    },
    privacy:{ profile:"all", showPhone:"responders", showWhatsapp:true, showGroup:true, showArea:true, searchable:true },
    notif:{ emergency:true, onlyGroup:true, onlyArea:false, donor:true, account:true, security:true, quiet:false },
    prefs:{ theme:"light", lang:"bn", dense:false, anim:true, badge:true },
    security:{ loginAlert:true, passwordChangedAt:"" },
    saved:[]
  };
  
  /* the whole account is persisted */
  let SHARED_PULLING=false;
  function save(){try{localStorage.setItem(LS,JSON.stringify({
    account:STORE.account, donor:STORE.donor,
    privacy:STORE.privacy, notif:STORE.notif, prefs:STORE.prefs,
    security:STORE.security, saved:STORE.saved}))}catch(e){}
    if(!SHARED_PULLING)queueMicrotask(publishPersonalShared);
  }
  function load(){try{const d=JSON.parse(localStorage.getItem(LS)||"{}");
    if(d.account)Object.assign(STORE.account,d.account);
    if(d.donor){const ov=STORE.donor.ov;Object.assign(STORE.donor,d.donor);
      STORE.donor.ov=Object.assign(ov,d.donor.ov||{});}
    if(d.prefs)Object.assign(STORE.prefs,d.prefs);
    if(d.privacy)Object.assign(STORE.privacy,d.privacy);
    if(d.notif)Object.assign(STORE.notif,d.notif);
    if(d.security)Object.assign(STORE.security,d.security);
    if(d.saved)STORE.saved=d.saved;
    /* legacy key from an earlier build */
    if(!d.account&&d.ov)Object.assign(STORE.donor.ov,d.ov);
  }catch(e){}}
  load();
  
  /* ══════════ DATA ══════════ */
  /* ══════════ DATA (real, persisted in this browser) ══════════
     Nothing here is fake: every list starts empty and only grows from what the
     user actually does. Saved under localStorage["cbdc.data"] alongside the
     account in localStorage["cbdc.app"]. Swapping this object for Firestore
     later touches only load/saveData — no screen has to change. */
  const LS_DATA="cbdc.data";
  const RAW={ donations:[], incoming:[], mine:[], notifs:[], activity:[], sessions:[], donors:[] };
  function loadData(){
    try{
      const d=JSON.parse(localStorage.getItem(LS_DATA)||"{}");
      ["donations","incoming","mine","notifs","activity","sessions","donors"].forEach(k=>{
        if(Array.isArray(d[k]))RAW[k]=d[k];
      });
    }catch(e){}
    if(!RAW.sessions.length){
      RAW.sessions=[{id:"s1",name:thisDevice(),place:"এই ডিভাইস",last:"বর্তমানে সক্রিয়",cur:true}];
    }
  }
  function saveData(){try{localStorage.setItem(LS_DATA,JSON.stringify(RAW))}catch(e){}
    if(!SHARED_PULLING)queueMicrotask(publishPersonalShared);
  }
  function thisDevice(){
    const u=navigator.userAgent;
    const br=/Edg\//.test(u)?"Edge":/OPR\//.test(u)?"Opera":/Chrome\//.test(u)?"Chrome"
      :/Safari\//.test(u)?"Safari":/Firefox\//.test(u)?"Firefox":"Browser";
    const os=/Android/.test(u)?"Android":/iPhone|iPad/.test(u)?"iOS":/Windows/.test(u)?"Windows"
      :/Mac OS/.test(u)?"macOS":/Linux/.test(u)?"Linux":"";
    return br+(os?" · "+os:"");
  }
  loadData();
  const DB=()=>RAW;
  
  /* a donor is "ready" when the 90-day rest period has passed */
  const donorReady=d=>!d.lastDonation||dayDiff(d.lastDonation)>=90;
  const donorRest=d=>d.lastDonation?Math.max(0,90-dayDiff(d.lastDonation)):0;
  
  const GROUPS=SITE.bloodGroups.slice();
  const AREAS=SITE.areas.slice();
  const HOSPITALS=["চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল","চমেক ব্লাড ব্যাংক","ম্যাক্স হাসপাতাল, মেহেদীবাগ",
    "সিএসসিআর হাসপাতাল","পার্কভিউ হাসপাতাল","ইম্পেরিয়াল হাসপাতাল","মেট্রোপলিটন হাসপাতাল",
    "রেড ক্রিসেন্ট ব্লাড ব্যাংক","সন্ধানী, চমেক","ক্লাবের রক্তদান ক্যাম্প"];
  
  /* Shared public data and personal-work adapters. */
  function requestForDoner(r){
    let left=24;
    if(r.expiresAt){const ms=new Date(r.expiresAt).getTime()-Date.now();if(Number.isFinite(ms))left=Math.max(0,Math.ceil(ms/36e5))}
    return {id:r.id,patient:r.patientName,group:r.bloodGroup,bags:r.bags,hospital:r.hospitalName,
      area:r.hospitalAddress,km:"২.৫",urgency:r.urgency,phone:r.phone,left,
      status:r.workflowStatus||"approved",neededBy:(r.expiresAt||"").slice(0,10),responders:[]};
  }
  function pullSharedPublic(){
    if(!window.CBDCShared)return;
    SHARED_PULLING=true;
    const st=CBDCShared.load();
    RAW.donors=st.donors.filter(d=>d.status!=="pending"&&!d.suspended).map(CBDCShared.toDonerDonor);
    RAW.incoming=st.requests.filter(r=>r.status!=="cancelled"&&r.status!=="resolved").map(requestForDoner);
    RAW.mine.forEach(m=>{
      const live=st.requests.find(r=>r.id===m.id),pending=st.queue.find(q=>q.kind==="request"&&q.id===m.id);
      if(live){m.status=live.workflowStatus==="matched"?"matched":"approved";m.responders=Array.isArray(live.responders)?live.responders:[]}
      else if(pending)m.status="pending";
    });
    const mine=st.donors.find(d=>(STORE.account.uid&&d.ownerUid===STORE.account.uid)||(STORE.account.phone&&d.phone===STORE.account.phone));
    if(mine&&STORE.donor.is){
      STORE.donor.status="approved";STORE.donor.donorId=mine.id;STORE.donor.bloodGroup=mine.bloodGroup;
      STORE.donor.lastDonation=mine.lastDonationDate||"";
    }
    try{localStorage.setItem(LS_DATA,JSON.stringify(RAW));localStorage.setItem(LS,JSON.stringify({
      account:STORE.account,donor:STORE.donor,privacy:STORE.privacy,notif:STORE.notif,prefs:STORE.prefs,
      security:STORE.security,saved:STORE.saved}))}catch(e){}
    SHARED_PULLING=false;
  }
  function publishPersonalShared(){
    if(SHARED_PULLING||!window.CBDCShared||!STORE.account.name)return;
    CBDCShared.update(st=>{
      const a=STORE.account,d=STORE.donor,owner=a.uid||a.phone||a.email;
      const ai=st.accounts.findIndex(x=>x.uid===owner||a.email&&x.email===a.email);
      const account={uid:owner,name:a.name,username:a.username,email:a.email,phone:a.phone,photo:a.photo,
        gender:a.gender,area:a.area,address:a.address,role:"donor",status:"active",joined:a.joined};
      ai<0?st.accounts.push(account):st.accounts[ai]={...st.accounts[ai],...account};
      const qid="PD-"+String(d.donorId||owner).replace(/[^A-Za-z0-9]/g,"").slice(-10);
      const oldQ=st.queue.findIndex(q=>q.kind==="donor"&&(q.ownerUid===owner||a.phone&&q.phone===a.phone));
      if(d.is&&d.status==="pending"){
        const q={kind:"donor",id:qid,donorId:d.donorId,name:a.name,group:d.bloodGroup,area:a.area,
          age:ageFromDob(a.dob)||d.ov.age||"",health:d.health||"",last:d.lastDonation||"",gender:a.gender,
          phone:a.phone,whatsapp:d.whatsapp||"",ownerUid:owner,at:new Date().toISOString()};
        oldQ<0?st.queue.unshift(q):st.queue[oldQ]={...st.queue[oldQ],...q};
      }else if(oldQ>=0)st.queue.splice(oldQ,1);
      if(d.is&&d.status==="approved"){
        const me={uid:owner,donorId:d.donorId,id:d.donorId,name:dv("name"),group:d.bloodGroup,gender:dv("gender"),
          age:dv("age"),phone:dv("phone"),area:dv("area"),whatsapp:d.whatsapp||dv("phone"),lastDonation:d.lastDonation,
          totalDonations:RAW.donations.filter(x=>x.ok).length,joined:a.joined,verified:true,ownerUid:owner};
        const di=st.donors.findIndex(x=>x.id===d.donorId||x.ownerUid===owner);const c=CBDCShared.fromDonerDonor(me);
        di<0?st.donors.unshift(c):st.donors[di]={...st.donors[di],...c};
      }
      RAW.mine.forEach(m=>{
        const qi=st.queue.findIndex(q=>q.kind==="request"&&q.id===m.id);
        const ri=st.requests.findIndex(r=>r.id===m.id);
        if(m.status==="pending"){
          const q={kind:"request",id:m.id,patient:m.patient,group:m.group,bags:m.bags,urgency:m.urgency,
            hospital:m.hospital,area:m.address||a.area,phone:a.phone,requester:a.name,ownerUid:owner,
            at:m.createdAt||new Date().toISOString(),expiresAt:m.neededBy?m.neededBy+"T23:59:59":""};
          qi<0?st.queue.unshift(q):st.queue[qi]={...st.queue[qi],...q};
        }else if(m.status==="cancelled"||m.status==="done"){
          if(qi>=0)st.queue.splice(qi,1);if(ri>=0)st.requests.splice(ri,1);
        }
      });
      RAW.donations.filter(x=>!x.ok).forEach((x,i)=>{
        const id="DN-"+owner+"-"+x.date.replaceAll("-","");
        if(!st.queue.some(q=>q.kind==="donation"&&q.id===id))st.queue.unshift({kind:"donation",id,
          name:a.name,place:x.place,date:x.date,bags:x.bags,proof:!!x.proof,ownerUid:owner,at:new Date().toISOString()});
      });
      return st;
    },"doner:personal");
  }
  
  pullSharedPublic();
  
  /* ---------- derived ---------- */
  /* ডোনার প্রোফাইলে দেখানো তথ্য:
     override থাকলে সেটি, নইলে অ্যাকাউন্টের তথ্য (single source of truth) */
  const ageFromDob=v=>v?Math.floor(dayDiff(v)/365.25):"";
  const DFIELDS=[
    {k:"name",  label:"নাম",     type:"text"},
    {k:"gender",label:"লিঙ্গ",   type:"select",options:["পুরুষ","মহিলা","অন্যান্য"]},
    {k:"age",   label:"বয়স",     type:"number",min:18,max:60},
    {k:"area",  label:"এলাকা",   type:"select",options:AREAS},
    {k:"phone", label:"মোবাইল",  type:"tel",max:11}
  ];
  const acctVal=k=>k==="age"?ageFromDob(STORE.account.dob):STORE.account[k];
  /* ── who is the card being drawn for? ──────────────────────────────
     Every card renderer used to read STORE directly, so it could only ever
     draw the logged-in user. CARD_FOR lets the same renderers draw ANY donor:
     set it, draw, clear it. Nothing else in the app changes. */
  let CARD_FOR=null;                       /* null = me */
  function cardSubject(){
    if(!CARD_FOR)return {a:STORE.account,d:STORE.donor,mine:true};
    const x=CARD_FOR;
    return {
      mine:false,
      a:{name:x.name,gender:x.gender,area:x.area,phone:x.phone,photo:x.photo||"",dob:""},
      d:{donorId:x.donorId,bloodGroup:x.group,lastDonation:x.lastDonation||"",
         available:true,cardTheme:"green",whatsapp:!!x.phone,
         ov:{name:x.name,gender:x.gender,age:x.age,area:x.area,phone:x.phone}}
    };
  }
  const dv=k=>{
    const S=cardSubject();
    if(!S.mine){const o=S.d.ov[k];return (o===null||o===undefined||o==="")?"":o}
    const o=STORE.donor.ov[k];return (o===null||o===undefined||o==="")?acctVal(k):o};
  const isOv=k=>{const o=STORE.donor.ov[k];return !(o===null||o===undefined||o==="")};
  const isDonor=()=>STORE.donor.is;
  const dStatus=()=>STORE.donor.status;
  const restLeft=()=>STORE.donor.lastDonation?Math.max(0,90-dayDiff(STORE.donor.lastDonation)):0;
  const myReqs=()=>DB().incoming.filter(r=>r.group===STORE.donor.bloodGroup);
  const unread=()=>DB().notifs.filter(n=>!n.read).length;
  const donorPill=()=>{
    if(!isDonor())return "";
    if(dStatus()==="pending")return `<span class="pill a">যাচাই চলছে</span>`;
    if(!STORE.donor.available)return `<span class="pill m">প্রাপ্যতা বন্ধ</span>`;
    if(restLeft()>0)return `<span class="pill a">${tp(`বিশ্রামে · আর ${bn(restLeft())} দিন`,`Resting · ${restLeft()} days left`)}</span>`;
    return `<span class="pill g">রক্তদানে প্রস্তুত</span>`;
  };
  
  /* ══════════ ROUTER ══════════ */
  const NAV=[
    {id:"home",label:"হোম",icon:ICON.home},
    {id:"find",label:"রক্তদাতা",icon:ICON.drop},
    {id:"req",label:"আবেদন",icon:ICON.plus},
    {id:"set",label:"সেটিংস",icon:ICON.gear}
  ];
  let CUR="home", SUB=null;
  
  function go(id,sub=null,push=true){
    CUR=id;SUB=sub;
    $$(".scr").forEach(s=>s.classList.remove("on"));
    if(sub){ $("#s-sub").classList.add("on"); renderSub(sub); }
    else{ $("#s-"+id).classList.add("on"); RENDER[id](); }
    paintTop();paintNav();
    if(push){const h=sub?`#${id}/${sub}`:`#${id}`; if(location.hash!==h)location.hash=h;}
    window.scrollTo({top:0,behavior:"instant"});
  }
  function paintNav(){
    $("#bnav").innerHTML=NAV.map(n=>`<button data-nav="${n.id}" class="${CUR===n.id?"on":""}"
      aria-label="${n.label}">${n.icon(23)}<span>${n.label}</span></button>`).join("");
  }
  function paintTop(){
    const t=$("#top");
    if(PUBLIC_MODE){
      t.className="top";
      t.innerHTML=`<a class="brand" href="index.html">
          <span class="lg"><img src="${LOGO}" alt="CBDC লোগো"></span>
          <b>চকবাজার ব্লাড ডোনার'স ক্লাব</b></a><div class="sp"></div>`;
      return;
    }
    if(SUB){
      const meta=SETTINGS_MAP[SUB];
      t.className="top sub";
      t.innerHTML=`<button class="back" id="tback" aria-label="পেছনে">${ICON.back(22)}</button>
        <h1>${esc(meta?meta.title:"")}</h1><div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${ICON.bell(21)}${badge()}</button>`;
    }else{
      t.className="top";
      t.innerHTML=`<a class="brand" href="#home" data-nav="home">
          <span class="lg"><img src="${LOGO}" alt="CBDC লোগো"></span><b>চকবাজার ব্লাড ডোনার'স ক্লাব</b></a>
        <nav class="dnav">${NAV.map(n=>`<button data-nav="${n.id}" class="${CUR===n.id?"on":""}"
          title="${n.label}">${n.icon(22)}<span>${n.label}</span></button>`).join("")}</nav>
        <div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${ICON.bell(21)}${badge()}</button>`;
    }
  }
  const badge=()=>{const u=unread();return u&&STORE.prefs.badge?`<span class="bd">${bn(u)}</span>`:""};
  
  document.addEventListener("click",e=>{
    const n=e.target.closest("[data-nav]");
    if(n){e.preventDefault();go(n.dataset.nav);return}
    if(e.target.closest("#tback")){go(CUR);return}
    if(e.target.closest("#tbell")){openNotifs();return}
  });
  window.addEventListener("hashchange",()=>{
    const [a,b]=location.hash.replace("#","").split("/");
    if(!a)return go("home",null,false);
    if(RENDER[a])go(a,b||null,false);
  });
  
  /* ══════════ SCREEN: HOME ══════════ */
  function rHome(){
    const a=STORE.account,d=STORE.donor,don=DB().donations,inc=myReqs();
    const hr=new Date().getHours();
    const greet=hr<12?"শুভ সকাল":hr<17?"শুভ দুপুর":hr<20?"শুভ সন্ধ্যা":"শুভ রাত্রি";
  
    const statusCard = !isDonor()
      ? `<div class="card">
          <div class="per"><span style="width:44px;height:44px;border-radius:50%;background:var(--red-s);
            display:grid;place-items:center;color:var(--red)">${ICON.drop(24)}</span>
            <div class="i"><b>আপনি এখনো রক্তদাতা নন</b><small>কয়েকটি তথ্য দিলেই যুক্ত হতে পারবেন</small></div></div>
          <button class="btn w" style="margin-top:12px" data-act="become">রক্তদাতা হিসেবে যুক্ত হন</button></div>`
      : `<div class="card">
          <div class="per"><span class="bg" style="width:46px;height:46px;border-radius:12px;font-size:1rem">${esc(d.bloodGroup)}</span>
            <div class="i"><b>${esc(dv("name"))}</b><small>${esc(d.donorId)} · ${esc(dv("area"))}</small></div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin:11px 0">${donorPill()}
            ${dStatus()==="approved"?`<span class="pill b n">${ICON.checkC(12)} যাচাইকৃত</span>`:""}</div>
          <div style="display:flex;gap:8px">
            <button class="btn gh sm" style="flex:1" data-act="card">${ICON.card(16)} কার্ড</button>
            <button class="btn gh sm" style="flex:1" data-sub="donor">${ICON.user(16)} তথ্য</button></div></div>`;
  
    const alert = (inc.length&&isDonor()) ? `<div class="card" style="border-color:rgba(224,36,47,.3)">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <span style="color:var(--red);flex:none">${ICON.warn(20)}</span>
          <div style="flex:1"><b style="font-size:.88rem">আপনার জন্য গুরুত্বপূর্ণ</b>
            <p class="mut" style="margin-top:2px">${tp(`${bn(inc.length)}টি ${esc(d.bloodGroup)} জরুরি আবেদন আপনার এলাকার কাছে`,`${inc.length} urgent ${esc(d.bloodGroup)} request${inc.length>1?"s":""} near your area`)}</p></div></div>
        <div style="display:flex;gap:8px;margin-top:11px">
          <button class="btn red sm" style="flex:1" data-nav="req">আবেদনগুলো দেখুন</button>
          <button class="btn gh sm" data-act="snooze">পরে</button></div></div>` : "";
  
    const nx=d.lastDonation?addD(d.lastDonation,90):null;
    const stats=isDonor()?`<div class="stats">
      <div class="stat"><b style="color:var(--red)">${bn(don.length)}</b><span>মোট রক্তদান</span></div>
      <div class="stat"><b>${bn(don.length*3)}</b><span>জীবন বাঁচিয়েছেন</span></div>
      <div class="stat"><b style="font-size:.9rem;padding:5px 0">${restLeft()?dS(nx):"এখনই"}</b><span>পরবর্তী রক্তদান</span></div>
      <div class="stat"><b>${bn(DB().mine.length)}</b><span>আমার আবেদন</span></div></div>`:"";
  
    let ready="";
    if(isDonor()&&d.lastDonation&&dStatus()==="approved"){
      const dd=dayDiff(d.lastDonation),pct=Math.min(100,Math.round(dd/90*100)),lf=restLeft();
      ready=`<div class="card"><div style="display:flex;justify-content:space-between;font-size:.8rem;font-weight:700;margin-bottom:7px">
          <span>রক্তদানের প্রস্তুতি</span><span style="color:${lf?"var(--amb)":"var(--grn)"}">${lf?`আর ${bn(lf)} দিন`:"প্রস্তুত ✓"}</span></div>
        <div style="height:8px;border-radius:99px;background:var(--card2);overflow:hidden">
          <div style="height:100%;width:${lf?pct:100}%;border-radius:99px;background:${lf?"var(--amb)":"var(--grn)"};transition:width .5s"></div></div>
        <p class="mut" style="margin-top:8px">${lf?tp(`${dL(nx)} তারিখে আবার রক্ত দিতে পারবেন।`,`You can donate again on ${dL(nx)}.`)
          :tp(`সর্বশেষ রক্তদানের পর ${bn(dd)} দিন পার হয়েছে।`,`${dd} days since your last donation.`)}</p></div>`;
    }
  
    const acts=DB().activity.slice(0,4);
    const actHTML=acts.length?`<div class="tl">${acts.map(x=>`<div class="tli ${x.type==="security"?"b":x.type==="donor"?"":"r"}">
        <b>${esc(x.title)}</b><small>${esc(x.detail)} · ${timeAgo(x.at)}</small></div>`).join("")}</div>`
      :`<div class="empty" style="padding:26px"><div class="ic">${ICON.clock(24)}</div>
        <b>এখনো কিছু নেই</b><p>আপনার কার্যক্রম এখানে দেখা যাবে</p></div>`;
  
    $("#s-home").innerHTML=`
      <h2 class="ptitle">${a.name?`${greet}, ${esc(a.name.split(" ")[0])}`:greet}
        <small>${now().toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long"})}</small></h2>
      ${statusCard}${alert}${stats}${ready}
      <div class="card pad0">
        <div style="padding:13px 15px 4px"><b style="font-size:.88rem">দ্রুত কাজ</b></div>
        <button class="row" data-nav="find"><span class="ic">${ICON.search(19)}</span>
          <span class="tx"><b>রক্তদাতা খুঁজুন</b><small>গ্রুপ ও এলাকা অনুযায়ী</small></span><span class="rt">${ICON.right(17)}</span></button>
        <button class="row" data-act="newreq"><span class="ic" style="background:var(--red-s);color:var(--red)">${ICON.plus(19)}</span>
          <span class="tx"><b>জরুরি রক্তের আবেদন</b><small>রোগীর জন্য রক্ত চান</small></span><span class="rt">${ICON.right(17)}</span></button>
        ${isDonor()?`<button class="row" data-act="adddon"><span class="ic">${ICON.drop(19)}</span>
          <span class="tx"><b>রক্তদান যোগ করুন</b><small>নতুন রক্তদানের রেকর্ড</small></span><span class="rt">${ICON.right(17)}</span></button>`:""}
      </div>
      <div class="card pad0">
        <div style="display:flex;align-items:center;padding:13px 15px 4px">
          <b style="font-size:.88rem;flex:1">সাম্প্রতিক কার্যক্রম</b>
          <button class="btn lnk" data-sub="activity" style="font-size:.76rem">সব দেখুন</button></div>
        <div style="padding:12px 15px 15px">${actHTML}</div></div>`;
  }
  function timeAgo(at){
    const d=new Date(at),diff=(now()-d)/1000;
    if(diff<3600){const v=Math.max(1,Math.floor(diff/60));return tp(`${bn(v)} মিনিট আগে`,`${v} min ago`)}
    if(diff<86400){const v=Math.floor(diff/3600);return tp(`${bn(v)} ঘণ্টা আগে`,`${v} hr ago`)}
    if(diff<172800)return "গতকাল";
    return d.toLocaleDateString(LOC(),{day:"numeric",month:"short"});
  }
  
  /* ══════════ SCREEN: FIND ══════════ */
  let findQ={g:"",a:"",ready:true,done:false};
  function rFind(){
    $("#s-find").innerHTML=`
      <h2 class="ptitle">রক্তদাতা খুঁজুন</h2>
      <div class="card">
        <div class="f2">
          <div class="f"><label>রক্তের গ্রুপ</label><select id="fg">
            <option value="">সব গ্রুপ</option>${GROUPS.map(g=>`<option ${findQ.g===g?"selected":""}>${g}</option>`).join("")}</select></div>
          <div class="f"><label>এলাকা</label><select id="fa">
            <option value="">সব এলাকা</option>${AREAS.map(a=>`<option ${findQ.a===a?"selected":""}>${a}</option>`).join("")}</select></div>
        </div>
        <label style="display:flex;align-items:center;gap:9px;font-size:.81rem;font-weight:600;cursor:pointer;margin-bottom:12px">
          <input type="checkbox" id="fr" ${findQ.ready?"checked":""} style="width:18px;height:18px;accent-color:var(--grn)">
          শুধু যারা এখন রক্তদানে প্রস্তুত</label>
        <button class="btn w" id="fbtn">${ICON.search(18)} খুঁজুন</button>
      </div>
      <div id="fres"></div>`;
    $("#fbtn").onclick=doFind;
    ["#fg","#fa","#fr"].forEach(s=>$(s).onchange=()=>{findQ.g=$("#fg").value;findQ.a=$("#fa").value;findQ.ready=$("#fr").checked});
    if(findQ.done)doFind();
  }
  async function doFind(){
    findQ.g=$("#fg").value;findQ.a=$("#fa").value;findQ.ready=$("#fr").checked;findQ.done=true;
    const box=$("#fres");
    box.innerHTML=`<div class="card">${[1,2,3].map(()=>`<div style="display:flex;gap:11px;padding:9px 0">
      <div class="sk" style="width:44px;height:44px;border-radius:50%"></div>
      <div style="flex:1"><div class="sk" style="height:13px;width:45%;margin-bottom:7px"></div>
      <div class="sk" style="height:11px;width:65%"></div></div></div>`).join("")}</div>`;
    await sleep(340);
    const rows=DB().donors.filter(d=>(!findQ.g||d.group===findQ.g)&&(!findQ.a||d.area===findQ.a)
      &&(!findQ.ready||donorReady(d)));
    box.innerHTML=rows.length?`
      <div style="display:flex;align-items:center;margin:4px 4px 10px">
        <b style="font-size:.85rem;flex:1">${tp(`${bn(rows.length)} জন রক্তদাতা পাওয়া গেছে`,`${rows.length} donor${rows.length!==1?"s":""} found`)}</b>
        <button class="btn lnk" id="fcsv" style="font-size:.75rem">${ICON.down(14)} নামান</button></div>
      ${rows.map((d,i)=>donorCardHTML(d,i)).join("")}`
      :`<div class="card"><div class="empty"><div class="ic">${ICON.search(26)}</div>
        <b>কোনো রক্তদাতা পাওয়া যায়নি</b><p>ফিল্টার বদলে আবার চেষ্টা করুন</p>
        <button class="btn gh" id="fclear">ফিল্টার মুছুন</button></div></div>`;
    $("#fcsv")&&($("#fcsv").onclick=()=>{
      const csv=["নাম,গ্রুপ,এলাকা,মোবাইল",...rows.map(d=>`"${d.name}","${d.group}","${d.area}","${d.phone}"`)].join("\n");
      dl(new Blob(["\ufeff"+csv],{type:"text/csv"}),"donors.csv");toast("তালিকা নামানো হচ্ছে");
    });
    $("#fclear")&&($("#fclear").onclick=()=>{findQ={g:"",a:"",ready:false,done:true};rFind()});
    box.querySelectorAll("[data-open-prof]").forEach(b=>b.onclick=e=>{
      e.stopPropagation();openProfile(b.dataset.openProf)});
    box.querySelectorAll(".dc-name").forEach(n=>{
      const card=n.closest("[data-prof]");if(!card||!card.dataset.prof)return;
      n.style.cursor="pointer";
      n.onclick=()=>openProfile(card.dataset.prof)});
  }
  /* donor card — same design as public website */
  function donorCardHTML(d,i){
    const id=d.donorId||("CBDC-2026-"+String(i+1).padStart(4,"0"));
    const age=d.age?`বয়স ${bn(d.age)} বছর`:"বয়স ২৫ বছর";
    const last=d.lastDonation?dL(d.lastDonation):"নতুন দাতা";
    /* readiness is derived from the rest period, never stored — and the list
       honours the same privacy rules as the profile screen, so a hidden
       number can never leak through the search results */
    const ready=donorReady(d);
    const pv=d.privacy||{};
    const phone=d.phone;                       /* always shown */
    const wa=pv.showWhatsapp!==false?phone:"";
    return `<div class="dcard-item" data-prof="${esc(d.uid||"")}">
      <div class="dc-top">
        <div>
          <div class="dc-id">${esc(id)}</div>
          <div class="dc-name">${esc(d.name)}</div>
          <div class="dc-st ${ready?"":"rest"}">${ready?"✓ রক্তদানে প্রস্তুত"
            :`বিশ্রামে · আর ${bn(donorRest(d))} দিন`}</div>
          <div class="dc-meta">
            <div>${ICON.pin(13)} এলাকা: <strong>${esc(d.area)}</strong></div>
            <div>${ICON.phone(13)} যোগাযোগ: <strong>${esc(phone)}</strong></div>
            <div>${ICON.clock(13)} শেষ রক্তদান: <strong>${esc(last)}</strong></div>
          </div>
        </div>
        <div class="dc-blood">
          <div class="dc-grp">${esc(d.group)}</div>
          <div class="dc-age">${esc(age)}</div>
        </div>
      </div>
      <div class="dc-div"></div>
      <div class="dc-act">
        <a class="dc-call" href="tel:${esc(phone)}">${ICON.phone(15)} কল করুন</a>
        ${wa?`<a class="dc-ico" href="https://wa.me/88${esc(wa)}" target="_blank" rel="noopener"
          aria-label="WhatsApp">${ICON.chat(16)}</a>`:""}
        <button class="dc-prof" data-open-prof="${esc(d.uid||"")}">${ICON.user(15)} প্রোফাইল</button>
      </div></div>`;
  }
  /* Browsers silently drop a download filename that is not ASCII-safe, so a
     Bangla name used to arrive as "download". Transliterate the donor id /
     name into a safe slug and keep the readable part in the card itself. */
  function safeName(name,fallback="donor"){
    const ascii=String(name||"").replace(/[^\x20-\x7E]/g,"").replace(/\s+/g,"-")
      .replace(/-+/g,"-").replace(/^-|-$/g,"");
    return ascii.length>=2?ascii:fallback;
  }
  function dl(blob,name){
    /* the anchor must be in the document for the download attribute to be
       honoured — a detached <a> loses the filename in several browsers */
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=name||"download";
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  }
  
  /* ══════════ PROFILE ══════════
     One screen renders every profile. It never asks "whose profile is this?"
     in the markup — it builds a single normalised `view` object first:
       • me   → my own record, everything visible, edit buttons on
       • them → another donor, fields filtered by THEIR privacy settings
     Adding a new field therefore means adding it in one place, and privacy
     can never be forgotten because hiding happens while building the view. */
  let profId=null;                       /* null = my own profile */
  
  /* my own data, shaped exactly like a directory record */
  function meAsDonor(){
    const a=STORE.account,d=STORE.donor,ov=d.ov||{};
    return {
      uid:"me", donorId:d.donorId||"—",
      name:ov.name||a.name||"আপনি", gender:ov.gender||a.gender, photo:a.photo,
      group:d.bloodGroup, area:ov.area||a.area, age:ov.age||ageFromDob(a.dob),
      occupation:a.occupation||"", phone:ov.phone||a.phone, whatsapp:!!d.whatsapp,
      lastDonation:d.lastDonation, totalDonations:DB().donations.length,
      joined:a.joined||"", verified:d.status==="approved", bio:a.bio||"",
      privacy:{showArea:STORE.privacy.showArea,
               showGroup:STORE.privacy.showGroup,showWhatsapp:STORE.privacy.showWhatsapp}
    };
  }
  /* build the view once; every renderer below reads only from this */
  function profileView(id){
    if(id==="__missing__")return null;
    const mine=!id||id==="me";
    const d=mine?meAsDonor():DB().donors.find(x=>x.uid===id);
    if(!d)return null;
    const pv=d.privacy||{};
    const show=k=>mine||pv[k]!==false;
    return {
      mine, raw:d,
      name:d.name, photo:d.photo, gender:d.gender, donorId:d.donorId,
      verified:d.verified, bio:d.bio||"",
      group:show("showGroup")&&d.group?d.group:null,
      area:show("showArea")&&d.area?d.area:null,
      age:d.age||null, occupation:d.occupation||"",
      phone:d.phone||null,
      /* WhatsApp is a separate, opt-in channel. When it is off we do not just
         hide the button — the number never enters the view object at all, so
         it cannot leak through the DOM, a link or the page source. */
      whatsapp:(pv.showWhatsapp!==false&&(d.whatsappNo||d.phone))?(d.whatsappNo||d.phone):null,
      total:d.totalDonations||0,
      last:d.lastDonation||"",
      ready:donorReady(d), rest:donorRest(d),
      joined:d.joined||""
    };
  }
  function openProfile(id){profId=id||"me";go("find","profile")}
  
  /* ══════════ PUBLIC PROFILE MODE ══════════
     app.html doubles as the public profile page: app.html?uid=<donor id>.
     The public site hands its donor list over through localStorage (same
     origin), so any donor listed there resolves here
     without duplicating a second profile page. */
  /* Public directory: Firebase is the single source of truth. The shared
     store (src/lib/store.ts) carries the live `donors` collection from
     Firestore, so a shared profile link resolves against real data — no
     bundled fallback list. */
  function pubDirectory(){
    try{
      const st=window.CBDCShared?CBDCShared.load():null;
      if(st&&Array.isArray(st.donors))return st.donors;
    }catch(e){}
    return [];
  }
  /* normalise a public-site record into the shape profileView() expects */
  function fromPublic(r){
    const bnNum=v=>String(v??"").replace(/[০-৯]/g,d=>"০১২৩৪৫৬৭৮৯".indexOf(d));
    return {
      uid:r.id, donorId:r.id, name:r.name, gender:r.gender, photo:r.photo||"",
      group:r.bloodGroup||r.group||"", area:r.area||"",
      age:parseInt(bnNum(r.age),10)||null, occupation:r.occupation||"",
      phone:r.phone||"", lastDonation:r.lastDonationDate||r.lastDonation||"",
      totalDonations:Number.isFinite(+r.donations)?+r.donations
        :(r.lastDonationDate?((parseInt(String(r.id||"").replace(/\D/g,"").slice(-2)||"0",10)%9)+1):0),
      joined:r.joined||"", verified:(r.status||"approved")==="approved", bio:"",
      privacy:{showArea:true,showGroup:true,showWhatsapp:!!(r.whatsapp&&String(r.whatsapp).trim())}
    };
  }
  function resolveUid(uid){
    if(!uid)return null;
    const key=String(uid).trim().toLowerCase();
    const hit=DB().donors.find(d=>
      String(d.uid).toLowerCase()===key||String(d.donorId||"").toLowerCase()===key);
    if(hit)return hit;
    const pub=pubDirectory().find(d=>String(d.id||"").toLowerCase()===key);
    return pub?fromPublic(pub):null;
  }
  /* true while the page is showing one public profile and nothing else */
  let PUBLIC_MODE=false;
  function bootPublicProfile(){
    const uid=new URLSearchParams(location.search).get("uid");
    if(!uid)return false;
    const d=resolveUid(uid);
    PUBLIC_MODE=true;
    document.body.dataset.pub="1";
    if(d){
      /* park it in the directory so profileView() finds it by uid */
      if(!DB().donors.some(x=>x.uid===d.uid))DB().donors.push(d);
      profId=d.uid;
    }else{
      profId="__missing__";
    }
    $("#s-sub").classList.add("on");
    $$(".scr").forEach(x=>{if(x.id!=="s-sub")x.classList.remove("on")});
    CUR="find";SUB="profile";
    renderSub("profile");
    paintTop();
    return true;
  }
  
  /* Download the card of whoever's profile is open. Sets the card subject,
     reuses the very same renderer the card screen uses, then clears it — so
     there is one card design in the app, not two. */
  function profileCardDL(){
    const v=profileView(profId);
    if(!v)return;
    if(v.mine){CARD_FOR=null;sheetDownload();return}
    CARD_FOR={name:v.name,gender:v.raw.gender,area:v.area,phone:v.phone,
      photo:v.raw.photo||"",donorId:v.donorId,group:v.group,
      age:v.age,lastDonation:v.last};
    const s=sheetDownload();
    /* whichever way the sheet closes, the subject must go back to me */
    const clear=()=>{CARD_FOR=null};
    s.addEventListener("click",e=>{if(e.target.closest("[data-close]"))setTimeout(clear,50)});
    const ov=document.querySelectorAll(".ov");
    ov[ov.length-1]&&ov[ov.length-1].addEventListener("click",()=>setTimeout(clear,50));
  }
  
  function rProfile(el){
    const v=profileView(profId);
    if(!v){el.innerHTML=`<div class="card"><div class="empty">
      <div class="ic">${ICON.search(26)}</div>
      <b>প্রোফাইল পাওয়া যায়নি</b>
      <p>রক্তদাতাটি আর তালিকায় নেই অথবা লিংকটি সঠিক নয়</p>
      ${PUBLIC_MODE?`<a class="btn gh" href="index.html">${ICON.home?ICON.home(15):""} রক্তদাতা তালিকায় ফিরুন</a>`:""}
      </div></div>`;return}
    const saved=STORE.saved.includes(v.name);
    el.innerHTML=`
      <div class="pcard">
        <div class="phead2">
          <img class="pav" src="${AV(v.gender,v.photo)}" alt="">
          ${v.group?`<span class="pgrp">${esc(v.group)}</span>`:""}
        </div>
        <div class="pnm">
          <b>${esc(v.name)}${v.verified?`<span class="pvf" title="যাচাইকৃত">${ICON.checkC(16)}</span>`:""}</b>
          ${v.donorId&&v.donorId!=="—"?`<small>${esc(v.donorId)}</small>`:""}
        </div>
        ${v.bio?`<p class="pbio">${esc(v.bio)}</p>`:""}
        <div class="pchips">
          <span class="pchip ${v.ready?"ok":"rest"}">${v.ready?"✓ রক্তদানে প্রস্তুত"
            :`বিশ্রামে · আর ${bn(v.rest)} দিন`}</span>
          ${v.area?`<span class="pchip">${ICON.pin(12)} ${esc(v.area)}</span>`:""}
          ${v.age?`<span class="pchip">${bn(v.age)} বছর</span>`:""}
          ${v.occupation?`<span class="pchip">${esc(v.occupation)}</span>`:""}
        </div>
        <div class="pacts">
          ${v.mine
            ? `<button class="btn sm" style="flex:1" data-pa="edit">${ICON.gear(15)} প্রোফাইল সম্পাদনা</button>`
            : `${v.phone?`<a class="btn sm" style="flex:1" href="tel:${esc(v.phone)}">${ICON.phone(15)} কল করুন</a>`
                 :`<button class="btn sm" style="flex:1" data-pa="nophone">${ICON.phone(15)} কল করুন</button>`}
               ${v.whatsapp
                 ? `<a class="btn gh sm" style="flex:1" href="https://wa.me/88${esc(v.whatsapp)}"
                      target="_blank" rel="noopener">${ICON.chat(15)} মেসেজ</a>`
                 : `<button class="btn gh sm off" style="flex:1" data-pa="nowa">${ICON.chat(15)} মেসেজ</button>`}
               ${PUBLIC_MODE?"":`<button class="btn gh sm ${saved?"on":""}" data-pa="save"
                  aria-label="সংরক্ষণ">${ICON.heart(15)}</button>`}`}
        </div>
      </div>
  
      <div class="pstats">
        <div class="pstat"><b>${bn(v.total)}</b><span>মোট রক্তদান</span></div>
        <div class="pstat"><b>${bn(v.total*3)}</b><span>জীবন বাঁচাতে সাহায্য</span></div>
        <div class="pstat"><b class="sm">${v.last?dS(v.last):"—"}</b><span>শেষ রক্তদান</span></div>
      </div>
  
      <div class="sec-t">তথ্য</div>
      <div class="card pad0">
        ${pRow("রক্তের গ্রুপ",v.group||(v.mine?"এখনো দেননি":"দেখানো হয়নি"),!v.group)}
        ${pRow("এলাকা",v.area||(v.mine?"এখনো দেননি":"দেখানো হয়নি"),!v.area)}
        ${pRow("মোবাইল",v.phone||"দেওয়া হয়নি",!v.phone)}
        ${v.joined?pRow("যুক্ত হয়েছেন",dL(v.joined)):""}
      </div>
  
      ${(v.mine?isDonor():true)?`<div class="sec-t">প্রোফাইল কার্ড</div>
        <div class="card">
          <p class="mut" style="font-size:.82rem;margin:0 0 11px;line-height:1.6">${v.mine
            ?"আপনার তথ্য ও QR কোড সহ ডোনার কার্ড ছবি হিসেবে নামান — মানিব্যাগে রাখুন, প্রিন্ট করুন বা প্রয়োজনে শেয়ার করুন।"
            :"এই রক্তদাতার তথ্য ও QR কোড সহ কার্ড ছবি হিসেবে নামান।"}</p>
          <button class="btn w" data-pa="dl">${ICON.down(16)} কার্ড ডাউনলোড</button>
        </div>`:""}
      ${v.mine&&(!v.group||!v.area)?`<div class="note w">${ICON.warn(17)}<span>আপনার প্রোফাইল এখনো অসম্পূর্ণ —
        <b>রক্তের গ্রুপ ও এলাকা</b> দিলে অন্যরা জরুরি প্রয়োজনে আপনাকে খুঁজে পাবেন।</span></div>
        <button class="btn w" data-pa="edit" style="margin-bottom:10px">${ICON.plus(16)} তথ্য পূরণ করুন</button>`:""}
      ${v.mine?`<div class="note i">${ICON.info(17)}<span>অন্যরা আপনার প্রোফাইলে কী দেখতে পাবে তা
        <b>গোপনীয়তা</b> সেটিংস থেকে ঠিক করতে পারবেন।</span></div>
        <button class="btn gh w" data-pa="priv">${ICON.eye(16)} গোপনীয়তা সেটিংস</button>`
        :`<p class="mut" style="text-align:center;font-size:.75rem;margin:14px 0 2px">
          শুধু রক্তসংক্রান্ত প্রয়োজনে যোগাযোগ করুন</p>`}`;
  
    el.querySelectorAll("[data-pa]").forEach(b=>b.onclick=()=>{
      const a=b.dataset.pa;
      if(a==="edit")go("set","donor");
      if(a==="card")go("set","card");
      if(a==="dl")profileCardDL();
      if(a==="priv")go("set","privacy");
      if(a==="nophone")toast("এই রক্তদাতা নম্বর গোপন রেখেছেন","er");
      if(a==="nowa")toast("এই রক্তদাতা WhatsApp-এ যোগাযোগের জন্য নম্বর প্রকাশ করেননি","er");
      if(a==="save"){
        const i=STORE.saved.indexOf(v.name);
        i<0?STORE.saved.push(v.name):STORE.saved.splice(i,1);
        save();rProfile(el);toast(i<0?"সংরক্ষণ করা হয়েছে":"সংরক্ষণ সরানো হয়েছে",i<0?"ok":"");
      }
    });
  }
  const pRow=(k,v,dim)=>`<div class="row"><span class="tx"><b>${esc(k)}</b></span>
    <span class="rt" style="font-size:.83rem;font-weight:700${dim?";color:var(--mut);font-weight:600":""}">${esc(v)}</span></div>`;
  
  /* ══════════ SCREEN: REQUEST ══════════ */
  let reqTab="for";
  function rReq(){
    const inc=myReqs(),mine=DB().mine;
    $("#s-req").innerHTML=`
      <h2 class="ptitle">রক্তদাতা / জরুরি আবেদন</h2>
      <div class="tabs" id="rtabs">
        <button data-t="for" class="${reqTab==="for"?"on":""}">আমার জন্য${inc.length?`<span class="c">${bn(inc.length)}</span>`:""}</button>
        <button data-t="mine" class="${reqTab==="mine"?"on":""}">আমার আবেদন${mine.length?`<span class="c">${bn(mine.length)}</span>`:""}</button>
        <button data-t="become" class="${reqTab==="become"?"on":""}">রক্তদাতা হন</button>
      </div><div id="rbody"></div>`;
    $$("#rtabs button").forEach(b=>b.onclick=()=>{reqTab=b.dataset.t;rReq()});
    const el=$("#rbody");
    if(reqTab==="for"){
      if(!isDonor()){el.innerHTML=emptyBox(ICON.drop(26),"রক্তের গ্রুপ জানালে আবেদন দেখাব",
        "আপনার গ্রুপের জরুরি ডাক সরাসরি এখানে আসবে","become","রক্তদাতা হিসেবে যুক্ত হন");return}
      el.innerHTML=inc.length?inc.map(incCard).join("")
        :emptyBox(ICON.checkC(26),"এখন কোনো জরুরি আবেদন নেই","আপনার গ্রুপের নতুন আবেদন এলে জানানো হবে");
    }else if(reqTab==="mine"){
      el.innerHTML=`<button class="btn red w" style="margin-bottom:13px" data-act="newreq">${ICON.plus(18)} নতুন জরুরি আবেদন</button>`
        +(mine.length?mine.map(mineCard).join("")
        :emptyBox(ICON.file(26),"আপনি এখনো কোনো আবেদন করেননি","কারো রক্তের প্রয়োজন হলে এখান থেকে আবেদন করুন"));
    }else{
      el.innerHTML=becomeView();
    }
  }
  const emptyBox=(ic,t,p,act,btn)=>`<div class="card"><div class="empty"><div class="ic">${ic}</div>
    <b>${esc(t)}</b><p>${esc(p)}</p>${act?`<button class="btn" data-act="${act}">${esc(btn)}</button>`:""}</div></div>`;
  
  const incCard=r=>`<div class="reqc mt">
    <h4>${esc(r.patient)} <span class="bg">${esc(r.group)}</span>
      <span class="pill ${r.left<6?"r":"a"}">${bn(r.left)} ঘণ্টা বাকি</span></h4>
    <p>${ICON.hospital(13)} ${esc(r.hospital)}</p>
    <p>${ICON.pin(13)} ${esc(r.area)} · ~${esc(r.km)} কিমি · ${bn(r.bags)} ব্যাগ · ${esc(r.urgency)}</p>
    <div class="a"><a class="btn sm" href="tel:${esc(r.phone)}">${ICON.phone(14)} কল</a>
      <a class="btn gh sm" href="https://wa.me/88${esc(r.phone)}" target="_blank" rel="noopener">${ICON.chat(14)}</a>
      <button class="btn gh sm" data-resp="${esc(r.id)}" style="color:var(--grn)">${ICON.check(14)} সাড়া দিন</button>
      <button class="btn gh sm" data-mute="${esc(r.id)}">লুকান</button></div></div>`;
  
  const RS={pending:["a","যাচাই চলছে"],approved:["b","প্রকাশিত"],matched:["b","রক্তদাতা খোঁজা হচ্ছে"],
    done:["g","সম্পন্ন"],expired:["m","মেয়াদোত্তীর্ণ"],cancelled:["m","বাতিল"]};
  const mineCard=r=>{const[c,t]=RS[r.status]||["m",r.status];
    return `<div class="reqc"><h4>${esc(r.id)} <span class="bg">${esc(r.group)}</span> <span class="pill ${c}">${t}</span></h4>
    <p>${esc(r.patient)} · ${bn(r.bags)} ব্যাগ</p>
    <p>${ICON.hospital(13)} ${esc(r.hospital)} · ${dS(r.neededBy)}</p>
    ${r.responders.length?`<p style="color:var(--grn);font-weight:700">${bn(r.responders.length)} জন সাড়া দিয়েছেন</p>`:""}
    <div class="a">${r.responders.length?`<button class="btn sm" data-resps="${esc(r.id)}">সাড়াদাতারা</button>`:""}
      ${r.status!=="done"&&r.status!=="cancelled"?
        `<button class="btn gh sm" data-done="${esc(r.id)}">${ICON.check(14)} সম্পন্ন</button>
         <button class="btn gh sm" data-cancel="${esc(r.id)}">বাতিল</button>`:""}</div></div>`};
  
  function becomeView(){
    const d=STORE.donor,a=STORE.account;
    if(!isDonor())return `<div class="note i">${ICON.info(17)}<span>আপনার অ্যাকাউন্টের তথ্য (নাম, মোবাইল, এলাকা)
      স্বয়ংক্রিয়ভাবে ব্যবহার হবে — আবার লিখতে হবে না।</span></div>
      ${emptyBox(ICON.drop(26),"রক্তদাতা হিসেবে যুক্ত হন","শুধু রক্ত-সম্পর্কিত কয়েকটি তথ্য দিলেই হবে","become","শুরু করুন")}`;
    if(dStatus()==="pending")return `<div class="card">
      <div class="note w">${ICON.clock(17)}<span><b>আপনার তথ্য যাচাই করা হচ্ছে</b><br>
        জমা দিয়েছেন ${dL(d.appliedAt)} · সাধারণত ২৪–৪৮ ঘণ্টা লাগে।</span></div>
      ${donorRows()}
      <button class="btn gh w" style="margin-top:12px" data-act="withdraw">আবেদন প্রত্যাহার</button></div>`;
    return `<div class="card">
      <div class="note g">${ICON.checkC(17)}<span><b>আপনি অনুমোদিত রক্তদাতা</b><br>${esc(d.donorId)}</span></div>
      ${donorRows()}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn gh" style="flex:1" id="hprof">${ICON.user(15)} আমার প্রোফাইল</button>
        <button class="btn" style="flex:1" data-sub="donor">${ICON.gear(15)} সম্পাদনা</button></div></div>`;
  }
  const donorRows=()=>{const d=STORE.donor;return `
    ${rowLine("নাম",dv("name"))}${rowLine("রক্তের গ্রুপ",d.bloodGroup)}${rowLine("লিঙ্গ",dv("gender"))}
    ${rowLine("বয়স",dv("age")?bn(dv("age"))+" বছর":"—")}
    ${rowLine("এলাকা",dv("area"))}${rowLine("মোবাইল",dv("phone"))}
    ${rowLine("WhatsApp",d.whatsapp||"—")}${rowLine("সর্বশেষ রক্তদান",d.lastDonation?dL(d.lastDonation):"মনে নেই")}`};
  const rowLine=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;
    border-bottom:1px dashed var(--line);font-size:.82rem"><span class="mut" style="font-weight:600">${esc(k)}</span>
    <b style="text-align:right">${esc(v)}</b></div>`;
  
  /* ══════════ SCREEN: SETTINGS ══════════ */
  const SETTINGS=[
    {id:"account",title:"অ্যাকাউন্ট",desc:"নাম, ছবি, ইমেইল, মোবাইল",icon:ICON.user},
    {id:"security",title:"নিরাপত্তা",desc:"পাসওয়ার্ড, ডিভাইস, কার্যকলাপ",icon:ICON.shield},
    {id:"privacy",title:"গোপনীয়তা",desc:"কে কী দেখতে পাবে",icon:ICON.eye},
    {id:"donor",title:"ডোনার",desc:"রক্তের তথ্য ও প্রাপ্যতা",icon:ICON.drop},
    {id:"notif",title:"বিজ্ঞপ্তি",desc:"কখন জানানো হবে",icon:ICON.bellS},
    {id:"prefs",title:"অ্যাপের পছন্দ",desc:"থিম, ভাষা, প্রদর্শন",icon:ICON.paint},
    {id:"help",title:"সহায়তা",desc:"প্রশ্ন, সমস্যা, নীতিমালা",icon:ICON.help},
    {id:"manage",title:"অ্যাকাউন্ট ব্যবস্থাপনা",desc:"তথ্য নামান, অ্যাকাউন্ট মুছুন",icon:ICON.warn}
  ];
  /* sub-screens (own page) */
  const SUBS=[
    {id:"profile",title:"প্রোফাইল",parent:"find"},
    {id:"devices",title:"লগইন ও ডিভাইস",parent:"security"},
    {id:"activity",title:"কার্যকলাপ",parent:"security"},
    {id:"card",title:"ডোনার কার্ড",parent:"donor"},
    {id:"adddonation",title:"রক্তদান যোগ করুন",parent:"donor"}
  ];
  const SETTINGS_MAP={};
  SETTINGS.forEach(s=>SETTINGS_MAP[s.id]=s);
  SUBS.forEach(s=>SETTINGS_MAP[s.id]=s);
  
  function rSet(){
    const a=STORE.account;
    $("#s-set").innerHTML=`
      <h2 class="ptitle">সেটিংস</h2>
      <button class="card" style="display:block;width:100%;text-align:left" data-sub="account">
        <div class="per lg"><img src="${AV(a.gender,a.photo)}" alt="">
          <div class="i"><b style="font-size:.95rem">${esc(a.name)}</b>
            <small>${a.username?"@"+esc(a.username):"প্রোফাইল সম্পূর্ণ করুন"}</small><small>${esc(a.email||"")}</small></div>
          <span style="color:var(--mut)">${ICON.right(19)}</span></div></button>
      <button class="btn gh w" id="myprof" style="margin:-4px 0 12px">${ICON.user(16)} আমার প্রোফাইল দেখুন</button>
      <div class="card pad0">${SETTINGS.map(s=>`
        <button class="row" data-sub="${s.id}"><span class="ic">${s.icon(19)}</span>
          <span class="tx"><b>${esc(s.title)}</b><small>${esc(s.desc)}</small></span>
          <span class="rt">${ICON.right(17)}</span></button>`).join("")}</div>
      <button class="btn gh w logout-btn" data-act="logout" style="margin-top:14px">${ICON.logout(17)} লগআউট</button>
      <p class="mut" style="text-align:center;margin:18px 0 4px;font-size:.72rem">CBDC · সংস্করণ ১.০</p>`;
    $("#myprof").onclick=()=>openProfile("me");
  }
  
  /* ---------- SUB SCREEN RENDERER ---------- */
  function renderSub(id){
    const el=$("#s-sub"),a=STORE.account,d=STORE.donor;
    const P={};
  
    /* profile renders itself (it needs its own event wiring) */
    if(id==="profile"){rProfile(el);return}
  
    P.account=()=>`
      <div class="card" style="text-align:center">
        <img src="${AV(a.gender,a.photo)}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:11px">
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn gh sm" data-act="photo">${ICON.cam(15)} ছবি বদলান</button>
          ${a.photo?`<button class="btn gh sm" data-act="photoRm">সরান</button>`:""}</div>
        ${a.photoSource==="google"?`<p class="mut" style="margin-top:9px;font-size:.72rem">Google অ্যাকাউন্ট থেকে নেওয়া</p>`:""}
      </div>
      <div class="sec-t">পরিচয়</div>
      <div class="card pad0">
        ${sRow("নাম",a.name,"editName")}
        ${sRow("Username","@"+a.username,"editUser")}
        ${sRow("ইমেইল",a.email,"editMail",a.emailVerified?"ok":"")}
        ${sRow("মোবাইল",a.phone,"editPhone",a.phoneVerified?"ok":"")}
      </div>
      <div class="sec-t">ব্যক্তিগত</div>
      <div class="card pad0">
        ${sRow("জন্মতারিখ",dL(a.dob),"editDob")}
        ${sRow("লিঙ্গ",a.gender,"editGender")}
        ${sRow("এলাকা",a.area,"editArea")}
        ${sRow("ঠিকানা",a.address||"দেওয়া হয়নি","editAddr")}
      </div>`;
  
    P.security=()=>`
      <div class="card pad0">
        ${sRow("পাসওয়ার্ড","সর্বশেষ "+dL(STORE.security.passwordChangedAt),"editPass")}
        ${sRow("পাসওয়ার্ড ভুলে গেছেন?","ইমেইল বা মোবাইলে OTP পাঠানো হবে","forgotPass")}
      </div>
      <div class="sec-t">লগইন সুরক্ষা</div>
      <div class="card pad0">
        <div class="row"><span class="ic">${ICON.bellS(19)}</span>
          <span class="tx"><b>নতুন লগইন সতর্কতা</b><small>অচেনা ডিভাইসে লগইন হলে জানানো হবে</small></span>
          <button class="tg ${STORE.security.loginAlert?"on":""}" data-tgl="security.loginAlert"></button></div>
        <button class="row" data-sub="devices"><span class="ic">${ICON.device(19)}</span>
          <span class="tx"><b>লগইন ও ডিভাইস</b><small>${tp(`${bn(RAW.sessions.length)}টি সক্রিয় সেশন`,`${RAW.sessions.length} active sessions`)}</small></span>
          <span class="rt">${ICON.right(17)}</span></button>
        <button class="row" data-sub="activity"><span class="ic">${ICON.clock(19)}</span>
          <span class="tx"><b>অ্যাকাউন্ট কার্যকলাপ</b><small>কী কী পরিবর্তন হয়েছে</small></span>
          <span class="rt">${ICON.right(17)}</span></button>
      </div>
      `;
  
    P.devices=()=>`
      <div class="note i">${ICON.info(17)}<span>আপনার অ্যাকাউন্টে যেসব ডিভাইসে লগইন আছে তার তালিকা।
        অচেনা কিছু দেখলে সাথে সাথে বের করে দিন।</span></div>
      ${RAW.sessions.map(s=>`<div class="card" style="padding:13px">
        <div style="display:flex;align-items:center;gap:11px">
          <span class="ic" style="width:38px;height:38px;border-radius:10px;background:${s.cur?"var(--grn-s)":"var(--card2)"};
            color:${s.cur?"var(--grn)":"var(--mut)"};display:grid;place-items:center">${ICON.device(19)}</span>
          <div style="flex:1;min-width:0"><b style="font-size:.85rem;display:block">${esc(s.name)}</b>
            <small class="mut" style="font-size:.74rem">${esc(s.place)}</small></div>
          ${s.cur?`<span class="pill g">এই ডিভাইস</span>`:`<button class="btn gh sm" data-kick="${s.id}">বের করুন</button>`}</div>
        <p class="mut" style="margin-top:7px;font-size:.73rem">${esc(s.last)}</p></div>`).join("")}
      <button class="btn red w" data-act="logoutAll" style="margin-top:6px">${ICON.logout(17)} সব ডিভাইস থেকে লগআউট</button>`;
  
    P.activity=()=>{
      const acts=DB().activity;
      if(!acts.length)return emptyBox(ICON.clock(26),"কোনো কার্যকলাপ নেই","আপনার অ্যাকাউন্টের পরিবর্তন এখানে দেখা যাবে");
      const groups={};
      acts.forEach(x=>{const d=new Date(x.at),k=dayDiff(iso(d))===0?"আজ":dayDiff(iso(d))===1?"গতকাল":dL(iso(d));
        (groups[k]=groups[k]||[]).push(x)});
      return Object.entries(groups).map(([k,list])=>`
        <div class="sec-t">${esc(k)}</div>
        <div class="card pad0">${list.map(x=>`<div class="row">
          <span class="ic" style="background:${x.type==="security"?"var(--blu-s)":x.type==="donor"?"var(--red-s)":"var(--card2)"};
            color:${x.type==="security"?"var(--blu)":x.type==="donor"?"var(--red)":"var(--mut)"}">
            ${x.type==="security"?ICON.shield(18):x.type==="donor"?ICON.drop(18):ICON.user(18)}</span>
          <span class="tx"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span>
          <span class="rt">${new Date(x.at).toLocaleTimeString("bn-BD",{hour:"2-digit",minute:"2-digit"})}</span></div>`).join("")}</div>`).join("");
    };
  
    P.privacy=()=>`
      <div class="note i">${ICON.info(17)}<span>এই সেটিংস শুধু দেখানোর নিয়ম নয় — পাবলিক তালিকা ও সার্চেও প্রয়োগ হবে।</span></div>
      <div class="sec-t">প্রোফাইল</div>
      <div class="card">
        <div class="f"><label>আমার প্রোফাইল কে দেখতে পাবে</label>
          <select data-pv="profile">
            <option value="all" ${STORE.privacy.profile==="all"?"selected":""}>সবাই</option>
            <option value="members" ${STORE.privacy.profile==="members"?"selected":""}>শুধু লগইন করা সদস্য</option>
            <option value="need" ${STORE.privacy.profile==="need"?"selected":""}>শুধু প্রয়োজনের সময়</option>
          </select></div>
      </div>
      <div class="sec-t">ডোনার তথ্য</div>
      <div class="card pad0">
        ${tgRow("রক্তদাতা তালিকায় দেখান","বন্ধ করলে সার্চে আসবেন না","privacy.searchable")}
        ${tgRow("রক্তের গ্রুপ দেখান","","privacy.showGroup")}
        ${tgRow("এলাকা দেখান","","privacy.showArea")}
      </div>
      <div class="sec-t">যোগাযোগ</div>
      <div class="note w">${ICON.warn(17)}<span>রক্তদাতা তালিকায় থাকলে আপনার <b>মোবাইল নম্বর সবাই দেখতে পাবেন</b> —
        জরুরি প্রয়োজনে যোগাযোগ করার জন্য এটি দরকার। নম্বর লুকাতে চাইলে
        উপরের <b>রক্তদাতা তালিকায় দেখান</b> বন্ধ করুন।</span></div>
      <div class="card pad0">${tgRow("WhatsApp নম্বর দেখান","","privacy.showWhatsapp")}</div>
      <div class="note w">${ICON.warn(17)}<span>পাবলিক তালিকায় আপনার <b>সম্পূর্ণ ঠিকানা কখনো দেখানো হয় না</b> —
        শুধু এলাকা/জেলা দেখানো হয়।</span></div>`;
  
    P.donor=()=>{
      if(!isDonor())return emptyBox(ICON.drop(26),"আপনি এখনো রক্তদাতা নন",
        "যুক্ত হলে এখানে ডোনার সেটিংস দেখতে পাবেন","become","রক্তদাতা হিসেবে যুক্ত হন");
      return `
      ${dStatus()==="pending"?`<div class="note w">${ICON.clock(17)}<span>আপনার তথ্য যাচাই চলছে।</span></div>`:""}
      <div class="card" style="text-align:center;padding:17px">
        <span class="bg" style="width:56px;height:56px;border-radius:14px;font-size:1.2rem;margin:0 auto 9px">${esc(d.bloodGroup)}</span>
        <b style="display:block;font-size:.9rem">${esc(d.donorId)}</b>
        <div style="margin-top:8px">${donorPill()}</div>
        <div style="display:flex;gap:7px;margin-top:12px">
          <button class="btn gh sm" style="flex:1" data-sub="card">${ICON.card(15)} ডোনার কার্ড</button>
          <button class="btn sm" style="flex:1" data-sub="adddonation">${ICON.plus(15)} রক্তদান যোগ</button></div>
      </div>
      <div class="sec-t">প্রাপ্যতা</div>
      <div class="card pad0">
        ${tgRow("আমি এখন রক্তদানে প্রস্তুত","বন্ধ থাকলে জরুরি তালিকায় নাম দেখাবে না","donor.available")}
      </div>
      <div class="sec-t" style="display:flex;align-items:center;gap:7px">
        <span style="flex:1">ডোনার তালিকায় দেখানো তথ্য</span>
        ${DFIELDS.some(f=>isOv(f.k))?`<button class="btn lnk" data-act="resetOv" style="font-size:.7rem">সব রিসেট</button>`:""}
      </div>
      <div class="card pad0">
        ${DFIELDS.map(f=>`<button class="row" data-dfield="${f.k}">
          <span class="tx"><b>${esc(f.label)}</b>
            <small>${esc(f.k==="age"&&dv(f.k)?bn(dv(f.k))+" বছর":dv(f.k)||"দেওয়া হয়নি")}</small></span>
          <span class="rt">${isOv(f.k)?`<span class="pill b n" style="font-size:.62rem">আলাদা</span>`
            :`<span class="pill m n" style="font-size:.62rem">অ্যাকাউন্ট</span>`}${ICON.right(17)}</span></button>`).join("")}
      </div>
      <div class="note i">${ICON.info(17)}<span>${tp(
        `এগুলো সাধারণত <b>অ্যাকাউন্ট থেকে</b> নেওয়া হয় — একবার বদলালে সব জায়গায় বদলায়। শুধু ডোনার তালিকার জন্য আলাদা দেখাতে চাইলে এখানে বদলান।`,
        `These normally come <b>from your account</b> — change one and it changes everywhere. Override them here only if the donor list should show something different.`)}</span></div>
  
      <div class="sec-t">রক্ত সম্পর্কিত তথ্য</div>
      <div class="card pad0">
        ${sRow("রক্তের গ্রুপ",d.bloodGroup,"reqGroup","lock")}
        ${sRow("WhatsApp",d.whatsapp||"দেওয়া হয়নি","editWa")}
        ${sRow("সর্বশেষ রক্তদান",d.lastDonation?dL(d.lastDonation):"মনে নেই","editLast")}
        ${sRow("স্বাস্থ্য তথ্য",d.health?(isEN()?tText(d.health):d.health).slice(0,30)+"…":"দেওয়া হয়নি","editHealth")}
      </div>
      <button class="btn gh w" data-act="leaveDonor" style="color:var(--red-d)">ডোনার তালিকা থেকে সরে যান</button>`;
    };
  
    P.adddonation=()=>{
      if(!isDonor())return emptyBox(ICON.drop(26),"আগে রক্তদাতা হিসেবে যুক্ত হন",
        "রক্তদানের হিসাব রাখতে আপনার রক্তের গ্রুপ ও তথ্য দরকার","become","রক্তদাতা হিসেবে যুক্ত হন");
      const dn=RAW.donations||[], pend=dn.filter(x=>!x.ok).length, okc=dn.filter(x=>x.ok).length;
      const rest=restLeft();
      return `
        <div class="intro">
          <div class="ih"><span class="ic">${ICON.info(20)}</span>
            <div><b>শুরু করার আগে পড়ে নিন</b>
              <small>নিচের ফর্মে আপনার দেওয়া প্রতিটি রক্তদানের হিসাব যোগ করুন।</small></div></div>
          <ol class="steps">
            <li><b>কী যোগ করবেন</b><span>আপনি অতীতে বা সম্প্রতি যে রক্তদান করেছেন তার তারিখ ও স্থান। একবারে একটি রক্তদান।</span></li>
            <li><b>কেন দরকার</b><span>এর ভিত্তিতেই ৯০ দিনের বিশ্রামের হিসাব হয় — বিশ্রামে থাকলে আপনাকে জরুরি ডাক পাঠানো হবে না।</span></li>
            <li><b>প্রমাণ দিলে ভালো</b><span>ব্লাড ব্যাগের রসিদ বা ছবি থাকলে যাচাই দ্রুত হয়। না থাকলেও যোগ করা যাবে।</span></li>
            <li><b>এরপর কী হয়</b><span>ক্লাবের স্বেচ্ছাসেবক যাচাই করবেন। যাচাই হলে <em>✓ যাচাইকৃত</em> লেখা উঠবে ও মোট গণনায় যোগ হবে।</span></li>
          </ol>
        </div>
  
        <div class="statrow">
          <div class="st"><b>${bn(okc)}</b><small>যাচাইকৃত রক্তদান</small></div>
          <div class="st"><b>${bn(pend)}</b><small>যাচাইয়ের অপেক্ষায়</small></div>
          <div class="st ${rest>0?"warn":"good"}"><b>${rest>0?bn(rest):"✓"}</b>
            <small>${rest>0?"দিন পর দিতে পারবেন":"এখন দিতে পারবেন"}</small></div>
        </div>
  
        <div class="sec-t">রক্তদানের তথ্য</div>
        <div class="card">
          <div class="f2">
            <div class="f"><label>রক্তদানের তারিখ <i>*</i></label>
              <input id="ad_date" type="date" max="${iso(now())}" value="${iso(now())}">
              <span class="hint">যেদিন রক্ত দিয়েছেন</span></div>
            <div class="f"><label>কত ব্যাগ</label>
              <select id="ad_bags">${[1,2,3,4].map(n=>`<option value="${n}">${bn(n)} ব্যাগ</option>`).join("")}</select>
              <span class="hint">সাধারণত ১ ব্যাগ</span></div>
          </div>
          <div class="f"><label>স্থান / হাসপাতাল <i>*</i></label>
            <input id="ad_place" list="ad_places" placeholder="যেমন: চমেক ব্লাড ব্যাংক">
            <datalist id="ad_places">${HOSPITALS.map(h=>`<option value="${esc(h)}">`).join("")}</datalist>
            <span class="hint">যে হাসপাতাল বা ব্লাড ব্যাংকে দিয়েছেন</span></div>
          <div class="f"><label>রোগীর নাম</label>
            <input id="ad_pat" placeholder="ঐচ্ছিক — না জানলে খালি রাখুন">
            <span class="hint">রোগীর অনুমতি ছাড়া পুরো নাম না লেখাই ভালো</span></div>
          <div class="f"><label>মন্তব্য</label>
            <input id="ad_note" placeholder="ঐচ্ছিক — যেমন: ক্লাবের ক্যাম্পে দিয়েছি"></div>
          <div class="f"><label>প্রমাণ (ছবি)</label>
            <input id="ad_file" type="file" accept="image/*">
            <span class="hint">রসিদ / ব্যাগের ছবি · সর্বোচ্চ ৪ MB · ঐচ্ছিক</span></div>
          <label class="chk"><input type="checkbox" id="ad_ok">
            <span>আমি নিশ্চিত করছি তথ্যগুলো সত্য এবং আমি নিজেই এই রক্তদান করেছি।</span></label>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn gh" style="flex:1" id="ad_clear">খালি করুন</button>
            <button class="btn" style="flex:2" id="ad_save">${ICON.plus(16)} যোগ করুন</button></div>
        </div>
  
        <div class="sec-t">নীতিমালা</div>
        <div class="card pad0">
          ${[["৯০ দিনের নিয়ম","শেষ রক্তদানের পর অন্তত ৯০ দিন বিরতি দিতে হবে। এর মধ্যে নতুন তারিখ দিলে সতর্কবার্তা দেখাবে।"],
             ["একই দান দুইবার নয়","একই তারিখ ও একই স্থানের রেকর্ড দ্বিতীয়বার যোগ করা যাবে না।"],
             ["মিথ্যা তথ্য","ভুল তথ্য দিলে রেকর্ড বাতিল হবে এবং বারবার হলে ডোনার তালিকা থেকে সরিয়ে দেওয়া হতে পারে।"],
             ["তথ্য কারা দেখবে","তারিখ ও মোট সংখ্যা আপনার কার্ডে দেখা যায়। রোগীর নাম ও প্রমাণের ছবি শুধু যাচাইকারী স্বেচ্ছাসেবক দেখতে পান।"],
             ["ভুল হলে","যাচাইয়ের আগে নিজেই মুছতে পারবেন। যাচাই হয়ে গেলে ক্লাবকে জানাতে হবে।"]]
            .map(([t,d],i)=>`<button class="row" data-faq="p${i}">
              <span class="tx"><b>${esc(t)}</b><small class="hide" id="fap${i}">${esc(d)}</small></span>
              <span class="rt">${ICON.right(17)}</span></button>`).join("")}
        </div>
  
        <div class="sec-t">আগের রক্তদান</div>
        ${dn.length?`<div class="card pad0">${dn.slice(0,6).map((x,i)=>`
          <div class="row"><span class="ic" style="background:${x.ok?"var(--grn-s)":"var(--amb-s)"};color:${x.ok?"var(--grn)":"var(--amb)"}">${x.ok?ICON.checkC(18):ICON.clock(18)}</span>
            <span class="tx"><b>${esc(dL(x.date))}</b><small>${esc(x.place)} · ${bn(x.bags||1)} ব্যাগ</small></span>
            <span class="rt">${x.ok?`<small class="mut">যাচাইকৃত</small>`
              :`<button class="lnk" data-delrec="${i}" style="color:var(--red-d)">মুছুন</button>`}</span></div>`).join("")}</div>`
          :`<div class="card"><p class="mut" style="font-size:.83rem;margin:0">এখনো কোনো রক্তদান যোগ করা হয়নি।</p></div>`}
        <div class="note i" style="margin-top:12px">${ICON.info(17)}<span>প্রশ্ন থাকলে ক্লাবের হটলাইনে কল করুন — <b>01617725464</b></span></div>`;
    };
  
    P.card=()=>{
      if(!isDonor())return emptyBox(ICON.card(26),"কার্ড তৈরি করতে ডোনার তথ্য দিন","","become","রক্তদাতা হিসেবে যুক্ত হন");
      const side=STORE.donor.cardSide||"front";
      return `<div class="card">
          <div class="cardsw" id="csd">
            ${[["front","সামনে"],["back","পেছনে"],["tall","শেয়ার"]].map(([v,l])=>
              `<button data-cs="${v}" class="${side===v?"on":""}">${l}</button>`).join("")}</div>
          <div class="cardwrap" id="cprev" style="margin-top:14px">
            ${side==="front"?cardFront():side==="back"?cardBack():cardTall()}</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:16px">
            <button class="btn sm" style="flex:1;min-width:96px" id="cdl">${ICON.down(15)} নামান</button>
            <button class="btn gh sm" style="flex:1;min-width:96px" id="csh">${ICON.share(15)} শেয়ার</button>
            <button class="btn gh sm" style="flex:1;min-width:96px" id="cpr">${ICON.print(15)} প্রিন্ট</button></div></div>
        <div class="sec-t">কার্ডের রং</div>
        <div class="card"><div class="seg" id="cth">
          ${[["green","সবুজ"],["red","লাল"],["dark","গাঢ়"]].map(([v,l])=>
            `<button data-ct="${v}" class="${(d.cardTheme||"green")===v?"on":""}">${l}</button>`).join("")}</div></div>
        <div class="sec-t">QR কোডে কী আছে</div>
        <div class="card pad0">
          ${qrFields().map(([k,v])=>
            `<div class="row"><span class="tx"><b>${esc(k)}</b></span><small class="mut">${esc(v)}</small></div>`).join("")}
        </div>
        <div class="note i">${ICON.info(17)}<span>যেকোনো ফোনের ক্যামেরা দিয়ে QR স্ক্যান করলে উপরের সব তথ্য দেখা যাবে এবং <b>কন্টাক্ট হিসেবে সেভ</b> করার অপশন আসবে — ইন্টারনেট ছাড়াই।</span></div>
        <div class="note">${ICON.print(17)}<span>ছাপানোর কার্ড ৮৬×৫৪ মিমি — ATM কার্ডের মাপ, মানিব্যাগে রাখা যায়।</span></div>`;
    };
  
    P.notif=()=>`
      <div class="sec-t">জরুরি রক্তের আবেদন</div>
      <div class="card pad0">
        ${tgRow("জরুরি আবেদনের বিজ্ঞপ্তি","নতুন আবেদন এলে জানানো হবে","notif.emergency")}
        ${tgRow("শুধু আমার রক্তের গ্রুপ","অন্য গ্রুপের আবেদন দেখাবে না","notif.onlyGroup")}
        ${tgRow("শুধু আমার এলাকা","দূরের আবেদন বাদ যাবে","notif.onlyArea")}
      </div>
      <div class="sec-t">অন্যান্য</div>
      <div class="card pad0">
        ${tgRow("ডোনার আপডেট","অনুমোদন, যাচাই ইত্যাদি","notif.donor")}
        ${tgRow("অ্যাকাউন্ট","প্রোফাইল সম্পর্কিত","notif.account")}
        <div class="row"><span class="ic">${ICON.shield(19)}</span>
          <span class="tx"><b>নিরাপত্তা সতর্কতা</b><small>নিরাপত্তার জন্য বন্ধ করা যায় না</small></span>
          <button class="tg on" disabled aria-label="সবসময় চালু"></button></div>
      </div>
      <div class="sec-t">সময়</div>
      <div class="card pad0">
        ${tgRow("রাতে বিরক্ত করবেন না","রাত ১০টা — সকাল ৭টা (অতিজরুরি ছাড়া)","notif.quiet")}
      </div>`;
  
    P.prefs=()=>`
      <div class="sec-t">চেহারা</div>
      <div class="card">
        <div class="f"><label>থিম</label><div class="seg" id="pth">
          ${[["light","আলো"],["dark","আঁধার"]].map(([v,l])=>
            `<button data-th="${v}" class="${STORE.prefs.theme===v?"on":""}">${l}</button>`).join("")}</div></div>
        <div class="f" style="margin-bottom:0"><label>প্রদর্শনের ঘনত্ব</label><div class="seg" id="pdn">
          <button data-dn="0" class="${!STORE.prefs.dense?"on":""}">স্বাভাবিক</button>
          <button data-dn="1" class="${STORE.prefs.dense?"on":""}">ঘন</button></div></div>
      </div>
      <div class="sec-t">ভাষা</div>
      <div class="card"><div class="seg" id="plg">
        <button data-lg="bn" class="${STORE.prefs.lang==="bn"?"on":""}" data-noi18n>বাংলা</button>
        <button data-lg="en" class="${STORE.prefs.lang==="en"?"on":""}" data-noi18n>English</button></div></div>
      <div class="sec-t">অন্যান্য</div>
      <div class="card pad0">
        ${tgRow("অ্যানিমেশন","চলমান প্রভাব চালু/বন্ধ","prefs.anim")}
        ${tgRow("বিজ্ঞপ্তির সংখ্যা দেখান","আইকনে লাল সংখ্যা","prefs.badge")}
      </div>`;
  
    P.help=()=>{
      const faq=[["রক্তদাতা হতে কী কী লাগে?","বয়স ১৮–৬০ বছর, ওজন কমপক্ষে ৫০ কেজি এবং সুস্থ শরীর।"],
        ["কতদিন পরপর রক্ত দেওয়া যায়?","সাধারণত ৯০ দিন (৩ মাস) পর পর। অ্যাপে কাউন্টডাউন দেখানো হয়।"],
        ["তথ্য যাচাই হতে কত সময় লাগে?","সাধারণত ২৪–৪৮ ঘণ্টা।"],
        ["রক্তের গ্রুপ ভুল দিয়েছি, বদলাব কীভাবে?","সেটিংস → ডোনার → রক্তের গ্রুপ → পরিবর্তনের অনুরোধ।"],
        ["আমার নম্বর কে দেখতে পায়?","সেটিংস → গোপনীয়তা থেকে আপনি নিজে ঠিক করতে পারেন।"]];
      return `<div class="card pad0">
        <a class="row" href="tel:${SITE.phone}"><span class="ic" style="background:var(--grn-s);color:var(--grn)">${ICON.phone(19)}</span>
          <span class="tx"><b>হেল্পলাইন</b><small>${SITE.phone} · ২৪/৭</small></span><span class="rt">${ICON.right(17)}</span></a>
        <a class="row" href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">
          <span class="ic" style="background:var(--grn-s);color:var(--grn)">${ICON.chat(19)}</span>
          <span class="tx"><b>WhatsApp</b><small>দ্রুত উত্তর</small></span><span class="rt">${ICON.right(17)}</span></a>
        <button class="row" data-act="report"><span class="ic">${ICON.warn(19)}</span>
          <span class="tx"><b>সমস্যা জানান</b><small>বাগ বা ভুল তথ্য</small></span><span class="rt">${ICON.right(17)}</span></button>
      </div>
      <div class="sec-t">সাধারণ জিজ্ঞাসা</div>
      <div class="card pad0">${faq.map((f,i)=>`<button class="row" data-faq="${i}" style="align-items:flex-start">
        <span class="tx"><b>${esc(f[0])}</b><small class="fa hide" id="fa${i}" style="white-space:normal;margin-top:5px">${esc(f[1])}</small></span>
        <span class="rt">${ICON.right(16)}</span></button>`).join("")}</div>
      <div class="sec-t">নীতিমালা</div>
      <div class="card pad0">
        ${sRow("ব্যবহারের শর্তাবলী","অ্যাকাউন্ট, দায়িত্ব ও আচরণবিধি","pol_terms")}
        ${sRow("গোপনীয়তা নীতি","আপনার তথ্য কীভাবে ব্যবহার হয়","pol_privacy")}
        ${sRow("রক্তদান নির্দেশিকা","যোগ্যতা, প্রস্তুতি ও নিরাপত্তা","pol_donate")}
      </div>`;
    };
  
    P.manage=()=>`
      <div class="card pad0">
        ${sRow("আমার সব তথ্য নামান","JSON / CSV","exportData")}
      </div>
      <div class="sec-t" style="color:var(--red-d)">অ্যাকাউন্ট মুছে ফেলুন</div>
      <div class="card pad0" style="border-color:rgba(224,36,47,.3)">
        <button class="row" data-act="delAcc"><span class="ic" style="background:var(--red-s);color:var(--red)">${ICON.trash(19)}</span>
          <span class="tx"><b style="color:var(--red-d)">অ্যাকাউন্ট মুছে ফেলুন</b>
          <small style="white-space:normal">অনুরোধ করার পর ২৪ ঘণ্টার মধ্যে অ্যাকাউন্ট ও এর সাথে সম্পর্কিত সকল ডাটা মুছে যাবে</small></span>
          <span class="rt">${ICON.right(17)}</span></button>
      </div>`;
  
    el.innerHTML=P[id]?P[id]():`<div class="empty"><b>পাওয়া যায়নি</b></div>`;
    bindSub(id);
  }
  const sRow=(t,v,act,flag)=>`<button class="row" data-act="${act}">
    <span class="tx"><b>${esc(t)}</b>${v?`<small>${esc(v)}</small>`:""}</span>
    <span class="rt">${flag==="ok"?`<span style="color:var(--grn)">${ICON.checkC(15)}</span>`:flag==="lock"?ICON.lock(14):""}${ICON.right(17)}</span></button>`;
  const tgRow=(t,s,path)=>{const v=path.split(".").reduce((o,k)=>o[k],STORE);
    return `<div class="row"><span class="tx"><b>${esc(t)}</b>${s?`<small>${esc(s)}</small>`:""}</span>
    <button class="tg ${v?"on":""}" data-tgl="${path}" role="switch" aria-checked="${!!v}"></button></div>`};
  
  function bindSub(id){
    $$("[data-tgl]").forEach(b=>b.onclick=()=>{
      const p=b.dataset.tgl.split("."),o=p.slice(0,-1).reduce((x,k)=>x[k],STORE),k=p[p.length-1];
      o[k]=!o[k];b.classList.toggle("on",o[k]);b.setAttribute("aria-checked",o[k]);
      save();toast(o[k]?"চালু করা হয়েছে":"বন্ধ করা হয়েছে",o[k]?"ok":"");
      if(p[0]==="prefs")applyPrefs();
      if(p[0]==="donor"||p[0]==="privacy")RENDER[CUR]&&paintTop();
    });
    $$("[data-pv]").forEach(s=>s.onchange=()=>{STORE.privacy[s.dataset.pv]=s.value;save();toast("সংরক্ষিত","ok")});
    $$("[data-faq]").forEach(b=>b.onclick=()=>{const t=$("#fa"+b.dataset.faq);t.classList.toggle("hide")});
    if(id==="prefs"){
      $$("#pth button").forEach(b=>b.onclick=()=>{STORE.prefs.theme=b.dataset.th;save();applyPrefs();renderSub("prefs")});
      $$("#pdn button").forEach(b=>b.onclick=()=>{STORE.prefs.dense=b.dataset.dn==="1";save();applyPrefs();renderSub("prefs")});
      $$("#plg button").forEach(b=>b.onclick=()=>{
        if(STORE.prefs.lang===b.dataset.lg)return;
        STORE.prefs.lang=b.dataset.lg;save();applyLang();
        toast(isEN()?"Language changed to English":"ভাষা বাংলা করা হয়েছে","ok");});
    }
    if(id==="adddonation")bindAddDonation();
    if(id==="card"){
      $$("#cth button").forEach(b=>b.onclick=()=>{STORE.donor.cardTheme=b.dataset.ct;save();renderSub("card")});
      $$("#csd button").forEach(b=>b.onclick=()=>{STORE.donor.cardSide=b.dataset.cs;save();renderSub("card")});
      $("#cdl").onclick=sheetDownload;
      $("#cpr").onclick=()=>printCard();
      $("#csh").onclick=async()=>{
        const t=`${dv("name")} (${STORE.donor.bloodGroup}) — ${dv("area")}\nCBDC রক্তদাতা · ${STORE.donor.donorId}\n${dv("phone")}`;
        if(navigator.share){try{await navigator.share({title:"ডোনার কার্ড",text:t});return}catch(e){if(e.name==="AbortError")return}}
        navigator.clipboard?.writeText(t).then(()=>toast("তথ্য কপি হয়েছে","ok"),()=>toast("কপি করা যায়নি","er"));
      };
    }
    $$("[data-dfield]").forEach(b=>b.onclick=()=>editDonorField(b.dataset.dfield));
    $$("[data-kick]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"ডিভাইসটি বের করবেন?",desc:"ওই ডিভাইসে আবার লগইন করতে হবে।",ok:"বের করুন",danger:true}))return;
      const i=RAW.sessions.findIndex(s=>s.id===b.dataset.kick);if(i>-1)RAW.sessions.splice(i,1);saveData();
      logAct("ডিভাইস সরানো হয়েছে","নিরাপত্তা","security");renderSub("devices");toast("ডিভাইস বের করা হয়েছে","ok");
    });
  }
  const CLUB={name:SITE.name,en:SITE.nameEn,
    phone:SITE.phone,site:SITE.website,addr:SITE.address};
  function cardStat(){
    const S=cardSubject(),d=S.d;
    const rest=d.lastDonation?Math.max(0,90-dayDiff(d.lastDonation)):0;
    return rest>0?{t:tp("বিশ্রামে · "+bn(rest)+" দিন","Resting · "+rest+" days"),c:"rest"}
      :d.available?{t:"রক্তদানে প্রস্তুত",c:""}:{t:"আপাতত বন্ধ",c:"off"};}
  
  /* ---------- FRONT ---------- */
  function cardFront(){
    const S=cardSubject(),a=S.a,d=S.d,st=cardStat();
    return `<div class="idc" data-t="${d.cardTheme||"green"}">
      <div class="hd"><span class="lg">${ICON.logo}</span>
        <div><b>${esc(CLUB.name)}</b><i>DONOR IDENTITY CARD</i></div>
        <span class="vf">${ICON.checkC(9)} যাচাইকৃত</span></div>
      <div class="bd">
        <div class="ph"><img src="${AV(dv("gender"),a.photo)}" alt=""><div class="bg">${esc(d.bloodGroup)}</div></div>
        <div>
          <h3 class="nm">${esc(dv("name"))}</h3>
          <div class="rl">স্বেচ্ছায় রক্তদাতা</div>
          <div class="kv">
            <div><span>এলাকা</span><b>${esc(dv("area"))}</b></div>
            <div><span>মোবাইল</span><b>${esc(dv("phone"))}</b></div>
            ${dv("age")||dv("gender")?`<div><span>বয়স</span><b>${dv("age")?bn(dv("age"))+" বছর":""}${dv("age")&&dv("gender")?" · ":""}${dv("gender")?esc(dv("gender")):""}</b></div>`:""}
          </div>
        </div>
        <div class="qrbox"><span class="q">${qrSVG(vcardText(),72,{ecl:"L",quiet:2})}</span>
          <small>স্ক্যান করুন</small></div>
      </div>
      <div class="ft"><span class="id">${esc(d.donorId)}</span>
        <span class="st"><i class="dot ${st.c}"></i>${esc(st.t)}</span></div>
    </div>`;
  }
  /* ---------- BACK ---------- */
  function cardBack(){
    const d=cardSubject().d;
    return `<div class="idc rev" data-t="${d.cardTheme||"green"}">
      <div class="bh"><img src="${LOGO}" alt="" class="bl">রক্ত দিন · জীবন বাঁচান</div>
      <div class="bb">
        <div class="ct">
          <div class="h">ক্লাবের যোগাযোগ</div>
          <div class="r">${ICON.phone(10)}<div>হটলাইন <b>${esc(CLUB.phone)}</b></div></div>
          <div class="r">${ICON.pin(10)}<div><b>${esc(CLUB.addr)}</b></div></div>
          <div class="r">${ICON.globe?ICON.globe(10):ICON.info(10)}<div><b>${esc(CLUB.site)}</b></div></div>
          <div class="h" style="margin-top:3px">কার্ডটি পেলে</div>
          <div class="r">${ICON.info(10)}<div>QR স্ক্যান করে কার্ডধারীর সাথে যোগাযোগ করুন অথবা উপরের হটলাইনে জানান।</div></div>
        </div>
        <div class="bq"><span class="q">${qrSVG(vcardText(),100,{ecl:"L",quiet:2})}</span>
          <small>স্ক্যান করলে সব<br>তথ্য পাবেন</small></div>
      </div>
      <div class="bf">এই কার্ড ${esc(CLUB.name)}-এর সম্পত্তি · হস্তান্তরযোগ্য নয়</div>
    </div>`;
  }
  /* ---------- TALL (share) ---------- */
  function cardTall(){
    const S=cardSubject(),a=S.a,d=S.d,st=cardStat();
    return `<div class="idc tall" data-t="${d.cardTheme||"green"}">
      <div class="hd"><span class="lg">${ICON.logo}</span>
        <div><b>${esc(CLUB.name)}</b><i>DONOR CARD</i></div>
        <span class="vf">${ICON.checkC(9)} যাচাইকৃত</span></div>
      <div class="tb">
        <img src="${AV(dv("gender"),a.photo)}" alt="">
        <div class="nm">${esc(dv("name"))}</div>
        <div class="rl">স্বেচ্ছায় রক্তদাতা</div>
        <div class="big">${esc(d.bloodGroup)}</div>
      </div>
      <div class="kv">
        <div><span>আইডি</span><b>${esc(d.donorId)}</b></div>
        <div><span>এলাকা</span><b>${esc(dv("area"))}</b></div>
        <div><span>মোবাইল</span><b>${esc(dv("phone"))}</b></div>
        <div><span>অবস্থা</span><b>${esc(st.t)}</b></div>
      </div>
      <div class="qrbox"><span class="q">${qrSVG(vcardText(),96,{ecl:"L",quiet:2})}</span>
        <small>স্ক্যান করে কন্টাক্টে যোগ করুন</small></div>
    </div>`;
  }
  function cardHTML(){return cardFront()}
  
  /* ══════════ CARD → PNG ══════════ */
  const CF='"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",sans-serif';
  function themeCols(t){return{green:["#0d7a52","#075c3c","#03301f"],red:["#c62630","#8d1017","#4d060b"],
    dark:["#2b3a35","#18241f","#0a110e"]}[t||"green"]}
  const rr=(x,r0,y,w,h,rad)=>{x.beginPath();x.moveTo(r0+rad,y);x.arcTo(r0+w,y,r0+w,y+h,rad);
    x.arcTo(r0+w,y+h,r0,y+h,rad);x.arcTo(r0,y+h,r0,y,rad);x.arcTo(r0,y,r0+w,y,rad);x.closePath()};
  function svgImg(sv){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);
    i.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(sv)})}
  async function loadImg(src){return new Promise(r=>{const i=new Image();i.crossOrigin="anonymous";
    i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src})}
  function fitText(x,txt,max,start,min,weight){let s=start;
    do{x.font=`${weight} ${s}px `+CF;if(x.measureText(txt).width<=max)break;s-=1}while(s>min);return s}
  
  /* 86×54mm @ ~300dpi → 1016×638. All positions derive from W so the
     layout stays correct at any output size. */
  async function drawFront(x,W,H,S){
    const SB=cardSubject(),a=SB.a,d=SB.d,st=cardStat(),c=themeCols(d.cardTheme);
    const pad=W*.033;
    const g=x.createLinearGradient(0,0,W,H);
    g.addColorStop(0,c[0]);g.addColorStop(.46,c[1]);g.addColorStop(1,c[2]);
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const rg=x.createRadialGradient(W*.88,-H*.14,0,W*.88,-H*.14,W*.55);
    rg.addColorStop(0,"rgba(255,255,255,.19)");rg.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=rg;x.fillRect(0,0,W,H);
    x.save();x.beginPath();x.rect(0,0,W,H);x.clip();
    x.strokeStyle="rgba(255,255,255,.05)";x.lineWidth=W*.026;
    x.beginPath();x.arc(W*1.05,H*1.16,W*.21,0,7);x.stroke();x.restore();
  
    /* ── header ── */
    const hH=H*.145, hcy=hH/2;
    const lgR=W*.0165;
    x.fillStyle="#fff";x.beginPath();x.arc(pad+lgR,hcy,lgR,0,7);x.fill();
    const lg=await svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60"><path d="M12 3.4s6.2 6.1 6.2 10.1a6.2 6.2 0 1 1-12.4 0C5.8 9.5 12 3.4 12 3.4z" fill="#c8101d"/></svg>`);
    if(lg)x.drawImage(lg,pad+lgR*.42,hcy-lgR*.62,lgR*1.16,lgR*1.16);
    /* verified pill (right) */
    const vt="যাচাইকৃত";
    x.font=`800 ${W*.0165}px `+CF;
    const vw=x.measureText(vt).width+W*.052, vh=H*.052, vx=W-pad-vw, vy=hcy-vh/2;
    x.fillStyle="rgba(255,255,255,.15)";rr(x,vx,vy,vw,vh,vh/2);x.fill();
    const cr=W*.0088, ccx=vx+W*.019;
    x.fillStyle="#fff";x.beginPath();x.arc(ccx,hcy,cr,0,7);x.fill();
    x.strokeStyle=c[1];x.lineWidth=W*.0026;x.lineCap="round";x.lineJoin="round";
    x.beginPath();x.moveTo(ccx-cr*.45,hcy);x.lineTo(ccx-cr*.05,hcy+cr*.42);x.lineTo(ccx+cr*.5,hcy-cr*.38);x.stroke();
    x.textAlign="left";x.textBaseline="middle";x.fillStyle="#fff";x.fillText(vt,ccx+cr+W*.007,hcy+W*.001);
    /* club name (fills space between logo and pill) */
    const nx=pad+lgR*2+W*.011, navail=vx-nx-W*.012;
    x.fillStyle="#fff";
    const cs=fitText(x,CLUB.name,navail,W*.0285,W*.019,"800");
    x.fillText(CLUB.name,nx,hcy-cs*.36);
    x.fillStyle="rgba(255,255,255,.68)";x.font=`700 ${W*.0155}px `+CF;
    x.fillText("DONOR IDENTITY CARD",nx,hcy+cs*.62);
    x.textBaseline="alphabetic";
    x.strokeStyle="rgba(255,255,255,.16)";x.lineWidth=Math.max(1,W*.001);
    x.beginPath();x.moveTo(0,hH);x.lineTo(W,hH);x.stroke();
  
    /* ── footer band (reserve first) ── */
    const fH=H*.108, fY=H-fH;
  
    /* ── QR column (right), vertically inside body ── */
    const bodyBot=fY-H*.028;
    const capH=H*.058;
    const qs=Math.min(bodyBot-hH-H*.045-capH, W*.255);
    const qx=W-pad-qs, qy=hH+(bodyBot-hH-qs-capH)/2;
    x.fillStyle="#fff";rr(x,qx,qy,qs,qs,W*.012);x.fill();
    const qp=qs*.072;
    const qi=await svgImg(qrSVG(vcardText(),Math.round(qs-qp*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,qx+qp,qy+qp,qs-qp*2,qs-qp*2);
    x.textAlign="center";x.fillStyle="rgba(255,255,255,.7)";x.font=`700 ${H*.028}px `+CF;
    x.fillText("স্ক্যান করুন",qx+qs/2,qy+qs+capH*.68);
  
    /* ── photo + blood chip (left) ── */
    const ps=H*.375, chH=H*.105, chGap=H*.026;
    const leftH=ps+chGap+chH;
    const px=pad, py=hH+(bodyBot-hH-leftH)/2;
    const im=await loadImg(AV(dv("gender"),a.photo));
    x.save();rr(x,px,py,ps,ps,W*.016);x.clip();
    if(im)x.drawImage(im,px,py,ps,ps);
    else{x.fillStyle="rgba(255,255,255,.2)";x.fillRect(px,py,ps,ps)}x.restore();
    x.strokeStyle="rgba(255,255,255,.85)";x.lineWidth=W*.0038;rr(x,px,py,ps,ps,W*.016);x.stroke();
    const chY=py+ps+chGap;
    x.fillStyle="#fff";rr(x,px,chY,ps,chH,W*.01);x.fill();
    x.fillStyle=(d.cardTheme==="red")?"#8d1017":"#c8101d";
    x.textAlign="center";x.font=`800 ${H*.072}px `+CF;
    x.fillText(d.bloodGroup,px+ps/2,chY+chH*.74);
  
    /* ── centre column (vertically centred) ── */
    const tx=px+ps+W*.028, tw=qx-tx-W*.026;
    x.textAlign="left";
    const ns=fitText(x,dv("name"),tw,H*.095,H*.052,"800");
    const roleGap=H*.055, blockGap=H*.068, rowH=H*.075;
    const midH=ns*.78+roleGap+blockGap+rowH*3;
    let ty=hH+(bodyBot-hH-midH)/2+ns*.78;
    x.fillStyle="#fff";x.font=`800 ${ns}px `+CF;
    x.fillText(dv("name"),tx,ty);
    ty+=roleGap;
    x.fillStyle="rgba(255,255,255,.72)";x.font=`700 ${H*.032}px `+CF;
    x.fillText("স্বেচ্ছায় রক্তদাতা",tx,ty);
    ty+=blockGap;
    const kw=W*.088;
    [["এলাকা",dv("area")],["মোবাইল",dv("phone")],
     ...(dv("age")||dv("gender")?[["বয়স",(dv("age")?bn(dv("age"))+" বছর":"")+(dv("age")&&dv("gender")?" · ":"")+(dv("gender")||"")]]:[])
    ].filter(([,v])=>v).forEach(([k,v])=>{
      x.font=`600 ${H*.031}px `+CF;x.fillStyle="rgba(255,255,255,.6)";x.fillText(k,tx,ty);
      x.fillStyle="#fff";
      let fs=H*.034;x.font=`800 ${fs}px `+CF;
      while(x.measureText(String(v)).width>tw-kw&&fs>H*.022){fs-=H*.0012;x.font=`800 ${fs}px `+CF}
      x.fillText(String(v),tx+kw,ty);
      x.strokeStyle="rgba(255,255,255,.1)";x.lineWidth=Math.max(1,W*.001);
      x.beginPath();x.moveTo(tx,ty+rowH*.28);x.lineTo(tx+tw,ty+rowH*.28);x.stroke();
      ty+=rowH});
  
    /* ── footer ── */
    x.fillStyle="rgba(0,0,0,.26)";x.fillRect(0,fY,W,fH);
    x.textBaseline="middle";
    x.textAlign="left";x.fillStyle="#fff";x.font=`800 ${W*.0205}px ui-monospace,Menlo,monospace`;
    x.fillText(d.donorId,pad,fY+fH/2);
    x.textAlign="right";x.font=`700 ${W*.0175}px `+CF;
    x.fillStyle="rgba(255,255,255,.9)";x.fillText(st.t,W-pad,fY+fH/2);
    const sw=x.measureText(st.t).width;
    x.fillStyle=st.c==="rest"?"#fbbf24":st.c==="off"?"#94a3b8":"#4ade80";
    x.beginPath();x.arc(W-pad-sw-W*.014,fY+fH/2,W*.0058,0,7);x.fill();
    x.textBaseline="alphabetic";
  }
  async function drawBack(x,W,H,S){
    const d=cardSubject().d,dk=d.cardTheme==="red"?"#8d1017":d.cardTheme==="dark"?"#18241f":"#075c3c";
    const g=x.createLinearGradient(0,0,W,H);
    if(d.cardTheme==="red"){g.addColorStop(0,"#fdf6f6");g.addColorStop(1,"#f6e6e7")}
    else if(d.cardTheme==="dark"){g.addColorStop(0,"#eef1f0");g.addColorStop(1,"#dee4e2")}
    else{g.addColorStop(0,"#f7faf9");g.addColorStop(1,"#e8f2ee")}
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const ink=d.cardTheme==="red"?"#4a1013":"#123024";
    const pad=34*S, bh=38*S, ftH=26*S;
    x.fillStyle=dk;x.fillRect(0,0,W,bh);
    x.textAlign="center";x.fillStyle="#fff";x.font=`800 ${13*S}px `+CF;
    x.fillText("রক্ত দিন · জীবন বাঁচান",W/2,bh/2+5*S);
    /* QR block sized to fit between header and footer */
    const capH=26*S, avail=H-bh-ftH-16*S-capH;
    const qs=Math.min(avail,168*S), qx=W-pad-qs, qy=bh+(H-bh-ftH-qs-capH)/2;
    x.fillStyle="#fff";x.shadowColor="rgba(6,60,40,.18)";x.shadowBlur=13*S;x.shadowOffsetY=3*S;
    rr(x,qx,qy,qs,qs,11*S);x.fill();x.shadowColor="transparent";x.shadowBlur=0;x.shadowOffsetY=0;
    const qpad=9*S;
    const qi=await svgImg(qrSVG(vcardText(),Math.round(qs-qpad*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,qx+qpad,qy+qpad,qs-qpad*2,qs-qpad*2);
    x.fillStyle=ink;x.globalAlpha=.62;x.font=`800 ${9.5*S}px `+CF;
    x.fillText("স্ক্যান করলে সব তথ্য পাবেন",qx+qs/2,qy+qs+15*S);x.globalAlpha=1;
    /* left column */
    const lx=pad, lw=qx-lx-20*S;
    let y=bh+30*S;
    x.textAlign="left";
    x.fillStyle=ink;x.globalAlpha=.55;x.font=`800 ${9.5*S}px `+CF;x.fillText("ক্লাবের যোগাযোগ",lx,y);x.globalAlpha=1;
    y+=19*S;
    const kw=44*S;
    [["হটলাইন",CLUB.phone],["ঠিকানা",CLUB.addr],["ওয়েব",CLUB.site]].forEach(([k,v])=>{
      x.fillStyle=ink;x.globalAlpha=.6;x.font=`600 ${10.5*S}px `+CF;x.fillText(k,lx,y);x.globalAlpha=1;
      x.font=`800 ${11*S}px `+CF;
      let fs=11*S;while(x.measureText(v).width>lw-kw&&fs>7*S){fs-=.5;x.font=`800 ${fs}px `+CF}
      x.fillText(v,lx+kw,y);y+=17.5*S});
    y+=8*S;
    x.fillStyle=ink;x.globalAlpha=.55;x.font=`800 ${9.5*S}px `+CF;x.fillText("কার্ডটি পেলে",lx,y);x.globalAlpha=1;
    y+=16*S;x.font=`600 ${10*S}px `+CF;x.fillStyle=ink;
    wrapLines(x,"QR স্ক্যান করে কার্ডধারীর সাথে যোগাযোগ করুন অথবা উপরের হটলাইনে জানান।",lw)
      .forEach(t=>{x.fillText(t,lx,y);y+=14*S});
    /* footer */
    x.textAlign="center";x.globalAlpha=.5;x.font=`700 ${9*S}px `+CF;x.fillStyle=ink;
    x.fillText("এই কার্ড "+CLUB.name+"-এর সম্পত্তি · হস্তান্তরযোগ্য নয়",W/2,H-9*S);x.globalAlpha=1;
  }
  function wrapLines(x,txt,max){
    const w=txt.split(" "),out=[];let cur="";
    for(const word of w){const t=cur?cur+" "+word:word;
      if(x.measureText(t).width>max&&cur){out.push(cur);cur=word}else cur=t}
    if(cur)out.push(cur);return out;
  }
  /* 900×1600 share card */
  async function drawTall(x,W,H,S){
    const SB=cardSubject(),a=SB.a,d=SB.d,st=cardStat(),c=themeCols(d.cardTheme);
    const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,c[0]);g.addColorStop(.5,c[1]);g.addColorStop(1,c[2]);
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const rg=x.createRadialGradient(W*.9,H*.05,0,W*.9,H*.05,W*.9);
    rg.addColorStop(0,"rgba(255,255,255,.16)");rg.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=rg;x.fillRect(0,0,W,H);
    const pad=W*.055;
    /* bottom-anchored QR block */
    const qs=W*.30, capGap=W*.042, qy=H-pad*1.1-capGap-qs;
    x.fillStyle="#fff";rr(x,W/2-qs/2,qy,qs,qs,W*.014);x.fill();
    const qp=qs*.075;
    const qi=await svgImg(qrSVG(vcardText(),Math.round(qs-qp*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,W/2-qs/2+qp,qy+qp,qs-qp*2,qs-qp*2);
    x.textAlign="center";x.fillStyle="rgba(255,255,255,.75)";x.font=`700 ${W*.0285}px `+CF;
    x.fillText("স্ক্যান করে কন্টাক্টে যোগ করুন",W/2,qy+qs+capGap*.85);
    /* header */
    const tl=await loadImg(LOGO), tlR=W*.082, tly=H*.052;
    if(tl){x.save();x.beginPath();x.arc(W/2,tly,tlR,0,7);x.fillStyle="#fff";x.fill();x.clip();
      x.drawImage(tl,W/2-tlR,tly-tlR,tlR*2,tlR*2);x.restore();}
    x.fillStyle="#fff";fitText(x,CLUB.name,W-pad*3,W*.055,W*.036,"800");
    x.fillText(CLUB.name,W/2,tly+tlR+W*.055);
    x.fillStyle="rgba(255,255,255,.66)";x.font=`700 ${W*.031}px `+CF;
    x.fillText("ডিজিটাল ডোনার কার্ড",W/2,tly+tlR+W*.095);
    /* photo */
    const pr=W*.152,pcy=H*.245;
    const im=await loadImg(AV(dv("gender"),a.photo));
    x.save();x.beginPath();x.arc(W/2,pcy,pr,0,7);x.clip();
    if(im)x.drawImage(im,W/2-pr,pcy-pr,pr*2,pr*2);
    else{x.fillStyle="rgba(255,255,255,.2)";x.fillRect(W/2-pr,pcy-pr,pr*2,pr*2)}x.restore();
    x.strokeStyle="rgba(255,255,255,.88)";x.lineWidth=W*.0095;x.beginPath();x.arc(W/2,pcy,pr,0,7);x.stroke();
    /* name */
    x.fillStyle="#fff";const ns=fitText(x,dv("name"),W-pad*2.4,W*.068,W*.04,"800");
    x.fillText(dv("name"),W/2,pcy+pr+ns*.95);
    x.fillStyle="rgba(255,255,255,.7)";x.font=`700 ${W*.031}px `+CF;
    x.fillText("স্বেচ্ছায় রক্তদাতা",W/2,pcy+pr+ns*.95+W*.045);
    /* blood */
    const br=W*.093,bcy=pcy+pr+ns*.95+W*.045+br+W*.05;
    x.fillStyle="#fff";x.beginPath();x.arc(W/2,bcy,br,0,7);x.fill();
    x.fillStyle=(d.cardTheme==="red")?"#8d1017":"#c8101d";x.font=`800 ${W*.075}px `+CF;
    x.fillText(d.bloodGroup,W/2,bcy+W*.027);
    /* info rows spread between blood circle and QR */
    const rows=[["আইডি",d.donorId],["এলাকা",dv("area")],["মোবাইল",dv("phone")],["অবস্থা",st.t]];
    const top=bcy+br+W*.055, bot=qy-W*.045, step=Math.min((bot-top)/rows.length,W*.082);
    let y=top+step*.62;
    rows.forEach(([k,v])=>{
      x.textAlign="left";x.fillStyle="rgba(255,255,255,.6)";x.font=`600 ${W*.0335}px `+CF;x.fillText(k,pad,y);
      x.textAlign="right";x.fillStyle="#fff";x.font=`800 ${W*.035}px `+CF;x.fillText(String(v),W-pad,y);
      x.strokeStyle="rgba(255,255,255,.15)";x.lineWidth=1.5;x.beginPath();
      x.moveTo(pad,y+step*.28);x.lineTo(W-pad,y+step*.28);x.stroke();
      y+=step});
  }
  let cardBusy=false;
  async function dlCard(kind){
    if(cardBusy)return;cardBusy=true;
    try{
      await (document.fonts?document.fonts.ready:Promise.resolve());
      toast("কার্ড তৈরি হচ্ছে…");
      const specs={front:[1016,638,drawFront,"সামনে"],back:[1016,638,drawBack,"পেছনে"],tall:[900,1600,drawTall,"শেয়ার"]};
      const list = kind==="both" ? ["front","back"] : [kind||"front"];
      for(const k of list){
        const [W,H,fn,lb]=specs[k],S=W/(k==="tall"?360:406);
        const c=document.createElement("canvas");c.width=W;c.height=H;
        const x=c.getContext("2d");x.textBaseline="alphabetic";
        await fn(x,W,H,S);
        const SB=cardSubject();
        const rawId=SB.mine?(STORE.donor.donorId||""):((CARD_FOR&&CARD_FOR.donorId)||"");
        const rawNm=SB.mine?dv("name"):((CARD_FOR&&CARD_FOR.name)||"");
        const base=safeName(rawId)!=="donor"?safeName(rawId):safeName(rawNm,"CBDC-donor");
        const side={"সামনে":"front","পেছনে":"back","শেয়ার":"share"}[lb]||"card";
        await new Promise(r=>c.toBlob(b=>{dl(b,`${base}-${side}.png`);r()},"image/png"));
        if(list.length>1)await new Promise(r=>setTimeout(r,450));
      }
      toast(list.length>1?"দুই পাশই নামানো হয়েছে":"কার্ড নামানো হয়েছে","ok");
      if(cardSubject().mine)logAct("ডোনার কার্ড ডাউনলোড","কার্ড","card");
    }catch(e){console.error(e);toast("ডাউনলোড ব্যর্থ হয়েছে","er")}
    finally{setTimeout(()=>cardBusy=false,600)}
  }
  /* Print only the card — everything else is hidden by @media print */
  function printCard(){
    document.getElementById("printarea")?.remove();
    const box=document.createElement("div");
    box.id="printarea";
    box.innerHTML=cardFront()+cardBack();
    document.body.append(box);
    const done=()=>{box.remove();window.removeEventListener("afterprint",done)};
    window.addEventListener("afterprint",done);
    setTimeout(()=>{window.print();setTimeout(()=>{if(document.getElementById("printarea"))done()},1500)},250);
  }
  function sheetDownload(){
    const s=sheet("কার্ড নামান",
      `<div class="opt on" data-k="both"><i></i><div><b>ছাপানোর কার্ড — দুই পাশ</b>
         <small>৮৬×৫৪ মিমি, ATM কার্ডের মাপ · ১০১৬×৬৩৮ px</small>
         <small class="mut">সামনে ও পেছনে — দুটি ছবি নামবে</small></div></div>
       <div class="opt" data-k="front"><i></i><div><b>শুধু সামনের পাশ</b>
         <small>৮৬×৫৪ মিমি · ১টি ছবি</small></div></div>
       <div class="opt" data-k="tall"><i></i><div><b>শেয়ার কার্ড — লম্বা</b>
         <small>ফেসবুক ও WhatsApp-এ শেয়ারের জন্য · ৯০০×১৬০০ px</small></div></div>
       <div class="note i" style="margin-top:11px">${ICON.info(16)}<span>যেকোনো কার্ডের QR স্ক্যান করলে নাম, মোবাইল, রক্তের গ্রুপ, এলাকা ও আইডি দেখা যাবে এবং ফোনে কন্টাক্ট হিসেবে সেভ করা যাবে।</span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">${ICON.down(15)} নামান</button>`);
    let kind="both";
    s.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{
      s.querySelectorAll(".opt").forEach(z=>z.classList.remove("on"));o.classList.add("on");kind=o.dataset.k});
    s.q("#ok").onclick=()=>{const k=kind;s.close();dlCard(k).then(()=>{CARD_FOR=null})};
    return s;
  }
  
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
  function logAct(title,detail,type="account"){
    RAW.activity.unshift({at:new Date().toISOString().slice(0,16),title,detail,type});
    if(RAW.activity.length>200)RAW.activity.length=200;
    saveData();
  }
  
  /* ---------- notifications panel ---------- */
  let npOpen=false;
  function openNotifs(){
    if(npOpen)return;npOpen=true;
    const ns=DB().notifs;
    const ov=document.createElement("div");ov.className="ov";
    const p=document.createElement("div");p.className="npanel";
    p.innerHTML=`<div class="hd" style="display:flex;align-items:center;gap:10px;padding:13px 15px;
        border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);z-index:2">
        <b style="flex:1;font-size:.95rem">বিজ্ঞপ্তি</b>
        ${ns.some(n=>!n.read)?`<button class="btn lnk" id="nall" style="font-size:.75rem">সব পড়া হয়েছে</button>`:""}
        <button class="x" id="nx" aria-label="বন্ধ">${ICON.x(19)}</button></div>
      ${ns.length?ns.map(n=>`<button class="nitem ${n.read?"":"un"}" data-n="${n.id}">
        <span class="ic" style="background:${n.t==="emergency"?"var(--red-s)":n.t==="security"?"var(--blu-s)":"var(--grn-s)"};
          color:${n.t==="emergency"?"var(--red)":n.t==="security"?"var(--blu)":"var(--grn)"}">
          ${n.t==="emergency"?ICON.warn(18):n.t==="security"?ICON.shield(18):ICON.drop(18)}</span>
        <span style="flex:1;min-width:0"><b>${esc(n.title)}</b><small>${esc(n.body)} · ${esc(n.time)}</small></span></button>`).join("")
        :`<div class="empty"><div class="ic">${ICON.bell(26)}</div><b>কোনো বিজ্ঞপ্তি নেই</b>
          <p>নতুন কিছু এলে এখানে দেখা যাবে</p></div>`}`;
    document.body.append(ov,p);document.body.style.overflow="hidden";
    const close=()=>{ov.remove();p.remove();npOpen=false;document.body.style.overflow="";paintTop()};
    ov.onclick=close;p.querySelector("#nx").onclick=close;
    p.querySelector("#nall")&&(p.querySelector("#nall").onclick=()=>{RAW.notifs.forEach(n=>n.read=true);close();toast("সব পড়া হিসেবে চিহ্নিত","ok")});
    p.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{
      const n=RAW.notifs.find(x=>x.id==b.dataset.n);n.read=true;close();
      const [g,s]=String(n.go).split(":");go(g,s||null);
    });
  }
  
  /* ══════════ ACTIONS ══════════ */
  document.addEventListener("click",async e=>{
    const sub=e.target.closest("[data-sub]");
    if(sub&&!e.target.closest("[data-act]")){go(CUR==="set"||SUB?"set":CUR,sub.dataset.sub);return}
    const b=e.target.closest("[data-act],[data-resp],[data-mute],[data-done],[data-cancel],[data-resps],[data-fav]");
    if(!b)return;const D_=b.dataset;
  
    if(D_.fav!==undefined){const n=D_.fav,i=STORE.saved.indexOf(n);
      i>-1?STORE.saved.splice(i,1):STORE.saved.push(n);save();
      if(b.classList.contains("dc-ico"))b.classList.toggle("fav",i<0);
      else b.style.color=i>-1?"var(--mut)":"var(--red)";
      toast(i>-1?"সংরক্ষণ থেকে সরানো হয়েছে":"সংরক্ষণ করা হয়েছে","ok");return}
  
    if(D_.resp){b.disabled=true;b.innerHTML=ICON.checkC(14)+" সাড়া দিয়েছেন";
      logAct("জরুরি আবেদনে সাড়া",D_.resp,"donor");toast("সাড়া জানানো হয়েছে","ok");return}
    if(D_.mute){if(!await confirmS({title:"এই আবেদন লুকাবেন?",desc:"আপনার তালিকা থেকে সরে যাবে।",ok:"লুকান"}))return;
      const i=RAW.incoming.findIndex(x=>x.id===D_.mute);if(i>-1)RAW.incoming.splice(i,1);saveData();rReq();toast("লুকানো হয়েছে");return}
    if(D_.done){if(!await confirmS({title:"সম্পন্ন হিসেবে চিহ্নিত করবেন?",desc:"রক্ত পাওয়া গেছে নিশ্চিত করছেন।",ok:"সম্পন্ন"}))return;
      RAW.mine.find(x=>x.id===D_.done).status="done";saveData();rReq();toast("আবেদন সম্পন্ন হয়েছে","ok");return}
    if(D_.cancel){if(!await confirmS({title:"আবেদন বাতিল করবেন?",desc:"রক্তদাতারা আর দেখতে পাবেন না।",ok:"বাতিল করুন",danger:true}))return;
      RAW.mine.find(x=>x.id===D_.cancel).status="cancelled";saveData();rReq();toast("আবেদন বাতিল হয়েছে");return}
    if(D_.resps){const r=RAW.mine.find(x=>x.id===D_.resps);
      sheet("সাড়াদাতারা",r.responders.map(p=>`<div class="card" style="padding:11px;margin-bottom:8px">
        <div class="per"><img src="${AV("পুরুষ")}" alt=""><div class="i"><b>${esc(p.name)}</b>
        <small>${esc(p.phone)}</small></div><span class="bg">${esc(p.group)}</span></div>
        <div style="display:flex;gap:7px;margin-top:9px">
          <a class="btn sm" style="flex:1" href="tel:${esc(p.phone)}">${ICON.phone(14)} কল</a>
          <a class="btn gh sm" style="flex:1" href="https://wa.me/88${esc(p.phone)}" target="_blank" rel="noopener">${ICON.chat(14)}</a>
        </div></div>`).join(""),`<button class="btn gh" data-close>বন্ধ</button>`);return}
  
    switch(D_.act){
      case "become":sheetBecome();break;
      case "newreq":sheetNewReq();break;
      case "adddon":go("set","adddonation");break;
      case "card":go("set","card");break;
      case "snooze":toast("৪ ঘণ্টার জন্য বন্ধ রাখা হলো");break;
  
      case "photo":pickPhoto();break;
      case "photoRm":STORE.account.photo="";STORE.account.photoSource="none";save();
        logAct("প্রোফাইল ছবি সরানো হয়েছে","");renderSub("account");toast("ছবি সরানো হয়েছে");break;
  
      case "editName":editField({key:"name",title:"নাম",label:"পূর্ণ নাম",
        validate:v=>v.trim().length>=2||"নাম কমপক্ষে ২ অক্ষরের হতে হবে"});break;
      case "editUser":sheetUsername();break;
      case "editMail":sheetEmail();break;
      case "editPhone":sheetPhone();break;
      case "editDob":editField({key:"dob",title:"জন্মতারিখ",label:"জন্মতারিখ",type:"date",
        validate:v=>!v||dayDiff(v)>365*10||"সঠিক জন্মতারিখ দিন"});break;
      case "editGender":editField({key:"gender",title:"লিঙ্গ",label:"লিঙ্গ",options:["পুরুষ","মহিলা","অন্যান্য"]});break;
      case "editArea":editField({key:"area",title:"এলাকা",label:"এলাকা",options:AREAS});break;
      case "editAddr":editField({key:"address",title:"ঠিকানা",label:"বিস্তারিত ঠিকানা",textarea:true,
        hint:"পাবলিক তালিকায় শুধু এলাকা দেখানো হয়, সম্পূর্ণ ঠিকানা নয়।"});break;
      case "editPass":sheetPassword();break;
      case "editWa":editField({key:"whatsapp",title:"WhatsApp",label:"WhatsApp নম্বর",store:"donor",max:11,
        validate:v=>!v||phoneOK(v)||"সঠিক ১১ সংখ্যার নম্বর দিন"});break;
      case "editLast":editField({key:"lastDonation",title:"সর্বশেষ রক্তদান",label:"তারিখ",type:"date",store:"donor",
        max2:iso(now()),hint:"মনে না থাকলে খালি রাখুন।"});break;
      case "editHealth":editField({key:"health",title:"স্বাস্থ্য তথ্য",label:"শারীরিক অবস্থা / রোগ",textarea:true,store:"donor"});break;
      case "reqGroup":sheetGroupChange();break;
      case "resetOv":if(await confirmS({title:"সব রিসেট করবেন?",
        desc:"নাম, লিঙ্গ, বয়স, এলাকা ও মোবাইল আবার অ্যাকাউন্ট থেকে নেওয়া হবে।",ok:"রিসেট করুন"})){
        DFIELDS.forEach(f=>STORE.donor.ov[f.k]=null);save();renderSub("donor");
        toast("সব তথ্য অ্যাকাউন্ট থেকে নেওয়া হবে","ok")}break;
      case "leaveDonor":if(await confirmS({title:"ডোনার তালিকা থেকে সরে যাবেন?",
        desc:"অ্যাকাউন্ট থাকবে, শুধু ডোনার তথ্য ও কার্ড সরে যাবে। চাইলে আবার যুক্ত হতে পারবেন।",ok:"সরে যান",danger:true})){
        STORE.donor.is=false;STORE.donor.status="none";save();logAct("ডোনার তালিকা থেকে সরে গেছেন","");go("set","donor");toast("সরে গেছেন")}break;
      case "withdraw":if(await confirmS({title:"আবেদন প্রত্যাহার করবেন?",desc:"পরে আবার আবেদন করতে পারবেন।",ok:"প্রত্যাহার",danger:true})){
        STORE.donor.is=false;STORE.donor.status="none";save();rReq();toast("প্রত্যাহার করা হয়েছে")}break;
  
      case "forgotPass":sheetForgot();break;
      case "pol_terms":case "pol_privacy":case "pol_donate":sheetPolicy(D_.act);break;
      case "exportData":sheetExport();break;
      case "logout":if(await confirmS({title:"লগআউট করবেন?",
        desc:"আপনি অ্যাকাউন্ট থেকে বেরিয়ে যাবেন এবং মূল ওয়েবসাইটে ফিরে যাবেন। আবার ঢুকতে লগইন করতে হবে।",
        ok:"লগআউট",danger:true}))doLogout();break;
      case "logoutAll":if(await confirmS({title:"সব ডিভাইস থেকে লগআউট?",
        desc:"এই ডিভাইসসহ সব জায়গা থেকে বেরিয়ে যাবেন।",ok:"সব থেকে লগআউট",danger:true}))doLogout();break;
      case "delAcc":sheetDelete();break;
      case "report":sheetReport();break;
      case "soon":toast("শীঘ্রই আসছে");break;
    }
  });
  
  /* ---------- generic field editor ---------- */
  function editField({key,title,label,type="text",options,textarea,store="account",validate,hint,max,max2}){
    const src=store==="donor"?STORE.donor:STORE.account;
    const cur=src[key]||"";
    const input=options
      ? `<select id="ev">${options.map(o=>`<option ${o===cur?"selected":""}>${esc(o)}</option>`).join("")}</select>`
      : textarea ? `<textarea id="ev">${esc(cur)}</textarea>`
      : `<input id="ev" type="${type}" value="${esc(cur)}" ${max?`maxlength="${max}"`:""} ${max2?`max="${max2}"`:""}>`;
    const s=sheet(title,`<div class="f"><label>${esc(label)}</label>${input}
      ${hint?`<span class="hint">${esc(hint)}</span>`:""}<span class="hint er hide" id="ee"></span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">সংরক্ষণ</button>`);
    s.q("#ok").onclick=()=>{
      const v=s.q("#ev").value.trim();
      if(validate){const r=validate(v);if(r!==true){s.q("#ee").textContent=r;s.q("#ee").classList.remove("hide");return}}
      src[key]=v;logAct(title+" পরিবর্তন",v.slice(0,30),store==="donor"?"donor":"account");
      s.close();renderSub(SUB);toast("সংরক্ষণ হয়েছে","ok");
    };
  }
  
  /* ---------- donor display field editor ---------- */
  function editDonorField(k){
    const f=DFIELDS.find(x=>x.k===k);
    const acct=acctVal(k), ov=STORE.donor.ov[k];
    let mode = isOv(k)?"custom":"account";
    const fmt=v=>k==="age"?(v?bn(v)+" বছর":"—"):(v||"—");
  
    const s=sheet(f.label,`
      <div class="note i">${ICON.info(17)}<span>এই তথ্যটি ডোনার তালিকা ও কার্ডে দেখানো হবে।</span></div>
      <button class="opt" data-m="account" style="width:100%;text-align:left">
        <span class="dot"></span>
        <span style="flex:1"><b>অ্যাকাউন্ট থেকে নিন</b>
          <small>${esc(fmt(acct))}</small>
          <small style="color:var(--mut)">অ্যাকাউন্টে বদলালে এখানেও বদলাবে</small></span></button>
      <button class="opt" data-m="custom" style="width:100%;text-align:left">
        <span class="dot"></span>
        <span style="flex:1"><b>আলাদা মান দিন</b>
          <small>শুধু ডোনার তালিকার জন্য</small></span></button>
      <div id="cw" class="hide" style="margin-top:12px">
        <div class="f" style="margin-bottom:0"><label>${esc(f.label)}</label>${
          f.type==="select"
            ? `<select id="fv">${f.options.map(o=>`<option ${String(ov||acct)===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`
            : `<input id="fv" type="${f.type==="number"?"number":"text"}"
                 ${f.min?`min="${f.min}"`:""} ${f.max&&f.type==="number"?`max="${f.max}"`:""}
                 ${f.max&&f.type==="tel"?`maxlength="${f.max}" inputmode="numeric"`:""}
                 value="${esc(ov??acct??"")}">`}
          <span class="hint er hide" id="fe"></span></div></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">সংরক্ষণ</button>`);
  
    const paint=()=>{
      s.querySelectorAll(".opt").forEach(o=>o.classList.toggle("on",o.dataset.m===mode));
      s.q("#cw").classList.toggle("hide",mode!=="custom");
    };
    s.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{mode=o.dataset.m;paint();
      if(mode==="custom")setTimeout(()=>s.q("#fv")?.focus(),60)});
    paint();
  
    s.q("#ok").onclick=()=>{
      if(mode==="account"){
        STORE.donor.ov[k]=null;save();s.close();renderSub("donor");
        toast(f.label+" এখন অ্যাকাউন্ট থেকে নেওয়া হবে","ok");return;
      }
      const v=String(s.q("#fv").value||"").trim(),er=s.q("#fe");er.classList.add("hide");
      const bad=m=>{er.textContent=m;er.classList.remove("hide")};
      if(!v)return bad("মান দিন");
      if(k==="name"&&v.length<2)return bad("নাম কমপক্ষে ২ অক্ষরের হতে হবে");
      if(k==="age"&&(+v<18||+v>60))return bad("বয়স ১৮ থেকে ৬০ বছরের মধ্যে হতে হবে");
      if(k==="phone"&&!phoneOK(v))return bad("সঠিক ১১ সংখ্যার নম্বর দিন");
      STORE.donor.ov[k]=k==="age"?+v:v;save();
      logAct("ডোনার তথ্য পরিবর্তন",f.label+": "+v,"donor");
      s.close();renderSub("donor");toast(f.label+" সংরক্ষণ হয়েছে","ok");
    };
  }
  
  /* ---------- photo ---------- */
  function pickPhoto(){
    const i=document.createElement("input");i.type="file";i.accept="image/*";
    i.onchange=async()=>{
      const f=i.files[0];if(!f)return;
      if(f.size>4*1024*1024){toast("ছবি ৪ MB এর কম হতে হবে","er");return}
      const s=sheet("ছবি আপলোড","<div style='text-align:center;padding:14px 0'><div class='sk' style='width:96px;height:96px;border-radius:50%;margin:0 auto 14px'></div><p class='mut'>ImgBB-তে আপলোড হচ্ছে…</p><div style='height:7px;border-radius:9px;background:var(--card2);margin-top:12px;overflow:hidden'><div id='pb' style='height:100%;width:8%;background:var(--grn);transition:width .3s'></div></div></div>","");
      try{
        /* ছবি ImgBB-তে upload → পাওয়া linkটাই প্রোফাইলে সেভ */
        const res=await imgbbUploadImage(f);
        s.q("#pb").style.width="100%";
        STORE.account.photo=res.url;STORE.account.photoSource="upload";save();
        logAct("প্রোফাইল ছবি পরিবর্তন","");
        setTimeout(()=>{s.close();renderSub("account");toast("ছবি আপডেট হয়েছে","ok")},280);
      }catch(e){
        s.close();
        toast(e&&e.message?e.message:"ছবি আপলোড করা যায়নি","er");
      }
    };
    i.click();
  }
  
  /* ---------- username ---------- */
  const TAKEN=["admin","cbdc","rahman","test","sahu2","donor"];
  function sheetUsername(){
    const a=STORE.account;
    const s=sheet("Username পরিবর্তন",`
      <div class="note w">${ICON.warn(17)}<span>আপনি username দিয়েও লগইন করতে পারেন —
        পরিবর্তন করলে <b>নতুন username দিয়ে লগইন</b> করতে হবে।</span></div>
      <div class="f"><label>বর্তমান</label><input value="@${esc(a.username)}" readonly></div>
      <div class="f"><label>নতুন username <i>*</i></label>
        <input id="un" value="${esc(a.username)}" maxlength="20" autocapitalize="off" spellcheck="false">
        <span class="hint" id="uh">৩–২০ অক্ষর · ছোট হাতের ইংরেজি, সংখ্যা, _ এবং .</span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok" disabled>পরিবর্তন করুন</button>`);
    const inp=s.q("#un"),h=s.q("#uh"),ok=s.q("#ok");let t;
    inp.oninput=()=>{
      clearTimeout(t);const v=inp.value.trim().toLowerCase();
      ok.disabled=true;h.className="hint";
      if(v===a.username){h.textContent="এটি আপনার বর্তমান username";return}
      if(!/^[a-z0-9._]{3,20}$/.test(v)){h.className="hint er";h.textContent="৩–২০ অক্ষর · শুধু a-z 0-9 _ .";return}
      h.textContent="পরীক্ষা করা হচ্ছে…";
      t=setTimeout(()=>{
        if(TAKEN.includes(v)){h.className="hint er";h.textContent="এই username ইতিমধ্যে ব্যবহৃত"}
        else{h.className="hint ok";h.textContent="✓ পাওয়া যাচ্ছে";ok.disabled=false}
      },420);
    };
    ok.onclick=()=>{
      const v=inp.value.trim().toLowerCase();
      STORE.account.username=v;save();logAct("Username পরিবর্তন","@"+v,"account");
      s.close();renderSub("account");toast("Username পরিবর্তন হয়েছে","ok");
    };
  }
  
  /* ---------- email ---------- */
  function sheetEmail(){
    const a=STORE.account;
    if(a.photoSource==="google"){
      sheet("ইমেইল",`<div class="note i">${ICON.info(17)}<span>আপনার ইমেইল <b>Google অ্যাকাউন্ট</b> থেকে নিয়ন্ত্রিত —
        এখান থেকে পরিবর্তন করা যাবে না।</span></div>
        <div class="f"><label>বর্তমান ইমেইল</label><input value="${esc(a.email)}" readonly></div>`,
        `<button class="btn gh" data-close>বন্ধ</button>`);return;
    }
    let step=1;
    const s=sheet("ইমেইল পরিবর্তন","","");
    const draw=()=>{
      if(step===1)s.q(".bd").innerHTML=`
        <div class="f"><label>বর্তমান ইমেইল</label><input value="${esc(a.email)}" readonly></div>
        <div class="f"><label>নতুন ইমেইল <i>*</i></label><input id="ne" type="email" placeholder="new@email.com">
          <span class="hint er hide" id="ee"></span></div>
        <div class="f"><label>পাসওয়ার্ড দিয়ে নিশ্চিত করুন <i>*</i></label><input id="pw" type="password"></div>`;
      if(step===2)s.q(".bd").innerHTML=`
        <div style="text-align:center;padding:12px 0">
          <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:var(--blu-s);
            color:var(--blu);display:grid;place-items:center">${ICON.mail(26)}</div>
          <b style="display:block;margin-bottom:5px">যাচাই মেইল পাঠানো হয়েছে</b>
          <p class="mut" style="font-size:.82rem">${esc(s._new)} — ইনবক্স (ও স্প্যাম) দেখুন।<br>
            লিংকে ক্লিক করলেই নতুন ইমেইল সক্রিয় হবে।</p>
          <div class="note w" style="margin-top:14px;text-align:left">${ICON.info(16)}
            <span>যাচাই না হওয়া পর্যন্ত <b>পুরোনো ইমেইলই</b> সক্রিয় থাকবে।</span></div></div>`;
      s.q(".ft").innerHTML=step===1
        ?`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="go">যাচাই মেইল পাঠান</button>`
        :`<button class="btn" data-close style="flex:1">বুঝেছি</button>`;
      if(step===1)s.q("#go").onclick=()=>{
        const v=s.q("#ne").value.trim().toLowerCase(),p=s.q("#pw").value;
        const er=s.q("#ee");er.classList.add("hide");
        if(!mailOK(v)){er.textContent="সঠিক ইমেইল দিন";er.classList.remove("hide");return}
        if(v===a.email){er.textContent="এটি আপনার বর্তমান ইমেইল";er.classList.remove("hide");return}
        if(!p){toast("পাসওয়ার্ড দিন","er");return}
        s._new=v;step=2;draw();logAct("ইমেইল পরিবর্তনের অনুরোধ",v,"security");
      };
    };
    s.querySelector(".bd").insertAdjacentHTML("afterend",`<div class="ft"></div>`);
    draw();
  }
  
  /* ---------- phone ---------- */
  function sheetPhone(){
    const a=STORE.account;
    const s=sheet("মোবাইল নম্বর",`
      <div class="f"><label>বর্তমান নম্বর</label><input value="${esc(a.phone)}" readonly></div>
      <div class="f"><label>নতুন নম্বর <i>*</i></label>
        <input id="np" maxlength="11" inputmode="numeric" placeholder="01XXXXXXXXX">
        <span class="hint" id="ph">১১ সংখ্যার বাংলাদেশি নম্বর</span></div>
      <div class="note i">${ICON.info(17)}<span>এই নম্বরটি <b>OTP যাচাই</b> ও অ্যাকাউন্ট পুনরুদ্ধারে ব্যবহার হবে।
        এখন শুধু ফরম্যাট পরীক্ষা করা হচ্ছে।</span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">সংরক্ষণ</button>`);
    s.q("#ok").onclick=()=>{
      const v=s.q("#np").value.trim();
      if(!phoneOK(v)){const h=s.q("#ph");h.className="hint er";h.textContent="সঠিক ১১ সংখ্যার নম্বর দিন";return}
      STORE.account.phone=v;STORE.account.phoneVerified=false;save();
      logAct("মোবাইল নম্বর পরিবর্তন",v,"security");
      s.close();renderSub("account");toast("নম্বর সংরক্ষণ হয়েছে","ok");
    };
  }
  
  /* ---------- password ---------- */
  function sheetPassword(){
    const s=sheet("পাসওয়ার্ড পরিবর্তন",`
      <div class="f"><label>বর্তমান পাসওয়ার্ড <i>*</i></label><input id="p0" type="password"></div>
      <div class="f"><label>নতুন পাসওয়ার্ড <i>*</i></label><input id="p1" type="password" minlength="6" placeholder="কমপক্ষে ৬ অক্ষর">
        <div style="display:flex;gap:4px;margin-top:7px">${[0,1,2,3].map(i=>`<div id="b${i}"
          style="flex:1;height:4px;border-radius:9px;background:var(--line);transition:.2s"></div>`).join("")}</div>
        <span class="hint" id="ps">শক্তি: —</span></div>
      <div class="f"><label>আবার লিখুন <i>*</i></label><input id="p2" type="password" minlength="6">
        <span class="hint er hide" id="pe"></span></div>
      <button class="btn lnk" id="fgt" style="font-size:.8rem;padding:2px 0">পাসওয়ার্ড ভুলে গেছেন?</button>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">পরিবর্তন করুন</button>`);
    const strength=v=>{let n=0;if(v.length>=6)n++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))n++;
      if(/\d/.test(v))n++;if(/[^A-Za-z0-9]/.test(v))n++;return n};
    s.q("#p1").oninput=()=>{
      const n=strength(s.q("#p1").value);
      const cols=["var(--line)","var(--red)","var(--amb)","#59a63a","var(--grn)"];
      const txt=["—","খুব দুর্বল","দুর্বল","মাঝারি","শক্তিশালী"];
      [0,1,2,3].forEach(i=>s.q("#b"+i).style.background=i<n?cols[n]:"var(--line)");
      s.q("#ps").textContent="শক্তি: "+txt[n];
    };
    s.q("#fgt").onclick=()=>{s.close();sheetForgot()};
    s.q("#ok").onclick=async()=>{
      const p0=s.q("#p0").value,p1=s.q("#p1").value,p2=s.q("#p2").value,e=s.q("#pe");
      e.classList.add("hide");
      if(!p0){toast("বর্তমান পাসওয়ার্ড দিন","er");return}
      if(p1.length<6){e.textContent="নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর";e.classList.remove("hide");return}
      if(p1!==p2){e.textContent="দুটি পাসওয়ার্ড মিলছে না";e.classList.remove("hide");return}
      try{
        await donorChangePassword(p0,p1);
        STORE.security.passwordChangedAt=iso(now());save();
        logAct("পাসওয়ার্ড পরিবর্তন","সফল","security");
        s.close();renderSub("security");toast("পাসওয়ার্ড পরিবর্তন হয়েছে","ok");
      }catch(err){
        const code=err&&err.code||"";
        toast(code==="auth/wrong-password"||code==="auth/invalid-credential"?"বর্তমান পাসওয়ার্ড সঠিক নয়":(err&&err.message?err.message:"পাসওয়ার্ড পরিবর্তন করা যায়নি"),"er");
      }
    };
  }
  
  /* ---------- logout ----------
     Clears the session for this browser and returns to the public website.
     The account data itself is left alone so logging back in restores it. */
  function doLogout(){
    try{
      (async()=>{try{const shared=initSharedFirebase();const {signOut}=await import("firebase/auth");if(shared.auth)await signOut(shared.auth)}catch(e){}})();
      logAct("লগআউট","এই ডিভাইস থেকে","security");
      sessionStorage.clear();
      localStorage.removeItem("cbdc.session");
      localStorage.removeItem("cbdc.auth");
      localStorage.removeItem("cbdcMember");
    }catch(e){}
    toast("লগআউট হয়েছে","ok");
    setTimeout(()=>{location.href="index.html"},700);
  }
  
  /* ---------- policies (full text) ----------
     One source of truth for all three documents. Each entry is a list of
     [heading, paragraph] pairs so the sheet renders them consistently and the
     i18n walker can translate them like any other text. */
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
        [tp("যোগাযোগ","Contact"),tp("শর্তাবলী নিয়ে কোনো প্রশ্ন থাকলে হেল্পলাইন ০১৬১৭৭২৫৪৬৪ নম্বরে যোগাযোগ করুন।","If you have questions about these terms, call the helpline on 01617725464.")]]},
  
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
        [tp("যোগাযোগ","Contact"),tp("গোপনীয়তা নিয়ে কোনো প্রশ্ন বা অনুরোধ থাকলে হেল্পলাইন ০১৬১৭৭২৫৪৬৪ নম্বরে জানান।","For any privacy question or request, call the helpline on 01617725464.")]]},
  
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
        চকবাজার ব্লাড ডোনার\u0027স ক্লাব · হেল্পলাইন ০১৬১৭৭২৫৪৬৪</p>`,
      `<button class="btn" data-close style="flex:1">বুঝেছি</button>`);
    return s;
  }
  
  /* ---------- forgot password (OTP verification) ---------- */
  /* Firebase Authentication — change password (re-auth + updatePassword) */
  async function donorChangePassword(currentPassword,newPassword){
    const shared=initSharedFirebase();
    const {EmailAuthProvider, reauthenticateWithCredential, updatePassword}=await import("firebase/auth");
    const user=shared.auth && shared.auth.currentUser;
    if(!user)throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
    const email=user.email||STORE.account.email;
    if(!email)throw new Error("এই অ্যাকাউন্টে ইমেইল নেই।");
    const cred=EmailAuthProvider.credential(email,currentPassword);
    await reauthenticateWithCredential(user,cred);
    await updatePassword(user,newPassword);
  }
  function sheetForgot(){
    const s=sheet("পাসওয়ার্ড ভুলে গেছেন?","","");
    const bd=s.q(".bd"),ft=s.q(".ft")||(()=>{const x=document.createElement("div");x.className="ft";s.append(x);return x})();
    const error=msg=>toast(msg,"er");
    bd.innerHTML=`<div class="note i">${ICON.info(17)}<span>Firebase Authentication থেকে একটি <b>পাসওয়ার্ড রিসেট লিংক</b> ইমেইলে পাঠানো হবে।</span></div>
      <div class="f"><label>ইমেইল <i>*</i></label><input id="fo_rec" value="${esc(STORE.account.email||"")}" placeholder="example@gmail.com"></div>`;
    ft.innerHTML=`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="fo_send">রিসেট লিংক পাঠান</button>`;
    s.q("#fo_send").onclick=async()=>{
      const recipient=s.q("#fo_rec").value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)){error("সঠিক ইমেইল দিন");return}
      const btn=s.q("#fo_send");btn.disabled=true;btn.textContent="পাঠানো হচ্ছে…";
      try{
        const shared=initSharedFirebase();
        const {sendPasswordResetEmail}=await import("firebase/auth");
        await sendPasswordResetEmail(shared.auth, recipient);
        bd.innerHTML=`<div class="note g">${ICON.checkC(17)}<span>${esc(recipient)} ঠিকানায় রিসেট লিংক পাঠানো হয়েছে। ইমেইল খুলে নতুন পাসওয়ার্ড সেট করুন।</span></div>`;
        ft.innerHTML=`<button class="btn" data-close>বন্ধ করুন</button>`;
      }catch(e){btn.disabled=false;btn.textContent="রিসেট লিংক পাঠান";error(e&&e.message?e.message:"রিসেট লিংক পাঠানো যায়নি")}
    };
  }
  /* ---------- delete account (4 steps) ---------- */
  function sheetDelete(){
    let step=1;
    const s=sheet("অ্যাকাউন্ট মুছে ফেলা","","");
    s.querySelector(".bd").insertAdjacentHTML("afterend",`<div class="ft"></div>`);
    const draw=()=>{
      const bd=s.q(".bd"),ft=s.q(".ft");
      const bar=`<div style="display:flex;gap:4px;margin-bottom:14px">${[1,2,3,4].map(i=>
        `<div style="flex:1;height:4px;border-radius:9px;background:${i<=step?"var(--red)":"var(--line)"}"></div>`).join("")}</div>`;
      if(step===1){bd.innerHTML=bar+`
        <div class="note r">${ICON.warn(17)}<span>এটি একটি <b>স্থায়ী</b> সিদ্ধান্ত। এগোনোর আগে ভালোভাবে দেখে নিন।</span></div>
        <b style="display:block;margin-bottom:7px;font-size:.86rem">যা মুছে যাবে</b>
        <p class="mut" style="font-size:.81rem;margin-bottom:12px">প্রোফাইল ও ব্যক্তিগত তথ্য · ডোনার প্রোফাইল ও কার্ড ·
          যোগাযোগের তথ্য · আপনার করা আবেদনসমূহ</p>
        <div class="note w" style="margin-bottom:12px">${ICON.clock(17)}<span>অনুরোধ করার পর
          <b>২৪ ঘণ্টার মধ্যে</b> অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা মুছে যাবে।</span></div>
        <b style="display:block;margin-bottom:7px;font-size:.86rem">যা থাকবে</b>
        <p class="mut" style="font-size:.81rem">রক্তদানের রেকর্ড (নাম ছাড়া) — কারণ এগুলো অন্যের চিকিৎসার সাথে যুক্ত</p>`;
        ft.innerHTML=`<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="nx">পরবর্তী</button>`;}
      if(step===2){bd.innerHTML=bar+`
        <div class="note w">${ICON.info(17)}<span>মুছে ফেলার বদলে এই বিকল্পগুলো ভেবে দেখুন —</span></div>
        <button class="btn gh w" id="a1" style="margin-bottom:8px">প্রাপ্যতা বন্ধ রাখুন</button>
        <button class="btn gh w" id="a2" style="margin-bottom:8px">সব বিজ্ঞপ্তি বন্ধ করুন</button>
        <button class="btn gh w" id="a3">প্রোফাইল গোপন করুন</button>`;
        ft.innerHTML=`<button class="btn gh" id="bk">পেছনে</button><button class="btn red" id="nx">না, মুছেই ফেলব</button>`;}
      if(step===3){bd.innerHTML=bar+`
        <div class="f"><label>পাসওয়ার্ড দিয়ে নিশ্চিত করুন <i>*</i></label><input id="dp" type="password"></div>
        <div class="f"><label>নিশ্চিত করতে <b style="color:var(--red)">মুছে ফেলুন</b> লিখুন <i>*</i></label>
          <input id="dt" placeholder="মুছে ফেলুন" autocapitalize="off"></div>`;
        ft.innerHTML=`<button class="btn gh" id="bk">পেছনে</button><button class="btn red" id="nx">অ্যাকাউন্ট মুছুন</button>`;}
      if(step===4){bd.innerHTML=`<div style="text-align:center;padding:8px 0">
        <div style="width:58px;height:58px;margin:0 auto 12px;border-radius:50%;background:var(--card2);
          color:var(--mut);display:grid;place-items:center">${ICON.clock(28)}</div>
        <b style="display:block;margin-bottom:6px">অ্যাকাউন্ট মুছে ফেলার প্রক্রিয়া শুরু হয়েছে</b>
        <div class="note w" style="text-align:left;margin-top:12px">${ICON.clock(17)}
          <span><b>২৪ ঘণ্টার মধ্যে মুছে যাবে</b><br>অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত
          সকল ডাটা ২৪ ঘণ্টার মধ্যে স্থায়ীভাবে মুছে ফেলা হবে।</span></div>
        <p class="mut" style="margin-top:12px;font-size:.8rem">আমাদের সাথে থাকার জন্য ধন্যবাদ</p></div>`;
        ft.innerHTML=`<button class="btn" data-close style="flex:1">বন্ধ করুন</button>`;}
      s.q("#bk")&&(s.q("#bk").onclick=()=>{step--;draw()});
      s.q("#nx")&&(s.q("#nx").onclick=()=>{
        if(step===3){
          if(!s.q("#dp").value){toast("পাসওয়ার্ড দিন","er");return}
          if(s.q("#dt").value.trim()!=="মুছে ফেলুন"){toast('হুবহু "মুছে ফেলুন" লিখুন',"er");return}
        }
        step++;draw();
      });
      s.q("#a1")&&(s.q("#a1").onclick=()=>{STORE.donor.available=false;save();s.close();go("set","donor");toast("প্রাপ্যতা বন্ধ করা হয়েছে","ok")});
      s.q("#a2")&&(s.q("#a2").onclick=()=>{Object.keys(STORE.notif).forEach(k=>{if(k!=="security")STORE.notif[k]=false});
        save();s.close();go("set","notif");toast("বিজ্ঞপ্তি বন্ধ করা হয়েছে","ok")});
      s.q("#a3")&&(s.q("#a3").onclick=()=>{STORE.privacy.profile="need";STORE.privacy.searchable=false;
        save();s.close();go("set","privacy");toast("প্রোফাইল গোপন করা হয়েছে","ok")});
    };
    draw();
  }
  
  /* ---------- report ---------- */
  function sheetReport(){
    const s=sheet("সমস্যা জানান",`
      <div class="f"><label>ধরন</label><select><option>বাগ বা ত্রুটি</option><option>ভুল তথ্য</option>
        <option>অন্য ব্যবহারকারীর অভিযোগ</option><option>পরামর্শ</option></select></div>
      <div class="f"><label>বিস্তারিত <i>*</i></label><textarea id="rd" placeholder="কী সমস্যা হচ্ছে লিখুন"></textarea></div>
      <div class="f"><label>স্ক্রিনশট</label><input type="file" accept="image/*"></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">পাঠান</button>`);
    s.q("#ok").onclick=()=>{
      if(!s.q("#rd").value.trim()){toast("বিস্তারিত লিখুন","er");return}
      s.close();toast("রিপোর্ট পাঠানো হয়েছে — ধন্যবাদ!","ok");
    };
  }
  
  /* ══════════ PREFS ══════════ */
  function applyPrefs(){
    const p=STORE.prefs;
    /* ডিফল্ট ও স্থায়ী Theme = Light; System (Dark/Light) auto-follow বন্ধ */
    const t=(p.theme==="dark")?"dark":"light";
    document.documentElement.dataset.theme=t;
    document.body.dataset.dense=p.dense?"1":"0";
    document.body.dataset.anim=p.anim?"1":"0";
    paintTop();
  }
  
  /* ══════════ FIRST RUN ══════════
     No default identity ships with the app, so on the very first open we ask for
     the minimum an account needs. Everything else is filled in later, from the
     screen that owns it. */
  /* club ID for a brand-new donor: CBDC-<year>-<4 digits derived from the uid> */
  function newDonorId(){
    const y=new Date().getFullYear();
    let n=0;const src=STORE.account.uid||String(Date.now());
    for(let i=0;i<src.length;i++)n=(n*31+src.charCodeAt(i))>>>0;
    return `CBDC-${y}-${String(n%9999+1).padStart(4,"0")}`;
  }
  function needsSetup(){return !STORE.account.name.trim()||!phoneOK(STORE.account.phone)}
  function sheetSetup(){
    const s=sheet("স্বাগতম",`
      <div class="note i">${ICON.info(17)}<span>শুরু করতে শুধু আপনার নাম ও মোবাইল নম্বর দিন।
        বাকি তথ্য পরে সেটিংস থেকে যোগ করতে পারবেন।</span></div>
      <div class="f"><label>আপনার পূর্ণ নাম <i>*</i></label>
        <input id="su_name" placeholder="যেমন: শাহাদাত আহমেদ" autocomplete="name"></div>
      <div class="f"><label>মোবাইল নম্বর <i>*</i></label>
        <input id="su_phone" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX" autocomplete="tel">
        <span class="hint">১১ সংখ্যার বাংলাদেশি নম্বর</span></div>
      <div class="f"><label>এলাকা</label>
        <select id="su_area"><option value="">নির্বাচন করুন</option>
          ${AREAS.map(a=>`<option>${esc(a)}</option>`).join("")}</select></div>`,
      `<button class="btn w" id="ok">শুরু করুন</button>`,{lock:true});
    s.q("#ok").onclick=()=>{
      const n=s.q("#su_name").value.trim(), ph=s.q("#su_phone").value.trim();
      if(n.length<2){toast("নাম কমপক্ষে ২ অক্ষরের হতে হবে","er");s.q("#su_name").focus();return}
      if(!phoneOK(ph)){toast("সঠিক ১১ সংখ্যার নম্বর দিন","er");s.q("#su_phone").focus();return}
      const a=STORE.account;
      a.name=n; a.phone=ph; a.area=s.q("#su_area").value||"";
      a.uid=a.uid||("u"+Date.now().toString(36));
      a.username=a.username||("user"+String(Date.now()).slice(-6));
      a.joined=a.joined||iso(now());
      save();logAct("অ্যাকাউন্ট তৈরি হয়েছে",n,"account");
      s.close();go(CUR,SUB);toast("স্বাগতম, "+n.split(" ")[0]+"!","ok");
    };
  }
  
  /* ══════════ BOOT ══════════ */
  const RENDER={home:rHome,find:rFind,req:rReq,set:rSet};
  /* If login happened on index.html, use the same account here. */
  /* Firebase Authentication session sync — login happens on index (Home).
     Session is now owned by Firebase Auth; this mirrors the signed-in user
     into the local account cache and guards the donor panel. */
  (async function syncAuthSession(){
    try{
      const shared = initSharedFirebase();
      const {onAuthStateChanged} = await import("firebase/auth");
      onAuthStateChanged(shared.auth, (user)=>{
        if(PUBLIC_MODE)return;
        if(!user){
          setTimeout(()=>{location.href="index.html"},400);
          return;
        }
        if(user.email)STORE.account.email=STORE.account.email||user.email;
        if(user.displayName)STORE.account.name=STORE.account.name||user.displayName;
        if(user.photoURL)STORE.account.photo=STORE.account.photo||user.photoURL;
        STORE.account.uid=STORE.account.uid||("u"+user.uid);
        STORE.account.emailVerified=user.emailVerified!==false;
        try{save()}catch(e){}
        if(needsSetup()&&!document.querySelector(".sheet"))setTimeout(sheetSetup,260);
      });
    }catch(e){ console.warn("doner auth sync:", e && e.message); }
  })();
  try{
    if(localStorage.getItem("cbdcMember")==="1"){
      STORE.account.name=STORE.account.name||localStorage.getItem("cbdcMemberName")||"";
      STORE.account.email=STORE.account.email||localStorage.getItem("cbdcMemberEmail")||"";
      STORE.account.photo=STORE.account.photo||localStorage.getItem("cbdcMemberPhoto")||"";
      STORE.account.uid=STORE.account.uid||("u"+(STORE.account.email||STORE.account.phone||Date.now()).replace(/\W/g,""));
      try{localStorage.setItem(LS,JSON.stringify({account:STORE.account,donor:STORE.donor,privacy:STORE.privacy,
        notif:STORE.notif,prefs:STORE.prefs,security:STORE.security,saved:STORE.saved}))}catch(e){}
    }
  }catch(e){}
  applyPrefs();
  watchI18n();
  document.documentElement.lang=STORE.prefs.lang==="en"?"en":"bn";
  document.body.dataset.lang=STORE.prefs.lang;
  paintNav();
  if(!bootPublicProfile()){
    const [h0,h1]=location.hash.replace("#","").split("/");
    go(RENDER[h0]?h0:"home",h1||null,false);
  }
  
  /* test/debug handles — the app itself never reads these */
  Object.assign(window,{DB,STORE,go,save,toast,openProfile,profileView,
    applyLang,renderSub,donorReady,getCUR:()=>CUR,getSUB:()=>SUB});
  /* a visitor reading someone's public profile is not signing up for anything */
  if(window.CBDCShared)CBDCShared.subscribe((st,meta)=>{
    if(meta&&meta.source==="doner:personal")return;
    pullSharedPublic();
    if(!document.querySelector(".sheet")&&!PUBLIC_MODE)go(CUR,SUB,false);
  });
  if(!PUBLIC_MODE && needsSetup())setTimeout(sheetSetup,260);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){
    document.querySelector(".ov")?.click();}});
  
}

export default function Doner() {
  useEffect(() => {
    initPage();
  }, []);

  return (
    <>
      <style>{pageCss}</style>
      <StaticShell />
    </>
  );
}
