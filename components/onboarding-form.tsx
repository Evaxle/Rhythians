"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingPrompt } from "@/lib/onboarding";

interface OnboardingFormProps {
  prompts: OnboardingPrompt[];
  initialSelected?: string[];
  submitLabel?: string;
}

export function OnboardingForm({
  prompts,
  initialSelected = [],
  submitLabel = "Save my answers",
}: OnboardingFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const prompt of prompts) {
      initial[prompt.id] = initialSelected.filter(
        (optionId) =>
          prompt.options.some((option) => option.id === optionId)
      );
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleOption(prompt: OnboardingPrompt, optionId: string) {
    setSelected((current) => {
      const existing = current[prompt.id] ?? [];
      if (prompt.singleSelect) {
        return { ...current, [prompt.id]: existing.includes(optionId) ? [] : [optionId] };
      }
      return {
        ...current,
        [prompt.id]: existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId],
      };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const optionIds = Object.values(selected).flat();
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save your answers.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {prompts.map((prompt) => {
        const selectedForPrompt = selected[prompt.id] ?? [];
        return (
          <div key={prompt.id}>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">{prompt.title}</h3>
              <p className="mt-1 text-xs text-muted">
                {prompt.singleSelect ? "Select one option." : "Select all that apply."}
                {prompt.required ? " Required." : " Optional."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.options.map((option) => {
                const isSelected = selectedForPrompt.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(prompt, option.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isSelected
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border bg-background/50 text-muted hover:border-accent/50 hover:text-white"
                    }`}
                  >
                    {option.emojiName ? `${option.emojiName} ` : ""}
                    {option.title}
                  </button>
                );
              })}
            </div>
            {prompt.required && selectedForPrompt.length === 0 && (
              <p className="mt-2 text-xs text-red-300">Please choose an answer.</p>
            )}
          </div>
        );
      })}

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
