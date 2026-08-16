// @ts-nocheck — এই ফাইলটি মূল HTML-এর JavaScript-এর verbatim (হুবহু) port।
// রূপান্তরের সময় runtime আচরণ ১০০% অপরিবর্তিত রাখাই লক্ষ্য; তাই legacy logic-কে
// TypeScript টাইপ-চেকিং থেকে মুক্ত রাখা হয়েছে। React shell ও shared store সম্পূর্ণ
// typed (src/lib/store.ts ও src/lib/firebase.ts দেখুন)।
/**
 * Home.tsx
 * React + TypeScript port of index.html — পাবলিক ওয়েবসাইট + লগইন (ডোনার সার্চ, নিবন্ধন, ইমারজেন্সি আবেদন, গ্যালারি)।
 */
import { useEffect } from "react";
import "../lib/store";
import { initFirebase as initSharedFirebase, isFirebaseReady } from "../lib/firebase";
import { navigateToPage, pagePath, appBase } from "../lib/router";
import {
  authErrorMessage,
  googleSignInWithFallback,
  consumeGoogleRedirect,
  ensureUserProfile,
  onAuthUserChanged,
  setGoogleIntent,
} from "../lib/authx";
import SITE from "../config/site";

/* ═══════════════════════════════════════════════════════════════════
   CSS — মূল index.html-এর <style> ব্লক হুবহু কপি
   ═══════════════════════════════════════════════════════════════════ */
const pageCss = `    @font-face {
      font-family: 'SolaimanLipi';
      font-display: swap;
      font-style: normal;
      font-weight: 400;
      src: url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-normal-v1.0.woff2') format('woff2'),
           url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-normal-v1.0.ttf') format('truetype');
    }
    @font-face {
      font-family: 'SolaimanLipi';
      font-display: swap;
      font-style: normal;
      font-weight: 700;
      src: url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.woff2') format('woff2'),
           url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
    }
    @font-face {
      font-family: 'SolaimanLipi';
      font-display: swap;
      font-style: normal;
      font-weight: 800;
      src: url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.woff2') format('woff2'),
           url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
    }
    @font-face {
      font-family: 'SolaimanLipi';
      font-display: swap;
      font-style: normal;
      font-weight: 900;
      src: url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.woff2') format('woff2'),
           url('https://fonts.maateen.me/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
    }

    :root{--red:#e51f2a;--red-dark:#b5121b;--red-soft:#fff0f1;--green:#087a4b;--green-dark:#064f37;--green-soft:#e9f8f1;--navy:#102b2a;--ink:#172624;--muted:#65736f;--line:#e3ebe7;--cream:#fbfcfa;--white:#fff;--gold:#eab447;--shadow:0 18px 55px rgba(15,52,43,.11);--shadow-sm:0 8px 22px rgba(15,52,43,.08);--radius:22px;--container:1160px}
    *{box-sizing:border-box}html{scroll-behavior:smooth;overflow-x:hidden;overflow-x:clip}body{margin:0;overflow-x:hidden;overflow-x:clip;color:var(--ink);background:var(--cream);font-family:"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.75;-webkit-font-smoothing:antialiased}body.lock{overflow:hidden}a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}button{cursor:pointer}img{max-width:100%;display:block}::selection{background:var(--red);color:#fff}.container{width:min(var(--container),calc(100% - 40px));margin:auto}.narrow{width:min(850px,calc(100% - 40px));margin:auto}.view{display:none}.view.active{display:block}.hidden{display:none!important}.muted{color:var(--muted)}
    /* Header */
    .site-header{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.98);border-bottom:1px solid rgba(16,43,42,.08);box-shadow:0 2px 12px rgba(15,52,43,.05)}.nav-shell{position:relative;min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:11px;min-width:0}.logo{width:51px;height:51px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 7px 18px rgba(4,88,55,.2);flex:0 0 auto}.brand-text{min-width:0}.brand-text strong{display:block;color:var(--green-dark);font-size:1rem;line-height:1.2;white-space:nowrap}.brand-text small{display:block;color:var(--muted);font-size:.72rem;line-height:1.3;margin-top:3px}.nav{display:flex;align-items:center;gap:2px}.nav a{display:inline-flex;align-items:center;justify-content:center;min-height:41px;padding:8px 11px;border-radius:10px;color:#3e4d49;font-size:.84rem;font-weight:800;transition:.2s}.nav a:hover,.nav a.active{color:var(--red);background:var(--red-soft)}.menu-btn{display:none;width:44px;height:44px;border:1px solid #d4dfdb;border-radius:12px;color:var(--green-dark);background:#fff;font-size:1.5rem;font-weight:800;line-height:1;cursor:pointer;transition:all .2s ease;box-shadow:0 2px 8px rgba(15,52,43,.04)}
.menu-btn:hover{background:var(--green-soft);border-color:#bfe0cd}
.menu-btn[aria-expanded="true"]{background:var(--green-soft);border-color:#bfe0cd;color:var(--green-dark)}
.nav-head{display:none}
.nav-overlay{display:none}
/* body.nav-lock removed to prevent scroll jumping */
    /* Shared */
    .eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--red);font-size:.77rem;font-weight:900;letter-spacing:.04em}.eyebrow:before{content:"";width:23px;height:3px;border-radius:8px;background:var(--red)}.section{padding:82px 0}.section.alt{background:#fff}.heading{max-width:720px;margin-bottom:30px}.heading.center{margin-inline:auto;text-align:center}.heading h2{margin:9px 0 9px;color:var(--navy);font-size:clamp(1.8rem,3.5vw,2.7rem);line-height:1.25;letter-spacing:-.035em}.heading p{margin:0;color:var(--muted)}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:45px;padding:9px 17px;border:1px solid transparent;border-radius:11px;font-size:.88rem;font-weight:900;transition:.2s}.btn:hover{transform:translateY(-2px)}.btn-red{color:#fff;background:var(--red);box-shadow:0 10px 22px rgba(229,31,42,.18)}.btn-red:hover{color:#fff;background:var(--red-dark)}.btn-green{color:#fff;background:var(--green);box-shadow:0 10px 22px rgba(8,122,75,.18)}.btn-green:hover{color:#fff;background:var(--green-dark)}.btn-outline{color:var(--green-dark);background:#fff;border-color:#cbd9d4}.btn-outline:hover{border-color:var(--green);background:var(--green-soft)}.btn-light{color:var(--red-dark);background:#fff;border-color:#fff}.btn-sm{min-height:34px;padding:6px 10px;border-radius:9px;font-size:.75rem}.btn-danger{color:#a20e18;background:var(--red-soft);border-color:#ffd0d3}
    /* Hero */
    .hero{position:relative;overflow:hidden;color:#fff;padding:72px 0 78px;background:radial-gradient(circle at 92% 10%,rgba(229,31,42,.38),transparent 34%),radial-gradient(circle at 0 100%,rgba(11,151,96,.25),transparent 35%),linear-gradient(135deg,#073b2c,#075a3e 48%,#0a7950)}.hero:after{content:"";position:absolute;width:430px;height:430px;right:-130px;bottom:-210px;border:1px solid rgba(255,255,255,.1);border-radius:50%;box-shadow:0 0 0 40px rgba(255,255,255,.025),0 0 0 80px rgba(255,255,255,.02)}.hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:.9fr 1.1fr;align-items:center;gap:clamp(36px,7vw,90px)}.hero-visual{position:relative;display:grid;place-items:center;min-height:390px}.hero-logo-wrap{position:relative;padding:17px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);box-shadow:0 28px 70px rgba(0,0,0,.2)}.hero-logo{width:clamp(240px,28vw,370px);aspect-ratio:1;border-radius:50%;object-fit:cover;border:10px solid #fff;box-shadow:0 0 0 8px rgba(255,255,255,.14)}.hero-badge{position:absolute;right:-16px;top:36px;display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:99px;background:#fff;color:var(--green-dark);box-shadow:var(--shadow);font-size:.75rem;font-weight:900}.hero-badge:before{content:"✓";display:grid;place-items:center;width:21px;height:21px;border-radius:50%;color:#fff;background:var(--green)}.hero-float{position:absolute;bottom:24px;left:-3px;padding:10px 14px;border-radius:14px;background:rgba(12,42,34,.78);border:1px solid rgba(255,255,255,.2);font-size:.78rem}.hero-kicker{display:inline-flex;align-items:center;gap:8px;color:#c6f5dc;font-size:.82rem;font-weight:900}.hero-kicker span{width:8px;height:8px;background:var(--red);border-radius:50%;box-shadow:0 0 0 5px rgba(229,31,42,.18)}.hero h1{margin:15px 0 17px;font-size:clamp(2.3rem,5.5vw,4.55rem);line-height:1.12;letter-spacing:-.055em}.hero h1 em{display:block;color:#ffb6b9;font-style:normal}.hero-desc{max-width:640px;margin:0;color:rgba(255,255,255,.84);font-size:clamp(1rem,1.7vw,1.16rem)}.hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:29px}.hero .btn-outline{color:#fff;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.45)}.hero .btn-outline:hover{background:rgba(255,255,255,.17);border-color:#fff}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:580px;margin-top:33px}.stat{padding:12px 15px;border:1px solid rgba(255,255,255,.15);border-radius:15px;background:rgba(255,255,255,.08)}.stat strong{display:block;color:#fff;font-size:1.35rem;line-height:1.2}.stat span{display:block;color:rgba(255,255,255,.66);font-size:.72rem;margin-top:3px}
    /* Search */
    .search-overlap{position:relative;z-index:2;margin-top:-38px}.search-card{padding:clamp(22px,4vw,38px);border:1px solid rgba(16,43,42,.08);border-radius:var(--radius);background:#fff;box-shadow:var(--shadow)}.search-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.search-head h2{margin:0;color:var(--navy);font-size:clamp(1.32rem,3vw,1.9rem);line-height:1.3}.search-head p{margin:6px 0 0;color:var(--muted);font-size:.84rem}.rule{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;background:var(--green-soft);color:var(--green-dark);font-size:.7rem;font-weight:900;white-space:nowrap}.rule:before{content:"✓";color:var(--green)}.search-form{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:13px}.field{display:flex;flex-direction:column;gap:6px}.field label{color:#334844;font-size:.83rem;font-weight:900}.required:after{content:" *";color:var(--red)}input,select,textarea{width:100%;color:var(--ink);border:1px solid #cfdbd7;border-radius:10px;background:#fff;outline:none;transition:.2s}input,select{min-height:45px;padding:8px 12px}textarea{min-height:105px;padding:10px 12px;resize:vertical}input::placeholder,textarea::placeholder{color:#a0aaa7}input:focus,select:focus,textarea:focus{border-color:var(--green);box-shadow:0 0 0 4px rgba(8,122,75,.1)}.search-form .btn{min-height:45px}.result-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:32px 0 17px}.result-meta h3{margin:0;color:var(--navy);font-size:1.07rem}.donor-grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:14px;
}
@media(max-width:960px){.donor-grid{grid-template-columns:1fr;gap:12px}}

.donor-card{
  width:100%;
  max-width:560px;
  margin:4px auto;
  padding:16px 20px 13px;
  position:relative;
  overflow:hidden;
  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(18,160,112,.14),
      transparent 32%
    ),
    radial-gradient(
      circle at 0% 100%,
      rgba(229,30,50,.06),
      transparent 28%
    ),
    linear-gradient(
      135deg,
      #fff,
      #eaf8f2
    );
  border:1px solid rgba(18,130,91,.13);
  border-radius:18px;
  box-shadow:0 6px 20px rgba(8,100,70,.06);
}

.card-content{
  display:grid;
  grid-template-columns:1fr 110px;
  gap:12px;
  align-items:start;
}

.donor-id{
  color:#66736e;
  font-size:12.5px;
  font-weight:700;
}

.donor-name{
  margin-top:2px;
  color:#172e27;
  font-size:20px;
  font-weight:800;
  line-height:1.2;
}

.donor-status{
  margin-top:3px;
  color:#168158;
  font-size:13px;
  font-weight:700;
}

.details{
  display:grid;
  gap:5px;
  margin-top:10px;
  color:#5d6d67;
  font-size:13.5px;
}

.details strong{
  color:#20352e;
}

.blood-info{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  padding-top:4px;
}

.blood-group{
  width:52px;
  height:52px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  background:#ffe6e8;
  border:2px solid #ffd0d3;
  color:#d92338;
  font-size:20px;
  font-weight:800;
}

.age{
  margin-top:6px;
  color:#68746f;
  font-size:12.5px;
  font-weight:700;
  white-space:nowrap;
}

.card-divider{
  height:1px;
  margin:12px 0 10px;
  background:rgba(55,100,82,.08);
}

.card-actions{
  display:grid;
  grid-template-columns:1fr 130px;
  gap:8px;
}

.call-btn,
.download-btn{
  min-height:38px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:10px;
  font-family:inherit;
  font-size:13.5px;
  font-weight:700;
  text-decoration:none;
  cursor:pointer;
  transition:all .18s ease;
}

.call-btn{
  color:#fff;
  background:
    linear-gradient(
      135deg,
      #0c9c69,
      #07855a
    );
  border:0;
}
.call-btn:hover{filter:brightness(1.05);transform:translateY(-1px)}

.download-btn{
  color:#596660;
  background:#fff;
  border:1px solid #e5ebe8;
}
.download-btn:hover{background:#f4f9f6;color:var(--green-dark);border-color:#bfe0cd;transform:translateY(-1px)}

@media(max-width:520px){
  .donor-card{
    padding:13px 14px 10px;
    border-radius:14px;
  }
  .card-content{
    grid-template-columns:1fr 80px;
    gap:6px;
  }
  .donor-name{
    font-size:17.5px;
  }
  .donor-id{
    font-size:11.5px;
  }
  .donor-status{
    font-size:12px;
  }
  .details{
    font-size:12px;
    gap:4px;
    margin-top:7px;
  }
  .blood-group{
    width:44px;
    height:44px;
    font-size:17px;
  }
  .age{
    font-size:11.5px;
    margin-top:4px;
  }
  .card-divider{
    margin:9px 0 8px;
  }
  .card-actions{
    grid-template-columns:1fr 100px;
    gap:6px;
  }
  .call-btn,
  .download-btn{
    min-height:34px;
    font-size:12px;
    border-radius:8px;
  }
}

/* ───────── রক্তদাতা প্রোফাইল পেজ (app.html-এর ডিজাইন) ───────── */
.prof-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:14px;color:var(--muted);font-size:.86rem;font-weight:700;text-decoration:none}
.prof-back:hover{color:var(--green)}
.pcard{position:relative;padding:20px 18px 16px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(16,43,42,.06)}
.phead2{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.pav{width:78px;height:78px;border-radius:50%;object-fit:cover;background:#eef4f1;border:3px solid #fff;box-shadow:0 4px 14px rgba(16,43,42,.13)}
.pgrp{display:grid;place-items:center;min-width:52px;height:44px;padding:0 12px;border-radius:12px;color:var(--red);background:#fdecee;font-size:1.05rem;font-weight:900}
.pnm{margin-top:13px}
.pnm b{display:inline-flex;align-items:center;gap:6px;color:var(--navy);font-size:1.24rem;font-weight:900;line-height:1.3}
.pvf{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;color:#fff;background:var(--green);font-size:.62rem;font-weight:900}
.pnm small{display:block;margin-top:3px;color:var(--muted);font-size:.82rem;letter-spacing:.02em}
.pchips{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.pchip{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border:1px solid var(--line);border-radius:99px;color:#4a5a55;background:#fbfdfc;font-size:.76rem;font-weight:700;white-space:nowrap}
.pchip.ok{color:#0d7448;border-color:#bfe6d1;background:#eaf8f0}
.pchip.rest{color:#a65a10;border-color:#f3ddb9;background:#fff6e8}
.pacts{display:flex;gap:9px;margin-top:15px}
.pbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 12px;border:0;border-radius:11px;font-family:inherit;font-size:.88rem;font-weight:800;text-decoration:none;cursor:pointer;transition:filter .15s,transform .15s}
.pbtn.solid{color:#fff;background:linear-gradient(135deg,#0c9c69,#07855a)}
.pbtn.solid:hover{filter:brightness(1.06);transform:translateY(-1px)}
.pbtn.ghost{color:#42534f;background:#fff;border:1px solid var(--line)}
.pbtn.ghost:hover{background:#f4f9f6;border-color:#bfe0cd}
.pbtn.off{color:#93a29d;background:#f6f8f7;border:1px solid var(--line);cursor:not-allowed}
.pstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.pstat{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:14px 8px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:center}
.pstat b{color:var(--green);font-size:1.3rem;font-weight:900;line-height:1.2}
.pstat b.sm{font-size:.94rem}
.pstat span{color:var(--muted);font-size:.68rem;font-weight:700;line-height:1.35}
.psec{margin:20px 0 9px;color:var(--muted);font-size:.76rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
.prows{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.prow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--line);font-size:.88rem}
.prow:last-child{border-bottom:0}
.prow b{color:var(--navy);font-weight:800}
.prow span{color:#42534f;font-weight:700;text-align:right;word-break:break-word}
.prow span.dim{color:#a3afab;font-weight:600}
.pcardbox{padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff}
.pcardbox p{margin:0 0 12px;color:var(--muted);font-size:.83rem;line-height:1.6}
.pdl{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,#0c9c69,#07855a);font-family:inherit;font-size:.92rem;font-weight:800;cursor:pointer;transition:filter .15s,transform .15s}
.pdl:hover{filter:brightness(1.06);transform:translateY(-1px)}
.pdl:disabled{opacity:.6;cursor:progress;transform:none}
.pnote{margin:14px 0 0;color:var(--muted);font-size:.76rem;text-align:center}
.pmiss{padding:40px 22px;border:1px dashed #cbdad5;border-radius:16px;background:#fcfefd;text-align:center}
.pmiss-ic{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 12px;border-radius:50%;background:var(--red-soft);font-size:1.4rem}
.pmiss b{display:block;color:var(--navy);font-size:1.05rem}
.pmiss p{margin:6px 0 16px;color:var(--muted);font-size:.86rem}
@media(max-width:520px){
  .pcard{padding:17px 15px 14px}
  .pnm b{font-size:1.12rem}
  .pstats{gap:7px}
  .pstat{padding:12px 5px}
  .pstat b{font-size:1.15rem}
  .pstat b.sm{font-size:.8rem}
  .pstat span{font-size:.63rem}
  .pacts{gap:7px}
  .pbtn{min-height:42px;padding:0 8px;font-size:.8rem}
  .prow{padding:13px 14px;font-size:.85rem}
}
.empty{grid-column:1/-1;padding:32px 18px;border:1px dashed #cbdad5;border-radius:15px;text-align:center;color:var(--muted);background:#fcfefd}.empty-icon{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 8px;border-radius:50%;background:var(--red-soft);font-size:1.3rem}
    /* Emergency board */
    .emergency-section{background:#fff9f9}.emergency-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.emergency-card{position:relative;display:flex;flex-direction:column;overflow:hidden;padding:0;border:1px solid #f0d7d9;border-radius:16px;background:#fff;box-shadow:0 10px 26px rgba(151,23,33,.08)}.ec-head{padding:15px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px dashed #f0e0e1;background:linear-gradient(180deg,#fffafa,#fff)}.ec-patient{display:flex;align-items:center;gap:11px;min-width:0}.ec-blood{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;color:#fff;background:var(--red);font-size:1rem;font-weight:900;flex:0 0 auto}.ec-name{margin:0;color:var(--navy);font-size:1rem;line-height:1.25}.ec-time{color:var(--muted);font-size:.7rem;margin-top:3px}.ec-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:99px;font-size:.66rem;font-weight:900;white-space:nowrap}.ec-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.ec-badge.red{color:#98202a;background:var(--red-soft)}.ec-badge.orange{color:#a65a10;background:#fff2df}.ec-badge.yellow{color:#8a6210;background:#fff8dc}.ec-badge.green{color:#0d7448;background:#e9f8ef}.ec-body{padding:13px 16px;display:grid;gap:8px;font-size:.79rem;color:var(--muted)}.ec-body div{display:flex;gap:7px;align-items:flex-start}.ec-body div strong{color:var(--ink);font-weight:700}.ec-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px 15px;border-top:1px solid var(--line)}.ec-btn{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-radius:10px;font-size:.82rem;font-weight:900;color:#fff;transition:filter .15s}.ec-btn:active{filter:brightness(.94)}.ec-btn.call{background:var(--red)}.ec-btn.wa{background:#25d366}
    /* About */
    .about-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:58px;align-items:start}.about-copy h2{margin:9px 0 4px;color:var(--navy);font-size:clamp(1.8rem,3.3vw,2.6rem);line-height:1.25}.about-subtitle{margin:0 0 22px;color:var(--red);font-weight:900}.about-copy p{color:var(--muted)}.goals{display:grid;gap:10px;padding:0;margin:20px 0 0;list-style:none}.goals li{position:relative;padding:12px 14px 12px 41px;color:#42534f;border:1px solid var(--line);border-radius:12px;background:#fff}.goals li:before{content:"✓";position:absolute;left:13px;top:11px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;color:#fff;background:var(--green);font-size:.72rem;font-weight:900}/* Clean, Modern & Professional Contact Section */
.contact-card{
  padding:26px 22px;
  border-radius:20px;
  background:#ffffff;
  border:1px solid #e1ece7;
  box-shadow:0 10px 30px rgba(15,52,43,.05);
}
.contact-title{
  margin:0 0 6px;
  color:#064f37;
  font-size:1.2rem;
  font-weight:800;
  line-height:1.35;
}
.contact-desc{
  margin:0 0 18px;
  color:#5a6d67;
  font-size:.88rem;
  line-height:1.55;
}
.contact-items{
  display:flex;
  flex-direction:column;
  gap:10px;
  margin-bottom:18px;
}
.c-item{
  display:flex;
  align-items:center;
  gap:12px;
  padding:11px 15px;
  border-radius:14px;
  background:#f7faf8;
  border:1px solid #e5ede9;
  text-decoration:none;
  transition:all .18s ease;
}
.c-item:hover{
  background:#edf7f2;
  border-color:#bfe0cd;
  transform:translateY(-1px);
}
.c-icon{
  display:flex;
  align-items:center;
  justify-content:center;
  width:38px;
  height:38px;
  border-radius:10px;
  background:#ffffff;
  border:1px solid #dce8e2;
  color:#087a4b;
  font-size:1.1rem;
  flex-shrink:0;
}
.c-text{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:0;
}
.c-label{
  font-size:.76rem;
  font-weight:700;
  color:#687974;
}
.c-val{
  font-size:.92rem;
  font-weight:800;
  color:#172624;
  word-break:break-all;
}
.social-btns{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.s-btn{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  width:100%;
  min-height:48px;
  padding:10px 18px;
  border-radius:14px;
  color:#ffffff !important;
  font-family:inherit;
  font-size:15px;
  font-weight:800;
  text-decoration:none;
  border:none;
  cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.08);
  transition:all .18s ease;
}
.s-btn:hover{
  transform:translateY(-2px);
  filter:brightness(1.06);
  box-shadow:0 6px 18px rgba(0,0,0,.12);
}
.s-btn i{
  font-size:1.15rem;
}
.s-btn.s-group{
  background:#e52525;
}
.s-btn.s-page{
  background:#1877f2;
}
@media(max-width:920px){
  .contact-card{padding:22px 18px;margin-top:10px}
}
    /* Footer */
    footer{padding:60px 0 21px;color:rgba(255,255,255,.78);background:#082e25}.footer-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:31px}.footer-brand{display:flex;align-items:center;gap:10px;margin-bottom:14px}.footer-brand img{width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.5)}.footer-brand strong{color:#fff;font-size:1rem}.footer-col h3{margin:0 0 14px;color:#fff;font-size:.95rem}.footer-col p{margin:0;font-size:.8rem;line-height:1.85}.footer-links{display:grid;gap:6px;padding:0;margin:0;list-style:none}.footer-links a,.footer-links li,.footer-contact a{color:rgba(255,255,255,.7);font-size:.8rem}.footer-links a:hover,.footer-contact a:hover{color:#ffb5b8}.footer-contact{display:grid;gap:7px}.copyright{display:flex;justify-content:space-between;gap:15px;margin-top:43px;padding-top:17px;border-top:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.52);font-size:.72rem}
    /* Inner pages/forms */
    .page-hero{padding:59px 0 53px;background:linear-gradient(135deg,#effbf5,#fff4f4);border-bottom:1px solid var(--line)}.page-hero-grid{display:flex;align-items:center;justify-content:space-between;gap:25px}.page-hero h1{margin:9px 0 9px;color:var(--navy);font-size:clamp(2rem,4vw,3.25rem);line-height:1.2;letter-spacing:-.04em}.page-hero p{max-width:670px;margin:0;color:var(--muted);font-size:1rem}.page-mark{display:grid;place-items:center;width:135px;height:135px;border-radius:50%;background:#fff;box-shadow:var(--shadow-sm);flex:0 0 auto}.page-mark img{width:110px;height:110px;border-radius:50%;object-fit:cover}.form-section{padding:63px 0 87px}.form-card{padding:clamp(22px,4vw,39px);border:1px solid var(--line);border-radius:var(--radius);background:#fff;box-shadow:var(--shadow-sm)}.alert{display:flex;align-items:flex-start;gap:10px;margin-bottom:21px;padding:14px 16px;border:1px solid #f3d595;border-left:4px solid var(--gold);border-radius:11px;color:#694e19;background:#fff9e9;font-size:.83rem}.message{padding:13px 15px;margin-bottom:19px;border-radius:11px;font-size:.84rem}.message.success{color:#075c3c;background:var(--green-soft);border:1px solid #b9e5ce}.message.error{color:#9a1822;background:var(--red-soft);border:1px solid #f5c2c6}.form-title{display:flex;align-items:center;gap:9px;margin:27px 0 16px;padding-bottom:9px;border-bottom:1px solid var(--line);color:var(--green-dark);font-size:1.1rem}.form-title:first-of-type{margin-top:0}.form-title span{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;color:#fff;background:var(--green);font-size:.75rem}.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.form-grid.three{grid-template-columns:repeat(3,1fr)}.full{grid-column:1/-1}.note{margin-top:4px;color:var(--muted);font-size:.72rem}.check{display:flex;align-items:flex-start;gap:9px;margin:20px 0;color:#42534f;font-size:.82rem}.check input{flex:0 0 auto;width:18px;height:18px;margin-top:4px;accent-color:var(--green)}.form-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:6px}.eligibility-layout{display:grid;grid-template-columns:.82fr 1.18fr;gap:28px;align-items:start}.info-panel{padding:25px;border-radius:var(--radius);color:#fff;background:linear-gradient(155deg,#0a6d49,#063e2e);box-shadow:var(--shadow)}.info-panel h2{margin:0 0 12px;font-size:1.4rem}.info-panel p{color:rgba(255,255,255,.77);font-size:.83rem}.info-list{display:grid;gap:9px;padding:0;margin:18px 0 0;list-style:none}.info-list li{position:relative;padding-left:25px;color:rgba(255,255,255,.9);font-size:.81rem}.info-list li:before{content:"✓";position:absolute;left:0;top:1px;color:#9cf0c1;font-weight:900}.result{margin-top:22px;padding:18px;border-radius:14px}.result.ok{color:#075b3b;background:var(--green-soft);border:1px solid #b5e2c9}.result.fail{color:#991a23;background:var(--red-soft);border:1px solid #f2c0c5}.result h3{margin:0 0 5px;font-size:1.06rem}.result p{margin:0;font-size:.8rem}.result ul{margin:7px 0 0;padding-left:20px;font-size:.78rem}
    /* Admin */
    .admin-wrap{min-height:calc(100vh - 76px);padding:42px 0 75px;background:linear-gradient(160deg,#f2faf6 0%,#f4f8f6 55%,#eef4f1 100%)}.login-card{width:min(450px,100%);margin:auto;padding:34px 32px;border:1px solid rgba(8,122,75,.14);border-radius:24px;background:#fff;box-shadow:0 24px 60px rgba(15,52,43,.14)}.login-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.login-brand img{width:58px;height:58px;border-radius:50%;object-fit:cover;box-shadow:0 6px 14px rgba(8,122,75,.22);border:2px solid #fff}.login-brand strong{display:block;color:var(--green-dark);font-size:1.05rem;line-height:1.3}.login-brand small{color:var(--muted);font-size:.73rem}.login-card h1{margin:0 0 3px;color:var(--navy);font-size:1.6rem}.login-card>p{margin:0 0 22px;color:var(--muted);font-size:.82rem}.admin-panel{display:none}.admin-panel.show{display:block}.admin-top{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:24px}.admin-top h1{margin:0;color:var(--navy);font-size:clamp(1.55rem,3vw,2.1rem)}.admin-top p{margin:4px 0 0;color:var(--muted);font-size:.8rem}.admin-actions{display:flex;gap:9px}.admin-actions .btn{min-height:38px;padding:8px 15px;border-radius:10px;font-size:.76rem}.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:22px}.admin-stat{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 16px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,52,43,.06);transition:transform .15s ease,box-shadow .15s ease}.admin-stat:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,52,43,.1)}.admin-stat span{display:block;color:var(--muted);font-size:.72rem;font-weight:600}.admin-stat strong{display:block;margin-top:4px;color:var(--navy);font-size:1.5rem;line-height:1.2}.admin-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:var(--green);background:linear-gradient(145deg,var(--green-soft),#e3f5ec);font-size:1.15rem;box-shadow:inset 0 0 0 1px rgba(8,122,75,.08)}.admin-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.admin-nav button{padding:10px 15px;border:1px solid var(--line);border-radius:11px;color:#4d5e59;background:#fff;font-size:.78rem;font-weight:900;cursor:pointer;transition:.15s;box-shadow:0 2px 6px rgba(15,52,43,.03)}.admin-nav button.active,.admin-nav button:hover{color:var(--green-dark);border-color:#7fc3a6;background:var(--green-soft)}.tab-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:6px;padding:0 6px;border-radius:99px;background:#ffe3a3;color:#7a5200;font-size:.64rem;font-weight:900;box-shadow:inset 0 0 0 1px rgba(140,98,16,.25)}.admin-nav button.active .tab-badge{background:#fff;color:var(--green-dark);box-shadow:inset 0 0 0 1px rgba(8,122,75,.25)}@keyframes tabIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.admin-box{padding:20px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,52,43,.07);animation:tabIn .28s ease both}.admin-subhead{display:flex;align-items:center;gap:8px;margin:4px 0 10px;color:var(--navy);font-size:.86rem;font-weight:900}.admin-subhead .chip{padding:3px 9px;border-radius:99px;background:#fff7df;color:#8c6210;font-size:.64rem;box-shadow:inset 0 0 0 1px rgba(140,98,16,.2)}.admin-divider{height:1px;margin:18px 0 14px;background:var(--line)}.admin-box h2{margin:0;color:var(--navy);font-size:1.08rem}.admin-box p{margin:3px 0 16px;color:var(--muted);font-size:.75rem}.table-tools{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px}.tools{display:flex;flex-wrap:wrap;gap:8px}.tools select,.tools input{width:auto;min-width:130px;min-height:36px;padding:5px 10px;font-size:.73rem;border-radius:9px;border:1px solid #d6e0dc;background:#fff}.tools select:focus,.tools input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(8,122,75,.1)}.tools input{padding-left:26px;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="%2388a098" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>');background-repeat:no-repeat;background-position:8px center}.table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:#fff}table{width:100%;min-width:760px;border-collapse:collapse;font-size:.74rem}th,td{padding:12px 13px;border-bottom:1px solid #edf1ef;text-align:left;vertical-align:middle}th{color:#52645e;background:#f7faf8;font-size:.7rem;white-space:nowrap;font-weight:900;text-transform:none;letter-spacing:.02em}tbody tr:last-child td{border-bottom:0}tbody tr{transition:background .12s ease}tbody tr:hover{background:#f0faf5}.status{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:99px;font-size:.66rem;font-weight:900;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}.status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.approved{color:#087144;background:#e6f6ee;box-shadow:inset 0 0 0 1px rgba(8,113,68,.16)}.pending{color:#8c6210;background:#fff7df;box-shadow:inset 0 0 0 1px rgba(140,98,16,.18)}.rejected{color:#a41e27;background:#fdecee;box-shadow:inset 0 0 0 1px rgba(164,30,39,.16)}.resolved{color:#265aa3;background:#edf4ff;box-shadow:inset 0 0 0 1px rgba(38,90,163,.16)}.actions{display:flex;flex-wrap:wrap;gap:5px}.actions .btn{min-height:30px;padding:5px 9px;font-size:.66rem;border-radius:8px}.actions .btn-green{background:var(--green);box-shadow:none}.actions .btn-danger{color:#fff;background:#d63542;border-color:transparent;box-shadow:none}.actions .btn-outline{background:#fff}.empty-cell{padding:26px;text-align:center;color:var(--muted)}
    /* Donor Pagination */
    .donor-pagination-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 18px;
      flex-wrap: wrap;
    }
    .pag-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 6px 16px;
      min-height: 36px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid #d8e2df;
      color: #2563eb;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      transition: all 0.16s ease;
      text-decoration: none;
    }
    .pag-btn:hover:not(:disabled) {
      background: #f4f8ff;
      border-color: #bcd2fd;
      color: #1d4ed8;
      transform: translateY(-1px);
    }
    .pag-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      border-color: #e5ece9;
      color: #889994;
      box-shadow: none;
    }
    .pag-info {
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 700;
      color: #2d413c;
      padding: 0 4px;
      white-space: nowrap;
    }
    @media (max-width: 520px) {
      .donor-pagination-wrap {
        gap: 8px;
        margin-top: 14px;
      }
      .pag-btn {
        padding: 5px 12px;
        font-size: 12px;
        min-height: 32px;
        border-radius: 8px;
      }
      .pag-info {
        font-size: 12px;
        padding: 0 2px;
      }
    }

    /* Modal Design */
    .modal-bg, .app-modal-bg, .cmodal-bg {
      position: fixed;
      z-index: 100;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.45);
    }

    .app-modal, .cmodal, .modal {
      position: relative;
      width: min(390px, 100%);
      text-align: center;
      padding: 28px 24px 20px;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.12);
      border: 1px solid #e5ebe8;
    }

    .modal {
      width: min(560px, 100%);
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      text-align: left;
    }

    .dcard-modal {
      width: min(400px, 100%);
      text-align: center;
    }

    /* Close Button (clean ✕ top-right) */
    .cmodal-close, .app-modal-close, .close {
      position: absolute;
      top: 14px;
      right: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: #4b5e58;
      font-size: 1.15rem;
      font-weight: 700;
      cursor: pointer;
      line-height: 1;
      transition: color 0.15s ease;
    }
    .cmodal-close:hover, .app-modal-close:hover, .close:hover {
      color: #111816;
    }

    /* Icon Area (Grey circle with dark symbol) */
    .app-message .app-icon, .cmodal-icon {
      width: 58px;
      height: 58px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: #eef2f5;
      color: #172624;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1;
    }
    .app-message .app-icon.ok, .cmodal-icon.ok {
      background: #e8f6ef;
      color: #087a4b;
    }
    .app-message .app-icon.err, .cmodal-icon.danger {
      background: #feecee;
      color: #e51f2a;
    }
    .cmodal-icon.warn {
      background: #fef4e5;
      color: #d97706;
    }
    .cmodal-icon.info {
      background: #edf4ff;
      color: #1d61d8;
    }

    /* Title */
    .app-message h3, .cmodal h3 {
      margin: 0 0 10px;
      color: #111816;
      font-size: 22px;
      font-weight: 800;
      line-height: 1.3;
    }

    /* Description / Message */
    .app-message p, .cmodal p {
      margin: 0 0 20px;
      color: #334743;
      font-size: 15px;
      line-height: 1.55;
    }

    /* Modal Divider & Footer */
    .app-modal-footer, .cmodal-footer {
      border-top: 1px solid #edf2f0;
      padding-top: 18px;
      margin-top: 6px;
      display: flex;
      justify-content: center;
    }

    /* Button */
    .btn-blue {
      color: #ffffff;
      background: #1d61d8;
      border: 1px solid #1d61d8;
      padding: 10px 32px;
      min-height: 42px;
      border-radius: 9px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-blue:hover {
      background: #154fb5;
      border-color: #154fb5;
    }

    .cmodal-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      width: 100%;
    }
    .cmodal-actions .btn {
      min-height: 42px;
      padding: 9px 24px;
      border-radius: 9px;
      font-size: 14.5px;
      font-weight: 700;
    }

    /* Spinner for Loading */
    .spinner {
      width: 44px;
      height: 44px;
      margin: 0 auto 14px;
      border: 3px solid #e4efe9;
      border-top-color: #1d61d8;
      border-radius: 50%;
      animation: spin 0.85s linear infinite;
    }
    .app-loading p {
      margin: 0;
      color: #172624;
      font-weight: 700;
      font-size: 16px;
    }

    /* Generic Modal Head */
    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #edf2ef;
    }
    .modal-head h2 {
      margin: 0;
      color: #172624;
      font-size: 1.2rem;
      font-weight: 800;
    }

    /* Digital Donor Card Preview */
    .dcard {
      position: relative;
      width: 100%;
      max-width: 340px;
      margin: 0 auto;
      padding: 18px 16px 14px;
      border-radius: 16px;
      color: #ffffff;
      background: #09583b;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      text-align: center;
      overflow: hidden;
    }
    .dcard-topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
    }
    .dcard-logo {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.8);
    }
    .dcard-topbar span {
      font-size: 0.72rem;
      font-weight: 800;
      color: #eafff3;
    }
    .dcard-photo {
      width: 76px;
      height: 76px;
      margin: 12px auto 8px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      overflow: hidden;
      background: #ffffff;
    }
    .dcard-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .dcard-name {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
    }
    .dcard-group {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 58px;
      height: 58px;
      margin: 10px auto;
      border-radius: 50%;
      color: #ffffff;
      background: #e51f2a;
      font-size: 1.2rem;
      font-weight: 800;
      border: 2px solid rgba(255, 255, 255, 0.8);
    }
    .dcard-rows {
      display: grid;
      gap: 6px;
      text-align: left;
      margin-top: 8px;
    }
    .dcard-rows div {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.8rem;
      color: #d7f2e6;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
      padding: 5px 2px;
    }
    .dcard-rows strong {
      color: #ffffff;
    }
    .dcard-footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 0.7rem;
      color: #bdebd6;
      font-weight: 700;
    }
    .dcard-toolbar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 16px;
    }
    .dcard-toolbar .btn {
      min-height: 42px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 700;
    }
    /* Floating Support Button */
    .support-btn{position:fixed;right:20px;bottom:22px;z-index:70;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;color:#fff;background:linear-gradient(145deg,#087a4b,#064f37);box-shadow:0 10px 26px rgba(6,79,55,.4);font-size:1.5rem;transition:transform .18s ease,box-shadow .18s ease,background .18s ease;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}.support-btn:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(6,79,55,.5);background:linear-gradient(145deg,#0a8f58,#075a41)}.support-btn:active{transform:scale(.94)}.support-btn.dragging{transition:none;cursor:grabbing;transform:none;box-shadow:0 18px 40px rgba(6,79,55,.5)}
    .toasts{position:fixed;z-index:96;right:18px;bottom:18px;display:grid;gap:9px;width:min(360px,calc(100% - 36px))}.toast{padding:12px 14px;border:1px solid rgba(0,0,0,.08);border-left:4px solid var(--green);border-radius:12px;background:#fff;box-shadow:var(--shadow);font-size:.8rem;animation:in .25s ease both}.toast.error{border-left-color:var(--red)}@keyframes in{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:1080px){.nav a{padding-inline:8px;font-size:.77rem}.footer-grid{grid-template-columns:1.4fr 1fr 1fr}.footer-grid .footer-col:last-child{grid-column:2/-1}}
    @media(max-width:920px){.site-header{background:#ffffff;border-bottom:1px solid #edf2f0;box-shadow:none}.nav-shell{position:static;min-height:68px}.menu-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:none;background:transparent;color:#485a55;font-size:1.55rem;font-weight:700;line-height:1;cursor:pointer;padding:0;box-shadow:none;transition:color .15s ease}.menu-btn:hover,.menu-btn[aria-expanded="true"]{background:transparent;color:#172624;border:none;box-shadow:none}.nav{position:absolute;top:100%;left:0;right:0;width:100%;flex-direction:column;align-items:stretch;gap:0;padding:20px 28px 26px;background:#ffffff;border-top:1px solid #f0f4f2;border-bottom:1px solid #e2ece8;box-shadow:0 8px 24px rgba(0,0,0,.04);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-4px);transition:opacity .18s ease,transform .18s ease,visibility .18s ease;z-index:60}.nav.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0)}.nav-head,.nav-close,.nav-title{display:none}.nav a{display:block;padding:9px 0;margin:0;font-size:19px;font-weight:700;color:#2e433f;background:transparent;border:none;border-radius:0;width:100%;line-height:1.4;text-decoration:none;transition:color .15s ease;text-align:left}.nav a:hover,.nav a.active{color:#087a4b;background:transparent;font-weight:800}.nav-overlay{display:block;position:fixed;inset:0;top:68px;z-index:55;background:transparent;opacity:0;visibility:hidden;pointer-events:none}.nav-overlay.show{opacity:1;visibility:visible;pointer-events:auto}.hero-grid{grid-template-columns:1fr;gap:25px}.hero-content{text-align:center;order:1;margin:auto}.hero-visual{order:0;min-height:300px}.hero-desc{margin:auto}.hero-actions,.stats{justify-content:center;margin-inline:auto}.about-grid,.eligibility-layout{grid-template-columns:1fr;gap:28px}.contact{position:relative}.donor-grid,.emergency-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.nav{padding:16px 22px 24px}.nav a{font-size:18px;padding:8px 0}}
    @media(max-width:680px){.container,.narrow{width:calc(100% - 28px)}.nav-shell{min-height:68px}.logo{width:44px;height:44px}.brand-text strong{font-size:.85rem}.brand-text small{display:none}.hero{padding:50px 0 58px}.hero-visual{min-height:240px}.hero-logo{width:220px;border-width:7px}.hero-logo-wrap{padding:11px}.hero-badge{right:-5px;top:12px;font-size:.64rem;padding:8px 10px}.hero-float{bottom:3px;font-size:.68rem;padding:8px 10px}.hero h1{font-size:2.3rem}.hero-actions .btn{width:100%}.stats{gap:6px}.stat{padding:9px 6px}.stat strong{font-size:1.06rem}.stat span{font-size:.6rem}.search-overlap{margin-top:-24px}.search-card{padding:20px 15px}.search-head{display:block}.search-form{grid-template-columns:1fr}.search-form .btn{width:100%}.section{padding:61px 0}.donor-grid,.emergency-grid,.form-grid,.form-grid.three{grid-template-columns:1fr}.full{grid-column:auto}.page-hero{padding:45px 0}.page-hero-grid{display:block}.page-mark{width:88px;height:88px;margin-top:22px}.page-mark img{width:75px;height:75px}.form-section{padding:44px 0 67px}.form-card{padding:19px 15px}.form-actions .btn{width:100%}.footer-grid{grid-template-columns:1fr;gap:25px}.footer-grid .footer-col:last-child{grid-column:auto}.copyright{display:block;margin-top:31px}.copyright span{display:block;margin-top:6px}.admin-wrap{padding:25px 0 55px}.admin-stats{grid-template-columns:repeat(2,1fr);gap:8px}.admin-stat{padding:12px 10px}.admin-stat strong{font-size:1.25rem}.admin-icon{width:33px;height:33px;font-size:.85rem}.admin-top{align-items:flex-start}.admin-actions .btn{padding-inline:9px;font-size:.7rem}.admin-box{padding:15px 11px}.tools{width:100%}.tools select,.tools input{flex:1;min-width:0;width:100%}}
  
/* Sidebar and Layout Modifications */
.admin-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  margin-top: 15px;
}
.admin-sidebar {
  width: 260px;
  min-width: 260px;
  background: #fff;
  border-radius: 18px;
  border: 1px solid var(--line);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 8px 30px rgba(15,52,43,.04);
  position: sticky;
  top: 90px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  transition: all 0.3s ease;
  z-index: 100;
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--line);
}
.sidebar-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--green);
}
.sidebar-title {
  margin: 0;
  font-size: 1.05rem;
  color: var(--navy);
  font-weight: 800;
}
.sidebar-role {
  font-size: 0.72rem;
  color: var(--green);
  font-weight: 700;
  background: var(--green-soft);
  padding: 2px 8px;
  border-radius: 99px;
  display: inline-block;
  margin-top: 2px;
}
.sidebar-close-btn {
  display: none;
  font-size: 24px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  margin-left: auto;
}
.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: none;
  border: none;
  border-radius: 10px;
  color: #4d5e59;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}
.sidebar-item i {
  font-size: 0.95rem;
  width: 18px;
  text-align: center;
}
.sidebar-item:hover, .sidebar-item.active {
  color: var(--green-dark);
  background: var(--green-soft);
}
.sidebar-item.active {
  box-shadow: inset 4px 0 0 var(--green);
}
.sidebar-footer {
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.user-info {
  font-size: 0.76rem;
  color: var(--muted);
  font-weight: 600;
  padding-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fdecee;
  color: #a41e27;
  border: none;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}
.sidebar-logout-btn:hover {
  background: #fcd5d8;
}
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 99;
}
.admin-main-content {
  flex: 1;
  min-width: 0;
}
.menu-toggle-btn {
  display: none;
  align-items: center;
  gap: 8px;
  background: var(--green-soft);
  color: var(--green-dark);
  border: 1px solid rgba(8,122,75,.15);
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.8rem;
  cursor: pointer;
}

@media(max-width: 991px) {
  .admin-layout {
    flex-direction: column;
    gap: 15px;
  }
  .admin-sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    height: 100vh;
    max-height: 100vh;
    width: 270px;
    border-radius: 0;
    border-top: none;
    border-bottom: none;
    box-shadow: 5px 0 30px rgba(0,0,0,0.15);
  }
  .admin-sidebar.open {
    left: 0;
  }
  .sidebar-close-btn {
    display: block;
  }
  .sidebar-overlay.open {
    display: block;
  }
  .menu-toggle-btn {
    display: inline-flex;
  }
}


@media (max-width: 767px) {
  /* Stacked Responsive Tables on Mobile */
  .admin-panel table:not(.no-stack), 
  .admin-panel table:not(.no-stack) thead, 
  .admin-panel table:not(.no-stack) tbody, 
  .admin-panel table:not(.no-stack) th, 
  .admin-panel table:not(.no-stack) td, 
  .admin-panel table:not(.no-stack) tr {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .admin-panel table:not(.no-stack) thead {
    display: none !important;
  }

  .admin-panel table:not(.no-stack) tr {
    margin-bottom: 16px !important;
    border: 1px solid var(--line) !important;
    border-radius: 14px !important;
    background: #fff !important;
    padding: 12px 16px !important;
    box-shadow: 0 4px 15px rgba(15,52,43,.03) !important;
  }

  .admin-panel table:not(.no-stack) td {
    border-bottom: 1px solid #edf1ef !important;
    padding: 10px 0 !important;
    position: relative !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    text-align: right !important;
    min-height: 44px !important;
  }

  .admin-panel table:not(.no-stack) td:last-child {
    border-bottom: none !important;
  }

  .admin-panel table:not(.no-stack) td::before {
    content: attr(data-label) !important;
    font-weight: 800 !important;
    color: var(--muted) !important;
    font-size: 0.72rem !important;
    text-align: left !important;
    margin-right: 15px !important;
    display: inline-block !important;
  }
  
  .admin-panel table:not(.no-stack) td .actions {
    justify-content: flex-end !important;
    width: 100% !important;
    max-width: 65% !important;
    gap: 6px !important;
  }

  .admin-panel table:not(.no-stack) td .actions .btn {
    padding: 4px 8px !important;
    font-size: 0.65rem !important;
  }

  .table-wrap {
    border: none !important;
    background: transparent !important;
    overflow-x: visible !important;
  }
  
  /* Compact layout for mobile widgets */

  
  .admin-stats {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10px !important;
  }
}

@media (max-width: 480px) {
  .admin-stats {
    grid-template-columns: 1fr !important;
  }
}


/* Responsive Grid Classes */
.admin-grid-two-col {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 20px !important;
}
.admin-grid-settings {
  display: grid !important;
  grid-template-columns: 1fr 1.2fr !important;
  gap: 20px !important;
}
.admin-grid-three-col {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 15px !important;
}
.admin-grid-gallery-top {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 12px !important;
  align-items: end !important;
}

@media (max-width: 991px) {
  .admin-grid-three-col {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 767px) {
  .admin-grid-two-col,
  .admin-grid-settings,
  .admin-grid-three-col,
  .admin-grid-gallery-top {
    grid-template-columns: 1fr !important;
    gap: 15px !important;
  }
}

/* Hide original navigation tab buttons but keep them in DOM */
.admin-nav {
  display: none !important;
}


/* ===== গ্যালারি স্লাইডার (সোয়াইপ ও ড্র্যাগযোগ্য) ===== */
.gslider{
  position:relative;
  width:100%;
  max-width:1000px;
  margin:0 auto;
  border-radius:24px;
  overflow:hidden;
  box-shadow:0 14px 40px rgba(15,52,43,.12);
  border:1px solid rgba(18,130,91,.15);
  background:#073b2c;
  cursor:grab;
  user-select:none;
  -webkit-user-select:none;
  touch-action:pan-y;
}
.gslider:active{
  cursor:grabbing;
}
#galleryTrack{
  display:flex;
  transition:transform .45s cubic-bezier(.25,1,.5,1);
  width:100%;
}
.gslide{
  min-width:100%;
  width:100%;
  height:440px;
  position:relative;
  flex:0 0 100%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#073b2c;
  overflow:hidden;
  pointer-events:none;
}
.gslide img{
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center;
  display:block;
  pointer-events:none;
  user-select:none;
  -webkit-user-drag:none;
}
.gdots{
  display:flex;
  justify-content:center;
  align-items:center;
  gap:8px;
  padding:16px 0 0;
}
.gdot{
  width:10px;
  height:10px;
  border:0;
  border-radius:99px;
  background:#cbdad5;
  cursor:pointer;
  padding:0;
  transition:all .22s ease;
}
.gdot:hover{
  background:#95b5aa;
}
.gdot.on{
  width:28px;
  background:var(--red);
  box-shadow:0 2px 8px rgba(229,31,42,.3);
}
@media(max-width:768px){
  .gslider{border-radius:18px}
  .gslide{height:300px}
}
@media(max-width:480px){
  .gslide{height:230px}
}
.guard-card{width:min(480px,100%);margin:70px auto;padding:38px 30px;border:1px solid var(--line);border-radius:24px;background:#fff;box-shadow:0 24px 60px rgba(15,52,43,.14);text-align:center}
.guard-card h1{margin:14px 0 6px;color:var(--navy);font-size:1.42rem}
.guard-card p{margin:0 0 18px;color:var(--muted);font-size:.85rem}
.guard-icon{display:grid;place-items:center;width:64px;height:64px;margin:0 auto;border-radius:50%;background:var(--red-soft);color:var(--red);font-size:1.6rem}
.already-note{margin-top:16px;padding:13px 15px;border-radius:11px;font-size:.82rem;color:#075c3c;background:var(--green-soft);border:1px solid #b9e5ce}
.top-link{display:inline-flex;align-items:center;gap:7px;min-height:41px;padding:8px 15px;border-radius:10px;border:1px solid #cbd9d4;color:var(--green-dark);background:#fff;font-size:.8rem;font-weight:900;transition:.2s}
.top-link:hover{border-color:var(--green);background:var(--green-soft)}


    /* ===== Auth (লগইন / অ্যাকাউন্ট তৈরি) ===== */
    .auth-card{width:min(520px,100%)}
    .auth-forgot{margin-top:14px;text-align:center}
    .auth-forgot a{color:var(--green-dark);font-size:.78rem;font-weight:800;text-decoration:none;cursor:pointer}
    .auth-forgot a:hover{text-decoration:underline}
    .auth-or{display:flex;align-items:center;gap:12px;margin:18px 0;color:var(--muted);font-size:.74rem;font-weight:800}
    .auth-or:before,.auth-or:after{content:"";flex:1;height:1px;background:var(--line)}
    .btn-google{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;min-height:50px;padding:10px 16px;border:1px solid #dadce0;border-radius:12px;background:#fff;color:#3c4043;font-family:inherit;font-size:.88rem;font-weight:800;cursor:pointer;transition:.15s;box-shadow:0 1px 3px rgba(60,64,67,.14)}
    .btn-google:hover{background:#f7f8fa;box-shadow:0 3px 10px rgba(60,64,67,.2)}
    .btn-google:disabled{opacity:.6;cursor:not-allowed}
    .btn-google svg{width:21px;height:21px;flex:none}
    .btn-google span{text-align:left;line-height:1.25}
    .btn-google small{display:block;font-size:.65rem;font-weight:600;color:#80868b}
    .auth-switch{margin-top:22px;padding:18px 16px;border:1px dashed #bfe0d0;border-radius:16px;background:#f6fbf8;text-align:center}
    .auth-switch h3{margin:0 0 4px;color:var(--navy);font-size:.98rem}
    .auth-switch p{margin:0 0 12px;color:var(--muted);font-size:.75rem;line-height:1.65}
    .pw-wrap{position:relative}
    .pw-wrap input{padding-right:48px}
    .pw-toggle{position:absolute;top:50%;right:8px;transform:translateY(-50%);display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:9px;background:transparent;color:#7b8a85;cursor:pointer;transition:color .15s ease,background .15s ease}
    .pw-toggle:hover{color:var(--green-dark);background:#eef6f2}
    .pw-toggle:active{transform:translateY(-50%) scale(.92)}
    .pw-toggle:focus-visible{outline:2px solid var(--green);outline-offset:1px}
    .pw-toggle svg{width:20px;height:20px;display:block;pointer-events:none}
    .pw-toggle .icon-eye-off{display:none}
    .pw-toggle.is-visible{color:var(--green-dark)}
    .pw-toggle.is-visible .icon-eye{display:none}
    .pw-toggle.is-visible .icon-eye-off{display:block}
    .google-chip{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:18px;border:1px solid #d9e7e1;border-radius:14px;background:#f4faf7}
    .google-chip img{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 4px 10px rgba(8,122,75,.18)}
    .google-chip strong{display:block;color:var(--navy);font-size:.86rem}
    .google-chip small{display:block;color:var(--muted);font-size:.72rem;word-break:break-all}
    .google-chip .verified{margin-left:auto;padding:4px 9px;border-radius:99px;background:#e6f6ee;color:#087144;font-size:.64rem;font-weight:900;white-space:nowrap}
    .suggest-note{display:block;margin-top:6px;padding:6px 9px;border-radius:9px;color:#8c6210;background:#fff7df;border:1px solid #f0e2b8;font-size:.7rem;line-height:1.5}
    .field input[readonly]{background:#f1f5f4;color:#5b6c67;cursor:not-allowed}
    .lock-hint{display:inline-flex;align-items:center;gap:4px;color:#087144;font-size:.66rem;font-weight:800}
    .auth-foot{margin-top:18px;text-align:center;color:var(--muted);font-size:.79rem}
    .auth-foot a{color:var(--green-dark);font-weight:800;text-decoration:none;cursor:pointer}
    .auth-foot a:hover{text-decoration:underline}
    .signup-or{max-width:420px;margin-left:auto;margin-right:auto}
    .auth-signup-card{max-width:640px;margin-left:auto;margin-right:auto}
    .info-note{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;margin-bottom:18px;border:1px solid #cfe6f7;border-radius:14px;background:#eff8fe;color:#1c4c6b;font-size:.79rem;line-height:1.75}
    .info-note a{color:#0b6ea8;font-weight:900;text-decoration:underline;cursor:pointer}
    .welcome-chip{display:inline-flex;align-items:center;gap:8px;padding:5px 12px 5px 5px;border-radius:99px;background:#fff;border:1px solid #d6e6df;font-size:.75rem;font-weight:800;color:var(--green-dark)}
    .welcome-chip img{width:26px;height:26px;border-radius:50%;object-fit:cover}


    /* OTP password recovery — follows the existing modal design */
    .otp-modal{width:min(430px,100%);padding:25px 22px 20px;text-align:left}
    .otp-modal h2{margin:0 36px 5px 0;color:var(--navy);font-size:1.35rem;line-height:1.3}
    .otp-sub{margin:0 0 18px;color:var(--muted);font-size:.82rem;line-height:1.65}
    .otp-steps{display:flex;gap:6px;margin:0 0 18px}
    .otp-steps i{flex:1;height:4px;border-radius:99px;background:var(--line)}
    .otp-steps i.on{background:var(--green)}
    .otp-note{display:flex;gap:8px;margin:0 0 14px;padding:11px 12px;border:1px solid #cfe6f7;border-radius:11px;background:#eff8fe;color:#1c4c6b;font-size:.76rem;line-height:1.55}
    .otp-note.ok{border-color:#b9e5ce;background:var(--green-soft);color:#075c3c}
    .otp-error{display:none;margin:7px 0 0;color:var(--red);font-size:.74rem;font-weight:700}
    .otp-error.show{display:block}
    .otp-code{height:54px!important;text-align:center;font:800 1.35rem/1 system-ui,sans-serif!important;letter-spacing:.48em;padding-left:.48em!important}
    .otp-actions{display:flex;gap:9px;margin-top:18px}
    .otp-actions .btn{flex:1}
    .otp-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;color:var(--muted);font-size:.72rem}
    .otp-link{padding:2px 0;border:0;background:transparent;color:var(--green-dark);font:inherit;font-weight:900;cursor:pointer}
    .otp-link:disabled{opacity:.5;cursor:not-allowed}
    .otp-success{text-align:center;padding:8px 0 2px}
    .otp-success span{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 12px;border-radius:50%;background:var(--green-soft);color:var(--green);font-size:1.8rem;font-weight:900}
    .otp-success h3{margin:0 0 6px;color:var(--navy)}
    .otp-success p{margin:0;color:var(--muted);font-size:.82rem}
    [data-theme="dark"] .otp-note{background:#111d33;color:#9fc1f4;border-color:#263b59}
    [data-theme="dark"] .otp-note.ok{background:var(--green-soft);color:#83dcb1;border-color:#21523d}
    @media(max-width:520px){.otp-modal{padding:23px 17px 18px}.otp-actions{flex-direction:column-reverse}.otp-actions .btn{width:100%}}

    /* Automatic system dark mode; light-mode design remains unchanged. */
    [data-theme="dark"]{color-scheme:dark;--red:#f0444e;--red-dark:#ff6670;--red-soft:#321416;--green:#28b779;--green-dark:#8be0b7;--green-soft:#0e2d21;--navy:#e7f2ee;--ink:#dce8e3;--muted:#91a49d;--line:#293934;--cream:#0b1210;--white:#141f1c;--gold:#e8b44c;--shadow:0 18px 55px rgba(0,0,0,.32);--shadow-sm:0 8px 22px rgba(0,0,0,.28)}
    [data-theme="dark"] body{background:var(--cream);color:var(--ink)}
    [data-theme="dark"] .site-header,[data-theme="dark"] .nav,[data-theme="dark"] .search-card,
    [data-theme="dark"] .section.alt,[data-theme="dark"] .emergency-section,[data-theme="dark"] .donor-card,
    [data-theme="dark"] .emergency-card,[data-theme="dark"] .ec-head,[data-theme="dark"] .contact-card,
    [data-theme="dark"] .c-item,[data-theme="dark"] .pstat,[data-theme="dark"] .pcard,
    [data-theme="dark"] .prows,[data-theme="dark"] .pcardbox,[data-theme="dark"] .form-card,
    [data-theme="dark"] .login-card,[data-theme="dark"] .admin-box,[data-theme="dark"] .admin-stat,
    [data-theme="dark"] .modal,[data-theme="dark"] .app-modal,[data-theme="dark"] .cmodal,
    [data-theme="dark"] .page-mark{background:#141f1c;border-color:var(--line);color:var(--ink)}
    [data-theme="dark"] .donor-card{background:radial-gradient(circle at 100% 0%,rgba(40,183,121,.12),transparent 32%),linear-gradient(135deg,#141f1c,#10251d)}
    [data-theme="dark"] .page-hero{background:linear-gradient(135deg,#10251d,#241517);border-color:var(--line)}
    [data-theme="dark"] input,[data-theme="dark"] select,[data-theme="dark"] textarea,
    [data-theme="dark"] .pbtn.ghost,[data-theme="dark"] .btn-outline,[data-theme="dark"] .download-btn,
    [data-theme="dark"] .top-link{background:#111b18;color:var(--ink);border-color:var(--line)}
    [data-theme="dark"] .pchip,[data-theme="dark"] .goals li,[data-theme="dark"] .empty,
    [data-theme="dark"] .pmiss,[data-theme="dark"] .auth-switch{background:#111b18;border-color:var(--line);color:var(--ink)}
    [data-theme="dark"] .c-icon,[data-theme="dark"] .app-message .app-icon,[data-theme="dark"] .cmodal-icon{background:#1b2925;border-color:var(--line)}
    [data-theme="dark"] .ec-head{background:linear-gradient(180deg,#1b1718,#141f1c)}
    [data-theme="dark"] .nav a{color:#bdccc7}
    [data-theme="dark"] .nav a:hover,[data-theme="dark"] .nav a.active{color:#77d8aa}
    [data-theme="dark"] .brand-text strong,[data-theme="dark"] .contact-title,[data-theme="dark"] .pgrp{color:var(--green-dark)}
    [data-theme="dark"] .donor-name,[data-theme="dark"] .details strong,[data-theme="dark"] .c-val,
    [data-theme="dark"] .app-message h3,[data-theme="dark"] .cmodal h3{color:var(--ink)}
    [data-theme="dark"] .modal-head,[data-theme="dark"] .app-modal-footer,[data-theme="dark"] .cmodal-footer{border-color:var(--line)}
    [data-theme="dark"] .menu-btn{color:var(--ink)}
    @media(max-width:920px){[data-theme="dark"] .site-header,[data-theme="dark"] .nav{background:#141f1c;border-color:var(--line)}}`;

/* ═══════════════════════════════════════════════════════════════════
   Static UI — মূল index.html-এর <body> মার্কআপ হুবহু JSX-এ
   ═══════════════════════════════════════════════════════════════════ */
function StaticShell() {
  return (
    <>
      {" "}
      <header className="site-header">
        {" "}
        <div className="container nav-shell">
          {" "}
          <a className="brand" href={appBase()} data-route="home" aria-label="চকবাজার ব্লাড ডোনার'স ক্লাব হোম">
            <img className="logo" data-logo={true} alt="CBDC লোগো" />
            <span className="brand-text">
              <strong>
                {SITE.name}
              </strong>
              <small>
                {SITE.tagline}
              </small>
            </span>
          </a>
          {" "}
          <button className="menu-btn" id="menuBtn" type="button" aria-label="মেনু খুলুন" aria-expanded="false">
            {"☰"}
          </button>
          {" "}
          <div className="nav-overlay" id="navOverlay" aria-hidden="true">
          </div>
          {" "}
          <nav className="nav" id="mainNav" aria-label="প্রধান নেভিগেশন">
            {" "}
            <a href={appBase()} data-route="home" className="active">
              {"হোম"}
            </a>
            {" "}
            <a href={appBase()+"login"} data-route="dashboard">
              {"লগইন"}
            </a>
            {" "}
            <a href={appBase()+"signup"} data-route="signup">
              {"অ্যাকাউন্ট তৈরি"}
            </a>
            {" "}
            <a href={appBase()+"donor-search"} data-route="homeSearch">
              {"ডোনার খুঁজুন"}
            </a>
            {" "}
            <a href={appBase()+"register"} data-route="register">
              {"ডোনার নিবন্ধন"}
            </a>
            {" "}
            <a href={appBase()+"emergency"} data-route="emergency">
              {"ইমারজেন্সি আবেদন"}
            </a>
            {" "}
            <a href={appBase()+"eligibility"} data-route="eligibility">
              {"ডোনার যোগ্যতা"}
            </a>
            {" "}
            <a href={appBase()+"about"} data-route="homeAbout">
              {"আমাদের সম্পর্কে"}
            </a>
            {" "}
          </nav>
          {" "}
        </div>
        {" "}
      </header>
      {" "}
      <main>
        {" "}
        {/* HOME */}
        {" "}
        <section className="view active" id="view-home" data-view="home">
          {" "}
          <section className="hero" aria-labelledby="heroTitle">
            <div className="container hero-grid">
              {" "}
              <div className="hero-visual">
                <div className="hero-logo-wrap">
                  <img className="hero-logo" data-logo={true} alt="চকবাজার ব্লাড ডোনার'স ক্লাব লোগো" />
                </div>
                <div className="hero-badge">
                  {"অনুমোদিত রক্তদাতা নেটওয়ার্ক"}
                </div>
                <div className="hero-float">
                  {"🩸 ২৪ ঘণ্টা মানবিক সহায়তা"}
                </div>
              </div>
              {" "}
              <div className="hero-content">
                <div className="hero-kicker">
                  <span>
                  </span>
                  {" চকবাজার • চট্টগ্রাম"}
                </div>
                <h1 id="heroTitle">
                  {"এক ব্যাগ রক্ত,"}
                  <em>
                    {"একটি নতুন জীবন"}
                  </em>
                </h1>
                <p className="hero-desc">
                  {"চকবাজার, বাকলিয়া, কোতোয়ালি ও চাঁদগাঁওসহ সমগ্র চট্টগ্রামে জরুরি রক্তের প্রয়োজনে ভেরিফাইড রক্তদাতাদের সাথে এখনই যোগাযোগ করুন।"}
                </p>
                <div className="hero-actions">
                  <a className="btn btn-red" href={appBase()+"donor-search"} data-route="homeSearch">
                    {"রক্তদাতা খুঁজুন "}
                    <span>
                      {"→"}
                    </span>
                  </a>
                  <a className="btn btn-outline" href={appBase()+"register"} data-route="register">
                    {"রক্তদাতা হিসেবে যোগ দিন"}
                  </a>
                </div>
                <div className="stats">
                  <div className="stat">
                    <strong id="statDonors">
                      {"০"}
                    </strong>
                    <span>
                      {"অনুমোদিত রক্তদাতা"}
                    </span>
                  </div>
                  <div className="stat">
                    <strong id="statEligible">
                      {"০"}
                    </strong>
                    <span>
                      {"আজ যোগাযোগযোগ্য"}
                    </span>
                  </div>
                  <div className="stat">
                    <strong id="statAreas">
                      {"০"}
                    </strong>
                    <span>
                      {"প্রধান এলাকা"}
                    </span>
                  </div>
                </div>
              </div>
              {" "}
            </div>
          </section>
          {" "}
          <section className="search-overlap" id="donor-search">
            <div className="container">
              <div className="search-card">
                <div className="search-head">
                  <div>
                    <h2>
                      {"রক্তের গ্রুপ এবং থানা নির্বাচন করে রক্তদাতা খুঁজুন:"}
                    </h2>
                    <p>
                      {"শুধুমাত্র Approved এবং শেষ রক্তদানের পর অন্তত ৯০ দিন পূর্ণ হওয়া দাতারা দেখাবে।"}
                    </p>
                  </div>
                  <span className="rule">
                    {"৯০ দিনের যোগ্যতা সক্রিয়"}
                  </span>
                </div>
                <form className="search-form" id="searchForm">
                  <div className="field">
                    <label htmlFor="searchGroup">
                      {"রক্তের গ্রুপ"}
                    </label>
                    <select id="searchGroup">
                      <option value="">
                        {"সকল রক্তের গ্রুপ"}
                      </option>
                      <option>
                        {"A+"}
                      </option>
                      <option>
                        {"A-"}
                      </option>
                      <option>
                        {"B+"}
                      </option>
                      <option>
                        {"B-"}
                      </option>
                      <option>
                        {"AB+"}
                      </option>
                      <option>
                        {"AB-"}
                      </option>
                      <option>
                        {"O+"}
                      </option>
                      <option>
                        {"O-"}
                      </option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="searchArea">
                      {"থানা / এলাকা"}
                    </label>
                    <select id="searchArea">
                      <option value="">
                        {"সকল থানা"}
                      </option>
                      <option>
                        {"চকবাজার"}
                      </option>
                      <option>
                        {"বাকলিয়া"}
                      </option>
                      <option>
                        {"কোতোয়ালী"}
                      </option>
                      <option>
                        {"চাঁদগাঁও"}
                      </option>
                      <option>
                        {"পাঁচলাইশ"}
                      </option>
                    </select>
                  </div>
                  <button className="btn btn-green" type="button" id="searchRefresh" title="তালিকা রিফ্রেশ করুন">
                    {"↻ রিফ্রেশ"}
                  </button>
                </form>
                <div className="result-meta">
                  <h3>
                    {"রক্তদাতার তালিকা"}
                  </h3>
                  <span id="resultCount" className="muted">
                    {"লোড হচ্ছে..."}
                  </span>
                </div>
                <div className="donor-grid" id="donorResults">
                </div>
              </div>
            </div>
          </section>
          {" "}
          <section className="section emergency-section" id="live-board">
            <div className="container">
              <div className="heading">
                <span className="eyebrow">
                  {"লাইভ সহায়তা বোর্ড"}
                </span>
                <h2>
                  {"অনুমোদিত জরুরি রক্তের আবেদন"}
                </h2>
                <p>
                  {"অ্যাডমিন কর্তৃক যাচাই ও অনুমোদনের পরই আবেদনগুলো এই বোর্ডে প্রকাশিত হয়।"}
                </p>
              </div>
              <div className="emergency-grid" id="emergencyBoard">
              </div>
            </div>
          </section>
          {" "}
          <section className="section alt" id="about">
            {" "}
            <div className="container">
              {" "}
              <div className="heading" style={{ marginBottom: "24px" }}>
                {" "}
                <span className="eyebrow">
                  {"আমাদের পরিচিতি"}
                </span>
                {" "}
                <h2>
                  {`${SITE.name} (${SITE.short})`}
                </h2>
                {" "}
              </div>
              {" "}
              {/* গ্যালারি সেকশন (হাত দিয়ে সোয়াইপযোগ্য স্লাইডার) */}
              {" "}
              <div id="gallery" style={{ marginBottom: "34px" }}>
                {" "}
                <div className="gslider" id="gallerySlider">
                  {" "}
                  <div id="galleryTrack">
                  </div>
                  {" "}
                </div>
                {" "}
                <div className="gdots" id="galleryDots">
                </div>
                {" "}
              </div>
              {" "}
              {/* তারপর: বাকি অংশ */}
              {" "}
              <div className="about-grid">
                {" "}
                <div className="about-copy">
                  {" "}
                  <p className="about-subtitle" style={{ fontSize: "1.12rem", marginBottom: "16px" }}>
                    {"মানবতার সেবায় আমরা রক্তদাতা • রক্ত দিন জীবন বাঁচান"}
                  </p>
                  {" "}
                  <p style={{ marginBottom: "6px" }}>
                    <strong>
                      {"আমাদের লক্ষ্য ও উদ্দেশ্য"}
                    </strong>
                  </p>
                  {" "}
                  <p>
                    {"চকবাজার ব্লাড ডোনার'স ক্লাব (CBDC) চট্টগ্রামের চকবাজার, বাকলিয়া, কোতোয়ালী, চাঁদগাঁওসহ সমগ্র চট্টগ্রামে রক্তদানের মাধ্যমে মানুষের পাশে দাঁড়ানোর একটি নিবেদিতপ্রাণ স্বেচ্ছাসেবী সামাজিক সংগঠন। আমাদের মূল লক্ষ্য হলো রক্তের অভাবে যাতে কোনো মুমূর্ষু রোগী মারা না যায়।"}
                  </p>
                  {" "}
                  <ul className="goals">
                    {" "}
                    <li>
                      {"নিঃস্বার্থ রক্তদানে তরুণ প্রজন্মকে উদ্বুদ্ধ করা।"}
                    </li>
                    {" "}
                    <li>
                      {"২৪ ঘণ্টা জরুরি রক্তের প্রয়োজনে রোগীদের দ্রুত রক্তদাতা খুঁজে দেওয়া।"}
                    </li>
                    {" "}
                    <li>
                      {"রক্তদান সংক্রান্ত সকল ভ্রান্ত ধারণা দূর করা।"}
                    </li>
                    {" "}
                    <li>
                      {"নিরাপদ ও স্বেচ্ছায় রক্তদানের সংস্কৃতি গড়ে তোলা।"}
                    </li>
                    {" "}
                    <li>
                      {"মানবিক ও সামাজিক কর্মকাণ্ডে সক্রিয় অংশগ্রহণ নিশ্চিত করা।"}
                    </li>
                    {" "}
                  </ul>
                  {" "}
                </div>
                {" "}
                <aside className="contact-card">
                  {" "}
                  <h3 className="contact-title">
                    {"যে কোনো সমস্যা হলে আমাদের সাথে যোগাযোগ করুন"}
                  </h3>
                  {" "}
                  <p className="contact-desc">
                    {"রক্তের প্রয়োজন, জরুরি সহায়তা বা যেকোনো তথ্যের জন্য আমাদের সাথে যোগাযোগ করুন।"}
                  </p>
                  {" "}
                  <div className="contact-items">
                    {" "}
                    <a href={"tel:" + SITE.phoneIntl} className="c-item">
                      {" "}
                      <div className="c-icon">
                        {"📞"}
                      </div>
                      {" "}
                      <div className="c-text">
                        {" "}
                        <span className="c-label">
                          {"কল করুন"}
                        </span>
                        {" "}
                        <strong className="c-val">
                          {SITE.phoneIntl}
                        </strong>
                        {" "}
                      </div>
                      {" "}
                    </a>
                    {" "}
                    <a href={"https://wa.me/" + SITE.whatsapp} target="_blank" rel="noopener" className="c-item">
                      {" "}
                      <div className="c-icon">
                        {"💬"}
                      </div>
                      {" "}
                      <div className="c-text">
                        {" "}
                        <span className="c-label">
                          {"এডমিন WhatsApp"}
                        </span>
                        {" "}
                        <strong className="c-val">
                          {"WhatsApp-এ যোগাযোগ করুন"}
                        </strong>
                        {" "}
                      </div>
                      {" "}
                    </a>
                    {" "}
                    <a href={"mailto:" + SITE.email} className="c-item">
                      {" "}
                      <div className="c-icon">
                        {"✉"}
                      </div>
                      {" "}
                      <div className="c-text">
                        {" "}
                        <span className="c-label">
                          {"ইমেইল"}
                        </span>
                        {" "}
                        <strong className="c-val">
                          {SITE.email}
                        </strong>
                        {" "}
                      </div>
                      {" "}
                    </a>
                    {" "}
                  </div>
                  {" "}
                  <div className="social-btns">
                    {" "}
                    <a href={SITE.facebookGroup} target="_blank" rel="noopener" className="s-btn s-group">
                      {" "}
                      <i className="fa-brands fa-facebook-f" aria-hidden="true">
                      </i>
                      {" গ্রুপে যুক্ত হোন "}
                    </a>
                    {" "}
                    <a href={SITE.facebookPage} target="_blank" rel="noopener" className="s-btn s-page">
                      {" "}
                      <i className="fa-brands fa-facebook-f" aria-hidden="true">
                      </i>
                      {" পেজে যুক্ত হোন "}
                    </a>
                    {" "}
                  </div>
                  {" "}
                </aside>
                {" "}
              </div>
              {" "}
            </div>
            {" "}
          </section>
          {" "}
        </section>
        {" "}
        {/* REGISTER */}
        {" "}
        <section className="view" id="view-register" data-view="register">
          <div className="page-hero">
            <div className="container page-hero-grid">
              <div>
                <span className="eyebrow">
                  {"স্বেচ্ছাসেবী হোন"}
                </span>
                <h1>
                  {"নতুন সদস্য নিবন্ধন"}
                </h1>
                <p>
                  <strong>
                    {"রক্তদাতা হিসেবে যোগদান করুন"}
                  </strong>
                  <br />
                  {"চকবাজার ব্লাড ডোনার্স ক্লাবের সাথে যুক্ত হয়ে মানুষের জীবন বাঁচান।"}
                </p>
              </div>
              <div className="page-mark">
                <img data-logo={true} alt="CBDC লোগো" />
              </div>
            </div>
          </div>
          <section className="form-section">
            <div className="narrow">
              <div className="form-card">
                <div className="alert">
                  {"⚠️ "}
                  <span>
                    <strong>
                      {"জরুরি বিজ্ঞপ্তি:"}
                    </strong>
                    {" নিবন্ধনের পর আপনার প্রোফাইলটি 'অনুমোদনের অপেক্ষায় (Pending)' অবস্থায় থাকবে। CBDC কেন্দ্রীয় অ্যাডমিন কর্তৃক সকল তথ্য যাচাইয়ের পর আপনার প্রোফাইল পাবলিক রক্তদাতা তালিকায় প্রকাশ করা হবে।"}
                  </span>
                </div>
                <div id="registerMessage" className="hidden">
                </div>
                <form id="registerForm" noValidate={true}>
                  <h2 className="form-title">
                    <span>
                      {"১"}
                    </span>
                    {" প্রাথমিক ও ব্যক্তিগত তথ্য"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label className="required" htmlFor="donorName">
                        {"নাম"}
                      </label>
                      <input id="donorName" name="name" required={true} placeholder="আপনার পূর্ণ নাম" />
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="donorGroup">
                        {"রক্তের গ্রুপ"}
                      </label>
                      <select id="donorGroup" name="bloodGroup" required={true}>
                        <option value="">
                          {"রক্তের গ্রুপ নির্বাচন করুন"}
                        </option>
                        <option>
                          {"A+"}
                        </option>
                        <option>
                          {"A-"}
                        </option>
                        <option>
                          {"B+"}
                        </option>
                        <option>
                          {"B-"}
                        </option>
                        <option>
                          {"AB+"}
                        </option>
                        <option>
                          {"AB-"}
                        </option>
                        <option>
                          {"O+"}
                        </option>
                        <option>
                          {"O-"}
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="gender">
                        {"লিঙ্গ"}
                      </label>
                      <select id="gender" name="gender" required={true}>
                        <option value="">
                          {"লিঙ্গ নির্বাচন করুন"}
                        </option>
                        <option>
                          {"পুরুষ"}
                        </option>
                        <option>
                          {"মহিলা"}
                        </option>
                        <option>
                          {"অন্যান্য"}
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="donorAge">
                        {"বয়স (বছর)"}
                      </label>
                      <input id="donorAge" name="age" type="number" min="1" max="100" placeholder="যেমন: ২৪" />
                    </div>
                  </div>
                  <h2 className="form-title">
                    <span>
                      {"২"}
                    </span>
                    {" ঠিকানা ও যোগাযোগের মাধ্যম"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label className="required" htmlFor="district">
                        {"জেলা"}
                      </label>
                      <input id="district" value="চট্টগ্রাম" readOnly={true} />
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="donorArea">
                        {"থানা / এলাকা"}
                      </label>
                      <select id="donorArea" name="area" required={true}>
                        <option value="">
                          {"থানা / এলাকা নির্বাচন করুন"}
                        </option>
                        <option>
                          {"চকবাজার"}
                        </option>
                        <option>
                          {"বাকলিয়া"}
                        </option>
                        <option>
                          {"কোতোয়ালী"}
                        </option>
                        <option>
                          {"চাঁদগাঁও"}
                        </option>
                        <option>
                          {"পাঁচলাইশ"}
                        </option>
                      </select>
                    </div>
                    <div className="field full">
                      <label htmlFor="donorAddress">
                        {"বিস্তারিত ঠিকানা"}
                      </label>
                      <textarea id="donorAddress" name="address" placeholder="বাসা/রোড/এলাকার বিস্তারিত ঠিকানা">
                      </textarea>
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="donorPhone">
                        {"মোবাইল নম্বর (১১ ডিজিট)"}
                      </label>
                      <input id="donorPhone" name="phone" required={true} inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                      <span className="note">
                        {`উদাহরণ: ${SITE.phone}`}
                      </span>
                    </div>
                    <div className="field">
                      <label htmlFor="donorWhatsapp">
                        {"WhatsApp নম্বর "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <input id="donorWhatsapp" name="whatsapp" inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                    </div>
                  </div>
                  <h2 className="form-title">
                    <span>
                      {"৩"}
                    </span>
                    {" স্বাস্থ্য ও রক্তদানের ইতিহাস"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="lastDonation">
                        {"সর্বশেষ রক্তদানের তারিখ "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <input id="lastDonation" name="lastDonationDate" type="date" />
                    </div>
                    <div className="field">
                      <label htmlFor="healthNotes">
                        {"শারীরিক সুস্থতা / কোনো রোগ আছে কি?"}
                      </label>
                      <textarea id="healthNotes" name="healthNotes" placeholder="বর্তমান শারীরিক অবস্থা বা উল্লেখযোগ্য রোগের কথা লিখুন">
                      </textarea>
                    </div>
                  </div>
                  <label className="check">
                    <input id="donorAgree" type="checkbox" required={true} />
                    <span>
                      {"আমি অঙ্গীকার করছি যে, আমার প্রদত্ত সকল তথ্য সঠিক। আমি স্বেচ্ছায় রক্তদানে প্রস্তুত এবং ক্লাবের সকল নিয়মাবলী মেনে চলতে সম্মত।"}
                    </span>
                  </label>
                  <div className="form-actions">
                    <button className="btn btn-green" type="submit">
                      {"রক্তদাতা হিসেবে নিবন্ধন সম্পন্ন করুন "}
                      <span>
                        {"→"}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </section>
        {" "}
        {/* ELIGIBILITY */}
        {" "}
        {/* রক্তদাতা প্রোফাইল — নিজস্ব পেজ (#profile/ID)। মেনুতে নেই, তালিকা থেকে খোলে। */}
        {" "}
        <section className="view" id="view-profile" data-view="profile">
          {" "}
          <div className="page-hero">
            <div className="container page-hero-grid">
              {" "}
              <div>
                <span className="eyebrow">
                  {"রক্তদাতার তথ্য"}
                </span>
                <h1>
                  {"রক্তদাতা প্রোফাইল"}
                </h1>
              </div>
              {" "}
            </div>
          </div>
          {" "}
          <section className="form-section">
            <div className="narrow">
              {" "}
              <a className="prof-back" href={appBase()+"donor-search"} data-route="homeSearch">
                {"← রক্তদাতা তালিকায় ফিরুন"}
              </a>
              {" "}
              <div id="profileBody">
              </div>
              {" "}
            </div>
          </section>
          {" "}
        </section>
        {" "}
        <section className="view" id="view-eligibility" data-view="eligibility">
          <div className="page-hero">
            <div className="container page-hero-grid">
              <div>
                <span className="eyebrow">
                  {"নিরাপদ রক্তদান"}
                </span>
                <h1>
                  {"🩸 আমি কি আজ রক্ত দিতে পারব?"}
                </h1>
                <p>
                  {"নিচের তথ্যগুলো দিয়ে রক্তদানের আগে একটি প্রাথমিক যোগ্যতা যাচাই করুন।"}
                </p>
              </div>
              <div className="page-mark">
                <img data-logo={true} alt="CBDC লোগো" />
              </div>
            </div>
          </div>
          <section className="form-section">
            <div className="container eligibility-layout">
              <aside className="info-panel">
                <h2>
                  {"সাধারণ শর্তাবলী"}
                </h2>
                <p>
                  {"এটি একটি প্রাথমিক নির্দেশনামূলক যাচাই। চূড়ান্ত সিদ্ধান্তের জন্য চিকিৎসক বা রক্ত সংগ্রহ কেন্দ্রের পরামর্শ নিন।"}
                </p>
                <ul className="info-list">
                  <li>
                    {"আপনার বয়স ১৮ থেকে ৬০ বছরের মধ্যে হতে হবে।"}
                  </li>
                  <li>
                    {"সর্বশেষ রক্তদানের পর কমপক্ষে ৯০ দিন অতিক্রম হতে হবে।"}
                  </li>
                  <li>
                    {"বর্তমানে আপনি শারীরিকভাবে সুস্থ থাকতে হবে।"}
                  </li>
                </ul>
              </aside>
              <div className="form-card">
                <div id="eligibilityMessage" className="hidden">
                </div>
                <form id="eligibilityForm" noValidate={true}>
                  <div className="field">
                    <label className="required" htmlFor="lastRange">
                      {"সর্বশেষ কবে রক্ত দিয়েছেন?"}
                    </label>
                    <select id="lastRange" required={true}>
                      <option value="">
                        {"একটি অপশন নির্বাচন করুন"}
                      </option>
                      <option value="never">
                        {"আমি আগে কখনও রক্ত দিইনি"}
                      </option>
                      <option value="under3">
                        {"৩ মাসের কম"}
                      </option>
                      <option value="3to6">
                        {"৩–৬ মাস আগে"}
                      </option>
                      <option value="6to12">
                        {"৬–১২ মাস আগে"}
                      </option>
                      <option value="over1">
                        {"১ বছরের বেশি আগে"}
                      </option>
                    </select>
                  </div>
                  <div className="field" style={{ marginTop: "16px" }}>
                    <label className="required" htmlFor="age">
                      {"আপনার বয়স (বছর)"}
                    </label>
                    <input id="age" type="number" min="1" max="120" placeholder="যেমন: ২৪" required={true} />
                  </div>
                  <label className="check">
                    <input id="healthCheck" type="checkbox" required={true} />
                    <span>
                      {"আমি বর্তমানে সম্পূর্ণ সুস্থ এবং কোনো বড় অসুস্থতা নেই।"}
                    </span>
                  </label>
                  <div className="form-actions">
                    <button className="btn btn-green" type="submit">
                      {"যোগ্যতা পরীক্ষা করুন "}
                      <span>
                        {"→"}
                      </span>
                    </button>
                  </div>
                </form>
                <div id="eligibilityResult" className="hidden">
                </div>
              </div>
            </div>
          </section>
        </section>
        {" "}
        {/* EMERGENCY */}
        {" "}
        <section className="view" id="view-emergency" data-view="emergency">
          <div className="page-hero">
            <div className="container page-hero-grid">
              <div>
                <span className="eyebrow">
                  {"জরুরি সহায়তা"}
                </span>
                <h1>
                  {"জরুরি রক্তের আবেদন"}
                </h1>
                <p>
                  {"রক্তের জরুরি প্রয়োজনে দ্রুত আবেদন করুন। যাচাইয়ের পর অনুমোদিত আবেদন লাইভ বোর্ডে প্রকাশিত হবে।"}
                </p>
              </div>
              <div className="page-mark">
                <img data-logo={true} alt="CBDC লোগো" />
              </div>
            </div>
          </div>
          <section className="form-section">
            <div className="narrow">
              <div className="form-card">
                <div className="alert">
                  {"⚠️ "}
                  <span>
                    <strong>
                      {"জরুরি বিজ্ঞপ্তি:"}
                    </strong>
                    {" আবেদন পাঠানোর পর CBDC কেন্দ্রীয় অ্যাডমিন তথ্য যাচাই করবেন। অনুমোদনের পর আবেদনটি পাবলিক লাইভ বোর্ডে প্রকাশিত হবে। অতিজরুরি ক্ষেত্রে সরাসরি হেল্পলাইনেও কল করুন: "}
                    <a href={"tel:" + SITE.phone}>
                      <strong>
                        {SITE.phone}
                      </strong>
                    </a>
                  </span>
                </div>
                <div id="emergencyMessage" className="hidden">
                </div>
                <form id="emergencyForm" noValidate={true}>
                  <h2 className="form-title">
                    <span>
                      {"১"}
                    </span>
                    {" 🩸 রোগীর তথ্য"}
                  </h2>
                  <div className="form-grid three">
                    <div className="field">
                      <label className="required" htmlFor="patientName">
                        {"রোগীর নাম"}
                      </label>
                      <input id="patientName" required={true} placeholder="রোগীর পূর্ণ নাম" />
                    </div>
                    <div className="field">
                      <label htmlFor="patientAge">
                        {"রোগীর বয়স"}
                      </label>
                      <input id="patientAge" type="number" min="0" placeholder="যেমন: ৩৫" />
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="requestGroup">
                        {"রক্তের গ্রুপ"}
                      </label>
                      <select id="requestGroup" required={true}>
                        <option value="">
                          {"গ্রুপ নির্বাচন করুন"}
                        </option>
                        <option>
                          {"A+"}
                        </option>
                        <option>
                          {"A-"}
                        </option>
                        <option>
                          {"B+"}
                        </option>
                        <option>
                          {"B-"}
                        </option>
                        <option>
                          {"AB+"}
                        </option>
                        <option>
                          {"AB-"}
                        </option>
                        <option>
                          {"O+"}
                        </option>
                        <option>
                          {"O-"}
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="bags">
                        {"প্রয়োজনীয় ব্যাগ সংখ্যা"}
                      </label>
                      <input id="bags" type="number" min="1" max="99" required={true} placeholder="যেমন: ২" />
                    </div>
                  </div>
                  <h2 className="form-title">
                    <span>
                      {"২"}
                    </span>
                    {" 🏥 হাসপাতালের তথ্য"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label className="required" htmlFor="hospital">
                        {"হাসপাতালের নাম"}
                      </label>
                      <input id="hospital" required={true} placeholder="হাসপাতালের নাম" />
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="hospitalAddress">
                        {"হাসপাতালের ঠিকানা / এলাকা"}
                      </label>
                      <input id="hospitalAddress" required={true} placeholder="যেমন: পাঁচলাইশ, চট্টগ্রাম" />
                    </div>
                    <div className="field full">
                      <label className="required" htmlFor="urgency">
                        <i className="fa-solid fa-clock" aria-hidden="true">
                        </i>
                        {" জরুরিতার সময়সীমা"}
                      </label>
                      <select id="urgency" required={true}>
                        <option value="">
                          {"সময়সীমা নির্বাচন করুন"}
                        </option>
                        <option value="1">
                          {"অতিজরুরি (১ ঘণ্টার মধ্যে)"}
                        </option>
                        <option value="2">
                          {"জরুরি (২ ঘণ্টার মধ্যে)"}
                        </option>
                        <option value="6">
                          {"৬ ঘণ্টার মধ্যে"}
                        </option>
                        <option value="12">
                          {"১২ ঘণ্টার মধ্যে"}
                        </option>
                        <option value="24">
                          {"আজকের মধ্যে (২৪ ঘণ্টা)"}
                        </option>
                        <option value="48">
                          {"২ দিন (৪৮ ঘণ্টা)"}
                        </option>
                        <option value="72">
                          {"৩ দিন (৭২ ঘণ্টা)"}
                        </option>
                      </select>
                    </div>
                  </div>
                  <h2 className="form-title">
                    <span>
                      {"৩"}
                    </span>
                    {" "}
                    <i className="fa-solid fa-user" aria-hidden="true">
                    </i>
                    {" যোগাযোগকারীর তথ্য"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label className="required" htmlFor="requester">
                        {"যোগাযোগকারীর নাম"}
                      </label>
                      <input id="requester" required={true} placeholder="আপনার নাম" />
                    </div>
                    <div className="field">
                      <label className="required" htmlFor="requestPhone">
                        {"মোবাইল নম্বর"}
                      </label>
                      <input id="requestPhone" required={true} inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                    </div>
                    <div className="field">
                      <label htmlFor="requestWhatsapp">
                        {"WhatsApp নম্বর "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <input id="requestWhatsapp" inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                    </div>
                  </div>
                  <h2 className="form-title">
                    <span>
                      {"৪"}
                    </span>
                    {" 📝 অতিরিক্ত তথ্য"}
                  </h2>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="description">
                        {"রোগীর সমস্যার সংক্ষিপ্ত বিবরণ"}
                      </label>
                      <textarea id="description" placeholder="রোগীর অবস্থা বা অপারেশনের তথ্য">
                      </textarea>
                    </div>
                    <div className="field">
                      <label htmlFor="instructions">
                        {"অতিরিক্ত নির্দেশনা "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <textarea id="instructions" placeholder="দাতার জন্য কোনো বিশেষ নির্দেশনা থাকলে লিখুন">
                      </textarea>
                    </div>
                  </div>
                  <label className="check">
                    <input id="requestAgree" type="checkbox" required={true} />
                    <span>
                      {"আমি নিশ্চিত করছি যে, উপরের সকল তথ্য সঠিক এবং রক্তের প্রয়োজনটি বাস্তব।"}
                    </span>
                  </label>
                  <div className="form-actions">
                    <button className="btn btn-red" type="submit">
                      {"জরুরি আবেদন সাবমিট করুন "}
                      <span>
                        {"→"}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </section>
        {" "}
        {/* LOGIN */}
        {" "}
        <section className="view" id="view-login" data-view="login">
          <div className="admin-wrap">
            <div className="container">
              <div id="loginBox" className="login-card auth-card">
                <div className="login-brand">
                  <img data-logo={true} alt="CBDC লোগো" />
                  <div>
                    <strong>
                      {SITE.name}
                    </strong>
                    <small>
                      {SITE.tagline}
                    </small>
                  </div>
                </div>
                <h1>
                  {"লগইন"}
                </h1>
                <p>
                  {"আপনার অ্যাকাউন্টে প্রবেশ করতে নিচের তথ্য ব্যবহার করুন।"}
                </p>
                <div id="loginMessage" className="hidden">
                </div>
                <form id="loginForm" noValidate={true}>
                  <div className="field">
                    <label className="required" htmlFor="username">
                      {"ইমেইল / ইউজার নেইম"}
                    </label>
                    <input id="username" name="identifier" autoComplete="username" required={true} placeholder="আপনার ইমেইল অথবা ইউজার নেইম লিখুন" />
                  </div>
                  <div className="field" style={{ marginTop: "14px" }}>
                    <label className="required" htmlFor="password">
                      {"পাসওয়ার্ড"}
                    </label>
                    <div className="pw-wrap">
                      <input id="password" type="password" autoComplete="current-password" placeholder="আপনার পাসওয়ার্ড লিখুন" required={true} />
                      <button className="pw-toggle" type="button" data-pw-toggle="password" aria-label="পাসওয়ার্ড দেখান">
                        <svg className="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <svg className="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5.1 0 8.6 3.6 9.94 6.65a1 1 0 0 1 0 .7 12.9 12.9 0 0 1-2.28 3.4" />
                          <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.4 15.4 6.9 19 12 19a10.5 10.5 0 0 0 5.39-1.61" />
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M3 3l18 18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button className="btn btn-green" type="submit" style={{ width: "100%", marginTop: "19px" }}>
                    {"লগইন করুন "}
                    <span>
                      {"→"}
                    </span>
                  </button>
                </form>
                <div className="auth-forgot">
                  <a id="btnForgotPass" role="button" tabIndex="0">
                    {"পাসওয়ার্ড ভুলে গেছেন?"}
                  </a>
                </div>
                <div className="auth-or">
                  {"অথবা"}
                </div>
                <button className="btn-google" id="btnGoogleLogin" type="button">
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>
                    {"Google দিয়ে লগইন করুন"}
                    <small>
                      {"Sign in with Google"}
                    </small>
                  </span>
                </button>
                <div className="auth-switch">
                  <h3>
                    {"নতুন এখানে?"}
                  </h3>
                  <p>
                    {"চকবাজার ব্লাড ডোনার'স ক্লাবে যুক্ত হতে নতুন একটি অ্যাকাউন্ট তৈরি করুন।"}
                  </p>
                  <a className="btn btn-outline" href={appBase()+"signup"} data-route="signup" style={{ width: "100%" }}>
                    {"অ্যাকাউন্ট তৈরি করুন"}
                  </a>
                </div>
              </div>
              {" "}
              <div id="alreadyBox" className="login-card hidden">
                <div className="login-brand">
                  <img data-logo={true} alt="CBDC লোগো" />
                  <div>
                    <strong>
                      {SITE.name}
                    </strong>
                    <small>
                      {"কেন্দ্রীয় প্রশাসনিক প্যানেল"}
                    </small>
                  </div>
                </div>
                <h1>
                  {"✅ লগইন সক্রিয় আছে"}
                </h1>
                <p id="alreadyTitle">
                  {"—"}
                </p>
                <a id="alreadyLink" className="btn btn-green" href="/" style={{ width: "100%", marginTop: "6px" }}>
                  {"ড্যাশবোর্ডে যান "}
                  <span>
                    {"→"}
                  </span>
                </a>
                <button id="btnSwitchAccount" className="btn btn-outline" type="button" style={{ width: "100%", marginTop: "10px" }}>
                  {"অন্য অ্যাকাউন্টে লগইন করুন"}
                </button>
              </div>
              {" "}
            </div>
          </div>
        </section>
        {" "}
        {/* SIGNUP / নতুন অ্যাকাউন্ট তৈরি */}
        {" "}
        <section className="view" id="view-signup" data-view="signup">
          <div className="page-hero">
            <div className="container page-hero-grid">
              <div>
                <span className="eyebrow">
                  {"যুক্ত হোন"}
                </span>
                <h1>
                  {"নতুন অ্যাকাউন্ট তৈরি করুন"}
                </h1>
                <p>
                  <strong>
                    {"চকবাজার ব্লাড ডোনার'স ক্লাবে একটি অ্যাকাউন্ট তৈরি করুন"}
                  </strong>
                  <br />
                  {"এবং আমাদের রক্তদাতা নেটওয়ার্কের সাথে যুক্ত হোন।"}
                </p>
              </div>
              <div className="page-mark">
                <img data-logo={true} alt="CBDC লোগো" />
              </div>
            </div>
          </div>
          <section className="form-section">
            <div className="narrow">
              <div className="form-card">
                <div id="signupGoogleChip" className="google-chip hidden">
                  <img id="sgAvatar" alt="প্রোফাইল ছবি" />
                  <div>
                    <strong id="sgName">
                      {"—"}
                    </strong>
                    <small id="sgEmail">
                      {"—"}
                    </small>
                  </div>
                  <span className="verified">
                    {"Google ✓"}
                  </span>
                </div>
                <div className="info-note">
                  {"ℹ️ "}
                  <span>
                    {"অ্যাকাউন্ট তৈরি হওয়ার সাথে সাথেই আপনি "}
                    <strong>
                      {"লগইন করতে পারবেন"}
                    </strong>
                    {" — কোনো অনুমোদনের অপেক্ষা নেই। রক্তদাতা হিসেবে আপনার তথ্য অ্যাডমিন যাচাইয়ের পর পাবলিক তালিকায় যুক্ত হবে।"}
                  </span>
                </div>
                <div id="signupMessage" className="hidden">
                </div>
                <form id="signupForm" noValidate={true}>
                  {" "}
                  <h2 className="form-title">
                    <span>
                      {"১"}
                    </span>
                    {" ব্যক্তিগত তথ্য"}
                  </h2>
                  {" "}
                  <div className="form-grid">
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suName">
                        {"নাম"}
                      </label>
                      <input id="suName" name="name" required={true} placeholder="আপনার পূর্ণ নাম" />
                      <span id="suNameSuggest" className="suggest-note hidden">
                      </span>
                    </div>
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suUsername">
                        {"ইউজার নেইম"}
                      </label>
                      <input id="suUsername" name="username" required={true} autoComplete="username" placeholder="যেমন: shahadat_cbdc" />
                      <span className="note">
                        {"ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও আন্ডারস্কোর ব্যবহার করুন।"}
                      </span>
                    </div>
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suEmail">
                        {"ইমেইল"}
                      </label>
                      <input id="suEmail" name="email" type="email" required={true} autoComplete="email" placeholder="example@gmail.com" />
                      <span id="suEmailNote" className="note hidden">
                        <span className="lock-hint">
                          {"🔒 Google-এ যাচাইকৃত ইমেইল — পরিবর্তন করা যাবে না।"}
                        </span>
                      </span>
                    </div>
                    {" "}
                    <div className="field" id="suPassField">
                      <label className="required" htmlFor="suPassword">
                        {"পাসওয়ার্ড"}
                      </label>
                      <div className="pw-wrap">
                        <input id="suPassword" name="password" type="password" autoComplete="new-password" required={true} minLength="6" placeholder="কমপক্ষে ৬ অক্ষর" />
                        <button className="pw-toggle" type="button" data-pw-toggle="suPassword" aria-label="পাসওয়ার্ড দেখান">
                          <svg className="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <svg className="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5.1 0 8.6 3.6 9.94 6.65a1 1 0 0 1 0 .7 12.9 12.9 0 0 1-2.28 3.4" />
                            <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.4 15.4 6.9 19 12 19a10.5 10.5 0 0 0 5.39-1.61" />
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <path d="M3 3l18 18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {" "}
                    <div className="field" id="suPass2Field">
                      <label className="required" htmlFor="suPassword2">
                        {"পাসওয়ার্ড নিশ্চিত করুন"}
                      </label>
                      <div className="pw-wrap">
                        <input id="suPassword2" type="password" autoComplete="new-password" required={true} minLength="6" placeholder="পুনরায় পাসওয়ার্ড লিখুন" />
                        <button className="pw-toggle" type="button" data-pw-toggle="suPassword2" aria-label="পাসওয়ার্ড দেখান">
                          <svg className="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <svg className="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5.1 0 8.6 3.6 9.94 6.65a1 1 0 0 1 0 .7 12.9 12.9 0 0 1-2.28 3.4" />
                            <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.4 15.4 6.9 19 12 19a10.5 10.5 0 0 0 5.39-1.61" />
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <path d="M3 3l18 18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {" "}
                  </div>
                  {" "}
                  <h2 className="form-title">
                    <span>
                      {"২"}
                    </span>
                    {" রক্তদাতা সম্পর্কিত তথ্য"}
                  </h2>
                  {" "}
                  <div className="form-grid">
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suGroup">
                        {"রক্তের গ্রুপ"}
                      </label>
                      <select id="suGroup" name="bloodGroup" required={true}>
                        <option value="">
                          {"রক্তের গ্রুপ নির্বাচন করুন"}
                        </option>
                        <option>
                          {"A+"}
                        </option>
                        <option>
                          {"A-"}
                        </option>
                        <option>
                          {"B+"}
                        </option>
                        <option>
                          {"B-"}
                        </option>
                        <option>
                          {"AB+"}
                        </option>
                        <option>
                          {"AB-"}
                        </option>
                        <option>
                          {"O+"}
                        </option>
                        <option>
                          {"O-"}
                        </option>
                      </select>
                    </div>
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suGender">
                        {"লিঙ্গ"}
                      </label>
                      <select id="suGender" name="gender" required={true}>
                        <option value="">
                          {"লিঙ্গ নির্বাচন করুন"}
                        </option>
                        <option>
                          {"পুরুষ"}
                        </option>
                        <option>
                          {"মহিলা"}
                        </option>
                        <option>
                          {"অন্যান্য"}
                        </option>
                      </select>
                    </div>
                    {" "}
                    <div className="field">
                      <label htmlFor="suAge">
                        {"বয়স (বছর)"}
                      </label>
                      <input id="suAge" name="age" type="number" min="1" max="100" placeholder="যেমন: ২৪" />
                    </div>
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suArea">
                        {"এলাকা"}
                      </label>
                      <select id="suArea" name="area" required={true}>
                        <option value="">
                          {"থানা / এলাকা নির্বাচন করুন"}
                        </option>
                        <option>
                          {"চকবাজার"}
                        </option>
                        <option>
                          {"বাকলিয়া"}
                        </option>
                        <option>
                          {"কোতোয়ালী"}
                        </option>
                        <option>
                          {"চাঁদগাঁও"}
                        </option>
                        <option>
                          {"পাঁচলাইশ"}
                        </option>
                      </select>
                    </div>
                    {" "}
                  </div>
                  {" "}
                  <h2 className="form-title">
                    <span>
                      {"৩"}
                    </span>
                    {" যোগাযোগের তথ্য"}
                  </h2>
                  {" "}
                  <div className="form-grid">
                    {" "}
                    <div className="field">
                      <label className="required" htmlFor="suPhone">
                        {"মোবাইল নম্বর (১১ ডিজিট)"}
                      </label>
                      <input id="suPhone" name="phone" required={true} inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                      <span className="note">
                        {`উদাহরণ: ${SITE.phone}`}
                      </span>
                    </div>
                    {" "}
                    <div className="field">
                      <label htmlFor="suWhatsapp">
                        {"WhatsApp নম্বর "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <input id="suWhatsapp" name="whatsapp" inputMode="numeric" maxLength="11" placeholder="01XXXXXXXXX" />
                    </div>
                    {" "}
                    <div className="field full">
                      <label htmlFor="suAddress">
                        {"বিস্তারিত ঠিকানা"}
                      </label>
                      <textarea id="suAddress" name="address" placeholder="বাসা/রোড/এলাকার বিস্তারিত ঠিকানা">
                      </textarea>
                    </div>
                    {" "}
                  </div>
                  {" "}
                  <h2 className="form-title">
                    <span>
                      {"৪"}
                    </span>
                    {" রক্তদানের তথ্য"}
                  </h2>
                  {" "}
                  <div className="form-grid">
                    {" "}
                    <div className="field">
                      <label htmlFor="suLastDonation">
                        {"সর্বশেষ রক্তদানের তারিখ "}
                        <span className="muted">
                          {"(ঐচ্ছিক)"}
                        </span>
                      </label>
                      <input id="suLastDonation" name="lastDonationDate" type="date" />
                    </div>
                    {" "}
                    <div className="field">
                      <label htmlFor="suHealth">
                        {"শারীরিক সুস্থতা / কোনো রোগ আছে কি?"}
                      </label>
                      <textarea id="suHealth" name="healthNotes" placeholder="বর্তমান শারীরিক অবস্থা বা উল্লেখযোগ্য রোগের কথা লিখুন">
                      </textarea>
                    </div>
                    {" "}
                  </div>
                  {" "}
                  <h2 className="form-title">
                    <span>
                      {"৫"}
                    </span>
                    {" অঙ্গীকার"}
                  </h2>
                  {" "}
                  <label className="check">
                    <input id="suAgree" type="checkbox" required={true} />
                    <span>
                      {"আমি অঙ্গীকার করছি যে, আমার প্রদত্ত সকল তথ্য সঠিক। আমি স্বেচ্ছায় রক্তদানে প্রস্তুত এবং ক্লাবের সকল নিয়মাবলী মেনে চলতে সম্মত।"}
                    </span>
                  </label>
                  {" "}
                  <div className="form-actions">
                    <button className="btn btn-green" type="submit">
                      {"অ্যাকাউন্ট তৈরি করুন "}
                      <span>
                        {"→"}
                      </span>
                    </button>
                  </div>
                  {" "}
                </form>
                {" "}
                <div className="signup-or">
                  <div className="auth-or">
                    {"অথবা"}
                  </div>
                  <button className="btn-google" id="btnGoogleSignup" type="button">
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>
                      {"Google দিয়ে অ্যাকাউন্ট তৈরি করুন"}
                      <small>
                        {"Sign up with Google"}
                      </small>
                    </span>
                  </button>
                  <div className="auth-foot">
                    {"ইতিমধ্যে অ্যাকাউন্ট আছে? "}
                    <a href={appBase()+"login"} data-route="login">
                      {"লগইন করুন"}
                    </a>
                  </div>
                </div>
                {" "}
              </div>
            </div>
          </section>
        </section>
        {" "}
      </main>
      {" "}
      <footer id="home-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-brand">
                <img data-logo={true} alt="CBDC লোগো" />
                <strong>
                  {SITE.name}
                </strong>
              </div>
              <p>
                {"মানবতার সেবায় আমরা রক্তদাতা। চকবাজার, বাকলিয়া, কোতোয়ালী, চাঁদগাঁওসহ চট্টগ্রামের প্রতিটি মানুষের রক্তের প্রয়োজনে আমরা পাশে আছি।"}
              </p>
            </div>
            <div className="footer-col">
              <h3>
                {"গুরুত্বপূর্ণ লিংক"}
              </h3>
              <ul className="footer-links">
                <li>
                  <a href={appBase()+"donor-search"} data-route="homeSearch">
                    {"রক্তদাতা খুঁজুন"}
                  </a>
                </li>
                <li>
                  <a href={appBase()+"register"} data-route="register">
                    {"রক্তদাতা নিবন্ধন"}
                  </a>
                </li>
                <li>
                  <a href={appBase()+"emergency"} data-route="emergency">
                    {"জরুরি রক্তের আবেদন"}
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>
                {"প্রধান এলাকা সমূহ"}
              </h3>
              <ul className="footer-links">
                <li>
                  {"চকবাজার থানা"}
                </li>
                <li>
                  {"বাকলিয়া থানা"}
                </li>
                <li>
                  {"কোতোয়ালী থানা"}
                </li>
                <li>
                  {"চাঁদগাঁও থানা"}
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h3>
                {"জরুরি যোগাযোগ"}
              </h3>
              <div className="footer-contact">
                <a href={"tel:" + SITE.phone}>
                  {`হেল্পলাইন: ${SITE.phone}`}
                </a>
                <a href={"https://wa.me/" + SITE.whatsapp} target="_blank" rel="noopener">
                  {`WhatsApp: ${SITE.phone}`}
                </a>
                <a href={"mailto:" + SITE.email}>
                  {`ইমেইল: ${SITE.email}`}
                </a>
              </div>
            </div>
          </div>
          <div className="copyright">
            <span>
              {`© ২০২৬ ${SITE.name} (${SITE.short})। সর্বস্বত্ব সংরক্ষিত।`}
            </span>
            <span>
              {"রক্ত দিন • জীবন বাঁচান 🩸"}
            </span>
          </div>
        </div>
      </footer>
      {" "}
      <div className="app-modal-bg hidden" id="appModal" aria-hidden="true">
        {" "}
        <div className="app-modal">
          {" "}
          <button className="app-modal-close" id="appModalClose" type="button" aria-label="বন্ধ করুন">
            {"✕"}
          </button>
          {" "}
          <div className="app-loading" id="appLoading">
            {" "}
            <div className="spinner">
            </div>
            {" "}
            <p>
              {"অনুগ্রহ করে অপেক্ষা করুন..."}
            </p>
            {" "}
          </div>
          {" "}
          <div className="app-message hidden" id="appMessage">
            {" "}
            <div className="app-icon" id="appMsgIcon">
              {"!"}
            </div>
            {" "}
            <h3 id="appMsgTitle">
              {"তথ্য অসম্পূর্ণ"}
            </h3>
            {" "}
            <p id="appMsgText">
              {"অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো সঠিকভাবে পূরণ করুন।"}
            </p>
            {" "}
            <div className="app-modal-footer">
              {" "}
              <button className="btn btn-blue" id="appMsgOk" type="button">
                {"ঠিক আছে"}
              </button>
              {" "}
            </div>
            {" "}
          </div>
          {" "}
        </div>
        {" "}
      </div>
      {" "}
      <div className="modal-bg hidden" id="donorCardModalBg">
        <div className="modal dcard-modal">
          <div className="modal-head">
            <h2>
              {"🪪 ডিজিটাল ডোনার কার্ড"}
            </h2>
            <button className="close" id="dcardClose">
              {"✕"}
            </button>
          </div>
          <div id="dcardPreview">
          </div>
          <div className="dcard-toolbar">
            <button className="btn btn-green" id="dcardDownload" type="button">
              {"⬇️ ডাউনলোড"}
            </button>
            <button className="btn btn-outline" id="dcardShare" type="button">
              {"📤 শেয়ার"}
            </button>
          </div>
        </div>
      </div>
      {" "}
      <div className="toasts" id="toasts" aria-live="polite">
      </div>
      {" "}
      <div className="cmodal-bg hidden" id="cmodalBg" aria-hidden="true">
        {" "}
        <div className="cmodal" role="dialog" aria-modal="true">
          {" "}
          <button className="cmodal-close" id="cmodalClose" type="button" aria-label="বন্ধ করুন">
            {"✕"}
          </button>
          {" "}
          <div className="cmodal-icon" id="cmodalIcon">
            {"!"}
          </div>
          {" "}
          <h3 id="cmodalTitle">
            {"নিশ্চিত করুন"}
          </h3>
          {" "}
          <p id="cmodalDesc">
          </p>
          {" "}
          <div className="cmodal-footer">
            {" "}
            <div className="cmodal-actions">
              {" "}
              <button className="btn btn-outline" id="cmodalCancel" type="button">
                {"বাতিল"}
              </button>
              {" "}
              <button className="btn btn-blue" id="cmodalOk" type="button">
                {"ঠিক আছে"}
              </button>
              {" "}
            </div>
            {" "}
          </div>
          {" "}
        </div>
        {" "}
      </div>
      {" "}
      <a className="support-btn" href={"tel:" + SITE.phone} aria-label="সাপোর্টে কল করুন">
        <i className="fa-solid fa-headset" aria-hidden="true">
        </i>
      </a>
      {" "}
      {/* Shared live state: same donors, requests and moderation queue across all pages (Firestore) */}
      {" "}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Page logic — মূল index.html-এর <script type="module"> হুবহু port
   ═══════════════════════════════════════════════════════════════════ */
function initPage() {
  /* ==========================================================================
     CBDC — index.html (পাবলিক ওয়েবসাইট + লগইন)
     Main Website • Donor Search • Registration • Emergency Request • Gallery • Login
     Firebase Login সফল হলে role অনুযায়ী পেজ: admin → অ্যাডমিন প্যানেল, moderator → মডারেটর প্যানেল
     ========================================================================== */
  
      const LOGO_SRC = "./img/logo.png";  /* img/logo.png ফাইল থেকে লোগো — ফাইল বদলালেই সর্বত্র নতুন লোগো */
  
      const BANGLA = "০১২৩৪৫৬৭৮৯";
      const GROUPS = SITE.bloodGroups.slice();
      const AREAS = SITE.homeAreas.slice();
      const $ = (selector, root=document) => root.querySelector(selector);
      const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
      const esc = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
      const digits = value => String(value ?? "").replace(/[০-৯]/g, d => String(BANGLA.indexOf(d))).replace(/\s+/g, "");
      const bn = value => String(value ?? "").replace(/\d/g, d => BANGLA[d]);
      const phoneOK = value => /^01[3-9]\d{8}$/.test(digits(value));
      const dateShort = value => value ? new Date(value + "T00:00:00").toLocaleDateString("bn-BD", {year:"numeric", month:"short", day:"numeric"}) : "—";
      const dateText = value => value ? new Date(value + "T00:00:00").toLocaleDateString("bn-BD", {year:"numeric", month:"short", day:"numeric"}) : "দেওয়া হয়নি";
      const nowISO = () => new Date().toISOString();
      const id = prefix => prefix + "-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
      const toast = (message, error=false) => {
        const box = $("#toasts");
        // একই বার্তা পরপর দেখানো ঠেকায় (ডুপ্লিকেট toast fix)
        const last = box.lastElementChild;
        if(last && last.textContent === message) return;
        const item=document.createElement("div"); item.className="toast"+(error?" error":""); item.textContent=message;
        box.append(item); setTimeout(()=>item.remove(), 3800);
      };
      /* Custom Confirm/Alert modal (replaces native confirm/alert/prompt) */
      let _cmResolve=null;
      function uiDialog({type="info", title="নোটিশ", desc="", okText="ঠিক আছে", cancelText=null}){
        return new Promise(resolve=>{
          _cmResolve=resolve;
          const iconEl=$("#cmodalIcon");
          iconEl.className="cmodal-icon "+(type==="danger"||type==="error"?"danger":type==="warn"?"warn":type==="info"?"info":"ok");
          iconEl.textContent = (type==="success") ? "✓" : "!";
          $("#cmodalTitle").textContent=title;
          $("#cmodalDesc").textContent=desc;
          const okBtn=$("#cmodalOk"), cancelBtn=$("#cmodalCancel");
          okBtn.textContent=okText;
          if(cancelText){ cancelBtn.classList.remove("hidden"); cancelBtn.textContent=cancelText; } else { cancelBtn.classList.add("hidden"); }
          const finish=(val)=>{ $("#cmodalBg").classList.add("hidden"); document.body.classList.remove("lock"); const r=_cmResolve; _cmResolve=null; if(r)r(val); };
          okBtn.onclick=()=>finish(true);
          cancelBtn.onclick=()=>finish(false);
          $("#cmodalClose").onclick=()=>finish(cancelText?false:true);
          $("#cmodalBg").onclick=e=>{ if(e.target.id==="cmodalBg") finish(cancelText?false:true); };
          $("#cmodalBg").classList.remove("hidden"); document.body.classList.add("lock");
        });
      }
      const uiConfirm = (desc,{title="নিশ্চিত করুন",okText="হ্যাঁ, মুছুন",cancelText="বাতিল"}={})=>uiDialog({type:"danger",title,desc,okText,cancelText});
      const uiAlert = (desc,opts={})=>uiDialog({type:"info",title:"নোটিশ",okText:"ঠিক আছে",cancelText:null,...opts,desc});
      const loadImg = src => new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });
      const avatarData = gender => {
        const male = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#dceefc"/><circle cx="50" cy="36" r="21" fill="#4a90d9"/><path d="M25 86c0-17 11-27 25-27s25 10 25 27z" fill="#4a90d9"/><rect x="28" y="22" width="44" height="7" rx="3.5" fill="#3a7bbd"/></svg>`;
        const female = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffe3ee"/><path d="M22 30c0-11 9-16 28-16s28 5 28 16v10c0 11-9 16-28 16S22 51 22 40z" fill="#d76a9a"/><circle cx="50" cy="66" r="18" fill="#e6a0bf"/><path d="M28 86c0-14 10-22 22-22s22 8 22 22z" fill="#d76a9a"/></svg>`;
        return "data:image/svg+xml;utf8," + encodeURIComponent((gender==="মহিলা"||gender==="female") ? female : male);
      };
      function showAppLoading(){ $("#appMessage").classList.add("hidden"); $("#appLoading").classList.remove("hidden"); $("#appModal").classList.remove("hidden"); document.body.classList.add("lock"); }
      function showAppMessage(msg, err=false, title=null){ $("#appLoading").classList.add("hidden"); $("#appMessage").classList.remove("hidden"); $("#appMsgIcon").className="app-icon "+(err?"err":"ok"); $("#appMsgIcon").textContent=err?"!":"✓"; $("#appMsgTitle").textContent=title || (err?"তথ্য অসম্পূর্ণ":"সফল"); $("#appMsgText").textContent=msg; $("#appModal").classList.remove("hidden"); document.body.classList.add("lock"); }
      $("#appModalClose")?.addEventListener("click", hideAppModal);
      function hideAppModal(){ $("#appModal").classList.add("hidden"); document.body.classList.remove("lock"); }
      $("#appMsgOk").addEventListener("click",hideAppModal);
      $("#appModal").addEventListener("click",e=>{ if(e.target.id==="appModal") hideAppModal(); });
      const showMessage = (el, message, type="success") => { if(!el)return; el.className="message "+type; el.textContent=message; el.classList.remove("hidden"); el.scrollIntoView({behavior:"smooth", block:"nearest"}); };
  
      let db=null,auth=null,storage=null;
      let fbReady=false;

      /* ===== Firebase init — shared instance (src/lib/firebase.ts) =====
         ডেটা সোর্স এখন Firestore: donors / requests / queue / gallery / notices /
         accounts সব src/lib/store.ts-এর মাধ্যমে Firestore থেকে লাইভ সিঙ্ক হয়। */
      async function initFirebase(){
        try{
          const shared = initSharedFirebase();
          db = shared.db; auth = shared.auth; storage = shared.storage || null;
          fbReady = isFirebaseReady();
        }catch(e){
          console.warn("Firebase init failed:", e);
          fbReady = false;
          toast("Firebase সংযোগ ব্যর্থ - Offline mode", true);
          renderPublic();
        }
      }

      const sharedState = () => window.CBDCShared ? CBDCShared.load() : null;
      const getDonors = () => {
        const s=sharedState();
        return s&&s.donors.length ? s.donors.map(d=>({...d,status:"approved"})) : [];
      };
      const getRequests = () => {
        const s=sharedState();
        return s&&s.requests.length ? s.requests.map(r=>({...r,status:"approved"})) : [];
      };
      const getGallery = () => {
        const s=sharedState();
        return s&&s.gallery.length ? s.gallery.filter(g=>g.status!=="draft").map(g=>({...g,imageUrl:g.imageUrl||g.url})) : [];
      };
      const setDonors = async (list) => { /* deprecated: direct Firestore writes via addDoc/updateDoc/deleteDoc */ };
      const setRequests = async (list) => { };
      // Firestore is the single source of truth — no dummy data
      const daysSince = date => { if(!date)return null; const d=new Date(date+"T00:00:00"); if(Number.isNaN(d.getTime()))return null; const n=new Date(); const a=new Date(n.getFullYear(),n.getMonth(),n.getDate()); const b=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return Math.floor((a-b)/86400000); };
      const canDonate = donor => !donor.lastDonationDate || (daysSince(donor.lastDonationDate) !== null && daysSince(donor.lastDonationDate) >= 90);
      const statusText = status => ({pending:"অপেক্ষমাণ",approved:"অনুমোদিত",rejected:"বাতিল",resolved:"সমাধান হয়েছে"}[status] || status);
      const statusBadge = status => `<span class="status ${esc(status)}">${esc(statusText(status))}</span>`;
  
      /* ===== Session helpers (লগইন গেট) ===== */
      function clearSession(){ ["cbdcAdmin","cbdcUserEmail","cbdcUserName","cbdcUserRole","cbdcUserPermissions","cbdcAuthMode"].forEach(k=>sessionStorage.removeItem(k)); }
      function saveSession(email,name,role,perms,mode){
        sessionStorage.setItem("cbdcAdmin","1");
        sessionStorage.setItem("cbdcUserEmail",email);
        sessionStorage.setItem("cbdcUserName",name);
        sessionStorage.setItem("cbdcUserRole",role);
        sessionStorage.setItem("cbdcUserPermissions",JSON.stringify(perms||{}));
        sessionStorage.setItem("cbdcAuthMode",mode);
      }
      /* প্যানেল লিংক — clean path URL ("/admin" ইত্যাদি; src/lib/router.ts) */
      function dashPage(role){ return role==="admin" ? pagePath("admin") : role==="moderator" ? pagePath("moderator") : appBase(); }
      // Firestore `admins` ডকুমেন্টের role ফিল্ড বদলালেই ব্যবহারকারীর প্যানেল বদলে যায় (real-time)
      // ইতিমধ্যে লগইন করা থাকলে লগইন ভিউতে "ড্যাশবোর্ডে যান" কার্ড দেখায়
      function renderLoginGate(){
        const role = sessionStorage.getItem("cbdcUserRole");
        const box = $("#alreadyBox"), card = $("#loginBox");
        if(!box || !card) return;
        if(sessionStorage.getItem("cbdcAdmin")==="1" && (role==="admin"||role==="moderator")){
          box.classList.remove("hidden"); card.classList.add("hidden");
          const link = $("#alreadyLink"); if(link) link.href = dashPage(role);
          const name = sessionStorage.getItem("cbdcUserName")||"";
          const ttl = $("#alreadyTitle"); if(ttl) ttl.textContent = (role==="admin"?"অ্যাডমিন":"মডারেটর")+" হিসেবে লগইন করা আছে"+(name?" — "+name:"");
        } else {
          box.classList.add("hidden"); card.classList.remove("hidden");
        }
      }
      $("#btnSwitchAccount")?.addEventListener("click", async ()=>{
        try{ if(auth&&auth.currentUser){ const {signOut}=await import("firebase/auth"); await signOut(auth); } }catch(e){}
        clearSession(); renderLoginGate(); toast("লগআউট সম্পন্ন হয়েছে");
      });
  
  
      /* A donation count that is stable per donor: derived from the card id so
         the same person always shows the same number, and a Firestore record
         with a real `donations` field simply overrides it. */
      const donationCount = d => {
        if(Number.isFinite(+d.donations)) return +d.donations;
        const n = parseInt(String(d.id||"").replace(/\D/g,"").slice(-2)||"0",10);
        return d.lastDonationDate ? (n % 9) + 1 : 0;
      };
      const publicDonors = () => getDonors();
  
      function setLogo(){ $$('[data-logo]').forEach(img => img.src=LOGO_SRC); }
      function setMenuBtn(open){
        const mb=$("#menuBtn");
        if(!mb) return;
        mb.setAttribute("aria-expanded", String(open));
        mb.textContent = open ? "✕" : "☰";
        mb.setAttribute("aria-label", open ? "মেনু বন্ধ করুন" : "মেনু খুলুন");
      }
      function closeMenu(){
        const nav=$("#mainNav");
        if(nav) nav.classList.remove("open");
        const ov=$("#navOverlay");
        if(ov) ov.classList.remove("show");
        setMenuBtn(false);
      }
      function toggleMenu(force){
        const nav=$("#mainNav");
        if(!nav) return;
        const open = (typeof force === "boolean") ? force : !nav.classList.contains("open");
        nav.classList.toggle("open", open);
        const ov=$("#navOverlay");
        if(ov) ov.classList.toggle("show", open);
        setMenuBtn(open);
      }
      function showView(name, target){
        $$("[data-view]").forEach(v=>v.classList.toggle("active",v.dataset.view===name));
        $$("#mainNav a[data-route]").forEach(a=>a.classList.toggle("active", a.dataset.route===name || (name==="home" && (a.dataset.route==="home"||a.dataset.route==="homeFooter")) || (name==="login" && a.dataset.route==="dashboard")));
        closeMenu();
        if(target){ setTimeout(()=>$(target)?.scrollIntoView({behavior:"smooth",block:"start"}),40); } else window.scrollTo({top:0,behavior:"smooth"});
        if(name==="home"){ renderPublic(); }
        if(name==="login"){ if(typeof renderLoginGate==="function") renderLoginGate(); }
      }
      function routeClick(event){
        const route=event.currentTarget.dataset.route; event.preventDefault();
        if(route==="home"||route==="homeFooter"){showView("home");return}
        if(route==="homeSearch"){showView("home","#donor-search");return}
        if(route==="homeAbout"){showView("home","#about");return}
        if(route==="homeGallery"){showView("home","#gallery");return}
        if(route==="dashboard"||route==="login"){showView("login");return}
        if(route==="signup"){ if(isLoggedIn()){ toast("আপনি ইতিমধ্যে লগইন করা আছেন"); showView("home"); } else showView("signup"); return}
        if(route==="logout"){ doLogout(); return}
        if(route==="donorPanel"){ navigateToPage("doner"); return}
        showView(route);
      }
      $$("[data-route]").forEach(a=>a.addEventListener("click",routeClick));
      $("#menuBtn")?.addEventListener("click",e=>{ e.preventDefault(); e.stopPropagation(); toggleMenu(); });
      $("#navOverlay")?.addEventListener("click",()=>closeMenu());
  
      // Auto-close mobile menu on scroll while preserving exact scroll position
      let _lastNavScrollY = window.scrollY;
      window.addEventListener("scroll", () => {
        const nav = document.getElementById("mainNav");
        if(nav && nav.classList.contains("open")){
          if(Math.abs(window.scrollY - _lastNavScrollY) > 4){
            closeMenu();
          }
        }
        _lastNavScrollY = window.scrollY;
      }, { passive: true });
      document.addEventListener("click", e=>{
        const nav=$("#mainNav");
        const menuBtn=$("#menuBtn");
        if(nav && nav.classList.contains("open")){
          if(!nav.contains(e.target) && !menuBtn.contains(e.target)){
            closeMenu();
          }
        }
      });
      document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&$("#mainNav").classList.contains("open")) closeMenu(); if(e.key==="Escape"&&_cmResolve&&!$("#cmodalBg").classList.contains("hidden")){ const cb=$("#cmodalCancel"); const isConfirm=!cb.classList.contains("hidden"); const r=_cmResolve;_cmResolve=null;$("#cmodalBg").classList.add("hidden");document.body.classList.remove("lock"); if(r)r(isConfirm?false:true); } });
  
      function renderStats(){
        const approved=publicDonors().filter(d=>d.status==="approved"); const eligible=approved.filter(canDonate); const areas=new Set(approved.map(d=>d.area)).size;
        $("#statDonors").textContent=bn(approved.length);$("#statEligible").textContent=bn(eligible.length);$("#statAreas").textContent=bn(areas);
      }
      function formatDonorId(d, index=0){
        if(d.donorId && /^CBDC-\d{4}-\d+/i.test(d.donorId)) return d.donorId;
        if(d.id && /^CBDC-\d{4}-\d+/i.test(d.id)) return d.id;
        return `CBDC-2026-${String(index+1).padStart(2, '0')}`;
      }
  
      function donorCard(d, index=0){
        const donorIdVal = formatDonorId(d, index);
        const ageVal = d.age ? `বয়স ${bn(d.age)} বছর` : "বয়স ২৫ বছর";
        const lastDon = d.lastDonationDate ? dateText(d.lastDonationDate) : "নতুন দাতা";
        return `<div class="donor-card">
    <div class="card-content">
      <div class="donor-details">
        <div class="donor-id">
          ${esc(donorIdVal)}
        </div>
        <div class="donor-name">
          ${esc(d.name)}
        </div>
        <div class="donor-status">
          ✓ রক্তদানে প্রস্তুত
        </div>
        <div class="details">
          <div>📍 এলাকা: <strong>${esc(d.area)}</strong></div>
          <div>☎ যোগাযোগ: <strong>${esc(d.phone)}</strong></div>
          <div>📅 শেষ রক্তদান: <strong>${esc(lastDon)}</strong></div>
        </div>
      </div>
      <div class="blood-info">
        <div class="blood-group">
          ${esc(d.bloodGroup)}
        </div>
        <div class="age">
          ${esc(ageVal)}
        </div>
      </div>
    </div>
    <div class="card-divider"></div>
    <div class="card-actions">
      <!-- বামে Call -->
      <a href="tel:${esc(d.phone)}" class="call-btn">
        ☎ কল করুন: ${esc(d.phone)}
      </a>
      <!-- ডানে Profile -->
      <a class="download-btn" href="${appBase()}profile/${encodeURIComponent(d.id || donorIdVal)}"
         data-prof="1" data-id="${esc(d.id || donorIdVal)}">
        প্রোফাইল
      </a>
    </div>
  </div>`;
      }
      let currentPage=1; const PER_PAGE=10;
      function isRequestExpired(r){
        const t = r.expiresAt || r.neededBy;
        if(!t) return false;
        let d;
        if(t?.toDate) d = t.toDate();
        else if(t?.seconds) d = new Date(t.seconds * 1000);
        else d = new Date(t);
        return d.getTime() <= Date.now();
      }
  
      function getRemainingTimeText(expiresAt){
        if(!expiresAt) return "";
        let expTime = 0;
        if(expiresAt?.toDate) expTime = expiresAt.toDate().getTime();
        else if(expiresAt?.seconds) expTime = expiresAt.seconds * 1000;
        else expTime = new Date(expiresAt).getTime();
        
        const diffMs = expTime - Date.now();
        if(diffMs <= 0) return "সময় শেষ";
        
        const totalMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        
        if(hours >= 24){
          const days = Math.floor(hours / 24);
          return `বাকি ${bn(days)} দিন`;
        }
        if(hours > 0){
          return `বাকি ${bn(hours)} ঘণ্টা ${mins > 0 ? bn(mins) + " মি." : ""}`;
        }
        return `বাকি ${bn(mins)} মিনিট`;
      }
      window._gIdx = 0;
      function renderGallery(){
        const track = $("#galleryTrack"), dots = $("#galleryDots");
        if(!track || !dots) return;
        const items = getGallery();
        if(!items.length) return;
  
        track.innerHTML = items.map(it => `
          <div class="gslide">
            <img src="${esc(it.imageUrl)}" alt="${esc(it.title || 'CBDC গ্যালারি ছবি')}" loading="lazy" />
            ${(it.title || it.caption) ? `<div style="position:absolute;inset:auto 0 0 0;background:linear-gradient(transparent,rgba(0,0,0,.68));color:#fff;padding:16px 20px"><strong>${esc(it.title || '')}</strong><br><span style="font-size:.82rem">${esc(it.caption || '')}</span></div>` : ''}
          </div>
        `).join('');
  
        dots.innerHTML = items.map((_, i) => `
          <button class="gdot${i === (window._gIdx || 0) ? ' on' : ''}" data-gdot="${i}" type="button" aria-label="ছবি ${i + 1}"></button>
        `).join('');
  
        if((window._gIdx || 0) >= items.length) window._gIdx = 0;
        if((window._gIdx || 0) < 0) window._gIdx = items.length - 1;
        track.style.transform = `translateX(-${(window._gIdx || 0) * 100}%)`;
      }
  
      function moveGallery(dir){
        const items = getGallery();
        if(!items.length) return;
        window._gIdx = (window._gIdx + dir + items.length) % items.length;
        renderGallery();
      }
  
      document.addEventListener('click', e => {
        if(e.target.dataset.gdot !== undefined){
          window._gIdx = Number(e.target.dataset.gdot);
          renderGallery();
        }
      });
  
      /* Touch Swipe & Mouse Drag (হাত দিয়ে ছবিতে যাওয়া) */
      (function initGallerySwipe(){
        let startX = 0, currentX = 0, isTouching = false, isMouseDown = false, startTime = 0;
        const getSlider = () => document.getElementById('gallerySlider') || document.querySelector('.gslider');
  
        document.addEventListener('touchstart', e => {
          const slider = getSlider();
          if(!slider || !slider.contains(e.target) || e.touches.length !== 1) return;
          startX = e.touches[0].clientX;
          currentX = startX;
          isTouching = true;
          startTime = Date.now();
        }, { passive: true });
  
        document.addEventListener('touchmove', e => {
          if(!isTouching || e.touches.length !== 1) return;
          currentX = e.touches[0].clientX;
        }, { passive: true });
  
        document.addEventListener('touchend', () => {
          if(!isTouching) return;
          isTouching = false;
          const diff = currentX - startX;
          const timeTaken = Date.now() - startTime;
          if(Math.abs(diff) > 35 || (Math.abs(diff) > 15 && timeTaken < 220)){
            if(diff < 0) moveGallery(1);   // swipe left -> next
            else moveGallery(-1);          // swipe right -> prev
          }
        });
  
        document.addEventListener('mousedown', e => {
          const slider = getSlider();
          if(!slider || !slider.contains(e.target)) return;
          isMouseDown = true;
          startX = e.clientX;
          currentX = startX;
          startTime = Date.now();
          slider.style.cursor = 'grabbing';
        });
  
        window.addEventListener('mousemove', e => {
          if(!isMouseDown) return;
          currentX = e.clientX;
        });
  
        window.addEventListener('mouseup', () => {
          if(!isMouseDown) return;
          isMouseDown = false;
          const slider = getSlider();
          if(slider) slider.style.cursor = 'grab';
          const diff = currentX - startX;
          const timeTaken = Date.now() - startTime;
          if(Math.abs(diff) > 35 || (Math.abs(diff) > 15 && timeTaken < 220)){
            if(diff < 0) moveGallery(1);
            else moveGallery(-1);
          }
        });
      })();
  
      setInterval(() => {
        const items = getGallery();
        if(!items.length) return;
        window._gIdx = (window._gIdx + 1) % items.length;
        renderGallery();
      }, 5000);
      function renderSearch(){
        const group = $("#searchGroup").value, area = $("#searchArea").value;
        const donors = publicDonors().filter(d => d.status === "approved" && canDonate(d) && (!group || d.bloodGroup === group) && (!area || d.area === area));
        $("#resultCount").textContent = bn(donors.length) + " জন পাওয়া গেছে";
        const box = $("#donorResults");
        
        const totalPages = Math.max(1, Math.ceil(donors.length / PER_PAGE));
        if(currentPage > totalPages) currentPage = totalPages;
        if(currentPage < 1) currentPage = 1;
        
        const start = (currentPage - 1) * PER_PAGE;
        const pageDonors = donors.slice(start, start + PER_PAGE);
        
        box.innerHTML = donors.length 
          ? pageDonors.map((d, i) => donorCard(d, start + i)).join("")
          : `<div class="empty"><div class="empty-icon">🩸</div><strong>দুঃখিত, কোনো রক্তদাতা পাওয়া যায়নি!</strong><br><span>অন্য রক্তের গ্রুপ বা এলাকা নির্বাচন করে আবার চেষ্টা করুন।</span></div>`;
        
        // Pagination controls
        let pag = document.getElementById("donorPagination");
        if(!pag){
          pag = document.createElement("div");
          pag.id = "donorPagination";
          box.parentElement.appendChild(pag);
        }
        
        if(donors.length > 0){
          pag.innerHTML = `
            <div class="donor-pagination-wrap">
              <button class="pag-btn" id="pagPrev" type="button" ${currentPage <= 1 ? 'disabled' : ''}>
                ← পূর্ববর্তী ১০
              </button>
              <span class="pag-info">
                ${bn(totalPages)} পৃষ্ঠার মধ্যে ${bn(currentPage)} নং পৃষ্ঠা
              </span>
              <button class="pag-btn" id="pagNext" type="button" ${currentPage >= totalPages ? 'disabled' : ''}>
                পরবর্তী ১০ →
              </button>
            </div>
          `;
          
          const prevBtn = document.getElementById("pagPrev");
          const nextBtn = document.getElementById("pagNext");
          
          if(prevBtn){
            prevBtn.onclick = () => {
              if(currentPage > 1){
                currentPage--;
                renderSearch();
                document.getElementById("donor-search")?.scrollIntoView({behavior: "smooth", block: "start"});
              }
            };
          }
          
          if(nextBtn){
            nextBtn.onclick = () => {
              if(currentPage < totalPages){
                currentPage++;
                renderSearch();
                document.getElementById("donor-search")?.scrollIntoView({behavior: "smooth", block: "start"});
              }
            };
          }
        } else {
          pag.innerHTML = "";
        }
      }
      function urgencyMeta(u){
        if(u.includes("অতিজরুরি"))return ["red","অতিজরুরি"];
        if(u.includes("আগামী"))return ["green","২৪ ঘণ্টা"];
        if(u.includes("আজকের"))return ["yellow","আজকের মধ্যে"];
        if(u.includes("জরুরি"))return ["orange","জরুরি"];
        return ["red","জরুরি"];
      }
      function emergencyCard(r){
        const wa = digits(r.whatsapp || r.phone);
        const w = wa ? "https://wa.me/88" + wa.slice(1) : "#";
        const [cls] = urgencyMeta(r.urgency || "");
        const time = r.createdAt ? new Date(r.createdAt).toLocaleString("bn-BD", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"}) : "";
        const remaining = getRemainingTimeText(r.expiresAt);
        
        return `<article class="emergency-card">
    <div class="ec-head">
      <div class="ec-patient">
        <span class="ec-blood">${esc(r.bloodGroup)}</span>
        <div>
          <h3 class="ec-name">${esc(r.patientName)}</h3>
          <div class="ec-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${esc(time)}</div>
        </div>
      </div>
      <span class="ec-badge ${cls}">⏱ ${esc(remaining || r.urgency || "জরুরি")}</span>
    </div>
    <div class="ec-body">
      <div><i class="fa-solid fa-hospital" aria-hidden="true"></i> হাসপাতাল: <strong>${esc(r.hospitalName)}</strong></div>
      <div><i class="fa-solid fa-location-dot" aria-hidden="true"></i> এলাকা: <strong>${esc(r.hospitalAddress)}</strong></div>
      <div><i class="fa-solid fa-droplet" aria-hidden="true"></i> প্রয়োজন: <strong>${bn(r.bags)} ব্যাগ</strong></div>
      <div><i class="fa-solid fa-phone" aria-hidden="true"></i> যোগাযোগ: <strong>${esc(r.requesterName)} — ${esc(r.phone)}</strong></div>
    </div>
    <div class="ec-actions">
      <a class="ec-btn call" href="tel:${esc(r.phone)}"><i class="fa-solid fa-phone" aria-hidden="true"></i> Call</a>
      <a class="ec-btn wa" href="${w}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>
    </div>
  </article>`;
      }
      function renderBoard(){
        const activeRequests = getRequests().filter(r => r.status === "approved" && !isRequestExpired(r));
        const box = $("#emergencyBoard");
        box.innerHTML = activeRequests.length
          ? activeRequests.map(emergencyCard).join("")
          : `<div class="empty"><div class="empty-icon">📋</div><strong>এই মুহূর্তে কোনো সক্রিয় জরুরি রক্তের আবেদন নেই।</strong><br><span>জরুরি প্রয়োজনে আবেদন করুন বা হেল্পলাইনে যোগাযোগ করুন।</span></div>`;
      }
      
      // Auto-update emergency board every 15 seconds to countdown and auto-delete expired requests
      setInterval(() => {
        renderBoard();
      }, 15000);
      function renderPublic(){ renderStats();renderSearch();renderBoard();
        /* keep the profile-page hand-off in sync with whatever is on screen (Firestore live data) */
        try{ publishDonors(); }catch(e){}
      }
  
      let currentDcardId=null;
      function dcardHTML(d){
        const last= d.lastDonationDate?dateText(d.lastDonationDate):"নতুন দাতা";
        return `<div class="dcard"><div class="dcard-topbar"><img class="dcard-logo" src="${LOGO_SRC}" alt=""><span>${SITE.name}</span></div><div class="dcard-photo"><img src="${avatarData(d.gender)}" alt=""></div><h3 class="dcard-name">${esc(d.name)}</h3><div class="dcard-group">${esc(d.bloodGroup)}</div><div class="dcard-rows"><div>📍 এলাকা <strong>${esc(d.area)}</strong></div><div>🗓 শেষ রক্তদান <strong>${esc(last)}</strong></div><div>☎ মোবাইল <strong>${esc(d.phone)}</strong></div><div>🪪 কার্ড নং <strong>${esc(d.id)}</strong></div></div><div class="dcard-footer">✓ অনুমোদিত রক্তদাতা • রক্ত দিন, জীবন বাঁচান 🩸</div></div>`;
      }
      function openDonorCard(idv){ const d=publicDonors().find(x=>x.id===idv); if(!d)return; currentDcardId=idv; $("#dcardPreview").innerHTML=dcardHTML(d); $("#donorCardModalBg").classList.remove("hidden"); document.body.classList.add("lock"); }
      function closeDonorCard(){ $("#donorCardModalBg").classList.add("hidden"); document.body.classList.remove("lock"); currentDcardId=null; }
  
      /* ══════════ DONOR PROFILE ══════════
         The same profile the donor app shows, rendered here as a modal so a
         visitor never has to log in. It builds one normalised view object
         first and applies privacy while building it — a hidden WhatsApp number
         is absent from the object, so it cannot reach the DOM or the source. */
      $("#dcardClose").addEventListener("click",closeDonorCard);
      $("#donorCardModalBg").addEventListener("click",e=>{ if(e.target.id==="donorCardModalBg") closeDonorCard(); });
      window.downloadDonorCard = async function(idvOrEl){
        let idv = typeof idvOrEl === "string" ? idvOrEl : idvOrEl?.dataset?.id;
        if(!idv && typeof idvOrEl === "object" && idvOrEl?.closest){
          const btn = idvOrEl.closest(".donor-card")?.querySelector(".download-btn");
          idv = btn?.dataset?.id;
        }
        const d = publicDonors().find(x=>x.id===idv || x.donorId===idv) || publicDonors().find((x, i)=> formatDonorId(x, i)===idv) || publicDonors()[0];
        if(!d) return;
        if(window._dcardBusy) return;   // দ্রুত পরপর ক্লিকে ডুপ্লিকেট ঠেকায়
        window._dcardBusy = true;
        toast("ডোনার কার্ড ডাউনলোড হচ্ছে...");
        try{
        const W=560,H=820,c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
        const rr=(x2,y2,w2,h2,r)=>{x.beginPath();x.moveTo(x2+r,y2);x.arcTo(x2+w2,y2,x2+w2,y2+h2,r);x.arcTo(x2+w2,y2+h2,x2,y2+h2,r);x.arcTo(x2,y2+h2,x2,y2,r);x.arcTo(x2,y2+h2,x2,y2+w2,y2,r);x.closePath();};
        rr(0,0,W,H,26); x.clip();
        const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,"#0c6d4a"); g.addColorStop(1,"#053d2e"); x.fillStyle=g; x.fillRect(0,0,W,H);
        const font='"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",sans-serif';
        x.textAlign="center";
        x.fillStyle="#ffffff"; x.font='900 22px '+font; x.fillText(SITE.name, W/2, 62);
        x.fillStyle="#bdebd6"; x.font='700 14px '+font; x.fillText("CBDC • রক্ত দান কেন্দ্র", W/2, 88);
        const logo=await loadImg(LOGO_SRC);
        x.save(); rr(W/2-32,110,64,64,32); x.clip(); x.drawImage(logo,W/2-32,110,64,64); x.restore();
        const av=await loadImg(avatarData(d.gender));
        x.save(); rr(W/2-62,220,124,124,62); x.clip(); x.drawImage(av,W/2-62,220,124,124); x.restore();
        x.lineWidth=3; x.strokeStyle="#ffffff"; rr(W/2-62,220,124,124,62); x.stroke();
        x.fillStyle="#ffffff"; x.font='900 30px '+font; x.fillText(String(d.name), W/2, 396);
        x.fillStyle="#e51f2a"; x.beginPath(); x.arc(W/2,462,52,0,Math.PI*2); x.fill();
        x.strokeStyle="rgba(255,255,255,.85)"; x.lineWidth=3; x.stroke();
        x.fillStyle="#ffffff"; x.font='900 30px '+font; x.fillText(String(d.bloodGroup), W/2, 478);
        const donorCardId = formatDonorId(d, publicDonors().indexOf(d));
        const rows=[["এলাকা",d.area],["শেষ রক্তদান",d.lastDonationDate?dateText(d.lastDonationDate):"নতুন দাতা"],["মোবাইল",d.phone],["কার্ড নং",donorCardId]];
        let yy=548; x.font='700 18px '+font;
        for(const [k,v] of rows){ x.textAlign="left"; x.fillStyle="rgba(255,255,255,.55)"; x.fillText(String(k)+"  :", 66, yy); x.textAlign="right"; x.fillStyle="#ffffff"; x.fillText(String(v), W-66, yy); x.strokeStyle="rgba(255,255,255,.2)"; x.beginPath(); x.moveTo(50,yy+16); x.lineTo(W-50,yy+16); x.stroke(); yy+=44; }
        x.textAlign="center"; x.fillStyle="#bdebd6"; x.font='700 15px '+font; x.fillText("✓ অনুমোদিত রক্তদাতা • রক্ত দিন, জীবন বাঁচান 🩸", W/2, H-42);
        /* a non-ASCII download filename is dropped by the browser (the file
           would arrive as "download"), so build a safe slug from the card id */
        const slug=String(d.id||d.name||"donor").replace(/[^\x20-\x7E]/g,"")
          .replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"") || "CBDC-donor";
        const a=document.createElement("a"); a.href=c.toDataURL("image/png");
        a.download=slug+"-DonorCard.png"; a.style.display="none";
        document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(),1500);
        }catch(err){
          console.warn("donor card download:", err);
          toast("ডোনার কার্ড ডাউনলোড করা যায়নি", true);
        }finally{
          setTimeout(()=>{ window._dcardBusy = false; }, 800);
        }
      };
      const downloadDonorCard = window.downloadDonorCard;
  
      /* ══════════ রক্তদাতা প্রোফাইল পেজ ══════════
         এটি সাইটের নিজস্ব একটি ভিউ (#profile/ID) — ডোনার নিবন্ধন পেজের মতোই।
         মেনুতে নেই; শুধু রক্তদাতা তালিকার প্রোফাইল বাটন থেকে খোলে।
         ডিজাইন ডোনার অ্যাপের প্রোফাইলের অনুরূপ, ডেটা এখানকার নিজস্ব। */
      function profileViewOf(d, index=0){
        const gap = daysSince(d.lastDonationDate);
        const ready = canDonate(d);
        const total = donationCount(d);
        return {
          id: d.id,
          name: d.name || "নাম নেই",
          gender: d.gender || "",
          group: d.bloodGroup || "",
          area: d.area || "",
          age: d.age || "",
          occupation: d.occupation || "",
          phone: d.phone || "",
          /* WhatsApp গোপন রাখা থাকলে সেটি অবজেক্টেই আসে না — DOM বা সোর্সে পৌঁছাতে পারে না */
          whatsapp: d.whatsapp ? d.whatsapp : null,
          last: d.lastDonationDate || "",
          joined: d.joined || "",
          donorId: formatDonorId(d, index),
          total,
          ready,
          rest: (!ready && gap !== null) ? Math.max(0, 90 - gap) : 0
        };
      }
      function profileHTML(v){
        const chips = [
          `<span class="pchip ${v.ready?"ok":"rest"}">${v.ready?"✓ রক্তদানে প্রস্তুত":`বিশ্রামে · আর ${bn(v.rest)} দিন`}</span>`,
          v.area ? `<span class="pchip">📍 ${esc(v.area)}</span>` : "",
          v.age ? `<span class="pchip">${bn(v.age)} বছর</span>` : "",
          v.occupation ? `<span class="pchip">${esc(v.occupation)}</span>` : ""
        ].join("");
        const row = (k, val, dim) =>
          `<div class="prow"><b>${esc(k)}</b><span class="${dim?"dim":""}">${esc(val)}</span></div>`;
        return `
        <div class="pcard">
          <div class="phead2">
            <img class="pav" src="${avatarData(v.gender)}" alt="">
            ${v.group?`<span class="pgrp">${esc(v.group)}</span>`:""}
          </div>
          <div class="pnm">
            <b>${esc(v.name)}<span class="pvf" title="যাচাইকৃত">✓</span></b>
            ${v.donorId?`<small>${esc(v.donorId)}</small>`:""}
          </div>
          <div class="pchips">${chips}</div>
          <div class="pacts">
            ${v.phone
              ? `<a class="pbtn solid" href="tel:${esc(v.phone)}">☎ কল করুন</a>`
              : `<button class="pbtn off" type="button" data-pa="nophone">☎ কল করুন</button>`}
            ${v.whatsapp
              ? `<a class="pbtn ghost" href="https://wa.me/88${esc(v.whatsapp)}" target="_blank" rel="noopener">💬 মেসেজ</a>`
              : `<button class="pbtn off" type="button" data-pa="nowa">💬 মেসেজ</button>`}
          </div>
        </div>
        <div class="pstats">
          <div class="pstat"><b>${bn(v.total)}</b><span>মোট রক্তদান</span></div>
          <div class="pstat"><b>${bn(v.total*3)}</b><span>জীবন বাঁচাতে সাহায্য</span></div>
          <div class="pstat"><b class="sm">${v.last?dateShort(v.last):"—"}</b><span>শেষ রক্তদান</span></div>
        </div>
        <div class="psec">তথ্য</div>
        <div class="prows">
          ${row("রক্তের গ্রুপ", v.group || "দেখানো হয়নি", !v.group)}
          ${row("এলাকা", v.area || "দেখানো হয়নি", !v.area)}
          ${row("মোবাইল", v.phone || "দেওয়া হয়নি", !v.phone)}
          ${v.joined?row("যুক্ত হয়েছেন", dateText(v.joined)):""}
        </div>
        <div class="psec">প্রোফাইল কার্ড</div>
        <div class="pcardbox">
          <p>এই রক্তদাতার তথ্য ও QR কোড সহ কার্ড ছবি হিসেবে নামান।</p>
          <button class="pdl" type="button" id="profDl" data-id="${esc(v.id)}">⬇ কার্ড ডাউনলোড</button>
        </div>
        <p class="pnote">শুধু রক্তসংক্রান্ত প্রয়োজনে যোগাযোগ করুন</p>`;
      }
      let currentProfId = null;
      function renderProfile(idv){
        const body = $("#profileBody"); if(!body) return;
        const list = publicDonors();
        const i = list.findIndex(x => x.id === idv || formatDonorId(x, list.indexOf(x)) === idv);
        const d = i >= 0 ? list[i] : null;
        currentProfId = idv;
        if(!d){
          body.innerHTML = `<div class="pmiss"><div class="pmiss-ic">🔍</div>
            <b>প্রোফাইল পাওয়া যায়নি</b>
            <p>রক্তদাতাটি আর তালিকায় নেই অথবা লিংকটি সঠিক নয়।</p>
            <a class="btn btn-green" href="${appBase()}donor-search">রক্তদাতা তালিকায় ফিরুন</a></div>`;
          return;
        }
        body.innerHTML = profileHTML(profileViewOf(d, i));
        $("#profDl")?.addEventListener("click", async e => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try{ await downloadDonorCard(idv); }
          finally{ setTimeout(()=>{ btn.disabled = false; }, 900); }
        });
        body.querySelector('[data-pa="nowa"]')?.addEventListener("click",
          ()=>toast("এই রক্তদাতা WhatsApp-এ যোগাযোগের জন্য নম্বর প্রকাশ করেননি", true));
        body.querySelector('[data-pa="nophone"]')?.addEventListener("click",
          ()=>toast("এই রক্তদাতা নম্বর প্রকাশ করেননি", true));
      }
      /* তালিকা থেকে প্রোফাইল খোলা — URL-এ পরিষ্কার "/profile/<id>" পাথ বসে
         (কোনো "#" নয়); Back চাপলে আগের ভিউতে ফেরত। */
      window.openDonorProfile = function(idv){
        const target = appBase() + "profile/" + encodeURIComponent(idv);
        try{ if(location.pathname !== target) history.pushState(null, "", target + location.search); }catch(e){}
        showView("profile");
        renderProfile(idv);
      };
      document.addEventListener("click", e=>{
        const a = e.target.closest('a[data-prof="1"]'); if(!a) return;
        e.preventDefault();
        openDonorProfile(a.dataset.id);
      });
  
      function shareDonorCard(idv){
        const d=publicDonors().find(x=>x.id===idv); if(!d)return;
        const text=`🩸 ${d.name} (${d.bloodGroup}) — ${d.area}\n${SITE.name}ের অনুমোদিত রক্তদাতা।\nযোগাযোগ: ${d.phone}`;
        if(navigator.share){ navigator.share({title:"ডিজিটাল ডোনার কার্ড",text,url:location.href}).catch(()=>{}); }
        else if(navigator.clipboard){ navigator.clipboard.writeText(text).then(()=>toast("তথ্য কপি হয়েছে")); }
        else toast("শেয়ার করা যাচ্ছে না",true);
      }
      $("#dcardDownload").addEventListener("click",()=>{ if(currentDcardId) downloadDonorCard(currentDcardId); });
      $("#dcardShare").addEventListener("click",()=>{ if(currentDcardId) shareDonorCard(currentDcardId); });
      // পাবলিক ডোনার কার্ড (openDcard) বাটন হ্যান্ডলার
      document.addEventListener("click", e=>{
        const b = e.target.closest("[data-action='openDcard']"); if(!b) return;
        openDonorCard(b.dataset.id);
      });
  
      $("#searchForm").addEventListener("submit",e=>{e.preventDefault();});
      $("#searchGroup").addEventListener("change",()=>{ currentPage = 1; renderSearch(); });
      $("#searchArea").addEventListener("change",()=>{ currentPage = 1; renderSearch(); });
      $("#searchRefresh").addEventListener("click",()=>{ currentPage = 1; renderSearch(); toast("তালিকা রিফ্রেশ হয়েছে"); });
  
      function formObj(form){ return Object.fromEntries(new FormData(form).entries()); }
      function normalizeFormPhones(obj){ if(obj.phone)obj.phone=digits(obj.phone);if(obj.whatsapp)obj.whatsapp=digits(obj.whatsapp);return obj; }
      // Register: Bangla validation + duplicate check + Firestore (members pending)
      $("#registerForm").addEventListener("submit", async e => {
        e.preventDefault();
        const form = e.currentTarget, message = $("#registerMessage");
        if(!form.checkValidity()){
          showMessage(message,"অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো পূরণ করুন।","error");
          uiAlert("অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো সঠিকভাবে পূরণ করুন।",{type:"warn",title:"তথ্য অসম্পূর্ণ"});
          return;
        }
        const o = normalizeFormPhones(formObj(form));
        if(!phoneOK(o.phone) || (o.whatsapp && !phoneOK(o.whatsapp))){
          showMessage(message,"মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।","error");
          uiAlert("মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।",{type:"error",title:"ভুল নম্বর"});
          return;
        }
        
        showAppLoading();
        
        const sharedNow=sharedState();
        const donorSerial=(sharedNow?.donors?.length||0)+(sharedNow?.queue?.filter(x=>x.kind==="donor").length||0)+1;
        const newDonorId = `CBDC-2026-${String(donorSerial).padStart(4, '0')}`;
        const newMember = {
          id: id("D"),
          ...o,
          district: "চট্টগ্রাম",
          status: "pending",
          donorId: newDonorId,
          createdAt: new Date().toISOString()
        };
        
        if(window.CBDCShared)CBDCShared.update(st=>{
          st.queue.unshift({kind:"donor",id:newMember.id,donorId:newDonorId,name:o.name,group:o.bloodGroup,
            area:o.area,age:o.age||"",health:o.healthNotes||"",last:o.lastDonationDate||"",gender:o.gender,
            phone:o.phone,whatsapp:o.whatsapp||"",address:o.address||"",at:newMember.createdAt});return st;
        },"index:register");
        renderPublic();
  
        if(fbReady && db){
          (async () => {
            try {
              const {collection, addDoc, serverTimestamp} = await import("firebase/firestore");
              const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500));
              await Promise.race([
                addDoc(collection(db,'members'), {
                  ...o,
                  district: "চট্টগ্রাম",
                  status: "pending",
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  donorId: newDonorId
                }),
                timeoutPromise
              ]);
            } catch(fbErr){
              console.warn("Firestore member write:", fbErr && fbErr.message);
            }
          })();
        }
  
        setTimeout(() => {
          form.reset();
          $("#district").value = "চট্টগ্রাম";
          $("#donorAgree").checked = false;
          message.className = "hidden";
          message.textContent = "";
          showAppMessage("আপনার নিবন্ধন সফলভাবে গ্রহণ করা হয়েছে। বর্তমানে আপনার আবেদনটি অ্যাডমিনের অনুমোদনের অপেক্ষায় (Pending) রয়েছে। তথ্য যাচাই শেষে অনুমোদিত হলে আপনার প্রোফাইল রক্তদাতার তালিকায় প্রকাশিত হবে।", false, "নিবন্ধন সফল!");
        }, 300);
      });
  
      $("#eligibilityForm").addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget;if(!form.checkValidity()){uiAlert("অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো সঠিকভাবে পূরণ করুন।",{type:"warn",title:"তথ্য অসম্পূর্ণ"});return}const range=$("#lastRange").value,age=Number(digits($("#age").value)),reasons=[];if(age<18||age>60)reasons.push("বয়স ১৮ থেকে ৬০ বছরের মধ্যে হতে হবে।");if(range==="under3")reasons.push("সর্বশেষ রক্তদানের পর ৯০ দিন পূর্ণ হয়নি।");if(!$("#healthCheck").checked)reasons.push("বর্তমানে সম্পূর্ণ সুস্থ থাকার নিশ্চয়তা প্রয়োজন।");const box=$("#eligibilityResult");box.className="result "+(reasons.length?"fail":"ok");box.innerHTML=reasons.length?`<h3>⚠️ দুঃখিত! আপনি বর্তমানে রক্তদানের জন্য যোগ্য নন।</h3><p>সম্ভাব্য কারণগুলো:</p><ul>${reasons.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>`:`<h3>🎉 অভিনন্দন! আপনি প্রাথমিকভাবে রক্তদানের জন্য যোগ্য বলে বিবেচিত হচ্ছেন।</h3><p>দ্রষ্টব্য: চূড়ান্ত যোগ্যতা চিকিৎসক বা রক্ত সংগ্রহ কেন্দ্রের স্বাস্থ্য পরীক্ষার ওপর নির্ভর করবে।`;box.classList.remove("hidden");box.scrollIntoView({behavior:"smooth",block:"nearest"});});
  
      // Emergency Auto-Approval Toggle System (Default: OFF / false - goes to pending approval list)
      const isEmergencyAutoApproved = () => {
        const setting = localStorage.getItem("cbdc_auto_approve_emergency");
        return setting === "true" || setting === "1"; // Default: OFF (false)
      };
      window.setEmergencyAutoApprove = function(enable){
        localStorage.setItem("cbdc_auto_approve_emergency", enable ? "true" : "false");
        console.log("Emergency Auto-Approve:", enable ? "ON (Direct Live)" : "OFF (Pending Approval)");
        return enable ? "Emergency Auto-Approve is now ON (Direct Live)" : "Emergency Auto-Approve is now OFF (Pending Approval)";
      };
  
      $("#emergencyForm").addEventListener("submit", async e => {
        e.preventDefault();
        const form = e.currentTarget, message = $("#emergencyMessage");
        if(!form.checkValidity()){
          showMessage(message, "অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো পূরণ করুন।", "error");
          uiAlert("অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো সঠিকভাবে পূরণ করুন।", {type:"warn", title:"তথ্য অসম্পূর্ণ"});
          return;
        }
        
        const urgencyVal = $("#urgency").value;
        if(!urgencyVal || urgencyVal === ""){
          showMessage(message, "অনুগ্রহ করে জরুরিতার সময়সীমা নির্বাচন করুন।", "error");
          uiAlert("অনুগ্রহ করে জরুরিতার সময়সীমা নির্বাচন করুন।", {type:"warn", title:"তথ্য অসম্পূর্ণ"});
          $("#urgency").focus();
          return;
        }
        let hours = Number(urgencyVal);
        if(isNaN(hours) || hours <= 0){
          if(urgencyVal.includes("১ ঘণ্টা")) hours = 1;
          else if(urgencyVal.includes("২ ঘণ্টা")) hours = 2;
          else if(urgencyVal.includes("৬ ঘণ্টা")) hours = 6;
          else if(urgencyVal.includes("১২ ঘণ্টা")) hours = 12;
          else if(urgencyVal.includes("৪৮ ঘণ্টা") || urgencyVal.includes("২ দিন")) hours = 48;
          else if(urgencyVal.includes("৭২ ঘণ্টা") || urgencyVal.includes("৩ দিন")) hours = 72;
          else hours = 24;
        }
        
        const expiresAtDate = new Date(Date.now() + hours * 3600 * 1000);
        const urgencyText = $("#urgency").selectedOptions[0]?.textContent || (hours + " ঘণ্টা");
  
        const o = normalizeFormPhones({
          patientName: $("#patientName").value.trim(),
          patientAge: $("#patientAge").value.trim(),
          bloodGroup: $("#requestGroup").value,
          bags: Number(digits($("#bags").value)),
          hospitalName: $("#hospital").value.trim(),
          hospitalAddress: $("#hospitalAddress").value.trim(),
          urgency: urgencyText,
          durationHours: hours,
          requesterName: $("#requester").value.trim(),
          phone: $("#requestPhone").value.trim(),
          whatsapp: $("#requestWhatsapp").value.trim(),
          description: $("#description").value.trim(),
          instructions: $("#instructions").value.trim()
        });
        
        if(!phoneOK(o.phone) || (o.whatsapp && !phoneOK(o.whatsapp))){
          showMessage(message, "মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।", "error");
          uiAlert("মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।", {type:"error", title:"ভুল নম্বর"});
          return;
        }
        
        showAppLoading();
        
        const autoApproved = isEmergencyAutoApproved();
        const newStatus = autoApproved ? "approved" : "pending";
        
        const newReq = {
          id: id("E"),
          ...o,
          status: newStatus,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAtDate.toISOString()
        };
  
        // 1) Instant add to local cache & update board immediately
        if(window.CBDCShared)CBDCShared.update(st=>{
          if(newStatus==="approved")st.requests.unshift({...newReq});
          else st.queue.unshift({kind:"request",id:newReq.id,patient:o.patientName,group:o.bloodGroup,bags:o.bags,
            urgency:o.urgency,hospital:o.hospitalName,area:o.hospitalAddress,phone:o.phone,requester:o.requesterName,
            whatsapp:o.whatsapp||"",description:o.description||"",at:newReq.createdAt,expiresAt:newReq.expiresAt});
          return st;
        },"index:emergency");
        renderBoard();
        
        // 2) Background Firestore sync (with timeout so it never hangs)
        if(fbReady && db){
          (async () => {
            try {
              const {collection, addDoc, serverTimestamp, Timestamp} = await import("firebase/firestore");
              const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500));
              await Promise.race([
                addDoc(collection(db,'requests'), {
                  ...o,
                  status: newStatus,
                  expiresAt: Timestamp.fromDate(expiresAtDate),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                }),
                timeoutPromise
              ]);
            } catch(fbErr){
              console.warn("Firestore emergency write:", fbErr && fbErr.message);
            }
          })();
        }
        
        // 3) Complete submission response immediately after 300ms
        setTimeout(() => {
          form.reset();
          $("#requestAgree").checked = false;
          message.className = "hidden";
          message.textContent = "";
          
          if(autoApproved){
            showAppMessage("আপনার জরুরি রক্তের আবেদনটি সরাসরি লাইভ সহায়তা বোর্ডে যুক্ত হয়েছে।", false, "আবেদন লাইভ হয়েছে!");
          } else {
            showAppMessage("আপনার জরুরি রক্তের আবেদনটি সফলভাবে জমা হয়েছে। বর্তমানে এটি অ্যাডমিনের অনুমোদনের অপেক্ষায় (Pending) রয়েছে। তথ্য যাচাই ও অনুমোদনের পর লাইভ সহায়তা বোর্ডে প্রকাশিত হবে।", false, "আবেদন গৃহীত হয়েছে");
          }
        }, 300);
      });
  
  
      /* ==========================================================================
         AUTH: লগইন • অ্যাকাউন্ট তৈরি • Google Sign-In • বাংলা নাম প্রস্তাব
         ========================================================================== */
  
      /* --- পাসওয়ার্ড দেখান / লুকান --- */
      document.addEventListener("click", e => {
        const btn = e.target.closest("[data-pw-toggle]");
        if(!btn) return;
        const inp = document.getElementById(btn.dataset.pwToggle);
        if(!inp) return;
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        btn.classList.toggle("is-visible", show);
        btn.setAttribute("aria-label", show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান");
        btn.setAttribute("title", show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান");
        btn.setAttribute("aria-pressed", String(show));
      });
  
      /* --- ইংরেজি নাম → প্রস্তাবিত বাংলা নাম --- */
      const BN_NAME_DICT = {
        md:"মোঃ", mohammad:"মোহাম্মদ", muhammad:"মুহাম্মদ", mohammed:"মোহাম্মদ", mohd:"মোঃ", mst:"মোছাঃ", mrs:"মিসেস", mr:"জনাব",
        shahadat:"শাহাদাত", sahu:"সাহু", arif:"আরিফ", arifur:"আরিফুর", rahman:"রহমান", rehman:"রহমান",
        ahmed:"আহমেদ", ahmad:"আহমাদ", hossain:"হোসাইন", hossen:"হোসেন", hosen:"হোসেন", hussain:"হুসাইন",
        islam:"ইসলাম", islami:"ইসলামী", karim:"করিম", rahim:"রহিম", abdul:"আব্দুল", abdur:"আব্দুর", abdullah:"আব্দুল্লাহ",
        kabir:"কবির", alam:"আলম", uddin:"উদ্দিন", jahan:"জাহান", akter:"আক্তার", akhter:"আক্তার", akhtar:"আক্তার",
        begum:"বেগম", khatun:"খাতুন", sultana:"সুলতানা", nasrin:"নাসরিন", farhana:"ফারহানা",
        tanvir:"তানভীর", tanzim:"তানজিম", sadia:"সাদিয়া", nusrat:"নুসরাত", mehrab:"মেহরাব", shakil:"শাকিল",
        jahid:"জাহিদ", zahid:"জাহিদ", jahidul:"জাহিদুল", rifat:"রিফাত", rifatul:"রিফাতুল", iqbal:"ইকবাল",
        mahmud:"মাহমুদ", mahmood:"মাহমুদ", sabrina:"সাবরিনা", kamrul:"কামরুল", hasan:"হাসান", hassan:"হাসান",
        ashraful:"আশরাফুল", nabila:"নাবিলা", chowdhury:"চৌধুরী", choudhury:"চৌধুরী", chowdury:"চৌধুরী",
        sanjida:"সানজিদা", haque:"হক", hoque:"হক", haq:"হক", najmul:"নাজমুল", sakib:"সাকিব", rakib:"রাকিব",
        saiful:"সাইফুল", nazrul:"নজরুল", imran:"ইমরান", faisal:"ফয়সাল", jubayer:"জুবায়ের", sohel:"সোহেল",
        robiul:"রবিউল", rabiul:"রবিউল", mizan:"মিজান", mizanur:"মিজানুর", monir:"মনির", jasim:"জসিম",
        kawsar:"কাউসার", tarek:"তারেক", tareq:"তারেক", forhad:"ফরহাদ", farhad:"ফরহাদ", sohag:"সোহাগ",
        rasel:"রাসেল", russel:"রাসেল", riyad:"রিয়াদ", siam:"সিয়াম", tamim:"তামিম", mahi:"মাহি", ayan:"আয়ান",
        arafat:"আরাফাত", sumon:"সুমন", shuvo:"শুভ", shovo:"শুভ", naim:"নাঈম", nayeem:"নাঈম", junaid:"জুনায়েদ",
        salman:"সালমান", sabbir:"সাব্বির", shanto:"শান্ত", emon:"ইমন", alif:"আলিফ", anik:"অনিক", hridoy:"হৃদয়",
        joy:"জয়", rony:"রনি", tanjil:"তানজিল", mahfuz:"মাহফুজ", masud:"মাসুদ", mamun:"মামুন", jewel:"জুয়েল",
        badhon:"বাঁধন", mim:"মিম", jannat:"জান্নাত", tania:"তানিয়া", ayesha:"আয়েশা", aysha:"আয়েশা",
        fatema:"ফাতেমা", fatima:"ফাতিমা", khadija:"খাদিজা", maria:"মারিয়া", sumaiya:"সুমাইয়া", rima:"রিমা",
        mitu:"মিতু", priya:"প্রিয়া", anika:"আনিকা", tasnim:"তাসনিম", tabassum:"তাবাসসুম", jarin:"জারিন",
        samia:"সামিয়া", sharmin:"শারমিন", ruma:"রুমা", laila:"লায়লা", rokeya:"রোকেয়া", salma:"সালমা",
        raktabandhu:"রক্তবন্ধু", club:"ক্লাব", blood:"ব্লাড", donor:"ডোনার"
      };
      const BN_CONS = [
        ["chh","ছ"],["sch","শ"],["kh","খ"],["gh","ঘ"],["ch","চ"],["jh","ঝ"],["th","থ"],["dh","ধ"],["ph","ফ"],
        ["bh","ভ"],["sh","শ"],["zh","জ"],["ng","ং"],["ck","ক"],["kk","ক্ক"],["ll","ল্ল"],["mm","ম্ম"],["nn","ন্ন"],
        ["ss","স"],["tt","ট"],["dd","ড"],["pp","প্প"],["bb","ব্ব"],["rr","র"],["k","ক"],["q","ক"],["g","গ"],
        ["c","ক"],["j","জ"],["z","জ"],["t","ত"],["d","দ"],["n","ন"],["p","প"],["f","ফ"],["b","ব"],["m","ম"],
        ["y","য়"],["r","র"],["l","ল"],["v","ভ"],["w","ও"],["s","স"],["h","হ"],["x","ক্স"]
      ];
      const BN_VOW = [
        ["aa",["আ","া"]],["ai",["ঐ","ৈ"]],["au",["ঔ","ৌ"]],["ou",["ঔ","ৌ"]],["ee",["ঈ","ী"]],["oo",["উ","ু"]],
        ["oi",["ঐ","ৈ"]],["a",["আ","া"]],["i",["ই","ি"]],["u",["উ","ু"]],["e",["এ","ে"]],["o",["ও","ো"]]
      ];
      function translitWord(w){
        const s = w.toLowerCase();
        let out = "", i = 0, prevCons = false;
        while(i < s.length){
          let matched = false;
          for(const [k,v] of BN_VOW){
            if(s.startsWith(k, i)){
              const isEnd = (i + k.length >= s.length);
              // শব্দের শেষে 'a' থাকলে সাধারণত উচ্চারিত হয় না
              if(k === "a" && isEnd && prevCons){ i += 1; matched = true; break; }
              out += prevCons ? v[1] : v[0];
              i += k.length; prevCons = false; matched = true; break;
            }
          }
          if(matched) continue;
          for(const [k,v] of BN_CONS){
            if(s.startsWith(k, i)){ out += v; i += k.length; prevCons = true; matched = true; break; }
          }
          if(!matched){ i += 1; }
        }
        return out;
      }
      function suggestBanglaName(name){
        const raw = String(name || "").trim();
        if(!raw) return "";
        if(/[\u0980-\u09FF]/.test(raw)) return "";          // আগে থেকেই বাংলা
        return raw.split(/\s+/).map(word => {
          const key = word.toLowerCase().replace(/[^a-z]/g, "");
          if(!key) return "";
          return BN_NAME_DICT[key] || translitWord(key);
        }).filter(Boolean).join(" ");
      }
      function suggestUsername(name, email){
        let base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        if(!base && email) base = String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if(!base) base = "cbdc_user";
        return base.slice(0, 20);
      }
  
      /* --- বাংলা নাম প্রস্তাব UI (ইউজার চাইলে পরিবর্তন করতে পারবে) --- */
      let _bnSuggestValue = "";
      function refreshNameSuggest(){
        const inp = $("#suName"), box = $("#suNameSuggest");
        if(!inp || !box) return;
        const s = suggestBanglaName(inp.value);
        _bnSuggestValue = s;
        if(s && s !== inp.value.trim()){
          box.innerHTML = `প্রস্তাবিত বাংলা নাম: <strong>${esc(s)}</strong> — <a href="javascript:void(0)" id="applyBnName" style="font-weight:900;color:#087144">এটি ব্যবহার করুন</a> (চাইলে নিজে পরিবর্তন করতে পারবেন)`;
          box.classList.remove("hidden");
        } else {
          box.classList.add("hidden"); box.innerHTML = "";
        }
      }
      $("#suName")?.addEventListener("input", refreshNameSuggest);
      document.addEventListener("click", e => {
        if(e.target && e.target.id === "applyBnName"){
          const inp = $("#suName");
          if(inp && _bnSuggestValue){ inp.value = _bnSuggestValue; refreshNameSuggest(); toast("বাংলা নাম বসানো হয়েছে — চাইলে পরিবর্তন করতে পারবেন"); }
        }
      });
  
  
      /* ==========================================================================
         ROLE সিস্টেম — সম্পূর্ণ ডেটাবেস-নিয়ন্ত্রিত
         donor     → ডিফল্ট (সাধারণ ব্যবহারকারী, ওয়েবসাইটেই থাকে)
         moderator → মডারেটর প্যানেল (#/moderator)
         admin     → অ্যাডমিন প্যানেল (#/admin)
         role বদলাতে হলে Firestore-এ `admins` ডকুমেন্টের `role` ফিল্ড পরিবর্তন করতে হবে।
         ========================================================================== */
      const DEFAULT_ROLE = "donor";
      const ROLE_LABEL = {donor:"রক্তদাতা", moderator:"মডারেটর", admin:"অ্যাডমিন"};
      const roleLabel = r => ROLE_LABEL[r] || ROLE_LABEL[DEFAULT_ROLE];
  
      // ইমেইল দিয়ে ডেটাবেস থেকে role বের করা — admins কালেকশনে থাকলে সেই role, না থাকলে donor
      async function resolveRole(email, fallbackName){
        const out = {role: DEFAULT_ROLE, name: fallbackName || "", permissions: {}};
        if(!fbReady || !db || !email) return out;
        const lower = String(email).toLowerCase();
        try{
          const {collection, query, where, getDocs, limit} = await import("firebase/firestore");
          const aSnap = await getDocs(query(collection(db,"admins"), where("email","==",lower), limit(1)));
          if(!aSnap.empty){
            const d = aSnap.docs[0].data();
            const r = String(d.role||"admin").toLowerCase();
            out.role = (r==="admin"||r==="moderator") ? r : DEFAULT_ROLE;
            out.name = d.name || out.name;
            out.permissions = d.permissions || {};
            return out;
          }
        }catch(e){ console.warn("admins lookup:", e.message); }
        try{
          const uDoc = await findUserByEmail(lower);
          if(uDoc){
            out.name = uDoc.name || out.name;
            const r = String(uDoc.role||DEFAULT_ROLE).toLowerCase();
            // users কালেকশনে admin/moderator লেখা থাকলেও তা গ্রাহ্য নয় — নিরাপত্তার জন্য শুধু admins কালেকশনই কর্তৃপক্ষ
            out.role = (r==="admin"||r==="moderator") ? DEFAULT_ROLE : (r || DEFAULT_ROLE);
          }
        }catch(e){ console.warn("users lookup:", e.message); }
        return out;
      }
  
      // role অনুযায়ী সঠিক জায়গায় পাঠানো
      function finishLogin({email, name, role, permissions, photo}){
        const r = role || DEFAULT_ROLE;
        if(r === "admin" || r === "moderator"){
          saveSession(email, name || email, r, permissions || {}, "firebase");
          toast(roleLabel(r) + " প্যানেলে যাওয়া হচ্ছে…");
          navigateToPage(r);
          return;
        }
        // donor (ডিফল্ট) — ওয়েবসাইটেই লগইন অবস্থায় থাকবে
        saveMemberSession({email, name: name || email, photo: photo || "", role: r});
        toast("স্বাগতম, " + (name || "রক্তদাতা") + "!");
        toast("ডোনার প্যানেলে যাওয়া হচ্ছে…");
        setTimeout(()=>{ navigateToPage("doner"); },350);
      }
  
      /* --- Google প্রোফাইল স্টেট --- */
      let googleProfile = null;  // {uid,email,name,photo}
      function setSignupGoogleMode(profile){
        googleProfile = profile || null;
        const chip = $("#signupGoogleChip"), emailInp = $("#suEmail"), emailNote = $("#suEmailNote");
        const p1 = $("#suPassField"), p2 = $("#suPass2Field");
        if(profile){
          chip?.classList.remove("hidden");
          $("#sgAvatar").src = profile.photo || avatarData("পুরুষ");
          $("#sgName").textContent = profile.name || "Google ব্যবহারকারী";
          $("#sgEmail").textContent = profile.email || "";
          // Google থেকে পাওয়া তথ্য প্রি-ফিল
          const bnName = suggestBanglaName(profile.name);
          $("#suName").value = profile.name || "";
          emailInp.value = profile.email || "";
          emailInp.setAttribute("readonly", "readonly");   // verified email — পরিবর্তন করা যাবে না
          emailNote?.classList.remove("hidden");
          $("#suUsername").value = suggestUsername(profile.name, profile.email);  // editable
          // পাসওয়ার্ড দরকার নেই (Google অ্যাকাউন্ট)
          [p1, p2].forEach(f => f && f.classList.add("hidden"));
          $("#suPassword").required = false; $("#suPassword2").required = false;
          refreshNameSuggest();
          if(bnName) toast("Google তথ্য বসানো হয়েছে — বাংলা নাম প্রস্তাব: " + bnName);
        } else {
          chip?.classList.add("hidden");
          emailInp?.removeAttribute("readonly");
          emailNote?.classList.add("hidden");
          [p1, p2].forEach(f => f && f.classList.remove("hidden"));
          $("#suPassword").required = true; $("#suPassword2").required = true;
        }
      }
  
      /* Google সাইন-ইন — ডেস্কটপে popup, মোবাইল/WebView বা popup ব্লক হলে
         স্বয়ংক্রিয় redirect fallback (src/lib/authx.ts)।
         null ফেরত মানে redirect শুরু হয়েছে (পেজ Google-এ চলে যাচ্ছে) —
         ফিরে এলে consumeGoogleRedirect() ফলাফল resume করে। */
      async function googleSignIn(intent){
        if(!fbReady || !auth){
          uiAlert("Google লগইনের জন্য Firebase সংযোগ প্রয়োজন। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", {type:"error", title:"সংযোগ নেই"});
          return null;
        }
        const res = await googleSignInWithFallback(auth, intent === "signup" ? "signup" : "login");
        if(!res) return null;
        const u = res.user;
        return {uid:u.uid, email:u.email || "", name:u.displayName || "", photo:u.photoURL || ""};
      }
  
      // ওয়েবসাইট অ্যাকাউন্ট খোঁজা (users কালেকশন — ডোনার তালিকা থেকে সম্পূর্ণ আলাদা)
      async function findUserByEmail(email){
        if(!fbReady || !db || !email) return null;
        try{
          const {collection, query, where, getDocs, limit} = await import("firebase/firestore");
          const snap = await getDocs(query(collection(db,"users"), where("email","==",email), limit(1)));
          if(snap.empty) return null;
          return {id: snap.docs[0].id, ...snap.docs[0].data()};
        }catch(e){ console.warn("user lookup:", e.message); return null; }
      }
      function saveMemberSession(profile){
        localStorage.setItem("cbdcMember","1");
        localStorage.setItem("cbdcMemberEmail", profile.email||"");
        localStorage.setItem("cbdcMemberName", profile.name||"");
        localStorage.setItem("cbdcMemberPhoto", profile.photo||"");
        localStorage.setItem("cbdcMemberRole", profile.role||"donor");
        try{
          const app=JSON.parse(localStorage.getItem("cbdc.app")||"{}");
          app.account=Object.assign({uid:"",name:"",username:"",email:"",phone:"",photo:"",photoSource:"none",emailVerified:false,phoneVerified:false,dob:"",gender:"",area:"",address:"",joined:new Date().toISOString().slice(0,10)},app.account||{},
            {name:profile.name||app.account?.name||"",email:profile.email||app.account?.email||"",photo:profile.photo||app.account?.photo||"",
             phone:profile.phone||app.account?.phone||"",gender:profile.gender||app.account?.gender||"",area:profile.area||app.account?.area||""});
          app.prefs=Object.assign({theme:"system",lang:"bn",dense:false,anim:true,badge:true},app.prefs||{});
          localStorage.setItem("cbdc.app",JSON.stringify(app));
        }catch(e){}
        renderAuthState();
      }
      function clearMemberSession(){
        ["cbdcMember","cbdcMemberEmail","cbdcMemberName","cbdcMemberPhoto","cbdcMemberRole"].forEach(k=>localStorage.removeItem(k));
        renderAuthState();
      }
      const isLoggedIn = () => localStorage.getItem("cbdcMember")==="1";
  
      /* নেভিগেশনে লগইন/লগআউট অবস্থা দেখানো */
      function renderAuthState(){
        const loginLink = document.querySelector('#mainNav a[data-route="dashboard"]');
        const signupLink = document.querySelector('#mainNav a[data-route="signup"]');
        const logged = isLoggedIn();
        if(signupLink) signupLink.classList.toggle("hidden", logged);
        if(loginLink){
          if(logged){
            const nm = localStorage.getItem("cbdcMemberName") || "প্রোফাইল";
            loginLink.textContent = "ডোনার প্যানেল (" + nm.split(" ")[0] + ")";
            loginLink.dataset.route = "donorPanel";
            loginLink.title = roleLabel(localStorage.getItem("cbdcMemberRole") || DEFAULT_ROLE);
          } else {
            loginLink.textContent = "লগইন";
            loginLink.dataset.route = "dashboard";
            loginLink.removeAttribute("title");
          }
        }
        // signup ভিউতে থাকলে এবং লগইন থাকলে হোমে ফেরত
        const su = $("#view-signup");
        if(logged && su && su.classList.contains("active")) showView("home");
      }
      async function doLogout(){
        const ok = await uiDialog({type:"warn", title:"লগআউট করবেন?", desc:"আপনি কি নিশ্চিতভাবে অ্যাকাউন্ট থেকে বের হতে চান?", okText:"হ্যাঁ, লগআউট", cancelText:"বাতিল"});
        if(!ok) return;
        try{ if(auth && auth.currentUser){ const {signOut} = await import("firebase/auth"); await signOut(auth); } }catch(e){}
        clearMemberSession(); clearSession();
        toast("লগআউট সম্পন্ন হয়েছে");
        showView("home");
      }
  
      /* --- Google flow সম্পন্ন করা (popup এবং redirect-resume — দুই পথেই একই যুক্তি) --- */
      async function continueGoogleLogin(p){
        showAppLoading();
        const {role, name, permissions} = await resolveRole(p.email, p.name);
        if(role === "admin" || role === "moderator"){
          if(db && p.uid) ensureUserProfile(db, {uid:p.uid, email:p.email, name:p.name, photo:p.photo}, {provider:"google"}).catch(e=>console.warn("profile upsert:", e&&e.message));
          hideAppModal();
          finishLogin({email:p.email, name: name || p.name, role, permissions, photo:p.photo});
          return;
        }
        const member = await findUserByEmail(p.email);
        if(member){
          if(db && p.uid) ensureUserProfile(db, {uid:p.uid, email:p.email, name:member.name || p.name, photo:member.photoURL || p.photo}, {provider:"google"}).catch(e=>console.warn("profile upsert:", e&&e.message));
          hideAppModal();
          finishLogin({email:p.email, name: member.name || p.name, role: DEFAULT_ROLE, permissions:{}, photo: member.photoURL || p.photo});
          return;
        }
        hideAppModal();
        // অ্যাকাউন্ট নেই → Google তথ্যসহ অ্যাকাউন্ট তৈরির পেজ
        setSignupGoogleMode(p);
        showView("signup");
        showMessage($("#signupMessage"), "এই Google অ্যাকাউন্টে কোনো CBDC অ্যাকাউন্ট নেই। নিচের তথ্যগুলো নিশ্চিত করে অ্যাকাউন্ট তৈরি সম্পন্ন করুন।", "error");
      }
      async function continueGoogleSignup(p){
        const member = await findUserByEmail(p.email);
        if(member){
          const rr = await resolveRole(p.email, member.name || p.name);
          if(db && p.uid) ensureUserProfile(db, {uid:p.uid, email:p.email, name: rr.name || member.name || p.name, photo: member.photoURL || p.photo}, {provider:"google"}).catch(e=>console.warn("profile upsert:", e&&e.message));
          showAppMessage("এই Google অ্যাকাউন্টে ইতিমধ্যে একটি CBDC অ্যাকাউন্ট রয়েছে, তাই আপনাকে সরাসরি লগইন করানো হয়েছে।", false, "লগইন সফল");
          finishLogin({email:p.email, name: rr.name || member.name || p.name, role: rr.role, permissions: rr.permissions, photo: member.photoURL || p.photo});
          return;
        }
        setSignupGoogleMode(p);
        showView("signup");
        toast("Google তথ্য নেওয়া হয়েছে — বাকি তথ্য পূরণ করুন");
        setTimeout(()=>$("#suUsername")?.focus(), 300);
      }

      /* --- Google দিয়ে লগইন --- */
      $("#btnGoogleLogin")?.addEventListener("click", async () => {
        const btn = $("#btnGoogleLogin");
        try{
          btn.disabled = true;
          const p = await googleSignIn("login");
          if(!p) return; // redirect শুরু হয়েছে — ফিরে এলে boot-এ flow resume হবে
          await continueGoogleLogin(p);
        }catch(err){
          hideAppModal();
          console.warn("Google login:", err);
          setGoogleIntent(null);
          const code = err && err.code || "";
          if(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"){
            toast("Google লগইন বাতিল করা হয়েছে", true);
          } else {
            uiAlert(authErrorMessage(err), {type:"error", title:"লগইন ব্যর্থ"});
          }
        }finally{ btn.disabled = false; }
      });

      /* --- Google দিয়ে অ্যাকাউন্ট তৈরি --- */
      $("#btnGoogleSignup")?.addEventListener("click", async () => {
        const btn = $("#btnGoogleSignup");
        try{
          btn.disabled = true;
          const p = await googleSignIn("signup");
          if(!p) return; // redirect শুরু হয়েছে — ফিরে এলে boot-এ flow resume হবে
          await continueGoogleSignup(p);
        }catch(err){
          console.warn("Google signup:", err);
          setGoogleIntent(null);
          const code = err && err.code || "";
          if(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"){
            toast("Google সাইন-আপ বাতিল করা হয়েছে", true);
          } else {
            uiAlert(authErrorMessage(err), {type:"error", title:"ব্যর্থ হয়েছে"});
          }
        }finally{ btn.disabled = false; }
      });
  
      /* --- OTP-ভিত্তিক পাসওয়ার্ড পুনরুদ্ধার --- */
      /* --- পাসওয়ার্ড রিসেট — Firebase Authentication (sendPasswordResetEmail) --- */
      const validRecoveryId=v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)||phoneOK(v)||/^[a-z0-9._]{3,30}$/i.test(v);
      function maskRecovery(v){
        v=String(v||"");
        if(v.includes("@")){const [a,b]=v.split("@");return (a.slice(0,2)||"*")+"***@"+b}
        const p=digits(v);return p.length===11?p.slice(0,3)+"****"+p.slice(-4):v;
      }
      async function resolveEmailByIdentifier(identifier){
        if(!fbReady || !db) return null;
        const q=String(identifier).trim().toLowerCase();
        try{
          const {collection, query, where, getDocs, limit} = await import("firebase/firestore");
          const uname = await getDocs(query(collection(db,"users"), where("username","==",q), limit(1)));
          if(!uname.empty) return String(uname.docs[0].data().email||"").toLowerCase();
          const phone = await getDocs(query(collection(db,"users"), where("phone","==",digits(q)), limit(1)));
          if(!phone.empty) return String(phone.docs[0].data().email||"").toLowerCase();
        }catch(e){ console.warn("identifier lookup:", e.message); }
        return null;
      }
      function openOtpRecovery(prefill=""){
        document.getElementById("otpRecoveryBg")?.remove();
        const bg=document.createElement("div");bg.id="otpRecoveryBg";bg.className="modal-bg";
        bg.innerHTML=`<div class="modal otp-modal" role="dialog" aria-modal="true" aria-labelledby="otpTitle">
          <button class="close" type="button" data-otp-close aria-label="বন্ধ করুন">✕</button>
          <div id="otpRecoveryBody"></div></div>`;
        document.body.appendChild(bg);document.body.classList.add("lock");
        const body=bg.querySelector("#otpRecoveryBody"),close=()=>{bg.remove();document.body.classList.remove("lock")};
        bg.querySelector("[data-otp-close]").onclick=close;bg.onclick=e=>{if(e.target===bg)close()};
        const err=(msg)=>{const e=body.querySelector(".otp-error");if(e){e.textContent=msg;e.classList.add("show")}};
        const start=()=>{
          body.innerHTML=`<h2 id="otpTitle">পাসওয়ার্ড রিসেট</h2><p class="otp-sub">আপনার অ্যাকাউন্টের ইমেইল, মোবাইল নম্বর অথবা ইউজার নেইম দিন।</p>
            <div class="otp-note">🔐 <span>Firebase Authentication থেকে একটি পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হবে।</span></div>
            <div class="field"><label for="otpRecipient">ইমেইল / মোবাইল / ইউজার নেইম</label>
              <input id="otpRecipient" value="${esc(prefill)}" autoComplete="username" placeholder="example@gmail.com অথবা 01XXXXXXXXX"></div>
            <div class="otp-error" role="alert"></div><div class="otp-actions">
              <button class="btn btn-outline" type="button" data-otp-close2>বাতিল</button><button class="btn btn-green" type="button" id="otpSend">রিসেট লিংক পাঠান</button></div>`;
          body.querySelector("[data-otp-close2]").onclick=close;
          body.querySelector("#otpSend").onclick=send;
          body.querySelector("#otpRecipient").addEventListener("keydown",e=>{if(e.key==="Enter")send()});
          setTimeout(()=>body.querySelector("#otpRecipient")?.focus(),50);
        };
        const send=async()=>{
          const input=body.querySelector("#otpRecipient"),raw=input.value.trim();
          if(!validRecoveryId(raw)){err("সঠিক ইমেইল, মোবাইল নম্বর অথবা ইউজার নেইম দিন।");return}
          const btn=body.querySelector("#otpSend");btn.disabled=true;btn.textContent="পাঠানো হচ্ছে…";
          try{
            if(!fbReady || !auth) throw new Error("Firebase সংযোগ নেই। ইন্টারনেট সংযোগ পরীক্ষা করুন।");
            const {sendPasswordResetEmail} = await import("firebase/auth");
            let recipient=raw.toLowerCase();
            if(!recipient.includes("@")){
              const found=await resolveEmailByIdentifier(recipient);
              if(!found){throw new Error("এই আইডির সাথে যুক্ত ইমেইল পাওয়া যায়নি।");}
              recipient=found;
            }
            await sendPasswordResetEmail(auth, recipient);
            success(recipient);
          }catch(e){btn.disabled=false;btn.textContent="রিসেট লিংক পাঠান";err(authErrorMessage(e, {fallback: "রিসেট লিংক পাঠানো যায়নি। আবার চেষ্টা করুন।"}))}
        };
        const success=(recipient)=>{
          body.innerHTML=`<div class="otp-success"><span>✓</span><h3>রিসেট লিংক পাঠানো হয়েছে</h3><p>${esc(maskRecovery(recipient))} ঠিকানায় একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইমেইল খুলে লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।</p></div><div class="otp-actions"><button class="btn btn-green" type="button" id="otpDone">লগইনে ফিরুন</button></div>`;
          body.querySelector("#otpDone").onclick=()=>{close();$("#password")?.focus()};
        };
        start();
      }
      $("#btnForgotPass")?.addEventListener("click",()=>openOtpRecovery($("#username")?.value||""));
  
      /* --- অ্যাকাউন্ট তৈরি (Email/Password অথবা Google) --- */
      $("#signupForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        const form = e.currentTarget, message = $("#signupMessage");
        const isGoogle = !!googleProfile;
        if(!form.checkValidity()){
          showMessage(message, "অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো পূরণ করুন।", "error");
          uiAlert("অনুগ্রহ করে চিহ্নিত আবশ্যিক ঘরগুলো সঠিকভাবে পূরণ করুন।", {type:"warn", title:"তথ্য অসম্পূর্ণ"});
          return;
        }
        const o = normalizeFormPhones(formObj(form));
        o.username = (o.username||"").trim().toLowerCase();
        o.email = (o.email||"").trim().toLowerCase();
        if(!/^[a-z0-9._]{3,20}$/.test(o.username)){
          uiAlert("ইউজার নেইম ৩-২০ অক্ষরের হতে হবে এবং শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, ডট বা আন্ডারস্কোর ব্যবহার করা যাবে।", {type:"error", title:"ইউজার নেইম সঠিক নয়"});
          return;
        }
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)){
          uiAlert("সঠিক ইমেইল ঠিকানা লিখুন।", {type:"error", title:"ইমেইল সঠিক নয়"});
          return;
        }
        if(!isGoogle){
          if((o.password||"").length < 6){
            uiAlert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", {type:"error", title:"দুর্বল পাসওয়ার্ড"}); return;
          }
          if(o.password !== $("#suPassword2").value){
            uiAlert("দুইবার লেখা পাসওয়ার্ড মিলছে না। আবার চেষ্টা করুন।", {type:"error", title:"পাসওয়ার্ড মিলছে না"}); return;
          }
        }
        if(!phoneOK(o.phone) || (o.whatsapp && !phoneOK(o.whatsapp))){
          showMessage(message, "মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।", "error");
          uiAlert("মোবাইল নম্বর অবশ্যই ১১ সংখ্যার সঠিক বাংলাদেশি নম্বর হতে হবে।", {type:"error", title:"ভুল নম্বর"});
          return;
        }
        if(!$("#suAgree").checked){
          uiAlert("অ্যাকাউন্ট তৈরি করতে অঙ্গীকারে সম্মতি দিন।", {type:"warn", title:"সম্মতি প্রয়োজন"}); return;
        }
  
        showAppLoading();
        const password = o.password || "";
        delete o.password;
  
        try{
          let uid = googleProfile ? googleProfile.uid : null;
  
          if(fbReady && auth && !isGoogle){
            const {createUserWithEmailAndPassword, updateProfile} = await import("firebase/auth");
            const cred = await createUserWithEmailAndPassword(auth, o.email, password);
            uid = cred.user.uid;
            try{ await updateProfile(cred.user, {displayName: o.name}); }catch(_){}
          }
  
          // ১) ওয়েবসাইট অ্যাকাউন্ট — `users` কালেকশন (সাথে সাথেই সক্রিয়, কোনো অনুমোদন লাগে না)
          const userDoc = {
            name: o.name,
            username: o.username,
            email: o.email,
            phone: o.phone || "",
            uid: uid || "",
            photoURL: googleProfile ? (googleProfile.photo||"") : "",
            provider: isGoogle ? "google" : "password",
            role: DEFAULT_ROLE,        // ডিফল্ট role: donor — বদলাতে হলে Firestore `admins`-এ যুক্ত করতে হবে
            status: "active",          // সরাসরি সক্রিয় — লগইনে কোনো বাধা নেই
            createdAt: new Date().toISOString()
          };
  
  
          // ২) রক্তদাতা প্রোফাইল — `members` কালেকশন (অ্যাডমিন যাচাইয়ের পর পাবলিক তালিকায় যাবে)
          const donorDoc = {
            name: o.name,
            email: o.email,
            username: o.username,
            bloodGroup: o.bloodGroup || "",
            gender: o.gender || "",
            age: o.age || "",
            area: o.area || "",
            phone: o.phone || "",
            whatsapp: o.whatsapp || "",
            address: o.address || "",
            lastDonationDate: o.lastDonationDate || "",
            healthNotes: o.healthNotes || "",
            uid: uid || "",
            photoURL: userDoc.photoURL,
            district: "চট্টগ্রাম",
            status: "pending",
            createdAt: new Date().toISOString()
          };
  
          if(fbReady && db){
            const {collection, doc, setDoc, addDoc, serverTimestamp} = await import("firebase/firestore");
            const race = (pr) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]);
            // users/{uid} — auth uid দিয়ে কী করা, যাতে Security Rules-এ role যাচাই করা যায়
            await race(setDoc(doc(db,"users", uid || o.email), {...userDoc, createdAt: serverTimestamp(), updatedAt: serverTimestamp()}))
              .catch(err => console.warn("Firestore user write:", err && err.message));
            await race(addDoc(collection(db,"members"), {...donorDoc, createdAt: serverTimestamp(), updatedAt: serverTimestamp()}))
              .catch(err => console.warn("Firestore member write:", err && err.message));
          }
  
          saveMemberSession({email:o.email, name:o.name, photo:userDoc.photoURL, role:DEFAULT_ROLE,
            phone:o.phone,gender:o.gender,area:o.area});
          form.reset();
          $("#suAgree").checked = false;
          setSignupGoogleMode(null);
          message.className = "hidden"; message.textContent = "";
          renderAuthState();
          showAppMessage("আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে এবং আপনি এখন লগইন অবস্থায় আছেন ✅\n\nরক্তদাতা হিসেবে আপনার তথ্য অ্যাডমিন যাচাই করার পর পাবলিক রক্তদাতা তালিকায় প্রকাশিত হবে।", false, "স্বাগতম, " + (o.name || "সদস্য") + "!");
          showView("home");
        }catch(err){
          hideAppModal();
          console.warn("signup error:", err);
          const msg = authErrorMessage(err, {fallback: "অ্যাকাউন্ট তৈরি করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।"});
          showMessage(message, msg, "error");
          uiAlert(msg, {type:"error", title:"অ্যাকাউন্ট তৈরি ব্যর্থ"});
        }
      });
  
      /* ===== Login: Firebase Auth ===== */
      $("#loginForm").addEventListener("submit", async e=>{
        e.preventDefault();
        const u=$("#username").value.trim(),password=$("#password").value;
        if(!u||!password){
          showMessage($("#loginMessage"),"ইমেইল/ইউজার নেইম এবং পাসওয়ার্ড দুটোই দিন।","error");
          uiAlert("ইমেইল/ইউজার নেইম এবং পাসওয়ার্ড দুটোই পূরণ করুন।",{type:"warn",title:"তথ্য অসম্পূর্ণ"});return;
        }
        showAppLoading();
        try{
          if(!fbReady || !auth) throw Object.assign(new Error("network"),{code:"auth/network-request-failed"});
          const {signInWithEmailAndPassword}=await import("firebase/auth");
          // ইমেইল না দিলে users কালেকশন থেকে username/phone দিয়ে ইমেইল বের করি
          let email=String(u).trim().toLowerCase();
          if(!email.includes("@")){
            const found=await resolveEmailByIdentifier(email);
            if(!found) throw Object.assign(new Error("invalid"),{code:"auth/invalid-credential"});
            email=found;
          }
          const cred=await signInWithEmailAndPassword(auth,email,password);
          const resolved=await resolveRole(email, cred.user.displayName || email);
          // login-এর পর Firestore-এ user profile আছে কিনা নিশ্চিত করি (self-heal)
          if(db && cred.user && cred.user.uid){
            ensureUserProfile(db, {uid:cred.user.uid, email:(cred.user.email||email), name: resolved.name || cred.user.displayName || email, photo: cred.user.photoURL || ""}, {provider:"password"})
              .catch(e=>console.warn("profile upsert:", e&&e.message));
          }
          hideAppModal();$("#loginForm").reset();
          finishLogin({email,name:resolved.name||email,role:resolved.role,permissions:resolved.permissions,photo:cred.user.photoURL||""});
        }catch(err){
          hideAppModal();console.warn("login failed:",err&&err.code,err&&err.message);
          const msg=authErrorMessage(err,{fallback:"লগইন করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।"});
          showMessage($("#loginMessage"),msg,"error");uiAlert(msg,{type:"error",title:"লগইন ব্যর্থ"});
        }
      });
  
      /* Draggable Support Button */
      (function(){
        const btn=document.querySelector(".support-btn"); if(!btn) return;
        let dragging=false, moved=false, sx=0, sy=0, ox=0, oy=0, cx=0, cy=0;
        btn.addEventListener("pointerdown",e=>{
          dragging=true; moved=false;
          sx=e.clientX; sy=e.clientY;
          const r=btn.getBoundingClientRect();
          ox=r.left; oy=r.top; cx=ox; cy=oy;
          btn.setPointerCapture(e.pointerId);
          btn.classList.add("dragging");
        });
        btn.addEventListener("pointermove",e=>{
          if(!dragging) return;
          const dx=e.clientX-sx, dy=e.clientY-sy;
          if(Math.abs(dx)>4||Math.abs(dy)>4) moved=true;
          if(moved){
            let nx=ox+dx, ny=oy+dy;
            const size=btn.offsetWidth, vw=window.innerWidth, vh=window.innerHeight;
            nx=Math.max(8,Math.min(vw-size-8,nx));
            ny=Math.max(8,Math.min(vh-size-8,ny));
            btn.style.left=nx+"px"; btn.style.top=ny+"px";
            btn.style.right="auto"; btn.style.bottom="auto";
            cx=nx; cy=ny;
          }
        });
        const up=()=>{
          if(dragging){ dragging=false; btn.classList.remove("dragging"); }
        };
        btn.addEventListener("pointerup",up);
        btn.addEventListener("pointercancel",up);
        btn.addEventListener("click",e=>{ if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } });
        window.addEventListener("resize",()=>{
          const size=btn.offsetWidth, vw=window.innerWidth, vh=window.innerHeight;
          let x=btn.offsetLeft, y=btn.offsetTop;
          x=Math.max(8,Math.min(vw-size-8,x)); y=Math.max(8,Math.min(vh-size-8,y));
          btn.style.left=x+"px"; btn.style.top=y+"px";
        });
      })();
    
  
      /* ===== Boot ===== */
      /* Google redirect-এ ফেরার পর ফলাফল resume — pending intent ("login"/"signup")
         অনুযায়ী সঠিক flow শেষ করা হয় */
      async function resumeGoogleRedirect(){
        if(!fbReady || !auth) return;
        let red = null;
        try{
          red = await consumeGoogleRedirect(auth);
        }catch(err){
          console.warn("Google redirect resume:", err);
          setGoogleIntent(null);
          uiAlert(authErrorMessage(err), {type:"error", title:"Google লগইন ব্যর্থ"});
          return;
        }
        if(!red) return;
        setGoogleIntent(null);
        try{
          if(red.intent === "signup") await continueGoogleSignup(red.profile);
          else await continueGoogleLogin(red.profile);
        }catch(err){
          hideAppModal();
          console.warn("Google redirect flow:", err);
          uiAlert(authErrorMessage(err), {type:"error", title:"লগইন ব্যর্থ"});
        }
      }
      /* Firebase auth state-এর প্রতিবিম্ব — অন্য ট্যাবে বা সেশন শেষে লগআউট হলে
         স্থানীয় লগইন-ইঙ্গিত পরিষ্কার করে নেভিগেশন অবস্থা ঠিক রাখি */
      function watchAuthMirror(){
        if(!fbReady || !auth) return;
        try{
          onAuthUserChanged(auth, (user)=>{
            if(!user && isLoggedIn()) clearMemberSession();
            else if(user && user.displayName && isLoggedIn() && !localStorage.getItem("cbdcMemberName")){
              localStorage.setItem("cbdcMemberName", user.displayName);
            }
          });
        }catch(e){ console.warn("auth mirror:", e && e.message); }
      }
      setLogo();
      if(window.CBDCShared)CBDCShared.subscribe(()=>{ renderPublic(); renderGallery(); });
      initFirebase().then(()=>{ renderPublic(); renderGallery(); renderLoginGate(); renderAuthState(); resumeGoogleRedirect(); watchAuthMirror(); });
      renderAuthState();
  
      /* Clean URL deep-link — "/dashboard", "/signup", "/profile/<id>" … (কোনো "#" নয়)
         পুরোনো hash লিংক (#dashboard)ও কাজ করে এবং স্বয়ংক্রিয়ভাবে অ্যাড্রেস বারে
         clean path বসে যায়। */
      function applyRoute(){
        let rel = "";
        try{
          const p = location.pathname || "/";
          const b = appBase();
          rel = p.toLowerCase().startsWith(b.toLowerCase()) ? p.slice(b.length) : p.replace(/^\/+/, "");
        }catch(e){}
        rel = rel.replace(/\/+$/, "");
        if(!rel && location.hash && location.hash.length>1){
          /* পুরোনো hash লিংক compat — clean পাথে স্থানান্তর */
          const raw = location.hash;
          const h = raw.toLowerCase();
          if(h.startsWith("#profile/")){ rel = "profile/" + raw.slice("#profile/".length); }
          else if(h==="#dashboard"||h==="#login") rel = "login";
          else if(h==="#signup"||h==="#create-account") rel = "signup";
          else if(h==="#register") rel = "register";
          else if(h==="#emergency") rel = "emergency";
          else if(h==="#eligibility") rel = "eligibility";
          else if(h==="#donor-search") rel = "donor-search";
          else if(h==="#gallery") rel = "gallery";
          else if(h==="#about") rel = "about";
          else if(h==="#home"||h==="#home-footer"||h==="#/home") rel = "";
          else return; /* অচেনা hash — পুরোনো behavior-এর মতোই উপেক্ষা */
          try{ history.replaceState(null,"",appBase()+rel+location.search); }catch(e){}
        }
        const seg = rel.split("/").filter(Boolean);
        const v = (seg[0]||"").toLowerCase();
        if(v==="profile" && seg.length>1){
          showView("profile");
          try{ renderProfile(decodeURIComponent(seg.slice(1).join("/"))); }catch(e){ renderProfile(seg.slice(1).join("/")); }
          return;
        }
        if(v==="dashboard"||v==="login") showView("login");
        else if(v==="signup"||v==="create-account") showView("signup");
        else if(v==="register") showView("register");
        else if(v==="emergency") showView("emergency");
        else if(v==="eligibility") showView("eligibility");
        else if(v==="donor-search") showView("home","#donor-search");
        else if(v==="gallery") showView("home","#gallery");
        else if(v==="about") showView("home","#about");
        else showView("home");
      }
      window.addEventListener("popstate", applyRoute);
      window.addEventListener("hashchange", applyRoute); /* পুরোনো hash লিংক compat */
      applyRoute();
  
  
}

export default function Home() {
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
