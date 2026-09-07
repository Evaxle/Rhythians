function redactMatch(match: any) {
  if (!match) return match;
  if (["waiting", "intermission", "map_countdown"].includes(String(match.status))) return { ...match, mapId: null, map: null };
  return match;
}

function exactCaps(state: any) {
  const target = Number(state?.runtime?.targetPlayersPerSplit ?? 0);
  if (!target || !state?.counts || !state?.caps) return state?.caps;
  const make = (split: "lower" | "higher") => {
    const count = Number(state.counts[split] ?? 0);
    return {
      ...state.caps[split],
      count,
      minimum: target,
      maximum: target,
      secured: count >= target ? target : 0,
      next: target,
      full: count >= target,
      canStart: count >= target,
      atRisk: count > 0 && count < target,
      cappedCount: Math.min(count, target),
      target,
    };
  };
  return { lower: make("lower"), higher: make("higher") };
}

export function publicTournamentState<T extends Record<string, any> | null>(state: T): T {
  if (!state) return state;
  const matches = Array.isArray(state.matches) ? state.matches.map(redactMatch) : state.matches;
  const currentMatch = redactMatch(state.currentMatch);
  const runtime = state.runtime?.finalMatches ? { ...state.runtime, finalMatches: state.runtime.finalMatches.map(redactMatch) } : state.runtime;
  const caps = exactCaps(state);
  let viewerEligibility = state.viewerEligibility;
  const viewerSplit = state.viewerSplit;
  if (viewerEligibility && (viewerSplit === "lower" || viewerSplit === "higher") && caps?.[viewerSplit]) {
    viewerEligibility = { ...viewerEligibility, canSignUp: Boolean(viewerEligibility.canSignUp) && !caps[viewerSplit].full, splitFull: caps[viewerSplit].full, targetPlayersPerSplit: caps[viewerSplit].maximum };
  }
  return { ...state, matches, currentMatch, runtime, caps, viewerEligibility } as T;
}

export function publicTournamentHome<T extends Record<string, any>>(home: T): T {
  return { ...home, active: publicTournamentState(home.active ?? null), scheduled: publicTournamentState(home.scheduled ?? null), recent: publicTournamentState(home.recent ?? null) } as T;
}
