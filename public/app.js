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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function coachStateFromAssessment(assessment) {
  if (!assessment) return null;
  const tone = assessment.traffic_light || "neutral";
  const labels = { green: "Gruen", yellow: "Gelb", red: "Rot", neutral: "Neutral" };
  return {
    tone,
    label: labels[tone] || "Neutral",
    headline: assessment.coach_statement || "Coach Assessment gespeichert",
    reason: assessment.reason || "Die Bewertung basiert auf Check-in, Verlauf und Zielbezug."
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

function planFromStoredTrainingPlan(plan) {
  if (!plan) return null;
  return {
    badge: plan.should_train ? "Plan" : "Recovery",
    type: plan.session_title,
    when: plan.should_train ? "Heute gemaess Coach-Plan" : "Heute bewusst nicht trainieren",
    duration: plan.estimated_duration_minutes ? `${plan.estimated_duration_minutes} Min` : "-",
    why: plan.coach_reasoning || plan.coach_summary || "Der Plan basiert auf Check-in, Verlauf und Trainingsziel.",
    focus: plan.mental_focus || "Konzentriert arbeiten, sauber rueckmelden, nicht gegen die Tagesform erzwingen.",
    goal: plan.goal || "Trainingssteuerung"
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
      <p>${escapeHtml(notes(row.notes || row.pain_notes))}</p>
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
        <span>${escapeHtml(row.activity)}</span>
        <span class="item-meta">${formatDay(row.entry_date)}</span>
      </div>
      <p>${row.duration_minutes} Min · Intensitaet ${score(row.intensity)} · RPE ${score(row.rpe)}</p>
      <p>${escapeHtml(notes(row.notes || row.sets_summary))}</p>
    `;
    container.appendChild(el);
  });
}

function renderLastWorkout(rows) {
  const latest = rows[0];
  if (!latest) return;

  text("lastWorkoutDate", formatDay(latest.entry_date));
  byId("lastWorkout").innerHTML = `
    <strong>${escapeHtml(latest.activity)}</strong>
    <p>${latest.duration_minutes} Min · Intensitaet ${score(latest.intensity)} · RPE ${score(latest.rpe)}</p>
    <p>${escapeHtml(notes(latest.notes || latest.sets_summary))}</p>
  `;
}

function renderTrainingPlanExercises(plan) {
  const container = byId("trainingPlanExercises");
  container.innerHTML = "";

  if (!plan?.exercises?.length) {
    container.innerHTML = '<div class="empty-state"><strong>Noch kein konkreter Uebungsplan gespeichert.</strong><p>Nach dem naechsten Check-in kann dein GPT einen Tagesplan mit Uebungen, Saetzen, Wiederholungen und Gewichten speichern.</p></div>';
    return;
  }

  plan.exercises.forEach((exercise) => {
    const prescription = [exercise.sets, exercise.reps, exercise.load_text].filter(Boolean).join(" x ");
    const el = document.createElement("article");
    el.className = "exercise-card";
    el.innerHTML = `
      <header>
        <h3>${exercise.sort_order}. ${escapeHtml(exercise.exercise_name)}</h3>
        <span class="exercise-prescription">${escapeHtml(prescription || "geplant")}</span>
      </header>
      <p><b>Technik:</b> ${escapeHtml(notes(exercise.technical_notes))}</p>
      <p><b>Heute achten auf:</b> ${escapeHtml(notes(exercise.today_focus))}</p>
      <p><b>RPE/Pause:</b> ${escapeHtml(exercise.rpe_target || "-")} · ${exercise.rest_seconds ? `${exercise.rest_seconds} Sek` : "-"}</p>
      ${exercise.alternative ? `<p><b>Alternative:</b> ${escapeHtml(exercise.alternative)}</p>` : ""}
    `;
    container.appendChild(el);
  });
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
  const storedPlan = data.today_training_plan;
  const assessment = data.latest_daily_assessment;
  const scores = deriveScores(today, latestCheckIn);
  const readiness = assessment?.readiness_total ?? scores.readiness;
  const state = coachStateFromAssessment(assessment) || coachState(readiness, displayCheckIn);
  const plan = planFromStoredTrainingPlan(storedPlan) || trainingPlan(readiness, today);

  text("todayDate", displayCheckIn ? formatDay(displayCheckIn.entry_date) : "Heute");
  text("coachHeadline", state.headline);
  text("coachReason", state.reason);
  text("readinessScore", readiness == null ? "-" : Math.round(readiness));
  text("healthReadiness", percent(assessment?.readiness_health ?? scores.health));
  text("mentalReadiness", percent(assessment?.readiness_mental ?? scores.mental));
  text("physicalReadiness", percent(assessment?.readiness_physical ?? scores.physical));
  text("todayLoad", today?.training_load == null ? "0 AU" : `${today.training_load} AU`);

  setToneClasses(byId("coachLight"), "traffic-pill", state.tone);
  text("coachLight", `Ampel ${state.label}`);
  byId("scoreRing").style.borderColor = state.tone === "green" ? "var(--accent)" : state.tone === "red" ? "var(--red)" : state.tone === "yellow" ? "var(--yellow)" : "var(--blue)";

  text("stepBadge", plan.badge);
  text("trainingType", plan.type);
  text("trainingWhen", plan.when);
  text("trainingDuration", plan.duration);
  text("trainingWhy", plan.why);
  text("mentalFocus", assessment?.mental_alignment || plan.focus);
  text("nutritionRecommendation", assessment?.nutrition_recommendation || "Noch keine Ernaehrungsempfehlung gespeichert.");
  text("goalLink", plan.goal);
  renderTrainingPlanExercises(storedPlan);

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
