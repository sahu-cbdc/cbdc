// @ts-nocheck — এই ফাইলটি মূল HTML-এর JavaScript-এর verbatim (হুবহু) port।
// রূপান্তরের সময় runtime আচরণ ১০০% অপরিবর্তিত রাখাই লক্ষ্য; তাই legacy logic-কে
// TypeScript টাইপ-চেকিং থেকে মুক্ত রাখা হয়েছে। React shell ও shared store সম্পূর্ণ
// typed (src/lib/store.ts ও src/lib/firebase.ts দেখুন)।
/**
 * Admin.tsx
 * React + TypeScript port of admin.html — অ্যাডমিন প্যানেল।
 */
import { useEffect } from "react";
import "../lib/store";
import { initFirebase as initSharedFirebase, NODES, getAuthInstance } from "../lib/firebase";
import { navigateToPage, screenPath, panelSubPath, appBase } from "../lib/router";
import { authErrorMessage, resolveUserRole, panelForRole, setOrChangePassword } from "../lib/authx";
import { getRow, setRow, updateRow, removeRow, listOnce, watchList, watchRow, findBy, nowIso, nextDonorId, updatePaths, serverTime, getPath, setPath, removePath, watchPath } from "../lib/rtdb";
import { ageText, ageFromDob, dobBounds, isValidDob } from "../lib/age";
import { validateForm, clearFormErrors, attachLiveClear, setFieldError, FORM_ERROR_CSS } from "../lib/forms";
import { logoUrl, applyLogo } from "../config/logo";
import SITE from "../config/site";
import { uploadImage as imgbbUploadImage, getImgbbKey, saveImgbbKey } from "../lib/imgbb";
import {
  donationVerKey,
  safeDonationId,
  donorStatsFromRecords,
  makeApprovedDonationRecord,
  writeApprovedDonation,
  deleteApprovedDonation,
  backfillApprovedDonations,
  proofUrlOf,
} from "../lib/donationLog";
import { serverDeleteEntity, deletionMessage, bulkDeletionMessage, describeDeletionFailure, isAuthUid, runDedupeScan, type DeletionStep, type DeleteScope } from "../lib/accountDelete";
import { noticeIsActive, noticeTarget } from "../lib/notice";

/* ═══════════════════════════════════════════════════════════════════
   CSS — মূল admin.html-এর <style> ব্লক হুবহু কপি
   ═══════════════════════════════════════════════════════════════════ */
const pageCss = FORM_ERROR_CSS + `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
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
.brand .lg img{width:34px;height:34px;object-fit:cover;border-radius:50%;display:block}
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
.astat .sk-stat{background:var(--card);border:1px solid var(--line);border-radius:var(--r2);
  padding:12px 9px;display:grid;gap:8px;justify-items:center}

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
   Static UI — মূল admin.html-এর <body> মার্কআপ হুবহু JSX-এ
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
      {/* Shared live state: same donors, requests and moderation queue across all pages (Realtime Database) */}
      {" "}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Page logic — মূল admin.html-এর <script type="module"> হুবহু port
   ═══════════════════════════════════════════════════════════════════ */
function initPage() {
  /* which panel this build is */
  const PANEL={id:"admin",role:"admin",label:"অ্যাডমিন প্যানেল"};
  /* লোগো — কেন্দ্রীয় উৎস (src/config/logo.ts)। কোনো পেজে আলাদা path নেই। */
  const LOGO = logoUrl();
  const I=(p,sz=22)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON={
    logo:`<img src="${LOGO}" alt="CBDC" width="20" height="20" style="display:block;object-fit:cover;border-radius:50%">`,
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
  "শুধু অ্যাডমিন পারেন":"Admin only",
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
  "অনুমোদন ও সেটিংস":"Approvals and settings",
  "বয়স, বিশ্রাম, অনুমোদন, সংযোগ":"Age, rest, approvals, integrations",
  "রক্তদানের নিয়ম":"Donation rules",
  "সর্বনিম্ন বয়স":"Minimum age",
  "সর্বোচ্চ বয়স":"Maximum age",
  "দুই দানের মাঝে বিশ্রাম (দিন)":"Rest between donations (days)",
  "অনুমোদন প্রক্রিয়া":"Approval process",
  "কোন কোন কাজে অনুমোদন লাগবে":"Which actions need approval",
  "ডোনার আবেদন":"Donor application",
  "রক্তদান যাচাই":"Donation verification",
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
  "বন্ধ করলে শুধু অ্যাডমিন দেখবেন":"When off, only admins can see you",
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
  "প্রয়োজন হলে অ্যাডমিনকে বলুন":"Ask an admin if you need it",
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
  "নিজের অ্যাডমিন অ্যাক্সেস নিজে সরানো যায় না":"You cannot remove your own admin access",
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
  "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না। কিছু দরকার হলে অ্যাডমিনকে বলুন।":
    "Your role is set from the database and cannot be changed by you. Ask an admin if you need more access.",
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
  "অ্যাডমিন অ্যাকাউন্ট নিজে থেকে মুছে ফেলা যায় না — শেষ অ্যাডমিন হারিয়ে গেলে পুরো সিস্টেম আটকে যাবে। অ্যাডমিনকে বলুন।":
    "An admin account cannot delete itself — losing the last admin would lock the whole system. Ask an admin.",
  "এই সেটিংস আপনার নিজের তথ্যের জন্য — টিমের অন্য সদস্য ও পাবলিক তালিকায় কী দেখা যাবে তা ঠিক করে।":
    "These settings cover your own details — they control what teammates and the public list can see.",
  "অ্যাডমিন হিসেবে আপনি যা যা করেন তা":"Everything you do as an admin",
  "অডিট লগে থেকেই যায় — এটি গোপনীয়তা সেটিংস দিয়ে বন্ধ করা যায় না।":
    "stays in the audit log — privacy settings cannot switch that off.",
  "আপনার অ্যাকাউন্টে যেসব ডিভাইসে লগইন আছে তার তালিকা। অচেনা কিছু দেখলে সাথে সাথে বের করে দিন।":
    "Devices currently signed in to your account. If you see anything unfamiliar, sign it out immediately.",
  "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না।":
    "Your role is set from the database and cannot be changed by you.",
  "কিছু দরকার হলে অ্যাডমিনকে বলুন।":"Ask an admin if you need more access.",
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
  "অ্যাডমিন ভূমিকা Admin Panel থেকে নিয়ন্ত্রিত হয়":"Admin role is controlled from the Admin Panel",
  "প্রতিটি পরিবর্তন কারণসহ অডিট লগে থাকে":"Every change is logged with its reason",
  "নিজের ভূমিকা এখান থেকে বদলানো যায় না।":"Your own role cannot be changed from here.",
  "নিজের অ্যাডমিন অ্যাক্সেস নিজে পরিবর্তন করা যাবে না।":
    "You cannot change your own admin access from here.",
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
     Data source: Firebase Realtime Database (live sync)
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
    "রক্তদাতা":["donor.view","donor.edit","donor.approve","donation.verify","donation.manage","contact.reveal"],
    "আবেদন":["request.view","request.approve","request.resolve"],
    "ব্যবহারকারী":["user.view","user.suspend","group.approve","report.resolve"],
    "ওয়েবসাইট":["website.view","website.edit","gallery.manage","notice.manage"],
    "নিয়ন্ত্রণ":["team.view","team.manage","access.manage","settings.manage","audit.view","data.export","database.manage"]
  };
  const PERMS=Object.values(PERM_GROUPS).flat();
  const ROLES={
    admin:{label:"অ্যাডমিন",icon:"🛡️",perms:PERMS.slice()},
    /* A moderator exists to clear the pending queue — nothing else.
       They may read a donor's details while judging an application
       (the review sheet), but cannot browse or manage the donor list. */
    mod:{label:"মডারেটর",icon:"🔧",perms:["donation.verify","contact.reveal",
      "request.view","request.approve","group.approve","report.resolve"]}
  };
  let ME={uid:"",name:"",role:PANEL.role};
  /* অ্যাডমিন সবসময় full access — RTDB-তে সীমিত permissions
     array থাকলেও তা উপেক্ষা করা হয়। */
  const myPerms=()=>{
    if(ME.role==="admin") return new Set(PERMS);
    return new Set((ME.permissions&&ME.permissions.length)?ME.permissions:ROLES[ME.role].perms);
  };
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
  /* ── ডেমো/মক ডেটা সম্পূর্ণ রিমুভ ──────────────────────────────────────
     আগে এখানে নমুনা বাংলা নাম ও random সংখ্যা তৈরির helper ছিল, যেগুলো
     পরিসংখ্যান/চার্টে বানানো মান দেখাত। এখন প্রতিটি সংখ্যা Realtime Database-এর
     বাস্তব রেকর্ড থেকেই আসে — কোনো hardcoded বা random ডেটা নেই। */
  
  function seed(){
    /* Firebase is the single source of truth — no seeded/dummy records.
       The shape is kept so every consumer finds the same keys. */
    return {donors:[],queue:[],live:[],audit:[],notices:[],messages:[],
      team:[],gallery:[],reports:[],donations:[],
      site:{heroTitle:SITE.hero.title,
        heroText:SITE.hero.text,
        phone:SITE.phone,email:SITE.email,address:SITE.address,
        facebook:SITE.facebookHandle,showStats:SITE.showStats,showGallery:SITE.showGallery,showEmergency:SITE.showEmergency},
      rules:{minAge:SITE.rules.minAge,maxAge:SITE.rules.maxAge,interval:SITE.rules.interval,
        donorApproval:true,donationApproval:true,emergencyApproval:true,bloodGroupApproval:true,
        /* legacy key retained so existing settings continue to work */
        reqApproval:true},
      integr:{imgbbKey:"",firebase:true}};
  }
  let DB=seed(), SHARED_PULLING=false;
  let lastPersistedDB=null;
  function publishSharedState(){
    if(SHARED_PULLING||!window.CBDCShared)return Promise.resolve();
    return CBDCShared.updateAsync(st=>{
      st.donors=DB.donors.map(CBDCShared.fromAdminDonor);
      st.queue=DB.queue.map(x=>CBDCShared.clone(x));
      st.requests=DB.live.map(r=>({id:r.id,patientName:r.patient,bloodGroup:r.group,bags:r.bags,
        urgency:r.urgency,status:"approved",workflowStatus:r.status||"searching",hospitalName:r.hospital,
        hospitalAddress:r.area,requesterName:r.requester||"স্বজন",phone:r.phone,whatsapp:r.whatsapp||r.phone,
        createdAt:r.at||new Date().toISOString(),expiresAt:r.expiresAt||"",responders:r.responders||0,
        ownerUid:r.ownerUid||r.uid||r.userId||""}));
      st.gallery=DB.gallery.map((g,i)=>({...g,imageUrl:g.imageUrl||g.url,url:g.url||g.imageUrl,order:g.order??i+1}));
      st.notices=DB.notices.map(x=>CBDCShared.clone(x));
      if(DB.accounts)st.accounts=DB.accounts.map(x=>CBDCShared.clone(x));
      if(DB.donations)st.donations=DB.donations.map(x=>CBDCShared.clone(x));
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
      at:r.createdAt||new Date().toISOString(),expiresAt:r.expiresAt||"",
      ownerUid:r.ownerUid||r.uid||r.userId||""}));
    /* সবসময় সম্পূর্ণ তালিকা বসাই — অন্য জায়গা থেকে ছবি/রেকর্ড মুছলে এখানেও
       সাথে সাথে প্রতিফলিত হয় (আগের `length` guard ডিলিট আটকে দিত) */
    DB.gallery=st.gallery.map(g=>({...g,url:g.url||g.imageUrl}));
    DB.notices=st.notices.map(x=>CBDCShared.clone(x));
    DB.accounts=st.accounts.map(x=>CBDCShared.clone(x));
    DB.donations=(st.donations||[]).map(x=>CBDCShared.clone(x));
    SHARED_PULLING=false;
    lastPersistedDB=CBDCShared.clone(DB);
  }
  function restoreLastPersistedDB(){
    if(!lastPersistedDB)return;
    Object.keys(DB).forEach(k=>{if(!(k in lastPersistedDB))delete DB[k]});
    Object.assign(DB,CBDCShared.clone(lastPersistedDB));
  }
  /* persist() — পরিবর্তন Realtime Database-এ। donors/queue/requests/gallery/
     notices/accounts যায় shared store দিয়ে; rules-এর মতো সেটিংস `settings`
     নোডে। ওয়েবসাইট (site) সেটিংস RTDB-তে যায় না — সেগুলো saveSiteToSource()
     সরাসরি Main Website-এর src/config/site.ts-এ লেখে। */
  let SETTINGS_PULLING=false;
  let persistChain=Promise.resolve();
  function persist(){
    const run=async()=>{
      try{
        const result=await Promise.all([publishSharedState(),auditChain]);
        lastPersistedDB=CBDCShared.clone(DB);
        return result;
      }catch(error){
        restoreLastPersistedDB();
        throw error;
      }
    };
    persistChain=persistChain.catch(()=>undefined).then(run);
    return persistChain;
  }
  async function pushSettings(){
    if(SETTINGS_PULLING)return;
    await setRow(NODES.settings,"app",{
      rules:DB.rules||{},
      /* keep the old flat key readable by existing website builds */
      autoApproveEmergency:DB.rules&&DB.rules.emergencyApproval===false
    });
  }
  /* settings live listener — এক প্যানেলে বদলালে অন্য প্যানেল ও ওয়েবসাইটেও সাথে সাথে
     (শুধু rules — ওয়েবসাইট site-সেটিংস এখানে নেই, সেগুলো src/config/site.ts থেকে আসে) */
  let lastSettingsJson="";
  watchList(NODES.settings,(rows)=>{
    const app=rows.find(r=>r.id==="app");
    if(!app)return;
    /* অপরিবর্তিত ডেটা (যেমন নিজের লেখারই প্রতিধ্বনি) এলে আবার কাজ করবে না */
    const sig=JSON.stringify([app.rules||{},app.autoApproveEmergency??null]);
    if(sig===lastSettingsJson)return;
    lastSettingsJson=sig;
    SETTINGS_PULLING=true;
    if(app.rules&&typeof app.rules==="object")Object.assign(DB.rules,app.rules);
    /* Old installations only have autoApproveEmergency. Preserve it while the
       new explicit approval flags are introduced; never touch queue data. */
    if(app.rules?.emergencyApproval===undefined && typeof app.autoApproveEmergency==="boolean")
      DB.rules.emergencyApproval=!app.autoApproveEmergency;
    if(DB.rules.reqApproval===undefined && DB.rules.emergencyApproval!==undefined)
      DB.rules.reqApproval=DB.rules.emergencyApproval;
    /* নতুন অনুমোদন সুইচ — পুরোনো installation-এ কী না থাকলে ডিফল্ট ON */
    if(DB.rules.donationApproval===undefined)DB.rules.donationApproval=true;
    SETTINGS_PULLING=false;
    /* সেটিংস বদলালে শুধু নিয়ম/হোম স্ক্রিন আবার আঁকা হয় — পুরো ডেটা রিলোড নয় */
    try{
      if(!document.querySelector(".sheet")&&(SUB==="rules"||(CUR==="home"&&!SUB)))go(CUR,SUB,false,ARG);
    }catch(e){}
  });
  /* ══════════ DASHBOARD DATA READINESS (Loading → Data → Realtime) ══════════
     Firebase RTDB listener-এর প্রথম snapshot না আসা পর্যন্ত কোনো পরিসংখ্যান
     দেখানো হয় না — ভুল "০"/blank/placeholder দেখার বদলে Skeleton দেখানো হয়।
       • ডেটা **একবারই** লোড হয় (boot-এ listener attach), তারপর মেমোরি/state-এ
         থাকে — page/navigation বদলালে পুরো database নতুন করে লোড হয় না।
       • কোনো add/update/delete হলে listener শুধু সংশ্লিষ্ট অংশ realtime-এ
         আপডেট করে — পুরো ড্যাশবোর্ড reload/re-fetch হয় না।
       • readiness বদলালেই শুধু render — বারবার unnecessary re-render নয়। */
  const DATA_READY={donors:false,requests:false,queue:false,gallery:false,notices:false,
    accounts:false,users:false,admins:false,audit:false,messages:false,reports:false};
  const READY_KEYS=Object.keys(DATA_READY);
  let lastReadySig="";
  const readySig=()=>READY_KEYS.map(k=>DATA_READY[k]?1:0).join("");
  function refreshOnDataReady(){
    const sig=readySig();
    if(sig===lastReadySig)return;
    lastReadySig=sig;
    try{
      /* কোনো sheet/মোডাল খোলা থাকলে render নয় (ইউজারের কাজ ব্যাহত হবে না) */
      if(document.querySelector(".sheet"))return;
      const key=(CUR==="set"&&SUB)?SUB:CUR;
      if(CUR==="home"&&!SUB){go(CUR,SUB,false,ARG);return}
      if(["team","donorid","access","users","audit","inbox","stats","donors","approved","live","gallery","notice"].includes(key))
        go(CUR,SUB,false,ARG);
    }catch(e){/* প্রথম render-এর আগে CUR/SUB থাকে না — তখন কিছুই করতে হয় না */}
  }
  /** RTDB-র প্রথম snapshot এসেছে মার্ক করা (বারবার কল হলেও একবারই কাজ করে)। */
  function markDataReady(name){
    if(!(name in DATA_READY)||DATA_READY[name])return;
    DATA_READY[name]=true;
    refreshOnDataReady();
  }
  const dataReady=(...names)=>names.every(n=>DATA_READY[n]===true);
  /** ড্যাশবোর্ডের প্রধান পরিসংখ্যান (মোট রক্তদাতা/প্রস্তুত/অপেক্ষমাণ/চলমান) */
  const statsReady=()=>dataReady("donors","requests","queue");
  /** অ্যাক্সেস ও ভূমিকা/টিম — users + admins দুটো listener-ই লোড হলে প্রস্তুত */
  const accountsReady=()=>dataReady("users","admins");
  /* shared store-এর node-গুলোর readiness — নতুন করে ডেটা না এনে শুধু সিগন্যাল।
     এই প্যানেল আঁকার **আগেই** কোনো node লোড হয়ে গেলে (যেমন পেজ রিলোডে
     Firebase session আগে থেকেই থাকে) সেটাও ধরা হয় — তাহলে ডেটা থাকা সত্ত্বেও
     আজীবন স্কেলিটন দেখানোর ভুল হয় না। */
  if(window.CBDCShared&&typeof CBDCShared.isNodeLoaded==="function")
    READY_KEYS.forEach(n=>{if(CBDCShared.isNodeLoaded(n))DATA_READY[n]=true});
  lastReadySig=readySig();
  if(window.CBDCShared&&typeof CBDCShared.onNodeLoaded==="function")
    CBDCShared.onNodeLoaded(node=>markDataReady(node));
  pullSharedState();
  /* পুরোনো/ব্যাকফিল: ডোনার রেকর্ডে প্রোফাইল ছবি (ImgBB link) না থাকলে
     users/{uid}/photoURL থেকে এক-বার অনুলিপি — পাবলিক প্রোফাইলে সঠিক ছবি দেখাতে */
  function backfillDonorPhotos(){
    const missing=DB.donors.filter(d=>!String(d.photo||"").trim()&&d.ownerUid);
    if(!missing.length)return;
    Promise.all(missing.map(d=>getRow(NODES.users,d.ownerUid).then(u=>{
      const ph=String((u&&(u.photoURL||u.photo))||"").trim();
      if(ph)d.photo=ph;
    }).catch(()=>{}))).then(()=>{
      if(DB.donors.some(d=>String(d.photo||"").trim()))persist();
    });
  }
  backfillDonorPhotos();
  let auditChain=Promise.resolve();
  function logAudit(act,target,mod){
    const e={at:new Date().toISOString(),who:ME.name,role:ME.role,act,target,mod};
    DB.audit.unshift(e);
    if(DB.audit.length>300)DB.audit.length=300;
    auditChain=auditChain.catch(()=>undefined).then(()=>{return pushAudit(e);});
    return auditChain;
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
    key:s=>I(`<circle cx="7.5" cy="12" r="3.8"/><path d="M11.3 12H21"/><path d="M17.5 12v3.6"/><path d="M20.5 12v2.4"/>`,s),
    db:s=>I(`<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>`,s)
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
    approved:{title:"অনুমোদিত রক্তদান",perm:"donation.manage"},
    live:{title:"চলমান আবেদন",perm:"request.view"},
    users:{title:"ব্যবহারকারী",perm:"user.view"},
    team:{title:"ডোনার ব্যবস্থাপনা",perm:"team.view"},
    donorid:{title:"ডোনার আইডি ব্যবস্থাপনা",perm:"team.view"},
    site:{title:"ওয়েবসাইট",perm:"website.view"},
    gallery:{title:"গ্যালারি",perm:"website.view"},
    notice:{title:"নোটিশ",perm:"website.view"},
    inbox:{title:"বার্তা",perm:"user.view"},
    stats:{title:"পরিসংখ্যান",perm:"donor.view"},
    audit:{title:"অডিট লগ",perm:"audit.view"},
    rules:{title:"অনুমোদন ও সেটিংস",perm:"settings.manage"},
    access:{title:"অ্যাক্সেস ও ভূমিকা",perm:"access.manage"},
    database:{title:"ডেটাবেস ব্যবস্থাপনা",perm:"database.manage"},
    search:{title:"খুঁজুন",perm:null}
  };
  let CUR="home", SUB=null, ARG=null;
  
  function go(id,sub=null,push=true,arg=null){
    /* a screen the current role cannot see always falls back to home */
    const nav=NAV_ALL.find(n=>n.id===id);
    if(nav&&nav.perm&&!can(nav.perm))id="home";
    if(sub&&SUBS[sub]&&SUBS[sub].perm&&!can(SUBS[sub].perm)){toast("এই অংশে আপনার অনুমতি নেই","er");sub=null}
    CUR=id;SUB=sub;ARG=arg;
    /* Database Manager-এর একমাত্র realtime root listener শুধু ডেটাবেস
       সাব-পেজেই থাকে — অন্য কোথাও গেলে সাথে সাথে cleanup হয়, যাতে duplicate
       listener বা memory leak না হয়। dbStop পরে ডিক্লেয়ার করা হলেও function
       declaration hoisted হয় এবং initPage-র বডি চলার আগেই তৈরি থাকে। */
    if(!(id==="set"&&sub==="database")){if(typeof dbStop==="function")dbStop();}
    $$(".scr").forEach(s=>s.classList.remove("on"));
    if(sub){$("#s-sub").classList.add("on");renderSub(sub)}
    else{$("#s-"+id).classList.add("on");RENDER[id]()}
    paintTop();paintNav();
    if(push){
      /* URL-এ clean path বসে: /admin/<screen>/<sub> — কোনো "#" নয় */
      const p=screenPath("admin",id,sub||null)+location.search;
      try{ if(location.pathname+location.search!==p)history.pushState(null,"",p); }catch(e){}
    }
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
      t.innerHTML=`<a class="brand" href="${appBase()}" data-home="1">
          <span class="lg"><img src="${LOGO}" alt="CBDC লোগো"></span>
          <span class="btx"><b>চকবাজার ব্লাড ডোনার'স ক্লাব</b><small>${esc(PANEL.label)}</small></span></a>
        <nav class="dnav">${NAV().map(n=>{const c=(!ME.prefs||ME.prefs.badge!==false)&&n.count?n.count():0;
          return `<button data-nav="${n.id}" class="${CUR===n.id?"on":""}" title="${n.label}">
            ${n.icon(22)}${c?`<i class="nb">${bn(c)}</i>`:""}<span>${n.label}</span></button>`}).join("")}</nav>
        <div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${SI.bell(21)}${badge()}</button>`;
    }
  }
  const badge=()=>{const u=DB.queue.length+unread()+DB.reports.filter(r=>r.status!=="resolved").length;
    return u&&(!ME.prefs||ME.prefs.badge!==false)?`<span class="bd">${bn(u)}</span>`:""};
  
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-home]")){e.preventDefault();navigateToPage("home");return}
    const n=e.target.closest("[data-nav]");
    if(n){e.preventDefault();go(n.dataset.nav);return}
    if(e.target.closest("#tback")){go(CUR);return}
    if(e.target.closest("#tbell")){openNotifs();return}
    const s=e.target.closest("[data-sub]");
    if(s){go(CUR,s.dataset.sub);return}
  });
  const reRoute=()=>{
    const seg=panelSubPath("admin");
    const [a,b]=(seg||location.hash.replace("#","")).split("/");
    if(!a)return go("home",null,false);
    if(RENDER[a]&&(a!==CUR||(b||null)!==SUB))go(a,b||null,false);
  };
  window.addEventListener("popstate",reRoute);
  window.addEventListener("hashchange",reRoute); /* পুরোনো #hash লিংক compat */
  
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
    DB.reports.filter(r=>r.status!=="resolved").slice(0,4).forEach(r=>items.push({ic:"help",cl:"var(--amb)",
      b:"নতুন অভিযোগ/রিপোর্ট",s:`${r.type} · ${r.name||"—"}`,at:r.createdAt,go:()=>go(CUR,"users")}));
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
  const noPerm=()=>`<div class="card">${emptyBox("lock","এই অংশে আপনার অনুমতি নেই","প্রয়োজন হলে অ্যাডমিনকে বলুন")}</div>`;
  /* ── Loading/Skeleton — ডেটা না আসা পর্যন্ত কোনো সংখ্যা/placeholder নয় ── */
  const skBar=(w,h="11px",r=8)=>`<span class="sk" style="display:block;width:${w};height:${h};border-radius:${r}px"></span>`;
  const skelCard=(lines=3)=>`<div class="card">${Array.from({length:lines}).map((_,i)=>
    `<div style="margin-bottom:${i===lines-1?0:10}px">${skBar(i===0?"52%":"88%",i===0?"13px":"11px")}</div>`).join("")}</div>`;
  const skelStats=()=>`<div class="astat">${["g","r","a","b"].map(()=>
    `<div class="sk-stat">${skBar("56%","22px",8)}${skBar("80%","10px",6)}</div>`).join("")}</div>`;
  const skelRows=(n=3)=>`<div class="card pad0">${Array.from({length:n}).map(()=>
    `<div class="row"><span class="tx">${skBar("46%","12px")}<div style="height:6px"></div>${skBar("72%","10px")}</span></div>`).join("")}</div>`;
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
    protectNames([...AREAS,...HOSPITALS]);
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
    bloodGroup:"",lastDonation:"",health:"",whatsapp:"",available:true,
    donorId:"",donorStatus:"none",cardTheme:"green",isDonor:false,
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
  function restoreLastPersistedME(){
    if(lastPersistedME)Object.assign(ME,CBDCShared.clone(lastPersistedME));
  }
  async function saveMe(){
    try{
      const t=DB.team.find(x=>x.uid===ME.uid);
      if(t){t.name=ME.name;t.role=ME.role;await persist()}
      /* localStorage এখানে শুধু cache — আসল উৎস RTDB (users/{uid}) */
      if(!ME_PULLING&&ME.uid)await pushMePanel();
      try{localStorage.setItem(ACC_LS,JSON.stringify(ME))}catch(e){}
      lastPersistedME=CBDCShared.clone(ME);
    }catch(error){
      if(lastPersistedME)Object.assign(ME,CBDCShared.clone(lastPersistedME));
      throw error;
    }
  }
  async function logMe(title,detail,type="account"){
    ME.activity.unshift({at:new Date().toISOString(),title,detail,type});
    if(ME.activity.length>60)ME.activity.length=60;
    await await saveMe();
  }

  /* ══════════════════════════════════════════════════════════════
     ME ↔ Realtime Database (RTDB-ই authoritative)
     ══════════════════════════════════════════════════════════════
     অ্যাকাউন্টের profile — নাম, username, মোবাইল, DOB, লিঙ্গ, এলাকা, ঠিকানা,
     পদবি, রক্তের গ্রুপ, শেষ রক্তদান, ছবি — `users/{uid}`-এ সেভ হয় ও সেখান থেকেই
     আসে (Doner প্যানেল ও রেজিস্ট্রেশনের মতো একই canonical উৎস)।
     security/privacy/notif/prefs, সেশন ও কার্যকলাপ যায় `users/{uid}/data/panel`-এ
     (data-র বাকি ভাইবোর — donations/mine/notifs — অক্ষত থাকে)। localStorage
     শুধু দ্রুত first-paint-এর cache; RTDB-তে মান থাকলে সেটিই জেতে, default
     শুধু fallback। */
  let ME_PULLING=false;
  /* RTDB থেকে নিজের users/{uid} রেকর্ড অন্তত একবার পড়া হয়েছে কি না।
     না হলে প্যানেলের local default (খালি prefs/privacy) RTDB-তে লেখা হয় না —
     ফলে অন্য প্যানেল/ডিভাইসে সংরক্ষিত তথ্য overwrite হয়ে যায় না। */
  let ME_HYDRATED=false;
  let lastPersistedME=null;
  const ME_PROFILE_KEYS=["name","username","phone","dob","gender","area","address",
    "designation","bloodGroup","lastDonation","health","whatsapp"];
  /* প্রোফাইল বদল → users/{uid} (owner-ই লিখছে — rules অনুমোদিত) */
  async function pushMeProfile(patch){
    if(!ME.uid)return;
    const clean={};
    ME_PROFILE_KEYS.concat(["email","photo","photoURL"]).forEach(k=>{
      if(patch[k]!==undefined)clean[k]=String(patch[k]).trim()});
    if(!Object.keys(clean).length)return;
    await updateRow(NODES.users,ME.uid,clean);
    await syncAdminDonorPublicRecord(clean);
    /* Admin staff metadata is written only after the canonical profile write. */
    if(ME.role==="admin"&&["name","username","designation"].some(k=>clean[k]!==undefined)){
      const ap={updatedAt:nowIso()};
      ["name","username","designation"].forEach(k=>{if(clean[k]!==undefined)ap[k]=clean[k]});
      await updateRow(NODES.admins,ME.uid,ap);
    }
  }
  /* প্যানেল সেটিংস/সেশন/কার্যকলাপ → users/{uid}/data/panel */
  async function pushMePanel(){
    if(!ME.uid||ME_PULLING||!ME_HYDRATED)return;
    const paths={};
    paths[`users/${ME.uid}/data/panel`]={
      security:ME.security,privacy:ME.privacy,notif:ME.notif,prefs:ME.prefs,
      isDonor:ME.isDonor!==false,
      sessions:(ME.sessions||[]).slice(0,8),
      activity:(ME.activity||[]).slice(0,60)};
    await updatePaths(paths);
  }
  /* users/{uid} row → ME। RTDB-তে খালি মান লোকাল cache-কে override করে না। */
  function applyMeRow(row){
    ME_PULLING=true;
    try{
      if(row&&typeof row==="object"){
        ME_HYDRATED=true;   /* RTDB-র আসল রেকর্ড পাওয়া গেছে — default আর ঢোকানো হবে না */
        ME_PROFILE_KEYS.forEach(k=>{const v=row[k];if(typeof v==="string"&&v.trim()!=="")ME[k]=v});
        if(row.photoURL!==undefined||row.photo!==undefined)
          ME.photo=String(row.photoURL||row.photo||"");
        if(!ME.email&&row.email)ME.email=row.email;
        if(row.joined)ME.joined=row.joined;
        const p=(row.data&&row.data.panel)||{};
        ["security","privacy","notif","prefs"].forEach(k=>{
          if(p[k]&&typeof p[k]==="object")Object.assign(ME[k],p[k])});
        /* Donor state panel preference থেকে অনুমান করা হয় না। users/{uid}-এর
           approved status-ই authoritative, তাই পুরোনো local toggle কোনো
           অসম্পূর্ণ/ভুয়া donor state দেখাতে পারে না। */
        ME.donorId=String(row.donorId||"");
        ME.donorStatus=String(row.donorStatus||"none");
        ME.lastDonation=String(row.lastDonation||"");
        ME.health=String(row.health||"");
        ME.whatsapp=String(row.whatsapp||"");
        ME.available=row.available!==false;
        ME.cardTheme=String(row.cardTheme||"green");
        ME.isDonor=ME.donorStatus==="approved"&&!!ME.donorId;
        if(Array.isArray(p.sessions))ME.sessions=p.sessions.filter(s=>s&&s.id);
        if(Array.isArray(p.activity))ME.activity=p.activity.slice(0,60);
      }
      try{localStorage.setItem(ACC_LS,JSON.stringify(ME))}catch(e){}
    }finally{ME_PULLING=false}
  }
  /* live sync — অন্য ডিভাইস/প্যানেলে নিজের অ্যাকাউন্ট বদলালে সাথে সাথে এখানেও */
  let stopMeWatch=()=>{};
  const ME_SUBS=["account","security","privacy","mynotif","prefs","devices","myactivity","myperm","manage","team"];
  function watchMe(uid){
    stopMeWatch();
    stopMeWatch=watchRow(NODES.users,uid,(row)=>{
      if(String(uid)!==String(ME.uid))return;
      const before=JSON.stringify([ME.name,ME.photo,ME.prefs,ME.sessions.length,ME.activity.length,
        ME.isDonor,ME.donorId,ME.bloodGroup,ME.lastDonation,ME.health,ME.whatsapp,ME.available]);
      applyMeRow(row);
      applyPrefs();
      const after=JSON.stringify([ME.name,ME.photo,ME.prefs,ME.sessions.length,ME.activity.length,
        ME.isDonor,ME.donorId,ME.bloodGroup,ME.lastDonation,ME.health,ME.whatsapp,ME.available]);
      if(after===before)return;
      try{paintTop();paintNav();
        if(!document.querySelector(".sheet")&&ME_SUBS.includes(SUB))go(CUR,SUB,false,ARG)}catch(e){}
    });
  }
  /* এই ডিভাইসের সেশন — লগইনেই তালিকায় বসে যায় ও RTDB-তে থাকে */
  function deviceId(){
    try{let id=localStorage.getItem("cbdc.device");
      if(!id){id="D-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
        localStorage.setItem("cbdc.device",id)}
      return id}catch(e){return"D-this"}
  }
  function thisDeviceName(){
    const u=navigator.userAgent||"";
    const br=/Edg\//.test(u)?"Edge":/OPR\//.test(u)?"Opera":/Chrome\//.test(u)?"Chrome"
      :/Safari\//.test(u)?"Safari":/Firefox\//.test(u)?"Firefox":"Browser";
    const os=/Android/.test(u)?"Android":/iPhone|iPad/.test(u)?"iOS":/Windows/.test(u)?"Windows"
      :/Mac OS/.test(u)?"macOS":/Linux/.test(u)?"Linux":"";
    return br+(os?" · "+os:"");
  }
  function upsertMySession(){
    const id=deviceId();
    ME.sessions=(Array.isArray(ME.sessions)?ME.sessions:[]).map(s=>({...s,cur:false})).filter(s=>s.id!==id);
    ME.sessions.unshift({id,name:thisDeviceName(),place:"এই ডিভাইস",last:"বর্তমানে সক্রিয়",cur:true,at:new Date().toISOString()});
    if(ME.sessions.length>8)ME.sessions.length=8;
  }

  /* ── Team & ভূমিকা — RTDB `admins` node থেকে live ── */
  let stopTeamWatch=()=>{};
  let stopAccountWatch=()=>{}, accountUsers=[], accountAdmins=[];
  function refreshAccounts(){
    const by=new Map();
    (DB.accounts||[]).forEach(a=>by.set(String(a.uid||a.id),{...a}));
    accountUsers.forEach(u=>{const uid=String(u.uid||u.id);if(!uid)return;by.set(uid,{...by.get(uid),...u,uid,role:by.get(uid)?.role||u.role||"user"});});
    accountAdmins.forEach(a=>{const uid=String(a.uid||a.id);if(!uid)return;by.set(uid,{...by.get(uid),...a,uid,role:a.role||by.get(uid)?.role||"mod",permissions:a.permissions||by.get(uid)?.permissions||[]});});
    const nextAccounts=Array.from(by.values()).map(a=>({...a,role:normRole(a.role),phone:a.phone||a.mobile||"",photo:a.photo||a.photoURL||"",status:a.status||"active"}));
    const accountsChanged=JSON.stringify(nextAccounts)!==JSON.stringify(DB.accounts);
    DB.accounts=nextAccounts;
    /* Build the team from the same two listeners. There is deliberately no
       second admins fetch: profile changes in users/{uid} also update the
       existing team row without reloading the database. */
    const users=new Map(accountUsers.map(u=>[String(u.uid||u.id),u]));
    const team=accountAdmins.filter(r=>String(r.status||"")!=="disabled").map(r=>{
      const uid=String(r.uid||r.id),profile=users.get(uid)||{},raw=String(r.role||"").toLowerCase();
      const permissions=Array.isArray(r.permissions)?r.permissions:
        (raw==="admin"?PERMS.slice():ROLES.mod.perms.slice());
      return {uid,name:r.name||profile.name||r.email||profile.email||"—",
        username:r.username||profile.username||"",email:r.email||profile.email||"",
        photo:r.photo||r.photoURL||profile.photo||profile.photoURL||"",
        role:raw==="admin"?"admin":"mod",status:r.status||"active",permissions,
        last:r.updatedAt||r.createdAt||""};
    }).sort((a,b)=>(a.role==="admin"?0:1)-(b.role==="admin"?0:1)
      ||String(a.name).localeCompare(String(b.name),"bn"));
    const teamChanged=JSON.stringify(team)!==JSON.stringify(DB.team);
    if(teamChanged)DB.team=team;
    /* সত্যিকারের পরিবর্তন ছাড়া আবার কোনো কাজ হবে না — বারবার লোডিং/রিলোড নেই */
    if(!accountsChanged&&!teamChanged)return;
    try{paintNav();if(!document.querySelector(".sheet")&&["team","access"].includes(SUB))go(CUR,SUB,false,ARG)}catch(e){}
  }
  function watchAccounts(){
    stopAccountWatch();
    const u=watchList(NODES.users,rows=>{markDataReady("users");
      accountUsers=rows.map(x=>({...x,uid:x.uid||x.id}));refreshAccounts()});
    stopAccountWatch=()=>u();
  }
  function watchTeam(){
    stopTeamWatch();
    stopTeamWatch=watchList(NODES.admins,(rows)=>{
      markDataReady("admins");
      accountAdmins=rows.map(x=>({...x,uid:x.uid||x.id}));
      refreshAccounts();
    });
  }

  /* ── Audit log — RTDB-তে persist (refresh/login-এর পরেও থাকে) ── */
  function pushAudit(e){
    const id="A-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
    return setRow(NODES.audit,id,e);
  }
  let stopAuditWatch=()=>{};
  function watchAudit(){
    stopAuditWatch();
    stopAuditWatch=watchList(NODES.audit,(rows)=>{
      markDataReady("audit");
      const list=rows.map(r=>{
        const raw=String(r.role||"").toLowerCase();
        return {at:r.at||"",who:r.who||"",role:raw==="admin"?"admin":"mod",
          act:r.act||"",target:r.target||"",mod:r.mod||""}})
        .filter(x=>x.at).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,300);
      if(JSON.stringify(list)===JSON.stringify(DB.audit))return;
      DB.audit=list;
      try{if(!document.querySelector(".sheet")&&(SUB==="audit"||(CUR==="home"&&!SUB)))go(CUR,SUB,false,ARG)}catch(e){}
    });
  }

  /* ── Messages/Inbox — RTDB `messages` node থেকে live ── */
  let stopMessagesWatch=()=>{};
  function watchMessages(){
    stopMessagesWatch();
    stopMessagesWatch=watchList(NODES.messages,(rows)=>{
      markDataReady("messages");
      const list=rows.map(r=>({id:r.id,name:r.name||"",phone:r.phone||r.mobile||"",
        text:r.text||r.message||"",read:r.read===true,at:r.at||r.createdAt||""}))
        .filter(x=>x.name||x.text).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
      if(JSON.stringify(list)===JSON.stringify(DB.messages))return;
      DB.messages=list;
      try{paintTop();paintNav();
        if(!document.querySelector(".sheet")&&SUB==="inbox")go(CUR,SUB,false,ARG)}catch(e){}
    });
  }

  /* ── ডোনার প্যানেলের রিপোর্ট/অভিযোগ — RTDB `reports` node থেকে live ──
     ডোনার প্যানেলের "সমস্যা জানান" থেকে আসা রিপোর্ট এখানে realtime-এ দেখা ও
     ব্যবস্থাপনা (সমাধান/মুছুন) করা যায়। অপরিবর্তিত ডেটা এলে আবার render হয়
     না — শুধু সত্যিকারের পরিবর্তনেই প্রয়োজনীয় অংশ আপডেট হয়। */
  let stopReportsWatch=()=>{};
  function watchReports(){
    stopReportsWatch();
    stopReportsWatch=watchList(NODES.reports,(rows)=>{
      markDataReady("reports");
      const list=rows.map(r=>({id:r.id,ownerUid:r.ownerUid||r.uid||"",name:r.name||"",
        username:r.username||"",email:r.email||"",type:r.type||"রিপোর্ট",
        text:r.text||"",screenshot:r.screenshot||"",status:r.status==="resolved"?"resolved":"open",
        createdAt:r.createdAt||r.at||""}))
        .filter(x=>x.text||x.type).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      if(JSON.stringify(list)===JSON.stringify(DB.reports))return;
      DB.reports=list;
      try{paintTop();paintNav();
        if(!document.querySelector(".sheet")&&SUB==="users")renderSub("users")}catch(e){}
    });
  }
  /* replaces the plain object created in the data block */
  ME=Object.assign(loadMe(),{role:ME.role||PANEL.role});
  if(!ROLES[ME.role])ME.role=PANEL.role;
  lastPersistedME=CBDCShared.clone(ME);
  
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
    {id:"security",title:"নিরাপত্তা",desc:"পাসওয়ার্ড, ডিভাইস, কার্যকলাপ",icon:"shield"},
    {id:"privacy",title:"গোপনীয়তা",desc:"কে কী দেখতে পাবে",icon:"eye"},
    {id:"mynotif",title:"বিজ্ঞপ্তি",desc:"কখন জানানো হবে",icon:"bellS"},
    {id:"prefs",title:"পছন্দ",desc:"থিম, প্রদর্শন, শুরুর পাতা",icon:"paint"},
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

  /* ---------- Admin নিজে donor হলে: approval ছাড়া সরাসরি RTDB ----------
     Identity users/{uid}-এর canonical profile থেকেই আসে। Registration কেবল
     ফাঁকা identity field পূরণ করতে পারে; আগে থেকে থাকা নাম/ফোন/DOB/এলাকা কখনো
     overwrite করে না। Donor-specific field এবং public donors/{id} record একই
     multi-location update-এ লেখা হয়, তাই public list/card/profile realtime। */
  const localAdminDonor=()=>DB.donors.find(d=>{
    const owner=String(d.ownerUid||"");
    return owner===String(ME.uid||"")||(!owner&&!!ME.donorId&&String(d.id||"")===String(ME.donorId));
  });
  async function ownAdminDonorRow(){
    if(!ME.uid)return null;
    let row=null;
    try{row=await findBy(NODES.donors,"ownerUid",ME.uid)}catch(e){}
    if(!row&&ME.donorId){
      try{
        const linked=await getRow(NODES.donors,ME.donorId),owner=String(linked&&(linked.ownerUid||linked.uid)||"");
        if(linked&&(!owner||owner===String(ME.uid)))row=linked;
      }catch(e){}
    }
    return row||localAdminDonor()||null;
  }
  function updateLocalAdminDonor(id,data){
    let d=DB.donors.find(x=>{
      const owner=String(x.ownerUid||"");
      return owner===String(ME.uid)||(!owner&&String(x.id||"")===String(id));
    });
    const patch={id,name:data.name,group:data.bloodGroup,area:data.area,phone:data.phone,
      whatsapp:data.whatsapp||"",gender:data.gender,dob:data.dob,last:data.lastDonation||"",
      photo:data.photo||"",ownerUid:ME.uid,available:data.available!==false,
      verified:true,suspended:d?!!d.suspended:false,joined:data.joined||iso(now()),
      donations:d?Number(d.donations)||0:Number(data.donations)||0,
      totalBags:d?Number(d.totalBags)||0:Number(data.totalBags)||0};
    if(d)Object.assign(d,patch);else DB.donors.unshift(patch);
  }
  async function syncAdminDonorPublicRecord(changed={}){
    const publicKeys=["name","gender","dob","area","phone","photo","photoURL","bloodGroup","lastDonation","whatsapp"];
    if(!publicKeys.some(k=>changed[k]!==undefined))return;
    if(!ME.uid||ME.donorStatus!=="approved"||!ME.donorId)return;
    try{
      const row=await ownAdminDonorRow();
      const id=String((row&&(row.id||row.donorId))||"");
      if(!id)return;
      const patch={name:ME.name||"",gender:ME.gender||"",dob:ME.dob||"",area:ME.area||"",
        phone:ME.phone||"",whatsapp:ME.whatsapp||"",lastDonationDate:ME.lastDonation||"",
        available:ME.available!==false,photo:ME.photo||"",bloodGroup:ME.bloodGroup||""};
      await updateRow(NODES.donors,id,patch);
      updateLocalAdminDonor(id,{...patch,lastDonation:ME.lastDonation,joined:(row&&row.joined)||ME.joined});
    }catch(e){console.warn("admin donor public sync:",e&&e.message);throw e}
  }
  function adminDonorForm(page){
    const a=ME,bounds=dobBounds(SITE.rules.minAge,SITE.rules.maxAge);
    const genders=["পুরুষ","মহিলা","অন্যান্য"];
    if(a.gender&&!genders.includes(a.gender))genders.unshift(a.gender);
    const areas=AREAS.slice();if(a.area&&!areas.includes(a.area))areas.unshift(a.area);
    const lock=v=>String(v||"").trim()?"disabled aria-disabled=\"true\"":"";
    const s=sheet("রক্তদাতা হিসেবে যুক্ত হন",`
      <div class="note i">${SI.info(17)}<span>অ্যাকাউন্টে আগে থেকে থাকা পরিচয় অপরিবর্তিত থাকবে। শুধু ফাঁকা তথ্য ও রক্তদাতা-সংক্রান্ত তথ্য যোগ হবে; সংরক্ষণ করলেই সরাসরি অনুমোদিত রক্তদাতা হিসেবে যুক্ত হবেন।</span></div>
      <form id="adf" novalidate>
        <div class="f"><label>নাম <i>*</i></label>
          <input id="ad_name" name="ad_name" value="${esc(a.name||"")}" maxlength="60" ${a.name?"readonly aria-readonly=\"true\"":""}></div>
        <div class="f"><label>লিঙ্গ <i>*</i></label>
          <select id="ad_gender" name="ad_gender" ${lock(a.gender)}><option value="">লিঙ্গ নির্বাচন করুন</option>
            ${genders.map(v=>`<option ${a.gender===v?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="f"><label>জন্ম তারিখ <i>*</i></label>
          <input id="ad_dob" name="ad_dob" type="date" min="${bounds.min}" max="${bounds.max}" value="${esc(a.dob||"")}" ${lock(a.dob)}>
          <span class="hint">বয়স ${SITE.rules.minAge}–${SITE.rules.maxAge} বছর হতে হবে।</span></div>
        <div class="f"><label>এলাকা <i>*</i></label>
          <select id="ad_area" name="ad_area" ${lock(a.area)}><option value="">থানা / এলাকা নির্বাচন করুন</option>
            ${areas.map(v=>`<option ${a.area===v?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="f"><label>মোবাইল নম্বর <i>*</i></label>
          <input id="ad_phone" name="ad_phone" value="${esc(a.phone||"")}" inputmode="numeric" maxlength="11" ${a.phone?"readonly aria-readonly=\"true\"":""}></div>
        <div class="f"><label>রক্তের গ্রুপ <i>*</i></label>
          <select id="ad_group" name="ad_group" ${GROUPS.includes(a.bloodGroup)?"disabled aria-disabled=\"true\"":""}>
            <option value="">রক্তের গ্রুপ নির্বাচন করুন</option>
            ${GROUPS.map(v=>`<option ${a.bloodGroup===v?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="f"><label>সর্বশেষ রক্তদান <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <input id="ad_last" name="ad_last" type="date" max="${iso(now())}" value="${esc(a.lastDonation||"")}"></div>
        <div class="f"><label>স্বাস্থ্য তথ্য <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <textarea id="ad_health" name="ad_health">${esc(a.health||"")}</textarea></div>
        <div class="f"><label>WhatsApp নম্বর <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <input id="ad_wa" name="ad_wa" value="${esc(a.whatsapp||"")}" inputmode="numeric" maxlength="11"></div>
        <label class="chk"><input type="checkbox" id="ad_ok" name="ad_ok">
          <span>আমি নিশ্চিত করছি প্রদত্ত তথ্য সঠিক এবং স্বেচ্ছায় রক্তদানে সম্মত।</span></label>
      </form>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ad_save">সংরক্ষণ</button>`);
    const form=s.q("#adf");attachLiveClear(form);
    s.q("#ad_save").onclick=async()=>{
      const v=validateForm(form,{
        ad_name:{required:true,minLength:2,label:"নাম"},ad_gender:{required:true,label:"লিঙ্গ"},
        ad_dob:{required:true,dob:{min:SITE.rules.minAge,max:SITE.rules.maxAge},label:"জন্ম তারিখ"},
        ad_area:{required:true,label:"এলাকা"},
        ad_phone:{required:true,custom:x=>phoneOK(x)?"":"১১ সংখ্যার সঠিক মোবাইল নম্বর দিন",label:"মোবাইল নম্বর"},
        ad_group:{required:true,label:"রক্তের গ্রুপ"},
        ad_last:{custom:x=>!x||dayDiff(x)>=0?"":"ভবিষ্যতের তারিখ দেওয়া যাবে না"},
        ad_wa:{custom:x=>!x||phoneOK(x)?"":"সঠিক ১১ সংখ্যার নম্বর দিন"},ad_ok:{checked:true}
      });
      if(!v.ok)return;
      const btn=s.q("#ad_save");btn.disabled=true;btn.textContent="সংরক্ষণ হচ্ছে…";
      try{
        const authUid=String((getAuthInstance()&&getAuthInstance().currentUser&&getAuthInstance().currentUser.uid)||"");
        const uid=String(ME.uid||"");
        if(!uid||authUid!==uid)throw new Error("অ্যাডমিন লগইন সেশন পাওয়া যায়নি");
        const current=(await getRow(NODES.users,uid))||{};
        const submitted={name:s.q("#ad_name").value.trim(),gender:s.q("#ad_gender").value,
          dob:s.q("#ad_dob").value,area:s.q("#ad_area").value,phone:s.q("#ad_phone").value.trim()};
        const existingValue=k=>String(current[k]||ME[k]||"").trim();
        const identity={};["name","gender","dob","area","phone"].forEach(k=>identity[k]=existingValue(k)||submitted[k]);
        if(identity.name.length<2||!phoneOK(identity.phone)||!isValidDob(identity.dob))
          throw new Error("অ্যাকাউন্টের প্রয়োজনীয় তথ্য সঠিক নয়");
        const savedGroups=[current.bloodGroup,current.group,current.blood_group,current.data&&current.data.bloodGroup,ME.bloodGroup]
          .map(x=>String(x||"").trim());
        const bloodGroup=savedGroups.find(x=>GROUPS.includes(x))||s.q("#ad_group").value;
        if(!GROUPS.includes(bloodGroup))throw new Error("সঠিক রক্তের গ্রুপ নির্বাচন করুন");
        const lastDonation=s.q("#ad_last").value||"",health=s.q("#ad_health").value.trim()||"";
        const whatsapp=s.q("#ad_wa").value.trim()||"";
        let donor=await ownAdminDonorRow();
        let donorId=String((donor&&(donor.id||donor.donorId))||current.donorId||ME.donorId||"");
        if(!donor&&donorId){
          const linked=await getRow(NODES.donors,donorId),owner=String(linked&&(linked.ownerUid||linked.uid)||"");
          if(linked&&owner&&owner!==uid)donorId="";
        }
        if(!donorId)donorId=await nextDonorId();
        const isNew=!donor;
        const at=nowIso(),joined=String((donor&&donor.joined)||current.joined||ME.joined||iso(now()));
        const photo=String(current.photoURL||current.photo||ME.photo||"");
        const paths={};
        /* Existing identity wins. কেবল database-এ ফাঁকা field-ই পূরণ করা হয়। */
        ["name","gender","dob","area","phone"].forEach(k=>{
          if(!String(current[k]||"").trim())paths[`users/${uid}/${k}`]=identity[k]});
        paths[`users/${uid}/bloodGroup`]=bloodGroup;
        paths[`users/${uid}/donorStatus`]="approved";
        paths[`users/${uid}/donorId`]=donorId;
        paths[`users/${uid}/lastDonation`]=lastDonation;
        paths[`users/${uid}/health`]=health;
        paths[`users/${uid}/whatsapp`]=whatsapp;
        paths[`users/${uid}/available`]=true;
        paths[`users/${uid}/appliedAt`]=at.slice(0,10);
        paths[`users/${uid}/cardTheme`]=String(current.cardTheme||ME.cardTheme||"green");
        paths[`users/${uid}/data/panel/isDonor`]=true;
        const base=`donors/${donorId}`;
        Object.entries({id:donorId,donorId,uid,ownerUid:uid,name:identity.name,bloodGroup,
          gender:identity.gender,dob:identity.dob,phone:identity.phone,whatsapp,area:identity.area,
          lastDonationDate:lastDonation,status:"approved",available:true,verified:true,
          joined,photo,updatedAt:at}).forEach(([k,val])=>paths[`${base}/${k}`]=val);
        if(isNew){
          /* Creating a donor record never counts an unverified "last donation";
             donation totals are increased only by an approved donation. */
          paths[`${base}/suspended`]=false;paths[`${base}/donations`]=0;
          paths[`${base}/totalDonations`]=0;paths[`${base}/totalBags`]=0;paths[`${base}/createdAt`]=at;
        }
        /* আগে সাধারণ donor হিসেবে pending আবেদন থাকলে Admin flow সেটি সরাসরি
           approved করে; moderation queue-তে নিজের জন্য কিছু রেখে দেয় না। */
        DB.queue.filter(q=>q.kind==="donor"&&String(q.ownerUid||"")===uid).forEach(q=>{
          paths[`queue/${q.id}`]=null;
          if(q.memberId){paths[`members/${q.memberId}/status`]="approved";paths[`members/${q.memberId}/donorId`]=donorId;}
        });
        const memberId=String(current.donorMemberId||"");
        if(memberId){
          paths[`members/${memberId}/status`]="approved";paths[`members/${memberId}/donorId`]=donorId;
          paths[`queue/${memberId}`]=null;
        }
        paths[`queue/PD-${uid.replace(/[^A-Za-z0-9]/g,"").slice(-40)}`]=null;
        await updatePaths(paths);
        Object.assign(ME,identity,{bloodGroup,lastDonation,health,whatsapp,available:true,
          donorId,donorStatus:"approved",cardTheme:String(current.cardTheme||ME.cardTheme||"green"),isDonor:true});
        updateLocalAdminDonor(donorId,{...identity,bloodGroup,lastDonation,whatsapp,available:true,photo,joined,
          donations:isNew?0:Number(donor&&donor.donations)||0,totalBags:isNew?0:Number(donor&&donor.totalBags)||0});
        DB.queue=DB.queue.filter(q=>!(q.kind==="donor"&&String(q.ownerUid||"")===uid));
        await logMe("রক্তদাতা হিসেবে যুক্ত হয়েছেন",donorId,"donor");
        await logAudit("অ্যাডমিন রক্তদাতা হিসেবে যুক্ত",donorId,"donor");
        s.close();renderSub(page);toast("রক্তদাতা তথ্য সংরক্ষণ হয়েছে","ok");
      }catch(e){
        console.warn("admin donor save:",e&&e.message);
        btn.disabled=false;btn.textContent="সংরক্ষণ";
        toast(e&&e.message?e.message:"রক্তদাতা তথ্য সংরক্ষণ করা যায়নি","er");
      }
    };
  }
  async function removeAdminDonor(page){
    if(!await confirmS({title:"ডোনার তালিকা থেকে সরে যাবেন?",
      desc:"অ্যাকাউন্ট ও অ্যাডমিন প্রোফাইল থাকবে; শুধু ডোনার তথ্য ও পাবলিক কার্ড সরে যাবে।",ok:"সরে যান",danger:true}))return;
    try{
      const uid=String(ME.uid||""),authUid=String((getAuthInstance()&&getAuthInstance().currentUser&&getAuthInstance().currentUser.uid)||"");
      if(!uid||authUid!==uid)throw new Error("অ্যাডমিন লগইন সেশন পাওয়া যায়নি");
      const donor=await ownAdminDonorRow(),id=String((donor&&(donor.id||donor.donorId))||"");
      const paths={};if(id)paths[`donors/${id}`]=null;
      ["donorStatus","donorId","lastDonation","health","whatsapp","available","appliedAt","cardTheme","groupChange"]
        .forEach(k=>paths[`users/${uid}/${k}`]=null);
      paths[`users/${uid}/data/panel/isDonor`]=false;
      DB.queue.filter(q=>q.kind==="donor"&&String(q.ownerUid||"")===uid).forEach(q=>paths[`queue/${q.id}`]=null);
      paths[`queue/PD-${uid.replace(/[^A-Za-z0-9]/g,"").slice(-40)}`]=null;
      await updatePaths(paths);
      DB.donors=DB.donors.filter(d=>String(d.ownerUid||"")!==uid&&String(d.id||"")!==id);
      DB.queue=DB.queue.filter(q=>!(q.kind==="donor"&&String(q.ownerUid||"")===uid));
      Object.assign(ME,{isDonor:false,donorStatus:"none",donorId:"",lastDonation:"",health:"",whatsapp:"",available:true});
      await logMe("ডোনার তালিকা থেকে সরে গেছেন",id||"নিজের প্রোফাইল","donor");
      await logAudit("অ্যাডমিন ডোনার তালিকা থেকে সরে গেছেন",id||ME.name,"donor");
      renderSub(page);toast("ডোনার তালিকা থেকে সরানো হয়েছে","ok");
    }catch(e){console.warn("admin donor remove:",e&&e.message);toast("ডোনার তথ্য সরানো যায়নি","er")}
  }
  async function setAdminDonorAvailability(next,page){
    try{
      const donor=await ownAdminDonorRow(),id=String((donor&&(donor.id||donor.donorId))||"");
      if(!ME.uid||!id)throw new Error("ডোনার রেকর্ড পাওয়া যায়নি");
      await updatePaths({[`users/${ME.uid}/available`]:next,[`donors/${id}/available`]:next});
      ME.available=next;const local=localAdminDonor();if(local)local.available=next;
      await await saveMe();renderSub(page);toast(next?"প্রাপ্যতা চালু করা হয়েছে":"প্রাপ্যতা বন্ধ করা হয়েছে",next?"ok":"");
    }catch(e){console.warn("admin donor availability:",e&&e.message);toast("প্রাপ্যতা বদলানো যায়নি","er")}
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
        ${ME.isDonor?`<div class="row"><span class="tx"><b>ডোনার অবস্থা</b><small>${esc(ME.donorId)}</small></span>
          <span class="rt"><span class="tag g">অনুমোদিত</span></span></div>`:""}
        ${ME.isDonor?sRow("রক্তের গ্রুপ",ME.bloodGroup,"editBlood"):""}
        ${ME.isDonor?sRow("সর্বশেষ রক্তদান",ME.lastDonation?dL(ME.lastDonation):"তথ্য নেই","editLastD"):""}
        ${ME.isDonor?sRow("WhatsApp",ME.whatsapp||"দেওয়া হয়নি","editDonorWa"):""}
        ${ME.isDonor?sRow("স্বাস্থ্য তথ্য",ME.health||"দেওয়া হয়নি","editDonorHealth"):""}
        ${ME.isDonor?tgRow("আমি এখন রক্তদানে প্রস্তুত","বন্ধ করলে পাবলিক সার্চে দেখাবে না","available"):""}
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
      <div class="note w">${SI.warn(17)}<span>পাসওয়ার্ড কারও সাথে ভাগ করবেন না।
        ${tp("আপনার ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয়।","Your role is set from the database.")}</span></div>`;
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
        ${tgRow("টিম তালিকায় আমাকে দেখান","বন্ধ করলে শুধু অ্যাডমিন দেখবেন","privacy.showInTeam")}
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
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=async()=>{
      ME.prefs.dense=b.dataset.dn==="1";await saveMe();applyPrefs();paintTop();paintNav();renderSub("prefs")});
    el.querySelectorAll("[data-lg]").forEach(b=>b.onclick=async()=>{
      if(ME.prefs.lang===b.dataset.lg)return;
      ME.prefs.lang=b.dataset.lg;await saveMe();applyLang();
      toast(isEN()?"Language changed to English":"ভাষা বাংলা করা হয়েছে","ok")});
  };
  
  /* আলাদা permission তালিকা আর নেই — শুধু বর্তমান ভূমিকা দেখায়।
     (ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না।) */
  SUBP.myperm=el=>{
    el.innerHTML=`<div class="card">
        <div class="per"><span class="bg2" style="width:46px;height:46px;border-radius:50%;
          background:var(--grn-s);color:var(--grn);font-size:1.1rem">${ROLES[ME.role].icon}</span>
          <div class="i"><b>${esc(ME.name)}</b><small>${ROLES[ME.role].label}</small></div></div>
        <p class="hint2" style="margin-top:10px" data-noi18n>${tp(
          "ভূমিকা ডেটাবেজ থেকে নির্ধারিত হয় — নিজে বদলানো যায় না। কিছু দরকার হলে অ্যাডমিনকে বলুন।",
          "Your role is set from the database and cannot be changed by you. Ask an admin if you need more access.")}</p></div>`;
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
        "অ্যাডমিন অ্যাকাউন্ট নিজে থেকে মুছে ফেলা যায় না — শেষ অ্যাডমিন হারিয়ে গেলে পুরো সিস্টেম আটকে যাবে। অ্যাডমিনকে বলুন।",
        "An admin account cannot delete itself — losing the last admin would lock the whole system. Ask an admin.")}</span></div>`;
    bindMe(el,"manage");
  };
  
  /* ---------- one binder for every account page ---------- */
  function bindMe(el,page){
    el.querySelectorAll("[data-tgl]").forEach(b=>b.onclick=async()=>{
      const p=b.dataset.tgl.split("."),o=p.slice(0,-1).reduce((x,k)=>x[k],ME),k=p[p.length-1];
      /* Admin donor control কোনো local preference নয়। ON → পূর্ণ form + direct
         approved RTDB write; OFF → donor record সরিয়ে account অক্ষত রাখা। */
      if(k==="isDonor"){
        if(ME.isDonor)await removeAdminDonor(page);else adminDonorForm(page);
        return;
      }
      if(k==="available"&&ME.isDonor){await setAdminDonorAvailability(ME.available===false,page);return;}
      o[k]=!o[k];b.classList.toggle("on",o[k]);b.setAttribute("aria-checked",o[k]);
      await saveMe();applyPrefs();
      /* anything that changes the shell must repaint it */
      if(p[0]==="prefs"){paintTop();paintNav()}
      toast(o[k]?"চালু করা হয়েছে":"বন্ধ করা হয়েছে",o[k]?"ok":"");
      if(k==="dense"||k==="anim")renderSub(page);
    });
    el.querySelectorAll("[data-pv]").forEach(s=>s.onchange=async()=>{
      ME.privacy[s.dataset.pv]=s.value;await saveMe();toast("সংরক্ষিত","ok")});
    el.querySelectorAll("[data-pv2]").forEach(s=>s.onchange=async()=>{
      ME.prefs[s.dataset.pv2]=s.value;await saveMe();toast("সংরক্ষিত","ok")});
    el.querySelectorAll("[data-th]").forEach(b=>b.onclick=async()=>{
      ME.prefs.theme=b.dataset.th;await saveMe();applyPrefs();renderSub(page)});
    el.querySelectorAll("[data-kick]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"এই ডিভাইস বের করবেন?",desc:"ওই ডিভাইসে আবার লগইন করতে হবে।",danger:true}))return;
      ME.sessions=ME.sessions.filter(x=>x.id!==b.dataset.kick);
      await logMe("ডিভাইস বের করা হয়েছে","একটি সেশন বন্ধ","security");await saveMe();renderSub("devices");
      toast("ডিভাইস বের করা হয়েছে","ok")});
    el.querySelectorAll("[data-act]").forEach(b=>b.onclick=async()=>await meAction(b.dataset.act,page));
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
  async function meAction(a,page){
    const back=async()=>{await await saveMe();renderSub(page);paintTop()};
    const askText=(title,label,val,ok,opts={})=>{
      const s=sheet(title,`<div class="f"><label>${esc(label)}</label>
        ${opts.type==="date"?`<input id="mi" type="date" value="${esc(val||"")}" max="${iso(now())}">`
          :opts.type==="select"?`<select id="mi">${opts.options.map(o=>
            `<option ${o===val?"selected":""}>${esc(o)}</option>`).join("")}</select>`
          :opts.type==="textarea"?`<textarea id="mi" rows="3">${esc(val||"")}</textarea>`
          :`<input id="mi" value="${esc(val||"")}" ${opts.max?`maxlength="${opts.max}"`:""}
             ${opts.mode?`inputmode="${opts.mode}"`:""}>`}
        </div>${opts.hint?`<p class="hint2" style="margin-top:8px">${esc(opts.hint)}</p>`:""}`,
        `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="mok">সংরক্ষণ</button>`);
      s.q("#mok").onclick=async()=>{const v=s.q("#mi").value.trim();try{if(await ok(v,s)!==false)s.close()}catch(e){restoreLastPersistedME();toast("তথ্য সংরক্ষণ করা যায়নি","er")}};
      return s;
    };
    if(a==="editName")askText("নাম বদলান","পুরো নাম",ME.name,async v=>{
      if(v.length<3){toast("নাম খুব ছোট","er");return false}
      ME.name=v;await await pushMeProfile({name:v});await await logMe("নাম পরিবর্তন",v);await back();toast("নাম হালনাগাদ হয়েছে","ok")});
    if(a==="editUser")askText("Username বদলান","Username",ME.username,async v=>{
      if(!/^[a-z0-9._]{3,20}$/.test(v)){toast("৩–২০ অক্ষর, ছোট হাতের ইংরেজি/সংখ্যা","er");return false}
      ME.username=v;await await pushMeProfile({username:v});await await logMe("Username পরিবর্তন","@"+v);await back();toast("হালনাগাদ হয়েছে","ok")},
      {hint:"ছোট হাতের ইংরেজি অক্ষর, সংখ্যা, . ও _ ব্যবহার করা যাবে"});
    if(a==="editMail")askText("ইমেইল বদলান","ইমেইল",ME.email,async v=>{
      if(!/^\S+@\S+\.\S+$/.test(v)){toast("সঠিক ইমেইল দিন","er");return false}
      ME.email=v;ME.emailVerified=false;await await pushMeProfile({email:v});await await logMe("ইমেইল পরিবর্তন",v,"security");await back();
      toast("ইমেইল বদলেছে — যাচাই করতে হবে")},
      {hint:"নতুন ইমেইলে একটি যাচাই লিংক পাঠানো হবে।"});
    if(a==="editPhone")askText("মোবাইল বদলান","মোবাইল নম্বর",ME.phone,async v=>{
      if(!phoneOK(v)){toast("সঠিক নম্বর দিন (০১…, ১১ সংখ্যা)","er");return false}
      ME.phone=v;ME.phoneVerified=false;await await pushMeProfile({phone:v});await await logMe("মোবাইল পরিবর্তন",v,"security");await back();
      toast("নম্বর হালনাগাদ হয়েছে","ok")},{max:11,mode:"numeric"});
    if(a==="editDob")askText("জন্মতারিখ","জন্মতারিখ",ME.dob,async v=>{
      ME.dob=v;await await pushMeProfile({dob:v});await await logMe("জন্মতারিখ হালনাগাদ",v?dL(v):"—");await back();toast("সংরক্ষিত","ok")},{type:"date"});
    if(a==="editGender")askText("লিঙ্গ","লিঙ্গ",ME.gender,async v=>{
      ME.gender=v;await await pushMeProfile({gender:v});await await logMe("লিঙ্গ হালনাগাদ",v);await back();toast("সংরক্ষিত","ok")},
      {type:"select",options:["পুরুষ","মহিলা"]});
    if(a==="editArea")askText("এলাকা","এলাকা",ME.area,async v=>{
      ME.area=v;await await pushMeProfile({area:v});await await logMe("এলাকা হালনাগাদ",v);await back();toast("সংরক্ষিত","ok")},
      {type:"select",options:AREAS});
    if(a==="editAddr")askText("ঠিকানা","সম্পূর্ণ ঠিকানা",ME.address,async v=>{
      ME.address=v;await await pushMeProfile({address:v});await await logMe("ঠিকানা হালনাগাদ",v||"—");await back();toast("সংরক্ষিত","ok")},
      {type:"textarea",hint:"পাবলিক তালিকায় সম্পূর্ণ ঠিকানা কখনো দেখানো হয় না।"});
    if(a==="editDesig")askText("পদবি","সংগঠনে আপনার পদবি",ME.designation,async v=>{
      ME.designation=v;await await pushMeProfile({designation:v});await await logMe("পদবি হালনাগাদ",v||"—");await back();toast("সংরক্ষিত","ok")});
    if(a==="editBlood")askText("রক্তের গ্রুপ","রক্তের গ্রুপ",ME.bloodGroup,async v=>{
      ME.bloodGroup=v;await await pushMeProfile({bloodGroup:v});await await logMe("রক্তের গ্রুপ হালনাগাদ",v,"donor");await back();toast("সংরক্ষিত","ok")},
      {type:"select",options:GROUPS});
    if(a==="editLastD")askText("সর্বশেষ রক্তদান","তারিখ",ME.lastDonation,async v=>{
      ME.lastDonation=v;await await pushMeProfile({lastDonation:v});await await logMe("রক্তদানের তারিখ হালনাগাদ",v?dL(v):"—","donor");await back();toast("সংরক্ষিত","ok")},
      {type:"date"});
    if(a==="editDonorWa")askText("WhatsApp নম্বর","WhatsApp নম্বর",ME.whatsapp,async v=>{
      if(v&&!phoneOK(v)){toast("সঠিক নম্বর দিন (০১…, ১১ সংখ্যা)","er");return false}
      ME.whatsapp=v;await await pushMeProfile({whatsapp:v});await await logMe("WhatsApp নম্বর হালনাগাদ",v||"—","donor");await back();toast("সংরক্ষিত","ok")},
      {max:11,mode:"numeric"});
    if(a==="editDonorHealth")askText("স্বাস্থ্য তথ্য","স্বাস্থ্য সম্পর্কিত সংক্ষিপ্ত তথ্য",ME.health,async v=>{
      if(v.length>300){toast("সর্বোচ্চ ৩০০ অক্ষর লিখুন","er");return false}
      ME.health=v;await await pushMeProfile({health:v});await await logMe("স্বাস্থ্য তথ্য হালনাগাদ",v||"—","donor");await back();toast("সংরক্ষিত","ok")},
      {type:"textarea"});
  
    if(a==="editPass"){
      const s=sheet("পাসওয়ার্ড বদলান",`<div class="f">
        <label>বর্তমান পাসওয়ার্ড</label><input id="p0" type="password">
        <label>নতুন পাসওয়ার্ড</label><input id="p1" type="password" minlength="6">
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
        /* Google-only অ্যাকাউন্টে বর্তমান পাসওয়ার্ড থাকবে না — authx পরিচালনা করে */
        if(p1.length<6)return toast("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর","er");
        if(p1!==p2)return toast("দুটি পাসওয়ার্ড মিলছে না","er");
        try{
          await panelChangePassword(p0,p1);
          ME.security.passwordChangedAt=iso(now());
          await logMe("পাসওয়ার্ড পরিবর্তন","এই ডিভাইস থেকে","security");
          s.close();renderSub("security");toast("পাসওয়ার্ড বদলানো হয়েছে","ok");
        }catch(e){
          toast(authErrorMessage(e,{wrongCredentials:"বর্তমান পাসওয়ার্ড সঠিক নয়",fallback:"পাসওয়ার্ড পরিবর্তন করা যায়নি"}),"er");
        }};
    }
    if(a==="photo"){
      const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
      inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
        if(f.size>5*1024*1024)return toast("ছবি ৫ MB-র কম হতে হবে","er");
        try{
          /* ছবি ImgBB-তে upload → পাওয়া linkটাই প্রোফাইলে সেভ */
          const res=await imgbbUploadImage(f);
          ME.photo=res.url;ME.photoSource="upload";
          await pushMeProfile({photo:res.url,photoURL:res.url});
          await logMe("প্রোফাইল ছবি বদলানো হয়েছে","");await back();toast("ছবি হালনাগাদ হয়েছে","ok");
        }catch(e){toast(e&&e.message?e.message:"ছবি আপলোড করা যায়নি","er")}
      };
      inp.click();
    }
    if(a==="photoRm"){ME.photo="";ME.photoSource="";
      await pushMeProfile({photo:"",photoURL:""});
      await logMe("প্রোফাইল ছবি সরানো হয়েছে","");
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
      await logMe("নিজের তথ্য নামানো হয়েছে","JSON");toast("ফাইল নামছে","ok");
    }
    if(a==="forgotPass")sheetForgot();
    if(a==="delMe")sheetDeleteMe();
    if(a==="pol_terms"||a==="pol_privacy"||a==="pol_donate")sheetPolicy(a);
    if(a==="logout")doLogout();
    if(a==="logoutAll")confirmS({title:"সব ডিভাইস থেকে লগআউট?",
      desc:"এই ডিভাইস ছাড়া বাকি সব সেশন বন্ধ হবে।",danger:true}).then(async y=>{
      if(!y)return;ME.sessions=ME.sessions.filter(s=>s.cur);
      await logMe("সব ডিভাইস থেকে লগআউট","","security");await saveMe();
      renderSub(page==="devices"?"devices":page);toast("বাকি সব সেশন বন্ধ হয়েছে","ok")});
    if(a==="resetMe")confirmS({title:"আমার সেটিংস রিসেট?",
      desc:"নাম, ছবি, গোপনীয়তা ও পছন্দ ডিফল্ট অবস্থায় ফিরবে। কাজের ডেটা মুছবে না।",danger:true}).then(async y=>{
      if(!y)return;
      /* আইডেন্টিটি (নাম, ছবি, ইমেইল…) RTDB users/{uid}-এ canonical — মুছবে না;
         শুধু সেটিংস/সেশন/কার্যকলাপ ডিফল্টে ফেরে ও RTDB-তে সেটাই সেভ হয় */
      const keep={uid:ME.uid,role:ME.role,permissions:ME.permissions,name:ME.name,username:ME.username,
        email:ME.email,phone:ME.phone,gender:ME.gender,dob:ME.dob,area:ME.area,address:ME.address,
        photo:ME.photo,photoSource:ME.photoSource,designation:ME.designation,joined:ME.joined,
        bloodGroup:ME.bloodGroup,lastDonation:ME.lastDonation,health:ME.health,whatsapp:ME.whatsapp,
        available:ME.available,donorId:ME.donorId,donorStatus:ME.donorStatus,
        cardTheme:ME.cardTheme,isDonor:ME.isDonor};
      ME=Object.assign(defaultMe(),keep);
      upsertMySession();await saveMe();applyPrefs();
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
  /* Firebase Authentication — change password (re-auth + updatePassword)।
     Google-only অ্যাকাউন্টে পাসওয়ার্ড না থাকলে একই UID-তে password লিংক হয়। */
  async function panelChangePassword(currentPassword,newPassword){
    const shared=initSharedFirebase();
    const user=shared.auth && shared.auth.currentUser;
    if(!user)throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
    const email=user.email||ME.email;
    if(!email)throw new Error("এই অ্যাকাউন্টে ইমেইল নেই।");
    await setOrChangePassword(user, email, currentPassword, newPassword);
  }
  /* পাসওয়ার্ড ভুলে গেলে — সাইটের আলাদা full-page UI (/forgot-password)।
     সেখান থেকেই Firebase-এর built-in reset link পাঠানো হয়; কোনো custom OTP নেই। */
  function sheetForgot(){
    try{ window.location.assign(appBase()+"forgot-password"); }catch(e){ navigateToPage("home"); }
  }
  /* ---------- delete my own admin account ----------
     A staff account is never deleted silently: the last admin must stay,
     and every request is written to the audit trail for the rest of the team. */
  function sheetDeleteMe(){
    const isAdminAccount=ME.role==="admin";
    const s=sheet("অ্যাকাউন্ট মুছে ফেলুন",
      isAdminAccount
      ? `<div class="note r">${SI.warn(17)}<span>আপনি <b>অ্যাডমিন</b>।
          আপনার অ্যাকাউন্ট মুছে ফেললে পুরো সিস্টেম নিয়ন্ত্রণহীন হয়ে যাবে।
          নিজের অ্যাডমিন অ্যাক্সেস নিজে মুছতে পারবেন না।</span></div>`
      : `<div class="note r">${SI.warn(17)}<span>অনুরোধ করার পর <b>২৪ ঘণ্টার মধ্যে</b> অ্যাকাউন্ট এবং
          অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা মুছে যাবে। এটি ফেরানো যাবে না।</span></div>
        <b style="display:block;margin:14px 0 6px;font-size:.86rem">যা মুছে যাবে</b>
        <p class="mut" style="font-size:.81rem;margin-bottom:12px">আপনার প্রোফাইল ও ব্যক্তিগত তথ্য ·
          লগইন ও ডিভাইসের তালিকা · আপনার ব্যক্তিগত পছন্দ ও বিজ্ঞপ্তির সেটিংস</p>
        <b style="display:block;margin-bottom:6px;font-size:.86rem">যা থাকবে</b>
        <p class="mut" style="font-size:.81rem;margin-bottom:14px">আপনার করা অনুমোদন ও অডিট লগ (নাম ছাড়া) —
          কারণ এগুলো ক্লাবের কাজের রেকর্ডের অংশ</p>
        <div class="f"><label>নিশ্চিত করতে <b style="color:var(--red)">মুছে ফেলুন</b> লিখুন</label>
          <input id="dmt" autocapitalize="off"></div>`,
      isAdminAccount
      ? `<button class="btn" data-close style="flex:1">বুঝেছি</button>`
      : `<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="dmok">অনুরোধ পাঠান</button>`);
    if(isAdminAccount)return;
    s.q("#dmok").onclick=async()=>{
      if(s.q("#dmt").value.trim()!=="মুছে ফেলুন")return toast('হুবহু "মুছে ফেলুন" লিখুন',"er");
      await logMe("অ্যাকাউন্ট মুছে ফেলার অনুরোধ","২৪ ঘণ্টার মধ্যে কার্যকর","security");
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
    "audit.view":"অডিট লগ দেখা","data.export":"তথ্য রপ্তানি","database.manage":"ডেটাবেস ব্যবস্থাপনা"
  };
  
  /* ══════════════════ SCREEN 1: HOME ══════════════════ */
  RENDER.home=()=>{
    const el=$("#s-home");
    const hr=new Date().getHours();
    const greet=tp(hr<12?"শুভ সকাল":hr<17?"শুভ দুপুর":hr<20?"শুভ সন্ধ্যা":"শুভ রাত্রি",
      hr<12?"Good morning":hr<17?"Good afternoon":hr<20?"Good evening":"Good night");
    /* ── Loading/Skeleton: Firebase RTDB-র প্রথম snapshot আসার আগে কোনো
       পরিসংখ্যান দেখানো হয় না (ভুল "০" নয়)। ডেটা এলেই listener-এর মাধ্যমে
       আসল সংখ্যা বসে — কোনো reload/রি-ফেচ নয়। ── */
    if(!statsReady()){
      el.innerHTML=ptitle(greet+", "+String(ME.name||"").split(" ")[0],
        tp("তথ্য লোড হচ্ছে…","Loading data…"))
        +skelStats()
        +`<div class="sec-t">যা এখনই দেখা দরকার</div>`+skelRows(2)
        +`<div class="sec-t">দ্রুত কাজ</div>`+skelCard(2)
        +`<div class="sec-t">রক্তের ভাণ্ডার</div>`+skelCard(3)
        +`<div class="sec-t">গত ৭ দিনের রক্তদান</div>`+skelCard(2)
        +`<div class="sec-t">সাম্প্রতিক কাজ</div>`+skelRows(3);
      return;
    }
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
  
    /* বাস্তব সংখ্যা — ঐ দিনে সত্যিই যত রক্তদান রেকর্ড আছে (কোনো random নয়) */
    const week=[...Array(7)].map((_,i)=>{const d=addD(new Date(),i-6);
      return {d,v:DB.donors.filter(x=>x.last===d).length}});
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
        <button class="btn gh sm" data-goto="set" data-goto-sub="database">${SI.db(15)} ডেটাবেস</button>
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
    el.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>go(b.dataset.goto,b.dataset.gotoSub||null));
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
      $("#skOk").onclick=async()=>{ await bulkDo(true); };
      $("#skNo").onclick=async()=>{ await bulkDo(false); };
    }
  };
  function wkItem(q){
    const k=QK[q.kind],urg=q.kind==="request"&&q.urgency==="অতিজরুরি",sel=wSel.has(q.id);
    const meta={donor:`${q.group} · ${q.area} · ${ageText(q)}`,
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
  async function bulkDo(ok){
    if(!can("donor.approve"))return toast("আপনার অনুমতি নেই","er");
    if(!ok)return rejectSheet([...wSel],()=>{wSel.clear();RENDER.work()});
    const n=wSel.size;
    /* Serial Donor UID হিসাবের জন্য সব approve সম্পূর্ণ হওয়া পর্যন্ত অপেক্ষা */
    const results=await Promise.all([...wSel].map(id=>decide(id,true,"",true)));
    if(results.some(result=>result!==true))return toast("এক বা একাধিক পরিবর্তন RTDB-তে সংরক্ষণ করা যায়নি","er");
    try{await persist();}
    catch(e){return toast("পরিবর্তন RTDB-তে সংরক্ষণ করা যায়নি — সফলতা দেখানো হয়নি","er");}
    wSel.clear();RENDER.work();paintNav();paintTop();
    toast(bn(n)+"টি অনুমোদন করা হয়েছে","ok");
  }
  function reviewWarning(q){
    const w=[];
    if(q.kind==="donor"){
      /* বয়স জন্ম তারিখ থেকে হিসাব হয় — আবেদনের সময় যা-ই হোক, যাচাইয়ের দিন যা, সেটাই */
      const qAge=ageFromDob(q.dob);
      if(qAge===null)w.push("জন্ম তারিখ দেওয়া হয়নি বা সঠিক নয়");
      else if(qAge<DB.rules.minAge)w.push(`বয়স ${bn(qAge)} — নিয়ম অনুযায়ী কমপক্ষে ${bn(DB.rules.minAge)} বছর`);
      else if(qAge>DB.rules.maxAge)w.push(`বয়স ${bn(qAge)} — সর্বোচ্চ ${bn(DB.rules.maxAge)} বছর`);
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
      donor:[["নাম",q.name],["রক্তের গ্রুপ",q.group],["এলাকা",q.area],["জন্ম তারিখ",q.dob?dL(q.dob):"—"],["বয়স",ageText(q)],
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
    const may = q.kind==="donor" ? can("donor.approve")
      : q.kind==="request" ? can("request.approve")
      : q.kind==="donation" ? can("donation.verify")
      : q.kind==="group" ? can("group.approve")
      : can("report.resolve");
    const s=sheet(k.t,`
      <div class="per"><span class="bg2" style="width:44px;height:44px;border-radius:12px">${q.group||SI[k.ic](20)}</span>
        <div class="i"><b>${esc(q.name||q.patient)}</b><small>${q.id} · ${timeAgo(q.at)}</small></div></div>
      ${w.length?`<div class="sec-t" style="color:var(--amb)">সতর্কতা</div>
        <ul class="wl">${w.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
      <div class="sec-t">বিস্তারিত</div>
      <div class="kv">${rows.map(([a,b])=>`<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("")}</div>
      ${q.kind==="group"&&q.proof?`<div class="sec-t">রিপোর্ট / প্রমাণ ছবি</div>
        <a href="${esc(q.proof)}" target="_blank" rel="noopener"><img src="${esc(q.proof)}" alt="রক্তের গ্রুপের প্রমাণ ছবি"
          style="width:100%;max-height:280px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:var(--card2)"></a>`:""}
      ${q.kind==="request"?matchBlock(q.group):""}
      <p class="hint2" style="margin-top:12px">${can("contact.reveal")
        ?"নম্বর দেখা হয়েছে — এটি অডিট লগে থেকে যাবে।":"ফোন নম্বর দেখার অনুমতি আপনার নেই।"}</p>
      ${may?`<div class="sec-t">সিদ্ধান্তের নোট (ঐচ্ছিক)</div>
        <textarea id="rv_note" rows="2"></textarea>`:""}`,
      may?`<button class="btn gh amb" id="rv_no">${SI.x(16)} বাতিল</button>
           <button class="btn" id="rv_yes">${SI.check(16)} অনুমোদন</button>`
         :`<button class="btn gh w" data-close>বন্ধ</button>`);
    if(can("contact.reveal"))logAudit("যোগাযোগ দেখা হয়েছে",q.id,q.kind);
    if(may){
      s.q("#rv_yes").onclick=async()=>{ await decide(id,true,s.q("#rv_note").value); s.close(); };
      s.q("#rv_no").onclick=()=>{s.close();rejectSheet([id])};
    }
  }
  function rejectSheet(ids,after){
    const reasons=["তথ্য অসম্পূর্ণ","বয়স নিয়ম মানেনি","বিশ্রামের সময় শেষ হয়নি","স্বাস্থ্যগত কারণে অযোগ্য",
      "প্রমাণ সংযুক্ত নেই","ভুয়া বা সন্দেহজনক তথ্য","একই আবেদন আগে জমা হয়েছে"];
    const s=sheet("বাতিলের কারণ",`
      <p class="hint2" style="margin-bottom:10px">বাতিলের কারণ <b>ঐচ্ছিক</b> — কারণ না দিয়েও বাতিল করা যাবে। কারণ লিখলে সেটি ব্যবহারকারীর অ্যাপে দেখানো হবে, তাই স্পষ্ট করে লিখুন।</p>
      <div class="strip wrap chips" id="rj_chips">
        ${reasons.map(r=>`<button data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      <textarea id="rj_txt" rows="3"></textarea>`,
      `<button class="btn gh" data-close>ফিরে যান</button>
       <button class="btn amb" id="rj_ok">${SI.x(16)} বাতিল করুন</button>`);
    s.querySelectorAll("#rj_chips button").forEach(b=>b.onclick=()=>{
      s.querySelectorAll("#rj_chips button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");const t=s.q("#rj_txt");if(!t.value.trim())t.value=b.dataset.r});
    s.q("#rj_ok").onclick=async()=>{
      /* কারণ ঐচ্ছিক — না দিলে কোনো "কারণ লিখতে হবে" validation error হয় না */
      const txt=s.q("#rj_txt").value.trim();
      const btn=s.q("#rj_ok");btn.disabled=true;
      const results=await Promise.all(ids.map(id=>decide(id,false,txt,true)));
      if(results.some(x=>x!==true)){btn.disabled=false;return toast("এক বা একাধিক পরিবর্তন RTDB-তে সংরক্ষণ করা যায়নি","er");}
      s.close();after?after():RENDER.work();paintNav();paintTop();
      toast(bn(ids.length)+"টি বাতিল করা হয়েছে")};
  }
  /* বাতিল করা জরুরি আবেদনের status ব্যবহারকারীর "আমার আবেদন"-এ (users/{uid}/data/mine)
     'rejected' হিসেবে লিখে দিই — ডোনার প্যানেলে সাথে সাথে সঠিক অবস্থা দেখায় */
  function markRequestRejected(ownerUid,reqId,note){
    if(!ownerUid||!reqId)return;
    getRow(NODES.users,ownerUid).then(u=>{
      const mine=Array.isArray(u&&u.data&&u.data.mine)?u.data.mine:[];
      const i=mine.findIndex(m=>String(m&&m.id||"")===String(reqId));
      if(i<0)return;
      const paths={};
      paths[`users/${ownerUid}/data/mine/${i}/status`]="rejected";
      if(note)paths[`users/${ownerUid}/data/mine/${i}/rejectNote`]=String(note).slice(0,200);
      updatePaths(paths).catch(e=>console.warn("mark rejected:",e&&e.message));
    }).catch(e=>console.warn("mark rejected:",e&&e.message));
  }
  /* রক্তের গ্রুপ পরিবর্তনের অনুরোধের সিদ্ধান্ত users/{uid}/groupChange-এ লেখা হয় —
     Pending → Approved/Rejected। ডোনার প্যানেল নিজের প্রোফাইল watchRow করে বলে
     status পরিবর্তন realtime-এ পৌঁছায়। Approve হলে আসল গ্রুপ-আপডেট আলাদাভাবে
     users/donors নোডে লেখা হয়; Reject হলে পুরোনো গ্রুপই থেকে যায়। */
  function markGroupChangeStatus(ownerUid,status,note,paths={}){
    if(!ownerUid)return paths;
    paths[`users/${ownerUid}/groupChange/status`]=status;
    paths[`users/${ownerUid}/groupChange/decidedAt`]=new Date().toISOString();
    /* Firebase server timestamp — client-এর ঘড়ি ভুল থাকলেও সঠিক সময় */
    paths[`users/${ownerUid}/groupChange/decidedAtTs`]=serverTime();
    if(note)paths[`users/${ownerUid}/groupChange/note`]=String(note).slice(0,200);
    return paths;
  }
  async function decide(id,ok,note,quiet){
    const i=DB.queue.findIndex(x=>x.id===id);if(i<0)return;
    const q=DB.queue[i];
    const paths={};
    let approvedDonorId="", approvedDonor=null, approvedDonation=null, approvedRequest=null, approvedGroup=null;
    try{
      if(q.kind==="donor"&&ok){
        /* ── ডুপ্লিকেট প্রতিরোধ: একই অ্যাকাউন্টের (ownerUid) ডোনার রেকর্ড আগেই
           থাকলে নতুন ডোনার আইডি তৈরি না করে সেটিকেই অনুমোদিত/আপডেট করা হয় —
           তালিকায় একই Account কখনো দুইবার আসে না। ── */
        let reuseDonor=null;
        if(q.ownerUid){
          try{ reuseDonor=await findBy(NODES.donors,"ownerUid",q.ownerUid); }catch(_e){ reuseDonor=null; }
        }
        approvedDonorId=String(q.donorId||"");
        if(reuseDonor&&reuseDonor.id)approvedDonorId=String(reuseDonor.id);
        if(!approvedDonorId)approvedDonorId=await nextDonorId();
        const at=nowIso();
        approvedDonor={id:approvedDonorId,donorId:approvedDonorId,uid:q.ownerUid||"",ownerUid:q.ownerUid||"",
          name:q.name||"",bloodGroup:q.group||"",group:q.group||"",area:q.area||"",phone:q.phone||"",
          whatsapp:q.whatsapp||q.phone||"",gender:q.gender||"",dob:q.dob||"",
          lastDonationDate:(reuseDonor&&reuseDonor.lastDonationDate)||"",
          status:"approved",available:true,verified:true,suspended:false,joined:(reuseDonor&&reuseDonor.joined)||at,photo:q.photo||"",
          /* Donor approval alone never counts a donation. Donation totals are
             increased only by an approved donation verification. */
          donations:reuseDonor?Number(reuseDonor.donations)||0:0,
          totalDonations:reuseDonor?Number(reuseDonor.totalDonations)||0:0,
          totalBags:reuseDonor?Number(reuseDonor.totalBags)||0:0,
          createdAt:(reuseDonor&&reuseDonor.createdAt)||at,updatedAt:at};
        paths[`donors/${approvedDonorId}`]=approvedDonor;
        if(q.ownerUid){
          paths[`users/${q.ownerUid}/donorStatus`]="approved";
          paths[`users/${q.ownerUid}/donorId`]=approvedDonorId;
          paths[`users/${q.ownerUid}/bloodGroup`]=q.group||"";
          paths[`users/${q.ownerUid}/donorRejectNote`]=null;
          if(q.memberId){paths[`members/${q.memberId}/status`]="approved";paths[`members/${q.memberId}/donorId`]=approvedDonorId;}
          /* অনুমোদনের পর একই ব্যক্তির অন্য pending donor আবেদন রেকর্ড আর
             queue-তে থাকে না — refresh করলেও সেগুলো pending হিসেবে ফিরে আসে না */
          DB.queue.filter(x=>x&&x.kind==="donor"&&String(x.ownerUid||x.uid||"").trim()===String(q.ownerUid)&&x.id!==id)
            .forEach(x=>{paths[`queue/${x.id}`]=null;});
        }
      } else if(q.kind==="donation"&&ok){
        const d=DB.donors.find(x=>x.id===q.donorId||x.name===q.name);
        if(d){
          /* One approved donation event = one life. Bag quantity is kept as a
             separate statistic (`totalBags`), never used for lives saved. */
          const bags=Math.max(1,Math.floor(Number(q.bags)||1));
          const count=(Number(d.donations)||0)+1;
          const totalBags=(Number(d.totalBags)||0)+bags;
          const last=!d.last||q.date>d.last?q.date:d.last;
          const record=await makeApprovedRecord(q,d);
          approvedDonation={d,count,totalBags,last,record};
          paths[`donations/${record.id}`]=record;
          paths[`donors/${d.id}/donations`]=count;
          paths[`donors/${d.id}/totalDonations`]=count;
          paths[`donors/${d.id}/totalBags`]=totalBags;
          if(last)paths[`donors/${d.id}/lastDonationDate`]=last;
          /* Legacy mirror + authoritative verified list: mark the exact
             user-side record so the donor panel shows it as verified. The
             verifiedDonations list is admin/moderator-only in the RTDB rules. */
          const owner=String(q.ownerUid||q.uid||"").trim();
          if(owner){
            const u=await getRow(NODES.users,owner).catch(()=>null);
            const arr=Array.isArray(u&&u.data&&u.data.donations)?u.data.donations:[];
            const di=arr.findIndex(x=>x&&String(x.date||"")===String(q.date||"")&&String(x.place||"")===String(q.place||""));
            if(di>=0)paths[`users/${owner}/data/donations/${di}/ok`]=true;
            const vkey=donationVerKey(q.date,q.place);
            paths[`users/${owner}/data/verifiedDonations/${vkey}`]={date:q.date,place:q.place,bags,livesSaved:1,at:nowIso(),proof:record.proof||""};
          }
        } else {
          const record=await makeApprovedRecord(q,null);
          paths[`donations/${record.id}`]=record;
          approvedDonation={d:null,count:0,totalBags:0,last:"",record};
        }
      } else if(q.kind==="request"&&ok){
        approvedRequest={id:q.id,patient:q.patient,group:q.group,bags:q.bags,urgency:q.urgency,status:"searching",
          responders:0,hospital:q.hospital,area:q.area,requester:q.requester||"স্বজন",phone:q.phone,
          whatsapp:q.whatsapp||q.phone||"",expiresAt:q.expiresAt||"",at:q.at||nowIso(),ownerUid:q.ownerUid||""};
        paths[`requests/${q.id}/status`]="approved";
        paths[`requests/${q.id}/workflowStatus`]="searching";
      } else if(q.kind==="group"&&ok){
        if(q.ownerUid){
          const donor=await findBy(NODES.donors,"ownerUid",q.ownerUid);
          if(!donor||!donor.id)throw new Error("অনুমোদিত ডোনার রেকর্ড পাওয়া যায়নি");
          approvedGroup={ownerUid:q.ownerUid,donorId:donor.id,to:q.to};
          const decidedAt=nowIso();
          paths[`users/${q.ownerUid}/bloodGroup`]=q.to;
          paths[`users/${q.ownerUid}/donorStatus`]="approved";
          paths[`users/${q.ownerUid}/groupChange/status`]="approved";
          paths[`users/${q.ownerUid}/groupChange/decidedAt`]=decidedAt;
          paths[`users/${q.ownerUid}/groupChange/decidedAtTs`]=serverTime();
          if(note)paths[`users/${q.ownerUid}/groupChange/note`]=String(note).slice(0,200);
          paths[`donors/${donor.id}/bloodGroup`]=q.to;
          paths[`donors/${donor.id}/group`]=q.to;
        }
      }

      if(!ok){
        const owner=String(q.ownerUid||q.uid||"").trim();
        if(q.kind==="request"){
          paths[`requests/${q.id}/status`]="rejected";
          if(owner){
            const u=await getRow(NODES.users,owner);
            const mine=Array.isArray(u&&u.data&&u.data.mine)?u.data.mine:[];
            const mi=mine.findIndex(m=>String(m&&m.id||"")===String(q.id));
            if(mi>=0){paths[`users/${owner}/data/mine/${mi}/status`]="rejected";
              if(note)paths[`users/${owner}/data/mine/${mi}/rejectNote`]=String(note).slice(0,200);}
          }
        }
        if(q.kind==="group"&&owner){
          markGroupChangeStatus(owner,"rejected",note,paths);
        }
        if(q.kind==="donation"&&owner){
          /* বাতিল হওয়া রক্তদান হারিয়ে যায় না — donor-এর নিজের রেকর্ডে
             status:"rejected" (+ঐচ্ছিক কারণ) লেখা হয়, তাই ডোনার প্যানেলের
             detail page-এ status/কারণ দেখা যায় এবং সেখান থেকে আবার পাঠানো/
             মুছে ফেলা যায়। refresh/sync করলেও অবস্থা একই থাকে। */
          try{
            const u=await getRow(NODES.users,owner).catch(()=>null);
            const arr=Array.isArray(u&&u.data&&u.data.donations)?u.data.donations:[];
            const di=arr.findIndex(x=>x&&String(x.date||"")===String(q.date||"")&&String(x.place||"")===String(q.place||""));
            if(di>=0){
              paths[`users/${owner}/data/donations/${di}/status`]="rejected";
              paths[`users/${owner}/data/donations/${di}/rejectedAt`]=nowIso();
              if(note)paths[`users/${owner}/data/donations/${di}/rejectNote`]=String(note).slice(0,200);
            }
          }catch(e){ console.warn("donation reject write-back:",e&&e.message); }
        }
        if(q.kind==="donor"&&owner){
          paths[`users/${owner}/donorStatus`]="rejected";
          /* বাতিলের কারণ (ঐচ্ছিক) সংরক্ষিত হয় — ডোনার প্যানেলে বাতিল অবস্থায় দেখানো হয় */
          if(note)paths[`users/${owner}/donorRejectNote`]=String(note).slice(0,200);
          /* বাতিলে এই owner-এর সব pending queue ও members state সম্পূর্ণ পরিষ্কার
             হয় — refresh/sync করলেও একই আবেদন আর pending হিসেবে ফিরে আসে না। */
          try{
            const u=await getRow(NODES.users,owner).catch(()=>null);
            const ownerEmail=String((u&&u.email)||"").trim().toLowerCase();
            const ownerPhone=String((u&&u.phone)||"").replace(/\s+/g,"");
            const sameOwner=m=>String(m&&(m.uid||m.ownerUid||m.userId)||"").trim()===owner
              ||(!!ownerEmail&&String(m&&m.email||"").trim().toLowerCase()===ownerEmail)
              ||(!!ownerPhone&&String(m&&m.phone||"").replace(/\s+/g,"")===ownerPhone);
            if(q.memberId)paths[`members/${q.memberId}`]=null;
            const members=await listOnce(NODES.members);
            members.filter(sameOwner).forEach(m=>{if(m.id)paths[`members/${m.id}`]=null;});
            DB.queue.filter(x=>x&&x.kind==="donor"&&String(x.ownerUid||x.uid||"").trim()===owner&&x.id!==id)
              .forEach(x=>{paths[`queue/${x.id}`]=null;});
          }catch(e){
            /* members পড়া না গেলে অন্তত লিঙ্ক করা রেকর্ডটি rejected করা হয় */
            console.warn("donor reject cleanup:",e&&e.message);
            if(q.memberId)paths[`members/${q.memberId}/status`]="rejected";
          }
        }
      }
      paths[`queue/${id}`]=null;
      /* All moderation effects and queue removal commit before any success UI. */
      await updatePaths(paths);
    }catch(e){
      console.warn("moderation write:",e&&e.message);
      if(!quiet)toast("RTDB-তে পরিবর্তন সংরক্ষণ করা যায়নি — কোনো সফলতা দেখানো হয়নি","er");
      return false;
    }

    /* Local state is only changed after the atomic RTDB operation succeeds. */
    if(approvedDonor){
      DB.donors.unshift({id:approvedDonor.id,name:approvedDonor.name,group:approvedDonor.group,area:approvedDonor.area,
        phone:approvedDonor.phone,whatsapp:approvedDonor.whatsapp,gender:approvedDonor.gender,dob:approvedDonor.dob,
        last:approvedDonor.lastDonationDate,photo:approvedDonor.photo,ownerUid:approvedDonor.ownerUid,available:true,
        verified:true,suspended:false,joined:approvedDonor.joined,donations:approvedDonor.donations,
        totalBags:approvedDonor.totalBags||0});
    }
    if(approvedDonation){if(approvedDonation.d){approvedDonation.d.donations=approvedDonation.count;
      approvedDonation.d.totalBags=approvedDonation.totalBags;approvedDonation.d.last=approvedDonation.last;}
      if(approvedDonation.record){const rid=approvedDonation.record.id;
        DB.donations=DB.donations.filter(x=>String(x.id)!==String(rid));
        DB.donations.unshift(approvedDonation.record);}}
    if(approvedRequest)DB.live.unshift(approvedRequest);
    if(approvedGroup){const d=DB.donors.find(x=>String(x.ownerUid)===String(approvedGroup.ownerUid));if(d)d.group=approvedGroup.to;}
    DB.queue.splice(i,1);
    /* ডোনার সিদ্ধান্তের পর একই ব্যক্তির বাকি pending donor আবেদনও তালিকা থেকে সরে */
    if(q.kind==="donor"){
      const dupOwner=String(q.ownerUid||q.uid||"").trim();
      if(dupOwner)DB.queue=DB.queue.filter(x=>!(x&&x.kind==="donor"&&String(x.ownerUid||x.uid||"").trim()===dupOwner&&x.id!==q.id));
    }
    logAudit(ok?QK[q.kind].t+" অনুমোদন":QK[q.kind].t+" বাতিল",id+(note?" — "+note.slice(0,40):""),q.kind);
    if(!quiet){
      try{await persist();}
      catch(e){if(!quiet)toast("পরিবর্তন RTDB-তে সংরক্ষণ করা যায়নি — সফলতা দেখানো হয়নি","er");return false;}
      RENDER.work();paintNav();paintTop();toast(ok?"অনুমোদন করা হয়েছে":"বাতিল করা হয়েছে",ok?"ok":"");
    }
    return true;
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
        <button class="a" data-sub="users"><b>${bn(DB.reports.filter(r=>r.status!=="resolved").length)}</b><span>অভিযোগ</span></button>
        <button class="b" data-sub="donorid"><b>${bn(DB.donors.length)}</b><span>ডোনার আইডি</span></button>
      </div>`
    +sect("",[
        row("donor.view","donors","drop","রক্তদাতা তালিকা","খুঁজুন, সম্পাদনা করুন, স্থগিত করুন",bn(DB.donors.length)),
        row("donation.manage","approved","checkC","অনুমোদিত রক্তদান","অনুমোদিত রক্তদান — দেখুন, সম্পাদনা ও মুছুন",bn(DB.donations.length)),
        row("user.view","users","users","ব্যবহারকারী ও অভিযোগ","অ্যাকাউন্ট ও রিপোর্ট",DB.reports.filter(r=>r.status!=="resolved").length?bn(DB.reports.filter(r=>r.status!=="resolved").length):""),
        row("user.view","inbox","mail","বার্তা","ওয়েবসাইটের যোগাযোগ ফর্ম",unread()?`<span class="tag r">${bn(unread())} নতুন</span>`:""),
        row("team.view","team","users","ডোনার ব্যবস্থাপনা","শুধু Website/Firebase অ্যাকাউন্ট-ওয়ালা ডোনার",bn(accountDonors().length)),
        row("team.view","donorid","card","ডোনার আইডি ব্যবস্থাপনা","সব ডোনার আইডি — অ্যাকাউন্ট না থাকলেও",bn(DB.donors.length))])
    +`<div class="sec-t">শীর্ষ রক্তদাতা</div>
      <div class="card pad0">${DB.donors.slice().sort((a,b)=>b.donations-a.donations).slice(0,5)
        .map((d,i)=>`<button class="prow" data-dn="${d.id}">
          <span class="bg2" style="background:var(--grn-s);color:var(--grn)">${bn(i+1)}</span>
          <span class="tx"><b>${esc(d.name)}</b><small>${d.group} · ${esc(d.area)}</small></span>
          <span class="tag g">${bn(d.donations)} জীবন</span></button>`).join("")}</div>`
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
        row("access.manage","access","key","অ্যাক্সেস ও ভূমিকা","অ্যাডমিন, মডারেটর বা ডোনার ভূমিকা পরিবর্তন",""),
        row("team.view","team","users","ডোনার ব্যবস্থাপনা","শুধু Website/Firebase অ্যাকাউন্ট-ওয়ালা ডোনার",bn(accountDonors().length)),
        row("team.view","donorid","card","ডোনার আইডি ব্যবস্থাপনা","সব ডোনার আইডি — অ্যাকাউন্ট না থাকলেও",bn(DB.donors.length)),
        row("donation.manage","approved","checkC","অনুমোদিত রক্তদান","অনুমোদিত রক্তদান — দেখুন, সম্পাদনা ও মুছুন",bn(DB.donations.length)),
        row("gallery.manage","gallery","cam","গ্যালারি","ওয়েবসাইটের গ্যালারিতে ছবি যোগ/মুছুন",bn(DB.gallery.length)),
        row("settings.manage","rules","gear","অনুমোদন ও সেটিংস","কোন কোন কাজে অনুমোদন লাগবে","")])
    +sect("ডেটাবেস",[
        row("database.manage","database","db","ডেটাবেস ব্যবস্থাপনা","Firebase Realtime Database — সব node দেখুন ও সম্পাদনা করুন","")])
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
    await logMe("লগআউট","প্যানেল থেকে বের হয়েছেন","security");
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
    s.q("#ex_ok").onclick=async()=>{
      let csv="";
      if(pick==="donors")csv=toCSV(DB.donors.map(d=>[d.id,d.name,d.group,d.area,maskPhone(d.phone),
        d.dob||"",ageText(d),d.gender,d.last,d.donations,d.totalBags||0,d.suspended?"স্থগিত":"সক্রিয়"]),
        ["আইডি","নাম","গ্রুপ","এলাকা","ফোন","জন্ম তারিখ","বয়স","লিঙ্গ","শেষ দান","জীবন বাঁচিয়েছেন","মোট ব্যাগ","অবস্থা"]);
      if(pick==="queue")csv=toCSV(DB.queue.map(q=>[q.id,QK[q.kind].t,q.name||q.patient,q.group||"",iso(q.at)]),
        ["আইডি","ধরন","নাম","গ্রুপ","তারিখ"]);
      if(pick==="live")csv=toCSV(DB.live.map(r=>[r.id,r.patient,r.group,r.bags,r.hospital,r.urgency,r.status]),
        ["আইডি","রোগী","গ্রুপ","ব্যাগ","হাসপাতাল","জরুরিতা","অবস্থা"]);
      if(pick==="audit")csv=toCSV(DB.audit.map(a=>[a.at,a.who,ROLES[a.role].label,a.act,a.target]),
        ["সময়","কে","ভূমিকা","কাজ","লক্ষ্য"]);
      dlFile(`cbdc-${pick}-${iso(now())}.csv`,csv);
      logAudit("তথ্য রপ্তানি",pick,"data");
      try{await persist();}catch(e){return toast("রপ্তানি audit RTDB-তে সংরক্ষণ করা যায়নি","er");}
      s.close();toast("ফাইল নামছে","ok")};
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
        <input class="gw" id="dq" value="${esc(dF.q)}">
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
    const DB_=dobBounds(DB.rules.minAge,DB.rules.maxAge);
    const d=id?DB.donors.find(x=>x.id===id):{name:"",group:"O+",area:AREAS[0],phone:"",dob:"",gender:"পুরুষ",last:""};
    const s=sheet(id?"তথ্য সম্পাদনা":"নতুন রক্তদাতা",`<div class="f">
      <label>নাম</label><input id="f_n" value="${esc(d.name)}">
      <label>রক্তের গ্রুপ</label><select id="f_g">${GROUPS.map(g=>`<option ${d.group===g?"selected":""}>${g}</option>`).join("")}</select>
      <label>এলাকা</label><select id="f_a">${AREAS.map(a=>`<option ${d.area===a?"selected":""}>${a}</option>`).join("")}</select>
      <label>ফোন</label><input id="f_p" value="${esc(d.phone)}" inputmode="numeric">
      <label>জন্ম তারিখ</label><input id="f_ag" type="date" value="${esc(d.dob||"")}" min="${DB_.min}" max="${DB_.max}">
      <span class="hint2">বয়স জন্ম তারিখ থেকে স্বয়ংক্রিয়ভাবে হিসাব হবে${d.dob?" — বর্তমানে "+ageText(d):""}।</span>
      <label>লিঙ্গ</label><select id="f_s"><option ${d.gender==="পুরুষ"?"selected":""}>পুরুষ</option><option ${d.gender==="মহিলা"?"selected":""}>মহিলা</option></select>
      <label>শেষ রক্তদান</label><input id="f_l" type="date" value="${d.last||""}">
    </div>`,`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="f_ok">সংরক্ষণ</button>`);
    s.q("#f_ok").onclick=async()=>{
      const n=s.q("#f_n").value.trim(),p=s.q("#f_p").value.trim();
      if(n.length<3)return toast("নাম লিখুন","er");
      if(!phoneOK(p))return toast("সঠিক ফোন নম্বর দিন (০১…, ১১ সংখ্যা)","er");
      const dobVal=s.q("#f_ag").value;
      if(dobVal&&!isValidDob(dobVal))return toast("সঠিক জন্ম তারিখ দিন","er");
      const o={name:n,group:s.q("#f_g").value,area:s.q("#f_a").value,phone:p,
        dob:dobVal,gender:s.q("#f_s").value,last:s.q("#f_l").value};
      /* ── ডুপ্লিকেট প্রতিরোধ: একই মোবাইল নম্বরে ডোনার আগেই থাকলে সতর্ক করা হয় —
         নিশ্চিত করলেই নতুন এন্ট্রি যোগ হয় (তালিকায় অবাঞ্ছিত duplicate এড়াতে)। ── */
      const dupDigits=(v)=>{let d=String(v||"").replace(/\D/g,"");if(d.startsWith("880")&&d.length>11)d="0"+d.slice(3);return d;};
      const dupExisting=(!id && DB.donors.find(x=>dupDigits(x.phone)===dupDigits(p)));
      if(dupExisting){
        const goAhead=await confirmS({title:"ডুপ্লিকেট যাচাই", ok:"যোগ করুন",
          desc:`এই মোবাইল নম্বরে ইতিমধ্যে একজন ডোনার আছে — "${dupExisting.name||"অজানা"}"। একই নম্বরে আরেকটি এন্ট্রি যোগ করবেন?`});
        if(!goAhead)return;
      }
      if(id){Object.assign(d,o);logAudit("ডোনার তথ্য সম্পাদনা",id,"donor")}
      else{
        let newId="";
        try{ newId=await nextDonorId(); }
        catch(e){ console.warn("donor id:",e&&e.message); toast("Donor UID তৈরি করা যায়নি — সংরক্ষণ হয়নি। আবার চেষ্টা করুন।","er"); return; }
        DB.donors.unshift({id:newId,...o,available:true,verified:true,
          suspended:false,joined:iso(now()),donations:0,totalBags:0});logAudit("নতুন ডোনার যোগ",n,"donor")}
      try{await persist();}
      catch(e){toast("রক্তদাতা সংরক্ষণ করা যায়নি — কোনো সফলতা দেখানো হয়নি","er");return;}
      s.close();renderSub("donors");toast("সংরক্ষণ হয়েছে","ok")};
  }
  
  /* ══════════════════ APPROVED DONATIONS (Admin) ══════════════════
     Authoritative approved-donation log lives in RTDB `donations`.
     Approve → record; View / Edit / Delete here; donor & user donor
     statistics are recomputed from the same log (1 event = 1 life).

     The pure write/delete/backfill logic lives in src/lib/donationLog.ts
     and is shared with the Moderator panel + the test suite. */
  const donationIo={
    listOnce:(node:string)=>listOnce(node),
    getRow:(node:string,id:string)=>getRow(node,id),
    updatePaths:(paths:Record<string,any>)=>updatePaths(paths)
  };
  function localDonorForRecord(record){
    return DB.donors.find(x=>String(x.id)===String(record.donorId||""))||null;
  }
  /* Remove donation-related queue items locally so a subsequent persist()
     cannot re-publish the same record back into রক্তদান যাচাই. */
  function clearDonationQueueFor(record){
    DB.queue=(DB.queue||[]).filter(q=>{
      if(String(q?.kind||"")!=="donation")return true;
      if(String(q?.id||"")===String(record.id||""))return false;
      const sameOwner=String(q?.ownerUid||q?.uid||"")===String(record.ownerUid||"");
      const sameDate=String(q?.date||"")===String(record.date||"");
      const samePlace=String(q?.place||"")===String(record.place||"");
      return !(sameOwner&&sameDate&&samePlace);
    });
  }
  async function saveApprovedDonation(record,oldRecord){
    const {paths,stats}=await writeApprovedDonation(record,oldRecord,donationIo);
    await updatePaths(paths);
    clearDonationQueueFor(record);
    DB.donations=DB.donations.filter(x=>String(x.id)!==String(record.id));
    DB.donations.unshift(record);
    const d=localDonorForRecord(record);
    if(d){d.donations=stats.lives;d.totalDonations=stats.lives;d.totalBags=stats.bags;d.last=stats.last;}
    return stats;
  }
  async function deleteApprovedDonation(record){
    const {paths,stats}=await deleteApprovedDonation(record,donationIo);
    await updatePaths(paths);
    clearDonationQueueFor(record);
    DB.donations=DB.donations.filter(x=>String(x.id)!==String(record.id));
    const d=DB.donors.find(x=>String(x.id)===String(record.donorId||""));
    if(d){d.donations=stats.lives;d.totalDonations=stats.lives;d.totalBags=stats.bags;d.last=stats.last;}
    return stats;
  }
  /* ── legacy verifiedDonations → donations node (idempotent, one-time) ── */
  let approvedDonationBackfillRun=false;
  async function backfillApprovedDonations(){
    if(approvedDonationBackfillRun||!can("donation.manage"))return;
    approvedDonationBackfillRun=true;
    try{
      const {paths,newRecords,touched}=await backfillApprovedDonations(donationIo,DB.donations||[],DB.donors||[]);
      if(!newRecords.length)return;
      await updatePaths(paths);
      newRecords.forEach(r=>{DB.donations.unshift(r)});
      for(const donorId of touched){
        const d=DB.donors.find(x=>String(x.id)===String(donorId));
        if(!d)continue;
        const all=(((await donationIo.listOnce(NODES.donations))||[]).filter(r=>r&&String(r.donorId||"")===String(donorId)));
        const stats=donorStatsFromRecords(all);
        d.donations=stats.lives;d.totalDonations=stats.lives;d.totalBags=stats.bags;d.last=stats.last;
      }
      logAudit("অনুমোদিত রক্তদান ব্যাকফিল",bn(newRecords.length)+"টি পুরোনো রক্তদান যুক্ত হয়েছে","donation");
    }catch(e){console.warn("approved donation backfill:",e&&e.message)}
  }
  /* Approve-এর সময় queue থেকে তৈরি রেকর্ড (proof URL সহ) — shared module */
  const makeApprovedRecord=(q:any,d:any)=>makeApprovedDonationRecord(q,d,ME.name||"অ্যাডমিন",donationIo);
  let appFil={q:"",g:""};
  SUBP.approved=el=>{
    const list=(DB.donations||[]).slice().sort((a,b)=>String(b.date||b.approvedAt).localeCompare(String(a.date||a.approvedAt)));
    const filtered=list.filter(r=>{
      if(appFil.q&&![r.name,r.donorId,r.id,r.place,r.group].join(" ").toLowerCase().includes(appFil.q.toLowerCase()))return false;
      if(appFil.g&&r.group!==appFil.g)return false;
      return true;
    });
    const totalBags=DB.donations.reduce((s,r)=>s+Math.max(0,Number(r.bags)||0),0);
    el.innerHTML=ptitle("অনুমোদিত রক্তদান","অনুমোদিত রক্তদান — দেখুন, সম্পাদনা ও মুছুন")
    +`<div class="astat">
        <button class="g"><b>${bn(DB.donations.length)}</b><span>জীবন বাঁচিয়েছে</span></button>
        <button class="b"><b>${bn(totalBags)}</b><span>মোট ব্যাগ</span></button>
        <button class="a"><b>${bn(new Set(DB.donations.map(r=>r.donorId)).size)}</b><span>রক্তদাতা</span></button>
        <button class="r"><b>${bn((DB.donations||[]).reduce((s,r)=>s+(r.approvedAt?1:0),0))}</b><span>যাচাইকৃত</span></button>
      </div>
      <div class="frow">
        <input class="gw" id="aq" value="${esc(appFil.q)}" placeholder="নাম / আইডি / স্থান…">
        <select id="ag"><option value="">সব গ্রুপ</option>${GROUPS.map(g=>`<option ${appFil.g===g?"selected":""}>${g}</option>`).join("")}</select>
        <button class="btn gh sm" id="aExp">${SI.dl(14)} রপ্তানি</button>
      </div>
      ${filtered.length?`<div class="card pad0">${filtered.map(r=>{
        const donor=DB.donors.find(x=>String(x.id)===String(r.donorId||""));
        const thumb=proofUrlOf(r)||(donor&&donor.photo)||"";
        return `<button class="prow" data-aid="${r.id}">
          <span class="bg2">${esc(r.group)}</span>
          <span class="tx"><b>${esc(r.name)}</b><small>${esc(r.donorId||r.id)} · ${esc(r.place||"")} · ${dL(r.date)}</small></span>
          <span style="display:flex;align-items:center;gap:6px;flex:none">
            <span class="tag b">${bn(r.bags)} ব্যাগ</span>${thumb?`<img src="${esc(thumb)}" alt="" style="width:32px;height:32px;border-radius:8px;object-fit:cover">`:""}
          </span></button>`;
      }).join("")}</div>`:`<div class="card">${emptyBox("check","কোনো Approved Donation নেই","অনুমোদিত রক্তদান এখানে দেখা যাবে")}</div>`}`;
    let t;$("#aq").oninput=e=>{appFil.q=e.target.value;clearTimeout(t);t=setTimeout(()=>renderSub("approved"),260)};
    $("#ag").onchange=e=>{appFil.g=e.target.value;renderSub("approved")};
    $("#aExp")&&($("#aExp").onclick=()=>{
      const csv=toCSV(list.map(r=>[r.id,r.donorId,r.name,r.group,r.date,r.place,r.bags,r.proof?r.proof:"",r.submittedAt||"",r.approvedAt]),
        ["Donation ID","Donor ID","নাম","গ্রুপ","তারিখ","স্থান","ব্যাগ","প্রমাণ ছবি","Submitted","Approved"]);
      dlFile(`cbdc-approved-donations-${iso(now())}.csv`,csv);
      logAudit("অনুমোদিত রক্তদান রপ্তানি","CSV","donation");toast("ফাইল নামছে","ok");
    });
    el.querySelectorAll("[data-aid]").forEach(b=>b.onclick=()=>openApprovedDonation(b.dataset.aid));
  };
  async function openApprovedDonation(id){
    const r=DB.donations.find(x=>String(x.id)===String(id));if(!r)return;
    const donor=DB.donors.find(x=>String(x.id)===String(r.donorId||""));
    /* Always validate the stored value as an image URL. booleans, empty/
       invalid strings and `true`/`false` must NOT be used as `<img src>`.
       When the approved record has no usable proof, read the owner's own
       `users/{uid}/data/donations` record as the fallback source. */
    let proof=proofUrlOf(r);
    if(!proof && r.ownerUid){
      try{
        const u=await getRow("users",r.ownerUid);
        const arr=u&&Array.isArray(u.data&&u.data.donations)?u.data.donations:[];
        const hit=arr.find((x:any)=>String(x?.date||"")===String(r.date||"")&&String(x?.place||"")===String(r.place||""));
        proof=proofUrlOf(hit);
      }catch(e){console.warn("approved proof fallback:",e&&e.message)}
    }
    const thumb=proof||(donor&&donor.photo)||"";
    const s=sheet("Approved Donation",`
      <div class="per">${thumb?`<img src="${esc(thumb)}" style="width:46px;height:46px;border-radius:14px;object-fit:cover" alt="">`
        :`<span class="bg2" style="width:44px;height:44px;border-radius:12px">${esc(r.group)}</span>`}
        <div class="i"><b>${esc(r.name)}</b><small>${esc(r.donorId||"")} · ${dL(r.date)}</small></div>
        <span class="pill g">যাচাইকৃত</span></div>
      <div class="kv" style="margin-top:11px">
        <div><span>Donation ID</span><b>${esc(r.id)}</b></div>
        <div><span>রক্তদাতা</span><b>${esc(r.name)}</b></div>
        <div><span>রক্তের গ্রুপ</span><b>${esc(r.group)}</b></div>
        <div><span>রক্তদানের তারিখ</span><b>${dL(r.date)}</b></div>
        <div><span>হাসপাতাল / স্থান</span><b>${esc(r.place)}</b></div>
        <div><span>ব্যাগ</span><b>${bn(r.bags)}</b></div>
        <div><span>জীবন বাঁচিয়েছে</span><b>${bn(1)}</b></div>
        <div><span>Submitted</span><b>${r.submittedAt?dL(r.submittedAt):"—"}</b></div>
        <div><span>Approved</span><b>${r.approvedAt?dL(r.approvedAt):"—"}</b></div>
        ${r.patient?`<div><span>রোগী</span><b>${esc(r.patient)}</b></div>`:""}
        ${r.note?`<div><span>মন্তব্য</span><b>${esc(r.note)}</b></div>`:""}
      </div>
      ${proof?`<div class="sec-t">প্রমাণের ছবি</div>
        <a href="${esc(proof)}" target="_blank" rel="noopener"><img src="${esc(proof)}" alt="রক্তদানের প্রমাণ"
          style="width:100%;max-height:300px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:var(--card2)"></a>`:""}`,
      `<button class="btn gh amb" id="ad_del">${SI.trash(16)} মুছে ফেলুন</button>
       <button class="btn" id="ad_edit">${SI.edit(16)} সম্পাদনা</button>`);
    s.q("#ad_edit").onclick=()=>{s.close();editApprovedDonation(id)};
    s.q("#ad_del").onclick=async()=>{
      if(!await confirmS({title:"এই রক্তদানের সম্পূর্ণ রেকর্ড মুছে ফেলবেন? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।",desc:`${r.donorId||r.id} · ${dL(r.date)} · ${r.place}`,
        ok:"Delete",cancel:"Cancel",danger:true}))return;
      try{
        const stats=await deleteApprovedDonation(r);
        await persist();
        logAudit("Approved Donation মুছা",r.id+" — "+r.donorId,"donation");
        s.close();renderSub("approved");paintNav();paintTop();
        toast("রেকর্ড মুছে গেছে — পরিসংখ্যান হালনাগাদ হয়েছে","ok");
      }catch(e){console.warn("delete approved donation:",e&&e.message);toast("মোছা যায়নি","er")}
    };
  }
  function editApprovedDonation(id){
    const r=DB.donations.find(x=>String(x.id)===String(id));if(!r)return;
    const s=sheet("Approved Donation সম্পাদনা",`
      <div class="f">
        <label>রক্তদানের তারিখ</label><input id="ad_date" type="date" value="${esc(r.date)}" max="${iso(now())}">
        <label>হাসপাতাল / স্থান</label><input id="ad_place" value="${esc(r.place)}">
        <label>কত ব্যাগ</label><input id="ad_bags" type="number" value="${Number(r.bags)||1}" min="1" max="99">
        <label>নতুন প্রমাণের ছবি (ঐচ্ছিক)</label><input id="ad_file" type="file" accept="image/*">
        ${r.proof?`<a href="${esc(r.proof)}" target="_blank" rel="noopener"><img src="${esc(r.proof)}" alt="প্রমাণ" style="max-height:130px;border-radius:10px;border:1px solid var(--line)"></a>`:""}
        <label>রোগীর নাম (ঐচ্ছিক)</label><input id="ad_pat" value="${esc(r.patient||'')}">
        <label>মন্তব্য</label><input id="ad_note" value="${esc(r.note||'')}">
      </div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ad_ok">${SI.check(15)} সংরক্ষণ</button>`);
    s.q("#ad_ok").onclick=async()=>{
      const date=s.q("#ad_date").value, place=s.q("#ad_place").value.trim().slice(0,120);
      const bags=Math.max(1,Math.floor(Number(s.q("#ad_bags").value)||1));
      if(!date)return toast("তারিখ দিন","er");
      if(!place)return toast("হাসপাতাল / স্থান লিখুন","er");
      const f=s.q("#ad_file").files&&s.q("#ad_file").files[0];
      let proof=r.proof||"";
      if(f){
        if(f.size>4*1024*1024)return toast("ছবি ৪ MB-এর কম হতে হবে","er");
        try{proof=(await imgbbUploadImage(f)).url}catch(e){return toast(e&&e.message?e.message:"ছবি আপলোড হয়নি","er")}
      }
      const oldRecord={id:r.id,date:r.date,place:r.place};
      const updated={...r,date,place,bags,proof,patient:s.q("#ad_pat").value.trim().slice(0,120),
        note:s.q("#ad_note").value.trim().slice(0,300),updatedAt:nowIso()};
      try{
        await saveApprovedDonation(updated,oldRecord);
        await persist();
        logAudit("Approved Donation সম্পাদনা",r.id+" — "+date+" · "+place,"donation");
        s.close();renderSub("approved");toast("সংরক্ষণ হয়েছে — পরিসংখ্যান হালনাগাদ হয়েছে","ok");
      }catch(e){console.warn("edit approved donation:",e&&e.message);toast("সংরক্ষণ হয়নি","er")}
    };
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
      if(!r)return;
      const before=CBDCShared.clone(DB);
      DB.live=DB.live.filter(x=>x.id!==r.id);
      logAudit("আবেদন সম্পন্ন",r.id,"request");
      try{await persist();}catch(e){Object.assign(DB,before);return toast("আবেদন সম্পন্ন করা যায়নি","er");}
      renderSub("live");paintTop();toast("সম্পন্ন হিসেবে চিহ্নিত","ok")});
    el.querySelectorAll("[data-cx]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.cx;
      const s=sheet("আবেদন বাতিল",`<p class="hint2" style="margin-bottom:9px">কারণ লিখুন — আবেদনকারীর অ্যাপে দেখানো হবে।</p>
        <textarea id="lv_t" rows="3"></textarea>`,
        `<button class="btn gh" data-close>ফিরে যান</button><button class="btn red" id="lv_ok">বাতিল করুন</button>`);
      s.q("#lv_ok").onclick=async()=>{
        if(!s.q("#lv_t").value.trim())return toast("কারণ লিখতে হবে","er");
        const before=CBDCShared.clone(DB);
        DB.live=DB.live.filter(x=>x.id!==id);logAudit("আবেদন বাতিল",id,"request");
        try{await persist();}catch(e){Object.assign(DB,before);return toast("আবেদন বাতিল করা যায়নি","er");}
        s.close();renderSub("live");paintTop();toast("বাতিল করা হয়েছে")}});
  };
  function liveSheet(id){go(CUR,"live")}
  
  /* ---------- users & reports ---------- */
  SUBP.users=el=>{
    /* রিপোর্ট/অভিযোগ — ডোনার প্যানেলের "সমস্যা জানান" থেকে আসা,
       RTDB `reports` node-এর live ডেটা (watchReports)। */
    const reports=DB.reports;
    const openReports=reports.filter(r=>r.status!=="resolved");
    el.innerHTML=`<div class="astat">
        <button class="g"><b>${bn(DB.donors.length)}</b><span>অ্যাকাউন্ট</span></button>
        <button class="a"><b>${bn(openReports.length)}</b><span>অভিযোগ</span></button>
        <button class="r"><b>${bn(DB.donors.filter(d=>d.suspended).length)}</b><span>স্থগিত</span></button>
        <button class="b"><b>${bn(DB.donors.filter(d=>!d.verified).length)}</b><span>যাচাই বাকি</span></button>
      </div>
      <div class="sec-t">অভিযোগ ও রিপোর্ট</div>`
    +(reports.length?`<div class="card pad0">${reports.map(q=>`<button class="row" data-open="${q.id}">
        <span class="ic" style="color:var(--amb)">${SI.help(18)}</span>
        <span class="tx"><b>${esc(q.type)} — ${esc(q.name||"নাম নেই")}</b><small>${esc(q.text)}</small>
          ${q.screenshot?`<small>📷 স্ক্রিনশট সংযুক্ত</small>`:""}</span>
        <span class="rt">${q.status==="resolved"?`<span class="pill g">সমাধান</span>`:timeAgo(q.createdAt)}</span></button>`).join("")}</div>`
      :`<div class="card">${emptyBox("check","কোনো অভিযোগ নেই","ডোনার প্যানেলের 'সমস্যা জানান' থেকে এলে এখানে দেখা যাবে")}</div>`)
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
    el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openReportSheet(b.dataset.open));
    el.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>openDonor(b.dataset.dn));
  };

  /* একটি রিপোর্টের বিস্তারিত — স্ক্রিনশটসহ; সমাধান/মুছে ফেলা যায়।
     প্রতিটি পরিবর্তন RTDB-তে হয়, তাই ডোনার নিজের প্যানেলেও সাথে সাথে
     আপডেট দেখে; সব পদক্ষেপ অডিট লগে থাকে। */
  function openReportSheet(id){
    const r=DB.reports.find(x=>String(x.id)===String(id));
    if(!r)return toast("রিপোর্টটি আর পাওয়া যায়নি","er");
    const s=sheet("রিপোর্ট বিস্তারিত",`
      <div class="kv">
        <div><span>ধরন</span><b>${esc(r.type)}</b></div>
        <div><span>নাম</span><b>${esc(r.name||"—")}${r.username?" (@"+esc(r.username)+")":""}</b></div>
        <div><span>ইমেইল</span><b>${esc(r.email||"—")}</b></div>
        <div><span>সময়</span><b>${timeAgo(r.createdAt)}</b></div>
        <div><span>অবস্থা</span><b>${r.status==="resolved"?"✓ সমাধান হয়েছে":"অপেক্ষমাণ"}</b></div>
      </div>
      <div class="sec-t">বিস্তারিত</div>
      <div class="card" style="white-space:pre-wrap">${esc(r.text)}</div>
      ${r.screenshot?`<div class="sec-t">স্ক্রিনশট</div>
        <div class="card" style="text-align:center"><img src="${esc(r.screenshot)}" alt="রিপোর্টের স্ক্রিনশট"
          style="max-width:100%;max-height:300px;border-radius:10px;border:1px solid var(--line)"></div>`:""}
      ${r.ownerUid?`<p class="hint2">UID: ${esc(r.ownerUid)}</p>`:""}`,
      `<button class="btn gh" data-close>বাতিল</button>
       ${r.status!=="resolved"?`<button class="btn" id="rp_ok">${SI.check(15)} সমাধান হয়েছে</button>`:""}
       <button class="btn red" id="rp_del">${SI.trash(15)} মুছুন</button>`);
    s.q("#rp_ok")&&(s.q("#rp_ok").onclick=async()=>{
      const btn=s.q("#rp_ok");btn.disabled=true;
      try{
        await updateRow(NODES.reports,r.id,{status:"resolved",resolvedAt:nowIso(),resolvedBy:ME.name||"admin"});
        await logAudit("রিপোর্ট সমাধান",`${r.type} · ${r.name}`,`report`);
        s.close();toast("রিপোর্টটি সমাধান হিসেবে চিহ্নিত হয়েছে","ok");
      }catch(e){btn.disabled=false;toast("রিপোর্ট আপডেট করা যায়নি","er");}
    });
    s.q("#rp_del").onclick=async()=>{
      if(!await confirmS({title:"রিপোর্ট মুছবেন?",desc:"এই রিপোর্টটি স্থায়ীভাবে মুছে যাবে।",ok:"মুছুন",danger:true}))return;
      try{
        await removeRow(NODES.reports,r.id);
        await logAudit("রিপোর্ট মুছে ফেলা",`${r.type} · ${r.name}`,"report");
        s.close();toast("রিপোর্ট মুছে ফেলা হয়েছে","ok");
      }catch(e){toast("রিপোর্ট মুছে ফেলা যায়নি","er");}
    };
  }
  
  /* ---------- ডোনার ব্যবস্থাপনা (সাবেক "টিম ও ভূমিকা") ----------
     শুধু সেই ডোনার যাদের **Website/Firebase অ্যাকাউন্ট আছে** (users/{uid}
     রেকর্ড)। প্রতিটি ডোনারের সংক্ষিপ্ত তথ্য: প্রোফাইল ছবি, নাম, Username,
     রক্তের গ্রুপ, এলাকা, ডোনার আইডি ও স্ট্যাটাস — **আগের ডিজাইন হুবহু**।
     অ্যালগোরিদম পরিবর্তন:
       • "দেখুন" বাটন নেই — কার্ড/পঙ্‌ক্তির যে-কোনো অংশে ক্লিক করলে
         বিদ্যমান রক্তদাতার প্রোফাইল ভিউ খোলে (openDonor)।
       • চেকবক্সে ক্লিক = শুধু নির্বাচন/বাতিল; কখনো প্রোফাইল খোলে না।
       • নির্বাচিত এক/একাধিক ডোনারের **অ্যাকাউন্ট** মুছে যায় (scope
         "account") — ডোনার আইডি অক্ষত থাকে। */
  let teamSel=new Set(), donorIdSel=new Set();

  /** কোন ডোনারের Website/Firebase অ্যাকাউন্ট আছে (users/{uid} রেকর্ড)। */
  function accountDonors(){
    const byUid=new Map(accountUsers.map(u=>[String(u.uid||u.id),u]));
    return DB.donors.filter(d=>{
      const uid=String((d&&(d.ownerUid||d.uid))||"").trim();
      return !!uid&&byUid.has(uid);
    });
  }

  /** তালিকার row — username/photo অ্যাকাউন্ট থেকে (থাকলে), না থাকলে শুধু donor। */
  function donorManageRows(all){
    const byUid=new Map(accountUsers.map(u=>[String(u.uid||u.id),u]));
    return (all?DB.donors:accountDonors()).map(d=>{
      const prof=d.ownerUid?byUid.get(String(d.ownerUid)):null;
      return {d,username:String((prof&&prof.username)||""),photo:String(d.photo||(prof&&prof.photo)||"")};
    });
  }

  /** দুটি ব্যবস্থাপনা স্ক্রিনের অভিন্ন কার্ড-ডিজাইন (শুধু ডেলিট scope আলাদা)। */
  function donorManageHtml(rows,sel,emptyTitle,emptyDesc){
    const keep=new Set(rows.map(r=>String(r.d.id)));
    const pruned=new Set([...sel].filter(id=>keep.has(String(id))));
    sel.clear();pruned.forEach(id=>sel.add(id));
    const selCount=pruned.size;
    const allChecked=rows.length>0&&selCount===rows.length;
    return `<div class="frow" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:7px;font-size:.78rem;font-weight:700;cursor:pointer">
          <input type="checkbox" id="tall" ${allChecked?"checked":""} style="width:17px;height:17px;accent-color:var(--grn)">
          সব নির্বাচন করুন</label>
        <span class="mut" style="font-size:.75rem">${bn(rows.length)} জন ডোনার</span>
        <button class="btn red sm" id="tdel" ${selCount?"":"disabled"}>${SI.trash(14)} ডিলিট করুন${selCount?" ("+bn(selCount)+")":""}</button>
        <button class="btn gh sm" id="tdedupe" style="margin-left:auto">${SI.shield(14)} ডুপ্লিকেট যাচাই</button>
      </div>`
    +(rows.length
      ?`<div class="card pad0">${rows.map(({d,username,photo})=>`<div class="prow" style="cursor:pointer" data-row="${esc(d.id)}">
          <input type="checkbox" data-tsel="${esc(d.id)}" ${sel.has(String(d.id))?"checked":""}
            style="width:17px;height:17px;accent-color:var(--red);flex:none" aria-label="নির্বাচন করুন">
          ${photo?`<img src="${esc(photo)}" alt="" style="width:40px;height:40px;border-radius:11px;object-fit:cover;background:var(--card2)">`
            :`<span class="bg2" style="background:var(--grn-s);color:var(--grn)">${esc(d.group||"")}</span>`}
          <span class="tx"><b>${esc(d.name)}${d.ownerUid===ME.uid?" (আপনি)":""}</b>
            <small>${username?"@"+esc(username)+" · ":""}${esc(d.group||"")} · ${esc(d.area||"")}</small>
            <small>${esc(d.donorId||d.id)} · ${d.suspended?`<span style="color:var(--red)">স্থগিত</span>`:`<span style="color:var(--grn)">অনুমোদিত</span>`}</small></span>
        </div>`).join("")}</div>`
      :`<div class="card">${emptyBox("users",emptyTitle,emptyDesc)}</div>`);
  }

  /** row ক্লিক → প্রোফাইল; চেকবক্স ক্লিক → শুধু নির্বাচন (stopPropagation)। */
  function wireDonorManage(el,rows,sel,scope){
    $("#tall").onchange=e=>{
      sel.clear();
      if(e.target.checked)rows.forEach(r=>sel.add(String(r.d.id)));
      renderSub(scope==="account"?"team":"donorid");
    };
    el.querySelectorAll("[data-tsel]").forEach(c=>{
      c.onclick=e=>e.stopPropagation();
      c.onchange=()=>{
        const id=String(c.dataset.tsel);
        c.checked?sel.add(id):sel.delete(id);
        renderSub(scope==="account"?"team":"donorid");
      };
    });
    /* কার্ড/পঙ্‌ক্তির অন্য যেকোনো অংশ → বিদ্যমান প্রোফাইল ভিউ (দেখুন বাটন নেই) */
    el.querySelectorAll("[data-row]").forEach(x=>x.onclick=()=>openDonor(x.dataset.row));
    $("#tdel").onclick=()=>bulkDeleteEntities(scope,[...sel]);
    $("#tdedupe").onclick=()=>openDedupe();
  }

  /* ══════════ ডুপ্লিকেট যাচাই ও নিরাপদে পরিষ্কার (legacy cleanup) ══════════
     সার্ভার-নিরাপদ স্ক্যান: একই ইমেইলে একাধিক অ্যাকাউন্ট রেকর্ড, একই অ্যাকাউন্টের
     একাধিক ডোনার আইডি ও ইমেইল-সূচি (identityIndex) backfill — প্রথমে preview,
     অ্যাডমিন নিশ্চিত করলে এক atomic write-এ মেলানো/মোছা হয়। ফল live listener-এই
     সব প্যানেলে realtime দেখা যায় — reload লাগে না। */
  async function openDedupe(){
    let sh=null;
    try{
      sh=sheet("ডুপ্লিকেট যাচাই",`<p class="mut" style="font-size:.84rem">ডেটাবেস স্ক্যান হচ্ছে — একই ইমেইলের অ্যাকাউন্ট, একই অ্যাকাউন্টের একাধিক ডোনার আইডি ও ইমেইল-সূচি পরীক্ষা করা হচ্ছে… কিছুই বদলানো হবে না যতক্ষণ না আপনি নিশ্চিত করেন।</p>`,
        `<button class="btn gh" data-close>বন্ধ করুন</button>`);
      const rep=await runDedupeScan(false);
      if(!rep.ok){
        sh.close();
        uiAlert(rep.error||"স্ক্যান করা যায়নি।",{type:"error",title:"ব্যর্থ হয়েছে"});
        return;
      }
      const fixable=rep.groups.filter(g=>g.kind!=="donor-phone");
      const listHtml=rep.groups.length?`<div style="display:flex;flex-direction:column;gap:8px">${rep.groups.map(g=>{
        const label=g.kind==="user-email"?"অ্যাকাউন্ট (একই ইমেইল)":g.kind==="donor-owner"?"ডোনার আইডি (একই অ্যাকাউন্ট)":"ফোন নম্বর (ম্যানুয়াল পর্যালোচনা)";
        const rem=g.remove.map(r=>esc(r.name||r.id)+(r.email?` (${esc(r.email)})`:"")).join(", ");
        return `<div class="card" style="padding:10px 12px">
          <b style="font-size:.86rem">${label}</b>
          <div style="font-size:.78rem" class="mut">রাখা হবে: <b>${esc(g.keep.name||g.keep.id)}</b>${g.keep.email?` · ${esc(g.keep.email)}`:""}</div>
          <div style="font-size:.78rem" class="mut">মুছে/মেলানো হবে: ${rem||"—"}${g.filledFields.length?` · পূরণ হবে: ${bn(g.filledFields.length)} ফিল্ড`:""}</div>
        </div>`;
      }).join("")}</div>`:`<p style="font-size:.86rem">✓ কোনো duplicate পাওয়া যায়নি — সব অ্যাকাউন্ট ও ডোনার আইডি ইউনিক।</p>`;
      const notesHtml=rep.notes.length?`<div style="margin-top:10px">${rep.notes.map(n=>`<p class="mut" style="font-size:.75rem">• ${esc(n)}</p>`).join("")}</div>`:"";
      const indexNote=rep.scanned.emailsIndexed?`<p class="mut" style="font-size:.75rem;margin-top:8px">ইমেইল-সূচিতে ${bn(rep.scanned.emailsIndexed)}টি অ্যাকাউন্ট যোগ হবে (ভবিষ্যতে duplicate সনাক্তকরণে সহায়ক)।</p>`:"";
      const body=`<p class="mut" style="font-size:.78rem">স্ক্যান সম্পন্ন — অ্যাকাউন্ট: ${bn(rep.scanned.users)}, ডোনার আইডি: ${bn(rep.scanned.donors)}</p>
        <div style="margin-top:10px">${listHtml}</div>${notesHtml}${indexNote}`;
      const footer=fixable.length
        ?`<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="dd_apply">নিরাপদে পরিষ্কার করুন</button>`
        :`<button class="btn" data-close>ঠিক আছে</button>`;
      sh.close();
      const sh2=sheet("ডুপ্লিকেট যাচাই — ফলাফল",body,footer);
      const applyBtn=sh2.q("#dd_apply");
      if(applyBtn)applyBtn.onclick=async()=>{
        applyBtn.disabled=true;applyBtn.innerHTML="পরিষ্কার করা হচ্ছে…";
        const rep2=await runDedupeScan(true).catch(e=>({ok:false,error:e&&e.message}));
        if(!rep2.ok){
          applyBtn.disabled=false;applyBtn.innerHTML="নিরাপদে পরিষ্কার করুন";
          uiAlert(rep2.error||"পরিষ্কার করা যায়নি।",{type:"error",title:"ব্যর্থ হয়েছে"});
          return;
        }
        sh2.close();
        toast(`পরিষ্কার সম্পন্ন — ${bn(rep2.changedPaths)}টি রেকর্ড আপডেট হয়েছে`,"ok");
        renderSub("team");renderSub("donorid");
      };
    }catch(e){
      console.warn("dedupe:",e&&e.message);
      try{sh&&sh.close();}catch(_e){}
      uiAlert("স্ক্যান করা যায়নি — আবার চেষ্টা করুন।",{type:"error",title:"ব্যর্থ হয়েছে"});
    }
  }

  /* ---------- ডোনার ব্যবস্থাপনা — শুধু অ্যাকাউন্ট-ওয়ালা ডোনার ---------- */
  SUBP.team=el=>{
    /* ডেটা না আসা পর্যন্ত স্কেলিটন — "কোনো ডোনার নেই"/ভুল তালিকা নয় */
    if(!dataReady("donors","users")){el.innerHTML=skelRows(4);return}
    const rows=donorManageRows(false);
    el.innerHTML=donorManageHtml(rows,teamSel,
      "কোনো ডোনার নেই","অ্যাকাউন্ট-ওয়ালা অনুমোদিত রক্তদাতারা এখানে দেখা যাবেন");
    wireDonorManage(el,rows,teamSel,"account");
  };

  /* ---------- ডোনার আইডি ব্যবস্থাপনা — সব ডোনার আইডি (অ্যাকাউন্ট ছাড়াও) ----------
     Someone with a Donor ID is anyone who has a `donors/{donorId}` record;
     having a Website/Firebase অ্যাকাউন্ট প্রয়োজন হয় না। একই কার্ড-ডিজাইন;
     ডিলিট scope "donor" — Donor ID ও ডোনার-সম্পর্কিত রেকর্ড মোছে এবং
     একই ব্যক্তির (সার্ভারে যাচাইকৃত) লগইন অ্যাকাউন্ট (Firebase Authentication)
     যুক্ত থাকলে সেটিও মোছে। আলাদা/অমিল অ্যাকাউন্ট কখনোই স্পর্শ হয় না। */
  SUBP.donorid=el=>{
    if(!dataReady("donors")){el.innerHTML=skelRows(4);return}
    const rows=donorManageRows(true);
    el.innerHTML=donorManageHtml(rows,donorIdSel,
      "কোনো ডোনার আইডি নেই","সব ডোনার আইডি এখানে দেখা যাবেন — অ্যাকাউন্ট ছাড়াও");
    wireDonorManage(el,rows,donorIdSel,"donor");
  };

  /* ══════════ নিরাপদ সার্ভার-ভিত্তিক ডিলিট (একক + bulk) ══════════
     ব্রাউজার আর নিজে কিছু মোছে না — লগইন করা অ্যাডমিনের Firebase ID token
     নিয়ে secure server endpoint (`<base>api/admin/delete`)-এ অনুরোধ পাঠায়;
     সেখানে token + অ্যাডমিন role যাচাই করে নির্ধারিত entity-র RTDB রেকর্ড
     এবং **সংশ্লিষ্ট Firebase Authentication লগইন অ্যাকাউন্ট** মোছা হয়
     (src/lib/accountDelete.ts → server/deleteApi.ts + server/authAdmin.ts)।

       • scope "account" → users/{uid} · admins/{uid} · accounts/* + লগইন
                           (ডোনার আইডি অক্ষত)
         scope "donor"   → donors/{donorId} · members/* · queue/* এবং
                           **যুক্ত থাকলে** সংশ্লিষ্ট অ্যাকাউন্ট + লগইন
       • "ভুল account কখনো মুছবে না": লিংকড uid শুধুই সার্ভারে ডোনার রেকর্ড
         থেকে পড়া হয়; ক্লায়েন্টের uid মালিকানার সাথে না মিললে কিছুই মোছা
         হয় না; লগইন ডিলিট ব্যর্থ হলেও কিছুই মোছা হয় না।
       • লগইন ডিলিট server-side secret (service account) দিয়ে — client-এ
         কোনো private key নেই।
       • সফল হলে RTDB বদলায় → existing live listener-ই Admin panel ও Main
         Website — দুই জায়গার তালিকা/পরিসংখ্যান একসাথে realtime-এ আপডেট
         করে — কোনো page reload/full reload/loading লাগে না। */

  /** একজন ডোনারের একটি entity (অ্যাকাউন্ট বা ডোনার আইডি) — সার্ভার দিয়ে। */
  async function deleteOneEntity(d,scope){
    const result=await serverDeleteEntity({
      scope,
      donorId:String(d&&d.id||"").trim(),
      uid:String((d&&(d.ownerUid||d.uid))||"").trim(),
      name:String((d&&d.name)||"").trim()});
    if(result.ok){
      await logAudit(scope==="account"?"অ্যাকাউন্ট মুছে ফেলা":"ডোনার আইডি মুছে ফেলা",
        `${result.name||result.donorId||result.uid} · ${result.donorId||"—"}${result.uid?" · "+result.uid:""}`,"donor");
      /* লগইন অ্যাকাউন্ট কোনো কারণে মোছা না হলে (secret কনফিগার নেই ইত্যাদি)
         সার্ভারের স্পষ্ট warning-টি লুকানো হয় না — অ্যাডমিন জানতে পারবেন। */
      (result.warnings||[]).forEach(w=>toast(w,""));
      return result;
    }
    /* কিছু মোছেনি/অনুমতি নেই — স্পষ্ট কারণ দেখানো হয় (কোনো সাফল্য নয়) */
    toast(`${result.name||result.donorId||result.uid||"ডোনার"}: ${deletionMessage(result)}`,"er");
    return result;
  }

  async function bulkDeleteEntities(scope,ids){
    const isAccount=scope==="account";
    const entity=isAccount?"অ্যাকাউন্ট":"ডোনার আইডি";
    const list=DB.donors.filter(d=>ids.includes(String(d.id)));
    if(!list.length)return toast("কোনো ডোনার নির্বাচিত হয়নি","er");
    const names=list.slice(0,3).map(d=>d.name).join(", ")+(list.length>3?" সহ "+bn(list.length)+" জন":"");
    if(!await confirmS({title:list.length>1?`নির্বাচিত ${entity}গুলো মুছবেন?`:`${entity} মুছবেন?`,
      desc:isAccount
        ?`${names}-এর Website/Firebase অ্যাকাউন্ট (users/accounts/admins রেকর্ড) এবং তার লগইন অ্যাকাউন্ট (Firebase Authentication) মুছে যাবে — ডোনার আইডি ও পাবলিক ডোনার তথ্য অক্ষত থাকবে। এটি ফেরানো যাবে না।`
        :`${names}-এর ডোনার আইডি ও ডোনার-সম্পর্কিত রেকর্ড (members/queue) মুছে যাবে; একই ব্যক্তির লগইন অ্যাকাউন্ট (Firebase Authentication) যুক্ত থাকলে সেটিও মুছে যাবে। আলাদা/অমিল অ্যাকাউন্ট কখনোই মোছা হবে না। এটি ফেরানো যাবে না।`,
      ok:"হ্যাঁ, মুছুন",danger:true}))return;
    const done=[],failed=[];
    for(const d of list){
      /* প্রতিটি entity আলাদাভাবে সার্ভারে যাচাই হয় — ভুল identity অন্য
         কারও তথ্য মুছতে পারে না। */
      const result=await deleteOneEntity(d,scope).catch(e=>{
        console.warn("server delete:",d.id,e&&e.message);
        return {ok:false,scope,donorId:String(d.id||""),uid:String((d&&(d.ownerUid||d.uid))||""),
          name:d.name||d.id,rtdb:"skipped",auth:"skipped",server:"failed",
          failed:[{id:"server",label:"নিরাপদ সার্ভার অনুরোধ",ok:false,error:(e&&e.message)||"অজানা সমস্যা"}],
          steps:[],removed:0,references:{},warnings:[],error:(e&&e.message)||"অজানা সমস্যা"}
      });
      if(result.ok){done.push(result);toast("মুছে ফেলা হচ্ছে… ("+bn(done.length)+"/"+bn(list.length)+")","")}
      else failed.push(`${result.name||result.donorId||d.id}: ${deletionMessage(result)}`);
    }
    /* সবকিছু সফল হলেই success — আংশিক হলে কী কী বাকি আছে তা জানানো হয়।
       সারসংক্ষেপে লগইন (Firebase Authentication) অংশের প্রকৃত অবস্থা বলা হয়। */
    if(!failed.length){
      (isAccount?teamSel:donorIdSel).clear();
      toast(bulkDeletionMessage(done),"ok");
    }else{
      toast((done.length?bn(done.length)+" জন মুছে গেছে — ":"")+failed.slice(0,2).join(" | ")
        +(failed.length>2?" | আরও "+bn(failed.length-2)+" জন":""),"er");
    }
    /* live listener-ই তালিকা/পরিসংখ্যান আপডেট করে — reload নয় */
    renderSub(isAccount?"team":"donorid");paintNav();paintTop();
  }

  /* Team editing and the account directory use one guarded editor. This
     avoids a role being changed in one screen while its permissions remain
     stale in the other. */
  function roleSheet(uid){ roleManageSheet(uid); }
  
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
            <small>${esc(d.gender)} · ${esc(ageText(d))}</small>
          </div>
          <span class="bg2" style="width:46px;height:46px;border-radius:12px;font-size:1rem">${d.group}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:11px">
          ${d.suspended?`<span class="pill r">স্থগিত</span>`
            :ready?`<span class="pill g">রক্ত দিতে প্রস্তুত</span>`
            :rest?`<span class="pill m">বিশ্রামে · ${bn(rest)} দিন বাকি</span>`
            :`<span class="pill a">নিজে বন্ধ রেখেছেন</span>`}
          ${d.verified?`<span class="pill b">যাচাইকৃত</span>`:`<span class="pill a">যাচাই বাকি</span>`}
          <span class="tag">${bn(d.donations)} জীবন বাঁচিয়েছেন</span>
          ${d.totalBags?`<span class="tag b">${bn(d.totalBags)} ব্যাগ</span>`:""}
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
        <button class="r"><b>${bn(d.donations)}</b><span>জীবন বাঁচিয়েছেন</span></button>
        <button class="b"><b>${bn(d.totalBags||0)}</b><span>মোট ব্যাগ</span></button>
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
        ${dRow("জন্ম তারিখ",d.dob?dL(d.dob):"—","dob",ro)}
        ${dRow("বয়স",ageText(d),null,true)}
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
          <span class="tx"><b>${esc(x.place)}</b><small>${dL(x.date)} · ${bn(x.bags)} ব্যাগ · ${bn(1)} জীবন</small></span>
          ${x.proof?`<span class="rt"><img src="${esc(x.proof)}" alt="প্রমাণ" style="width:30px;height:30px;border-radius:8px;object-fit:cover"></span>`:`<span class="rt" style="color:var(--grn)">${SI.checkC(16)}</span>`}
        </div>`).join("")}</div>`
        :`<div class="card">${emptyBox("drop","কোনো রক্তদানের রেকর্ড নেই",
          d.donations?"পুরনো "+bn(d.donations)+" দানের বিস্তারিত নেই":"এখনো রক্ত দেননি")}</div>`}
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
      body.querySelectorAll("[data-dtg]").forEach(b=>b.onclick=async()=>{
        const k=b.dataset.dtg;
        d[k]=!d[k];b.classList.toggle("on",d[k]);
        logAudit(({available:"প্রাপ্যতা",verified:"যাচাই",suspended:"স্থগিত"})[k]+" পরিবর্তন",d.id,"donor");
        try{await persist();}catch(e){restoreLastPersistedDB();paint();return toast("হালনাগাদ সংরক্ষণ করা যায়নি","er");}
        paint();toast("হালনাগাদ হয়েছে","ok")});
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
    /* কোনো রেকর্ড বানিয়ে নেওয়া হয় না — ডাটাবেসে যা আছে শুধু তা-ই দেখানো হয়।
       Approved donations এখন RTDB `donations` node-তে থাকে (report/সব জায়গায় এক উৎস)। */
    const approved=DB.donations.filter(r=>String(r.donorId||r.id)===String(d.id||""));
    return approved.length?approved.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))):[];
  }
  function donorReqs(d){
    return DB.live.filter(r=>CAN_GIVE[d.group].includes(r.group)&&r.area===d.area);
  }
  function editDonorField(d,key){
    const F={
      name:{t:"নাম",type:"text"},gender:{t:"লিঙ্গ",type:"select",options:["পুরুষ","মহিলা"]},
      dob:{t:"জন্ম তারিখ",type:"date"},phone:{t:"মোবাইল",type:"text",max:11},
      group:{t:"রক্তের গ্রুপ",type:"select",options:GROUPS},
      area:{t:"এলাকা",type:"select",options:AREAS},
      last:{t:"সর্বশেষ রক্তদান",type:"date"}
    }[key];
    const cur=d[key];
    const s=sheet(F.t+" বদলান",`<div class="f"><label>${esc(F.t)}</label>
      ${F.type==="select"?`<select id="di">${F.options.map(o=>
          `<option ${o===cur?"selected":""}>${esc(o)}</option>`).join("")}</select>`
        :F.type==="date"?`<input id="di" type="date" value="${esc(cur||"")}" max="${iso(now())}">`
        :`<input id="di" type="${F.type}" value="${esc(cur||"")}" ${F.max?`maxlength="${F.max}"`:""}>`}
      </div>`,`<button class="btn gh" data-close>বাতিল</button><button class="btn" id="dok">সংরক্ষণ</button>`);
    s.q("#dok").onclick=async()=>{
      let v=s.q("#di").value.trim();
      if(key==="name"&&v.length<3)return toast("নাম খুব ছোট","er");
      if(key==="phone"&&!phoneOK(v))return toast("সঠিক নম্বর দিন","er");
      if(key==="dob"){
        if(!isValidDob(v))return toast("সঠিক জন্ম তারিখ দিন","er");
        const a=ageFromDob(v);
        if(a===null||a<DB.rules.minAge||a>DB.rules.maxAge)
          return toast(`জন্ম তারিখ অনুযায়ী বয়স ${bn(DB.rules.minAge)}–${bn(DB.rules.maxAge)} বছরের মধ্যে হতে হবে`,"er");
      }
      d[key]=v;logAudit("ডোনার তথ্য সম্পাদনা — "+F.t,d.id,"donor");
      try{await persist();}catch(e){restoreLastPersistedDB();return toast("ডোনার তথ্য সংরক্ষণ করা যায়নি","er");}
      s.close();renderSub("donor");toast("সংরক্ষণ হয়েছে","ok")};
  }
  function donorAction(a,d){
    if(a==="edit"){dvTab="info";renderSub("donor");return}
    if(a==="addDon"){
      const s=sheet("রক্তদান যোগ করুন",`<div class="f">
        <label>তারিখ</label><input id="ad_d" type="date" value="${iso(now())}" max="${iso(now())}">
        <label>স্থান</label><input id="ad_p">
        <label>ব্যাগ</label><input id="ad_b" type="number" value="1" min="1" max="3"></div>`,
        `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ad_ok">যোগ করুন</button>`);
      s.q("#ad_ok").onclick=async()=>{
        const dt=s.q("#ad_d").value,pl=s.q("#ad_p").value.trim()||"অজানা স্থান";
        if(!dt)return toast("তারিখ দিন","er");
        const bags=Math.max(1,Math.floor(Number(s.q("#ad_b").value)||1));
        const record={id:safeDonationId(d.ownerUid||"",dt,pl),
          donorId:d.id,ownerUid:Object(d).ownerUid||"",name:d.name,group:d.group,area:d.area,
          photo:d.photo,phone:d.phone,place:pl,date:dt,bags,proof:"",patient:"",note:"",
          livesSaved:1,approvedAt:nowIso(),approvedBy:ME.name||"অ্যাডমিন",updatedAt:nowIso(),source:"admin"};
        logAudit("রক্তদান যোগ",d.id+" — "+dL(dt)+" · "+bn(bags)+" ব্যাগ","donation");
        try{
          await saveApprovedDonation(record,{id:record.id,date:"",place:""});
          await persist();
        }catch(e){restoreLastPersistedDB();return toast("রক্তদান সংরক্ষণ করা যায়নি","er");}
        s.close();renderSub("donor");toast("রক্তদান যোগ হয়েছে — পরিসংখ্যান হালনাগাদ হয়েছে","ok")};
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
          <span class="tx"><b style="color:var(--red-d)">মুছে ফেলুন</b><small>শুধু অ্যাডমিন পারেন</small></span></button>`:""}
      </div>`,`<button class="btn gh w" data-close>বন্ধ</button>`);
      s.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{
        const m=b.dataset.m;s.close();
        if(m==="verify"){d.verified=!d.verified;
          logAudit(d.verified?"ডোনার যাচাই":"যাচাই বাতিল",d.id,"donor");
          try{await persist();}catch(e){restoreLastPersistedDB();return toast("হালনাগাদ সংরক্ষণ করা যায়নি","er");}
          renderSub("donor");toast("হালনাগাদ হয়েছে","ok")}
        if(m==="susp"){
          if(!await confirmS({title:d.suspended?"স্থগিত তুলবেন?":"অ্যাকাউন্ট স্থগিত?",
            desc:d.suspended?"আবার পাবলিক তালিকায় দেখা যাবে।":"পাবলিক তালিকা থেকে লুকানো হবে।",
            danger:!d.suspended}))return;
          d.suspended=!d.suspended;logAudit(d.suspended?"ডোনার স্থগিত":"স্থগিত প্রত্যাহার",d.id,"donor");
          try{await persist();}catch(e){restoreLastPersistedDB();return toast("হালনাগাদ সংরক্ষণ করা যায়নি","er");}
          renderSub("donor");toast("হালনাগাদ হয়েছে","ok")}
        if(m==="flag"){
          const fs=sheet("অ্যাডমিনের নজরে আনুন",
            `<p class="hint2" style="margin-bottom:9px">কেন এই রক্তদাতাকে অ্যাডমিনের দেখা দরকার তা লিখুন।
               এটি অপেক্ষমাণ কাজে রিপোর্ট হিসেবে যুক্ত হবে।</p>
             <textarea id="fl_t" rows="3"></textarea>`,
            `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="fl_ok">${SI.send(15)} পাঠান</button>`);
          fs.q("#fl_ok").onclick=async()=>{
            const t=fs.q("#fl_t").value.trim();
            if(!t)return toast("কারণ লিখতে হবে","er");
            DB.queue.unshift({kind:"report",id:"RP-"+(600+DB.queue.length),name:d.name,
              type:"মডারেটরের রিপোর্ট",text:t+" ("+d.id+")",at:new Date().toISOString()});
            logAudit("অ্যাডমিনের নজরে আনা",d.id,"report");
            try{await persist();}catch(e){restoreLastPersistedDB();return toast("রিপোর্ট সংরক্ষণ করা যায়নি","er");}
            fs.close();paintTop();paintNav();toast("অ্যাডমিনকে জানানো হয়েছে","ok")};
        }
        if(m==="copy"){
          const t=`${d.name}\n${d.group} · ${d.area}\n${maskPhone(d.phone)}\n${d.id}`;
          navigator.clipboard?.writeText(t).then(()=>toast("কপি হয়েছে","ok"),()=>toast("কপি করা যায়নি","er"))}
        if(m==="csv"){
          dlFile(`${d.id}.csv`,toCSV([[d.id,d.name,d.group,d.area,maskPhone(d.phone),d.dob||"",ageText(d),d.gender,
            d.last,d.donations,d.totalBags||0,d.suspended?"স্থগিত":"সক্রিয়"]],
            ["আইডি","নাম","গ্রুপ","এলাকা","ফোন","জন্ম তারিখ","বয়স","লিঙ্গ","শেষ দান","জীবন বাঁচিয়েছেন","মোট ব্যাগ","অবস্থা"]));
          logAudit("প্রোফাইল রপ্তানি",d.id,"data");toast("ফাইল নামছে","ok")}
        if(m==="del"){
          if(!await confirmS({title:"ডোনার আইডি স্থায়ীভাবে মুছবেন?",
            desc:"এই ডোনার আইডি ও ডোনার-সম্পর্কিত রেকর্ড মুছে যাবে; একই ব্যক্তির লগইন অ্যাকাউন্ট (Firebase Authentication) যুক্ত থাকলে সেটিও মুছে যাবে। আলাদা/অমিল অ্যাকাউন্ট কখনোই মোছা হবে না। সাধারণত স্থগিত করাই ভালো — মুছলে ফেরানো যায় না।",
            ok:"মুছে ফেলুন",danger:true}))return;
          /* নিরাপদ সার্ভার ডিলিট (scope "donor") — সংশ্লিষ্ট লগইন অ্যাকাউন্টও
             সার্ভারে যাচাই হয়ে মোছা হয়; আলাদা/অমিল অ্যাকাউন্ট স্পর্শ হয় না */
          const delResult=await deleteOneEntity(d,"donor").catch(e=>{
            console.warn("server delete:",d.id,e&&e.message);
            toast(describeDeletionFailure(d.name||d.id,
              [{id:"server",label:"নিরাপদ সার্ভার অনুরোধ",ok:false,error:(e&&e.message)||"অজানা সমস্যা"}]),"er");
            return {ok:false} as ReturnType<typeof deleteOneEntity> extends Promise<infer R>?R:never;
          });
          if(!delResult||!delResult.ok)return;
          (delResult.warnings||[]).forEach(w=>toast(w,""));
          /* live listener-ই তালিকা ও পরিসংখ্যান আপডেট করে — কোনো reload নয় */
          go(CUR,"donors");toast(deletionMessage(delResult),"ok")}
      });
    }
  }
  
  /* ══════════════════════════════════════════════════════════════
     ACCESS & ROLES  —  grant panel access to an existing account
  
     Admin reaches this page. It lists every account in the system (team
     members and ordinary users alike), searchable by name, @username or email,
     and lets one be promoted or demoted.
  
     Deliberate rules, all enforced here and echoed in the audit log:
       • you cannot change your own role
       • admin is the highest role and has full access
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

  
  const ROLE_ORDER=["user","mod","admin"];
  const ROLE_META={
    user:{label:"ডোনার",icon:"🩸",desc:"Doner Panel ব্যবহার করতে পারবেন"},
    mod:{label:"মডারেটর",icon:"🔧",desc:"অপেক্ষমাণ আবেদন যাচাই ও অনুমোদন করবেন"},
    admin:{label:"অ্যাডমিন",icon:"🛡️",desc:"Full Access — পুরো website ও Admin Panel control করবেন"}
  };
  const GRANTABLE=["user","mod","admin"];
  const normRole=r=>{r=String(r||"user").toLowerCase();return r==="admin"?"admin":(r==="moderator"||r==="mod")?"mod":"user"};
  const roleLabel=r=>(ROLE_META[normRole(r)]||{}).label||r;
  const roleIcon=r=>(ROLE_META[normRole(r)]||{}).icon||"🩸";
  const isStaff=r=>{r=normRole(r);return r&&r!=="user"};
  
  let acFilter="all", acQuery="";
  
  /* ══════════════════════════════════════════════════════════════
     অ্যাক্সেস ও ভূমিকা — সম্পূর্ণ নতুন রূপ
     ──────────────────────────────────────────────────────────────
     • মূল তালিকায় শুধু: প্রোফাইল ছবি, নাম, Username, Email এবং
       বর্তমান Role (অ্যাডমিন / ডোনার / মডারেটর) — কোনো UID, Donor ID বা
       অতিরিক্ত অ্যাকাউন্ট তথ্য দেখানো হয় না।
     • কোনো সদস্যের উপর ক্লিক করলে শুধুই ভূমিকা পরিবর্তনের interface খোলে —
       পুরোনো অ্যাকাউন্ট তথ্য / Existing permissions ভিউ আর নেই।
     • Permission-based access সিস্টেম সম্পূর্ণ রিমুভ করা হয়েছে; ভূমিকা ৩টি:
       অ্যাডমিন, মডারেটর, ডোনার — প্রয়োজন অনুযায়ী পরিবর্তন করা যায়।
     • নিচে শুধু ৩টি বোতাম: বাতিল / সংরক্ষণ / ডিলিট। ডিলিট করলে
       নিশ্চিতকরণের পরে ওই সদস্যের Firebase Authentication account এবং
       সংশ্লিষ্ট সকল Realtime Database তথ্য মুছে যায়
       (নিজের হলে client SDK; অন্যের হলে Firebase Console)।
     ══════════════════════════════════════════════════════════════ */
  const ROLE_SORT={admin:0,mod:1,user:2};
  SUBP.access=el=>{
    if(!can("access.manage"))return el.innerHTML=noPerm();
    /* users + admins listener-এর প্রথম snapshot না আসা পর্যন্ত স্কেলিটন —
       খালি তালিকা ("কেউ মেলেনি") বা ফাঁকা প্রোফাইল দেখানো যাবে না। */
    if(!accountsReady()){el.innerHTML=skelRows(4);return}
    DB.accounts.forEach(a=>{a.role=normRole(a.role)});
    const q=acQuery.trim().toLowerCase();
    let list=DB.accounts.filter(a=>{
      if(!q)return true;
      return [a.name,a.username,a.email].join(" ").toLowerCase().includes(q);
    });
    /* ভূমিকার ক্রম (অ্যাডমিন → মডারেটর → ডোনার), তারপর নাম অনুযায়ী */
    list.sort((a,b)=>(ROLE_SORT[a.role]-ROLE_SORT[b.role])
      ||String(a.name||a.email||"").localeCompare(String(b.name||b.email||""),"bn"));

    el.innerHTML=`
      <div class="note i">${SI.info(17)}<span>প্রতিটি সদস্যের ভূমিকা পরিবর্তন করা যায় — অ্যাডমিন, মডারেটর বা ডোনার।
        তালিকা থেকে একজন সদস্যকে নির্বাচন করুন।</span></div>
      <div class="f"><input id="acq"
        value="${esc(acQuery)}" placeholder="নাম, ইউজারনেইম বা ইমেইল দিয়ে খুঁজুন…" autocomplete="off"></div>`
    +(list.length
      ? `<div class="card pad0">${list.map(a=>`<button class="prow" data-ac="${a.uid}">
          ${a.photo?`<img src="${esc(a.photo)}" alt="" style="width:40px;height:40px;border-radius:11px;object-fit:cover;background:var(--card2)">`
            :`<span class="bg2" style="${isStaff(a.role)
              ?"background:var(--grn-s);color:var(--grn)":"background:var(--card2);color:var(--mut)"};font-size:1.05rem">${roleIcon(a.role)}</span>`}
          <span class="tx"><b>${esc(a.name||a.email||"—")}${a.uid===ME.uid?" (আপনি)":""}</b>
            <small>@${esc(a.username||"—")} · ${esc(a.email||"—")}</small></span>
          <span class="tag ${a.role==="admin"?"g":""}">${roleLabel(a.role)}</span>
        </button>`).join("")}</div>`
      : `<div class="card">${emptyBox("search","কেউ মেলেনি","অন্য নাম, ইউজারনেইম বা ইমেইল দিয়ে চেষ্টা করুন")}</div>`);

    let t;
    $("#acq").oninput=e=>{acQuery=e.target.value;clearTimeout(t);
      t=setTimeout(()=>{renderSub("access");
        const i=$("#acq");i.focus();i.setSelectionRange(i.value.length,i.value.length)},280)};
    el.querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>roleManageSheet(b.dataset.ac));
  };

  /* Role Management — শুধুই ভূমিকা পরিবর্তন (কোনো অ্যাকাউন্ট তথ্য বা
     permission তালিকা নেই)। নিচে ৩টি বোতাম: বাতিল / সংরক্ষণ / ডিলিট। */
  async function roleManageSheet(uid){
    const a=DB.accounts.find(x=>String(x.uid)===String(uid));if(!a)return;
    a.role=normRole(a.role);
    const isMe=String(uid)===String(ME.uid);
    let pick=a.role;
    const roleHint=r=>r==="admin"?"অ্যাডমিন — সম্পূর্ণ ওয়েবসাইট ও অ্যাডমিন প্যানেলের পূর্ণ নিয়ন্ত্রণ":
      r==="mod"?"মডারেটর — অপেক্ষমাণ আবেদন যাচাই ও অনুমোদন":"ডোনার — ডোনার প্যানেল ব্যবহার করেন";
    const body=()=>`<div class="per">
        ${a.photo?`<img src="${esc(a.photo)}" alt="" style="width:46px;height:46px;border-radius:12px;object-fit:cover">`
          :`<span class="bg2" style="width:46px;height:46px;border-radius:12px;background:var(--grn-s);color:var(--grn);font-size:1.15rem">${roleIcon(pick)}</span>`}
        <div class="i"><b>${esc(a.name||"—")}</b><small>${esc(a.email||"—")}</small></div></div>
      ${isMe?`<div class="note w">${SI.warn(17)}<span>নিরাপত্তার জন্য নিজের ভূমিকা বা অ্যাকাউন্ট নিজে পরিবর্তন/মুছে ফেলা যায় না।</span></div>`:""}
      <div class="sec-t">বর্তমান ভূমিকা</div>
      <div class="card" style="padding:11px 13px"><b>${roleLabel(a.role)}</b></div>
      <div class="sec-t">নতুন ভূমিকা</div>
      <div class="strip wrap chips" id="acr">${GRANTABLE.map(r=>`<button data-r="${r}" class="${pick===r?"on":""}" ${isMe?"disabled":""}>${ROLE_META[r].icon} ${ROLE_META[r].label}</button>`).join("")}</div>
      <p class="hint2" style="margin-top:8px">${roleHint(pick)}</p>`;
    const s=sheet("অ্যাক্সেস ও ভূমিকা",body(),
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="acok" ${isMe?"disabled":""}>${SI.key(15)} সংরক্ষণ</button>
       <button class="btn red" id="acdelete" ${isMe?"disabled":""}>${SI.trash(15)} ডিলিট</button>`);
    s.querySelectorAll("#acr button").forEach(b=>b.onclick=()=>{
      if(isMe)return;
      pick=b.dataset.r;
      s.querySelectorAll("#acr button").forEach(x=>x.classList.toggle("on",x===b));
      const hint=s.querySelector(".hint2");
      if(hint)hint.textContent=roleHint(pick);
    });
    s.q("#acdelete")?.addEventListener("click",async()=>{
      const ok=await deleteManagedAccount(uid);
      if(ok)s.close();
    });
    s.q("#acok")?.addEventListener("click",async()=>{
      if(pick===a.role){s.close();return}
      const roleValue=pick==="admin"?"admin":pick==="mod"?"moderator":"donor";
      /* প্যানেলের মেনু দেখানোর অভ্যন্তরীণ ডিফল্ট তালিকা — আলাদা করে
         কারও জন্য permission কাস্টমাইজ করার সুযোগ আর নেই। */
      const permissionList=pick==="user"?[]:(pick==="admin"?PERMS.slice():ROLES.mod.perms.slice());
      const btn=s.q("#acok");btn.disabled=true;
      try{
        /* ══ Existing account information কখনো overwrite করা হয় না ══
           লেখার আগে RTDB-র সর্বশেষ users/admins রেকর্ড পড়া হয়; যে কোনো
           ফিল্ডের মান খালি থাকলে সেটি লেখাই হয় না (ফলে আগের মান অক্ষত থাকে)।
           এতে Name/Username/Email/UID/Donor ID/Mobile/Photo — কোনোটিই মোছে
           যায় না বা empty হয় না, শুধু role ও permission আপডেট হয়। */
        const liveUser=accountUsers.find(u=>String(u.uid||u.id)===String(uid))
          ||await getRow(NODES.users,String(uid)).catch(()=>null)||null;
        const liveAdmin=accountAdmins.find(x=>String(x.uid||x.id)===String(uid))
          ||await getRow(NODES.admins,String(uid)).catch(()=>null)||null;
        const firstFilled=(...vals)=>{for(const v of vals){const t=String(v??"").trim();if(t)return t}return ""};
        const identity={
          name:firstFilled(a.name,liveAdmin&&liveAdmin.name,liveUser&&liveUser.name),
          username:firstFilled(a.username,liveAdmin&&liveAdmin.username,liveUser&&liveUser.username),
          email:firstFilled(a.email,liveAdmin&&liveAdmin.email,liveUser&&liveUser.email),
          photo:firstFilled(a.photo,liveAdmin&&(liveAdmin.photo||liveAdmin.photoURL),liveUser&&(liveUser.photo||liveUser.photoURL)),
          designation:firstFilled(liveAdmin&&liveAdmin.designation,liveUser&&liveUser.designation)
        };
        const paths={[`users/${uid}/role`]:roleValue};
        if(pick==="user"){
          paths[`${NODES.admins}/${uid}`]=null;
          /* স্টাফ রেকর্ডে থাকা পরিচয়মূলক তথ্য users/{uid}-এ নেই সেগুলো আগে
             কপি করে নেওয়া হয় — demote করলে কোনো তথ্য হারিয়ে যায় না। */
          ["name","username","email","designation","photo"].forEach(k=>{
            if(identity[k]&&!String((liveUser&&liveUser[k])||"").trim())paths[`users/${uid}/${k}`]=identity[k];
          });
        }else{
          /* admins/{uid} — merge আপডেট (rtdbUpdate), তাই অন্য ফিল্ড অক্ষত থাকে;
             খালি মান কখনো লেখা হয় না (আগের মান overwrite হয় না)। */
          const staff={uid:String(uid),role:roleValue,permissions:permissionList,
            status:String((liveAdmin&&liveAdmin.status)||a.status||"active"),updatedAt:nowIso()};
          Object.keys(identity).forEach(k=>{if(identity[k])staff[k]=identity[k]});
          paths[`${NODES.admins}/${uid}`]=staff;
        }
        await updatePaths(paths);
        /* লোকাল state-এ শুধু role/permission বদলাই — বাকি তথ্য অপরিবর্তিত */
        a.role=pick;a.permissions=permissionList;
        ["name","username","email","photo"].forEach(k=>{if(identity[k])a[k]=identity[k]});
        const ti=DB.team.findIndex(t=>String(t.uid)===String(uid));
        if(pick==="user"){if(ti>=0)DB.team.splice(ti,1);}
        else {const entry={uid:String(uid),name:a.name||"",username:a.username||"",email:a.email||"",photo:a.photo||"",role:pick,status:a.status||"active",permissions:permissionList,last:nowIso()};ti<0?DB.team.push(entry):Object.assign(DB.team[ti],entry);}
        await logAudit("ভূমিকা পরিবর্তন",`${a.name||a.email||uid} · ${roleLabel(pick)}`,"access");
        s.close();
        /* শুধু বর্তমান স্ক্রিনটি আবার আঁকা হয় (ডেটা রিলোড নয়) — অন্য
           প্যানেল/ডিভাইসে RTDB listener-ই realtime-এ নতুন ভূমিকা আনে। */
        try{renderSub(SUB==="team"?"team":"access")}catch(e){}
        paintNav();paintTop();
        toast("ভূমিকা হালনাগাদ হয়েছে","ok");
      }catch(e){btn.disabled=false;console.warn("role update:",e&&e.message);toast("ভূমিকা হালনাগাদ করা যায়নি — আবার চেষ্টা করুন","er");}
    });
  }

  /* সম্পূর্ণ অ্যাকাউন্ট ডিলিট — Realtime Database-এর অ্যাকাউন্ট রেকর্ড
     (users/admins/accounts) **এবং সংশ্লিষ্ট Firebase Authentication লগইন
     অ্যাকাউন্ট** নিরাপদ server endpoint দিয়ে মোছা হয় (src/lib/accountDelete.ts
     → server/deleteApi.ts + server/authAdmin.ts)। লগইন ডিলিট server-side
     secret দিয়ে হয় — client-এ কোনো private key নেই। ডোনার আইডি অক্ষত থাকে। */
  async function deleteManagedAccount(uid){
    if(!can("access.manage")||String(uid)===String(ME.uid)){toast("নিজের অ্যাকাউন্ট মুছতে পারবেন না","er");return false}
    const a=DB.accounts.find(x=>String(x.uid)===String(uid));
    if(!a)return false;
    if(String(uid)&&!isAuthUid(uid)){
      toast("অ্যাকাউন্টের UID সঠিক নয় — ভুল তথ্য দিয়ে কিছু মোছা হবে না","er");return false;
    }
    if(!await confirmS({title:"অ্যাকাউন্ট মুছবেন?",
      desc:`${a.name||a.email||uid}-এর Website/Firebase অ্যাকাউন্ট (users/accounts/admins রেকর্ড) এবং লগইন অ্যাকাউন্ট (Firebase Authentication) স্থায়ীভাবে মুছে যাবে — ডোনার আইডি ও পাবলিক ডোনার তথ্য অক্ষত থাকবে। এটি ফেরানো যাবে না।`,
      ok:"অ্যাকাউন্ট মুছুন",danger:true}))return false;
    try{
      /* Account ও Donor ID দুটি স্বাধীন entity — শুধু অ্যাকাউন্ট মোছা হয়
         (scope "account"), ডোনার আইডি কোনোভাবেই স্পর্শ করা হয় না। */
      const result=await serverDeleteEntity({scope:"account",uid:String(uid),donorId:"",name:a.name||""});
      if(!result.ok){
        toast(`${a.name||a.email||uid}: ${deletionMessage(result)}`,"er");
        return false;
      }
      await logAudit("অ্যাকাউন্ট মুছে ফেলা",`${a.name||a.email||uid} — লগইন সহ (ডোনার আইডি অক্ষত)`,"access");
      (result.warnings||[]).forEach(w=>toast(w,""));
      toast(deletionMessage(result),"ok");
      return true;
    }catch(e){
      console.warn("account deletion:",e&&e.message);
      toast(describeDeletionFailure(a.name||a.email||uid,
        [{id:"server",label:"নিরাপদ সার্ভার অনুরোধ",ok:false,error:(e&&e.message)||"অজানা সমস্যা"}]),"er");
      return false;
    }
  }
  
  /* ---------- website editor + live preview ---------- */
  /* ওয়েবসাইট সেটিংস → Main Website-এর src/config/site.ts (সরাসরি কানেকশন)।
     এই মানগুলো আর Realtime Database-এ যায় না — dev সার্ভারের ছোট endpoint-এ
     পাঠানো হয় (vite.config.ts-এর cbdcSiteConfig middleware), সেখান থেকে
     সরাসরি src/config/site.ts আপডেট হয়। ফাইল বদলালে Vite HMR-এর কারণে
     Main Website-এ পরিবর্তন সঙ্গে সঙ্গে দেখা যায়। */
  async function saveSiteToSource(s){
    try{
      const res=await fetch(appBase()+"__admin/site-config",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({heroTitle:s.heroTitle,heroText:s.heroText,phone:s.phone,
          email:s.email,address:s.address,facebook:s.facebook,
          showStats:!!s.showStats,showGallery:!!s.showGallery,showEmergency:!!s.showEmergency})});
      const data=await res.json().catch(()=>null);
      return !!(data&&data.ok);
    }catch(e){console.warn("site config save:",e&&e.message);return false}
  }
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
      <div><b>${bn(DB.donors.reduce((a,d)=>a+d.donations,0))}</b><span>জীবন বাঁচিয়েছেন</span></div>
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
    el.querySelectorAll("[data-tg]").forEach(c=>c.onchange=()=>{s[c.dataset.tg]=c.checked;saveSiteToSource(s);pv()});
    $("#stSave").onclick=async()=>{
      Object.assign(s,{heroTitle:$("#s_ht").value.trim(),heroText:$("#s_hx").value.trim(),
        phone:$("#s_ph").value.trim(),email:$("#s_em").value.trim(),
        address:$("#s_ad").value.trim(),facebook:$("#s_fb").value.trim()});
      /* সেভ করলে সরাসরি Main Website-এর src/config/site.ts আপডেট হয় (RTDB নয়) */
      const ok=await saveSiteToSource(s);
      if(!ok)return toast("সেভ করা যায়নি — dev সার্ভার (npm run dev) চালু নেই","er");
      logAudit("ওয়েবসাইটের তথ্য হালনাগাদ","হোমপেজ","website");
      try{await persist();}catch(e){return toast("পরিবর্তন audit RTDB-তে সংরক্ষণ করা যায়নি","er");}
      toast("ওয়েবসাইট হালনাগাদ হয়েছে","ok")};
  };
  
  /* ══════════════════════════════════════════════════════════════
     DATABASE MANAGER — Dynamic, realtime Firebase Realtime Database console
     • কোনো hardcoded node list নেই — পুরো database একটি realtime root
       listener-এ মেমরিতে (dbMirror) রাখা হয়; root-এ যা আছে সব দেখায়।
     • ভবিষ্যতে নতুন node/child যোগ হলে listener-এর মাধ্যমে স্বয়ংক্রিয়ভাবে দেখা যায়।
     • প্রতিটি node/child: দেখা, সম্পাদনা, যোগ, মুছা, rename, JSON এডিটর।
     • Realtime: অন্য কোথাও (অ্যাপ/ওয়েবসাইট/মডারেটর) পরিবর্তন হলে এখানেও সাথে সাথে
       আসে; এখানকার পরিবর্তন সব প্যানেলে যায় (একই Realtime Database)।
     • Breadcrumb + পথ কপি + পূর্ণ সার্চ (key/value/path)।
     • Security Rules পুরোপুরি কাজ করে — permission না থাকলে Firebase-ই বাধা দেবে।
     • কোনো RTDB data স্বয়ংক্রিয়ভাবে বদলানো/মুছা/মাইগ্রেট হয় না — শুধু admin-এর স্পষ্ট
       Add/Edit/Delete ক্লিকে। একমাত্র listener — পেজ ছাড়লেই go()-এর dbStop এ cleanup।
     ══════════════════════════════════════════════════════════════ */
  const DB_MAX_CHILDREN=120;
  const _DEL={};  /* sentinel: in-memory value deletion */
  let dbEl=null;            /* বর্তমান ডেটাবেস সাব-পেজ element */
  let dbMirror=null;        /* সম্পূর্ণ Realtime Database snapshot (realtime) */
  let dbState="idle";       /* idle|loading|ready|error */
  let dbErr="";             /* listener-এর সর্বশেষ error (permission ইত্যাদি) */
  let dbUnsub=null;         /* একমাত্র root listener-এর unsubscribe handle */
  let dbWatchdog=null;      /* নিরাপত্তা timer — callback না এলে "loading"-এ চিরকাল আটকে রাখবে না */
  let dbOpen=new Set();     /* expand করা node-গুলোর path */
  let dbQuery="";           /* সার্চ টেক্সট */
  let dbFocus="";           /* breadcrumb-এ ফোকাস করা path (root-relative) */

  /* একটি value-র RTDB ধরন */
  function dbType(v){
    if(v===null)return "null";
    if(Array.isArray(v))return "array";
    const t=typeof v;
    if(t==="object")return "object";
    if(t==="number")return "number";
    if(t==="boolean")return "boolean";
    if(t==="string")return "string";
    return "unknown";
  }
  /* container-এ child-সংখ্যা (circular-safe) */
  function dbCount(v){
    if(!v||typeof v!=="object")return 0;
    try{return Object.keys(v).length;}catch(e){return 0;}
  }
  /* scalar value-র সংক্ষিপ্ত প্রিভিউ (object/array এর জন্য count) */
  function dbPreview(v){
    const t=dbType(v);
    if(t==="null")return "null";
    if(t==="object"||t==="array")return `${dbCount(v)}টি আইটেম`;
    if(t==="string"){const s=v;return s.length>60?s.slice(0,60)+"…":s.length?s:'""';}
    return String(v);
  }
  function dbTypeTag(t){
    const m={object:["b","object"],array:["b","array"],string:["m","টেক্সট"],
      number:["a","সংখ্যা"],boolean:["g","বুলিয়ান"],null:["m","null"],unknown:["m","?"]};
    const [c,lb]=m[t]||["m",t];
    return `<span class="tag ${c}">${lb}</span>`;
  }
  /* child keys: array index ছাড়া বাকিগুলো সাজানো (numeric-aware) */
  function dbSortKeys(v){
    const keys=Object.keys(v||{});
    keys.sort((a,b)=>{
      const an=/^\d+$/.test(a),bn=/^\d+$/.test(b);
      if(an&&bn)return Number(a)-Number(b);
      if(an)return 1;
      if(bn)return -1;
      return a.localeCompare(b,"en",{numeric:true});
    });
    return keys;
  }
  /* ইন-মেমরি realtime snapshot (dbMirror) থেকে নির্দিষ্ট পথের value বের করো।
     path "" = পুরো root। যেকোনো গভীরতার path পর্যন্ত নামে। */
  function dbValueAt(path){
    if(!dbMirror||typeof dbMirror!=="object")return undefined;
    if(!path)return dbMirror;
    const segs=String(path).split("/");
    let cur=dbMirror;
    for(const s of segs){
      if(cur==null||typeof cur!=="object")return undefined;
      cur=cur[s];
    }
    return cur;
  }
  /* লোকাল mirror আশাবাদীভাবে আপডেট করো (server round-trip ছাড়াই তাৎক্ষণিক প্রতিক্রিয়া)।
     সাথে সাথে root listener আসল মান দিয়ে নিশ্চিত করবে। newVal===_DEL মানে মুছে ফেলা। */
  function dbApplyLocal(path,newVal){
    if(!dbMirror||typeof dbMirror!=="object")return;
    if(!path){
      if(newVal===_DEL)dbMirror={};
      else dbMirror=newVal;
      return;
    }
    const segs=String(path).split("/");
    let cur=dbMirror;
    for(let i=0;i<segs.length-1;i++){
      if(!cur[segs[i]]||typeof cur[segs[i]]!=="object"){
        if(newVal===_DEL)return;
        cur[segs[i]]={};
      }
      cur=cur[segs[i]];
    }
    const last=segs[segs.length-1];
    if(newVal===_DEL){try{delete cur[last];}catch(e){}}
    else cur[last]=newVal;
  }
  /* একমাত্র realtime root listener চালু করো — পুরো database একসাথে mirror-এ।
     আগে থেকে চললে কিছু না (duplicate listener হয় না)।
     তিনটি নিরাপত্তা যাতে UI কখনো "লোড হচ্ছে…"-এ চিরকাল আটকে না থাকে:
       (১) auth gate — current admin ছাড়া listener চালু হয় না;
       (২) settled guard — success/error একবারই settle হয়;
       (৩) watchdog — কোনো callback না এলে নির্দিষ্ট সময় পরে স্পষ্ট error দেখায়। */
  function dbEnsureListener(){
    if(dbUnsub)return;
    if(dbWatchdog){clearTimeout(dbWatchdog);dbWatchdog=null;}
    /* (১) auth gate: অ্যাডমিন সেশন প্রস্তুত না হলে listener চালু করা বৃথা —
           Firebase token ছাড়া root read কখনো সফল হবে না। */
    const au=getAuthInstance();
    if(!au||!au.currentUser){
      dbState="auth";dbErr="";dbRender();
      /* সাময়িক auth handshake হচ্ছে থাকলে একটু পরে আবার চেষ্টা করা হয় */
      dbWatchdog=setTimeout(()=>{dbWatchdog=null;if(!dbUnsub)dbEnsureListener();},1500);
      return;
    }
    dbState="loading";dbErr="";dbRender();
    let settled=false;
    /* (৩) watchdog: Firebase-কে অবশ্যই success বা error দিতে হবে। কেউ না এলে
           স্পষ্ট error + retry দেখায় — চিরকাল "লোড হচ্ছে…" নয়। */
    dbWatchdog=setTimeout(()=>{
      if(settled)return;
      dbWatchdog=null;
      if(dbUnsub){try{dbUnsub();}catch(e){}dbUnsub=null;}
      dbState="error";
      dbErr="Realtime Database থেকে কোনো সাড়া আসেনি (timeout)। নেটওয়ার্ক/Firebase সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
      dbRender();
    },10000);
    dbUnsub=watchPath("/",(v)=>{
      if(settled)return;settled=true;
      if(dbWatchdog){clearTimeout(dbWatchdog);dbWatchdog=null;}
      dbMirror=(v&&typeof v==="object")?v:{};
      dbState="ready";
      dbRender();
    },(err)=>{
      if(settled)return;settled=true;
      if(dbWatchdog){clearTimeout(dbWatchdog);dbWatchdog=null;}
      dbState="error";dbErr=(err&&err.message)||String(err);dbRender();
    });
  }
  /* listener বন্ধ করো (পেজ ছাড়ার সময়)। dbMirror রেখে দেওয়া হয় যাতে দ্রুত ফিরে
     এলে আগের state দেখায়, তারপর listener রিফ্রেশ করে। */
  function dbStop(){
    if(dbWatchdog){clearTimeout(dbWatchdog);dbWatchdog=null;}
    if(dbUnsub){try{dbUnsub();}catch(e){}dbUnsub=null;}
    dbState="idle";
  }
  /* expand/collapse (বা scalar হলে সম্পাদনা) — সবই dbMirror থেকে, কোনো পৃথক লোড নয় */
  function dbToggle(path){
    const val=dbValueAt(path);
    if(val&&typeof val==="object"){
      if(dbOpen.has(path))dbOpen.delete(path);else dbOpen.add(path);
      dbFocus=path;dbRender();scrollToNode(path);
    }else{
      dbFocus=path;dbEditSheet(path);
    }
  }
  /* tree-র ভেতরে delegated click — action আগে, toggle পরে */
  function dbClick(e){
    const actEl=e.target.closest("[data-act]");
    if(actEl){
      const a=actEl.dataset.act,p=actEl.dataset.p||"";
      if(a==="edit")dbEditSheet(p);
      else if(a==="add")dbAddSheet(p);
      else if(a==="rename")dbRenameSheet(p);
      else if(a==="del")dbDelete(p);
      else if(a==="retry")dbRefresh();
      else if(a==="addroot")dbAddSheet("");
      return;
    }
    const tg=e.target.closest("[data-toggle]");
    if(tg)dbToggle(tg.dataset.toggle);
  }
  /* রিফ্রেশ: listener বন্ধ করে আবার চালু (সম্পূর্ণ database পুনরায় sync) */
  function dbRefresh(){
    dbStop();dbMirror=null;dbState="idle";
    dbEnsureListener();
    toast("ডেটাবেস রিফ্রেশ হচ্ছে…","");
  }
  function dbRender(){
    const tree=dbEl&&dbEl.querySelector("#dbtree");
    if(tree){
      /* রেন্ডারে কোনো exception এলে #dbtree পুরোনো "loading"-এ আটকে না থেকে
         স্পষ্ট ত্রুটি দেখায় — listener-এর success callback যেন swallow না হয়। */
      let html;
      try{html=dbTreeHtml();}
      catch(e){console.error("db render:",(e&&e.message)||e);
        html=`<div class="empty"><div class="ic" style="color:var(--red)">${SI.warn(26)}</div><b>রেন্ডারে সমস্যা</b><p style="word-break:break-word">${esc((e&&e.message)||String(e))}</p></div>`;}
      tree.innerHTML=html;
    }
    const bc=dbEl&&dbEl.querySelector("#dbcrumb");
    if(bc){try{bc.innerHTML=dbCrumbHtml();}catch(e){/* breadcrumb optional */}}
  }
  /* ডায়নামিক রুট — root-এ যা আছে (dbMirror) তার keys, কোনো hardcoded list নয়।
     ভবিষ্যতে নতুন node যোগ হলে listener-এর মাধ্যমে স্বয়ংক্রিয়ভাবে এখানে আসে। */
  function dbTreeHtml(){
    if(dbQuery.trim())return dbSearchHtml();
    /* auth যাচাই হচ্ছে — admin সেশন প্রস্তুত হওয়া পর্যন্ত অপেক্ষা */
    if(dbState==="auth")
      return `<div class="empty"><div class="ic" style="color:var(--grn)">${SI.shield(26)}</div><b>Admin authentication যাচাই হচ্ছে...</b><p>অ্যাডমিন সেশন প্রস্তুত হওয়া পর্যন্ত অপেক্ষা করা হচ্ছে, তারপর ডেটাবেস লোড হবে।</p></div>`;
    /* loading — কিন্তু watchdog থাকায় চিরকাল এখানে আটকে থাকবে না */
    if(dbState==="loading"&&!(dbMirror&&Object.keys(dbMirror).length))
      return `<div class="empty"><div class="ic">${SI.refresh(26)}</div><b>লোড হচ্ছে…</b><p>সম্পূর্ণ Realtime Database realtime-এ লোড হচ্ছে। কিছুক্ষণেও সাড়া না এলে স্বয়ংক্রিয়ভাবে ত্রুটি দেখানো হবে।</p></div>`;
    if(dbState==="error"){
      const permDenied=/permission|denied|অনুমতি|access|rules/i.test(dbErr);
      const title=permDenied?"Firebase permission denied":"ডেটাবেস লোড করা যায়নি";
      const msg=permDenied
        ?"Firebase permission denied — আপনার Admin database access নেই। নিশ্চিত হোন যে Firebase Security Rules-এ root-এ admin read অনুমোদিত, আপনার admins/{uid}/role === \"admin\" আছে, এবং নতুন rules deploy করা হয়েছে।"
        :"Realtime Database থেকে সাড়া আসেনি। নেটওয়ার্ক বা Firebase সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
      return `<div class="empty"><div class="ic" style="color:var(--red)">${SI.warn(26)}</div><b>${esc(title)}</b><p style="word-break:break-word">${msg}</p><p style="font-size:.72rem;color:var(--red-d);word-break:break-word;margin-bottom:10px">${esc(dbErr)}</p><button class="btn sm" data-act="retry">${SI.refresh(15)} আবার চেষ্টা করুন</button></div>`;
    }
    const roots=dbMirror?dbSortKeys(dbMirror):[];
    if(!roots.length&&dbState==="ready")
      return `<div class="empty"><div class="ic">${SI.db(26)}</div><b>Database empty</b><p>Realtime Database-এ এখনো কোনো root node নেই (root = null বা {})।</p><button class="btn sm" data-act="addroot">${SI.plus(15)} root node যোগ করুন</button></div>`;
    return roots.map(r=>dbRowHtml(r,0,dbMirror[r])).join("");
  }
  function chevR(s){return I('<path d="M9 5l7 7-7 7"/>',s);}
  function chevD(s){return I('<path d="M5 9l7 7 7-7"/>',s);}
  function actBtn(a,p){
    const ic={edit:SI.edit(13),add:SI.plus(13),rename:SI.key(13),del:SI.trash(13)}[a];
    const tt={edit:"সম্পাদনা",add:"চাইল্ড যোগ",rename:"rename",del:"মুছুন"}[a];
    return `<button class="btn gh sm" title="${esc(tt)}" data-act="${a}" data-p="${esc(p)}" style="min-height:34px;padding:6px 8px">${ic}</button>`;
  }
  function addChildRow(path,depth){
    const pad=10+depth*16;
    return `<div style="padding:8px ${pad}px;border-bottom:1px solid var(--line);cursor:pointer" data-act="add" data-p="${esc(path)}">
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--grn);font-size:.77rem;font-weight:700">${SI.plus(13)} চাইল্ড যোগ করুন</span></div>`;
  }
  /* একটি tree row — state param নেই, সব data dbMirror থেকে (সবসময় loaded)।
     প্রতিটি row-এ data-path থাকে যাতে breadcrumb থেকে scroll করা যায়। */
  function dbRowHtml(path,depth,val){
    const key=path.split("/").pop();
    const pad=10+depth*16;
    const t=dbType(val);
    const isC=(t==="object"||t==="array");
    const open=dbOpen.has(path);
    const chev=isC?(open?chevD(13):chevR(13)):'<span style="color:var(--line)">•</span>';
    const after=isC
      ?(dbCount(val)?`<span style="color:var(--mut)">${bn(dbCount(val))}টি</span>`:`<span class="tag a">খালি</span>`)
      :`<span style="font-family:monospace;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dbPreview(val))}</span>`;
    const metaHtml=dbTypeTag(t)+after;
    const acts=actBtn("edit",path)+(isC?actBtn("add",path):"")+(depth>0?actBtn("rename",path):"")+actBtn("del",path);
    let html=`<div style="display:flex;align-items:center;gap:7px;padding:8px 10px;padding-left:${pad}px;border-bottom:1px solid var(--line);cursor:pointer" data-toggle="${esc(path)}" data-path="${esc(path)}">`
      +`<span style="flex:none;color:var(--mut);width:16px;display:grid;place-items:center;overflow:hidden">${chev}</span>`
      +`<span style="flex:none;font-weight:700;font-size:.8rem;font-family:monospace;max-width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(key)}</span>`
      +`<span style="flex:1;min-width:0;font-size:.73rem;display:flex;align-items:center;gap:6px;overflow:hidden">${metaHtml}</span>`
      +`<span style="flex:none;display:flex;gap:1px">${acts}</span>`
      +`</div>`;
    if(isC&&open){
      const keys=dbSortKeys(val);
      const shown=keys.slice(0,DB_MAX_CHILDREN);
      html+=shown.map(k=>dbRowHtml(path+"/"+k,depth+1,val[k])).join("");
      if(keys.length>DB_MAX_CHILDREN){
        const mp=10+(depth+1)*16;
        html+=`<div style="padding:7px ${mp}px;color:var(--mut);font-size:.72rem;border-bottom:1px solid var(--line)">… আরও ${bn(keys.length-DB_MAX_CHILDREN)}টি আছে (প্রথম ${bn(DB_MAX_CHILDREN)}টি দেখানো হয়েছে — সরাসরি path দিয়ে খুঁজতে উপরে সার্চ করুন)</div>`;
      }
      html+=addChildRow(path,depth+1);
    }
    return html;
  }
  /* পূর্ণ সার্চ: পুরো dbMirror ঘেঁটে key অথবা value (string/number/boolean) অথবা
     path-এর সাথে মেলায়; প্রতিটি ফলাফলে সঠিক path দেখায়। */
  function dbSearchHtml(){
    const q=dbQuery.trim().toLowerCase();
    const out=[];const seen=new Set();
    if(dbMirror&&typeof dbMirror==="object")dbCollect("",dbMirror,q,out,seen,500);
    if(!out.length){
      return `<div class="empty"><div class="ic">${SI.search(26)}</div><b>কিছু পাওয়া যায়নি</b><p>"${esc(dbQuery)}" — key, value, UID, email, নাম বা path-এ কোনো মিল নেই।</p></div>`;
    }
    out.sort((a,b)=>a.path.length-b.path.length||a.path.localeCompare(b.path));
    const shown=out.slice(0,300);
    return `<div style="padding:8px 12px;color:var(--mut);font-size:.74rem;border-bottom:1px solid var(--line)">${bn(out.length)}টি মিল ${out.length>300?`(প্রথম ${bn(300)}টি দেখানো হচ্ছে)`:""}</div>`
      +shown.map(o=>{
        const t=dbType(o.val);
        const prev=o.val&&typeof o.val==="object"?`${bn(dbCount(o.val))}টি আইটেম`:dbPreview(o.val);
        return `<div style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer" data-toggle="${esc(o.path)}" data-path="${esc(o.path)}">
          <span style="flex:none;color:var(--grn)">${SI.search(13)}</span>
          <span style="flex:none;font-weight:700;font-size:.8rem;font-family:monospace;max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.key)}</span>
          ${dbTypeTag(t)}
          <span style="flex:1;min-width:0;font-size:.72rem;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(prev)} <span style="color:var(--line)">·</span> /${esc(o.path)}</span>
          <span style="flex:none;display:flex;gap:1px">${actBtn("edit",o.path)+actBtn("del",o.path)}</span></div>`;
      }).join("");
  }
  function dbCollect(path,val,q,out,seen,limit){
    if(val&&typeof val==="object"){
      for(const k of Object.keys(val)){
        if(out.length>=limit)return;
        const cp=path?path+"/"+k:k,cv=val[k];
        const kl=String(k).toLowerCase();
        const match=kl.includes(q)||cp.toLowerCase().includes(q)||(cv!==null&&typeof cv!=="object"&&String(cv).toLowerCase().includes(q));
        if(match&&!seen.has(cp)){seen.add(cp);out.push({path:cp,key:k,val:cv});}
        if(cv&&typeof cv==="object")dbCollect(cp,cv,q,out,seen,limit);
      }
    }
  }
  /* ---------- value editor (sheet) — সব ধরন: String/Number/Boolean/Null/Object/Array + JSON ---------- */
  function dbEditorHtml(v,pre){
    const has=v!==undefined&&v!==null;
    const t=has?dbType(v):"string";
    const init=(t==="object"||t==="array")?"json":t;
    const TYPES=[["string","টেক্সট"],["number","সংখ্যা"],["boolean","বুলিয়ান"],["null","শূন্য"],["json","JSON"]];
    const seg=`<div class="strip seg" id="${pre}_seg">${TYPES.map(([k,lb])=>`<button data-ty="${k}" class="${k===init?"on":""}">${lb}</button>`).join("")}</div>`;
    const fld=(ty,inner,extra)=>`<div class="f" data-field="${ty}" style="${init!==ty?"display:none":""}margin-top:10px">${inner}${extra||""}</div>`;
    const strVal=t==="string"?String(v??""):"";
    const numVal=t==="number"?String(v):"";
    const boolVal=t==="boolean"?(v?"true":"false"):"false";
    const jsonVal=(t==="object"||t==="array")?JSON.stringify(v,null,2)
      :(t==="string"?JSON.stringify(String(v??""))
      :((t==="number"||t==="boolean")?String(v):"{}"));
    return seg
      +fld("string",`<input id="${pre}_str" value="${esc(strVal)}" placeholder="টেক্সট লিখুন">`)
      +fld("number",`<input id="${pre}_num" type="number" step="any" value="${esc(numVal)}" placeholder="সংখ্যা">`)
      +fld("boolean",`<div class="strip seg" id="${pre}_bool"><button data-bv="true" class="${boolVal==="true"?"on":""}">true</button><button data-bv="false" class="${boolVal==="false"?"on":""}">false</button></div>`)
      +fld("null",`<p class="hint2">মান <b>null</b> — RTDB-তে এই পথ মুছে যাবে।</p>`)
      +fld("json",`<textarea id="${pre}_json" rows="9" spellcheck="false" style="font-family:monospace;font-size:.78rem">${esc(jsonVal)}</textarea>`,`<small class="hint2">সম্পূর্ণ object/array বা যেকোনো valid JSON।</small>`);
  }
  function dbWireEditor(s,pre){
    const seg=s.q("#"+pre+"_seg");
    seg.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      seg.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      const ty=b.dataset.ty;
      s.querySelectorAll("[data-field]").forEach(f=>f.style.display=f.dataset.field===ty?"":"none");
    });
    const bs=s.q("#"+pre+"_bool");
    if(bs)bs.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      bs.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
    });
  }
  function dbReadEditor(s,pre){
    const on=s.q("#"+pre+"_seg").querySelector("button.on");
    if(!on)return {err:"ধরন বেছে নিন"};
    const ty=on.dataset.ty;
    if(ty==="string")return {v:s.q("#"+pre+"_str").value};
    if(ty==="number"){
      const raw=s.q("#"+pre+"_num").value;
      if(raw===""||raw==="-"||raw===".")return {v:0};
      const n=Number(raw);
      if(!Number.isFinite(n))return {err:"সঠিক সংখ্যা দিন"};
      return {v:n};
    }
    if(ty==="boolean")return {v:s.q("#"+pre+"_bool").querySelector("button.on").dataset.bv==="true"};
    if(ty==="null")return {v:null};
    if(ty==="json"){
      const raw=s.q("#"+pre+"_json").value;
      try{return {v:JSON.parse(raw)};}
      catch(e){return {err:"JSON সঠিক নয়: "+(e&&e.message||e)};}
    }
    return {err:"ধরন বেছে নিন"};
  }
  /* ---------- মুছুন ---------- */
  async function dbDelete(path){
    const isRoot=!path.includes("/");
    const desc=isRoot
      ?`/${path} সহ এর সমস্ত child মুছে যাবে। এটি একটি মূল node — অত্যন্ত সতর্কতার সাথে।`
      :`/${path} মুছে ফেলা হবে (সহ সব child)।`;
    if(!await confirmS({title:"মুছে ফেলবেন?",desc,ok:"মুছে ফেলুন",danger:true}))return;
    try{await removePath(path);}
    catch(e){toast("মুছতে ব্যর্থ: "+(e&&e.message||e),"er");return;}
    dbApplyLocal(path,_DEL);
    await logAudit("ডেটাবেস মুছা","/"+path,"database");
    dbRender();toast("মুছে ফেলা হয়েছে","ok");
  }
  /* ---------- সম্পাদনা ---------- (মান dbMirror থেকে — কোনো পৃথক read নয়) */
  async function dbEditSheet(path){
    const cur=dbValueAt(path);
    const s=sheet("মান সম্পাদনা — /"+path,`
      <p class="hint2" style="margin-bottom:9px">পথ: <b style="font-family:monospace;word-break:break-all">/${esc(path)}</b></p>
      ${dbEditorHtml(cur,"ed")}
      <p class="hint2" style="margin-top:10px;color:var(--amb)">সেভ করলে সরাসরি Realtime Database-এ লেখা হবে (realtime listener সব প্যানেলে আপডেট পাঠাবে)। "শূন্য/null" ধরন বেছে নিলে এই পথ মুছে যাবে।</p>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ed_ok">সংরক্ষণ</button>`);
    dbWireEditor(s,"ed");
    s.q("#ed_ok").onclick=async()=>{
      const r=dbReadEditor(s,"ed");
      if(r.err)return toast(r.err,"er");
      if(!await confirmS({title:"সেভ করবেন?",desc:`/${path} এই মান দিয়ে প্রতিস্থাপন হবে।`,ok:"সেভ",danger:true}))return;
      try{await setPath(path,r.v);}
      catch(e){toast("সেভ ব্যর্থ: "+(e&&e.message||e),"er");return;}
      dbApplyLocal(path,r.v===null?_DEL:r.v);
      await logAudit("ডেটাবেস সম্পাদনা","/"+path,"database");
      s.close();dbRender();toast("সংরক্ষণ হয়েছে (RTDB-তে লেখা হয়েছে)","ok");
    };
  }
  /* ---------- চাইল্ড যোগ ---------- */
  async function dbAddSheet(parentPath){
    const parent=dbValueAt(parentPath);
    const isArr=Array.isArray(parent);
    const s=sheet("নতুন চাইল্ড — /"+parentPath,`
      <p class="hint2" style="margin-bottom:9px">parent: <b style="font-family:monospace;word-break:break-all">/${esc(parentPath||"(root)")}</b> (${isArr?"array":"object"})</p>
      ${isArr?"":`<div class="f"><label>key <i>*</i></label><input id="ad_k" placeholder="যেমন: name"></div>`}
      ${dbEditorHtml(undefined,"ad")}
      <p class="hint2" style="margin-top:8px">${isArr?"array-তে শেষে যোগ হবে।":"এই key-তে মান সেভ হবে।"}</p>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ad_ok">যোগ করুন</button>`);
    dbWireEditor(s,"ad");
    s.q("#ad_ok").onclick=async()=>{
      const r=dbReadEditor(s,"ad");
      if(r.err)return toast(r.err,"er");
      let key;
      if(isArr){key=Array.isArray(parent)?parent.length:0;}
      else{
        key=(s.q("#ad_k").value||"").trim();
        if(!key)return toast("key দিন","er");
        if(/[.#$\[\]]/.test(key))return toast("key-এ . # $ [ ] অক্ষর চলবে না","er");
      }
      const childPath=parentPath?parentPath+"/"+key:key;
      if(!await confirmS({title:"যোগ করবেন?",desc:`/${childPath} তৈরি হবে।`,ok:"যোগ"}))return;
      try{await setPath(childPath,r.v);}
      catch(e){toast("যোগ ব্যর্থ: "+(e&&e.message||e),"er");return;}
      dbApplyLocal(childPath,r.v===null?_DEL:r.v);
      if(parentPath)dbOpen.add(parentPath);
      await logAudit("ডেটাবেস চাইল্ড যোগ","/"+childPath,"database");
      s.close();dbRender();toast("যোগ হয়েছে (RTDB-তে লেখা হয়েছে)","ok");
    };
  }
  /* ---------- rename ---------- */
  async function dbRenameSheet(path){
    const segs=path.split("/");const oldKey=segs.pop();const parent=segs.join("/");
    const cur=dbValueAt(path);
    const s=sheet("পথ পরিবর্তন (rename)",`
      <p class="hint2">বর্তমান: <b style="font-family:monospace;word-break:break-all">/${esc(path)}</b></p>
      <div class="f" style="margin-top:8px"><label>নতুন key <i>*</i></label><input id="rn_k" value="${esc(oldKey)}"></div>
      <p class="hint2" style="color:var(--amb);margin-top:6px">সতর্কতা: rename একসাথে (atomic) হয় না — প্রথমে নতুন key-তে মান লেখা হয়, তারপর পুরোনোটি মুছে যায়।</p>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="rn_ok">পরিবর্তন</button>`);
    s.q("#rn_ok").onclick=async()=>{
      const nk=(s.q("#rn_k").value||"").trim();
      if(!nk)return toast("key দিন","er");
      if(nk===oldKey)return toast("একই key, কিছু বদলানো হয়নি","er");
      if(/[.#$\[\]]/.test(nk))return toast("key-এ . # $ [ ] অক্ষর চলবে না","er");
      const realNp=parent?parent+"/"+nk:nk;
      if(!await confirmS({title:"rename করবেন?",desc:`/${path} → /${realNp}`,ok:"পরিবর্তন",danger:true}))return;
      try{
        await setPath(realNp,cur===undefined?null:cur);
        await removePath(path);
      }catch(e){toast("rename ব্যর্থ: "+(e&&e.message||e),"er");return;}
      dbApplyLocal(path,_DEL);
      dbApplyLocal(realNp,cur);
      dbFocus=realNp;
      await logAudit("ডেটাবেস rename",`/${path} → /${realNp}`,"database");
      s.close();dbRender();toast("পরিবর্তন হয়েছে","ok");
    };
  }
  /* ---------- breadcrumb + navigation ---------- */
  function dbCrumbHtml(){
    const segs=dbFocus?dbFocus.split("/"):[];
    let acc="";
    const parts=[`<button class="lnk" data-crumb="" style="font-weight:800;color:var(--grn)">${SI.db(14)} Database</button>`];
    for(const s of segs){
      acc=acc?acc+"/"+s:s;
      parts.push(`<span style="color:var(--line)">/</span><button class="lnk" data-crumb="${esc(acc)}" style="color:var(--ink2);font-family:monospace">${esc(s)}</button>`);
    }
    return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 10px;font-size:.78rem;border-bottom:1px solid var(--line);background:var(--card2)">${parts.join("")}
      <button class="btn gh sm" id="dbcopy" style="margin-left:auto;min-height:32px;padding:5px 9px;font-size:.7rem">${SI.card(13)} পথ কপি</button></div>`;
  }
  /* ancestor-গুলো expand করলেই কোনো node দৃশ্যমান হয় */
  function dbOpenPath(path){
    if(!path)return;
    const segs=path.split("/");
    let acc="";
    for(let i=0;i<segs.length-1;i++){
      acc=acc?acc+"/"+segs[i]:segs[i];
      dbOpen.add(acc);
    }
    const v=dbValueAt(path);
    if(v&&typeof v==="object")dbOpen.add(path);
  }
  function scrollToNode(path){
    requestAnimationFrame(()=>{
      if(!dbEl)return;
      const nodes=dbEl.querySelectorAll("[data-path]");
      for(const n of nodes){if(n.getAttribute("data-path")===path){n.scrollIntoView({block:"center"});break;}}
    });
  }
  function dbCrumbClick(e){
    if(e.target.closest("#dbcopy")){
      const txt=dbFocus?"/"+dbFocus:"/";
      navigator.clipboard?.writeText(txt).then(()=>toast("পথ কপি হয়েছে: "+txt,"ok"),()=>toast("কপি করা যায়নি","er"));
      return;
    }
    const c=e.target.closest("[data-crumb]");
    if(c){const p=c.dataset.crumb;dbFocus=p;dbOpenPath(p);dbRender();scrollToNode(p);}
  }
  /* ---------- ডেটাবেস পেজ ---------- */
  SUBP.database=el=>{
    dbEl=el;
    el.innerHTML=ptitle("ডেটাবেস ব্যবস্থাপনা","Firebase Realtime Database — পুরো tree, realtime")
    +`<div class="note w">${SI.warn(17)}<span><b>শুধু অ্যাডমিন।</b> এখানে ডেটাবেসের <b>আসল structure</b> realtime-এ দেখা যায় এবং যেকোনো node Add/Edit/Delete/Rename করা যায় — সরাসরি Firebase-এ। অন্য কোথাও পরিবর্তন হলে এখানেও সাথে সাথে দেখা যাবে, আর এখানকার পরিবর্তন সব প্যানেলে চলে যাবে। Security Rules প্রযোজ্য — permission না থাকলে Firebase নিজেই বাধা দেবে।</span></div>`
    +`<div class="frow">
        <input class="gw" id="dbq" value="${esc(dbQuery)}" placeholder="key, value, UID, email, নাম বা path দিয়ে খুঁজুন…" autocomplete="off">
        <button class="btn gh" id="dbr">${SI.refresh(15)} রিফ্রেশ</button>
      </div>`
    +`<div class="card pad0" style="margin-bottom:12px">
        <div id="dbcrumb"></div>
        <div id="dbtree"></div>
      </div>`
    +`<p class="hint2" style="margin-top:6px">${SI.info(13)} প্রতিটি node-এর type, child-সংখ্যা ও path দেখা যায়। ক্লিক করে expand করুন, ডানপাশের বোতামে সম্পাদনা/যোগ/rename/মুছুন। সার্চে পুরো ডেটাবেস ঘাঁটা হয়।</p>`;
    let t;
    const qi=$("#dbq");
    qi.oninput=e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>{dbQuery=v;dbRender();},250);};
    $("#dbr").onclick=dbRefresh;
    $("#dbtree").onclick=dbClick;
    $("#dbcrumb").onclick=dbCrumbClick;
    dbEnsureListener();
    dbRender();
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
        <div><span>অবস্থা</span><b id="gKeyState">${DB.integr.imgbbKey?"কী সংরক্ষিত":"কী দেওয়া হয়নি"}</b></div>
        <div><span>সর্বোচ্চ আকার</span><b>৩২ MB</b></div></div>
        <p class="hint2" style="margin-top:9px">নিয়ন্ত্রণ → অনুমোদন ও সেটিংস থেকে API কী দিলে সরাসরি আপলোড চালু হবে।</p></div>`;
    getImgbbKey().then(k=>{if(k){DB.integr.imgbbKey=k;const inp=$("#gKeyState");if(inp)inp.textContent="কী সংরক্ষিত";}});
    el.querySelectorAll("[data-gt]").forEach(b=>b.onclick=async()=>{
      const g=DB.gallery.find(x=>x.id===b.dataset.gt);if(!g)return;
      g.status=g.status==="published"?"draft":"published";
      logAudit("গ্যালারি "+(g.status==="published"?"প্রকাশ":"লুকানো"),g.title,"gallery");
      try{await persist();}catch(e){restoreLastPersistedDB();return toast("গ্যালারি হালনাগাদ করা যায়নি","er");}
      renderSub("gallery");toast("হালনাগাদ হয়েছে","ok")});
    el.querySelectorAll("[data-gd]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"ছবি মুছবেন?",desc:"ওয়েবসাইট থেকে সরে যাবে।",danger:true}))return;
      DB.gallery=DB.gallery.filter(x=>x.id!==b.dataset.gd);
      logAudit("গ্যালারি ছবি মুছে ফেলা",b.dataset.gd,"gallery");
      try{await persist();}catch(e){restoreLastPersistedDB();return toast("ছবি মুছে ফেলা যায়নি","er");}
      renderSub("gallery");toast("মুছে ফেলা হয়েছে")});
    $("#gUp")&&($("#gUp").onclick=uploadSheet);
  };
  function uploadSheet(){
    const s=sheet("ছবি যোগ করুন",`
      <div class="dz" id="dz"><span>${SI.up(24)}</span><b>ছবি বেছে নিন</b>
        <small>JPG / PNG · সর্বোচ্চ ৩২ MB</small>
        <input type="file" id="fi" accept="image/*" hidden></div>
      <div class="f" style="margin-top:12px"><label>শিরোনাম</label>
        <input id="up_t"></div>
      <div class="pgb hide" id="pg"><i></i></div>
      <p class="hint2" style="margin-top:9px">ছবি ImgBB-তে আপলোড হয়ে লিংক হিসেবে সংরক্ষণ হবে।</p>`,
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
    s.q("#up_ok").onclick=async()=>{
      if(!file)return toast("আগে একটি ছবি বাছুন","er");
      const t=s.q("#up_t").value.trim()||"শিরোনামহীন";
      const pg=s.q("#pg");pg.classList.remove("hide");
      const okBtn=s.q("#up_ok");okBtn.disabled=true;
      pg.firstElementChild.style.width="12%";
      try{
        /* ছবি ImgBB-তে upload → link + metadata Realtime Database-এ সেভ */
        const res=await imgbbUploadImage(file);
        pg.firstElementChild.style.width="100%";
        /* সরাসরি "প্রকাশিত" — মূল ওয়েবসাইটের গ্যালারিতে সাথে সাথে দেখা যায় */
        DB.gallery.push({id:"IMG-"+Date.now().toString(36).toUpperCase(),title:t,url:res.url,imageUrl:res.url,thumbUrl:res.thumbUrl,status:"published",order:DB.gallery.length+1});
        logAudit("গ্যালারিতে ছবি যোগ",t,"gallery");
        await persist();
        s.close();renderSub("gallery");
        toast("ছবি যোগ হয়েছে — ওয়েবসাইটের গ্যালারিতে প্রকাশিত","ok");
      }catch(e){
        pg.classList.add("hide");okBtn.disabled=false;
        toast(e&&e.message?e.message:"ছবি আপলোড করা যায়নি","er");
      }
    };
  }
  
  /* ---------- notices ---------- */
  SUBP.notice=el=>{
    const may=can("notice.manage");
    const active=DB.notices.filter(n=>noticeIsActive(n)).length;
    el.innerHTML=(DB.notices.length
      ?`<div class="card pad0">${DB.notices.map(n=>`<div class="row">
          <span class="ic" style="color:${noticeIsActive(n)?"var(--grn)":"var(--mut)"}">${SI.bell(18)}</span>
          <span class="tx"><b>${esc(n.title||"—")}</b><small>${esc(n.audience||"সবাই")} · target: ${esc(noticeTarget(n.target))} · ${n.from?dS(n.from):"—"} – ${n.to?dS(n.to):"—"}</small></span>
          <span class="rt"><span class="pill ${n.status==="published"?"g":"m"}">${n.status==="published"?"প্রকাশিত":"খসড়া"}</span>
          ${may?`<button class="btn gh sm" data-ne="${esc(n.id)}">${SI.edit(14)}</button>
            <button class="btn gh sm" data-nd="${esc(n.id)}">${SI.trash(14)}</button>`:""}</span></div>`).join("")}</div>`
      :`<div class="card">${emptyBox("bell","কোনো নোটিশ নেই","ঘোষণা দিলে target অনুযায়ী website, donor বা moderator panel-এ দেখা যাবে")}</div>`)
    +(may?`<button class="btn w" style="margin-top:12px" id="nAdd">${SI.plus(16)} নতুন নোটিশ</button>`:"")
    +`<div class="sec-t">বর্তমান notice flow</div>
      <div class="card"><p class="hint2">${bn(active)}টি notice এখন date range-এর মধ্যে active। Published notice-এর target অনুযায়ী Donor Panel, Moderator Panel এবং Main Website-এ realtime দেখা যাবে।</p></div>`;
    el.querySelectorAll("[data-nd]").forEach(b=>b.onclick=async()=>{
      if(!await confirmS({title:"নোটিশ মুছবেন?",desc:"এই notice সরাসরি Firebase Realtime Database থেকে মুছে যাবে।",ok:"মুছুন",danger:true}))return;
      try{
        await removeRow(NODES.notices,b.dataset.nd);
        DB.notices=DB.notices.filter(x=>String(x.id)!==String(b.dataset.nd));
        await logAudit("নোটিশ মুছে ফেলা",b.dataset.nd,"notice");renderSub("notice");toast("RTDB থেকে নোটিশ মুছে গেছে","ok");
      }catch(e){toast("নোটিশ মুছা যায়নি — কোনো local success দেখানো হয়নি","er");}
    });
    el.querySelectorAll("[data-ne]").forEach(b=>b.onclick=()=>noticeSheet(DB.notices.find(x=>String(x.id)===String(b.dataset.ne))));
    $("#nAdd")&&($("#nAdd").onclick=()=>noticeSheet(null));
  };
  async function noticeSheet(existing){
    const id=existing?.id||("NT-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7));
    const s=sheet(existing?"নোটিশ সম্পাদনা":"নতুন নোটিশ",`<div class="f">
        <label>শিরোনাম</label><input id="n_t" maxlength="140" value="${esc(existing?.title||"")}">
        <label>Short message / body</label><textarea id="n_b" rows="3" maxlength="500">${esc(existing?.body||"")}</textarea>
        <label>কারা দেখবে</label><select id="n_a"><option ${!existing?.audience||existing?.audience==="সবাই"?"selected":""}>সবাই</option>
          ${GROUPS.map(g=>`<option ${existing?.audience===g+" গ্রুপ"?"selected":""}>${g} গ্রুপ</option>`).join("")}
          ${AREAS.map(a=>`<option ${existing?.audience===a+" এলাকা"?"selected":""}>${a} এলাকা</option>`).join("")}</select>
        <label>Target</label><select id="n_tg">
          ${[["all","All"],["donor","Donor"],["moderator","Moderator"],["website","Website"]].map(([v,l])=>`<option value="${v}" ${(noticeTarget(existing?.target)==v)?"selected":""}>${l}</option>`).join("")}</select>
        <label>শুরু</label><input id="n_f" type="date" value="${esc(existing?.from||iso(now()))}">
        <label>শেষ</label><input id="n_e" type="date" value="${esc(existing?.to||addD(iso(now()),7))}">
      </div>`,`<button class="btn gh" data-close>বাতিল</button><button class="btn gh" id="n_dr">খসড়া</button><button class="btn" id="n_ok">${SI.send(15)} প্রকাশ</button>`);
    const save=async status=>{
      const title=s.q("#n_t").value.trim(),body=s.q("#n_b").value.trim(),from=s.q("#n_f").value,to=s.q("#n_e").value;
      if(title.length<4)return toast("শিরোনাম লিখুন","er");
      if(from&&to&&from>to)return toast("শেষ তারিখ শুরুর আগে হতে পারবে না","er");
      const value={...(existing||{}),id,title,body,audience:s.q("#n_a").value,target:noticeTarget(s.q("#n_tg").value),
        status,from,to,createdAt:existing?.createdAt||nowIso(),updatedAt:nowIso()};
      const btn=status==="published"?s.q("#n_ok"):s.q("#n_dr");btn.disabled=true;
      try{
        await setRow(NODES.notices,id,value);
        const index=DB.notices.findIndex(n=>String(n.id)===String(id));
        index<0?DB.notices.unshift(value):DB.notices[index]=value;
        await logAudit(status==="published"?"নোটিশ প্রকাশ":"নোটিশ খসড়া",title,"notice");
        s.close();renderSub("notice");toast(status==="published"?"নোটিশ RTDB-তে প্রকাশিত":"নোটিশ RTDB-তে সংরক্ষিত","ok");
      }catch(e){btn.disabled=false;toast("নোটিশ সংরক্ষণ করা যায়নি — কোনো local success দেখানো হয়নি","er");}
    };
    s.q("#n_ok").onclick=async()=>{await save("published")};
    s.q("#n_dr").onclick=async()=>{await save("draft")};
  }
  
  /* ---------- inbox ---------- */
  SUBP.inbox=el=>{
    el.innerHTML=(DB.messages.length
      ?`<div class="card pad0">${DB.messages.map(m=>`<button class="row" data-ms="${m.id}">
          <span class="ic" style="color:${m.read?"var(--mut)":"var(--blu)"}">${SI.mail(18)}</span>
          <span class="tx"><b>${esc(m.name)}${m.read?"":" •"}</b><small>${esc(m.text)}</small></span>
          <span class="rt">${timeAgo(m.at)}</span></button>`).join("")}</div>`
      :`<div class="card">${emptyBox("mail","কোনো বার্তা নেই")}</div>`)
    +(unread()?`<button class="btn gh w" style="margin-top:12px" id="mAll">সব পড়া হিসেবে চিহ্নিত করুন</button>`:"");
    el.querySelectorAll("[data-ms]").forEach(b=>b.onclick=async()=>{
      const m=DB.messages.find(x=>x.id===b.dataset.ms);if(!m)return;
      try{if(m.id)await updateRow(NODES.messages,m.id,{read:true});}
      catch(e){return toast("বার্তা পড়া হিসেবে চিহ্নিত করা যায়নি","er");}
      m.read=true;paintTop();
      sheet(m.name,`<div class="kv"><div><span>ফোন</span><b>${esc(maskPhone(m.phone))}</b></div>
        <div><span>সময়</span><b>${timeAgo(m.at)}</b></div></div>
        <div class="sec-t">বার্তা</div>
        <p style="font-size:.86rem;line-height:1.9">${esc(m.text)}</p>`,
        `<button class="btn gh" data-close>বন্ধ</button>
         <a class="btn" href="tel:${esc(m.phone)}">${SI.phone(15)} কল করুন</a>`);
      renderSub("inbox")});
    $("#mAll")&&($("#mAll").onclick=async()=>{
      const unread=DB.messages.filter(m=>!m.read&&m.id);
      try{await Promise.all(unread.map(m=>updateRow(NODES.messages,m.id,{read:true})));}
      catch(e){return toast("সব বার্তা পড়া হিসেবে চিহ্নিত করা যায়নি","er");}
      unread.forEach(m=>{m.read=true});
      renderSub("inbox");paintTop();toast("সব পড়া হিসেবে চিহ্নিত","ok")});
  };
  
  /* ---------- stats ---------- */
  SUBP.stats=el=>{
    if(!statsReady()){
      el.innerHTML=ptitle("পরিসংখ্যান",tp("তথ্য লোড হচ্ছে…","Loading data…"))
        +skelStats()
        +`<div class="sec-t">গ্রুপের অনুপাত</div>`+skelCard(2)
        +`<div class="sec-t">গ্রুপ অনুযায়ী প্রস্তুত ডোনার</div>`+skelCard(3)
        +`<div class="sec-t">গত ৬ মাসে রক্তদান</div>`+skelCard(2);
      return;
    }
    const c=bloodCounts(),tot=Object.values(c).reduce((a,b)=>a+b,0)||1;
    /* মাসভিত্তিক পরিসংখ্যান — ডাটাবেসের বাস্তব রক্তদানের তারিখ থেকে গণনা */
    const months=[...Array(6)].map((_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));
      const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      return {m:d.toLocaleDateString("bn-BD",{month:"short"}),
              v:DB.donors.filter(x=>String(x.last||"").startsWith(key)).length}});
    const mMax=Math.max(1,...months.map(m=>m.v));
    const colors=["#e0242f","#087a4b","#2563eb","#b3760a","#7c3aed","#0891b2","#be185d","#4d7c0f"];
    let acc=0;const seg=GROUPS.map((g,i)=>{const p=c[g]/tot*100;const t=`${colors[i]} ${acc}% ${acc+p}%`;acc+=p;return t});
    const low=GROUPS.filter(g=>c[g]<3);
    el.innerHTML=`<div class="astat">
        <button class="g"><b>${bn(DB.donors.length)}</b><span>রক্তদাতা</span></button>
        <button class="r"><b>${bn(tot)}</b><span>প্রস্তুত</span></button>
        <button class="b"><b>${bn(DB.donors.reduce((a,d)=>a+d.donations,0))}</b><span>জীবন বাঁচিয়েছেন</span></button>
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
      team:"টিম",website:"ওয়েবসাইট",notice:"নোটিশ",data:"তথ্য",settings:"সেটিংস",database:"ডেটাবেস"};
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
  
  /* ---------- অনুমোদন ও সেটিংস ---------- */
  /* এই পেজে শুধুই "অনুমোদন প্রক্রিয়া" — কোন কাজে Admin/Moderator-এর
     approval লাগবে আর কোনটি সরাসরি সম্পন্ন হবে। প্রতিটি সুইচ সাথে সাথেই
     RTDB `settings/app/rules`-এ সেভ হয় (কোনো আলাদা "সংরক্ষণ" বোতাম নেই),
     আর live listener-এর মাধ্যমে অন্য সব প্যানেলে/ওয়েবসাইটে সাথে সাথে কার্যকর
     হয় (কোনো reload নয়)। */
  const APPROVAL_TOGGLES=[
    ["donorApproval","ডোনার আবেদন","নতুন Donor Application-এ approval লাগবে",
      "ON: নতুন ডোনার আবেদন approval queue-তে যাবে · OFF: আবেদন সাথে সাথেই অনুমোদিত হবে"],
    ["donationApproval","রক্তদান যাচাই","Blood Donation verification-এ approval লাগবে",
      "ON: রক্তদান যাচাইয়ের আবেদন approval queue-তে যাবে · OFF: রক্তদান সরাসরি যাচাইকৃত হবে"],
    ["emergencyApproval","জরুরি আবেদন","Emergency Application-এ approval লাগবে",
      "ON: জরুরি রক্তের আবেদন approval queue-তে যাবে · OFF: আবেদন সরাসরি প্রকাশিত হবে"],
    ["bloodGroupApproval","গ্রুপ বদল","Blood Group change-এ approval লাগবে",
      "ON: রক্তের গ্রুপ বদল approval queue-তে যাবে · OFF: গ্রুপ সরাসরি বদলে যাবে"]
  ];
  SUBP.rules=el=>{
    const r=DB.rules;
    if(r.donationApproval===undefined)r.donationApproval=true;
    el.innerHTML=`<div class="note i">${SI.info(17)}<span>কোন কাজে অনুমোদন (approval) লাগবে তা এখান থেকে ঠিক করুন।
      প্রতিটি সুইচ বদলালেই সেটিং সাথে সাথে Realtime Database-এ সংরক্ষিত ও সব জায়গায় কার্যকর হয়।</span></div>
      <div class="sec-t">অনুমোদন প্রক্রিয়া</div>
      <div class="card pad0">${APPROVAL_TOGGLES.map(([k,t,help,state])=>`<label class="row" style="cursor:pointer">
          <span class="tx"><b>${t}</b><small>${help}</small>
            <small style="color:${r[k]!==false?"var(--grn)":"var(--mut)"}">${r[k]!==false?"চালু · ":"বন্ধ · "}${esc(state)}</small></span>
          <input type="checkbox" data-rl="${k}" ${r[k]!==false?"checked":""}
            style="width:20px;height:20px;accent-color:var(--grn);flex:none" aria-label="${esc(t)}"></label>`).join("")}</div>
      <p class="hint2" style="margin-top:9px">ON থাকলে সংশ্লিষ্ট কাজ approval/queue flow অনুসরণ করবে;
        OFF থাকলে সেই কাজ সরাসরি সম্পন্ন হবে এবং approval queue-তে যাবে না।</p>`;
    el.querySelectorAll("[data-rl]").forEach(c=>c.onchange=async()=>{
      const key=c.dataset.rl,previous=r[key];r[key]=c.checked;
      if(key==="emergencyApproval")r.reqApproval=r.emergencyApproval;
      c.disabled=true;
      try{await pushSettings();await logAudit("অনুমোদন সেটিংস হালনাগাদ",
          (APPROVAL_TOGGLES.find(t=>t[0]===key)||[,key])[1]+" → "+(c.checked?"ON":"OFF"),"settings");
        toast("সেটিংস RTDB-তে সংরক্ষিত হয়েছে","ok");renderSub("rules");}
      catch(e){r[key]=previous;if(key==="emergencyApproval")r.reqApproval=previous;c.checked=!!previous;
        toast("সেটিংস সংরক্ষণ করা যায়নি","er");}
    });
  };
  
  /* ---------- global search ---------- */
  SUBP.search=el=>{
    el.innerHTML=`<div class="f"><input id="sq" autocomplete="off"></div>
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
      const [a,b]=(panelSubPath("admin")||location.hash.replace("#","")).split("/");
      go(RENDER[a]?a:"home",b||null,false);
      if(isEN())translateNode(document.body);
    };
    /* ══════════ Firebase Auth gate + role (Realtime Database `admins`) ══════════
       role শুধু ডাটাবেস থেকে আসে — RTDB-তে `admins/{uid}` রেকর্ড বদলালেই
       ব্যবহারকারীর প্যানেল বদলে যায়। ভুল প্যানেলে ঢুকলে (যেমন Doner এসে
       /admin খুললে) তাকে তার নিজের dashboard-এ পাঠিয়ে দেওয়া হয়। */
    (async function authorize(){
      try{
        initSharedFirebase();
        const {subscribeAuthUser}=await import("../lib/authState");
        subscribeAuthUser(async (user)=>{
          if(!user){
            navigateToPage("home");
            return;
          }
          const email=String(user.email||"").toLowerCase();
          let resolved={role:"donor",name:"",permissions:[],staff:null};
          try{
            resolved=await resolveUserRole({uid:user.uid,email,name:user.displayName||""});
          }catch(e){console.warn("role lookup:",e&&e.message)}

          const target=panelForRole(resolved.role);          // doner | moderator | admin
          const here=PANEL.id;
          if(target!==here){
            /* এই প্যানেলে ঢোকার অনুমতি নেই — নিজের dashboard-এ পাঠানো হচ্ছে */
            navigateToPage(target);
            return;
          }

          const staff=resolved.staff||{};
          ME.uid=user.uid;
          ME.email=email||ME.email;
          /* profile-এর authoritative উৎস RTDB users/{uid} — admins রেকর্ড ও Auth
             display name শুধু fallback (default যেন RTDB-র জায়গা নেয় না)।
             অন্য ডিভাইস/ব্রাউজার থেকে লগইন করলেও এখান থেকেই সব তথ্য আসে। */
          try{ applyMeRow(await getRow(NODES.users,user.uid)); }catch(e){console.warn("profile load:",e&&e.message)}
          /* getRow সফলভাবে শেষ হলেই hydrated — RTDB-তে রেকর্ড না থাকলেও
             (নতুন স্টাফ) local default লেখা যাবে, কিন্তু নেটওয়ার্ক ব্যর্থ
             হলে কখনোই খালি default দিয়ে আগের তথ্য মোছা হবে না। */
          ME_HYDRATED=true;
          ME.name=ME.name||staff.name||user.displayName||"";
          ME.username=ME.username||staff.username||"";
          ME.designation=ME.designation||staff.designation||"";
          if(!ME.joined)ME.joined=iso(now());
          ME.permissions=Array.isArray(staff.permissions)?staff.permissions:null;
          /* RTDB-তে লেখা role → প্যানেলের অভ্যন্তরীণ role */
          const raw=String(staff.role||"").toLowerCase();
          ME.role=PANEL.id==="admin"?"admin":"mod";
          if(user.photoURL)ME.photo=ME.photo||user.photoURL;
          upsertMySession();
          await saveMe();
          /* live sync — নিজের অ্যাকাউন্ট (users/{uid}), টিম (admins),
             অডিট লগ ও বার্তা: সব RTDB থেকে, সব প্যানেলে একই তথ্য */
          watchMe(user.uid);watchTeam();watchAudit();watchMessages();watchAccounts();watchReports();
          applyLogo(document);
          paintTop();paintNav();
          setTimeout(backfillApprovedDonations,1200);
          proceed();
        });
      }catch(e){ console.warn("panel auth:", e&&e.message); proceed(); }
    })();
    window.DB=DB;window.ME=ME;window.go=go;window.toast=toast;window.persist=persist;
    window.setTab=v=>{wTab=v;go("work")};window.getTab=()=>wTab;
    window.getSub=()=>SUB;window.getCur=()=>CUR;window.saveMe=saveMe;window.isEN=isEN;window.applyLang=applyLang;window.setME=o=>{Object.assign(ME,o);saveMe()};
    /* ── Live update, re-load নয় ──
       ডেটা একবারই লোড হয়; এরপর প্রতিটি পরিবর্তনে পুরো স্ক্রিন আবার
       render না করে শুধু সেই স্ক্রিন render হয় যেটি বদলানো ডেটা দেখায়।
       (প্রথম বুট / লগইন-লগআউটে কোনো `meta.node` থাকে না — তখন পূর্ণ
       স্ক্রিন refresh প্রয়োজন।) */
    const NODE_SCREENS={
      donors:["home","people","donors","donor","stats","search","team","donorid","approved","set","live","users"],
      donations:["approved","home"],
      requests:["home","work","live","search"],
      queue:["home","work","search"],
      gallery:["gallery","site","set","home"],
      notices:["notice","set","home"],
      accounts:["access","team","set"]
    };
    if(window.CBDCShared)CBDCShared.subscribe((st,meta)=>{
      if(meta&&meta.source==="panel:"+PANEL.id)return;
      pullSharedState();
      paintNav();paintTop();
      if(!approvedDonationBackfillRun&&(meta&&(meta.node==="donors"||meta.node==="donations")))backfillApprovedDonations();
      const node=meta&&meta.node;
      if(node){
        const affected=NODE_SCREENS[node];
        const key=(CUR==="set"&&SUB)?SUB:CUR;
        if(affected&&!affected.includes(key)&&!(CUR==="home"&&!SUB))return;
      }
      if(!document.querySelector(".sheet"))go(CUR,SUB,false,ARG);
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

export default function Admin() {
  useEffect(() => {
    document.body.dataset.panel = "admin";
    initPage();
  }, []);

  return (
    <>
      <style>{pageCss}</style>
      <StaticShell />
    </>
  );
}
