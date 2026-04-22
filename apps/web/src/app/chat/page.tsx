import Link from "next/link";

import ChatWidget from "../../components/ChatWidget";

export default function ChatPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.22),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/10 bg-slate-950/70 p-8 shadow-[0_35px_120px_-60px_rgba(14,165,233,0.95)] backdrop-blur">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">EcoSentinel F-11</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-6xl">
                Ask the air-quality assistant the same question a worried parent would ask.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                This frontend turns raw AQI data into a conversational experience for residents. It is designed
                to feel useful even before the live `/api/chat` route is wired, so demo flow is never blocked by
                backend timing.
              </p>
            </div>

            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
              href="/"
            >
              Back to dashboard
            </Link>
          </div>
        </section>

        <ChatWidget />
      </div>
    </main>
  );
}
