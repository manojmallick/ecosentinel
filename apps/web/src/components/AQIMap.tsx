import dynamic from "next/dynamic";

import type { AqiReading } from "../lib/api";

const AQIMapClient = dynamic(() => import("./AQIMapClient"), {
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-white/10 bg-slate-900/80 text-sm uppercase tracking-[0.25em] text-slate-400">
      Loading map
    </div>
  ),
  ssr: false
});

type AQIMapProps = {
  readings: AqiReading[];
};

export default function AQIMap({ readings }: AQIMapProps) {
  return <AQIMapClient readings={readings} />;
}
