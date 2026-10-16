// แอนิเมชันเปิดแอป: พื้นขาว ชิ้นส่วนโลโก้ C (แดง/เหลือง/น้ำเงิน) บินเข้ามาประกอบกัน
// แล้วโลโก้พุ่งเข้าหาหน้าจอจนทะลุ เผยหน้าเว็บ
// - เล่นครั้งแรกของ session ทั้งบนเว็บและแอป (ไม่เล่นในหน้า /admin)
// - ชิ้นส่วนแต่ละสีเลื่อนเข้าตรง ๆ จากฝั่งของตัวเอง ไม่หมุน ไม่เด้งเลย → ไม่ชนกัน
// - ดูซ้ำ: เติม ?splash=1 ท้าย URL
// - แตะหน้าจอเพื่อข้ามได้, ผู้ใช้ที่ตั้ง "ลดการเคลื่อนไหว" จะเห็นแค่โลโก้ค่อย ๆ จางหาย
// สคริปต์นี้รันทันทีตอน parse <body> (ก่อน React) เพื่อไม่ให้หน้าเว็บโผล่ก่อนแอนิเมชัน

const CSS = `
#cl-splash{position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;-webkit-tap-highlight-color:transparent}
#cl-splash .cls-logo{position:relative;width:min(30vw,132px);aspect-ratio:519/685;transform-origin:72% 50%}
#cl-splash .cls-logo img{position:absolute;inset:0;width:100%;height:100%;opacity:0;user-select:none;-webkit-user-drag:none}
#cl-splash.go .cls-r{animation:cls-r .55s cubic-bezier(.16,1,.3,1) .05s both}
#cl-splash.go .cls-y{animation:cls-y .55s cubic-bezier(.16,1,.3,1) .2s both}
#cl-splash.go .cls-b{animation:cls-b .55s cubic-bezier(.16,1,.3,1) .35s both}
#cl-splash.go .cls-f{animation:cls-show .12s linear 1s both}
#cl-splash.go .cls-logo{animation:cls-rush .62s cubic-bezier(.6,0,.9,.35) 1.15s both}
#cl-splash.go{animation:cls-out .32s ease-in 1.52s both}
@keyframes cls-r{from{opacity:0;transform:translate(45%,-110%)}to{opacity:1;transform:none}}
@keyframes cls-y{from{opacity:0;transform:translate(-130%,0)}to{opacity:1;transform:none}}
@keyframes cls-b{from{opacity:0;transform:translate(45%,110%)}to{opacity:1;transform:none}}
@keyframes cls-show{from{opacity:0}to{opacity:1}}
@keyframes cls-rush{0%{transform:scale(1)}22%{transform:scale(.88)}100%{transform:scale(18);opacity:.0}}
@keyframes cls-out{from{opacity:1}to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  #cl-splash.go .cls-r,#cl-splash.go .cls-y,#cl-splash.go .cls-b,#cl-splash.go .cls-logo{animation:none}
  #cl-splash.go .cls-f{animation:cls-show .2s linear both}
  #cl-splash.go{animation:cls-out .4s ease-in .6s both}
}`;

function splash() {
  try {
    const params = new URLSearchParams(location.search);
    const forced = params.get("splash") === "1";
    if (!forced && (sessionStorage.getItem("cl-splash") || location.pathname.startsWith("/admin") || location.pathname.startsWith("/passport"))) return;
    sessionStorage.setItem("cl-splash", "1");

    const root = document.createElement("div");
    root.id = "cl-splash";
    root.setAttribute("aria-hidden", "true");
    const style = document.createElement("style");
    style.textContent = "__CSS__";
    root.appendChild(style);
    const logo = document.createElement("div");
    logo.className = "cls-logo";
    const parts = ["r:red", "y:yellow", "b:blue", "f:full"];
    let loaded = 0;
    let done = false;
    const remove = () => {
      if (done) return;
      done = true;
      root.remove();
    };
    const start = () => {
      root.classList.add("go");
      setTimeout(remove, 2000);
    };
    parts.forEach((p) => {
      const [k, name] = p.split(":");
      const img = document.createElement("img");
      img.className = "cls-" + k;
      img.alt = "";
      img.decoding = "async";
      img.onload = img.onerror = () => {
        if (++loaded === parts.length && !root.classList.contains("go")) start();
      };
      img.src = "/images/splash/c-" + name + ".png";
      logo.appendChild(img);
    });
    root.appendChild(logo);
    root.addEventListener("click", remove);
    // รูปโหลดช้าเกินไป → ไม่ค้างหน้าขาว ข้ามไปเลย
    setTimeout(() => {
      if (!root.classList.contains("go")) remove();
    }, 2500);
    document.body.appendChild(root);
  } catch {
    /* ไม่ให้ splash ทำหน้าเว็บพัง */
  }
}

export const SPLASH_SCRIPT = `(${splash.toString()})()`.replace("__CSS__", CSS.replace(/\s*\n\s*/g, "").replace(/"/g, '\\"'));
