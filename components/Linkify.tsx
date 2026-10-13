// แปลงข้อความธรรมดาให้ลิงก์ http(s) กดได้ — ลิงก์ในเว็บเราเปิดในแท็บเดิม ลิงก์ภายนอกเปิดแท็บใหม่
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
const SITE_HOST = "thecardlistbkk.com";

export default function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        let internal = false;
        let href = part;
        try {
          const u = new URL(part);
          internal = u.hostname === SITE_HOST || u.hostname === "www." + SITE_HOST;
          if (internal) href = u.pathname + u.search + u.hash;
        } catch {
          return part;
        }
        return (
          <a key={i} href={href} className="text-blue-700 underline underline-offset-2 break-all"
            {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
            {part}
          </a>
        );
      })}
    </>
  );
}
