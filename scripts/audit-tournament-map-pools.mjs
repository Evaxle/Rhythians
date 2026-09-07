const ranges = {
  lower: { regular: [1.3, 2.3], finals: [2.3, 2.7] },
  higher: { regular: [3.0, 3.5], finals: [3.6, 3.7] },
};

const expected = { regular: 100, finals: 6 };

export function auditTournamentPoolRows(rows) {
  const errors = [];
  for (const split of ["lower", "higher"]) {
    const splitRows = rows.filter((row) => row.split === split);
    for (const stage of ["regular", "finals"]) {
      const stageRows = splitRows.filter((row) => row.stage === stage);
      const [min, max] = ranges[split][stage];
      if (stageRows.length !== expected[stage]) errors.push(`${split} ${stage}: expected ${expected[stage]}, found ${stageRows.length}`);
      const invalid = stageRows.filter((row) => Number(row.rating) < min || Number(row.rating) > max);
      if (invalid.length) errors.push(`${split} ${stage}: ${invalid.length} map(s) outside ${min}-${max}`);
    }
    const ids = splitRows.map((row) => row.mapId);
    if (new Set(ids).size !== ids.length) errors.push(`${split}: duplicate map IDs detected`);
  }
  return { ok: errors.length === 0, errors };
}
