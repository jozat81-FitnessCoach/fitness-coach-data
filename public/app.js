const formatDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function byId(id) {
  return document.getElementById(id);
}

function text(id, value) {
  const node = byId(id);
  if (node) node.textContent = value ?? "-";
}

function score(value) {
  return value == null ? "-" : `${Math.round(Number(value))}/10`;
}

function percent(value) {
  return value == null ? "-" : `${Math.round(Number(value))}%`;
}

function formatDay(value) {
  return value ? formatDate.format(new Date(value)) : "-";
}

function notes(value) {
  return value ? value : "Keine Notiz hinterlegt.";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreToPercent(value) {
  return value == null ? null : clamp(Number(value) * 10, 0, 100);
}

function average(values) {
  const usable = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function deriveScores(today, latestCheckIn) {
  const checkIn = today || latestCheckIn || {};
  const health = average([
    checkIn.readiness,
    checkIn.soreness == null ? null : 11 - Number(checkIn.soreness),
    checkIn.stress == null ? null : 11 - Number(checkIn.stress)
  ]);
  const mental = average([
    checkIn.motivation,
    checkIn.energy,
    checkIn.stress == null ? null : 11 - Number(checkIn.stress)
  ]);
  const physical = average([
    checkIn.energy,
    checkIn.sleep_quality,
    checkIn.soreness == null ? null : 11 - Number(checkIn.soreness)
  ]);
  const readiness = average([checkIn.readiness, health, mental, physical]);

  return {
    health: scoreToPercent(health),
    mental: scoreToPercent(mental),
    physical: scoreToPercent(physical),
    readiness: readiness == null ? null : scoreToPercent(readiness)
  };
}

function coachState(readiness, today) {
  const soreness = Number(today?.soreness || 0);
  const stress = Number(today?.stress || 0);

  if (readiness == null) {
    return {
      tone: "neutral",
      label: "Neutral",
      headline: "Noch kein Tagesstatus",
      reason: "Nach dem ersten Check-in bewertet der Coach Readiness, Risiko und den naechsten sinnvollen Schritt."
    };
  }

  if (readiness >= 75 && soreness <= 5 && stress <= 6) {
    return {
      tone: "green",
      label: "Gruen",
      headline: "Belastbar fuer einen klaren Trainingsreiz",
      reason: "Readiness, Energie und Erholung sehen stabil aus. Heute ist ein planmaessiger Reiz sinnvoll, solange Technik und Schmerzsignale sauber bleiben."
    };
  }

  if (readiness >= 55) {
    return {
      tone: "yellow",
      label: "Gelb",
      headline: "Trainieren, aber bewusst dosieren",
      reason: "Die Tagesform ist brauchbar, aber nicht maximal frisch. Gute Gelegenheit fuer kontrollierte Qualitaet statt unnoetiger Spitzenintensitaet."
    };
  }

  return {
    tone: "red",
    label: "Rot",
    headline: "Recovery vor Reiz",
    reason: "Die Signale sprechen fuer Entlastung. Heute zaehlt Regeneration, Beweglichkeit und ein sauberer Neustart fuer die naechste Einheit."
  };
}

function trainingPlan(readiness, today) {
  const workoutMinutes = Number(today?.workout_minutes || 0);
  const soreness = Number(today?.soreness || 0);

  if (workoutMinutes > 0) {
    return {
      badge: "Erledigt",
      type: "Heute bereits trainiert",
      when: "Naechster Schritt: Check-out auswerten",
      duration: `${workoutMinutes} Min erfasst`,
      why: "Der Coach nutzt den Check-out, um die naechste Empfehlung an Belastung und Koerperreaktion anzupassen.",
      focus: "Jetzt zaehlt ehrliches Feedback: Was wurde gemacht, wie fuehlte es sich an, und was sagt der Koerper danach?",
      goal: "Lernkurve"
    };
  }

  if (readiness == null) {
    return {
      badge: "Offen",
      type: "Check-in zuerst",
      when: "Jetzt",
      duration: "3-5 Min",
      why: "Ohne Tagesdaten waere jede Empfehlung geraten.",
      focus: "Erst messen, dann entscheiden. Das ist heute der professionelle erste Schritt.",
      goal: "Klarheit"
    };
  }

  if (readiness >= 75 && soreness <= 5) {
    return {
      badge: "Gruen",
      type: "Qualitaet oder Kraft",
      when: "Wenn du aufgewärmt und wach bist",
      duration: "45-75 Min",
      why: "Die Tagesform erlaubt einen produktiven Trainingsreiz mit sauberer Technik.",
      focus: "Trainiere entschlossen, aber nicht hektisch. Jede Wiederholung soll aussehen wie eine gute Entscheidung.",
      goal: "Leistungsaufbau"
    };
  }

  if (readiness >= 55) {
    return {
      badge: "Gelb",
      type: "Technik, Zone 2 oder reduziertes Krafttraining",
      when: "Heute, ohne Zeitdruck",
      duration: "30-55 Min",
      why: "Genug Bereitschaft fuer Bewegung, aber nicht genug Puffer fuer maximale Intensitaet.",
      focus: "Heute gewinnst du ueber Kontrolle. Kein Ego-Training, sondern praezise Arbeit am naechsten Baustein.",
      goal: "Konsistenz"
    };
  }

  return {
    badge: "Rot",
    type: "Recovery, Mobility, Spaziergang",
    when: "Heute leicht und frueh",
    duration: "20-40 Min",
    why: "Der beste Trainingsreiz ist heute, das System zu beruhigen und morgen wieder belastbarer zu sein.",
    focus: "Disziplin bedeutet heute, nicht mehr zu erzwingen als dein Koerper sinnvoll verarbeiten kann.",
    goal: "Regeneration"
  };
}

function setToneClasses(node, baseClass, tone) {
  node.className = `${baseClass} ${tone}`;
}

function renderWeeklyLoad(rows) {
  const container = byId("weeklyLoad");
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Noch keine Trainingsdaten.</p>';
    return;
  }

  const chronological = [...rows].reverse();
  const maxLoad = Math.max(...chronological.map((row) => Number(row.load || 0)), 1);

  chronological.forEach((row) => {
    const load = Number(row.load || 0);
    const width = Math.max(4, Math.round((load / maxLoad) * 100));
    const el = document.createElement("div");
    el.className = "bar-row";
    el.innerHTML = `
      <span>${formatDay(row.week_start)}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
      <strong>${load} AU</strong>
    `;
    container.appendChild(el);
  });
}

function renderCheckIns(rows) {
  const container = byId("checkIns");
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Noch keine Check-ins.</p>';
    return;
  }

  rows.forEach((row) => {
    const el = document.createElement("article");
    el.className = "item";
    el.innerHTML = `
      <div class="item-title">
        <span>${formatDay(row.entry_date)}</span>
        <span class="item-meta">Energie ${score(row.energy)}</span>
      </div>
      <p>Schlaf ${score(row.sleep_quality)} · Motivation ${score(row.motivation)} · Muskelkater ${score(row.soreness)}</p>
      <p>${notes(row.notes || row.pain_notes)}</p>
    `;
    container.appendChild(el);
  });
}

function renderCheckOuts(rows) {
  const container = byId("checkOuts");
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Noch keine Check-outs.</p>';
    return;
  }

  rows.forEach((row) => {
    const el = document.createElement("article");
    el.className = "item";
    el.innerHTML = `
      <div class="item-title">
        <span>${row.activity}</span>
        <span class="item-meta">${formatDay(row.entry_date)}</span>
      </div>
      <p>${row.duration_minutes} Min · Intensitaet ${score(row.intensity)} · RPE ${score(row.rpe)}</p>
      <p>${notes(row.notes || row.sets_summary)}</p>
    `;
    container.appendChild(el);
  });
}

function renderLastWorkout(rows) {
  const latest = rows[0];
  if (!latest) return;

  text("lastWorkoutDate", formatDay(latest.entry_date));
  byId("lastWorkout").innerHTML = `
    <strong>${latest.activity}</strong>
    <p>${latest.duration_minutes} Min · Intensitaet ${score(latest.intensity)} · RPE ${score(latest.rpe)}</p>
    <p>${notes(latest.notes || latest.sets_summary)}</p>
  `;
}

async function loadDashboard() {
  const response = await fetch("/app-data/summary");
  if (!response.ok) {
    throw new Error("Dashboard konnte nicht geladen werden.");
  }

  const data = await response.json();
  const today = data.today;
  const latestCheckIn = data.recent_check_ins?.[0];
  const displayCheckIn = today || latestCheckIn;
  const scores = deriveScores(today, latestCheckIn);
  const readiness = scores.readiness;
  const state = coachState(readiness, displayCheckIn);
  const plan = trainingPlan(readiness, today);

  text("todayDate", displayCheckIn ? formatDay(displayCheckIn.entry_date) : "Heute");
  text("coachHeadline", state.headline);
  text("coachReason", state.reason);
  text("readinessScore", readiness == null ? "-" : Math.round(readiness));
  text("healthReadiness", percent(scores.health));
  text("mentalReadiness", percent(scores.mental));
  text("physicalReadiness", percent(scores.physical));
  text("todayLoad", today?.training_load == null ? "0 AU" : `${today.training_load} AU`);

  setToneClasses(byId("coachLight"), "traffic-pill", state.tone);
  text("coachLight", `Ampel ${state.label}`);
  byId("scoreRing").style.borderColor = state.tone === "green" ? "var(--accent)" : state.tone === "red" ? "var(--red)" : state.tone === "yellow" ? "var(--yellow)" : "var(--blue)";

  text("stepBadge", plan.badge);
  text("trainingType", plan.type);
  text("trainingWhen", plan.when);
  text("trainingDuration", plan.duration);
  text("trainingWhy", plan.why);
  text("mentalFocus", plan.focus);
  text("goalLink", plan.goal);

  text("sleepQuality", score(displayCheckIn?.sleep_quality));
  text("sleepHours", displayCheckIn?.sleep_hours == null ? "-" : `${displayCheckIn.sleep_hours} h`);
  text("energyScore", score(displayCheckIn?.energy));
  text("sorenessScore", score(displayCheckIn?.soreness));
  text("restingHr", displayCheckIn?.resting_hr == null ? "-" : `${displayCheckIn.resting_hr} bpm`);
  text("hrv", displayCheckIn?.hrv_ms == null ? "-" : `${displayCheckIn.hrv_ms} ms`);
  text("bodyWeight", displayCheckIn?.body_weight_kg == null ? "-" : `${displayCheckIn.body_weight_kg} kg`);
  text("stressScore", score(displayCheckIn?.stress));

  const recoveryComment = readiness == null
    ? "Noch keine Recovery-Auswertung vorhanden."
    : readiness >= 75
      ? "Recovery wirkt stabil. Du kannst produktiv trainieren, solange Warm-up und Technik stimmen."
      : readiness >= 55
        ? "Recovery ist brauchbar, aber nicht voll. Setze heute auf kontrollierte Intensitaet und klare Grenzen."
        : "Recovery ist niedrig. Heute bringt Entlastung mehr als Druck.";
  text("recoveryComment", recoveryComment);

  const riskComment = displayCheckIn?.soreness >= 7 || displayCheckIn?.stress >= 8
    ? "Erhoehtes Risiko: Muskelkater, Stress oder Koerpersignale sprechen fuer eine reduzierte Einheit."
    : displayCheckIn
      ? "Kein harter Warnhinweis aus den aktuellen Check-in-Werten. Trotzdem Schmerz- und Techniksignale beachten."
      : "Der Coach bewertet Warnsignale, sobald ausreichend Check-in-Daten vorhanden sind.";
  text("riskComment", riskComment);
  text("riskBadge", displayCheckIn?.soreness >= 7 || displayCheckIn?.stress >= 8 ? "Erhoeht" : "Normal");

  renderWeeklyLoad(data.weekly_load || []);
  renderCheckIns(data.recent_check_ins || []);
  renderCheckOuts(data.recent_check_outs || []);
  renderLastWorkout(data.recent_check_outs || []);
}

byId("refreshButton").addEventListener("click", () => {
  loadDashboard().catch((error) => alert(error.message));
});

loadDashboard().catch((error) => alert(error.message));
