function redactMatch(match: any) {
  if (!match) return match;
  if (["waiting", "intermission", "map_countdown"].includes(String(match.status))) {
    return { ...match, mapId: null, map: null };
  }
  return match;
}

export function publicTournamentState<T extends Record<string, any> | null>(state: T): T {
  if (!state) return state;
  const matches = Array.isArray(state.matches) ? state.matches.map(redactMatch) : state.matches;
  const currentMatch = redactMatch(state.currentMatch);
  const runtime = state.runtime?.finalMatches ? { ...state.runtime, finalMatches: state.runtime.finalMatches.map(redactMatch) } : state.runtime;
  return { ...state, matches, currentMatch, runtime } as T;
}

export function publicTournamentHome<T extends Record<string, any>>(home: T): T {
  return {
    ...home,
    active: publicTournamentState(home.active ?? null),
    scheduled: publicTournamentState(home.scheduled ?? null),
    recent: publicTournamentState(home.recent ?? null),
  } as T;
}
