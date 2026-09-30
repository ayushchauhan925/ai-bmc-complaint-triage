import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Footer } from '../components/layout/Footer';
import { getPublicStatistics } from '../services/public.service';
import {
  MapIcon, ChartIcon, AlertIcon, CameraIcon, BoltIcon, ShieldIcon, ClockIcon, LayersIcon, CheckCircleIcon, ScrollIcon, ActivityIcon, UsersIcon,
} from '../components/common/Icons';

const STEPS = [
  { icon: <CameraIcon size={20} />, title: 'Report', text: 'Describe the problem in English, Hindi, Hinglish or Marathi. Add photos and pin the location.' },
  { icon: <BoltIcon size={20} />, title: 'Understand', text: 'AI reads your report and photo, and checks how well the evidence supports it.' },
  { icon: <ShieldIcon size={20} />, title: 'Decide', text: 'Transparent rules set priority, route it to the right department and start the clock.' },
  { icon: <CheckCircleIcon size={20} />, title: 'Resolve', text: 'Follow every step on a timeline until the issue is fixed - then confirm or reopen it.' },
];

const FEATURES = [
  { icon: <BoltIcon size={20} />, title: 'AI-assisted triage', desc: 'Category, urgency and risk signals extracted from text and photos, validated before they are used.' },
  { icon: <ShieldIcon size={20} />, title: 'Explainable priority', desc: 'Every priority shows the evidence and the factors behind it. No black box.' },
  { icon: <LayersIcon size={20} />, title: 'Duplicate grouping', desc: 'Repeat reports of the same problem are linked into one incident - nothing is ever deleted.' },
  { icon: <MapIcon size={20} />, title: 'Live geographic view', desc: 'Heatmaps, hotspots and incident zones show where problems concentrate.' },
  { icon: <ClockIcon size={20} />, title: 'Deadlines & escalation', desc: 'Configurable service levels with automatic warnings and escalation when things slip.' },
  { icon: <UsersIcon size={20} />, title: 'Humans in the loop', desc: 'Staff can approve or correct any AI decision - and their corrections measure AI quality.' },
  { icon: <ActivityIcon size={20} />, title: 'Early warning', desc: 'Statistical anomaly detection and short-term forecasts flag surges before they become crises.' },
  { icon: <ScrollIcon size={20} />, title: 'Full audit trail', desc: 'Who changed what, and when - for every decision, assignment and status change.' },
];

const TEAM_POINTS = [
  'Command center with SLA, hotspots, anomalies and department workload',
  'Review queue for complaints the AI was unsure about',
  'Incident view that groups related reports with severity and trend',
  'AI accuracy, usage cost and system health monitoring',
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

/** Illustrative product preview. Clearly labelled as an example - not real data. */
function PreviewCard() {
  const steps = ['Received', 'AI analysed', 'Routed to Roads Dept.', 'Officer assigned'];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div aria-hidden="true" className="absolute -inset-4 rounded-3xl bg-brand-500/20 blur-2xl" />
      <div className="relative rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-slate-400">CMP-EXAMPLE</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">Large pothole near school gate</p>
          </div>
          <span className="badge border border-orange-200 bg-orange-100 text-orange-700">HIGH</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Category</p><p className="mt-0.5 text-xs font-semibold text-slate-800">Pothole</p></div>
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Evidence</p><p className="mt-0.5 text-xs font-semibold text-green-700">Strong</p></div>
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Similar</p><p className="mt-0.5 text-xs font-semibold text-slate-800">3 nearby</p></div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100 p-3">
          <p className="text-xs font-semibold text-slate-700">Why this priority</p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
            <li className="flex justify-between"><span>Road damage (base)</span><span className="font-mono text-slate-500">+30</span></li>
            <li className="flex justify-between"><span>Traffic hazard</span><span className="font-mono text-slate-500">+20</span></li>
            <li className="flex justify-between"><span>Near a school</span><span className="font-mono text-slate-500">+15</span></li>
          </ul>
        </div>

        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 text-xs text-slate-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Illustrative example of a triaged complaint - not real data.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: getPublicStatistics, staleTime: 5 * 60_000, retry: 0 });
  const s = stats.data;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-brand-800">CC</span>
            <span className="font-semibold">Civic Connect</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium text-brand-100 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#teams" className="hover:text-white">For city teams</a>
            <Link to="/public" className="hover:text-white">Public dashboard</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-white hover:bg-white/10">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 25% 20%, black 15%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 25% 20%, black 15%, transparent 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" /> Civic AI Intelligence &amp; Response Platform
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Report a civic problem in seconds. <span className="text-brand-300">Watch it get fixed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-100">
              Potholes, garbage, water leakage, streetlights - describe it in your own language, add a photo, and the system
              classifies, prioritises and routes it to the right department, with every step visible to you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-800 shadow-sm hover:bg-brand-50">Report a problem</Link>
              <Link to="/login" className="rounded-lg px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/40 hover:bg-white/10">I have an account</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-200">
              {['English · Hindi · Hinglish · Marathi', 'Photo & map location', 'Track every step'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircleIcon size={15} className="text-green-400" /> {t}</li>
              ))}
            </ul>
          </div>
          <PreviewCard />
        </div>
      </section>

      {/* Live stats - real numbers only, hidden if unavailable */}
      {s && s.total_complaints > 0 && (
        <section aria-label="Live statistics" className="border-b border-slate-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
              <Stat value={s.total_complaints.toLocaleString()} label="Complaints reported" />
              <Stat value={s.resolved.toLocaleString()} label="Resolved" />
              <Stat value={s.avg_resolution_hours === null ? '—' : `${Math.round(s.avg_resolution_hours)} h`} label="Avg. resolution" />
              <Stat value={s.duplicate_rate_pct === undefined ? '—' : `${Math.round(s.duplicate_rate_pct)}%`} label="Grouped as incidents" />
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">{s.data_scope}</p>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">From report to resolution, in the open</h2>
          <p className="mt-3 text-slate-500">AI helps understand the problem. Clear rules - not the AI - decide what happens next.</p>
        </div>
        <ol className="relative mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((st, i) => (
            <li key={st.title} className="relative rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{st.icon}</span>
                <span className="text-3xl font-bold text-slate-100" aria-hidden="true">{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{st.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Platform</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Intelligence you can inspect</h2>
            <p className="mt-3 text-slate-500">Built for citizens who want answers and city teams who need to act.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{f.icon}</span>
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For city teams */}
      <section id="teams" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">For city teams</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">A command center for municipal operations</h2>
            <p className="mt-3 text-slate-500">
              Officers work a prioritised queue with the evidence in front of them. Administrators see the whole city: where problems cluster,
              what is unusual, and which departments are stretched.
            </p>
            <ul className="mt-6 space-y-3">
              {TEAM_POINTS.map((p) => (
                <li key={p} className="flex gap-3 text-sm text-slate-700"><CheckCircleIcon size={18} className="mt-0.5 shrink-0 text-brand-600" />{p}</li>
              ))}
            </ul>
            <Link to="/login" className="btn-primary mt-8 px-6 py-3 text-base">Staff sign in</Link>
          </div>
          <div className="rounded-2xl bg-brand-900 p-8 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-200"><AlertIcon size={16} /> Our principle</p>
            <p className="mt-3 text-2xl font-semibold leading-snug">AI proposes. Clear rules and people decide.</p>
            <ul className="mt-6 space-y-4 text-sm text-brand-100">
              <li><strong className="text-white">Validated:</strong> AI output is checked and sanitised before it is used.</li>
              <li><strong className="text-white">Explainable:</strong> priority comes with the factors that produced it.</li>
              <li><strong className="text-white">Reviewable:</strong> staff can correct any decision, and it is recorded.</li>
              <li><strong className="text-white">Honest:</strong> when there is not enough data, we say so instead of guessing.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">See something that needs fixing?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">Create a free account, report it in under a minute, and follow it until it is resolved.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-800 hover:bg-brand-50">Get started</Link>
            <Link to="/public" className="rounded-lg px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/40 hover:bg-white/10">View public dashboard</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
