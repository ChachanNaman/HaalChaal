"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addParent, type AddParentState } from "./actions";

const initialState: AddParentState = { error: null };

export default function NewParentPage() {
  const [state, formAction, pending] = useActionState(addParent, initialState);

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; All parents
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Register a parent</h1>
        <p className="mt-1 text-sm text-gray-400">
          We'll call this number for daily check-ins and send updates to the WhatsApp number below.
        </p>

        <form action={formAction} className="material-card mt-6 flex flex-col gap-3 p-6">
          <label className="text-sm text-gray-400">
            Parent's name
            <input
              name="name"
              required
              placeholder="e.g. Amma"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent"
            />
          </label>

          <label className="text-sm text-gray-400">
            Parent's phone number
            <input
              name="phone_number"
              required
              placeholder="+91XXXXXXXXXX"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent"
            />
          </label>

          <label className="text-sm text-gray-400">
            Preferred language
            <select
              name="preferred_language"
              defaultValue="hi-en"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent"
            >
              <option value="hi-en">Hindi / Hinglish</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="text-sm text-gray-400">
            Your WhatsApp number (for the daily digest)
            <input
              name="whatsapp_number"
              required
              placeholder="+91XXXXXXXXXX"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent"
            />
          </label>

          {state.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="press-feedback mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? "Saving…" : "Register parent"}
          </button>
        </form>
      </div>
    </div>
  );
}
