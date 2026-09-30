import React from 'react';
import { Footer } from '../components/layout/Footer';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { MapIcon, ChartIcon, AlertIcon, CameraIcon } from '../components/common/Icons';

const FEATURES = [
  { icon: <CameraIcon size={22} />, title: 'Report with a photo', desc: 'Describe the issue in your own language and attach a photo - AI does the rest.' },
  { icon: <AlertIcon size={22} />, title: 'AI-powered triage', desc: 'Complaints are automatically categorized, prioritized and routed to the right department.' },
  { icon: <MapIcon size={22} />, title: 'Live map & tracking', desc: 'See where issues are reported and track your complaint from submission to resolution.' },
  { icon: <ChartIcon size={22} />, title: 'Transparent priority', desc: 'Every priority score comes with clear reasons - no black box decisions.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={36} />
            <span className="font-semibold text-slate-900">Civic Connect</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/public" className="hidden text-sm font-medium text-slate-500 hover:text-slate-700 sm:inline">
              Public Dashboard
            </Link>
            <Link to="/login" className="btn-secondary">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <span className="badge border-brand-100 bg-brand-50 text-brand-700">AI-Powered Civic Complaint Triage</span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Report a civic problem in seconds
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
          Potholes, garbage, water leakage, streetlights - describe it in English, Hindi, Hinglish or Marathi,
          add a photo, and our AI instantly classifies, prioritizes and routes it to the right department.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn-primary px-6 py-3 text-base">
            Report a Civic Problem
          </Link>
          <Link to="/login" className="btn-secondary px-6 py-3 text-base">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
