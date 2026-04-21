const cards = [
  {
    title: "Live AQI",
    description: "Current Amsterdam air-quality data with room for the Leaflet heatmap in F-06."
  },
  {
    title: "Forecast",
    description: "Reserved panel for the 24-hour prediction chart and audit signature details in F-07 to F-09."
  },
  {
    title: "Citizen Advice",
    description: "Starter shell for the chatbot experience that lands in F-10 and F-11."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="rounded-3xl border border-emerald-200/10 bg-slate-900/70 p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-emerald-300">
            EcoHack 2026 starter scaffold
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
            Hyper-local air quality intelligence, scaffolded feature by feature.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            F-01 lays down the monorepo, CI, local database container, and a minimal dashboard shell so
            the next features can land without reworking the foundation.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20"
            >
              <h2 className="text-2xl font-medium text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

