// @ts-nocheck — এই ফাইলটি মূল HTML-এর JavaScript-এর verbatim (হুবহু) port।




import { useEffect } from "react";
import "../lib/store";
import { initFirebase as initSharedFirebase, NODES } from "../lib/firebase";
import { releaseEmailIdentity, claimEmailIdentity, lookupEmailOwner } from "../lib/identity";
import { donationVerKey as verKeyOf } from "../lib/donationLog";
import { releaseLoginEntries, claimLoginKey, claimLoginEntries, releaseLoginKey, lookupLoginKey } from "../lib/identity";
import { navigateToPage, screenPath, panelSubPath, appBase } from "../lib/router";
import {
  authErrorMessage,
  resolveUserRole,
  panelForRole,
  photoForUid,
  loadUserProfile,
  isProfileComplete,
  requestPasswordReset,
  setOrChangePassword,
} from "../lib/authx";
import { getRow, setRow, updateRow, watchRow, watchList, addRow, findBy, listOnce, nowIso, updatePaths, removeRow, incrementField, ensureFieldAtLeast, serverTime, nextDonorId, releaseDonorSerial, isPermissionDenied } from "../lib/rtdb";
import { ageFromDob as calcAgeFromDob, ageText, dobBounds, isValidDob } from "../lib/age";
import { validateForm, attachLiveClear, FORM_ERROR_CSS } from "../lib/forms";
import { requestDirectApply } from "../lib/applyRequest";
import { authCurrentUser, reauthenticateCurrentWithPassword, updateAuthEmail, deleteAuthCurrentUser, authSignOut } from "../lib/authActions";
import { logoUrl, applyLogo } from "../config/logo";
import SITE from "../config/site";
import { uploadImage as imgbbUploadImage } from "../lib/imgbb";
import { DISTRICTS, areasForDistrict, districtOfArea, fillAreaSelect } from "../lib/locations";
import { noticeVisibleTo, noticeReadKey, markNoticeRead, markAllNoticesRead, watchNoticeReads } from "../lib/notice";

import {
  qrSVG,
  vcardTextOf,
  downloadDonorCardImages,
  donorCardSheetBodyHTML,
} from "../lib/donorCard";

import {
  addNotif,
  loadNotifs,
  markNotifRead as storeMarkRead,
  markAllNotifsRead,
  unreadNotifs,
  pruneExpired,
  subscribe as notifSubscribe,
  loadSeen,
  saveSeen,
  resetNotificationContext,
  sanitizeKey,
} from "../lib/notify";


const pageCss = FORM_ERROR_CSS + `/* ═══════════ TOKENS ═══════════ */
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
.ptitle + .sec-t{margin-top:0}
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
.dc-st.off{color:#7c8a84}
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
.home-notices{display:grid;gap:10px;margin-bottom:12px}
.home-notice{padding:14px 15px;border:1px solid #f0d59a;border-left:4px solid #b3760a;border-radius:var(--r2);
  background:#fff9ea;color:#4d3a12;box-shadow:var(--sh)}
.home-notice h3{margin:0 0 4px;font-size:.9rem;line-height:1.4;color:#8a5c07}
.home-notice p{margin:0;font-size:.79rem;line-height:1.65;color:inherit;white-space:pre-wrap}
.home-live-grid{display:grid;gap:10px;margin-bottom:12px}
.home-live-card{margin-bottom:0}
[data-theme="dark"] .home-notice{background:#2a2109;border-color:#67501b;color:#ead7a5}
[data-theme="dark"] .home-notice h3{color:#f1cb68}

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


function StaticShell() {
  return (
    <>
      {" "}
      {}
      {" "}
      <header className="top" id="top">
      </header>
      {" "}
      {}
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
          <section className="scr" id="s-become">
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
      {}
      {" "}
      <nav className="bnav" id="bnav">
      </nav>
      {" "}
      <div className="toasts" id="toasts">
      </div>
      {" "}
      {}
      {" "}
    </>
  );
}


function initPage() {
  
  

  
  const isEN=()=>false;
  
  const tp=(b)=>b;

  
  function applyLang(){
    document.documentElement.lang="bn";
    document.body.dataset.lang=STORE.prefs.lang;
    if(CUR)go(CUR,SUB,false);
    paintTop&&paintTop();paintNav&&paintNav();
  }
  
  
  
  const LOGO = logoUrl();
  
  
  
  
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const D9=["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  
  const bn=v=>String(v??"").replace(/\d/g,d=>D9[d]);
  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const iso=d=>d.toISOString().slice(0,10);
  const now=()=>new Date();
  const LOC=()=>"bn-BD";
  const dL=v=>v?new Date(v+"T00:00:00").toLocaleDateString(LOC(),{year:"numeric",month:"long",day:"numeric"}):"—";
  const dS=v=>v?new Date(v+"T00:00:00").toLocaleDateString(LOC(),{year:"numeric",month:"short",day:"numeric"}):"—";
  const dayDiff=a=>Math.floor((new Date().setHours(0,0,0,0)-new Date(a+"T00:00:00").setHours(0,0,0,0))/864e5);
  const addD=(d,n)=>{const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return iso(x)};
  const phoneOK=v=>/^01[3-9]\d{8}$/.test(String(v||"").replace(/\s/g,""));
  const mailOK=v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v||"");
  const sleep=m=>new Promise(r=>setTimeout(r,m));
  
  
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
  
  
  const AV=(g,p)=>p||("data:image/svg+xml;utf8,"+encodeURIComponent(g==="মহিলা"
   ?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#ffe4ef"/><path d="M18 25c0-9 7-13 22-13s22 4 22 13v8c0 9-7 13-22 13S18 42 18 33z" fill="#d76a9a"/><circle cx="40" cy="53" r="14" fill="#e8a8c2"/><path d="M22 70c0-11 8-17 18-17s18 6 18 17z" fill="#d76a9a"/></svg>`
   :`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#dcedfb"/><circle cx="40" cy="29" r="17" fill="#4a90d9"/><path d="M20 69c0-14 9-22 20-22s20 8 20 22z" fill="#4a90d9"/></svg>`));
  
  
  
  
  function vcardText(){
    return vcardTextOf(cardPngData());
  }
  
  function qrFields(){
    const d=STORE.donor;
    return [["নাম",dv("name")],["রক্তের গ্রুপ",d.bloodGroup],["মোবাইল",dv("phone")],
      ["সংগঠন","CBDC"],["ডোনার আইডি",d.donorId],["এলাকা",dv("area")],
      ["অবস্থা",restLeft()>0?"বিশ্রামে":d.available?"রক্তদানে প্রস্তুত":"আপাতত বন্ধ"]];
  }
  const qr=(txt,size=72)=>qrSVG(txt,size);
  
  
  function toast(msg,kind=""){
    const b=$("#toasts");
    if(b.lastElementChild&&b.lastElementChild.dataset.m===msg)return;
    const t=document.createElement("div");t.className=kind;t.dataset.m=msg;
    t.innerHTML=(kind==="ok"?ICON.checkC(17):kind==="er"?ICON.warn(17):ICON.info(17))+`<span>${esc(msg)}</span>`;
    b.append(t);setTimeout(()=>t.remove(),3200);
  }
  
  
  const LS="cbdc.app";
  const STORE={
    account:{
      uid:"", name:"", username:"", email:"",
      phone:"", photo:"", photoSource:"none",
      emailVerified:false, phoneVerified:false,
      dob:"", gender:"", area:"",
      address:"",
      
      bloodGroup:"",
      applicationCount:0,
      joined:iso(now())
    },
    donor:{
      is:false, status:"none", donorId:"",
      bloodGroup:"", whatsapp:"", lastDonation:"", totalDonations:0, totalBags:0,
      health:"",
      available:true, appliedAt:"", cardTheme:"green",
      
      donorRejectNote:"",
      
      groupChange:null
    },
    noticeReads:{},
    privacy:{ profile:"all", showPhone:"responders", showWhatsapp:true, showGroup:true, showArea:true, searchable:true },
    notif:{ emergency:true, onlyGroup:true, onlyArea:false, donor:true, account:true, security:true, quiet:false },
    prefs:{ theme:"light", lang:"bn", dense:false, anim:true, badge:true },
    security:{ loginAlert:true, passwordChangedAt:"" },
    saved:[]
  };
  
  
  let SHARED_PULLING=false;
  let lastPersistedStore=null;
  function restoreLastPersistedStore(){
    if(lastPersistedStore)Object.assign(STORE,JSON.parse(JSON.stringify(lastPersistedStore)));
  }
  async function save(){
    try{
      try{localStorage.setItem(LS,JSON.stringify({
        account:STORE.account, donor:STORE.donor,
        privacy:STORE.privacy, notif:STORE.notif, prefs:STORE.prefs,
        security:STORE.security, saved:STORE.saved}))}catch(e){}
      if(!SHARED_PULLING)await publishPersonalShared();
      
      await pushAccountToRtdb();
      
      await pushDonorRecordToRtdb();
      lastPersistedStore=JSON.parse(JSON.stringify(STORE));
    }catch(error){
      restoreLastPersistedStore();
      persistLocalAccount();
      throw error;
    }
  }
  function load(){try{const d=JSON.parse(localStorage.getItem(LS)||"{}");
    if(d.account)Object.assign(STORE.account,d.account);
    if(d.donor)Object.assign(STORE.donor,d.donor);
    
    delete STORE.donor.ov;
    if(d.prefs)Object.assign(STORE.prefs,d.prefs);
    if(d.privacy)Object.assign(STORE.privacy,d.privacy);
    if(d.notif)Object.assign(STORE.notif,d.notif);
    if(d.security)Object.assign(STORE.security,d.security);
    if(d.saved)STORE.saved=d.saved;
  }catch(e){}}
  load();
  
  STORE.prefs.lang="bn";
  lastPersistedStore=JSON.parse(JSON.stringify(STORE));
  
  
  const LS_DATA="cbdc.data";
  const RAW={ donations:[], verifiedDonations:{}, donationNotes:{}, incoming:[], mine:[], notifs:[], activity:[], sessions:[], donors:[], notices:[] };
  
  let DONATION_DETAIL_ID="";
  
  
  const donationVerKey=(x:any)=>verKeyOf(x&&x.date,x&&x.place);
  
  const donNote=(x:any)=>{const n=RAW.donationNotes&&(RAW.donationNotes as any)[donationVerKey(x)];
    return n&&typeof n==="object"?n:null};
  const donRejected=(x:any)=>donNote(x)?.status==="rejected";
  const donNoteText=(x:any)=>{const n=donNote(x);return String((n&&n.note)||"").trim()};
  function isVerifiedDonation(x:any){
    
    const k=donationVerKey(x);
    return !!(RAW.verifiedDonations&&typeof RAW.verifiedDonations==="object"&&(RAW.verifiedDonations as any)[k]);
  }
  function isVerifiedOrLegacy(x:any){
    
    return isVerifiedDonation(x)||!!(x&&x.ok===true);
  }
  
  function verifiedDonationEvents(){
    if(!RAW.verifiedDonations||typeof RAW.verifiedDonations!=="object")return 0;
    return Object.values(RAW.verifiedDonations as any).length;
  }
  function verifiedDonationBags(){
    if(!RAW.verifiedDonations||typeof RAW.verifiedDonations!=="object")return 0;
    return Object.values(RAW.verifiedDonations as any).reduce(
      (sum:number,v:any)=>sum+Math.max(0,Math.floor(Number(v&&v.bags)||0)),0);
  }

  
  let MY_APPLICATION_UID="";
  let AUTH_SESSION_READY=false;
  let APPROVAL_SETTINGS={donorApproval:true,donationApproval:true,emergencyApproval:true,bloodGroupApproval:true};
  let stopApprovalSettings=()=>{};
  
  async function isStaffUser(uid){
    if(!uid)return false;
    try{
      const row=await getRow(NODES.admins,uid);
      const role=String(row&&row.role||"").toLowerCase();
      return (role==="admin"||role==="moderator"||role==="mod")&&String(row?.status||"active")!=="disabled";
    }catch(e){return false}
  }
  let MY_APPLICATION_COUNT_READY=false;
  let MY_APPLICATION_CLEANUP=false;
  let MY_APPLICATION_USER_READY=false;
  let MY_APPLICATION_REQUESTS_READY=false;
  let MY_APPLICATION_USER_ROWS=[];
  let MY_APPLICATION_REQUEST_ROWS=[];
  let stopMyApplicationRequests=()=>{};
  let stopMyProfileListener=()=>{};
  let stopDonorRecListener=()=>{};
  let stopNoticeReads=()=>{};
  let myApplicationNotifUnsubscribe=null;

  function loadData(){
    try{
      const d=JSON.parse(localStorage.getItem(LS_DATA)||"{}");
      ["donations","incoming","mine","notifs","activity","sessions","donors"].forEach(k=>{
        if(Array.isArray(d[k]))RAW[k]=d[k];
      });
      if(d.verifiedDonations&&typeof d.verifiedDonations==="object"&&!Array.isArray(d.verifiedDonations))
        RAW.verifiedDonations=d.verifiedDonations;
      if(d.donationNotes&&typeof d.donationNotes==="object"&&!Array.isArray(d.donationNotes))
        RAW.donationNotes=d.donationNotes;
    }catch(e){}
    if(!RAW.sessions.length){
      RAW.sessions=[{id:"s1",name:thisDevice(),place:"এই ডিভাইস",last:"বর্তমানে সক্রিয়",cur:true}];
    }
  }
  let lastPersistedRaw=null;
  function restoreLastPersistedRaw(){
    if(lastPersistedRaw)Object.assign(RAW,JSON.parse(JSON.stringify(lastPersistedRaw)));
  }
  async function saveData(){
    
    if(MY_APPLICATION_UID&&MY_APPLICATION_USER_READY){
      MY_APPLICATION_USER_ROWS=RAW.mine.slice();
      mergeMyApplications();
    }
    try{
      try{localStorage.setItem(LS_DATA,JSON.stringify(RAW))}catch(e){}
      if(!SHARED_PULLING)await publishPersonalShared();
      
      await pushMyDataToRtdb();
      lastPersistedRaw=JSON.parse(JSON.stringify(RAW));
    }catch(error){
      restoreLastPersistedRaw();
      try{localStorage.setItem(LS_DATA,JSON.stringify(RAW))}catch(e){}
      throw error;
    }
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
  lastPersistedRaw=JSON.parse(JSON.stringify(RAW));
  
  try{
    stopApprovalSettings=watchRow(NODES.settings,"app",row=>{
      const rules=row&&row.rules&&typeof row.rules==="object"?row.rules:{};
      APPROVAL_SETTINGS={
        donorApproval:rules.donorApproval!==false,
        donationApproval:rules.donationApproval!==false,
        emergencyApproval:rules.emergencyApproval!==false && row?.autoApproveEmergency!==true,
        bloodGroupApproval:rules.bloodGroupApproval!==false
      };
    });
  }catch(e){ console.warn("approval settings watch:",e&&e.message); }
  const DB=()=>RAW;

  
  function resetUserCache(){
    try{stopDonorRecListener()}catch(e){}
    Object.assign(STORE.account,{uid:"",name:"",username:"",email:"",phone:"",photo:"",photoSource:"none",
      emailVerified:false,phoneVerified:false,dob:"",gender:"",area:"",address:"",bloodGroup:"",applicationCount:0,joined:iso(now())});
    Object.assign(STORE.donor,{is:false,status:"none",donorId:"",bloodGroup:"",whatsapp:"",lastDonation:"",
      totalDonations:0,totalBags:0,health:"",available:true,appliedAt:"",cardTheme:"green",groupChange:null});
    Object.assign(STORE.privacy,{profile:"all",showPhone:"responders",showWhatsapp:true,showGroup:true,showArea:true,searchable:true});
    Object.assign(STORE.notif,{emergency:true,onlyGroup:true,onlyArea:false,donor:true,account:true,security:true,quiet:false});
    Object.assign(STORE.security,{loginAlert:true,passwordChangedAt:""});
    STORE.noticeReads={};
    STORE.saved=[];
    RAW.donations=[];RAW.verifiedDonations={};RAW.donationNotes={};RAW.incoming=[];RAW.mine=[];RAW.notifs=[];RAW.activity=[];RAW.donors=[];
    RAW.sessions=[{id:"s1",name:thisDevice(),place:"এই ডিভাইস",last:"বর্তমানে সক্রিয়",cur:true}];
    try{localStorage.removeItem(LS);localStorage.removeItem(LS_DATA);}catch(e){}
  }
  
  (function guardStaleCache(){
    try{
      const memberUid=localStorage.getItem("cbdcMemberUid")||"";
      const cachedUid=STORE.account.uid||"";
      if(memberUid && cachedUid!==memberUid) resetUserCache();
    }catch(e){}
  })();
  
  
  const donorReady=d=>!d.lastDonation||dayDiff(d.lastDonation)>=90;
  const donorRest=d=>d.lastDonation?Math.max(0,90-dayDiff(d.lastDonation)):0;
  
  const GROUPS=SITE.bloodGroups.slice();
  const AREAS=SITE.areas.slice();
  
  const validBloodGroup=v=>GROUPS.includes(String(v||"").trim());
  
  function bloodGroupFromAccountRow(row){
    if(!row||typeof row!=="object")return "";
    const candidates=[row.bloodGroup,row.group,row.blood_group,
      row.profile&&row.profile.bloodGroup,row.account&&row.account.bloodGroup,
      row.data&&row.data.bloodGroup];
    return candidates.map(v=>String(v||"").trim()).find(validBloodGroup)||"";
  }
  function accountBloodGroup(){
    const accountValue=String(STORE.account.bloodGroup||"").trim();
    if(validBloodGroup(accountValue))return accountValue;
    const donorValue=String(STORE.donor.bloodGroup||"").trim();
    return validBloodGroup(donorValue)?donorValue:"";
  }
  const HOSPITALS=["চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল","চমেক ব্লাড ব্যাংক","ম্যাক্স হাসপাতাল, মেহেদীবাগ",
    "সিএসসিআর হাসপাতাল","পার্কভিউ হাসপাতাল","ইম্পেরিয়াল হাসপাতাল","মেট্রোপলিটন হাসপাতাল",
    "রেড ক্রিসেন্ট ব্লাড ব্যাংক","সন্ধানী, চমেক","ক্লাবের রক্তদান ক্যাম্প"];
  
  
  function requestForDoner(r){
    let left=24;
    if(r.expiresAt){const ms=new Date(r.expiresAt).getTime()-Date.now();if(Number.isFinite(ms))left=Math.max(0,Math.ceil(ms/36e5))}
    return {id:r.id,patient:r.patientName,group:r.bloodGroup,bags:r.bags,hospital:r.hospitalName,
      area:r.hospitalAddress,km:"২.৫",urgency:r.urgency,phone:r.phone,left,
      status:r.workflowStatus||"approved",neededBy:(r.expiresAt||"").slice(0,10),responders:[]};
  }
  async function pullSharedPublic(){
    if(!window.CBDCShared)return;
    SHARED_PULLING=true;
    const st=CBDCShared.load();
    RAW.donors=st.donors.filter(d=>d.status!=="pending"&&!d.suspended).map(CBDCShared.toDonerDonor);
    RAW.incoming=st.requests.filter(r=>r.status!=="cancelled"&&r.status!=="resolved").map(requestForDoner);
    RAW.notices=(st.notices||[]).filter(n=>n.status==="published");
    
    
    const uid=firebaseCurrentUid();
    const mine=st.donors.find(d=>uid&&String(d.ownerUid)===String(uid));
    if(mine){
      const wasDonor = STORE.donor.is;
      STORE.donor.is=true;
      STORE.donor.status="approved";STORE.donor.donorId=mine.donorId||mine.id;
      STORE.donor.bloodGroup=mine.group||mine.bloodGroup||STORE.donor.bloodGroup;
      STORE.donor.lastDonation=mine.lastDonation||mine.lastDonationDate||"";
      STORE.donor.totalDonations=Math.max(0,Number(mine.donations??mine.totalDonations??0))||0;
      STORE.donor.totalBags=Math.max(0,Number(mine.totalBags??0))||0;
      
      if(mine.available!==undefined)STORE.donor.available=!!mine.available;
      if(typeof mine.whatsapp==="string")STORE.donor.whatsapp=mine.whatsapp;
      if(!wasDonor){
        try{ persistLocalAccount(); }catch(e){}
        
        await pushAccountToRtdb();
      }
    }
    try{localStorage.setItem(LS_DATA,JSON.stringify(RAW));localStorage.setItem(LS,JSON.stringify({
      account:STORE.account,donor:STORE.donor,privacy:STORE.privacy,notif:STORE.notif,prefs:STORE.prefs,
      security:STORE.security,saved:STORE.saved}))}catch(e){}
    SHARED_PULLING=false;
    
    try{ syncNotifsFromData(); }catch(e){ console.warn("notif sync:", e && e.message); }
  }
  async function publishPersonalShared(){
    if(SHARED_PULLING||!window.CBDCShared||!STORE.account.name)return;
    
    const _uid = String(firebaseCurrentUid()||"").trim();
    if(!_uid) return;
    await CBDCShared.updateAsync(st=>{
      const a=STORE.account,d=STORE.donor,owner=_uid;
      const ai=st.accounts.findIndex(x=>x.uid===owner||a.email&&x.email===a.email);
      const account={uid:owner,name:a.name,username:a.username,email:a.email,phone:a.phone,photo:a.photo,
        gender:a.gender,area:a.area,address:a.address,role:"donor",status:"active",joined:a.joined};
      ai<0?st.accounts.push(account):st.accounts[ai]={...st.accounts[ai],...account};
      const qid="PD-"+String(d.donorId||owner).replace(/[^A-Za-z0-9]/g,"").slice(-10);
      const oldQ=st.queue.findIndex(q=>q.kind==="donor"&&String(q.ownerUid)===String(owner));
      if(d.is&&d.status==="pending"){
        const q={kind:"donor",id:qid,donorId:d.donorId,name:a.name,group:d.bloodGroup,area:a.area,
          dob:a.dob||"",health:d.health||"",last:d.lastDonation||"",gender:a.gender,
          phone:a.phone,whatsapp:d.whatsapp||"",photo:a.photo||"",ownerUid:owner,at:new Date().toISOString()};
        oldQ<0?st.queue.unshift(q):st.queue[oldQ]={...st.queue[oldQ],...q};
      }else if(oldQ>=0)st.queue.splice(oldQ,1);
      
      RAW.mine.forEach(m=>{
        const qi=st.queue.findIndex(q=>q.kind==="request"&&q.id===m.id);
        const ri=st.requests.findIndex(r=>r.id===m.id);
        if(m.status==="pending"){
          const q={kind:"request",id:m.id,patient:m.patient,group:m.group,bags:m.bags,urgency:m.urgency,
            hospital:m.hospital,area:m.address||a.area,phone:a.phone,requester:a.name,ownerUid:owner,
            at:m.createdAt||new Date().toISOString(),expiresAt:m.neededBy?m.neededBy+"T23:59:59":""};
          qi<0?st.queue.unshift(q):st.queue[qi]={...st.queue[qi],...q};
        }else{
          
          if(qi>=0)st.queue.splice(qi,1);
          if((m.status==="cancelled"||m.status==="done"||m.status==="rejected")&&ri>=0)st.requests.splice(ri,1);
          else if(ri>=0&&String(st.requests[ri].ownerUid||"")===owner){
            
            st.requests[ri]={...st.requests[ri],requesterName:a.name,requester:a.name,
              phone:a.phone,whatsapp:a.phone,hospitalAddress:st.requests[ri].hospitalAddress||m.address||a.area};
          }
        }
      });
      
      RAW.donations.filter(x=>!isVerifiedOrLegacy(x)&&!donRejected(x)).forEach((x,i)=>{
        const ownerKey=owner.replace(/[^A-Za-z0-9]/g,"").slice(-8)||"unknown";
        const id="DN-"+ownerKey+"-"+String(x.date||"").replace(/[^0-9]/g,"")+"-"+donationVerKey(x).replace(/^v/,"");
        if(!st.queue.some(q=>q.kind==="donation"&&q.id===id))st.queue.unshift({kind:"donation",id,
          name:a.name,place:x.place,date:x.date,bags:x.bags,proof:!!x.proof,proofUrl:x.proof||"",
          patient:x.pat||"",note:x.note||"",ownerUid:owner,at:new Date().toISOString()});
      });
      return st;
    },"doner:personal");
  }
  
  
  function syncNotifsFromData(){
    const uid=String(STORE.account.uid||"").trim();
    if(!uid)return;
    
    let seen=loadSeen();
    const seenUid=String(seen.uid||"").trim();
    if(seenUid!==uid){
      resetNotificationContext(uid);
      seen=loadSeen();
    }
    const d=STORE.donor;
    
    RAW.notices.forEach(n=>{
      if(!noticeVisibleTo(n,"donor"))return;
      addNotif({id:"notice-"+sanitizeKey(n.id),title:n.title,body:n.body||"",type:"info",noticeId:n.id,ref:n.id,go:"home"});
    });
    
    if(!seen.booted){
      seen.uid=uid;
      RAW.mine.forEach(m=>{ if(m&&m.id&&m.status)seen.reqStatus[m.id]=m.status; });
      DB().incoming.forEach(r=>{ if(r&&r.id)seen.incoming[r.id]=1; });
      seen.donorStatus=d.status||"";
      seen.bloodGroup=d.bloodGroup||"";
      seen.lastDonation=d.lastDonation||"";
      seen.groupChangeStatus=(d.groupChange&&d.groupChange.status)||"";
      
      seen.donRej={};
      const _dn0=RAW.donationNotes&&typeof RAW.donationNotes==="object"?RAW.donationNotes:{};
      Object.keys(_dn0).forEach(vk=>{ if(_dn0[vk]&&_dn0[vk].status==="rejected")seen.donRej[vk]=1; });
      seen.booted=true;
      saveSeen(seen);
      return;
    }
    
    const mineIds=new Set();
    RAW.mine.forEach(m=>{
      if(!m||!m.id)return;
      mineIds.add(m.id);
      const prev=seen.reqStatus[m.id], cur=String(m.status||"");
      if(cur==="approved"||cur==="matched"){
        if(prev&&prev!=="approved"&&prev!=="matched"){
          addNotif({id:"req-appr-"+sanitizeKey(m.id),title:"জরুরি রক্তের আবেদন অনুমোদিত",
            body:`${m.group||""} · ${m.patient||""} · ${m.hospital||""}`.replace(/^ · | · $/g,"")||"আপনার জরুরি রক্তের আবেদনটি অনুমোদিত হয়েছে।",
            type:"approval",ref:m.id,go:"req:mine"});
        }else if(!prev){
          
          addNotif({id:"req-appr-"+sanitizeKey(m.id),title:"জরুরি রক্তের আবেদন অনুমোদিত",
            body:`${m.group||""} · ${m.patient||""} · ${m.hospital||""}`.replace(/^ · | · $/g,"")||"আপনার জরুরি রক্তের আবেদনটি অনুমোদিত হয়েছে।",
            type:"approval",ref:m.id,go:"req:mine"});
        }
      }else if(cur==="rejected"&&prev&&prev!=="rejected"){
        addNotif({id:"req-rej-"+sanitizeKey(m.id),title:"জরুরি রক্তের আবেদন বাতিল",
          body:m.rejectNote?`কারণ: ${m.rejectNote}`:`${m.group||""} · ${m.patient||""}`,
          type:"rejected",ref:m.id,go:"req:mine"});
      }
      if(cur)seen.reqStatus[m.id]=cur;
    });
    
    if(d.is&&d.status==="approved"&&d.available!==false&&d.bloodGroup){
      DB().incoming.forEach(r=>{
        if(!r||!r.id)return;
        if(mineIds.has(r.id))return;               
        if(r.group!==d.bloodGroup)return;
        if(seen.incoming[r.id])return;
        seen.incoming[r.id]=1;
        addNotif({id:"em-"+sanitizeKey(r.id),title:"জরুরি রক্তের প্রয়োজন",
          body:`আপনার রক্তের গ্রুপ ${d.bloodGroup} এবং একটি জরুরি ${d.bloodGroup} রক্তের আবেদন পাওয়া গেছে। ${[r.hospital,r.area].filter(Boolean).join(" · ")}। বিস্তারিত দেখতে ক্লিক করুন।`,
          type:"emergency",ref:r.id,go:"req:for"});
      });
    }
    
    const ds=d.status||"";
    if(seen.donorStatus==="pending"&&ds==="approved")
      addNotif({id:"donor-appr",title:"রক্তদাতা আবেদন অনুমোদিত",
        body:"আপনার ডোনার আবেদন অনুমোদিত হয়েছে। ডোনার ID: "+(d.donorId||""),type:"approval",ref:d.donorId,go:"req:become"});
    
    else if(seen.donorStatus==="pending"&&ds==="rejected")
      addNotif({id:"donor-rej",title:"ডোনার আবেদন বাতিল",
        body:STORE.donor.donorRejectNote?`কারণ: ${STORE.donor.donorRejectNote}`:"আপনার রক্তদাতা আবেদনটি বাতিল করা হয়েছে।",type:"rejected",go:"req:become"});
    if(ds)seen.donorStatus=ds;
    
    if(d.is&&d.status==="approved"&&seen.bloodGroup&&seen.bloodGroup!==d.bloodGroup&&d.bloodGroup)
      addNotif({id:"grp-"+sanitizeKey(seen.bloodGroup+"-"+d.bloodGroup),title:"রক্তের গ্রুপ পরিবর্তন অনুমোদিত",
        body:`${seen.bloodGroup} → ${d.bloodGroup}`,type:"approval",go:"set:donor"});
    if(d.bloodGroup)seen.bloodGroup=d.bloodGroup;
    
    {
      const gc=d.groupChange&&typeof d.groupChange==="object"?d.groupChange:null;
      const gs=(gc&&gc.status)||"";
      if(gs==="rejected"&&seen.groupChangeStatus==="pending")
        addNotif({id:"grp-rej-"+sanitizeKey(String(gc.id||gc.at||"")),title:"রক্তের গ্রুপ পরিবর্তনের অনুরোধ বাতিল",
          body:gc.note?`কারণ: ${gc.note}`:`${gc.from||""} → ${gc.to||""} অনুরোধটি অনুমোদিত হয়নি।`,
          type:"rejected",go:"set:donor"});
      seen.groupChangeStatus=gs;
    }
    
    const _dn=RAW.donationNotes&&typeof RAW.donationNotes==="object"?RAW.donationNotes:{};
    Object.keys(_dn).forEach(vk=>{
      const nn=_dn[vk];
      if(!nn||nn.status!=="rejected")return;
      if(seen.donRej&&seen.donRej[vk])return;
      const rec=RAW.donations.find(y=>y&&donationVerKey(y)===vk);
      addNotif({id:"dn-rej-"+sanitizeKey(vk),title:"রক্তদান যাচাই বাতিল হয়েছে",
        body:String(nn.note||"").trim()
          ?"কারণ: "+String(nn.note).trim()
          :((rec&&(rec.date||"")+" · "+(rec.place||""))||"আপনার রক্তদানের রেকর্ডটি বাতিল করা হয়েছে।"),
        type:"rejected",ref:vk,go:"set:adddonation"});
      (seen.donRej||(seen.donRej={}))[vk]=1;
    });
    
    if(d.lastDonation&&seen.lastDonation&&seen.lastDonation!==d.lastDonation){
      const hit=RAW.donations.find(x=>x&&x.date===d.lastDonation);
      if(hit&&isVerifiedDonation(hit))addNotif({id:"dn-"+sanitizeKey(d.lastDonation),title:"রক্তদান যাচাই সম্পন্ন",
        body:`${dL(d.lastDonation)}${hit.place?" · "+hit.place:""}`,type:"approval",go:"set:adddonation"});
    }
    if(d.lastDonation)seen.lastDonation=d.lastDonation;
    saveSeen(seen);
  }
  
  pullSharedPublic();
  
  
  
  
  const ageFromDob=v=>{const a=calcAgeFromDob(v);return a===null?"":a};
  const DOB_BOUNDS=dobBounds(SITE.rules.minAge,SITE.rules.maxAge);
  const DFIELDS=[
    {k:"name",  label:"নাম",         type:"text"},
    {k:"gender",label:"লিঙ্গ",       type:"select",options:["পুরুষ","মহিলা","অন্যান্য"]},
    
    {k:"dob",   label:"জন্ম তারিখ",  type:"date",min:DOB_BOUNDS.min,max:DOB_BOUNDS.max},
    {k:"area",  label:"এলাকা",       type:"select",options:AREAS},
    {k:"phone", label:"মোবাইল",      type:"tel",max:11}
  ];
  const acctVal=k=>k==="age"?ageFromDob(STORE.account.dob):STORE.account[k];
  
  const subjectAge=()=>{const S=cardSubject();return ageFromDob(S.a&&S.a.dob||"");};
  const subjectAgeText=()=>{const a=subjectAge();return a===""?"—":ageText(String(a))};
  
  let CARD_FOR=null;                       
  function cardSubject(){
    if(!CARD_FOR)return {a:STORE.account,d:STORE.donor,mine:true};
    const x=CARD_FOR;
    return {
      mine:false,
      a:{name:x.name,gender:x.gender,area:x.area,phone:x.phone,photo:x.photo||"",dob:x.dob||""},
      d:{donorId:x.donorId,bloodGroup:x.group,lastDonation:x.lastDonation||"",
         available:true,cardTheme:"green",whatsapp:!!x.phone}
    };
  }
  
  const dvAge=()=>ageFromDob(dv("dob"));
  const dvAgeText=()=>{const a=dvAge();return a===""?"":ageText(String(dv("dob")))};
  const dv=k=>{
    const S=cardSubject();
    if(!S.mine)return S.a&&S.a[k]||"";
    return acctVal(k)||"";
  };
  const isDonor=()=>STORE.donor.is;
  const dStatus=()=>STORE.donor.status;
  const restLeft=()=>STORE.donor.lastDonation?Math.max(0,90-dayDiff(STORE.donor.lastDonation)):0;
  const myReqs=()=>DB().incoming.filter(r=>r.group===STORE.donor.bloodGroup);
  function sharedPublicState(){
    try{return window.CBDCShared?CBDCShared.load():{requests:[],notices:[]}}catch(e){return {requests:[],notices:[]}}
  }
  
  function homeWebsiteNotices(){
    return (sharedPublicState().notices||[]).filter(n=>noticeVisibleTo(n,"website"));
  }
  function homeRequestExpired(r){
    const t=r&&(r.expiresAt||r.neededBy);
    if(!t)return false;
    let d;
    if(t&&t.toDate)d=t.toDate();
    else if(t&&t.seconds)d=new Date(t.seconds*1000);
    else d=new Date(t);
    return d.getTime()<=Date.now();
  }
  function homeRemainingTimeText(expiresAt){
    if(!expiresAt)return "";
    let expTime=0;
    if(expiresAt&&expiresAt.toDate)expTime=expiresAt.toDate().getTime();
    else if(expiresAt&&expiresAt.seconds)expTime=expiresAt.seconds*1000;
    else expTime=new Date(expiresAt).getTime();
    const diffMs=expTime-Date.now();
    if(diffMs<=0)return "সময় শেষ";
    const totalMins=Math.floor(diffMs/60000),hours=Math.floor(totalMins/60),mins=totalMins%60;
    if(hours>=24){const days=Math.floor(hours/24);return `বাকি ${bn(days)} দিন`;}
    if(hours>0)return `বাকি ${bn(hours)} ঘণ্টা ${mins>0?bn(mins)+" মি.":""}`;
    return `বাকি ${bn(mins)} মিনিট`;
  }
  function homeUrgencyPill(u){
    const v=String(u||"");
    if(v.includes("অতিজরুরি"))return ["r","অতিজরুরি"];
    if(v.includes("আগামী"))return ["g","২৪ ঘণ্টা"];
    if(v.includes("আজকের"))return ["a","আজকের মধ্যে"];
    if(v.includes("জরুরি"))return ["a","জরুরি"];
    return ["r","জরুরি"];
  }
  function homeLiveRequests(){
    return (sharedPublicState().requests||[]).filter(r=>String(r&&r.status||"").trim().toLowerCase()==="approved"&&!homeRequestExpired(r));
  }
  function homeWaLink(value){
    const wa=String(value||"").replace(/\D/g,"");
    return wa?"https://wa.me/88"+wa.slice(1):"";
  }
  function homeEmergencyCard(r){
    const group=r.bloodGroup||r.group||"";
    const patient=r.patientName||r.patient||"";
    const hospital=r.hospitalName||r.hospital||"";
    const area=r.hospitalAddress||r.area||r.address||"";
    const phone=r.phone||"";
    const requester=r.requesterName||r.requester||"";
    const time=r.createdAt?new Date(r.createdAt).toLocaleString("bn-BD",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
    const remaining=homeRemainingTimeText(r.expiresAt||r.neededBy);
    const [pillClass,pillText]=homeUrgencyPill(r.urgency||"");
    const wa=homeWaLink(r.whatsapp||r.phone);
    return `<div class="reqc mt home-live-card">
      <h4>${esc(patient)} <span class="bg">${esc(group)}</span>
        <span class="pill ${pillClass}">${esc(remaining||pillText)}</span></h4>
      ${time?`<p>${ICON.clock(13)} ${esc(time)}</p>`:""}
      <p>${ICON.hospital(13)} ${esc(hospital)}</p>
      <p>${ICON.pin(13)} ${esc(area)} · ${bn(r.bags||1)} ব্যাগ</p>
      <p>${ICON.phone(13)} ${esc(requester)}${phone?` — ${esc(phone)}`:""}</p>
      <div class="a">${phone?`<a class="btn sm" href="tel:${esc(phone)}">${ICON.phone(14)} কল</a>`:""}
        ${wa?`<a class="btn gh sm" href="${wa}" target="_blank" rel="noopener">${ICON.chat(14)} WhatsApp</a>`:""}</div></div>`;
  }
  const unread=()=>effectiveNotifs().filter(n=>!n.read).length;   
  const donorPill=()=>{
    if(!isDonor())return "";
    if(dStatus()==="pending")return `<span class="pill a">যাচাই চলছে</span>`;
    
    if(dStatus()==="rejected")return `<span class="pill r">আবেদন বাতিল হয়েছে</span>`;
    if(!STORE.donor.available)return `<span class="pill m">প্রাপ্যতা বন্ধ</span>`;
    if(restLeft()>0)return `<span class="pill a">${tp(`বিশ্রামে · আর ${bn(restLeft())} দিন`)}</span>`;
    return `<span class="pill g">রক্তদানে প্রস্তুত</span>`;
  };
  
  
  const NAV=[
    {id:"home",label:"হোম",icon:ICON.home},
    {id:"find",label:"রক্তদাতা",icon:ICON.drop},
    {id:"req",label:"আবেদন",icon:ICON.plus},
    {id:"set",label:"সেটিংস",icon:ICON.gear}
  ];
  let CUR="home", SUB=null;
  
  function go(id,sub=null,push=true){
    if(id==="req"&&(sub==="for"||sub==="mine"||sub==="become")){
      reqTab=sub;
      
      sub=null;
    }
    CUR=id;SUB=sub;
    $$(".scr").forEach(s=>s.classList.remove("on"));
    if(sub){ $("#s-sub").classList.add("on"); renderSub(sub); }
    else{ $("#s-"+id).classList.add("on"); RENDER[id](); }
    paintTop();paintNav();
    if(push){
      
      const p=screenPath("doner",id,sub||null)+location.search;
      try{ if(location.pathname+location.search!==p)history.pushState(null,"",p); }catch(e){}
    }
    window.scrollTo({top:0,behavior:"instant"});
  }
  function paintNav(){
    $("#bnav").innerHTML=NAV.map(n=>`<button data-nav="${n.id}" class="${CUR===n.id||(CUR==="become"&&n.id==="req")?"on":""}"
      aria-label="${n.label}">${n.icon(23)}<span>${n.label}</span></button>`).join("");
  }
  function paintTop(){
    const t=$("#top");
    if(PUBLIC_MODE){
      t.className="top";
      t.innerHTML=`<a class="brand" href="${appBase()}">
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
    }else if(CUR==="become"){
      t.className="top sub";
      t.innerHTML=`<button class="back" id="tback" aria-label="পেছনে">${ICON.back(22)}</button>
        <h1>রক্তদাতা হিসেবে যুক্ত হন</h1><div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${ICON.bell(21)}${badge()}</button>`;
    }else{
      t.className="top";
      t.innerHTML=`<a class="brand" href="${appBase()}" data-home="1">
          <span class="lg"><img src="${LOGO}" alt="CBDC লোগো"></span><b>চকবাজার ব্লাড ডোনার'স ক্লাব</b></a>
        <nav class="dnav">${NAV.map(n=>`<button data-nav="${n.id}" class="${CUR===n.id?"on":""}"
          title="${n.label}">${n.icon(22)}<span>${n.label}</span></button>`).join("")}</nav>
        <div class="sp"></div>
        <button class="bell" id="tbell" aria-label="বিজ্ঞপ্তি">${ICON.bell(21)}${badge()}</button>`;
    }
  }
  const badge=()=>{const u=unread();return u&&STORE.prefs.badge?`<span class="bd">${bn(u)}</span>`:""};
  
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-home]")){e.preventDefault();navigateToPage("home");return}
    const n=e.target.closest("[data-nav]");
    if(n){e.preventDefault();go(n.dataset.nav);return}
    if(e.target.closest("#tback")){
      if(CUR==="become"){reqTab="become";go("req");return}
      go(CUR);return}
    if(e.target.closest("#tbell")){openNotifs();return}
  });
  const reRoute=()=>{
    const seg=panelSubPath("doner");
    const [a,b]=(seg||location.hash.replace("#","")).split("/");
    if(!a)return go("home",null,false);
    if(RENDER[a])go(a,b||null,false);
  };
  window.addEventListener("popstate",reRoute);
  window.addEventListener("hashchange",reRoute); 
  
  
  function rHome(){
    const a=STORE.account,d=STORE.donor,don=DB().donations,inc=myReqs();
    
    const myDonationEvents=isDonor()&&dStatus()==="approved"
      ?Math.max(0,Number(STORE.donor.totalDonations ?? STORE.donor.donations ?? 0)):0;
    const hr=new Date().getHours();
    const greet=hr<12?"শুভ সকাল":hr<17?"শুভ দুপুর":hr<20?"শুভ সন্ধ্যা":"শুভ রাত্রি";
  
    const statusCard = !isDonor()
      ? `<div class="card">
          <div class="per"><span style="width:44px;height:44px;border-radius:50%;background:var(--red-s);
            display:grid;place-items:center;color:var(--red)">${ICON.drop(24)}</span>
            <div class="i"><b>রক্তদাতা হিসেবে নিবন্ধিত নন</b><small>আপনি এখনো রক্তদাতা হিসেবে আবেদন করেননি। 'রক্তদাতা হিসেবে যুক্ত হন' অপশন থেকে আবেদন করুন।</small></div></div>
          <button class="btn w" style="margin-top:12px" data-act="become">রক্তদাতা হিসেবে যুক্ত হন</button></div>`
      : `<div class="card">
          <div class="per"><span class="bg" style="width:46px;height:46px;border-radius:12px;font-size:1rem">${esc(d.bloodGroup)}</span>
            <div class="i"><b>${esc(dv("name"))}</b><small>${d.donorId?esc(d.donorId)+" · ":""}${esc(dv("area"))}${d.donorId?"":dStatus()==="pending"?" · অ্যাডমিন অনুমোদনের অপেক্ষায়":""}</small></div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin:11px 0">${donorPill()}
            ${dStatus()==="approved"?`<span class="pill b n">${ICON.checkC(12)} যাচাইকৃত</span>`:""}</div>
          <div style="display:flex;gap:8px">
            <button class="btn gh sm" style="flex:1" data-act="card">${ICON.card(16)} কার্ড</button>
            <button class="btn gh sm" style="flex:1" data-sub="donor">${ICON.user(16)} তথ্য</button></div></div>`;
  
    const alert = (inc.length&&isDonor()) ? `<div class="card" style="border-color:rgba(224,36,47,.3)">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <span style="color:var(--red);flex:none">${ICON.warn(20)}</span>
          <div style="flex:1"><b style="font-size:.88rem">আপনার জন্য গুরুত্বপূর্ণ</b>
            <p class="mut" style="margin-top:2px">${tp(`${bn(inc.length)}টি ${esc(d.bloodGroup)} জরুরি আবেদন আপনার এলাকার কাছে`)}</p></div></div>
        <div style="display:flex;gap:8px;margin-top:11px">
          <button class="btn red sm" style="flex:1" data-nav="req">আবেদনগুলো দেখুন</button>
          <button class="btn gh sm" data-act="snooze">পরে</button></div></div>` : "";
  
    const nx=d.lastDonation?addD(d.lastDonation,90):null;
    const stats=isDonor()?`<div class="stats">
      <div class="stat"><b>${bn(myDonationEvents)}</b><span>মোট রক্তদান</span></div>
      <div class="stat"><b style="color:var(--red)">${bn(myDonationEvents)}</b><span>জীবন বাঁচিয়েছেন</span></div>
      <div class="stat"><b style="font-size:.9rem;padding:5px 0">${restLeft()?dS(nx):"এখনই"}</b><span>পরবর্তী রক্তদান</span></div>
      <div class="stat"><b>${bn(DB().mine.length)}</b><span>আমার আবেদন</span></div></div>`:"";
  
    let ready="";
    if(isDonor()&&d.lastDonation&&dStatus()==="approved"){
      const dd=dayDiff(d.lastDonation),pct=Math.min(100,Math.round(dd/90*100)),lf=restLeft();
      ready=`<div class="card"><div style="display:flex;justify-content:space-between;font-size:.8rem;font-weight:700;margin-bottom:7px">
          <span>রক্তদানের প্রস্তুতি</span><span style="color:${lf?"var(--amb)":"var(--grn)"}">${lf?`আর ${bn(lf)} দিন`:"প্রস্তুত ✓"}</span></div>
        <div style="height:8px;border-radius:99px;background:var(--card2);overflow:hidden">
          <div style="height:100%;width:${lf?pct:100}%;border-radius:99px;background:${lf?"var(--amb)":"var(--grn)"};transition:width .5s"></div></div>
        <p class="mut" style="margin-top:8px">${lf?tp(`${dL(nx)} তারিখে আবার রক্ত দিতে পারবেন।`)
          :tp(`সর্বশেষ রক্তদানের পর ${bn(dd)} দিন পার হয়েছে।`)}</p></div>`;
    }
    const websiteNotices=homeWebsiteNotices();
    const liveBoardRequests=homeLiveRequests();
    const noticeBlock=(websiteNotices.length?`<div class="sec-t">নোটিশ</div>
      <div class="home-notices">${websiteNotices.map(n=>`<article class="home-notice">
        <h3>${esc(n.title||"")}</h3><p>${esc(n.body||"")}</p></article>`).join("")}</div>`:"");
    const liveBoardBlock=(liveBoardRequests.length?`<div class="sec-t">লাইভ সহায়তা বোর্ড</div>
      <div class="home-live-grid">${liveBoardRequests.map(homeEmergencyCard).join("")}</div>`:"");
  
    const acts=DB().activity.slice(0,4);
    const actHTML=acts.length?`<div class="tl">${acts.map(x=>`<div class="tli ${x.type==="security"?"b":x.type==="donor"?"":"r"}">
        <b>${esc(x.title)}</b><small>${esc(x.detail)} · ${timeAgo(x.at)}</small></div>`).join("")}</div>`
      :`<div class="empty" style="padding:26px"><div class="ic">${ICON.clock(24)}</div>
        <b>এখনো কিছু নেই</b><p>আপনার কার্যক্রম এখানে দেখা যাবে</p></div>`;
  
    $("#s-home").innerHTML=`
      <h2 class="ptitle">${a.name?`${greet}, ${esc(a.name.split(" ")[0])}`:greet}
        <small>${now().toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long"})}</small></h2>
      ${noticeBlock}
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
      ${liveBoardBlock}
      <div class="card pad0">
        <div style="display:flex;align-items:center;padding:13px 15px 4px">
          <b style="font-size:.88rem;flex:1">সাম্প্রতিক কার্যক্রম</b>
          <button class="btn lnk" data-sub="activity" style="font-size:.76rem">সব দেখুন</button></div>
        <div style="padding:12px 15px 15px">${actHTML}</div></div>`;
  }
  function timeAgo(at){
    
    const d=bdDate(at),diff=(bdNow()-d)/1000;
    if(diff<3600){const v=Math.max(1,Math.floor(diff/60));return tp(`${bn(v)} মিনিট আগে`)}
    if(diff<86400){const v=Math.floor(diff/3600);return tp(`${bn(v)} ঘণ্টা আগে`)}
    if(bdDayKey(at)===1)return "গতকাল";
    return bdDateText(at,LOC(),{day:"numeric",month:"short"});
  }
  
  
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
      &&(!findQ.ready||(donorReady(d)&&d.available!==false)));
    box.innerHTML=rows.length?`
      <div style="display:flex;align-items:center;margin:4px 4px 10px">
        <b style="font-size:.85rem;flex:1">${tp(`${bn(rows.length)} জন রক্তদাতা পাওয়া গেছে`)}</b>
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
  
  function donorCardHTML(d,i){
    const id=d.donorId||("CBDC-2026-"+String(i+1).padStart(4,"0"));
    
    const ageStr=ageText(d);
    const age=ageStr==="—"?"":`বয়স ${ageStr}`;
    const last=d.lastDonation?dL(d.lastDonation):"নতুন দাতা";
    
    const avail=d.available!==false;
    const ready=donorReady(d)&&avail;
    const pv=d.privacy||{};
    const phone=d.phone;                       
    const wa=pv.showWhatsapp!==false?phone:"";
    return `<div class="dcard-item" data-prof="${esc(d.uid||"")}">
      <div class="dc-top">
        <div>
          <div class="dc-id">${esc(id)}</div>
          <div class="dc-name">${esc(d.name)}</div>
          <div class="dc-st ${ready?"":avail?"rest":"off"}">${ready?"✓ রক্তদানে প্রস্তুত"
            :avail?`বিশ্রামে · আর ${bn(donorRest(d))} দিন`:"প্রাপ্যতা বন্ধ"}</div>
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
  
  function safeName(name,fallback="donor"){
    const ascii=String(name||"").replace(/[^\x20-\x7E]/g,"").replace(/\s+/g,"-")
      .replace(/-+/g,"-").replace(/^-|-$/g,"");
    return ascii.length>=2?ascii:fallback;
  }
  function dl(blob,name){
    
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=name||"download";
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  }
  
  
  let profId=null;                       
  
  
  function meAsDonor(){
    const a=STORE.account,d=STORE.donor;
    return {
      uid:"me", donorId:d.donorId||"—",
      name:a.name||"আপনি", gender:a.gender, photo:a.photo,
      group:d.bloodGroup, area:a.area, dob:a.dob||"", age:ageFromDob(a.dob),
      occupation:a.occupation||"", phone:a.phone, whatsapp:!!d.whatsapp,
      lastDonation:d.lastDonation,
      
      totalDonations:STORE.donor.status==="approved"
        ?Math.max(0,Number(STORE.donor.totalDonations ?? STORE.donor.donations ?? 0)):0,
      totalBags:STORE.donor.status==="approved"?Math.max(0,Number(STORE.donor.totalBags??0)):0,
      joined:a.joined||"", verified:d.status==="approved", bio:a.bio||"",
      available:STORE.donor.available!==false,
      privacy:{showArea:STORE.privacy.showArea,
               showGroup:STORE.privacy.showGroup,showWhatsapp:STORE.privacy.showWhatsapp}
    };
  }
  
  function profileView(id){
    if(id==="__missing__")return null;
    const mine=!id||id==="me";
    const d=mine?meAsDonor():DB().donors.find(x=>x.uid===id);
    if(!d)return null;
    const pv=d.privacy||{};
    const show=k=>mine||pv[k]!==false;
    return {
      mine, raw:d,
      name:d.name, photo:d.photo||d.photoURL||"", gender:d.gender, donorId:d.donorId,
      verified:d.verified, bio:d.bio||"",
      dob:d.dob||"",
      group:show("showGroup")&&d.group?d.group:null,
      area:show("showArea")&&d.area?d.area:null,
      age:d.age||null, occupation:d.occupation||"",
      phone:d.phone||null,
      
      whatsapp:(pv.showWhatsapp!==false&&(d.whatsappNo||d.phone))?(d.whatsappNo||d.phone):null,
      total:d.totalDonations||0,
      totalBags:d.totalBags||0,
      last:d.lastDonation||"",
      ready:donorReady(d)&&d.available!==false, avail:d.available!==false,
      rest:donorRest(d),
      joined:d.joined||""
    };
  }
  function openProfile(id){profId=id||"me";go("find","profile")}
  
  
  
  function pubDirectory(){
    try{
      const st=window.CBDCShared?CBDCShared.load():null;
      if(st&&Array.isArray(st.donors))return st.donors;
    }catch(e){}
    return [];
  }
  
  function fromPublic(r){
    const bnNum=v=>String(v??"").replace(/[০-৯]/g,d=>"০১২৩৪৫৬৭৮৯".indexOf(d));
    return {
      uid:r.id, donorId:r.id, name:r.name, gender:r.gender, photo:r.photo||"",
      group:r.bloodGroup||r.group||"", area:r.area||"",
      age:parseInt(bnNum(r.age),10)||null, occupation:r.occupation||"",
      phone:r.phone||"", lastDonation:r.lastDonationDate||r.lastDonation||"",
      
      totalDonations:Math.floor(Math.max(0,Number(r.donations ?? r.totalDonations ?? 0))),
      totalBags:Math.floor(Math.max(0,Number(r.totalBags ?? 0))),
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
  
  let PUBLIC_MODE=false;
  function bootPublicProfile(){
    const uid=new URLSearchParams(location.search).get("uid");
    if(!uid)return false;
    const d=resolveUid(uid);
    PUBLIC_MODE=true;
    document.body.dataset.pub="1";
    if(d){
      
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
  
  
  function profileCardDL(){
    const v=profileView(profId);
    if(!v)return;
    if(v.mine){CARD_FOR=null;sheetDownload();return}
    CARD_FOR={name:v.name,gender:v.raw.gender,area:v.area,phone:v.phone,
      photo:v.photo||"",donorId:v.donorId,group:v.group,
      age:v.age,lastDonation:v.last};
    const s=sheetDownload();
    
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
      ${PUBLIC_MODE?`<a class="btn gh" href="${appBase()}">${ICON.home?ICON.home(15):""} রক্তদাতা তালিকায় ফিরুন</a>`:""}
      </div></div>`;return}
    const saved=STORE.saved.includes(v.name);
    el.innerHTML=`
      <div class="pcard">
        <div class="phead2">
          <img class="pav" src="${AV(v.gender,v.photo)}" alt="" data-ph="${AV(v.gender,"")}"
            onerror="this.onerror=null;this.src=this.dataset.ph">
          ${v.group?`<span class="pgrp">${esc(v.group)}</span>`:""}
        </div>
        <div class="pnm">
          <b>${esc(v.name)}${v.verified?`<span class="pvf" title="যাচাইকৃত">${ICON.checkC(16)}</span>`:""}</b>
          ${v.donorId&&v.donorId!=="—"?`<small>${esc(v.donorId)}</small>`:""}
        </div>
        ${v.bio?`<p class="pbio">${esc(v.bio)}</p>`:""}
        <div class="pchips">
          <span class="pchip ${v.ready?"ok":v.avail?"rest":"m"}">${v.ready?"✓ রক্তদানে প্রস্তুত"
            :v.avail?`বিশ্রামে · আর ${bn(v.rest)} দিন`:"প্রাপ্যতা বন্ধ"}</span>
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
        <div class="pstat"><b>${v.total>0?bn(v.total):"—"}</b><span>জীবন বাঁচিয়েছেন</span></div>
        <div class="pstat"><b>${v.totalBags>0?bn(v.totalBags):"—"}</b><span>মোট ব্যাগ</span></div>
        <div class="pstat"><b class="sm">${v.last?dS(v.last):"—"}</b><span>শেষ রক্তদান</span></div>
      </div>
  
      <div class="sec-t">তথ্য</div>
      <div class="card pad0">
        ${pRow("ডোনার আইডি",(v.donorId&&v.donorId!=="—")?v.donorId:"দেওয়া হয়নি",!(v.donorId&&v.donorId!=="—"))}
        ${pRow("জন্মতারিখ",v.dob?dL(v.dob):"দেওয়া হয়নি",!v.dob)}
        ${pRow("বয়স",v.age!=null?bn(v.age)+" বছর":"দেওয়া হয়নি",v.age==null)}
        ${pRow("লিঙ্গ",v.gender||"দেওয়া হয়নি",!v.gender)}
        ${pRow("রক্তের গ্রুপ",v.group||(v.mine?"এখনো দেননি":"দেওয়া হয়নি"),!v.group)}
        ${pRow("এলাকা",v.area||(v.mine?"এখনো দেননি":"দেওয়া হয়নি"),!v.area)}
        ${pRow("মোবাইল নম্বর",v.phone||"দেওয়া হয়নি",!v.phone)}
        ${pRow("WhatsApp নম্বর",v.whatsapp||"দেওয়া হয়নি",!v.whatsapp)}
        ${pRow("সর্বশেষ রক্তদানের তারিখ",v.last?dL(v.last):"দেওয়া হয়নি",!v.last)}
        ${pRow("জীবন বাঁচিয়েছেন",v.total>0?bn(v.total):"দেওয়া হয়নি",!(v.total>0))}
        ${pRow("মোট ব্যাগ",v.totalBags>0?bn(v.totalBags):"দেওয়া হয়নি",!(v.totalBags>0))}
        ${pRow("রক্তদানে প্রস্তুত",v.ready?"রক্তদানে প্রস্তুত":(v.avail?`বিশ্রামে · আর ${bn(v.rest)} দিন`:"প্রাপ্যতা বন্ধ"),!v.ready)}
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
  
    el.querySelectorAll("[data-pa]").forEach(b=>b.onclick=async()=>{
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
        await save();rProfile(el);toast(i<0?"সংরক্ষণ করা হয়েছে":"সংরক্ষণ সরানো হয়েছে",i<0?"ok":"");
      }
    });
  }
  const pRow=(k,v,dim)=>`<div class="row"><span class="tx"><b>${esc(k)}</b></span>
    <span class="rt" style="font-size:.83rem;font-weight:700${dim?";color:var(--mut);font-weight:600":""}">${esc(v)}</span></div>`;
  
  
  let reqTab="for";
  const applicationsLoadingBox=()=>`<div class="card"><div class="empty" aria-live="polite">
    <div class="sk" style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%"></div>
    <b>আবেদন লোড হচ্ছে…</b><p>আপনার সর্বশেষ আবেদনগুলো আনা হচ্ছে</p></div></div>`;
  function rReq(){
    const inc=myReqs(),mine=DB().mine;
    const totalApplications=MY_APPLICATION_COUNT_READY?Math.max(0,Number(STORE.account.applicationCount)||0):"—";
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
      el.innerHTML=`<p class="mut" style="font-size:.78rem;margin:0 0 10px">মোট আবেদন: <b>${bn(totalApplications)}</b></p>
        <button class="btn red w" style="margin-bottom:13px" data-act="newreq">${ICON.plus(18)} নতুন জরুরি আবেদন</button>`
        +(myApplicationsAreLoading()?applicationsLoadingBox()
        :(mine.length?mine.map(mineCard).join("")
        :emptyBox(ICON.file(26),"কোনো আবেদন নেই","কারো রক্তের প্রয়োজন হলে এখান থেকে আবেদন করুন")));
    }else{
      el.innerHTML=becomeView();
      
      const h=$("#hprof");
      if(h)h.onclick=()=>openProfile("me");
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
  
  const RS={pending:["a","যাচাই চলছে"],approved:["b","অনুমোদিত"],matched:["b","রক্তদাতা খোঁজা হচ্ছে"],
    done:["g","সম্পন্ন"],resolved:["g","সম্পন্ন"],expired:["m","মেয়াদোত্তীর্ণ"],
    cancelled:["m","বাতিল"],rejected:["r","বাতিল"]};
  const mineCard=r=>{const[c,t]=RS[r.status]||["m",r.status||"যাচাই চলছে"];
    const responders=Array.isArray(r.responders)?r.responders:[];
    const responderCount=Math.max(responders.length,Number(r.responderCount)||0);
    const final=r.status==="done"||r.status==="resolved"||r.status==="expired"||r.status==="cancelled"||r.status==="rejected";
    return `<div class="reqc"><h4>${esc(r.id)} <span class="bg">${esc(r.group)}</span> <span class="pill ${c}">${t}</span></h4>
    <p>${esc(r.patient)} · ${bn(r.bags)} ব্যাগ</p>
    <p>${ICON.hospital(13)} ${esc(r.hospital)} · ${dS(r.neededBy)}</p>
    ${r.rejectNote?`<p class="mut" style="margin-top:6px">বাতিলের কারণ: ${esc(r.rejectNote)}</p>`:""}
    ${responderCount?`<p style="color:var(--grn);font-weight:700">${bn(responderCount)} জন সাড়া দিয়েছেন</p>`:""}
    <div class="a">${responders.length?`<button class="btn sm" data-resps="${esc(r.id)}">সাড়াদাতারা</button>`:""}
      ${!final?
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
    
    if(dStatus()==="rejected"){
      const rjNote=String(d.donorRejectNote||"").trim();
      return `<div class="card">
      <div class="note r">${ICON.x(17)}<span><b>আপনার রক্তদাতা আবেদনটি বাতিল করা হয়েছে</b><br>
        ${rjNote?`বাতিলের কারণ: ${esc(rjNote)}<br>`:""}চাইলে আবার আবেদন করতে পারেন।</span></div>
      ${donorRows()}
      <button class="btn w" style="margin-top:12px" data-act="become">আবার আবেদন করুন</button></div>`;
    }
    return `<div class="card">
      <div class="note g">${ICON.checkC(17)}<span><b>আপনি অনুমোদিত রক্তদাতা</b><br>${esc(d.donorId)}</span></div>
      ${donorRows()}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn gh" style="flex:1" id="hprof">${ICON.user(15)} আমার প্রোফাইল</button>
        <button class="btn" style="flex:1" data-sub="donor">${ICON.gear(15)} সম্পাদনা</button></div></div>`;
  }
  const donorRows=()=>{const d=STORE.donor;return `
    ${rowLine("নাম",dv("name"))}${rowLine("রক্তের গ্রুপ",d.bloodGroup)}${rowLine("লিঙ্গ",dv("gender"))}
    ${rowLine("জন্ম তারিখ",dv("dob")?dL(dv("dob")):"—")}
    ${rowLine("বয়স",dvAgeText()||"—")}
    ${rowLine("এলাকা",dv("area"))}${rowLine("মোবাইল",dv("phone"))}
    ${rowLine("WhatsApp",d.whatsapp||"—")}${rowLine("সর্বশেষ রক্তদান",d.lastDonation?dL(d.lastDonation):"মনে নেই")}`};
  const rowLine=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;
    border-bottom:1px dashed var(--line);font-size:.82rem"><span class="mut" style="font-weight:600">${esc(k)}</span>
    <b style="text-align:right">${esc(v)}</b></div>`;
  
  
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
  
  const SUBS=[
    {id:"profile",title:"প্রোফাইল",parent:"find"},
    {id:"devices",title:"লগইন ও ডিভাইস",parent:"security"},
    {id:"activity",title:"কার্যকলাপ",parent:"security"},
    {id:"card",title:"ডোনার কার্ড",parent:"donor"},
    {id:"adddonation",title:"রক্তদান যোগ করুন",parent:"donor"},
    {id:"donation",title:"রক্তদানের বিবরণ",parent:"donor"}
  ];
  const SETTINGS_MAP={};
  SETTINGS.forEach(s=>SETTINGS_MAP[s.id]=s);
  SUBS.forEach(s=>SETTINGS_MAP[s.id]=s);
  
  function rSet(){
    const a=STORE.account;
    $("#s-set").innerHTML=`
      <h2 class="ptitle">সেটিংস</h2>
      <button class="card" style="display:block;width:100%;text-align:left" data-sub="account">
        <div class="per lg"><img src="${AV(a.gender,a.photo)}" alt="" data-ph="${AV(a.gender,"")}"
          onerror="this.onerror=null;this.src=this.dataset.ph">
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
  
  
  function renderSub(id){
    const el=$("#s-sub"),a=STORE.account,d=STORE.donor;
    const P={};
  
    
    if(id==="profile"){rProfile(el);return}
  
    P.account=()=>`
      <div class="card" style="text-align:center">
        <img src="${AV(a.gender,a.photo)}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:11px"
          alt="" data-ph="${AV(a.gender,"")}" onerror="this.onerror=null;this.src=this.dataset.ph">
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
        ${sRow("পাসওয়ার্ড ভুলে গেছেন?","অ্যাকাউন্টের ইমেইলে রিসেট লিংক পাঠানো হবে","forgotPass")}
      </div>
      <div class="sec-t">লগইন সুরক্ষা</div>
      <div class="card pad0">
        <div class="row"><span class="ic">${ICON.bellS(19)}</span>
          <span class="tx"><b>নতুন লগইন সতর্কতা</b><small>অচেনা ডিভাইসে লগইন হলে জানানো হবে</small></span>
          <button class="tg ${STORE.security.loginAlert?"on":""}" data-tgl="security.loginAlert"></button></div>
        <button class="row" data-sub="devices"><span class="ic">${ICON.device(19)}</span>
          <span class="tx"><b>লগইন ও ডিভাইস</b><small>${tp(`${bn(RAW.sessions.length)}টি সক্রিয় সেশন`)}</small></span>
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
      acts.forEach(x=>{const k=bdDateLabel(x.at);
        (groups[k]=groups[k]||[]).push(x)});
      return Object.entries(groups).map(([k,list])=>`
        <div class="sec-t">${esc(k)}</div>
        <div class="card pad0">${list.map(x=>`<div class="row">
          <span class="ic" style="background:${x.type==="security"?"var(--blu-s)":x.type==="donor"?"var(--red-s)":"var(--card2)"};
            color:${x.type==="security"?"var(--blu)":x.type==="donor"?"var(--red)":"var(--mut)"}">
            ${x.type==="security"?ICON.shield(18):x.type==="donor"?ICON.drop(18):ICON.user(18)}</span>
          <span class="tx"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small>
            <small style="color:var(--mut);font-size:.7rem">${bdDateText(x.at,LOC(),{day:"numeric",month:"short",year:"numeric"})} · ${bdTimeStr(x.at)}</small></span></div>`).join("")}</div>`).join("");
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
      <div class="sec-t">ডোনার তথ্য (অ্যাকাউন্টের সাথে সংযুক্ত)</div>
      <div class="card pad0">
        ${DFIELDS.map(f=>`<button class="row" data-dfield="${f.k}">
          <span class="tx"><b>${esc(f.label)}</b>
            <small>${esc(f.k==="age"&&dv(f.k)?bn(dv(f.k))+" বছর":dv(f.k)||"দেওয়া হয়নি")}</small></span>
          <span class="rt">${ICON.right(17)}</span></button>`).join("")}
      </div>
  
      <div class="sec-t">রক্ত সম্পর্কিত তথ্য</div>
      <div class="card pad0">
        ${(()=>{const gc=typeof gcState==="function"?gcState():null;
          const sub=gc&&gc.status==="pending"
            ?`${d.bloodGroup} · পরিবর্তনের অনুরোধ অপেক্ষমাণ (${gc.from||d.bloodGroup} → ${gc.to||""})`
            :gc&&gc.status==="rejected"
            ?`${d.bloodGroup} · সর্বশেষ অনুরোধ বাতিল হয়েছে`
            :d.bloodGroup;
          return sRow("রক্তের গ্রুপ",sub,"editBloodGroup",dStatus()==="approved"?"lock":"");})()}
        ${sRow("WhatsApp",d.whatsapp||"দেওয়া হয়নি","editWa")}
        ${sRow("সর্বশেষ রক্তদান",d.lastDonation?dL(d.lastDonation):"মনে নেই","editLast")}
        ${sRow("স্বাস্থ্য তথ্য",d.health?d.health.slice(0,30)+"…":"দেওয়া হয়নি","editHealth")}
      </div>
      <button class="btn gh w" data-act="leaveDonor" style="color:var(--red-d)">ডোনার তালিকা থেকে সরে যান</button>`;
    };
  
    P.adddonation=()=>{
      if(!isDonor())return emptyBox(ICON.drop(26),"আগে রক্তদাতা হিসেবে যুক্ত হন",
        "রক্তদানের হিসাব রাখতে আপনার রক্তের গ্রুপ ও তথ্য দরকার","become","রক্তদাতা হিসেবে যুক্ত হন");
      const dn=RAW.donations||[], pend=dn.filter(x=>!isVerifiedDonation(x)&&!donRejected(x)).length, okc=dn.filter(x=>isVerifiedDonation(x)).length;
      const rest=restLeft();
      return `
        <div class="intro">
          <div class="ih"><span class="ic">${ICON.info(20)}</span>
            <div><b>শুরু করার আগে পড়ে নিন</b>
              <small>নিচের ফর্মে আপনার দেওয়া প্রতিটি রক্তদানের হিসাব যোগ করুন।</small></div></div>
          <ol class="steps">
            <li><b>কী যোগ করবেন</b><span>আপনি অতীতে বা সম্প্রতি যে রক্তদান করেছেন তার তারিখ ও স্থান। একবারে একটি রক্তদান।</span></li>
            <li><b>কেন দরকার</b><span>এর ভিত্তিতেই ৯০ দিনের বিশ্রামের হিসাব হয় — বিশ্রামে থাকলে আপনাকে জরুরি ডাক পাঠানো হবে না।</span></li>
            <li><b>প্রমাণ ছবি আবশ্যক</b><span>ব্লাড ব্যাগের রসিদ বা ছবি ছাড়া রক্তদান যোগ করা যাবে না। প্রমাণ থাকলে যাচাই দ্রুত হয়।</span></li>
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
            <input id="ad_place" list="ad_places">
            <datalist id="ad_places">${HOSPITALS.map(h=>`<option value="${esc(h)}">`).join("")}</datalist>
            <span class="hint">যে হাসপাতাল বা ব্লাড ব্যাংকে দিয়েছেন</span></div>
          <div class="f"><label>রোগীর নাম <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
            <input id="ad_pat">
            <span class="hint">রোগীর অনুমতি ছাড়া পুরো নাম না লেখাই ভালো</span></div>
          <div class="f"><label>মন্তব্য <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
            <input id="ad_note"></div>
          <div class="f"><label>প্রমাণ (ছবি) <i>*</i></label>
            <input id="ad_file" type="file" accept="image/*">
            <span class="hint">রসিদ / ব্যাগের ছবি · আবশ্যক — প্রমাণ ছাড়া যোগ করা যাবে না</span></div>
          <label class="chk"><input type="checkbox" id="ad_ok">
            <span>আমি নিশ্চিত করছি তথ্যগুলো সত্য এবং আমি নিজেই এই রক্তদান করেছি।</span></label>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn gh" style="flex:1" id="ad_clear">খালি করুন</button>
            <button class="btn" style="flex:2" id="ad_save">${ICON.plus(16)} যোগ করুন</button></div>
        </div>
  
        <div class="sec-t">নীতিমালা</div>
        <div class="card pad0">
          ${[["৯০ দিনের নিয়ম","শেষ রক্তদানের পর অন্তত ৯০ দিন বিরতি দিতে হবে — হোমের কাউন্টডাউন অনুযায়ী পরবর্তী তারিখ দেখানো হয়।"],
             ["একই দান দুইবার নয়","একই তারিখ ও একই স্থানের রেকর্ড দ্বিতীয়বার যোগ করা যাবে না।"],
             ["মিথ্যা তথ্য","ভুল তথ্য দিলে রেকর্ড বাতিল হবে এবং বারবার হলে ডোনার তালিকা থেকে সরিয়ে দেওয়া হতে পারে।"],
             ["তথ্য কারা দেখবে","তারিখ ও মোট সংখ্যা আপনার কার্ডে দেখা যায়। রোগীর নাম ও প্রমাণের ছবি শুধু যাচাইকারী স্বেচ্ছাসেবক দেখতে পান।"],
             ["ভুল হলে","ভুল রেকর্ড আগের রক্তদান তালিকা বা বিবরণ পেজ থেকে নিজেই মুছে ফেলা যাবে।"]]
            .map(([t,d],i)=>`<button class="row" data-faq="p${i}">
              <span class="tx"><b>${esc(t)}</b><small class="hide" id="fap${i}">${esc(d)}</small></span>
              <span class="rt">${ICON.right(17)}</span></button>`).join("")}
        </div>
  
        <div class="sec-t">আগের রক্তদান</div>
        ${dn.length?`<div class="card pad0">${dn.map((x,i)=>{
          const rej=donRejected(x);
          const ver=isVerifiedDonation(x);
          return `<div class="row" data-drec="${donationVerKey(x)}" role="button" style="cursor:pointer">
          <span class="ic" style="background:${ver?"var(--grn-s)":rej?"var(--red-s)":"var(--amb-s)"};color:${ver?"var(--grn)":rej?"var(--red)":"var(--amb)"}">${ver?ICON.checkC(18):rej?ICON.x(18):ICON.clock(18)}</span>
            <span class="tx"><b>${esc(dL(x.date))}</b><small>${esc(x.place)} · ${bn(x.bags||1)} ব্যাগ</small></span>
            <span class="rt">${ver?`<small class="mut">যাচাইকৃত</small>`
              :rej?`<small style="color:var(--red)">বাতিল</small>`
              :`<button class="lnk" data-delrec="${donationVerKey(x)}" style="color:var(--red-d)">মুছুন</button>`}</span></div>`;}).join("")}</div>`
          :`<div class="card"><p class="mut" style="font-size:.83rem;margin:0">এখনো কোনো রক্তদান যোগ করা হয়নি।</p></div>`}
        <div class="note i" style="margin-top:12px">${ICON.info(17)}<span>প্রশ্ন থাকলে ক্লাবের হটলাইনে কল করুন — <b>${SITE.phone}</b></span></div>`;
    };
  
    
    P.donation=()=>{
      if(!isDonor())return emptyBox(ICON.drop(26),"আগে রক্তদাতা হিসেবে যুক্ত হন","","become","রক্তদাতা হিসেবে যুক্ত হন");
      const x=(RAW.donations||[]).find(r=>donationVerKey(r)===DONATION_DETAIL_ID);
      
      if(!x)return emptyBox(ICON.file(26),"রেকর্ডটি পাওয়া যায়নি","রেকর্ডটি মুছে ফেলা হয়ে থাকতে পারে","","");
      const ver=isVerifiedDonation(x), rej=donRejected(x), rejNote=donNoteText(x);
      const st=ver?`<span class="pill g">${ICON.checkC(12)} যাচাইকৃত</span>`
        :rej?`<span class="pill r">${ICON.x(12)} বাতিল</span>`
        :`<span class="pill a">${ICON.clock(12)} যাচাইয়ের অপেক্ষায়</span>`;
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <b style="font-size:.92rem">${esc(dL(x.date))}</b>${st}</div>
        ${rej&&rejNote?`<div class="note r" style="margin-top:10px">${ICON.x(16)}
          <span><b>বাতিলের কারণ:</b> ${esc(rejNote)}</span></div>`:""}
        <div style="margin-top:10px">
          ${rowLine("স্থান / হাসপাতাল",x.place||"—")}
          ${rowLine("কত ব্যাগ",bn(x.bags||1)+" ব্যাগ")}
          ${rowLine("রোগীর নাম",x.pat||"—")}
          ${rowLine("মন্তব্য",x.note||"—")}
          ${rowLine("যাচাই",ver?"✓ যাচাইকৃত":rej?"বাতিল করা হয়েছে":"যাচাইয়ের অপেক্ষায়")}
        </div>
      </div>
      ${x.proof?`<div class="sec-t">প্রমাণ (ছবি)</div>
      <div class="card"><a href="${esc(x.proof)}" target="_blank" rel="noopener">
        <img src="${esc(x.proof)}" alt="রক্তদানের প্রমাণ ছবি"
          style="width:100%;max-height:320px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:var(--card2)"></a></div>`
        :`<div class="sec-t">প্রমাণ (ছবি)</div><div class="card"><p class="mut" style="font-size:.82rem;margin:0">প্রমাণ ছবি সংযুক্ত নেই।</p></div>`}
      <div style="display:flex;gap:8px;margin-top:14px">
        ${rej?`<button class="btn" style="flex:1" id="dn_resend">${ICON.check(15)} আবার পাঠান</button>`:""}
        <button class="btn gh red" style="flex:1" id="dn_del">${ICON.trash(15)} মুছুন</button></div>
      ${rej?`<div class="note i" style="margin-top:10px">${ICON.info(16)}
        <span>বাতিল হওয়া রেকর্ড আর যাচাইয়ের তালিকায় থাকে না। সঠিক তথ্য/প্রমাণ দিয়ে
        <b>আবার পাঠান</b> চাপলে রেকর্ডটি আবার যাচাইয়ের জন্য পাঠানো হবে।</span></div>`:""}`;
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
        <button data-lg="bn" class="${STORE.prefs.lang==="bn"?"on":""}">বাংলা</button>
        <button data-lg="en">English</button></div>
        <div class="note i hide" id="lg_note" style="margin-top:10px">${ICON.info(16)}
          <span><b>English — Coming Soon</b><br>ইংরেজি ভাষা এখনো চালু হয়নি। বর্তমানে শুধু বাংলা ব্যবহার করা যাচ্ছে।</span></div></div>
      <div class="sec-t">অন্যান্য</div>
      <div class="card pad0">
        ${tgRow("অ্যানিমেশন","চলমান প্রভাব চালু/বন্ধ","prefs.anim")}
        ${tgRow("বিজ্ঞপ্তির সংখ্যা দেখান","আইকনে লাল সংখ্যা","prefs.badge")}
      </div>`;
  
    P.help=()=>{
      const faq=[["রক্তদাতা হতে কী কী লাগে?","বয়স ১৮–৬০ বছর, ওজন কমপক্ষে ৫০ কেজি এবং সুস্থ শরীর।"],
        ["কতদিন পরপর রক্ত দেওয়া যায়?","সাধারণত ৯০ দিন (৩ মাস) পর পর। অ্যাপে কাউন্টডাউন দেখানো হয়।"],
        ["তথ্য যাচাই হতে কত সময় লাগে?","সাধারণত ২৪–৪৮ ঘণ্টা।"],
        ["রক্তের গ্রুপ ভুল দিয়েছি, বদলাব কীভাবে?","সেটিংস → ডোনার → রক্তের গ্রুপ → কারণ ও প্রমাণসহ পরিবর্তনের অনুরোধ পাঠান। অ্যাডমিন অনুমোদন দিলে নতুন গ্রুপ কার্যকর হবে।"],
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
    $$("[data-tgl]").forEach(b=>b.onclick=async()=>{
      const p=b.dataset.tgl.split("."),o=p.slice(0,-1).reduce((x,k)=>x[k],STORE),k=p[p.length-1];
      o[k]=!o[k];b.classList.toggle("on",o[k]);b.setAttribute("aria-checked",o[k]);
      await save();toast(o[k]?"চালু করা হয়েছে":"বন্ধ করা হয়েছে",o[k]?"ok":"");
      if(p[0]==="prefs")applyPrefs();
      if(p[0]==="donor"||p[0]==="privacy")RENDER[CUR]&&paintTop();
    });
    $$("[data-pv]").forEach(s=>s.onchange=async()=>{STORE.privacy[s.dataset.pv]=s.value;await save();toast("সংরক্ষিত","ok")});
    $$("[data-faq]").forEach(b=>b.onclick=()=>{const t=$("#fa"+b.dataset.faq);t.classList.toggle("hide")});
    if(id==="prefs"){
      $$("#pth button").forEach(b=>b.onclick=async()=>{STORE.prefs.theme=b.dataset.th;await save();applyPrefs();renderSub("prefs")});
      $$("#pdn button").forEach(b=>b.onclick=async()=>{STORE.prefs.dense=b.dataset.dn==="1";await save();applyPrefs();renderSub("prefs")});
      
      $$("#plg button").forEach(b=>b.onclick=async()=>{
        if(b.dataset.lg!=="en"){
          const n=$("#lg_note");if(n)n.classList.add("hide");
          if(STORE.prefs.lang===b.dataset.lg)return;
          toast("ভাষা বাংলা করা হয়েছে","ok");return;
        }
        b.classList.remove("on");
        $$("#plg button").forEach(x=>{if(x.dataset.lg==="bn")x.classList.add("on")});
        const n=$("#lg_note");if(n)n.classList.remove("hide");
        toast("English — Coming Soon · ইংরেজি এখনো চালু হয়নি");
      });
    }
    if(id==="adddonation")bindAddDonation();
    if(id==="donation"){
      const del=$("#dn_del");
      if(del)del.onclick=async()=>{
        const x=(RAW.donations||[]).find(r=>donationVerKey(r)===DONATION_DETAIL_ID);
        if(!x)return;
        if(await deleteDonationRecord(x))go("set","adddonation");
      };
      const rs=$("#dn_resend");
      if(rs)rs.onclick=async()=>{
        const x=(RAW.donations||[]).find(r=>donationVerKey(r)===DONATION_DETAIL_ID);
        if(!x)return;
        if(!x.proof){toast("প্রমাণ ছবি ছাড়া আবার পাঠানো যাবে না","er");return}
        if(!await confirmS({title:"আবার পাঠাবেন?",desc:"রেকর্ডটি আবার যাচাইয়ের জন্য পাঠানো হবে।",ok:"পাঠান"}))return;
        
        delete x.status;delete x.rejectNote;delete x.rejectedAt; 
        delete (RAW.donationNotes as any)[donationVerKey(x)];
        try{
          const _uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
          if(_uid)await updatePaths({[`users/${_uid}/data/donationNotes/${donationVerKey(x)}`]:null});
        }catch(e){ console.warn("resend note clear:",e&&e.message); }
        try{ await saveData(); }
        catch(saveErr){
          console.warn("resend save:",saveErr&&saveErr.message);
          toast(isPermissionDenied(saveErr)?"সংরক্ষণ করার অনুমতি নেই — অ্যাকাউন্ট রিফ্রেশ করে আবার চেষ্টা করুন":(saveErr&&saveErr.message?saveErr.message:"সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন"),"er");
          return;
        }
        await logAct("রক্তদান পুনরায় পাঠানো",(x.date||"")+" · "+(x.place||""),"donor");
        renderSub("donation");
        toast("আবার পাঠানো হয়েছে — যাচাইয়ের অপেক্ষায়","ok");
      };
    }
    if(id==="card"){
      $$("#cth button").forEach(b=>b.onclick=async()=>{STORE.donor.cardTheme=b.dataset.ct;await save();renderSub("card")});
      $$("#csd button").forEach(b=>b.onclick=async()=>{STORE.donor.cardSide=b.dataset.cs;await save();renderSub("card")});
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
      const i=RAW.sessions.findIndex(s=>s.id===b.dataset.kick);if(i>-1)RAW.sessions.splice(i,1);await saveData();
      await logAct("ডিভাইস সরানো হয়েছে","নিরাপত্তা","security");renderSub("devices");toast("ডিভাইস বের করা হয়েছে","ok");
    });
  }
  const CLUB={name:SITE.name,en:SITE.nameEn,
    phone:SITE.phone,site:SITE.website,addr:SITE.address};
  function cardStat(){
    const S=cardSubject(),d=S.d;
    const rest=d.lastDonation?Math.max(0,90-dayDiff(d.lastDonation)):0;
    return rest>0?{t:tp("বিশ্রামে · "+bn(rest)+" দিন"),c:"rest"}
      :d.available?{t:"রক্তদানে প্রস্তুত",c:""}:{t:"আপাতত বন্ধ",c:"off"};}
  
  
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
            ${dvAgeText()||dv("gender")?`<div><span>বয়স</span><b>${esc(dvAgeText())}${dvAgeText()&&dv("gender")?" · ":""}${dv("gender")?esc(dv("gender")):""}</b></div>`:""}
          </div>
        </div>
        <div class="qrbox"><span class="q">${qrSVG(vcardText(),72,{ecl:"L",quiet:2})}</span>
          <small>স্ক্যান করুন</small></div>
      </div>
      <div class="ft"><span class="id">${esc(d.donorId)}</span>
        <span class="st"><i class="dot ${st.c}"></i>${esc(st.t)}</span></div>
    </div>`;
  }
  
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
  
  
  
  function cardPngData(){
    const S=cardSubject(),a=S.a,d=S.d;
    return {
      name:dv("name")||"", gender:dv("gender")||"", area:dv("area")||"", phone:dv("phone")||"",
      ageText:dvAgeText()||"", photo:a.photo||"",
      bloodGroup:d.bloodGroup||"", donorId:d.donorId||"",
      cardTheme:d.cardTheme||"green",
      available:d.available!==false, lastDonation:d.lastDonation||"",
      stat:cardStat(),           
      club:CLUB, logo:LOGO
    };
  }
  async function dlCard(kind){
    const done=await downloadDonorCardImages(kind,cardPngData(),{toast});
    if(done&&cardSubject().mine)await logAct("ডোনার কার্ড ডাউনলোড","কার্ড","card");
  }
  
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
      donorCardSheetBodyHTML(ICON.info(16)),
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">${ICON.down(15)} নামান</button>`);
    let kind="both";
    s.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{
      s.querySelectorAll(".opt").forEach(z=>z.classList.remove("on"));o.classList.add("on");kind=o.dataset.k});
    s.q("#ok").onclick=()=>{const k=kind;s.close();dlCard(k).then(()=>{CARD_FOR=null})};
    return s;
  }
  
  
  function sheet(title,body,footer,opts={}){
    const ov=document.createElement("div");ov.className="ov";
    const sh=document.createElement("div");sh.className="sheet";
    sh.innerHTML=`<div class="grab"></div>
      <div class="hd"><h3>${esc(title)}</h3>${opts.lock?"":
        `<button class="x" data-close aria-label="বন্ধ">${ICON.x(19)}</button>`}</div>
      <div class="bd">${body}</div>${footer?`<div class="ft">${footer}</div>`:""}`;
    document.body.append(ov,sh);
    document.body.style.overflow="hidden";
    
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
      
      const _ov=s.previousElementSibling;
      if(_ov&&_ov.classList.contains("ov"))_ov.addEventListener("click",()=>res(false));
    });
  }
  async function logAct(title,detail,type="account"){
    
    RAW.activity.unshift({at:new Date().toISOString(),title,detail,type});
    if(RAW.activity.length>200)RAW.activity.length=200;
    await await saveData();
  }

  
  const BD_OFFSET = 6*60*60*1000;
  const bdDate = v => { const t = new Date(v || 0).getTime(); return new Date((Number.isFinite(t) ? t : Date.now()) + BD_OFFSET); };
  const bdNow = () => bdDate(new Date());
  function bdDateText(v, locale="bn-BD", opts={}){
    
    return bdDate(v).toLocaleDateString(locale,{timeZone:"UTC",...opts});
  }
  function bdTimeText(v, locale="bn-BD", opts={}){
    return bdDate(v).toLocaleTimeString(locale,{timeZone:"UTC",hour:"2-digit",minute:"2-digit",...opts});
  }
  function bdDayKey(v){ 
    const d=bdDate(v), n=bdNow();
    
    const z=x=>Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),x.getUTCDate());
    return Math.round((z(n)-z(d))/864e5);
  }
  function bdDateLabel(v){
    const k=bdDayKey(v);
    if(k===0)return "আজ";
    if(k===1)return "গতকাল";
    return bdDateText(v,"bn-BD",{day:"numeric",month:"short",year:"numeric"});
  }
  function bdTimeStr(v){
    return bdTimeText(v,"bn-BD",{hour:"2-digit",minute:"2-digit"});
  }

  
  function genId(prefix){
    return prefix+"-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
  }

  
  function rBecome(){
    const a=STORE.account,d=STORE.donor;
    
    if(isDonor()&&dStatus()==="pending"){
      $("#s-become").innerHTML=`
        <h2 class="ptitle">রক্তদাতা হিসেবে যুক্ত হন<small>আপনার আবেদন অ্যাডমিনের যাচাইয়ের অপেক্ষায় আছে</small></h2>
        <div class="card">
          <div class="note w">${ICON.clock(17)}<span><b>আপনার তথ্য যাচাই করা হচ্ছে</b><br>
            জমা দিয়েছেন ${dL(d.appliedAt)} · সাধারণত ২৪–৪৮ ঘণ্টা লাগে।</span></div>
          ${donorRows()}
          <button class="btn gh w" style="margin-top:12px" data-act="withdraw">আবেদন প্রত্যাহার</button></div>`;
      return;
    }
    if(isDonor()&&dStatus()==="approved"){
      $("#s-become").innerHTML=`
        <h2 class="ptitle">রক্তদাতা হিসেবে যুক্ত হন<small>আপনি ইতিমধ্যে অনুমোদিত রক্তদাতা</small></h2>
        <div class="card">
          <div class="note g">${ICON.checkC(17)}<span><b>আপনি অনুমোদিত রক্তদাতা</b><br>${esc(d.donorId)}</span></div>
          ${donorRows()}
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn gh" style="flex:1" id="hprof">${ICON.user(15)} আমার প্রোফাইল</button>
            <button class="btn" style="flex:1" data-sub="donor">${ICON.gear(15)} সম্পাদনা</button></div></div>`;
      $("#hprof").onclick=()=>openProfile("me");
      return;
    }
    const dobBounds_=dobBounds(SITE.rules.minAge,SITE.rules.maxAge);
    
    const lockedBloodGroup=accountBloodGroup();
    $("#s-become").innerHTML=`
      <h2 class="ptitle">রক্তদাতা হিসেবে যুক্ত হন<small>নিচের তথ্য পূরণ করে আবেদন জমা দিন — অনুমোদনের পর পাবলিক রক্তদাতা তালিকায় যুক্ত হবেন।</small></h2>
      <div class="card">
        <div class="note i">${ICON.info(17)}<span>আপনার অ্যাকাউন্টের তথ্য (নাম, লিঙ্গ, এলাকা, মোবাইল) স্বয়ংক্রিয়ভাবে বসে গেছে — প্রয়োজন হলে পরিবর্তন করে জমা দিন।</span></div>
        <form id="becomeForm" novalidate>
        <div class="f"><label>নাম <i>*</i></label>
          <input id="bc_name" name="bc_name" value="${esc(a.name||"")}" maxlength="60"></div>
        <div class="f"><label>লিঙ্গ <i>*</i></label>
          <select id="bc_gender" name="bc_gender">
            <option value="">লিঙ্গ নির্বাচন করুন</option>
            ${["পুরুষ","মহিলা","অন্যান্য"].map(g=>`<option ${a.gender===g?"selected":""}>${esc(g)}</option>`).join("")}
          </select></div>
        <div class="f"><label>জন্ম তারিখ <i>*</i></label>
          <input id="bc_dob" name="bc_dob" type="date" min="${dobBounds_.min}" max="${dobBounds_.max}" value="${esc(a.dob||"")}">
          <span class="hint">বয়স ${SITE.rules.minAge}–${SITE.rules.maxAge} বছর হতে হবে।</span></div>
        <div class="f"><label>জেলা <i>*</i></label>
          <select id="bc_district" name="bc_district">
            ${DISTRICTS.map(ds=>`<option value="${esc(ds)}" ${(String(a.district||"").trim()||districtOfArea(a.area))===ds?"selected":""}>${esc(ds)}</option>`).join("")}
          </select></div>
        <div class="f"><label>থানা / এলাকা <i>*</i></label>
          <select id="bc_area" name="bc_area">
            <option value="">থানা / এলাকা নির্বাচন করুন</option>
            ${areasForDistrict(String(a.district||"").trim()||districtOfArea(a.area)).map(g=>`<option ${a.area===g?"selected":""}>${esc(g)}</option>`).join("")}
          </select></div>
        <div class="f"><label>মোবাইল নম্বর <i>*</i></label>
          <input id="bc_phone" name="bc_phone" value="${esc(a.phone||"")}" inputmode="numeric" maxlength="11"></div>
        <div class="f"><label>রক্তের গ্রুপ <i>*</i></label>
          <select id="bc_group" name="bc_group" ${lockedBloodGroup?"disabled aria-disabled=\"true\" data-locked=\"1\"":""}>
            <option value="">রক্তের গ্রুপ নির্বাচন করুন</option>
            ${GROUPS.map(g=>`<option ${(lockedBloodGroup||d.bloodGroup)===g?"selected":""}>${esc(g)}</option>`).join("")}
          </select>
        </div>
        <div class="f"><label>সর্বশেষ রক্তদান <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <input id="bc_last" name="bc_last" type="date" max="${iso(now())}" value="${esc(d.lastDonation||"")}">
          <span class="hint">মনে না থাকলে খালি রাখুন।</span></div>
        <div class="f"><label>স্বাস্থ্য তথ্য <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <textarea id="bc_health" name="bc_health" placeholder="সম্পূর্ণ সুস্থ, কোনো দীর্ঘমেয়াদি রোগ নেই।">${esc(d.health||"")}</textarea></div>
        <div class="f"><label>WhatsApp নম্বর <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
          <input id="bc_wa" name="bc_wa" inputmode="numeric" maxlength="11" value="${esc(d.whatsapp||"")}"></div>
        <label class="chk"><input type="checkbox" id="bc_ok" name="bc_ok">
          <span>আমি নিশ্চিত করছি প্রদত্ত তথ্য সঠিক এবং স্বেচ্ছায় রক্তদানে সম্মত।</span></label>
        <button class="btn w" type="submit" id="bc_save" style="margin-top:14px">${ICON.check(16)} রক্তদাতা হিসেবে আবেদন জমা দিন</button>
        </form>
      </div>`;
    attachLiveClear($("#becomeForm"));
    
    const bcDist=$("#bc_district");
    if(bcDist)bcDist.addEventListener("change",()=>fillAreaSelect($("#bc_area"),bcDist.value,""));
    $("#becomeForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const form=$("#becomeForm");
      const v=validateForm(form,{
        bc_name:{required:true,minLength:2,label:"নাম"},
        bc_gender:{required:true,label:"লিঙ্গ"},
        bc_dob:{required:true,dob:{min:SITE.rules.minAge,max:SITE.rules.maxAge},label:"জন্ম তারিখ"},
        bc_area:{required:true,label:"এলাকা"},
        bc_phone:{required:true, custom:val=>phoneOK(val)?"":"১১ সংখ্যার সঠিক মোবাইল নম্বর দিন", label:"মোবাইল নম্বর"},
        bc_group:{required:true,label:"রক্তের গ্রুপ"},
        bc_last:{custom:v=>!v?"":(dayDiff(v)>=0?"":"ভবিষ্যতের তারিখ দেওয়া যাবে না")},
        bc_wa:{custom:v=>!v?"":(phoneOK(v)?"":"সঠিক ১১ সংখ্যার নম্বর দিন")},
        bc_ok:{checked:true}
      });
      if(!v.ok)return;
      const btn=$("#bc_save");btn.disabled=true;btn.textContent="সংরক্ষণ হচ্ছে…";
      const a=STORE.account,d=STORE.donor;
      
      const uid=String(firebaseCurrentUid()||a.uid||"").trim();
      let serverBloodGroup="";
      
      if(!window.__CBDC_TEST__){
        try{
          const row=uid?await getRow(NODES.users,uid):null;
          serverBloodGroup=bloodGroupFromAccountRow(row);
        }catch(e){ console.warn("become blood group check:",e&&e.message); }
      }
      
      const cachedAccountBloodGroup=String(a.bloodGroup||"").trim();
      const finalBloodGroup=validBloodGroup(serverBloodGroup)
        ? serverBloodGroup
        : (validBloodGroup(cachedAccountBloodGroup)
          ? cachedAccountBloodGroup
          : (lockedBloodGroup||$("#bc_group").value));
      
      if(validBloodGroup(finalBloodGroup))a.bloodGroup=finalBloodGroup;
      
      a.name=$("#bc_name").value.trim();
      a.gender=$("#bc_gender").value;
      a.dob=$("#bc_dob").value;
      a.district=$("#bc_district")?$("#bc_district").value:"";
      a.area=$("#bc_area").value;
      a.phone=$("#bc_phone").value.trim();
      d.is=true; d.status="pending";
      d.donorRejectNote="";
      d.bloodGroup=finalBloodGroup;
      d.lastDonation=$("#bc_last").value||"";
      d.health=$("#bc_health").value.trim()||"";
      d.whatsapp=$("#bc_wa").value.trim()||"";
      d.appliedAt=iso(now());
      d.available=true;
      
      d.donorId="";
      
      const authenticatedUid=String(firebaseCurrentUid()||"").trim();
      
      if(!authenticatedUid||window.__CBDC_TEST__){
        await save();await logAct("রক্তদাতা হিসেবে যুক্ত হন",d.bloodGroup+" · যাচাইয়ের অপেক্ষায়","donor");
        reqTab="become";go("req");toast("আপনার তথ্য যাচাইয়ের জন্য পাঠানো হয়েছে","ok");
        return;
      }
      try{
        if(!uid)throw new Error("লগইন সেশন পাওয়া যায়নি");
        
        if(APPROVAL_SETTINGS.donorApproval===false){
          
          const serverApply=await requestDirectApply("donor",{}).catch(()=>null);
          if(serverApply&&serverApply.ok){
            d.status="approved";d.is=true;d.donorId=serverApply.donorId||"";
            await save();
            await logAct("রক্তদাতা হিসেবে যুক্ত হন",d.bloodGroup+" · অনুমোদিত","donor");
            reqTab="become";go("req");
            toast("আপনি সরাসরি অনুমোদিত রক্তদাতা হয়েছেন","ok");
            return;
          }
          
          if(!(serverApply&&serverApply.approvalRequired)&&await isStaffUser(uid)){
          const district=a.district||districtOfArea(a.area);
          
          let existingOwn=null;
          try{ existingOwn=await findBy(NODES.donors,"ownerUid",uid); }catch(_e){ existingOwn=null; }
          const donorId=(existingOwn&&existingOwn.id)?String(existingOwn.id):await nextDonorId();
          const at=nowIso();
          await updatePaths({
            [`users/${uid}/name`]:a.name,[`users/${uid}/gender`]:a.gender,[`users/${uid}/dob`]:a.dob,
            [`users/${uid}/area`]:a.area,[`users/${uid}/district`]:district,[`users/${uid}/phone`]:a.phone,
            [`users/${uid}/bloodGroup`]:d.bloodGroup,[`users/${uid}/lastDonation`]:d.lastDonation,
            [`users/${uid}/health`]:d.health,[`users/${uid}/whatsapp`]:d.whatsapp,
            [`users/${uid}/donorStatus`]:"approved",[`users/${uid}/donorId`]:donorId,
            [`users/${uid}/available`]:true,[`users/${uid}/appliedAt`]:at,
            [`users/${uid}/donorRejectNote`]:null,
            [`donors/${donorId}`]:{id:donorId,donorId,uid,ownerUid:uid,name:a.name,gender:a.gender,
              dob:a.dob,area:a.area,district,phone:a.phone,whatsapp:d.whatsapp,bloodGroup:d.bloodGroup,
              lastDonationDate:d.lastDonation,
              donations:(existingOwn&&Number(existingOwn.donations))||0,
              totalDonations:(existingOwn&&Number(existingOwn.totalDonations))||0,
              status:"approved",
              available:true,verified:true,suspended:false,joined:(existingOwn&&existingOwn.joined)||at,
              createdAt:(existingOwn&&existingOwn.createdAt)||at,updatedAt:at}
          });
          d.status="approved";d.is=true;d.donorId=donorId;
          await save();
          await logAct("রক্তদাতা হিসেবে যুক্ত হন",d.bloodGroup+" · অনুমোদিত","donor");
          reqTab="become";go("req");
          toast("আপনি সরাসরি অনুমোদিত রক্তদাতা হয়েছেন","ok");
          return;
          }
          
          if(!(serverApply&&serverApply.approvalRequired)){
            throw Object.assign(new Error("অনুমোদন সেটিং অনুযায়ী আবেদনটি সরাসরি অনুমোদিত হওয়ার কথা, কিন্তু সার্ভার সেটি প্রক্রিয়া করতে পারেনি"
              +((serverApply&&serverApply.error)?" — "+serverApply.error:"")
              +"। আবেদনটি approval queue-তে পাঠানো হয়নি — একটু পরে আবার চেষ্টা করুন বা অ্যাডমিনকে জানান।"),{settingsOff:true});
          }
        }
        const qid="PD-"+uid.replace(/[^A-Za-z0-9]/g,"").slice(-40);
        const at=nowIso();
        const paths={};
        paths[`users/${uid}/name`]=a.name;
        paths[`users/${uid}/gender`]=a.gender;
        paths[`users/${uid}/dob`]=a.dob;
        paths[`users/${uid}/district`]=a.district||districtOfArea(a.area);
        paths[`users/${uid}/area`]=a.area;
        paths[`users/${uid}/phone`]=a.phone;
        paths[`users/${uid}/bloodGroup`]=d.bloodGroup;
        paths[`users/${uid}/donorStatus`]="pending";
        paths[`users/${uid}/donorId`]=null;
        
        paths[`users/${uid}/donorRejectNote`]=null;
        paths[`users/${uid}/lastDonation`]=d.lastDonation;
        paths[`users/${uid}/whatsapp`]=d.whatsapp;
        paths[`users/${uid}/health`]=d.health;
        paths[`users/${uid}/available`]=true;
        paths[`users/${uid}/appliedAt`]=d.appliedAt;
        paths[`queue/${qid}`]={kind:"donor",id:qid,name:a.name,group:d.bloodGroup,area:a.area,
          dob:a.dob||"",health:d.health||"",last:d.lastDonation||"",gender:a.gender,
          phone:a.phone,whatsapp:d.whatsapp||"",photo:a.photo||"",ownerUid:uid,at,atTs:serverTime()};
        await updatePaths(paths);
      }catch(err){
        d.is=false;d.status="none";d.bloodGroup=accountBloodGroup();d.donorId="";
        btn.disabled=false;btn.textContent="রক্তদাতা হিসেবে আবেদন জমা দিন";
        return toast(isPermissionDenied(err)?"আবেদন জমা দেওয়ার অনুমতি নেই — অ্যাকাউন্ট রিফ্রেশ করে আবার চেষ্টা করুন":(err&&err.message?err.message:"আবেদন জমা দেওয়া যায়নি — আবার চেষ্টা করুন।"),"er");
        console.warn("donor application submit:",err&&err.message);
        return;
      }
      await save();
      await logAct("রক্তদাতা হিসেবে যুক্ত হন",d.bloodGroup+" · যাচাইয়ের অপেক্ষায়","donor");
      reqTab="become";
      go("req");
      toast("আপনার তথ্য যাচাইয়ের জন্য পাঠানো হয়েছে","ok");
    });
  }

  
  function sheetNewReq(){
    const s=sheet("জরুরি রক্তের আবেদন",`
      <div class="note i">${ICON.info(17)}<span>জমা দিলে অ্যাডমিন যাচাই করবেন; অনুমোদনের পর তা রক্তদাতাদের কাছে প্রকাশিত হবে।</span></div>
      <form id="newreqForm" novalidate>
      <div class="f"><label>রোগীর নাম <i>*</i></label>
        <input id="nr_patient" name="nr_patient">
        <span class="hint">রোগীর অনুমতি ছাড়া পুরো নাম না লেখাই ভালো</span></div>
      <div class="f"><label>রক্তের গ্রুপ <i>*</i></label>
        <select id="nr_group" name="nr_group">
          <option value="">গ্রুপ নির্বাচন করুন</option>
          ${GROUPS.map(g=>`<option>${esc(g)}</option>`).join("")}
        </select></div>
      <div class="f2">
        <div class="f"><label>কত ব্যাগ <i>*</i></label>
          <input id="nr_bags" name="nr_bags" type="number" min="1" max="99" inputmode="numeric"></div>
        <div class="f"><label>জরুরিতা <i>*</i></label>
          <select id="nr_urgency" name="nr_urgency">
            <option value="">নির্বাচন করুন</option>
            <option>অতিজরুরি (২ ঘণ্টা)</option>
            <option>জরুরি (আজকের মধ্যে)</option>
            <option>আগামীকালের মধ্যে</option>
          </select></div>
      </div>
      <div class="f"><label>হাসপাতালের নাম <i>*</i></label>
        <input id="nr_hospital" name="nr_hospital"></div>
      <div class="f"><label>হাসপাতালের ঠিকানা <i>*</i></label>
        <input id="nr_address" name="nr_address"></div>
      <div class="f"><label>বিবরণ <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
        <textarea id="nr_desc" name="nr_desc"></textarea></div>
      <label class="chk"><input type="checkbox" id="nr_ok" name="nr_ok">
        <span>আমি নিশ্চিত করছি উপরের তথ্য সঠিক এবং রক্তের প্রয়োজনটি বাস্তব।</span></label>
      </form>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="nr_save">${ICON.plus(16)} আবেদন জমা দিন</button>`,{lock:true});
    attachLiveClear(s.q("#newreqForm"));
    s.q("#nr_save").onclick=async()=>{
      const form=s.q("#newreqForm");
      const v=validateForm(form,{
        nr_patient:{required:true,label:"রোগীর নাম"},
        nr_group:{required:true,label:"রক্তের গ্রুপ"},
        nr_bags:{required:true,custom:v=>{const n=Number(v);return n>=1&&n<=99?"":"১–৯৯ ব্যাগ দিন"},label:"কত ব্যাগ"},
        nr_urgency:{required:true,label:"জরুরিতা"},
        nr_hospital:{required:true,label:"হাসপাতালের নাম"},
        nr_address:{required:true,label:"হাসপাতালের ঠিকানা"},
        nr_ok:{checked:true}
      });
      if(!v.ok)return;
      const btn=s.q("#nr_save");btn.disabled=true;btn.textContent="জমা হচ্ছে…";
      const m={
        id:genId("REQ"),
        patient:s.q("#nr_patient").value.trim(),
        group:s.q("#nr_group").value,
        bags:Number(s.q("#nr_bags").value),
        urgency:s.q("#nr_urgency").value,
        hospital:s.q("#nr_hospital").value.trim(),
        address:s.q("#nr_address").value.trim(),
        description:s.q("#nr_desc").value.trim()||"",
        neededBy:addD(iso(now()),1),
        createdAt:new Date().toISOString(),
        status:"pending",
        responders:[]
      };
      const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
      const approvalRequired=APPROVAL_SETTINGS.emergencyApproval!==false;
      const at=nowIso(),status=approvalRequired?"pending":"approved";
      const expiresAt=new Date(Date.now()+24*3600*1000).toISOString();
      const workflowStatus=approvalRequired?"pending":"searching";
      m.createdAt=at;m.status=status;m.workflowStatus=workflowStatus;m.ownerUid=uid;
      try{
        if(!uid)throw new Error("লগইন সেশন পাওয়া যায়নি");
        const mine=[m,...RAW.mine];
        const paths={
          [`users/${uid}/data/mine`]:mine,
          [`requests/${m.id}`]:{id:m.id,patientName:m.patient,bloodGroup:m.group,bags:m.bags,
            urgency:m.urgency,status,workflowStatus,hospitalName:m.hospital,hospitalAddress:m.address,
            requesterName:STORE.account.name||"",phone:STORE.account.phone||"",description:m.description||"",
            createdAt:at,expiresAt,ownerUid:uid},
        };
        if(approvalRequired)paths[`queue/${m.id}`]={kind:"request",requestId:m.id,patient:m.patient,group:m.group,
          bags:m.bags,urgency:m.urgency,hospital:m.hospital,area:m.address,requester:STORE.account.name||"",
          phone:STORE.account.phone||"",at,expiresAt,ownerUid:uid};
        await updatePaths(paths);
        await incrementField(NODES.users,uid,"applicationCount",1);
        RAW.mine.unshift(m);await saveData();
      }catch(err){
        btn.disabled=false;btn.textContent="আবেদন জমা দিন";
        console.warn("doner emergency write:",err&&err.message);
        return toast(isPermissionDenied(err)?"আবেদন জমা দেওয়ার অনুমতি নেই — অ্যাকাউন্ট রিফ্রেশ করে আবার চেষ্টা করুন":(err&&err.message?err.message:"আবেদন জমা দেওয়া যায়নি — আবার চেষ্টা করুন।"),"er");
      }
      await logAct("জরুরি রক্তের আবেদন",m.group+" · "+m.bags+" ব্যাগ","donor");
      
      s.close();
      reqTab="mine";
      go("req");
      toast(approvalRequired?"আবেদন জমা হয়েছে — যাচাইয়ের অপেক্ষায়":"আবেদন লাইভ হয়েছে","ok");
    };
  }

  
  function bindAddDonation(){
    const aClear=$("#ad_clear"), aSave=$("#ad_save");
    if(aClear)aClear.onclick=()=>{
      ["#ad_date","#ad_place","#ad_pat","#ad_note"].forEach(sel=>{const el=$(sel);if(el)el.value=""});
      const d=$("#ad_date");if(d)d.value=iso(now());
      const f=$("#ad_file");if(f)f.value="";
      const ok=$("#ad_ok");if(ok)ok.checked=false;
      toast("ফর্ম খালি করা হয়েছে");
    };
    if(aSave)aSave.onclick=async()=>{
      
      if(aSave.disabled)return;
      const date=$("#ad_date").value, place=$("#ad_place").value.trim();
      const er=m=>toast(m,"er");
      if(!date)return er("রক্তদানের তারিখ দিন");
      if(!place)return er("স্থান / হাসপাতাল লিখুন");
      const ok=$("#ad_ok");if(!ok||!ok.checked)return er("সম্মতিতে টিক দিন");
      if(RAW.donations.some(x=>x.date===date&&x.place===place))return er("একই তারিখ ও স্থানের রেকর্ড আগেই আছে");
      let proof="";
      const fin=$("#ad_file");
      const f=fin&&fin.files&&fin.files[0];
      
      if(!f)return er("প্রমাণ ছবি দিন — প্রমাণ ছাড়া রক্তদান যোগ করা যাবে না");
      const orig=aSave.innerHTML;
      aSave.disabled=true;aSave.textContent="সংরক্ষণ হচ্ছে…";
      try{
        aSave.textContent="প্রমাণ আপলোড হচ্ছে…";
        try{ const up=await imgbbUploadImage(f); proof=up.url; }
        catch(e){ return er(e&&e.message?e.message:"ছবি আপলোড করা যায়নি"); }
        const bags=Number($("#ad_bags").value)||1;
        const pat=$("#ad_pat").value.trim()||"",note=$("#ad_note").value.trim()||"";
        
        let verified=false;
        if(APPROVAL_SETTINGS.donationApproval===false){
          const sa=await requestDirectApply("donation",{date,place,bags,proof,patient:pat,note}).catch(()=>null);
          if(sa&&sa.ok)verified=true;
          
          else if(!(sa&&sa.approvalRequired)){
            return er("অনুমোদন সেটিং অনুযায়ী রক্তদানটি সরাসরি যাচাইকৃত হওয়ার কথা, কিন্তু সার্ভার সেটি প্রক্রিয়া করতে পারেনি"
              +((sa&&sa.error)?" — "+sa.error:"")
              +"। রেকর্ডটি যাচাই queue-তে পাঠানো হয়নি — একটু পরে আবার চেষ্টা করুন বা অ্যাডমিনকে জানান।");
          }
        }
        RAW.donations.unshift({date,place,bags,pat,note,proof,ok:verified});
        if(verified){
          const vk=donationVerKey({date,place});
          RAW.verifiedDonations[vk]={date,place,bags,livesSaved:1,at:new Date().toISOString(),proof};
        }
        try{ await saveData(); }
        catch(saveErr){
          console.warn("donation save:",saveErr&&saveErr.message);
          toast(isPermissionDenied(saveErr)?"সংরক্ষণ করার অনুমতি নেই — অ্যাকাউন্ট রিফ্রেশ করে আবার চেষ্টা করুন":(saveErr&&saveErr.message?saveErr.message:"সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন"),"er");
          return;
        }
        await logAct("রক্তদান যোগ",date+" · "+place,"donor");
        renderSub("adddonation");
        toast(verified?"রক্তদান যাচাইকৃত হয়েছে — সরাসরি রেকর্ডে যুক্ত হয়েছে":"যোগ হয়েছে — যাচাইয়ের অপেক্ষায়",verified?"ok":"");
        
        sheet("রক্তদান যোগ হয়েছে",`
          <div style="text-align:center;padding:10px 0 4px">
            <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:var(--grn-s);
              color:var(--grn);display:grid;place-items:center">${ICON.checkC(26)}</div>
            <b style="display:block;margin-bottom:5px">রক্তদানটি সফলভাবে যোগ হয়েছে</b>
            <p class="mut" style="font-size:.82rem;margin:0 0 10px">${esc(dL(date))} · ${esc(place)}</p>
            <div class="note i" style="text-align:left">${ICON.info(16)}
              <span>${verified?`রক্তদানটি সরাসরি <b>✓ যাচাইকৃত</b> হয়েছে এবং আপনার রেকর্ডে যুক্ত হয়েছে।`
                :`ক্লাবের স্বেচ্ছাসেবক যাচাই করার পর <b>✓ যাচাইকৃত</b> লেখা উঠবে।`}
              নিচের <b>আগের রক্তদান</b> তালিকায় রেকর্ডটিতে ক্লিক করে বিস্তারিত দেখতে পারবেন।</span></div></div>`,
          `<button class="btn" data-close style="flex:1">বুঝেছি</button>`);
      }finally{
        aSave.disabled=false;aSave.innerHTML=orig;
      }
    };
    
    $$("[data-drec]").forEach(row=>row.onclick=e=>{
      if(e.target.closest("[data-delrec]"))return;   
      const id=row.dataset.drec;
      if(!id)return;
      DONATION_DETAIL_ID=id;
      go("set","donation");
    });
    $$("[data-delrec]").forEach(b=>b.onclick=async()=>{
      
      const rec=RAW.donations.find(x=>x&&donationVerKey(x)===b.dataset.delrec);
      if(!rec)return;
      if(await deleteDonationRecord(rec))renderSub("adddonation");
    });
  }

  
  async function deleteDonationRecord(rec){
    if(!rec)return false;
    if(!await confirmS({title:"রেকর্ডটি মুছবেন?",desc:"রক্তদানের রেকর্ড মুছে যাবে।",ok:"মুছুন",danger:true}))return false;
    const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
    const vkey=donationVerKey(rec);
    const wasVerified=isVerifiedDonation(rec);
    RAW.donations=RAW.donations.filter(y=>y!==rec);
    if(RAW.verifiedDonations&&typeof RAW.verifiedDonations==="object"&&RAW.verifiedDonations[vkey]){
      delete RAW.verifiedDonations[vkey];
    }
    try{ await saveData(); }
    catch(e){
      console.warn("donation delete save:",e&&e.message);
          toast(isPermissionDenied(e)?"সংরক্ষণ করার অনুমতি নেই — অ্যাকাউন্ট রিফ্রেশ করে আবার চেষ্টা করুন":(e&&e.message?e.message:"সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন"),"er");
      return false;
    }
    
    if(uid){
      const ownerKey=uid.replace(/[^A-Za-z0-9]/g,"").slice(-8)||"unknown";
      const dateDigits=String(rec.date||"").replace(/[^0-9]/g,"");
      const dnId="DN-"+ownerKey+"-"+dateDigits+"-"+vkey.replace(/^v/,"");
      const paths:any={ [`queue/${dnId}`]:null, [`users/${uid}/data/donationNotes/${vkey}`]:null };
      if(wasVerified){
        
        paths[`donations/${dnId}`]=null;
        try{
          const d=(await listOnce(NODES.donors)).find(x=>String(x&&x.ownerUid||"")===uid
            ||(STORE.donor.donorId&&String(x&&x.id||"")===String(STORE.donor.donorId)));
          if(d&&d.id){
            const bags=Math.max(1,Math.floor(Number(rec.bags)||1));
            paths[`donors/${d.id}/donations`]=Math.max(0,(Number(d.donations)||0)-1);
            paths[`donors/${d.id}/totalDonations`]=Math.max(0,(Number(d.totalDonations)||Number(d.donations)||0)-1);
            paths[`donors/${d.id}/totalBags`]=Math.max(0,(Number(d.totalBags)||0)-bags);
          }
        }catch(e){ console.warn("donor stats read:",e&&e.message); }
      }
      try{ await updatePaths(paths); }
      catch(e){ console.warn("donation rtdb cleanup:",e&&e.message);
        toast("কিছু সার্ভার রেকর্ড মুছতে সমস্যা হয়েছে — অ্যাডমিনের সাথে যোগাযোগ করুন","er"); }
    }
    try{ await logAct("রক্তদানের রেকর্ড মুছে ফেলা হয়েছে",(rec.date||"")+" · "+(rec.place||""),"donor"); }catch(e){}
    toast("মুছে ফেলা হয়েছে");
    return true;
  }

  
  function sheetExport(){
    const data={account:{...STORE.account},donor:{...STORE.donor},
      donations:RAW.donations,verifiedDonations:RAW.verifiedDonations,
      mine:RAW.mine,notifs:loadNotifs(),activity:RAW.activity};
    const s=sheet("আমার সব তথ্য নামান",`
      <div class="note i">${ICON.info(17)}<span>আপনার অ্যাকাউন্ট, ডোনার তথ্য, রক্তদান, আবেদন ও কার্যক্রম JSON/CSV ফাইলে নামাতে পারবেন।</span></div>
      <button class="opt on" data-k="json" style="width:100%;text-align:left"><i class="dot"></i>
        <span><b>JSON</b><small>সব তথ্য এক ফাইলে</small></span></button>
      <button class="opt" data-k="csv" style="width:100%;text-align:left"><i class="dot"></i>
        <span><b>CSV</b><small>কার্যক্রম ও আবেদন তালিকা</small></span></button>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">${ICON.down(15)} নামান</button>`);
    let kind="json";
    s.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{
      s.querySelectorAll(".opt").forEach(z=>z.classList.remove("on"));o.classList.add("on");kind=o.dataset.k});
    s.q("#ok").onclick=()=>{
      if(kind==="json"){
        dl(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),"cbdc-export.json");
      }else{
        const rows=[["ধরন","শিরোনাম","বিস্তারিত","সময়"],
          ...RAW.activity.map(x=>[x.type,x.title,x.detail,x.at]),
          ...RAW.mine.map(m=>["আবেদন",m.id,m.patient+" · "+m.group+" · "+m.bags+" ব্যাগ",m.createdAt||""])];
        const csv=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
        dl(new Blob(["\ufeff"+csv],{type:"text/csv"}),"cbdc-export.csv");
      }
      s.close();toast("তথ্য নামানো হচ্ছে","ok");
    };
  }

  
  let npOpen=false,npPanel=null,npOv=null;
  function notifMeta(n){
    const t=String(n.type||n.t||"info");
    if(t==="emergency")return {ic:ICON.warn(18),bg:"var(--red-s)",fg:"var(--red)"};
    if(t==="rejected")return {ic:ICON.x(18),bg:"var(--red-s)",fg:"var(--red)"};
    if(t==="approval")return {ic:ICON.checkC(18),bg:"var(--grn-s)",fg:"var(--grn)"};
    return {ic:ICON.bell(18),bg:"var(--blu-s)",fg:"var(--blu)"};
  }
  
  function effectiveNotifs(){
    const reads=STORE.noticeReads&&typeof STORE.noticeReads==="object"?STORE.noticeReads:{};
    return loadNotifs().map(n=>{
      const key=n.noticeId||n.ref||n.id;
      return {...n,read:!!n.read||!!reads[noticeReadKey(key)]};
    });
  }
  async function markNotifRead(id){
    const list=loadNotifs();
    const n=list.find(x=>x.id===id);
    storeMarkRead(id);
    if(n&&(n.noticeId||n.ref)){
      try{
        const key=n.noticeId||n.ref;
        await markNoticeRead(String(STORE.account.uid||RTDB_UID||""),key);
        STORE.noticeReads={...(STORE.noticeReads||{}),[noticeReadKey(key)]:true};
      }catch(e){console.warn("notice read:",e&&e.message)}
    }
    if(!n)return;
    const [g,s]=String(n.go||"req:for").split(":");
    
    if(g==="req"){reqTab=(s==="become"||s==="mine")?s:"for";go("req");}
    else if(g)go(g,s||null);
  }
  function renderNotifPanel(){
    if(!npPanel)return;
    const ns=effectiveNotifs();
    npPanel.querySelector("#nh").innerHTML=
      `<b style="flex:1;font-size:.95rem">বিজ্ঞপ্তি</b>
       ${ns.some(n=>!n.read)?`<button class="btn lnk" id="nall" style="font-size:.75rem">সব পড়া হয়েছে</button>`:""}
       <button class="x" id="nx" aria-label="বন্ধ">${ICON.x(19)}</button>`;
    npPanel.querySelector("#nlist").innerHTML=ns.length?ns.map(n=>{
      const m=notifMeta(n);
      return `<button class="nitem ${n.read?"":"un"}" data-n="${n.id}">
        <span class="ic" style="background:${m.bg};color:${m.fg}">${m.ic}</span>
        <span style="flex:1;min-width:0"><b>${esc(n.title)}</b><small>${esc(n.body)} · ${esc(n.time||timeAgo(n.createdAt))}</small></span></button>`;
    }).join("")
      :`<div class="empty"><div class="ic">${ICON.bell(26)}</div><b>কোনো বিজ্ঞপ্তি নেই</b>
        <p>নতুন কিছু এলে এখানে দেখা যাবে</p></div>`;
    npPanel.querySelector("#nx").onclick=closeNotifs;
    npPanel.querySelector("#nall")&&(npPanel.querySelector("#nall").onclick=async()=>{
      const ids=ns.filter(n=>n.noticeId||n.ref).map(n=>n.noticeId||n.ref).filter(Boolean);
      try{
        await markAllNoticesRead(String(STORE.account.uid||RTDB_UID||""),ids);
        STORE.noticeReads={...(STORE.noticeReads||{}),...Object.fromEntries(ids.map(id=>[noticeReadKey(id),true]))};
        markAllNotifsRead();closeNotifs();toast("সব পড়া হিসেবে চিহ্নিত","ok");
      }catch(e){toast("নোটিশ পড়া হিসেবে চিহ্নিত করা যায়নি","er");}
    });
    npPanel.querySelectorAll("[data-n]").forEach(b=>b.onclick=async()=>{await markNotifRead(b.dataset.n);closeNotifs()});
    paintTop();
  }
  function openNotifs(){
    if(npOpen)return;npOpen=true;
    const ov=document.createElement("div");ov.className="ov";
    const p=document.createElement("div");p.className="npanel";
    p.innerHTML=`<div class="hd" id="nh" style="display:flex;align-items:center;gap:10px;padding:13px 15px;
        border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);z-index:2"></div>
      <div id="nlist"></div>`;
    document.body.append(ov,p);document.body.style.overflow="hidden";
    npOv=ov;npPanel=p;
    ov.onclick=closeNotifs;
    renderNotifPanel();
  }
  function closeNotifs(){
    if(npOv)npOv.remove();
    if(npPanel)npPanel.remove();
    npOpen=false;npPanel=null;npOv=null;
    document.body.style.overflow="";paintTop();
  }
  
  document.addEventListener("click",async e=>{
    const sub=e.target.closest("[data-sub]");
    if(sub&&!e.target.closest("[data-act]")){go(CUR==="set"||SUB?"set":CUR,sub.dataset.sub);return}
    const b=e.target.closest("[data-act],[data-resp],[data-mute],[data-done],[data-cancel],[data-resps],[data-fav]");
    if(!b)return;const D_=b.dataset;
  
    if(D_.fav!==undefined){const n=D_.fav,i=STORE.saved.indexOf(n);
      i>-1?STORE.saved.splice(i,1):STORE.saved.push(n);await save();
      if(b.classList.contains("dc-ico"))b.classList.toggle("fav",i<0);
      else b.style.color=i>-1?"var(--mut)":"var(--red)";
      toast(i>-1?"সংরক্ষণ থেকে সরানো হয়েছে":"সংরক্ষণ করা হয়েছে","ok");return}
  
    if(D_.resp){b.disabled=true;b.innerHTML=ICON.checkC(14)+" সাড়া দিয়েছেন";
      await logAct("জরুরি আবেদনে সাড়া",D_.resp,"donor");toast("সাড়া জানানো হয়েছে","ok");return}
    if(D_.mute){if(!await confirmS({title:"এই আবেদন লুকাবেন?",desc:"আপনার তালিকা থেকে সরে যাবে।",ok:"লুকান"}))return;
      const i=RAW.incoming.findIndex(x=>x.id===D_.mute);if(i>-1)RAW.incoming.splice(i,1);await saveData();rReq();
      await logAct("আবেদন লুকানো হয়েছে",D_.mute,"donor");toast("লুকানো হয়েছে");return}
    if(D_.done){if(!await confirmS({title:"সম্পন্ন হিসেবে চিহ্নিত করবেন?",desc:"রক্ত পাওয়া গেছে নিশ্চিত করছেন।",ok:"সম্পন্ন"}))return;
      RAW.mine.find(x=>x.id===D_.done).status="done";await saveData();rReq();
      await logAct("আবেদন সম্পন্ন",D_.done,"donor");toast("আবেদন সম্পন্ন হয়েছে","ok");return}
    if(D_.cancel){if(!await confirmS({title:"আবেদন বাতিল করবেন?",desc:"রক্তদাতারা আর দেখতে পাবেন না।",ok:"বাতিল করুন",danger:true}))return;
      RAW.mine.find(x=>x.id===D_.cancel).status="cancelled";await saveData();rReq();
      await logAct("আবেদন বাতিল",D_.cancel,"donor");toast("আবেদন বাতিল হয়েছে");return}
    if(D_.resps){const r=RAW.mine.find(x=>x.id===D_.resps);
      sheet("সাড়াদাতারা",r.responders.map(p=>`<div class="card" style="padding:11px;margin-bottom:8px">
        <div class="per"><img src="${AV("পুরুষ")}" alt=""><div class="i"><b>${esc(p.name)}</b>
        <small>${esc(p.phone)}</small></div><span class="bg">${esc(p.group)}</span></div>
        <div style="display:flex;gap:7px;margin-top:9px">
          <a class="btn sm" style="flex:1" href="tel:${esc(p.phone)}">${ICON.phone(14)} কল</a>
          <a class="btn gh sm" style="flex:1" href="https://wa.me/88${esc(p.phone)}" target="_blank" rel="noopener">${ICON.chat(14)}</a>
        </div></div>`).join(""),`<button class="btn gh" data-close>বন্ধ</button>`);return}
  
    switch(D_.act){
      case "become":go("become");break;
      case "newreq":sheetNewReq();break;
      case "adddon":go("set","adddonation");break;
      case "card":go("set","card");break;
      case "snooze":toast("৪ ঘণ্টার জন্য বন্ধ রাখা হলো");break;
  
      case "photo":pickPhoto();break;
      case "photoRm":STORE.account.photo="";STORE.account.photoSource="none";await save();
        await logAct("প্রোফাইল ছবি সরানো হয়েছে","");renderSub("account");toast("ছবি সরানো হয়েছে");break;
  
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
      case "editBloodGroup":sheetGroupChange();break;
      case "editWa":editField({key:"whatsapp",title:"WhatsApp",label:"WhatsApp নম্বর",store:"donor",max:11,
        validate:v=>!v||phoneOK(v)||"সঠিক ১১ সংখ্যার নম্বর দিন"});break;
      case "editLast":{
        
        if(dStatus()==="approved"){
          sheet("সর্বশেষ রক্তদান",`<div class="note i">${ICON.info(17)}<span>অনুমোদিত ডোনারের সর্বশেষ রক্তদানের তারিখ পরিবর্তন হয় শুধু অ্যাডমিন/মডারেটরের রক্তদান-যাচাই অনুমোদনের মাধ্যমে। নিজে থেকে বদলানো যাবে না — নইলে ৯০ দিনের বিশ্রাম/প্রস্তুতি ভুল দেখাতে পারে।</span></div>
            <div class="f"><label>সর্বশেষ রক্তদান</label><input value="${esc(d.lastDonation?dL(d.lastDonation):"মনে নেই")}" disabled></div>`,
            `<button class="btn" data-close style="flex:1">বুঝেছি</button>`);
          break;
        }
        editField({key:"lastDonation",title:"সর্বশেষ রক্তদান",label:"তারিখ",type:"date",store:"donor",
          max2:iso(now()),hint:"মনে না থাকলে খালি রাখুন।"});break;
      }
      case "editHealth":editField({key:"health",title:"স্বাস্থ্য তথ্য",label:"শারীরিক অবস্থা / রোগ",textarea:true,store:"donor"});break;
      case "leaveDonor":if(await confirmS({title:"ডোনার তালিকা থেকে সরে যাবেন?",
        desc:"অ্যাকাউন্ট থাকবে, শুধু ডোনার তথ্য ও কার্ড সরে যাবে। চাইলে আবার যুক্ত হতে পারবেন।",ok:"সরে যান",danger:true})){
        const leftId=STORE.donor.donorId||"";
        const uid=String(STORE.account.uid||RTDB_UID||"").trim();
        
        const donorBefore={...STORE.donor};
        STORE.donor.is=false;STORE.donor.status="none";STORE.donor.donorId="";
        
        STORE.donor.whatsapp="";STORE.donor.lastDonation="";
        STORE.donor.health="";STORE.donor.appliedAt="";STORE.donor.available=true;
        const leftGc=STORE.donor.groupChange;STORE.donor.groupChange=null;
        
        try{
            const paths={};
            const accountEmail=String(STORE.account.email||"").trim().toLowerCase();
            const accountPhone=String(STORE.account.phone||"").replace(/\\s+/g,"");
            const sameOwner=x=>String(x&&(x.ownerUid||x.uid||x.userId)||"").trim()===uid
              || (!!accountEmail&&String(x&&x.email||"").trim().toLowerCase()===accountEmail)
              || (!!accountPhone&&String(x&&x.phone||"").replace(/\\s+/g,"")===accountPhone);
            const donors=await listOnce(NODES.donors);
            donors.filter(x=>sameOwner(x)||String(x&&x.id||"")===String(leftId)).forEach(x=>{
              if(x.id){ paths[NODES.donors+"/"+x.id]=null; try{ releaseDonorSerial(x.id); }catch(_e){} }
            });
            const profile=uid?await getRow(NODES.users,uid):null;
            const memberId=String(profile&&profile.donorMemberId||"").trim();
            if(memberId){paths[NODES.members+"/"+memberId]=null;paths[NODES.queue+"/"+memberId]=null;}
            if(uid) {
              paths[NODES.users+"/"+uid+"/donorStatus"]=null;
              paths[NODES.users+"/"+uid+"/donorId"]=null;
              
              paths[NODES.users+"/"+uid+"/lastDonation"]=null;
              paths[NODES.users+"/"+uid+"/whatsapp"]=null;
              paths[NODES.users+"/"+uid+"/health"]=null;
              paths[NODES.users+"/"+uid+"/available"]=null;
              paths[NODES.users+"/"+uid+"/appliedAt"]=null;
              paths[NODES.users+"/"+uid+"/cardTheme"]=null;
              paths[NODES.users+"/"+uid+"/groupChange"]=null;
            }
            
            if(leftGc&&leftGc.id&&leftGc.status==="pending")paths[NODES.queue+"/"+leftGc.id]=null;
            if(Object.keys(paths).length)await updatePaths(paths);
        }catch(e){
          Object.assign(STORE.donor,donorBefore);await save();
          console.warn("leave donor remove:",e&&e.message);
          toast("ডোনার তথ্য সরানো যায়নি — কোনো সফলতা দেখানো হয়নি","er");
          break;
        }
        await save();
        await logAct("ডোনার তালিকা থেকে সরে গেছেন","");go("set","donor");toast("সরে গেছেন","ok")}break;
      
      case "withdraw":{
        const ws=sheet("আবেদন প্রত্যাহার করবেন?",`
          <p class="mut" style="font-size:.83rem">আবেদনটি প্রত্যাহার হবে; পরে আবার আবেদন করতে পারবেন। আগের অনুমোদিত স্ট্যাটাস ও রক্তদানের ইতিহাস অক্ষত থাকে।</p>
          <div class="f" style="margin-top:10px"><label>প্রত্যাহারের কারণ <span style="color:var(--mut);font-weight:600">(ঐচ্ছিক)</span></label>
            <textarea id="wd_reason" rows="2" placeholder="কারণ না লিখেও প্রত্যাহার করা যাবে"></textarea></div>`,
          `<button class="btn gh" data-close>ফিরে যান</button>
           <button class="btn red" id="wd_ok">প্রত্যাহার করুন</button>`);
        ws.q("#wd_ok").onclick=async()=>{
          
          const reason=String(ws.q("#wd_reason").value||"").trim();
          const oldDonor={...STORE.donor},uid=String(firebaseCurrentUid()||RTDB_UID||"").trim();
          const oldWithdrawUid=DONOR_WITHDRAW_UID;
          ws.close();
          
          STORE.donor.is=false;STORE.donor.status="none";STORE.donor.donorId="";
          STORE.donor.whatsapp="";STORE.donor.lastDonation="";
          STORE.donor.health="";STORE.donor.appliedAt="";STORE.donor.available=true;
          STORE.donor.donorRejectNote="";
          DONOR_WITHDRAW_UID=uid;
          try{
            if(!uid)throw new Error("Firebase Auth session পাওয়া যায়নি");
            const profile=await getRow(NODES.users,uid),paths={
              [`users/${uid}/donorStatus`]:null,[`users/${uid}/donorId`]:null,
              [`users/${uid}/lastDonation`]:null,[`users/${uid}/health`]:null,
              [`users/${uid}/whatsapp`]:null,[`users/${uid}/available`]:null,
              [`users/${uid}/appliedAt`]:null,[`users/${uid}/donorRejectNote`]:null,
              [`queue/PD-${uid.replace(/[^A-Za-z0-9]/g,"").slice(-40)}`]:null
            };
            const memberId=String(profile&&profile.donorMemberId||"");
            if(memberId){paths[`members/${memberId}`]=null;paths[`queue/${memberId}`]=null;}
            await updatePaths(paths);
            
            try{
              const accountEmail=String(STORE.account.email||"").trim().toLowerCase();
              const accountPhone=String(STORE.account.phone||"").replace(/\s+/g,"");
              const ownRecord=x=>String(x&&(x.ownerUid||x.uid||x.userId)||"").trim()===uid
                ||(!!accountEmail&&String(x&&x.email||"").trim().toLowerCase()===accountEmail)
                ||(!!accountPhone&&String(x&&x.phone||"").replace(/\s+/g,"")===accountPhone);
              const [queues,members]=await Promise.all([listOnce(NODES.queue),listOnce(NODES.members)]);
              const extra={};
              queues.filter(q=>q&&q.kind==="donor"&&ownRecord(q)).forEach(q=>{if(q.id)extra[`queue/${q.id}`]=null});
              members.filter(m=>ownRecord(m)).forEach(m=>{if(m.id)extra[`members/${m.id}`]=null});
              if(Object.keys(extra).length)await updatePaths(extra);
            }catch(e2){ console.warn("withdraw sweep:",e2&&e2.message); }
            await save();
            
            try{ await logAct("আবেদন প্রত্যাহার",reason?("কারণ: "+reason):"কারণ দেওয়া হয়নি","donor"); }catch(e3){ console.warn("withdraw log:",e3&&e3.message); }
            if(CUR==="become"){reqTab="become";go("req");}else{rReq();}
            toast("আবেদন প্রত্যাহার করা হয়েছে","ok");
          }catch(e){Object.assign(STORE.donor,oldDonor);await save();toast("আবেদন প্রত্যাহার করা যায়নি","er");}
          finally{ DONOR_WITHDRAW_UID=oldWithdrawUid; }
        };
      }break;
  
      case "forgotPass":sheetForgot();break;
      case "pol_terms":case "pol_privacy":case "pol_donate":sheetPolicy(D_.act);break;
      case "exportData":sheetExport();break;
      case "logout":if(await confirmS({title:"লগআউট করবেন?",
        desc:"আপনি অ্যাকাউন্ট থেকে বেরিয়ে যাবেন এবং মূল ওয়েবসাইটে ফিরে যাবেন। আবার ঢুকতে লগইন করতে হবে।",
        ok:"লগআউট",danger:true}))await doLogout();break;
      case "logoutAll":if(await confirmS({title:"সব ডিভাইস থেকে লগআউট?",
        desc:"এই ডিভাইসসহ সব জায়গা থেকে বেরিয়ে যাবেন।",ok:"সব থেকে লগআউট",danger:true}))await doLogout();break;
      case "delAcc":sheetDelete();break;
      case "report":sheetReport();break;
      case "soon":toast("শীঘ্রই আসছে");break;
    }
  });
  
  
  function editField({key,title,label,type="text",options,textarea,store="account",validate,hint,min,max,max2}){
    const src=store==="donor"?STORE.donor:STORE.account;
    const cur=src[key]||"";
    const input=options
      ? `<select id="ev">${options.map(o=>`<option ${o===cur?"selected":""}>${esc(o)}</option>`).join("")}</select>`
      : textarea ? `<textarea id="ev">${esc(cur)}</textarea>`
      : `<input id="ev" type="${type}" value="${esc(cur)}" ${min?`min="${min}"`:""} ${max?`maxlength="${max}"`:""} ${max2?`max="${max2}"`:""}>`;
    const s=sheet(title,`<div class="f"><label>${esc(label)}</label>${input}
      ${hint?`<span class="hint">${esc(hint)}</span>`:""}<span class="hint er hide" id="ee"></span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">সংরক্ষণ</button>`);
    s.q("#ok").onclick=async()=>{
      const v=s.q("#ev").value.trim();
      if(validate){const r=validate(v);if(r!==true){s.q("#ee").textContent=r;s.q("#ee").classList.remove("hide");return}}
      const old=src[key],btn=s.q("#ok");btn.disabled=true;src[key]=v;
      try{
        const uid=String(firebaseCurrentUid()||RTDB_UID||"").trim();
        if(!uid||uid!==RTDB_UID)throw new Error("Firebase Auth session পাওয়া যায়নি");
        if(store==="donor")await pushDonorRecordToRtdb();
        else await pushAccountToRtdb();
        await save();await logAct(title+" পরিবর্তন",v.slice(0,30),store==="donor"?"donor":"account");
        s.close();renderSub(SUB);toast("সংরক্ষণ হয়েছে","ok");
      }catch(e){
        src[key]=old;btn.disabled=false;
        toast(e&&e.message?e.message:"RTDB-তে সংরক্ষণ করা যায়নি","er");
      }
    };
  }
  
  

  
  function gcWhen(v){
    if(v===undefined||v===null||v==="")return "";
    const t=typeof v==="number"?v:Date.parse(String(v));
    if(!Number.isFinite(t)||t<=0)return "";
    return bdDateLabel(t)+" · "+bdTimeStr(t);
  }
  
  function gcState(){
    const d=STORE.donor;
    const gc=d.groupChange&&typeof d.groupChange==="object"?{...d.groupChange}:null;
    if(!gc||!gc.status)return null;
    if(gc.status==="pending"&&gc.to&&d.bloodGroup===gc.to){
      gc.status="approved";
      if(!gc.decidedAt)gc.decidedAt=nowIso();
      STORE.donor.groupChange={...gc};
      const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
      if(uid)updatePaths({
        ["users/"+uid+"/groupChange/status"]:"approved",
        ["users/"+uid+"/groupChange/decidedAt"]:gc.decidedAt
      }).catch(e=>console.warn("gc heal:",e&&e.message));
    }
    
    if(gc.status==="approved"&&gc.to&&d.bloodGroup!==gc.to){
      d.bloodGroup=gc.to;
    }
    return gc;
  }
  
  function refreshGroupChangeSheet(){
    const sh=document.querySelector(".sheet[data-gc='pending']");
    if(!sh)return;
    const gc=gcState();
    if(gc&&gc.status==="pending")return;   
    try{sh.close();}catch(e){}
    try{
      if(gc&&gc.status==="approved"){
        if(!PUBLIC_MODE)go(CUR,SUB,false);
        toast("রক্তের গ্রুপ আপডেট হয়েছে","ok");
        return;
      }
      if(CUR==="set")renderSub(SUB);
    }catch(e){}
    sheetGroupChange();
  }
  function sheetGroupChange(forceForm){
    const d=STORE.donor;
    
    if(d.status!=="approved"){
      editField({key:"bloodGroup",title:"রক্তের গ্রুপ",label:"রক্তের গ্রুপ",options:GROUPS,store:"donor",
        validate:v=>GROUPS.includes(v)||"রক্তের গ্রুপ নির্বাচন করুন"});
      return;
    }
    const gc=gcState();
    
    if(gc&&gc.status==="pending"){
      const s=sheet("রক্তের গ্রুপ পরিবর্তনের অনুরোধ",`
        <div class="note w" style="margin-bottom:12px">${ICON.clock(17)}<span><b>অনুরোধ অপেক্ষমাণ</b> —
          অ্যাডমিন যাচাই করে অনুমোদন দিলে তবেই নতুন গ্রুপ কার্যকর হবে। তার আগ পর্যন্ত
          পুরোনো গ্রুপ (${esc(gc.from||d.bloodGroup)}) সব জায়গায় থাকবে। একই সময়ে একাধিক অনুরোধ পাঠানো যায় না।</span></div>
        <div class="card pad0" style="margin:0 0 10px">
          <div class="row"><span class="tx"><b>পরিবর্তন</b><small>${esc(gc.from||d.bloodGroup)} → ${esc(gc.to||"")}</small></span>
            <span class="rt"><span class="pill a">অপেক্ষমাণ</span></span></div>
          <div class="row"><span class="tx"><b>কারণ</b><small>${esc(gc.reason||"")}</small></span></div>
          ${(()=>{const t=gcWhen(gc.atTs||gc.at);return t?`<div class="row"><span class="tx"><b>পাঠানো হয়েছে</b><small>${esc(t)}</small></span></div>`:""})()}
        </div>
        ${gc.proof?`<div class="sec-t">প্রমাণ</div>
          <a href="${esc(gc.proof)}" target="_blank" rel="noopener"><img src="${esc(gc.proof)}" alt="রক্তের গ্রুপের প্রমাণ"
            style="width:100%;max-height:220px;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:var(--card2)"></a>`:""}`,
        `<button class="btn gh" data-close>বন্ধ</button>
         <button class="btn gh" id="gc_cancel" style="color:var(--red-d)">অনুরোধ প্রত্যাহার</button>`);
      s.dataset.gc="pending";
      s.q("#gc_cancel").onclick=async()=>{
        if(!await confirmS({title:"অনুরোধ প্রত্যাহার করবেন?",desc:"পরে আবার নতুন অনুরোধ পাঠাতে পারবেন।",ok:"প্রত্যাহার",danger:true}))return;
        const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
        try{
          if(gc.id){try{await removeRow(NODES.queue,gc.id);}catch(e){console.warn("gc queue remove:",e&&e.message);}}
          if(uid)await updateRow(NODES.users,uid,{groupChange:null});
          STORE.donor.groupChange=null;await save();
          await logAct("রক্তের গ্রুপ পরিবর্তনের অনুরোধ প্রত্যাহার",`${gc.from||""} → ${gc.to||""}`,"donor");
          s.close();renderSub(SUB);toast("অনুরোধ প্রত্যাহার করা হয়েছে");
        }catch(e){toast(e&&e.message?e.message:"প্রত্যাহার করা যায়নি","er");}
      };
      return;
    }
    
    
    const s=sheet("রক্তের গ্রুপ পরিবর্তনের অনুরোধ",`
      ${gc&&gc.status==="rejected"?`<div class="note r" style="margin-bottom:12px">${ICON.x(17)}<span>
        <b>আগের অনুরোধটি বাতিল হয়েছে</b>${gc.note?` — কারণ: ${esc(gc.note)}`:""}${(()=>{const t=gcWhen(gc.decidedAtTs||gc.decidedAt);return t?` (${esc(t)})`:""})()}। চাইলে সঠিক প্রমাণসহ আবার পাঠাতে পারেন।</span></div>`:""}
      <p class="mut" style="font-size:.83rem;margin:0 0 12px">নিরাপত্তার জন্য রক্তের গ্রুপ সরাসরি পরিবর্তন করা যায় না।
        কারণ ও প্রমাণসহ অনুরোধ পাঠান — অ্যাডমিন যাচাই করে অনুমোদন দিলে নতুন গ্রুপ
        ডোনার প্যানেল ও মূল ওয়েবসাইটে সাথে সাথে আপডেট হয়ে যাবে।</p>
      <div class="f"><label>বর্তমান গ্রুপ</label><input value="${esc(d.bloodGroup)}" disabled></div>
      <div class="f"><label>নতুন রক্তের গ্রুপ <i>*</i></label><select id="gc_to">
        <option value="">নির্বাচন করুন</option>
        ${GROUPS.filter(g=>g!==d.bloodGroup).map(g=>`<option>${esc(g)}</option>`).join("")}</select></div>
      <div class="f"><label>কারণ <i>*</i></label><textarea id="gc_reason" rows="3"
        placeholder="যেমন: সাম্প্রতিক ল্যাব টেস্টে ভিন্ন গ্রুপ এসেছে"></textarea></div>
      <div class="f"><label>প্রমাণ — রক্ত পরীক্ষার রিপোর্টের ছবি <i>*</i></label>
        <input id="gc_file" type="file" accept="image/*">
        <span class="hint">ব্লাড গ্রুপিং রিপোর্ট বা কার্ডের স্পষ্ট ছবি দিন।</span>
        <span class="hint er hide" id="gc_err"></span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="gc_send">অনুরোধ পাঠান</button>`);
    s.dataset.gc="form";
    s.q("#gc_send").onclick=async()=>{
      const er=m=>{const e=s.q("#gc_err");e.textContent=m;e.classList.remove("hide")};
      s.q("#gc_err").classList.add("hide");
      const to=s.q("#gc_to").value, reason=s.q("#gc_reason").value.trim();
      if(!GROUPS.includes(to)||to===d.bloodGroup)return er("নতুন রক্তের গ্রুপ নির্বাচন করুন");
      if(reason.length<5)return er("গ্রুপ পরিবর্তনের কারণ লিখুন (কমপক্ষে ৫ অক্ষর)");
      const f=s.q("#gc_file").files&&s.q("#gc_file").files[0];
      if(!f)return er("প্রমাণ হিসেবে রিপোর্টের ছবি সংযুক্ত করুন");
      const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
      if(!uid)return er("লগইন সেশন পাওয়া যায়নি — আবার লগইন করুন");
      const btn=s.q("#gc_send");btn.disabled=true;btn.textContent="পাঠানো হচ্ছে…";
      const fail=m=>{btn.disabled=false;btn.textContent="অনুরোধ পাঠান";er(m)};
      try{
        
        const u=await getRow(NODES.users,uid);
        const cur=u&&u.groupChange;
        if(cur&&cur.status==="pending"){
          STORE.donor.groupChange={...cur};await save();renderSub(SUB);
          return fail("একটি অনুরোধ ইতিমধ্যে অপেক্ষমাণ আছে — অ্যাডমিনের সিদ্ধান্তের অপেক্ষা করুন");
        }
        const up=await imgbbUploadImage(f);
        
        if(APPROVAL_SETTINGS.bloodGroupApproval===false){
          const serverApply=await requestDirectApply("bloodGroup",{to,reason,proof:up.url}).catch(()=>null);
          if(serverApply&&serverApply.ok){
            const from=d.bloodGroup,at=nowIso();
            d.bloodGroup=to;
            d.groupChange={from,to,reason,proof:up.url,status:"approved",at,decidedAt:at};
            await save();
            await logAct("রক্তের গ্রুপ পরিবর্তন",`${from} → ${to}`,"donor");
            s.close();renderSub(SUB);
            toast("রক্তের গ্রুপ আপডেট হয়েছে","ok");
            return;
          }
          
          if(!(serverApply&&serverApply.approvalRequired)&&await isStaffUser(uid)){
          const from=d.bloodGroup,at=nowIso(),paths={};
          paths[`users/${uid}/bloodGroup`]=to;
          paths[`users/${uid}/groupChange`]={from,to,reason,proof:up.url,status:"approved",at,decidedAt:at};
          if(d.donorId){paths[`donors/${d.donorId}/bloodGroup`]=to;paths[`donors/${d.donorId}/group`]=to;}
          await updatePaths(paths);
          d.bloodGroup=to;
          d.groupChange={from,to,reason,proof:up.url,status:"approved",at,decidedAt:at};
          await save();
          s.close();renderSub(SUB);
          toast("রক্তের গ্রুপ আপডেট হয়েছে","ok");
          return;
          }
          
          if(!(serverApply&&serverApply.approvalRequired)){
            return fail("অনুমোদন সেটিং অনুযায়ী গ্রুপ পরিবর্তন সরাসরি কার্যকর হওয়ার কথা, কিন্তু সার্ভার সেটি প্রক্রিয়া করতে পারেনি"
              +((serverApply&&serverApply.error)?" — "+serverApply.error:"")
              +"। অনুরোধটি approval queue-তে পাঠানো হয়নি — একটু পরে আবার চেষ্টা করুন বা অ্যাডমিনকে জানান।");
          }
        }
        const at=nowIso();
        const id=genId("GC");
        
        await setRow(NODES.queue,id,{kind:"group",id,name:STORE.account.name||"",from:d.bloodGroup,to,
          reason,proof:up.url,phone:STORE.account.phone||"",area:STORE.account.area||"",
          donorId:d.donorId||"",ownerUid:uid,at,atTs:serverTime()});
        
        await updateRow(NODES.users,uid,{groupChange:{id,from:d.bloodGroup,to,reason,proof:up.url,
          status:"pending",at,atTs:serverTime(),note:""}});
        
        STORE.donor.groupChange={id,from:d.bloodGroup,to,reason,proof:up.url,
          status:"pending",at,atTs:Date.now(),note:""};
        await save();
        await logAct("রক্তের গ্রুপ পরিবর্তনের অনুরোধ",`${d.bloodGroup} → ${to}`,"donor");
        s.close();renderSub(SUB);
        toast("অনুরোধ পাঠানো হয়েছে — অ্যাডমিন অনুমোদন দিলে নতুন গ্রুপ কার্যকর হবে","ok");
      }catch(e){fail(e&&e.message?e.message:"অনুরোধ পাঠানো যায়নি — আবার চেষ্টা করুন");}
    };
  }
  
  
  function editDonorField(k){
    const f=DFIELDS.find(x=>x.k===k);
    if(!f)return;
    const validate=v=>{
      if(k==="name"&&v.trim().length<2)return "নাম কমপক্ষে ২ অক্ষরের হতে হবে";
      if(k==="dob"){
        if(!isValidDob(v))return "সঠিক জন্ম তারিখ নির্বাচন করুন";
        const a=calcAgeFromDob(v);
        if(a===null||a<SITE.rules.minAge||a>SITE.rules.maxAge)
          return `জন্ম তারিখ অনুযায়ী বয়স ${SITE.rules.minAge} থেকে ${SITE.rules.maxAge} বছরের মধ্যে হতে হবে`;
      }
      if(k==="phone"&&!phoneOK(v))return "সঠিক ১১ সংখ্যার নম্বর দিন";
      return true;
    };
    editField({key:k,title:f.label,label:f.label,type:f.type,options:f.options,
      min:f.min,max:f.type==="tel"?f.max:undefined,max2:f.type==="date"?f.max:undefined,
      store:"account",validate});
  }
  
  
  function pickPhoto(){
    const i=document.createElement("input");i.type="file";i.accept="image/*";
    i.onchange=async()=>{
      const f=i.files[0];if(!f)return;
      const s=sheet("ছবি আপলোড","<div style='text-align:center;padding:14px 0'><div class='sk' style='width:96px;height:96px;border-radius:50%;margin:0 auto 14px'></div><p class='mut'>ছবি আপলোড হচ্ছে…</p><div style='height:7px;border-radius:9px;background:var(--card2);margin-top:12px;overflow:hidden'><div id='pb' style='height:100%;width:8%;background:var(--grn);transition:width .3s'></div></div></div>","");
      try{
        
        const res=await imgbbUploadImage(f);
        s.q("#pb").style.width="100%";
        STORE.account.photo=res.url;STORE.account.photoSource="upload";
        await pushAccountToRtdb();
        await save();
        await logAct("প্রোফাইল ছবি পরিবর্তন","");
        setTimeout(()=>{s.close();renderSub("account");toast("ছবি আপডেট হয়েছে","ok")},280);
      }catch(e){
        s.close();
        toast(e&&e.message?e.message:"ছবি আপলোড করা যায়নি","er");
      }
    };
    i.click();
  }
  
  
  const TAKEN=["admin","cbdc","rahman","test","sahu2","donor"];
  function sheetUsername(){
    const a=STORE.account;
    const s=sheet("Username পরিবর্তন",`
      <div class="note w">${ICON.warn(17)}<span>আপনি username দিয়েও লগইন করতে পারেন —
        পরিবর্তন করলে <b>নতুন username দিয়ে লগইন</b> করতে হবে।</span></div>
      <div class="f"><label>বর্তমান</label><input value="@${esc(a.username)}" readonly></div>
      <div class="f"><label>নতুন username <i>*</i></label>
        <input id="un" placeholder="নতুন username লিখুন" maxlength="20" autocapitalize="off" spellcheck="false">
        <span class="hint" id="uh">৩–২০ অক্ষর · ছোট হাতের ইংরেজি, সংখ্যা, _ এবং .</span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok" disabled>পরিবর্তন করুন</button>`);
    const inp=s.q("#un"),h=s.q("#uh"),ok=s.q("#ok");let t;
    inp.oninput=()=>{
      clearTimeout(t);const v=inp.value.trim().toLowerCase();
      ok.disabled=true;h.className="hint";
      if(v===a.username){h.textContent="এটি আপনার বর্তমান username";return}
      if(!/^[a-z0-9._]{3,20}$/.test(v)){h.className="hint er";h.textContent="৩–২০ অক্ষর · শুধু a-z 0-9 _ .";return}
      h.textContent="পরীক্ষা করা হচ্ছে…";
      t=setTimeout(async()=>{
        
        const owner=await lookupLoginKey("username",v).catch(()=>null);
        if(TAKEN.includes(v)||owner){h.className="hint er";h.textContent="এই username ইতিমধ্যে ব্যবহৃত"}
        else{h.className="hint ok";h.textContent="✓ পাওয়া যাচ্ছে";ok.disabled=false}
      },420);
    };
    ok.onclick=async()=>{
      const v=inp.value.trim().toLowerCase();
      const old=a.username;ok.disabled=true;
      
      const mail=String(a.email||"").trim();
      const claim=await claimLoginKey("username",v,mail);
      if(!claim.claimed){
        ok.disabled=false;
        h.className="hint er";
        h.textContent=claim.reason==="conflict"?"এই username ইতিমধ্যে ব্যবহৃত":"এখন যাচাই করা যাচ্ছে না — আবার চেষ্টা করুন";
        return;
      }
      STORE.account.username=v;
      try{
        await pushAccountToRtdb();
        await save();await logAct("Username পরিবর্তন","@"+v,"account");
        
        await releaseLoginKey("username",old,mail);
        s.close();renderSub("account");toast("Username পরিবর্তন হয়েছে","ok");
      }catch(e){
        STORE.account.username=old;
        await releaseLoginKey("username",v,mail).catch(()=>{});
        if(old)await claimLoginKey("username",old,mail).catch(()=>{});
        ok.disabled=false;toast("Username RTDB-তে সংরক্ষণ করা যায়নি","er");
      }
    };
  }
  
  
  function sheetEmail(){
    const a=STORE.account;
    if(a.photoSource==="google"){
      sheet("ইমেইল",`<div class="note i">${ICON.info(17)}<span>আপনার ইমেইল <b>Google অ্যাকাউন্ট</b> থেকে নিয়ন্ত্রিত —
        এখান থেকে পরিবর্তন করা যাবে না।</span></div>
        <div class="f"><label>বর্তমান ইমেইল</label><input value="${esc(a.email)}" readonly></div>`,
        `<button class="btn gh" data-close>বন্ধ</button>`);return;
    }
    const s=sheet("ইমেইল পরিবর্তন",`
      <div class="f"><label>বর্তমান ইমেইল</label><input value="${esc(a.email)}" readonly></div>
      <div class="f"><label>নতুন ইমেইল <i>*</i></label><input id="ne" type="email">
        <span class="hint er hide" id="ee"></span></div>
      <div class="f"><label>পাসওয়ার্ড দিয়ে নিশ্চিত করুন <i>*</i></label><input id="pw" type="password"
        autocomplete="current-password"></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="go">পরিবর্তন করুন</button>`);
    s.q("#go").onclick=async()=>{
      const v=s.q("#ne").value.trim().toLowerCase(),p=s.q("#pw").value;
      const er=s.q("#ee");er.classList.add("hide");
      const fail=m=>{er.textContent=m;er.classList.remove("hide")};
      if(!mailOK(v))return fail("সঠিক ইমেইল দিন");
      if(v===a.email)return fail("এটি আপনার বর্তমান ইমেইল");
      if(!p)return toast("পাসওয়ার্ড দিন","er");
      const btn=s.q("#go"),orig=btn.innerHTML;
      btn.disabled=true;btn.textContent="পরিবর্তন হচ্ছে…";
      try{
        const me=authCurrentUser();
        if(!me)throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
        
        const owner=await lookupEmailOwner(v);
        if(owner&&String(owner)!==String(me.uid))throw new Error("এই ইমেইল অন্য একটি অ্যাকাউন্টে ব্যবহৃত");
        
        await reauthenticateCurrentWithPassword(p, me.email||a.email);
        
        await updateAuthEmail(v);
        
        const old=a.email;
        
        try{
          await releaseLoginEntries(old,a.username,a.phone);
        }catch(e){ console.warn("login release old:",e&&e.message); }
        a.email=v;a.emailVerified=false;
        try{ await pushAccountToRtdb(); }catch(e){ console.warn("email rtdb push:",e&&e.message); }
        try{ await releaseEmailIdentity(old,me.uid); }catch(e){ console.warn("identity release:",e&&e.message); }
        try{ await claimEmailIdentity(v,me.uid); }catch(e){ console.warn("identity claim:",e&&e.message); }
        try{ await claimLoginEntries(v,a.username,a.phone); }catch(e){ console.warn("login claim new:",e&&e.message); }
        await save();
        await logAct("ইমেইল পরিবর্তন",v,"security");
        s.close();renderSub("account");
        toast("ইমেইল পরিবর্তন হয়েছে","ok");
      }catch(err){
        btn.disabled=false;btn.innerHTML=orig;
        const msg=authErrorMessage(err,{fallback:"ইমেইল পরিবর্তন করা যায়নি। সঠিক পাসওয়ার্ড ও ইন্টারনেট সংযোগ দিয়ে আবার চেষ্টা করুন।"});
        fail(msg);
      }
    };
  }
  
  
  function sheetPhone(){
    const a=STORE.account;
    const s=sheet("মোবাইল নম্বর",`
      <div class="f"><label>বর্তমান নম্বর</label><input value="${esc(a.phone)}" readonly></div>
      <div class="f"><label>নতুন নম্বর <i>*</i></label>
        <input id="np" maxlength="11" inputmode="numeric">
        <span class="hint" id="ph">১১ সংখ্যার বাংলাদেশি নম্বর</span></div>
      <div class="note i">${ICON.info(17)}<span>এই নম্বরটি অ্যাকাউন্ট শনাক্তকরণ ও যোগাযোগে ব্যবহার হবে।
        এখন শুধু ফরম্যাট পরীক্ষা করা হচ্ছে।</span></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">সংরক্ষণ</button>`);
    s.q("#ok").onclick=async()=>{
      const v=s.q("#np").value.trim();
      if(!phoneOK(v)){const h=s.q("#ph");h.className="hint er";h.textContent="সঠিক ১১ সংখ্যার নম্বর দিন";return}
      const old=a.phone;const ok=s.q("#ok");ok.disabled=true;
      const mail=String(a.email||"").trim();
      const claim=await claimLoginKey("phone",digits(v),mail);
      if(!claim.claimed){
        ok.disabled=false;
        toast(claim.reason==="conflict"?"এই নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট আছে":"এখন সংরক্ষণ করা যাচ্ছে না — আবার চেষ্টা করুন","er");
        return;
      }
      STORE.account.phone=v;STORE.account.phoneVerified=false;
      try{
        await pushAccountToRtdb();
        await save();await logAct("মোবাইল নম্বর পরিবর্তন",v,"security");
        await releaseLoginKey("phone",digits(old),mail);
        s.close();renderSub("account");toast("নম্বর সংরক্ষণ হয়েছে","ok");
      }catch(e){
        STORE.account.phone=old;
        await releaseLoginKey("phone",digits(v),mail).catch(()=>{});
        if(old)await claimLoginKey("phone",digits(old),mail).catch(()=>{});
        ok.disabled=false;toast("নম্বর RTDB-তে সংরক্ষণ করা যায়নি","er");
      }
    };
  }
  
  
  function sheetPassword(){
    const s=sheet("পাসওয়ার্ড পরিবর্তন",`
      <div class="f"><label>বর্তমান পাসওয়ার্ড <i>*</i></label><input id="p0" type="password"></div>
      <div class="f"><label>নতুন পাসওয়ার্ড <i>*</i></label><input id="p1" type="password" minlength="6">
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
      
      if(p1.length<6){e.textContent="নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর";e.classList.remove("hide");return}
      if(p1!==p2){e.textContent="দুটি পাসওয়ার্ড মিলছে না";e.classList.remove("hide");return}
      try{
        await donorChangePassword(p0,p1);
        STORE.security.passwordChangedAt=iso(now());await save();
        await logAct("পাসওয়ার্ড পরিবর্তন","সফল","security");
        s.close();renderSub("security");toast("পাসওয়ার্ড পরিবর্তন হয়েছে","ok");
      }catch(err){
        toast(authErrorMessage(err,{wrongCredentials:"বর্তমান পাসওয়ার্ড সঠিক নয়",fallback:"পাসওয়ার্ড পরিবর্তন করা যায়নি"}),"er");
      }
    };
  }
  
  
  async function doLogout(){
    try{
      await authSignOut();
      await logAct("লগআউট","এই ডিভাইস থেকে","security");
      sessionStorage.clear();
      localStorage.removeItem("cbdc.session");
      localStorage.removeItem("cbdc.auth");
      localStorage.removeItem("cbdcMember");
      localStorage.removeItem("cbdcMemberEmail");
      localStorage.removeItem("cbdcMemberName");
      localStorage.removeItem("cbdcMemberPhoto");
      localStorage.removeItem("cbdcMemberRole");
      localStorage.removeItem("cbdcMemberUid");
      localStorage.removeItem("cbdc.app");
      localStorage.removeItem("cbdc.data");
    }catch(e){}
    toast("লগআউট হয়েছে","ok");
    setTimeout(()=>{navigateToPage("home")},700);
  }
  
  
  
  const POLICY=()=>({
    pol_terms:{title:"ব্যবহারের শর্তাবলী",updated:tp("১ আগস্ট ২০২৬"),
      intro:tp("চকবাজার ব্লাড ডোনার\u0027স ক্লাবের অ্যাপ ও ওয়েবসাইট ব্যবহার করার আগে এই শর্তগুলো পড়ে নিন। অ্যাকাউন্ট খোলা বা অ্যাপ ব্যবহার করার অর্থ আপনি এই শর্তগুলো মেনে নিয়েছেন।"),
      sec:[
        [tp("সেবার উদ্দেশ্য"),tp("এই অ্যাপ স্বেচ্ছায় রক্তদাতা ও রক্তের প্রয়োজন আছে এমন মানুষের মধ্যে যোগাযোগ তৈরি করে। ক্লাব কোনো হাসপাতাল, ব্লাড ব্যাংক বা চিকিৎসাসেবা প্রতিষ্ঠান নয় এবং রক্ত সংগ্রহ, সংরক্ষণ বা বিক্রি করে না।")],
        [tp("অ্যাকাউন্ট"),tp("একজন ব্যক্তি একটি অ্যাকাউন্ট খুলতে পারবেন। দেওয়া সব তথ্য সত্য ও হালনাগাদ হতে হবে। অ্যাকাউন্টের নিরাপত্তা ও পাসওয়ার্ড গোপন রাখার দায়িত্ব আপনার। অন্যের নামে বা ভুয়া তথ্য দিয়ে অ্যাকাউন্ট খোলা যাবে না।")],
        [tp("বয়স ও যোগ্যতা"),tp("রক্তদাতা হিসেবে যুক্ত হতে হলে বয়স কমপক্ষে ১৮ বছর হতে হবে এবং রক্তদানের শারীরিক যোগ্যতা থাকতে হবে। ভুল তথ্য দিয়ে তালিকাভুক্ত হলে অ্যাকাউন্ট স্থগিত করা হবে।")],
        [tp("রক্ত বেচাকেনা নিষিদ্ধ"),tp("রক্তদান সম্পূর্ণ স্বেচ্ছায় ও বিনামূল্যে। রক্তের বিনিময়ে টাকা বা কোনো সুবিধা চাওয়া বা দেওয়া কঠোরভাবে নিষিদ্ধ এবং আইনত দণ্ডনীয়। এমন অভিযোগ প্রমাণিত হলে অ্যাকাউন্ট স্থায়ীভাবে বাতিল হবে।")],
        [tp("আচরণবিধি"),tp("অন্য ব্যবহারকারীর সাথে সম্মানজনক আচরণ করুন। হয়রানি, হুমকি, অশালীন বার্তা, অপ্রয়োজনীয় ফোন বা যোগাযোগের তথ্য অন্যত্র ছড়িয়ে দেওয়া নিষিদ্ধ। রক্তদাতার নম্বর শুধু রক্তসংক্রান্ত প্রয়োজনেই ব্যবহার করা যাবে।")],
        [tp("ভুল বা অপব্যবহার"),tp("মিথ্যা জরুরি আবেদন, ভুয়া রক্তদানের রেকর্ড বা অন্যের ছবি-তথ্য ব্যবহার করা যাবে না। ক্লাব যেকোনো সময় যাচাই চাইতে পারে এবং প্রয়োজনে অ্যাকাউন্ট স্থগিত বা বাতিল করতে পারে।")],
        [tp("দায়সীমা"),tp("ক্লাব রক্তদাতা ও গ্রহীতার মধ্যে শুধু যোগাযোগের সুযোগ করে দেয়। রক্তদানের সিদ্ধান্ত, শারীরিক পরীক্ষা, ক্রসম্যাচিং ও চিকিৎসা সংক্রান্ত সব দায়িত্ব সংশ্লিষ্ট হাসপাতাল ও ব্যক্তির। এ থেকে উদ্ভূত কোনো ক্ষতির জন্য ক্লাব দায়ী থাকবে না।")],
        [tp("শর্ত পরিবর্তন"),tp("প্রয়োজনে এই শর্তাবলী হালনাগাদ করা হতে পারে। বড় পরিবর্তন হলে অ্যাপে বিজ্ঞপ্তির মাধ্যমে জানানো হবে।")],
        [tp("যোগাযোগ"),tp(`শর্তাবলী নিয়ে কোনো প্রশ্ন থাকলে হেল্পলাইন ${bn(SITE.phone)} নম্বরে যোগাযোগ করুন।`)]]},
  
    pol_privacy:{title:"গোপনীয়তা নীতি",updated:tp("১ আগস্ট ২০২৬"),
      intro:tp("আপনার তথ্য আমাদের কাছে গুরুত্বপূর্ণ। কী তথ্য নেওয়া হয়, কেন নেওয়া হয় এবং কে দেখতে পায় — এই নীতিতে তা পরিষ্কারভাবে বলা আছে।"),
      sec:[
        [tp("কী তথ্য সংগ্রহ করা হয়"),tp("অ্যাকাউন্টের জন্য: নাম, ইউজারনেম, ইমেইল, মোবাইল নম্বর, জন্মতারিখ, লিঙ্গ ও এলাকা। রক্তদাতা হলে অতিরিক্ত: রক্তের গ্রুপ, ওজন, সর্বশেষ রক্তদানের তারিখ ও স্বাস্থ্য সংক্রান্ত সংক্ষিপ্ত তথ্য।")],
        [tp("কেন সংগ্রহ করা হয়"),tp("জরুরি প্রয়োজনে সঠিক গ্রুপের রক্তদাতা খুঁজে বের করা, রক্তদানের হিসাব রাখা, বিশ্রামের সময় গণনা করা এবং আপনাকে প্রয়োজনীয় বিজ্ঞপ্তি পাঠানোর জন্য।")],
        [tp("পাবলিক তালিকায় কী দেখা যায়"),tp("আপনার নাম, রক্তের গ্রুপ ও এলাকা দেখা যায়। সম্পূর্ণ ঠিকানা, জন্মতারিখ, ইমেইল ও স্বাস্থ্য তথ্য কখনো প্রকাশ করা হয় না। মোবাইল নম্বর দেখা যাবে কি না তা আপনি গোপনীয়তা সেটিংস থেকে নিজে ঠিক করতে পারবেন।")],
        [tp("আপনার নিয়ন্ত্রণ"),tp("যেকোনো সময় প্রোফাইল লুকাতে পারবেন, প্রাপ্যতা বন্ধ রাখতে পারবেন, তথ্য সম্পাদনা করতে পারবেন, সব তথ্য JSON বা CSV ফাইলে নামাতে পারবেন এবং অ্যাকাউন্ট মুছে ফেলতে পারবেন।")],
        [tp("তথ্য কার সাথে ভাগ করা হয়"),tp("আপনার তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি বা ভাড়া দেওয়া হয় না। শুধু ক্লাবের অনুমোদিত স্বেচ্ছাসেবক ও অ্যাডমিনরা প্রয়োজনের সময় তথ্য দেখতে পান, এবং প্রতিটি দেখা কার্যকলাপ লগে রাখা হয়।")],
        [tp("তথ্য সংরক্ষণ"),tp("অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত তথ্য সংরক্ষিত থাকে। অ্যাকাউন্ট মুছে ফেলার অনুরোধ করলে ২৪ ঘণ্টার মধ্যে সব ব্যক্তিগত তথ্য মুছে যায়। শুধু নামবিহীন রক্তদানের পরিসংখ্যান থেকে যায়, কারণ তা অন্য রোগীর চিকিৎসার রেকর্ডের সাথে যুক্ত।")],
        [tp("নিরাপত্তা"),tp("পাসওয়ার্ড এনক্রিপ্ট করে রাখা হয়। অচেনা ডিভাইসে লগইন হলে আপনাকে জানানো হয় এবং যেকোনো ডিভাইস থেকে দূর থেকে লগআউট করতে পারবেন।")],
        [tp("শিশুদের তথ্য"),tp("১৮ বছরের কম বয়সীদের জন্য এই সেবা নয় এবং আমরা জেনেশুনে তাদের তথ্য সংগ্রহ করি না।")],
        [tp("যোগাযোগ"),tp(`গোপনীয়তা নিয়ে কোনো প্রশ্ন বা অনুরোধ থাকলে হেল্পলাইন ${bn(SITE.phone)} নম্বরে জানান।`)]]},
  
    pol_donate:{title:"রক্তদান নির্দেশিকা",updated:tp("১ আগস্ট ২০২৬"),
      intro:tp("নিরাপদ রক্তদানের জন্য নিচের নির্দেশনাগুলো মেনে চলুন। এগুলো সাধারণ পরামর্শ — চূড়ান্ত সিদ্ধান্ত সবসময় হাসপাতালের চিকিৎসকের।"),
      sec:[
        [tp("কারা রক্ত দিতে পারবেন"),tp("বয়স ১৮ থেকে ৬০ বছর · ওজন কমপক্ষে ৫০ কেজি · হিমোগ্লোবিন কমপক্ষে ১২.৫ গ্রাম/ডেসিলিটার · সাধারণভাবে সুস্থ শরীর ও স্বাভাবিক রক্তচাপ।")],
        [tp("কারা দিতে পারবেন না"),tp("হেপাটাইটিস বি বা সি, এইচআইভি বা অন্য রক্তবাহিত রোগ থাকলে · হৃদরোগ, ক্যান্সার বা অনিয়ন্ত্রিত ডায়াবেটিস থাকলে · গর্ভবতী বা সন্তান জন্মের ছয় মাসের মধ্যে · সাম্প্রতিক বড় অস্ত্রোপচার বা রক্ত গ্রহণের ইতিহাস থাকলে।")],
        [tp("কতদিন পর পর"),tp("পুরুষরা ৩ মাস (৯০ দিন) পর পর এবং নারীরা ৪ মাস পর পর রক্ত দিতে পারেন। অ্যাপে আপনার পরবর্তী রক্তদানের তারিখের কাউন্টডাউন দেখানো হয়।")],
        [tp("রক্তদানের আগে"),tp("আগের রাতে অন্তত ৭ ঘণ্টা ঘুমান · খালি পেটে রক্ত দেবেন না, হালকা খাবার খেয়ে যান · প্রচুর পানি পান করুন · রক্তদানের ২৪ ঘণ্টা আগে থেকে ধূমপান ও মদ্যপান এড়িয়ে চলুন · জাতীয় পরিচয়পত্র সাথে নিন।")],
        [tp("রক্তদানের সময়"),tp("পুরো প্রক্রিয়ায় ৮ থেকে ১০ মিনিট সময় লাগে এবং ৩৫০ থেকে ৪৫০ মিলিলিটার রক্ত নেওয়া হয়। প্রতিবার নতুন ও জীবাণুমুক্ত সুচ ব্যবহার করা হয়, তাই সংক্রমণের কোনো ঝুঁকি নেই। শরীর ২৪ থেকে ৪৮ ঘণ্টার মধ্যে রক্তের তরল অংশ পূরণ করে নেয়।")],
        [tp("রক্তদানের পর"),tp("১০ থেকে ১৫ মিনিট শুয়ে বা বসে বিশ্রাম নিন · পানি, শরবত বা ফলের রস পান করুন · হাতের ব্যান্ডেজ ৪ ঘণ্টা রাখুন · ওই দিন ভারী কাজ, ব্যায়াম বা দীর্ঘ ভ্রমণ এড়িয়ে চলুন · মাথা ঘোরালে সাথে সাথে শুয়ে পড়ুন ও পা উঁচু করে রাখুন।")],
        [tp("রক্তদানের উপকারিতা"),tp("প্রতিবার রক্তদানে তিনজন পর্যন্ত মানুষের জীবন বাঁচতে পারে। নিয়মিত রক্তদানে শরীরে নতুন রক্তকণিকা তৈরি হয় এবং প্রতিবার রক্তদানের আগে বিনামূল্যে কয়েকটি স্বাস্থ্য পরীক্ষা হয়ে যায়।")],
        [tp("জরুরি সতর্কতা"),tp("রক্ত কখনো টাকার বিনিময়ে দেবেন না বা নেবেন না। অচেনা কেউ হাসপাতালের বাইরে দেখা করতে বললে সতর্ক থাকুন — রক্তদান সবসময় স্বীকৃত হাসপাতাল বা ব্লাড ব্যাংকে করুন।")]]}
  });
  function sheetPolicy(key){
    const d=POLICY()[key]; if(!d)return;
    const s=sheet(d.title,`
      <div>
      <p class="mut" style="font-size:.75rem;margin:-2px 0 12px">${tp("সর্বশেষ হালনাগাদ:")} ${esc(d.updated)}</p>
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
  
  
  
  async function donorChangePassword(currentPassword,newPassword){
    const shared=initSharedFirebase();
    const user=shared.auth && shared.auth.currentUser;
    if(!user)throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
    const email=user.email||STORE.account.email;
    if(!email)throw new Error("এই অ্যাকাউন্টে ইমেইল নেই।");
    await setOrChangePassword(user, email, currentPassword, newPassword);
  }
  
  function sheetForgot(){
    const shared=initSharedFirebase();
    const user=shared.auth && shared.auth.currentUser;
    const email=String((user&&user.email)||STORE.account.email||"").trim().toLowerCase();
    if(!email||!mailOK(email)){
      toast("এই অ্যাকাউন্টে ইমেইল নেই","er");
      return;
    }
    const s=sheet("পাসওয়ার্ড রিসেট লিংক",`
      <div id="fg_body" style="text-align:center;padding:8px 0 2px">
        <div style="width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:var(--grn-s);
          color:var(--grn);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(8,122,75,.12)">
          ${ICON.mail(28)}
        </div>
        <b id="fg_title" style="display:block;font-size:.95rem;margin-bottom:6px">লিংক পাঠানো হচ্ছে…</b>
        <p id="fg_desc" class="mut" style="font-size:.82rem;line-height:1.7;margin:0 0 12px">
          <span>${esc(email)}</span>
        </p>
        <div id="fg_note" class="note i" style="text-align:left;margin:0">
          ${ICON.info(16)}
          <span>অনুগ্রহ করে একটু অপেক্ষা করুন…</span>
        </div>
      </div>`,
      `<button class="btn" data-close style="flex:1" id="fg_ok" disabled>বুঝেছি</button>`);
    const setState=(kind,msg)=>{
      const title=s.q("#fg_title"), desc=s.q("#fg_desc"), note=s.q("#fg_note"), ok=s.q("#fg_ok");
      if(kind==="ok"){
        title.textContent="রিসেট লিংক পাঠানো হয়েছে";
        desc.innerHTML=`আপনার অ্যাকাউন্টের ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।<br>
          <b style="color:var(--ink);font-weight:800">${esc(email)}</b>`;
        note.className="note g";
        note.style.textAlign="left";
        note.style.margin="0";
        note.innerHTML=`${ICON.checkC(16)}
          <span>ইমেইল খুলে লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন। ইমেইল না পেলে স্প্যাম ফোল্ডার দেখুন।</span>`;
        if(ok){ok.disabled=false;ok.textContent="বুঝেছি";}
        s.q(".ft").innerHTML=`
          <button class="btn gh" id="fg_again" style="flex:1">আবার পাঠান</button>
          <button class="btn" data-close style="flex:1">বুঝেছি</button>`;
        s.q("#fg_again").onclick=()=>send(true);
      }else if(kind==="er"){
        title.textContent="লিংক পাঠানো যায়নি";
        desc.innerHTML=`<span>${esc(email)}</span>`;
        note.className="note r";
        note.style.textAlign="left";
        note.style.margin="0";
        note.innerHTML=`${ICON.warn(16)}<span>${esc(msg||"আবার চেষ্টা করুন।")}</span>`;
        s.q(".ft").innerHTML=`
          <button class="btn gh" data-close style="flex:1">বন্ধ</button>
          <button class="btn" id="fg_again" style="flex:1">আবার পাঠান</button>`;
        s.q("#fg_again").onclick=()=>send(true);
      }else{
        title.textContent="লিংক পাঠানো হচ্ছে…";
        desc.innerHTML=`<span>${esc(email)}</span>`;
        note.className="note i";
        note.style.textAlign="left";
        note.style.margin="0";
        note.innerHTML=`${ICON.info(16)}<span>অনুগ্রহ করে একটু অপেক্ষা করুন…</span>`;
        if(ok){ok.disabled=true;}
      }
    };
    let busy=false;
    async function send(again){
      if(busy)return;busy=true;
      setState("load");
      try{
        await requestPasswordReset(shared.auth, email);
        await logAct(again?"পাসওয়ার্ড রিসেট লিংক আবার পাঠানো":"পাসওয়ার্ড রিসেট লিংক পাঠানো",
          email,"security");
        setState("ok");
        toast("রিসেট লিংক পাঠানো হয়েছে","ok");
      }catch(err){
        const msg=authErrorMessage(err,{fallback:"রিসেট লিংক পাঠানো যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"});
        setState("er", msg);
        toast(msg,"er");
      }finally{busy=false}
    }
    send(false);
  }

  
  async function deleteAccountNow(currentPassword){
    const shared=initSharedFirebase();
    if(!shared.auth) throw new Error("Firebase সংযোগ নেই। ইন্টারনেট সংযোগ পরীক্ষা করুন।");
    const me=authCurrentUser();
    if(!me) throw new Error("লগইন অবস্থায় নেই। আবার লগইন করুন।");
    const uid=String(me.uid || STORE.account.uid || "").trim();
    const email=String(me.email || STORE.account.email || "").trim().toLowerCase();
    const phone=String(STORE.account.phone || "").replace(/\s+/g,"");
    if(!uid) throw new Error("অ্যাকাউন্টের UID পাওয়া যায়নি।");
    if(!email) throw new Error("এই অ্যাকাউন্টে ইমেইল নেই — অ্যাকাউন্ট মুছে ফেলা যাবে না।");

    
    const hasPasswordProvider=me.providerIds.includes("password") || me.providerIds.includes("firebase");
    if(!hasPasswordProvider) throw new Error("এই অ্যাকাউন্টে পাসওয়ার্ড সেট নেই। পাসওয়ার্ড দিয়ে যাচাই করা সম্ভব নয়।");

    
    await reauthenticateCurrentWithPassword(currentPassword, email);

    
    const paths={};
    const ownerMatches = x => String((x&&(x.ownerUid||x.uid||x.userId))||"").trim()===uid;
    const emailMatches = x => !!x && String(x.email||"").trim().toLowerCase()===email;
    const phoneMatches = x => !!phone && String(x.phone||"").replace(/\s+/g,"")===phone;

    
    const userProfile=await getRow(NODES.users, uid);
    paths[`users/${uid}`]=null;

    
    const savedMemberId=String((userProfile&&userProfile.donorMemberId)||"").trim();
    if(savedMemberId){
      paths[`members/${savedMemberId}`]=null;
      paths[`queue/${savedMemberId}`]=null;
    }

    
    const donors=await listOnce(NODES.donors);
    
    donors.filter(d=>ownerMatches(d) || emailMatches(d) || phoneMatches(d)).forEach(d=>{
      if(d.id){ paths[`donors/${d.id}`]=null; try{ releaseDonorSerial(d.id); }catch(_e){} }
    });

    
    
    try{
      const approved=await listOnce(NODES.donations);
      approved.filter(x=>ownerMatches(x) || emailMatches(x)).forEach(x=>{ if(x&&x.id) paths[`donations/${x.id}`]=null; });
    }catch(e){ console.warn("approved donation cleanup:",e&&e.message); }

    
    try{
      const reports=await listOnce(NODES.reports);
      reports.filter(x=>ownerMatches(x)).forEach(x=>{ if(x&&x.id) paths[`reports/${x.id}`]=null; });
    }catch(e){ console.warn("report cleanup:",e&&e.message); }

    
    const members=await listOnce(NODES.members);
    const memberIds=new Set();
    members.filter(m=>ownerMatches(m) || emailMatches(m) || phoneMatches(m)).forEach(m=>{
      if(m.id){ paths[`members/${m.id}`]=null; memberIds.add(String(m.id)); }
    });

    
    const queue=await listOnce(NODES.queue);
    queue.filter(q=>(ownerMatches(q) || memberIds.has(String(q.memberId||"")) || (q.phone&&phoneMatches(q)))).forEach(q=>{ if(q.id) paths[`queue/${q.id}`]=null; });
    
    const selfQid="PD-"+String(STORE.donor.donorId||uid).replace(/[^A-Za-z0-9]/g,"").slice(-10);
    if(selfQid) paths[`queue/${selfQid}`]=null;
    (RAW.mine||[]).forEach(m=>{ if(m&&m.id) paths[`queue/${m.id}`]=null; });
    
    const delUid8=uid.replace(/[^A-Za-z0-9]/g,"").slice(-8)||"unknown";
    (RAW.donations||[]).forEach(x=>{
      if(x&&x.date){
        const dd=String(x.date).replace(/[^0-9]/g,"");
        const vk=donationVerKey(x).replace(/^v/,"");
        const dn="DN-"+delUid8+"-"+dd+"-"+vk;
        paths[`queue/${dn}`]=null;
        paths[`donations/${dn}`]=null;
        
        paths[`queue/DN-${uid}-${String(x.date).replace(/-/g,"")}`]=null;
      }
    });
    
    const delGc=(userProfile&&userProfile.groupChange)&&typeof userProfile.groupChange==="object"?userProfile.groupChange:null;
    if(delGc&&delGc.id&&String(delGc.status||"")==="pending") paths[`queue/${delGc.id}`]=null;

    
    const requests=await listOnce(NODES.requests);
    requests.filter(r=>ownerMatches(r) || emailMatches(r) || phoneMatches(r)).forEach(r=>{ if(r.id) paths[`requests/${r.id}`]=null; });
    (RAW.mine||[]).forEach(m=>{ if(m&&m.id) paths[`requests/${m.id}`]=null; });

    
    const accounts=await listOnce(NODES.accounts);
    accounts.filter(a=>ownerMatches(a) || emailMatches(a)).forEach(a=>{ if(a.id) paths[`accounts/${a.id}`]=null; });

    
    try{ const staff=await getRow(NODES.admins, uid); if(staff) paths[`admins/${uid}`]=null; }catch(e){}

    
    try{
      if(releaseEmailIdentity){
        const claimEmail = String((userProfile&&userProfile.email)||user.email||"").trim();
        if(claimEmail) await releaseEmailIdentity(claimEmail, uid);
      }
    }catch(e){ console.warn("identity release:", e&&e.message); }
    
    try{
      const delEmail=String((userProfile&&userProfile.email)||user.email||"").trim();
      await releaseLoginEntries(delEmail,
        (userProfile&&userProfile.username)||STORE.account.username||"",
        (userProfile&&userProfile.phone)||STORE.account.phone||"");
    }catch(e){ console.warn("loginIndex release:", e&&e.message); }

    
    if(Object.keys(paths).length) await updatePaths(paths);

    
    try{
      await deleteAuthCurrentUser();
    }catch(e){
      
      throw new Error(authErrorMessage(e,{fallback:"Firebase Authentication থেকে অ্যাকাউন্ট মুছে ফেলা যায়নি। আবার চেষ্টা করুন।"}));
    }

    
    try{
      [LS,LS_DATA,"cbdc.session","cbdc.auth","cbdcMember","cbdcMemberEmail","cbdcMemberName",
        "cbdcMemberPhoto","cbdcMemberRole","cbdcMemberUid","cbdcMemberUsername","cbdc.app","cbdc.data"]
        .forEach(k=>localStorage.removeItem(k));
    }catch(e){}
  }

  
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
        <p class="mut" style="font-size:.81rem;margin-bottom:12px">অ্যাকাউন্ট · প্রোফাইল ও ব্যক্তিগত তথ্য · ডোনার প্রোফাইল ও কার্ড ·
          সেটিংস · কার্যকলাপ · রক্তদানের রেকর্ড · আপনার করা/সম্পর্কিত জরুরি আবেদনসমূহ</p>
        <div class="note w" style="margin-bottom:12px">${ICON.warn(17)}<span>সঠিক পাসওয়ার্ড দিয়ে নিশ্চিত করার পর
          <b>সাথে সাথে</b> অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা স্থায়ীভাবে মুছে যাবে।</span></div>`;
        ft.innerHTML=`<button class="btn gh" data-close>বাতিল</button><button class="btn red" id="nx">পরবর্তী</button>`;}
      if(step===2){bd.innerHTML=bar+`
        <div class="note w">${ICON.info(17)}<span>মুছে ফেলার বদলে এই বিকল্পগুলো ভেবে দেখুন —</span></div>
        <button class="btn gh w" id="a1" style="margin-bottom:8px">প্রাপ্যতা বন্ধ রাখুন</button>
        <button class="btn gh w" id="a2" style="margin-bottom:8px">সব বিজ্ঞপ্তি বন্ধ করুন</button>
        <button class="btn gh w" id="a3">প্রোফাইল গোপন করুন</button>`;
        ft.innerHTML=`<button class="btn gh" id="bk">পেছনে</button><button class="btn red" id="nx">না, মুছেই ফেলব</button>`;}
      if(step===3){bd.innerHTML=bar+`
        <div class="f"><label>বর্তমান পাসওয়ার্ড <i>*</i></label><input id="dp" type="password" autocomplete="current-password"></div>
        <div class="f"><label>নিশ্চিত করতে <b style="color:var(--red)">মুছে ফেলুন</b> লিখুন <i>*</i></label>
          <input id="dt" autocapitalize="off"></div>
        <div id="de" style="display:none;margin-top:8px;font-size:.78rem;font-weight:700;color:var(--red-d)"></div>`;
        ft.innerHTML=`<button class="btn gh" id="bk">পেছনে</button><button class="btn red" id="nx">অ্যাকাউন্ট মুছুন</button>`;}
      if(step===4){bd.innerHTML=`<div style="text-align:center;padding:8px 0">
        <div style="width:58px;height:58px;margin:0 auto 12px;border-radius:50%;background:var(--grn-s);
          color:var(--grn);display:grid;place-items:center">${ICON.checkC(28)}</div>
        <b style="display:block;margin-bottom:6px">অ্যাকাউন্ট সম্পূর্ণভাবে মুছে ফেলা হয়েছে</b>
        <div class="note w" style="text-align:left;margin-top:12px">${ICON.info(17)}
          <span>অ্যাকাউন্ট এবং অ্যাকাউন্টের সাথে সম্পর্কিত সকল ডাটা স্থায়ীভাবে মুছে ফেলা হয়েছে। আপনি আর এই অ্যাকাউন্ট বা পুরোনো ডাটা দিয়ে প্রবেশ করতে পারবেন না।</span></div>
        <p class="mut" style="margin-top:12px;font-size:.8rem">আমাদের সাথে থাকার জন্য ধন্যবাদ</p></div>`;
        ft.innerHTML=`<button class="btn" data-close style="flex:1">বন্ধ করুন</button>`;}
      s.q("#bk")&&(s.q("#bk").onclick=()=>{step--;draw()});
      s.q("#nx")&&(s.q("#nx").onclick=()=>{
        if(step===3){
          if(!s.q("#dp").value){toast("পাসওয়ার্ড দিন","er");return}
          if(s.q("#dt").value.trim()!=="মুছে ফেলুন"){toast('হুবহু "মুছে ফেলুন" লিখুন',"er");return}
          
          const btn=s.q("#nx"), orig=btn?btn.innerHTML:"";
          if(btn){btn.disabled=true;btn.innerHTML="যাচাই ও মুছে ফেলা হচ্ছে…";}
          deleteAccountNow(s.q("#dp").value).then(()=>{
            step=4;draw();
            setTimeout(()=>{ try{ navigateToPage("home"); }catch(e){ try{ window.location.assign(appBase()); }catch(_){} } },700);
          }).catch(err=>{
            if(btn){btn.disabled=false;btn.innerHTML=orig;}
            const msg=authErrorMessage(err,{fallback:"অ্যাকাউন্ট মুছে ফেলা যায়নি। সঠিক পাসওয়ার্ড ও ইন্টারনেট সংযোগ থাকা অবস্থায় আবার চেষ্টা করুন।"});
            toast(msg,"er");
            if(s.q("#de")){ s.q("#de").textContent=msg; s.q("#de").style.display="block"; }
          });
          return;
        }
        step++;draw();
      });
      s.q("#a1")&&(s.q("#a1").onclick=async()=>{STORE.donor.available=false;await save();s.close();go("set","donor");toast("প্রাপ্যতা বন্ধ করা হয়েছে","ok")});
      s.q("#a2")&&(s.q("#a2").onclick=async()=>{Object.keys(STORE.notif).forEach(k=>{if(k!=="security")STORE.notif[k]=false});
        await save();s.close();go("set","notif");toast("বিজ্ঞপ্তি বন্ধ করা হয়েছে","ok")});
      s.q("#a3")&&(s.q("#a3").onclick=async()=>{STORE.privacy.profile="need";STORE.privacy.searchable=false;
        await save();s.close();go("set","privacy");toast("প্রোফাইল গোপন করা হয়েছে","ok")});
    };
    draw();
  }
  
  
  let reportSubmitBusy=false;
  function sheetReport(){
    const s=sheet("সমস্যা জানান",`
      <div class="f"><label>ধরন</label><select id="rtype"><option>বাগ বা ত্রুটি</option><option>ভুল তথ্য</option>
        <option>অন্য ব্যবহারকারীর অভিযোগ</option><option>পরামর্শ</option></select></div>
      <div class="f"><label>বিস্তারিত <i>*</i></label><textarea id="rd"></textarea></div>
      <div class="f"><label>স্ক্রিনশট</label><input type="file" id="rfile" accept="image/*"></div>
      <div id="myReportsBox"></div>`,
      `<button class="btn gh" data-close>বাতিল</button><button class="btn" id="ok">পাঠান</button>`);
    renderMyReports(s);

    s.q("#ok").onclick=async()=>{
      if(reportSubmitBusy)return;                       
      const text=s.q("#rd").value.trim();
      if(!text){toast("বিস্তারিত লিখুন","er");return}
      const type=s.q("#rtype").value;
      const file=s.q("#rfile").files&&s.q("#rfile").files[0];
      const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
      const btn=s.q("#ok");
      reportSubmitBusy=true;btn.disabled=true;btn.textContent="পাঠানো হচ্ছে…";
      try{
        if(!uid)throw new Error("লগইন সেশন পাওয়া যায়নি। আবার লগইন করে চেষ্টা করুন।");
        
        let screenshot="";
        if(file){
          btn.textContent="স্ক্রিনশট আপলোড হচ্ছে…";
          const up=await imgbbUploadImage(file);
          screenshot=up.url||"";
        }
        btn.textContent="সংরক্ষণ হচ্ছে…";
        const at=nowIso();
        const id=await addRow(NODES.reports,{
          ownerUid:uid,
          uid,
          name:String(STORE.account.name||"").trim(),
          username:String(STORE.account.username||"").trim(),
          email:String(STORE.account.email||"").trim(),
          type,
          text,
          screenshot,
          status:"open",
          createdAt:at
        });
        
        try{await updatePaths({[`users/${uid}/data/reportIds/${id}`]:true});}
        catch(e){console.warn("report index:",e&&e.message)}
        try{addNotif({title:"রিপোর্ট পাঠানো হয়েছে",body:"আপনার রিপোর্টটি অ্যাডমিনের কাছে পৌঁছেছে।",type:"info",ref:id});}catch(e){}
        reportSubmitBusy=false;
        s.close();
        toast("রিপোর্ট পাঠানো হয়েছে — ধন্যবাদ!","ok");
      }catch(err){
        
        reportSubmitBusy=false;btn.disabled=false;btn.textContent="পাঠান";
        console.warn("report submit:",err&&err.message);
        toast(err&&err.message?err.message:"রিপোর্ট পাঠানো যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।","er");
      }
    };
  }

  
  async function renderMyReports(s){
    const box=s.q("#myReportsBox");
    if(!box)return;
    const uid=String(firebaseCurrentUid()||STORE.account.uid||"").trim();
    if(!uid)return;
    let ids=[];
    try{
      const me=await getRow(NODES.users,uid);
      ids=Object.keys((me&&me.data&&me.data.reportIds)||{});
    }catch(e){return}
    if(!ids.length)return;
    const rows=[];
    for(const rid of ids.slice(-8).reverse()){
      try{const r=await getRow(NODES.reports,rid);if(r)rows.push(r);}catch(e){}
    }
    if(!rows.length)return;
    box.innerHTML=`<div class="sec-t" style="margin-top:14px">আমার আগের রিপোর্ট</div>
      <div class="card pad0">${rows.map(r=>`<div class="row">
        <span class="ic">${ICON.help(18)}</span>
        <span class="tx"><b>${esc(r.type||"রিপোর্ট")}</b><small>${esc(String(r.text||"").slice(0,70))}</small>
        <small>${r.status==="resolved"?"✓ সমাধান হয়েছে":"অপেক্ষমাণ"} · ${dL(r.createdAt)}</small></span>
        <button class="btn gh sm" data-rdel="${esc(r.id)}" style="color:var(--red)">মুছুন</button></div>`).join("")}</div>`;
    box.querySelectorAll("[data-rdel]").forEach(b=>b.onclick=async()=>{
      const rid=b.dataset.rdel;
      b.disabled=true;
      try{
        await removeRow(NODES.reports,rid);
        await updatePaths({[`users/${uid}/data/reportIds/${rid}`]:null});
        toast("আপনার রিপোর্টটি মুছে ফেলা হয়েছে","ok");
        renderMyReports(s);
      }catch(e){
        b.disabled=false;
        toast("রিপোর্ট মুছে ফেলা যায়নি। আবার চেষ্টা করুন।","er");
      }
    });
  }
  
  
  function applyPrefs(){
    const p=STORE.prefs;
    
    const t=(p.theme==="dark")?"dark":"light";
    document.documentElement.dataset.theme=t;
    document.body.dataset.dense=p.dense?"1":"0";
    document.body.dataset.anim=p.anim?"1":"0";
    paintTop();
  }
  
  
  
  function needsSetup(){return !isProfileComplete(STORE.account)}
  function sheetSetup(){
    const b=dobBounds(SITE.rules.minAge,SITE.rules.maxAge);
    const s=sheet("স্বাগতম",`
      <div class="note i">${ICON.info(17)}<span>শুরু করতে আপনার নাম, মোবাইল নম্বর ও জন্ম তারিখ দিন।
        বাকি তথ্য পরে সেটিংস থেকে যোগ করতে পারবেন।</span></div>
      <form id="setupForm" novalidate>
      <div class="f"><label>আপনার পূর্ণ নাম <i>*</i></label>
        <input id="su_name" name="su_name" autocomplete="name" value="${esc(STORE.account.name||"")}"></div>
      <div class="f"><label>মোবাইল নম্বর <i>*</i></label>
        <input id="su_phone" name="su_phone" inputmode="numeric" maxlength="11" autocomplete="tel" value="${esc(STORE.account.phone||"")}">
        <span class="hint">১১ সংখ্যার বাংলাদেশি নম্বর</span></div>
      <div class="f"><label>জন্ম তারিখ <i>*</i></label>
        <input id="su_dob" name="su_dob" type="date" min="${b.min}" max="${b.max}" value="${esc(STORE.account.dob||"")}">
        <span class="hint" id="su_age_hint">জন্ম তারিখ থেকে বয়স স্বয়ংক্রিয়ভাবে হিসাব হবে।</span></div>
      <div class="f"><label>জেলা</label>
        <select id="su_district" name="su_district">
          ${DISTRICTS.map(ds=>`<option value="${esc(ds)}" ${(String(STORE.account.district||"").trim()||districtOfArea(STORE.account.area))===ds?"selected":""}>${esc(ds)}</option>`).join("")}
        </select></div>
      <div class="f"><label>থানা / এলাকা</label>
        <select id="su_area" name="su_area"><option value="">নির্বাচন করুন</option>
          ${areasForDistrict(String(STORE.account.district||"").trim()||districtOfArea(STORE.account.area)).map(a=>`<option ${a===STORE.account.area?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
      </form>`,
      `<button class="btn w" id="ok">শুরু করুন</button>`,{lock:true});
    const form=s.q("#setupForm");
    attachLiveClear(form);
    
    const suDist=s.q("#su_district");
    if(suDist)suDist.addEventListener("change",()=>fillAreaSelect(s.q("#su_area"),suDist.value,""));
    const dobInp=s.q("#su_dob"), hint=s.q("#su_age_hint");
    const paintAge=()=>{ hint.textContent = dobInp.value && isValidDob(dobInp.value)
      ? "হিসাবকৃত বয়স: "+ageText(dobInp.value)
      : "জন্ম তারিখ থেকে বয়স স্বয়ংক্রিয়ভাবে হিসাব হবে।"; };
    dobInp.addEventListener("input",paintAge); dobInp.addEventListener("change",paintAge); paintAge();
    s.q("#ok").onclick=async()=>{
      
      const v=validateForm(form,{
        su_name: {required:true,minLength:2,label:"নাম"},
        su_phone:{required:true,phone:true,label:"মোবাইল নম্বর"},
        su_dob:  {required:true,dob:{min:SITE.rules.minAge,max:SITE.rules.maxAge},label:"জন্ম তারিখ"}
      });
      if(!v.ok)return;
      const a=STORE.account;
      a.name=s.q("#su_name").value.trim();
      a.phone=s.q("#su_phone").value.trim();
      a.dob=dobInp.value;
      a.district=s.q("#su_district")?s.q("#su_district").value:"";
      a.area=s.q("#su_area").value||"";
      a.username=a.username||("user"+String(Date.now()).slice(-6));
      a.joined=a.joined||iso(now());
      await save();
      
      await pushAccountToRtdb();
      await logAct("অ্যাকাউন্ট তথ্য সংরক্ষণ",a.name,"account");
      s.close();go(CUR,SUB);toast("স্বাগতম, "+a.name.split(" ")[0]+"!","ok");
    };
  }

  
  let RTDB_UID="";
  let RTDB_PULLING=false;
  
  let donerSeenRole="";
  
  let DONOR_WITHDRAW_UID="";
  async function pushAccountToRtdb(){
    const uid=firebaseCurrentUid();
    if(!uid||uid!==RTDB_UID||RTDB_PULLING)return;
    const a=STORE.account,d=STORE.donor;
    try{
      const payload = {
        uid, name:a.name||"", username:a.username||"", email:(a.email||"").toLowerCase(),
        phone:a.phone||"", dob:a.dob||"", gender:a.gender||"", area:a.area||"",
        district:String(a.district||"").trim()||districtOfArea(a.area),
        address:a.address||"", photoURL:a.photo||"", joined:a.joined||""
      };
      
      
      if(d.is && d.status && d.status!=="none"){
        if(d.status!=="approved") payload.donorStatus = d.status;
        
        if(d.status!=="approved") payload.bloodGroup = d.bloodGroup||"";
        payload.donorId = d.donorId||"";
        
        payload.lastDonation = d.status==="approved" ? null : (d.lastDonation||"");
        payload.whatsapp = d.whatsapp||"";
        payload.health = d.health||"";
        payload.available = d.available!==false;
        payload.appliedAt = d.appliedAt||"";
        payload.cardTheme = d.cardTheme||"green";
      } else if(d.donorId){
        
        payload.donorId = d.donorId||"";
        if(d.status && d.status!=="none") payload.donorStatus = d.status;
      } else {
        
        payload.donorStatus = null;
        payload.donorId = null;
        payload.lastDonation = null;
        payload.whatsapp = null;
        payload.health = null;
        payload.available = null;
        payload.appliedAt = null;
        payload.cardTheme = null;
        payload.groupChange = null;
      }
      await updateRow(NODES.users, uid, payload);
    }catch(e){ console.warn("profile push:", e && e.message); throw e; }
  }
  
  async function pushDonorRecordToRtdb(){
    const uid=firebaseCurrentUid();
    if(!uid||uid!==RTDB_UID||RTDB_PULLING)return;
    const d=STORE.donor;
    if(!d.is||d.status!=="approved"||!d.donorId)return;
    try{
      let donor=null;
      try{ donor=await findBy(NODES.donors,"ownerUid",uid); }catch(e){}
      if(!donor){
        const all=await listOnce(NODES.donors);
        donor=all.find(x=>String(x.ownerUid||"")===String(uid)||String(x.id||"")===String(d.donorId));
      }
      const id=(donor&&donor.id)||d.donorId;
      if(!id)return;
      await updateRow(NODES.donors, id, donorPublicPatch(STORE.account,STORE.donor));
    }catch(e){ console.warn("donor public push:", e && e.message); throw e; }
  }
  
  async function pushMyDataToRtdb(){
    const uid=firebaseCurrentUid();
    if(!uid||uid!==RTDB_UID||RTDB_PULLING)return;
    try{
      
      await updatePaths({
        [`users/${uid}/data/donations`]:RAW.donations||[],
        [`users/${uid}/data/mine`]:RAW.mine||[],
        [`users/${uid}/data/activity` ]:(RAW.activity||[]).slice(0,100)
      });
    }catch(e){ console.warn("data push:", e && e.message); throw e; }
  }
  const APPLICATION_TERMINAL_STATUS=new Set(["rejected","cancelled","done","resolved","expired"]);

  function applicationRows(value){
    if(Array.isArray(value))return value.map((row,i)=>row&&typeof row==="object"?{...row,id:row.id||row.requestId||String(i)}:null).filter(Boolean);
    if(value&&typeof value==="object")return Object.entries(value).map(([id,row])=>
      row&&typeof row==="object"?{...row,id:row.id||row.requestId||id}:null).filter(Boolean);
    return [];
  }
  function applicationStatus(row){
    const status=String(row&&row.status||"").trim().toLowerCase();
    const workflow=String(row&&row.workflowStatus||"").trim().toLowerCase();
    const canonical=value=>{
      if(value==="cancelled"||value==="canceled")return "cancelled";
      if(value==="rejected")return "rejected";
      if(value==="resolved"||value==="completed")return "resolved";
      if(value==="done")return "done";
      if(value==="expired")return "expired";
      if(value==="matched")return "matched";
      if(value==="approved"||value==="searching"||value==="active")return "approved";
      if(value==="pending"||value==="waiting")return "pending";
      return "";
    };
    
    return canonical(workflow)||canonical(status)||"pending";
  }
  function applicationHasExpired(row){
    const raw=String(row&&row.expiresAt||row&&row.neededBy||"").trim();
    if(!raw)return false;
    const value=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+"T23:59:59":raw;
    const time=Date.parse(value);
    return Number.isFinite(time)&&time<Date.now();
  }
  function normalizeApplication(row){
    const r=row&&typeof row==="object"?row:{};
    const responders=Array.isArray(r.responders)
      ?r.responders
      :(r.responders&&typeof r.responders==="object"?Object.values(r.responders):[]);
    const responderCount=Array.isArray(r.responders)
      ?responders.length
      :Number(r.responders)||Number(r.responderCount)||0;
    const expires=String(r.neededBy||r.expiresAt||"");
    const status=applicationStatus(r);
    return {
      ...r,
      id:String(r.id||r.requestId||""),
      patient:r.patient||r.patientName||"",
      group:r.group||r.bloodGroup||"",
      bags:Number(r.bags||r.units||1)||1,
      urgency:r.urgency||"",
      hospital:r.hospital||r.hospitalName||"",
      address:r.address||r.hospitalAddress||r.area||"",
      area:r.area||r.hospitalAddress||r.address||"",
      neededBy:expires.slice(0,10),
      createdAt:r.createdAt||r.at||"",
      
      status:!APPLICATION_TERMINAL_STATUS.has(status)&&applicationHasExpired(r)?"expired":status,
      responders,
      responderCount,
      rejectNote:r.rejectNote||r.rejectionReason||""
    };
  }
  function mergeApplicationStatus(userRow,requestRow){
    const us=userRow&&userRow.status, rs=requestRow&&requestRow.status;
    if(!userRow)return rs;
    if(!requestRow)return us;
    
    if(APPLICATION_TERMINAL_STATUS.has(us))return us;
    if(APPLICATION_TERMINAL_STATUS.has(rs))return rs;
    if(rs==="pending"&&us!=="pending")return us;
    return rs!=="pending"?rs:us;
  }
  let MY_APPLICATION_COUNT_PROMISE=null;
  let MY_APPLICATION_COUNT_PROMISE_UID="";
  function knownApplicationCount(){
    const ids=new Set();
    [...MY_APPLICATION_USER_ROWS,...MY_APPLICATION_REQUEST_ROWS].forEach(row=>{
      const id=String(row&& (row.id||row.requestId)||"").trim();
      if(id)ids.add(id);
    });
    return ids.size;
  }
  function syncApplicationCount(){
    const uid=firebaseCurrentUid();
    if(!uid||uid!==MY_APPLICATION_UID)return Promise.resolve(0);
    if(MY_APPLICATION_COUNT_PROMISE&&MY_APPLICATION_COUNT_PROMISE_UID===uid)return MY_APPLICATION_COUNT_PROMISE;
    const minimum=knownApplicationCount();
    const work=ensureFieldAtLeast(NODES.users,uid,"applicationCount",minimum)
      .then(count=>{
        if(Number(count)<minimum)throw new Error("application count was not persisted");
        if(firebaseCurrentUid()===uid){
          STORE.account.applicationCount=Math.max(Number(STORE.account.applicationCount)||0,Number(count)||0);
          MY_APPLICATION_COUNT_READY=true;
          persistLocalAccount();
          if(CUR==="req"&&!document.querySelector(".sheet"))rReq();
        }
        return count;
      })
      .catch(error=>{console.warn("application count:",error&&error.message);return null;});
    const promise=work.finally(()=>{
      if(MY_APPLICATION_COUNT_PROMISE===promise){MY_APPLICATION_COUNT_PROMISE=null;MY_APPLICATION_COUNT_PROMISE_UID="";}
    });
    MY_APPLICATION_COUNT_PROMISE=promise;
    MY_APPLICATION_COUNT_PROMISE_UID=uid;
    return promise;
  }
  async function incrementApplicationCount(){
    const uid=firebaseCurrentUid();
    if(!uid||uid!==MY_APPLICATION_UID)return;
    try{
      const count=await incrementField(NODES.users,uid,"applicationCount",1);
      if(firebaseCurrentUid()===uid){
        STORE.account.applicationCount=Math.max(Number(STORE.account.applicationCount)||0,Number(count)||0);
        MY_APPLICATION_COUNT_READY=true;
        persistLocalAccount();
        if(CUR==="req"&&!document.querySelector(".sheet"))rReq();
      }
    }catch(error){console.warn("application count increment:",error&&error.message)}
  }
  async function purgeExpiredApplications(){
    if(MY_APPLICATION_CLEANUP)return;
    const uid=firebaseCurrentUid();
    if(!uid||uid!==MY_APPLICATION_UID||!MY_APPLICATION_USER_READY)return;
    const expired=RAW.mine.filter(row=>row&&(row.status==="expired"||applicationHasExpired(row)));
    if(!expired.length)return;
    MY_APPLICATION_CLEANUP=true;
    const previousMine=RAW.mine.slice(),previousUserRows=MY_APPLICATION_USER_ROWS.slice(),previousRequestRows=MY_APPLICATION_REQUEST_ROWS.slice();
    try{
      
      await syncApplicationCount();
      const count=await syncApplicationCount();
      if(count===null)throw new Error("historical application count could not be saved");
      const ids=new Set(expired.map(row=>String(row.id)));
      RAW.mine=RAW.mine.filter(row=>!ids.has(String(row&&row.id||"")));
      MY_APPLICATION_USER_ROWS=MY_APPLICATION_USER_ROWS.filter(row=>!ids.has(String(row&&row.id||"")));
      const requestIds=MY_APPLICATION_REQUEST_ROWS.filter(row=>ids.has(String(row&&row.id||""))).map(row=>String(row.id));
      MY_APPLICATION_REQUEST_ROWS=MY_APPLICATION_REQUEST_ROWS.filter(row=>!ids.has(String(row&&row.id||"")));
      mergeMyApplications();
      const paths={[`users/${uid}/data/mine`]:MY_APPLICATION_USER_ROWS};
      ids.forEach(id=>{paths[`queue/${id}`]=null});
      requestIds.forEach(id=>{paths[`requests/${id}`]=null});
      await updatePaths(paths);
    }catch(error){
      RAW.mine=previousMine;MY_APPLICATION_USER_ROWS=previousUserRows;MY_APPLICATION_REQUEST_ROWS=previousRequestRows;
      mergeMyApplications();
      console.warn("expired application cleanup:",error&&error.message);
    }finally{MY_APPLICATION_CLEANUP=false}
  }
  function mergeMyApplications(){
    const byId=new Map();
    MY_APPLICATION_REQUEST_ROWS.map(normalizeApplication).forEach(row=>{
      if(row.id)byId.set(row.id,row);
    });
    MY_APPLICATION_USER_ROWS.map(normalizeApplication).forEach(userRow=>{
      if(!userRow.id)return;
      const requestRow=byId.get(userRow.id);
      if(!requestRow){byId.set(userRow.id,userRow);return;}
      const merged={...requestRow};
      
      ["patient","group","bags","urgency","hospital","address","area","neededBy","createdAt","rejectNote"].forEach(key=>{
        if(userRow[key]!==undefined&&userRow[key]!==null&&userRow[key]!=="")merged[key]=userRow[key];
      });
      if(userRow.responders.length)merged.responders=userRow.responders;
      merged.responderCount=Math.max(requestRow.responderCount||0,userRow.responderCount||0,merged.responders.length||0);
      merged.status=mergeApplicationStatus(userRow,requestRow);
      byId.set(userRow.id,merged);
    });
    RAW.mine=[...byId.values()].sort((a,b)=>{
      const bt=Date.parse(b.createdAt||"")||0,at=Date.parse(a.createdAt||"")||0;
      return bt-at;
    });
    try{localStorage.setItem(LS_DATA,JSON.stringify(RAW))}catch(e){}
    if(CUR==="req"&&!document.querySelector(".sheet"))rReq();
  }
  function beginMyApplications(uid){
    uid=String(uid||"").trim();
    if(MY_APPLICATION_UID===uid)return;
    MY_APPLICATION_UID=uid;
    MY_APPLICATION_COUNT_READY=false;
    STORE.account.applicationCount=0;
    MY_APPLICATION_USER_READY=false;
    MY_APPLICATION_REQUESTS_READY=false;
    MY_APPLICATION_USER_ROWS=[];
    MY_APPLICATION_REQUEST_ROWS=[];
    
    RAW.mine=[];
  }
  function setMyApplicationsFromUser(uid,row){
    if(String(uid||"")!==MY_APPLICATION_UID)return;
    MY_APPLICATION_USER_ROWS=applicationRows(row&&row.data&&row.data.mine);
    MY_APPLICATION_USER_READY=true;
    mergeMyApplications();
    void syncApplicationCount();
    void purgeExpiredApplications();
  }
  function watchMyApplications(uid){
    if(!uid)return;
    stopMyApplicationRequests();
    MY_APPLICATION_REQUESTS_READY=false;
    stopMyApplicationRequests=watchList(NODES.requests,rows=>{
      if(String(uid)!==String(firebaseCurrentUid()))return;
      MY_APPLICATION_REQUEST_ROWS=rows.filter(row=>{
        const owner=String(row&& (row.ownerUid||row.uid||row.userId||row.requesterUid)||"").trim();
        return owner===String(uid);
      });
      MY_APPLICATION_REQUESTS_READY=true;
      mergeMyApplications();
      void syncApplicationCount();
      void purgeExpiredApplications();
    });
  }
  function myApplicationsAreLoading(){
    
    return !AUTH_SESSION_READY||!!MY_APPLICATION_UID&&!MY_APPLICATION_USER_READY;
  }
  function firebaseCurrentUid(){
    try{
      const shared=initSharedFirebase();
      return String(shared&&shared.auth&&shared.auth.currentUser&&shared.auth.currentUser.uid||"").trim();
    }catch(e){return ""}
  }

  function applyRtdbRow(uid, row, authUser){
    const a=STORE.account;
    a.uid=uid;
    if(!row){
      
      if(authUser && authUser.email) a.email = a.email || authUser.email;
      if(!a.photo && authUser && authUser.photoURL){
        a.photo = authUser.photoURL;
        a.photoSource = "google";
      }
      return;
    }
    a.name=row.name||a.name; a.username=row.username||a.username;
    a.email=row.email||a.email; a.phone=row.phone||a.phone;
    a.dob=row.dob||a.dob; a.gender=row.gender||a.gender;
    a.area=row.area||a.area; a.address=row.address||a.address;
    
    a.photo = photoForUid(row, (authUser && authUser.photoURL) || "");
    if(a.photo && row.photoURL) a.photoSource = row.photoSource || a.photoSource || "upload";
    else if(a.photo && !row.photoURL) a.photoSource = "google";
    else a.photoSource = "none";
    if(row.joined)a.joined=row.joined;
    if(row.applicationCount!==undefined&&Number.isFinite(Number(row.applicationCount))){
      a.applicationCount=Math.max(0,Number(row.applicationCount));
      MY_APPLICATION_COUNT_READY=true;
    }
    
    
    
    
    const accountGroup=bloodGroupFromAccountRow(row);
    a.bloodGroup=validBloodGroup(accountGroup)?accountGroup:"";
    
    const _bg = accountGroup;
    
    const _dStatusRaw = String(row.donorStatus || "").trim().toLowerCase();
    const _accountStatus = String(row.status || "").trim().toLowerCase();
    const _knownDonorStatuses = ["pending", "approved", "rejected", "none"];
    const _dStatus = _knownDonorStatuses.includes(_dStatusRaw)
      ? _dStatusRaw
      : (_knownDonorStatuses.includes(_accountStatus) ? _accountStatus : "");
    
    const _dId = _dStatus==="approved" ? (row.donorId || row.donorID || "") : "";
    const _last = row.lastDonation || row.lastDonationDate || row.last || "";
    const _wa = row.whatsapp || row.whatsApp || "";
    const _health = row.health || row.healthNotes || "";
    
    const _hasDonorInfo = !!(_bg || _dId || (_dStatus && _dStatus!=="none"));
    if(_bg) STORE.donor.bloodGroup=_bg;
    if(_dId) STORE.donor.donorId=_dId;
    else if(_dStatus && _dStatus!=="approved") STORE.donor.donorId="";
    if(!_hasDonorInfo){
      
      STORE.donor.is=false; STORE.donor.status="none";
      STORE.donor.donorId=""; STORE.donor.bloodGroup="";
      STORE.donor.whatsapp=""; STORE.donor.lastDonation="";
      STORE.donor.health=""; STORE.donor.appliedAt="";
      STORE.donor.available=true;
    } else if(_dStatus==="rejected"||_dStatus==="none"){
      
      STORE.donor.status=_dStatus;
      if(_dStatus==="none")STORE.donor.is=false;
    }
    
    if(!(STORE.donor.is && STORE.donor.status==="approved") && _last !== undefined && _last !== null) STORE.donor.lastDonation = String(_last||"");
    if(_wa !== undefined && _wa !== null) STORE.donor.whatsapp = String(_wa||"");
    if(_health !== undefined && _health !== null) STORE.donor.health = String(_health||"");
    if(row.available !== undefined) STORE.donor.available = !!row.available;
    if(row.appliedAt) STORE.donor.appliedAt = String(row.appliedAt||"");
    if(row.cardTheme) STORE.donor.cardTheme = String(row.cardTheme||"green");
    
    STORE.donor.groupChange = row.groupChange && typeof row.groupChange==="object" ? {...row.groupChange} : null;
    
    STORE.donor.donorRejectNote = String(row.donorRejectNote||"").trim();
    if(STORE.donor.groupChange&&STORE.donor.groupChange.status==="approved"&&STORE.donor.groupChange.to){
      STORE.donor.bloodGroup=String(STORE.donor.groupChange.to);
    }
    if(row.data&&typeof row.data==="object"){
      
      ["donations","activity"].forEach(k=>{ if(Array.isArray(row.data[k]))RAW[k]=row.data[k]; });
      if(row.data.verifiedDonations&&typeof row.data.verifiedDonations==="object"&&!Array.isArray(row.data.verifiedDonations))
        RAW.verifiedDonations=row.data.verifiedDonations;
      if(row.data.donationNotes&&typeof row.data.donationNotes==="object"&&!Array.isArray(row.data.donationNotes))
        RAW.donationNotes=row.data.donationNotes;
      const reads=row.data.noticeReads;
      STORE.noticeReads=reads&&typeof reads==="object"?Object.fromEntries(Object.entries(reads).filter(([,v])=>v===true)):{};
      try{localStorage.setItem(LS_DATA,JSON.stringify(RAW))}catch(e){}
    }
  }
  function persistLocalAccount(){
    try{localStorage.setItem(LS,JSON.stringify({account:STORE.account,donor:STORE.donor,
      privacy:STORE.privacy,notif:STORE.notif,prefs:STORE.prefs,security:STORE.security,saved:STORE.saved}))}catch(e){}
  }
  
  async function hydrateDonorFromRtdb(uid){
    if(!uid || STORE.donor.is) return false;
    
    if(DONOR_WITHDRAW_UID)return false;
    try{
      const accountEmail = String(STORE.account.email || "").trim().toLowerCase();
      const accountPhone = String(STORE.account.phone || "").replace(/\s+/g, "");
      const legacyOwner = row => (!!accountEmail && String(row.email || "").trim().toLowerCase() === accountEmail)
        || (!!accountPhone && String(row.phone || "").replace(/\s+/g, "") === accountPhone);
      
      let donor = null;
      try{
        donor = await findBy(NODES.donors, "ownerUid", uid);
        if(!donor){
          const all = await listOnce(NODES.donors);
          donor = all.find(d=> String(d.ownerUid)===String(uid) || String(d.uid)===String(uid) || legacyOwner(d));
        }
      }catch(e){}
      if(donor){
        STORE.donor.is=true; STORE.donor.status="approved";
        STORE.donor.donorId = donor.id || donor.donorId || STORE.donor.donorId || "";
        STORE.donor.bloodGroup = donor.bloodGroup || donor.group || STORE.donor.bloodGroup;
        STORE.donor.totalDonations = Math.max(0,Number(donor.totalDonations ?? donor.donations ?? 0))||0;
        STORE.donor.totalBags = Math.max(0,Number(donor.totalBags ?? 0))||0;
        if(donor.lastDonationDate) STORE.donor.lastDonation = donor.lastDonationDate;
        else if(donor.lastDonation) STORE.donor.lastDonation = donor.lastDonation;
        else if(donor.last) STORE.donor.lastDonation = donor.last;
        if(donor.whatsapp) STORE.donor.whatsapp = donor.whatsapp;
        if(donor.health) STORE.donor.health = donor.health;
        if(donor.healthNotes) STORE.donor.health = donor.healthNotes;
        try{ persistLocalAccount(); }catch(e){}
        try{ await pushAccountToRtdb(); }catch(e){}
        startDonorRecListener();
        return true;
      }
      
      let member = null;
      try{
        member = await findBy(NODES.members, "uid", uid);
        if(!member){
          const allM = await listOnce(NODES.members);
          member = allM.find(m=> String(m.uid)===String(uid) || String(m.ownerUid)===String(uid) || legacyOwner(m));
        }
      }catch(e){}
      if(member){
        const st = String(member.status||member.donorStatus||"").trim().toLowerCase();
        
        if(st==="pending"||st==="approved"||st==="rejected"){
        STORE.donor.is=true;
        STORE.donor.status = st==="approved" ? "approved" : st==="rejected" ? "rejected" : "pending";
        STORE.donor.totalDonations = Math.max(0,Number(member.totalDonations ?? member.donations ?? 0))||0;
        STORE.donor.totalBags = Math.max(0,Number(member.totalBags ?? 0))||0;
        
        STORE.donor.donorId = st==="approved" ? (member.donorId || member.id || STORE.donor.donorId || "") : "";
        STORE.donor.bloodGroup = member.bloodGroup || member.group || STORE.donor.bloodGroup;
        if(member.lastDonationDate) STORE.donor.lastDonation = member.lastDonationDate;
        else if(member.lastDonation) STORE.donor.lastDonation = member.lastDonation;
        else if(member.last) STORE.donor.lastDonation = member.last;
        if(member.whatsapp) STORE.donor.whatsapp = member.whatsapp;
        if(member.healthNotes) STORE.donor.health = member.healthNotes;
        else if(member.health) STORE.donor.health = member.health;
        try{ persistLocalAccount(); }catch(e){}
        try{ await pushAccountToRtdb(); }catch(e){}
        return true;
        }
        
      }
      
      if(DONOR_WITHDRAW_UID)return false;
      try{
        const allQ = await listOnce(NODES.queue);
        const q = allQ.find(x=> x.kind==="donor" && (String(x.ownerUid)===String(uid) || String(x.uid)===String(uid) || legacyOwner(x))) || allQ.find(x=> String(x.uid)===String(uid) && x.group);
        if(q){
          STORE.donor.is=true; STORE.donor.status="pending";
          
          STORE.donor.donorId = "";
          STORE.donor.bloodGroup = q.group || q.bloodGroup || STORE.donor.bloodGroup;
          STORE.donor.totalDonations = 0;
          STORE.donor.totalBags = 0;
          if(q.last) STORE.donor.lastDonation = q.last;
          else if(q.lastDonation) STORE.donor.lastDonation = q.lastDonation;
          if(q.whatsapp) STORE.donor.whatsapp = q.whatsapp;
          if(q.health) STORE.donor.health = q.health;
          try{ persistLocalAccount(); }catch(e){}
          try{ await pushAccountToRtdb(); }catch(e){}
          return true;
        }
      }catch(e){}
    }catch(e){ console.warn("hydrateDonor:", e && e.message); }
    return false;
  }
  function maybeShowSetup(){
    if(PUBLIC_MODE) return;
    if(!needsSetup()) return;
    if(document.querySelector(".sheet")) return;
    setTimeout(sheetSetup, 200);
  }
  function startDonorRecListener(){
    stopDonorRecListener();
    const id=String(STORE.donor.donorId||"").trim();
    if(!id||STORE.donor.status!=="approved")return;
    
    stopDonorRecListener=watchRow(NODES.donors,id,row=>{
      if(!row)return;
      STORE.donor.totalDonations=Math.max(0,Number(row.totalDonations??row.donations??0))||0;
      STORE.donor.totalBags=Math.max(0,Number(row.totalBags??0))||0;
      if(row.lastDonationDate)STORE.donor.lastDonation=row.lastDonationDate;
      else if(row.lastDonation)STORE.donor.lastDonation=row.lastDonation;
      else if(row.last)STORE.donor.lastDonation=row.last;
      
      if(row.bloodGroup||row.group)STORE.donor.bloodGroup=String(row.bloodGroup||row.group||"");
      if(row.whatsapp!==undefined&&row.whatsapp!==null)STORE.donor.whatsapp=String(row.whatsapp||"");
      if(row.health!==undefined&&row.health!==null)STORE.donor.health=String(row.health||"");
      if(row.available!==undefined)STORE.donor.available=!!row.available;
      persistLocalAccount();
      if(!PUBLIC_MODE){try{paintTop();go(CUR,SUB,false);}catch(e){console.warn("donor rec refresh",e)}}
    });
  }
  function watchMyProfile(uid, authUser){
    if(!uid)return;
    RTDB_UID=uid;
    beginMyApplications(uid);
    watchMyApplications(uid);
    stopMyProfileListener();
    stopNoticeReads();
    stopNoticeReads=watchNoticeReads(uid,reads=>{
      if(String(uid)!==String(firebaseCurrentUid()))return;
      STORE.noticeReads=reads||{};
      paintTop();
      if(npOpen)renderNotifPanel();
    });
    stopMyProfileListener=watchRow(NODES.users, uid, async (row)=>{
      
      if(String(uid)!==String(firebaseCurrentUid()))return;
      
      const rowRole = String((row && row.role) || "").toLowerCase();
      if ((rowRole === "admin" || rowRole === "moderator" || rowRole === "mod") && rowRole !== donerSeenRole) {
        donerSeenRole = rowRole;
        try{ toast("আপনার ভূমিকা হালনাগাদ হয়েছে — প্যানেল খোলা হচ্ছে","ok"); }catch(e){}
        setTimeout(()=>navigateToPage(rowRole === "admin" ? "admin" : "moderator"), 500);
        return;
      }
      if (rowRole === "donor" || rowRole === "user" || rowRole === "") donerSeenRole = rowRole;
      RTDB_PULLING=true;
      applyRtdbRow(uid, row, authUser);
      setMyApplicationsFromUser(uid,row);
      
      if(!STORE.donor.is){
        try{ await hydrateDonorFromRtdb(uid); }catch(e){ console.warn("hydrate in watch:", e && e.message); }
      }
      startDonorRecListener();
      try{ pullSharedPublic(); }catch(e){ console.warn("resync personal data:", e && e.message); }
      persistLocalAccount();
      RTDB_PULLING=false;
      
      try{ refreshGroupChangeSheet(); }catch(e){}
      if(!document.querySelector(".sheet")&&!PUBLIC_MODE){ try{ paintTop(); go(CUR,SUB,false); }catch(e){} }
    });
    
    if(!myApplicationNotifUnsubscribe)myApplicationNotifUnsubscribe=notifSubscribe(()=>{
      paintTop();
      if(npOpen)renderNotifPanel();
    });
  }

  
  const RENDER={home:rHome,find:rFind,req:rReq,become:rBecome,set:rSet};
  
  
  (async function syncAuthSession(){
    try{
      initSharedFirebase();
      const {subscribeAuthUser} = await import("../lib/authState");
      let authUid = STORE.account.uid || "";
      
      let bootedUid="";
      subscribeAuthUser(async (user)=>{
        if(PUBLIC_MODE)return;
        AUTH_SESSION_READY=true;
        if(user && bootedUid===user.uid)return;
        bootedUid=user.uid||"";
        if(!user){
          authUid="";
          stopMyApplicationRequests();
          stopMyProfileListener();
          stopNoticeReads();
          MY_APPLICATION_UID="";
          MY_APPLICATION_COUNT_READY=false;
          STORE.account.applicationCount=0;
          MY_APPLICATION_USER_READY=false;
          MY_APPLICATION_REQUESTS_READY=false;
          MY_APPLICATION_USER_ROWS=[];
          MY_APPLICATION_REQUEST_ROWS=[];
          RAW.mine=[];
          setTimeout(()=>{navigateToPage("home")},400);
          return;
        }
        
        if(authUid && authUid !== user.uid){
          stopMyApplicationRequests();
          stopMyProfileListener();
          stopNoticeReads();
          resetUserCache();
          if(!PUBLIC_MODE){ try{ paintTop(); go(CUR,SUB,false); }catch(e){} }
        }
        
        beginMyApplications(user.uid);
        authUid = user.uid;
        
        
        let row = null;
        try{ row = await loadUserProfile(user.uid); }catch(e){}
        
        donerSeenRole = String((row && row.role) || "").toLowerCase();
        try{
          const r = await resolveUserRole({uid:user.uid, email:user.email||"", name:user.displayName||""},{knownProfile:row});
          const page = panelForRole(r.role);
          if(page!=="doner"){ navigateToPage(page); return; }
        }catch(e){ console.warn("doner role gate:", e && e.message); }

        STORE.account.uid = user.uid;
        if(user.email) STORE.account.email = STORE.account.email || user.email;
        STORE.account.emailVerified = user.emailVerified !== false;
        

        applyRtdbRow(user.uid, row, user);
        setMyApplicationsFromUser(user.uid,row);
        
        if(!STORE.donor.is){
          try{ await hydrateDonorFromRtdb(user.uid); }catch(e){ console.warn("hydrate on login:", e && e.message); }
        }
        try{save()}catch(e){}
        watchMyProfile(user.uid, user);
        
        maybeShowSetup();
      });
    }catch(e){ console.warn("doner auth sync:", e && e.message); }
  })();
  try{
    if(localStorage.getItem("cbdcMember")==="1"){
      const memberUid = localStorage.getItem("cbdcMemberUid") || "";
      
      if(memberUid && (!STORE.account.uid || STORE.account.uid === memberUid)){
        STORE.account.uid = STORE.account.uid || memberUid;
        STORE.account.name = STORE.account.name || localStorage.getItem("cbdcMemberName") || "";
        STORE.account.email = STORE.account.email || localStorage.getItem("cbdcMemberEmail") || "";
        STORE.account.username = STORE.account.username || localStorage.getItem("cbdcMemberUsername") || "";
        if(STORE.account.uid === memberUid){
          STORE.account.photo = STORE.account.photo || localStorage.getItem("cbdcMemberPhoto") || "";
        }
        persistLocalAccount();
      }
    }
  }catch(e){}
  applyPrefs();
  applyLogo(document);
  document.documentElement.lang="bn";
  document.body.dataset.lang=STORE.prefs.lang;
  paintNav();
  if(!bootPublicProfile()){
    const [h0,h1]=(panelSubPath("doner")||location.hash.replace("#","")).split("/");
    go(RENDER[h0]?h0:"home",h1||null,false);
  }
  
  
  Object.assign(window,{DB,STORE,go,save,toast,openProfile,profileView,
    applyLang,renderSub,donorReady,getCUR:()=>CUR,getSUB:()=>SUB});
  
  if(window.CBDCShared)CBDCShared.subscribe((st,meta)=>{
    if(meta&&meta.source==="doner:personal")return;
    pullSharedPublic();
    if(PUBLIC_MODE){
      
      try{
        const uid=new URLSearchParams(location.search).get("uid");
        if(!uid)return;
        const d=resolveUid(uid);
        if(d){
          if(!DB().donors.some(x=>x.uid===d.uid))DB().donors.push(d);
          profId=d.uid;
        }else{
          profId="__missing__";
        }
        renderSub("profile");
      }catch(e){}
      return;
    }
    
    try{ refreshGroupChangeSheet(); }catch(e){}
    if(!document.querySelector(".sheet"))go(CUR,SUB,false);
  });
  
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){
    document.querySelector(".ov")?.click();}});
  
  setInterval(()=>{
    if(PUBLIC_MODE||CUR!=="home"||document.querySelector(".sheet"))return;
    try{rHome()}catch(e){}
  },15*1000);
  
  setInterval(()=>{ try{ pruneExpired(); }catch(e){} }, 30*60*1000);
  
  setInterval(()=>{ try{ void purgeExpiredApplications(); }catch(e){} },60*1000);
  
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


export function donorPublicPatch(
  account: Record<string, any> | null | undefined,
  donor: Record<string, any> | null | undefined
): Record<string, string | boolean> {
  const a = account || {};
  const d = donor || {};
  return {
    name: String(a.name || ""),
    gender: String(a.gender || ""),
    dob: String(a.dob || ""),
    area: String(a.area || ""),
    phone: String(a.phone || ""),
    
    
    whatsapp: String(d.whatsapp || ""),
    available: d.available !== false,
    photo: String(a.photo || ""),
  };
}
