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

function valueWithUnit(value, unit) {
  if (value == null || value === "") return "-";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function formatDay(value) {
  return value ? formatDate.format(new Date(value)) : "-";
}

function notes(value) {
  return value ? value : "Keine Notiz hinterlegt.";
}

function firstText(...values) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function compactSentence(value, maxLength = 52) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= maxLength) return clean;
  const firstSentence = clean.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= maxLength) return firstSentence;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function deriveHeroHeadline(state, plan, assessment) {
  if (!assessment && state?.headline) return state.headline;
  if (plan?.decision === "Recovery / Pause" || plan?.badge === "Recovery") return "Recovery bewusst nutzen";
  if (plan?.decision === "Angepasst trainieren") return "Qualitaet vor Intensitaet";
  if (plan?.decision === "Trainieren") return "Heute gezielt trainieren";
  if (plan?.decision === "Check-out auswerten") return "Einheit sauber auswerten";
  if (plan?.type && plan.type !== "-") return compactSentence(plan.type, 42);
  return compactSentence(state?.headline, 42) || "Tagesstatus geladen";
}

function missingTrainingText(kind) {
  return kind === "technical"
    ? "Bitte im Coach-Plan ergaenzen: kurze Technik-Anleitung fehlt."
    : "Bitte im Coach-Plan ergaenzen: heutiger Fokus fehlt.";
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
    checkIn.pain_intensity == null ? null : 10 - Number(checkIn.pain_intensity),
    checkIn.sickness == null ? null : 10 - Number(checkIn.sickness),
    checkIn.stress == null ? null : 10 - Number(checkIn.stress)
  ]);
  const mental = average([
    checkIn.motivation,
    checkIn.energy,
    checkIn.stress == null ? null : 10 - Number(checkIn.stress)
  ]);
  const physical = average([
    checkIn.energy,
    checkIn.sleep_quality,
    checkIn.soreness == null ? null : 10 - Number(checkIn.soreness),
    checkIn.mobility
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
  const pain = Number(today?.pain_intensity || 0);

  if (readiness == null) {
    return {
      tone: "neutral",
      label: "Neutral",
      headline: "Noch kein Tagesstatus",
      reason: "Nach dem ersten Check-in bewertet der Coach Readiness, Risiko und den naechsten sinnvollen Schritt."
    };
  }

  if (readiness >= 75 && soreness <= 5 && stress <= 6 && pain <= 3) {
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
      goal: "Lernkurve",
      decision: "Check-out auswerten"
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
      goal: "Klarheit",
      decision: "Check-in noetig"
    };
  }

  if (readiness >= 75 && soreness <= 5) {
    return {
      badge: "Gruen",
      type: "Qualitaet oder Kraft",
      when: "Wenn du aufgewaermt und wach bist",
      duration: "45-75 Min",
      why: "Die Tagesform erlaubt einen produktiven Trainingsreiz mit sauberer Technik.",
      focus: "Trainiere entschlossen, aber nicht hektisch. Jede Wiederholung soll aussehen wie eine gute Entscheidung.",
      goal: "Leistungsaufbau",
      decision: "Trainieren"
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
      goal: "Konsistenz",
      decision: "Angepasst trainieren"
    };
  }

  return {
    badge: "Rot",
    type: "Recovery, Mobility, Spaziergang",
    when: "Heute leicht und frueh",
    duration: "20-40 Min",
    why: "Der beste Trainingsreiz ist heute, das System zu beruhigen und morgen wieder belastbarer zu sein.",
    focus: "Disziplin bedeutet heute, nicht mehr zu erzwingen als dein Koerper sinnvoll verarbeiten kann.",
    goal: "Regeneration",
    decision: "Recovery"
  };
}

function planFromStoredTrainingPlan(plan, assessment) {
  if (!plan) return null;
  return {
    badge: plan.should_train ? "Plan" : "Recovery",
    type: plan.session_title,
    when: plan.should_train ? "Heute gemaess Coach-Plan" : "Heute bewusst nicht trainieren",
    duration: plan.estimated_duration_minutes ? `${plan.estimated_duration_minutes} Min` : "-",
    why: plan.coach_reasoning || plan.coach_summary || "Der Plan basiert auf Check-in, Verlauf und Trainingsziel.",
    focus: plan.mental_focus || assessment?.mental_alignment || "Konzentriert arbeiten, sauber rueckmelden, nicht gegen die Tagesform erzwingen.",
    goal: plan.goal || "Trainingssteuerung",
    decision: plan.should_train ? "Trainieren" : "Recovery / Pause"
  };
}

function setToneClasses(node, baseClass, tone) {
  if (node) node.className = `${baseClass} ${tone}`;
}

function renderDailyProgress(rows) {
  const container = byId("dailyProgress");
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Noch keine Tagesdaten.</p>';
    return;
  }

  const latestFirst = [...rows];
  const maxLoad = Math.max(...latestFirst.map((row) => Number(row.training_load || 0)), 1);

  latestFirst.forEach((row) => {
    const load = Number(row.training_load || 0);
    const width = Math.max(4, Math.round((load / maxLoad) * 100));
    const readinessLabel = row.readiness == null ? "-" : score(row.readiness);
    const minutes = Number(row.workout_minutes || 0);
    const el = document.createElement("div");
    el.className = "bar-row";
    el.innerHTML = `
      <span>${formatDay(row.week_start)}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
      <strong>${load} AU</strong>
    `;
    el.querySelector("span").textContent = formatDay(row.entry_date);
    el.title = `Readiness ${readinessLabel}, Training ${minutes} Min, Belastung ${load} AU`;
    container.appendChild(el);

    const meta = document.createElement("div");
    meta.className = "progress-meta";
    meta.innerHTML = `
      <span>Readiness ${readinessLabel}</span>
      <span>${minutes} Min Training</span>
      <span>Schlaf ${score(row.sleep_quality)}</span>
      <span>Energie ${score(row.energy)}</span>
    `;
    container.appendChild(meta);
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
    const pain = row.pain_present ? `${row.pain_area || "Beschwerden"} ${score(row.pain_intensity)}` : "keine Beschwerden";
    const el = document.createElement("article");
    el.className = "item";
    el.innerHTML = `
      <div class="item-title">
        <span>${formatDay(row.entry_date)}</span>
        <span class="item-meta">Energie ${score(row.energy)}</span>
      </div>
      <p>Schlaf ${score(row.sleep_quality)} · Motivation ${score(row.motivation)} · Stress ${score(row.stress)}</p>
      <p>Muskelkater ${score(row.soreness)} · Beine ${score(row.muscle_soreness_legs)} · Oberkoerper ${score(row.muscle_soreness_upper)} · Rumpf ${score(row.muscle_soreness_back_core)}</p>
      <p>Beschwerden: ${escapeHtml(pain)}</p>
      <p>${escapeHtml(notes(firstText(row.daily_context, row.daily_constraints, row.notes, row.pain_notes)))}</p>
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
      <p>${row.duration_minutes} Min · Belastung ${score(row.intensity)} · RPE ${score(row.rpe)} · Technik ${score(row.technique_feel)}</p>
      <p>${escapeHtml(notes(firstText(row.went_well, row.not_well, row.plan_deviations, row.notes, row.sets_summary)))}</p>
    `;
    container.appendChild(el);
  });
}

function renderLastWorkout(rows) {
  const latest = rows[0];
  if (!latest) {
    text("lastWorkoutDate", "-");
    byId("lastWorkout").innerHTML = "Noch kein Check-out vorhanden.";
    return;
  }

  text("lastWorkoutDate", formatDay(latest.entry_date));
  byId("lastWorkout").innerHTML = `
    <strong>${escapeHtml(latest.activity)}</strong>
    <p>${latest.duration_minutes} Min · Belastung ${score(latest.intensity)} · RPE ${score(latest.rpe)}</p>
    <p>Qualitaet ${score(latest.training_quality)} · Energie ${score(latest.training_energy)} · Explosivitaet ${score(latest.explosiveness)}</p>
    <p>Technik ${score(latest.technique_feel)} · Muskelgefuehl ${score(latest.muscle_feel)} · Regenerationsbedarf ${score(latest.recovery_need)}</p>
    <p>${escapeHtml(notes(firstText(latest.went_well, latest.not_well, latest.plan_deviations, latest.notes, latest.sets_summary)))}</p>
  `;
}

function renderGoals(profile, goals = []) {
  const activeGoal = goals[0];
  text("profileName", profile?.display_name || "Profil");
  text("activeGoalTitle", activeGoal?.title || profile?.primary_goal || "Noch kein aktives Ziel");
  text("activeGoalDescription", activeGoal?.description || "Sobald Ziele gespeichert sind, werden sie hier fuer Coaching und Dashboard sichtbar.");

  const container = byId("goalChips");
  container.innerHTML = "";
  if (!goals.length) {
    container.innerHTML = '<span class="chip muted">Keine Ziele gespeichert</span>';
    return;
  }

  goals.slice(0, 6).forEach((goal) => {
    const chip = document.createElement("span");
    chip.className = `chip ${goal.goal_level || "supporting"}`;
    chip.textContent = goal.goal_level === "primary" ? `Hauptziel: ${goal.title}` : goal.title;
    container.appendChild(chip);
  });
}

function formatMetric(metric) {
  if (!metric) return "-";
  return valueWithUnit(metric.numeric_value ?? metric.text_value, metric.unit);
}

function latestMetric(metrics, key) {
  return metrics.find((metric) => metric.metric_key === key);
}

function renderMeasurementDays(days = [], metrics = []) {
  const container = byId("measurementDays");
  text("measurementCount", `${days.length} Eintraege`);
  text("lastMeasurementDay", days[0] ? formatDay(days[0].entry_date) : "-");
  text("jumpHeightMetric", formatMetric(latestMetric(metrics, "jump_height")));
  text("broadJumpMetric", formatMetric(latestMetric(metrics, "broad_jump")));
  text("sprintMetric", formatMetric(latestMetric(metrics, "sprint_start_quality")));

  container.innerHTML = "";
  if (!days.length) {
    container.innerHTML = '<div class="empty-state"><strong>Noch keine Messtage gespeichert.</strong><p>Wenn dein GPT einen Messtag plant oder auswertet, erscheinen hier Datum, Anlass und Interpretation.</p></div>';
    return;
  }

  days.forEach((day) => {
    const el = document.createElement("article");
    el.className = "item";
    el.innerHTML = `
      <div class="item-title">
        <span>${escapeHtml(day.title)}</span>
        <span class="item-meta">${formatDay(day.entry_date)}</span>
      </div>
      <p>Status: ${escapeHtml(day.status || "-")} · Anlass: ${escapeHtml(day.trigger_reason || "-")}</p>
      <p>${escapeHtml(notes(day.notes))}</p>
    `;
    container.appendChild(el);
  });
}

function renderStrengthResults(checkOuts = []) {
  const container = byId("strengthResults");
  container.innerHTML = "";
  const exercises = checkOuts.flatMap((checkOut) =>
    (checkOut.exercise_results || []).map((exercise) => ({
      ...exercise,
      check_out_date: checkOut.entry_date
    }))
  );

  if (!exercises.length) {
    container.innerHTML = '<div class="empty-state"><strong>Noch keine Uebungsergebnisse gespeichert.</strong><p>Nach dem naechsten Check-out zeigt dieser Bereich Plan-Ist-Abweichungen fuer Saetze, Wiederholungen und Gewicht.</p></div>';
    return;
  }

  exercises.slice(0, 8).forEach((exercise) => {
    const planned = [exercise.planned_sets, exercise.planned_reps, exercise.planned_load_text].filter(Boolean).join(" x ");
    const actual = [exercise.actual_sets, exercise.actual_reps, exercise.actual_load_text].filter(Boolean).join(" x ");
    const el = document.createElement("article");
    el.className = "item exercise-result";
    el.innerHTML = `
      <div class="item-title">
        <span>${escapeHtml(exercise.exercise_name)}</span>
        <span class="item-meta">${formatDay(exercise.check_out_date)}</span>
      </div>
      <p>Plan: ${escapeHtml(planned || "-")}</p>
      <p>Ist: ${escapeHtml(actual || planned || "-")} · RPE ${score(exercise.rpe)} · Schmerz ${score(exercise.pain_score)}</p>
      <p>${escapeHtml(notes(exercise.notes))}</p>
    `;
    container.appendChild(el);
  });
}

function renderTrainingPlanExercises(plan) {
  const container = byId("trainingPlanExercises");
  container.innerHTML = "";

  if (!plan?.exercises?.length) {
    if (plan && !plan.should_train) {
      container.innerHTML = '<div class="empty-state"><strong>Heute kein Training geplant.</strong><p>Der Coach hat einen Recovery- oder Pausentag gespeichert. Entscheidend sind Erholung, Schmerzfreiheit und Vorbereitung auf den naechsten Reiz.</p></div>';
      return;
    }
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
      <p><b>Technik:</b> ${escapeHtml(exercise.technical_notes || missingTrainingText("technical"))}</p>
      <p><b>Heute achten auf:</b> ${escapeHtml(exercise.today_focus || missingTrainingText("focus"))}</p>
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
  const plan = planFromStoredTrainingPlan(storedPlan, assessment) || trainingPlan(readiness, today);
  const heroHeadline = deriveHeroHeadline(state, plan, assessment);
  const heroReason = firstText(
    storedPlan?.coach_reasoning,
    storedPlan?.coach_summary,
    assessment?.next_step_summary,
    assessment?.coach_statement,
    state.reason
  );

  text("todayDate", displayCheckIn ? formatDay(displayCheckIn.entry_date) : "Heute");
  text("coachHeadline", heroHeadline);
  text("coachReason", heroReason);
  text("readinessScore", readiness == null ? "-" : Math.round(readiness));
  text("targetProgressStatement", assessment?.next_step_summary || plan.why || plan.focus);
  text("healthReadiness", percent(assessment?.readiness_health ?? scores.health));
  text("mentalReadiness", percent(assessment?.readiness_mental ?? scores.mental));
  text("physicalReadiness", percent(assessment?.readiness_physical ?? scores.physical));

  setToneClasses(byId("coachLight"), "traffic-pill", state.tone);
  text("coachLight", `Ampel ${state.label}`);
  byId("scoreRing").style.borderColor = state.tone === "green" ? "var(--accent)" : state.tone === "red" ? "var(--red)" : state.tone === "yellow" ? "var(--yellow)" : "var(--blue)";

  renderGoals(data.profile, data.active_goals || []);
  text("stepBadge", plan.badge);
  text("trainingType", plan.type);
  text("trainingTiming", `${plan.when} · ${plan.duration}`);
  text("trainingGoal", plan.goal);
  text("trainingWhy", plan.why);
  text("mentalFocus", assessment?.mental_alignment || plan.focus);
  text("nutritionRecommendation", assessment?.nutrition_recommendation || storedPlan?.nutrition_recommendation || "Noch keine Ernaehrungsempfehlung gespeichert.");
  text("goalLink", plan.goal);
  renderTrainingPlanExercises(storedPlan);

  text("sleepQuality", score(displayCheckIn?.sleep_quality));
  text("sleepHours", displayCheckIn?.sleep_hours == null ? "-" : `${displayCheckIn.sleep_hours} h`);
  text("energyScore", score(displayCheckIn?.energy));
  text("motivationScore", score(displayCheckIn?.motivation));
  text("sorenessScore", score(displayCheckIn?.soreness));
  text("sorenessLegs", score(displayCheckIn?.muscle_soreness_legs));
  text("sorenessUpper", score(displayCheckIn?.muscle_soreness_upper));
  text("sorenessBackCore", score(displayCheckIn?.muscle_soreness_back_core));
  text("bodyWeight", displayCheckIn?.body_weight_kg == null ? "-" : `${displayCheckIn.body_weight_kg} kg`);
  text("stressScore", score(displayCheckIn?.stress));
  text("mobilityScore", score(displayCheckIn?.mobility));
  text("sicknessScore", score(displayCheckIn?.sickness));
  text("painArea", displayCheckIn?.pain_present ? displayCheckIn?.pain_area || "ja" : "Nein");
  text("painIntensity", score(displayCheckIn?.pain_intensity));

  const recoveryComment = assessment?.reason
    ? assessment.reason
    : readiness == null
      ? "Noch keine Recovery-Auswertung vorhanden."
      : readiness >= 75
        ? "Recovery wirkt stabil. Du kannst produktiv trainieren, solange Warm-up und Technik stimmen."
        : readiness >= 55
          ? "Recovery ist brauchbar, aber nicht voll. Setze heute auf kontrollierte Intensitaet und klare Grenzen."
          : "Recovery ist niedrig. Heute bringt Entlastung mehr als Druck.";
  text("recoveryComment", recoveryComment);

  const hasRisk = Number(displayCheckIn?.soreness || 0) >= 7 || Number(displayCheckIn?.stress || 0) >= 8 || Number(displayCheckIn?.pain_intensity || 0) >= 4 || Number(displayCheckIn?.sickness || 0) >= 4;
  const riskComment = hasRisk
    ? "Erhoehtes Risiko: Muskelkater, Stress, Beschwerden oder Krankheitsgefuehl sprechen fuer Anpassung."
    : displayCheckIn
      ? "Kein harter Warnhinweis aus den aktuellen Check-in-Werten. Schmerz- und Techniksignale trotzdem beachten."
      : "Der Coach bewertet Warnsignale, sobald ausreichend Check-in-Daten vorhanden sind.";
  text("riskComment", riskComment);
  text("riskBadge", hasRisk ? "Erhoeht" : "Normal");

  renderDailyProgress(data.daily_history || []);
  renderMeasurementDays(data.recent_measurement_days || [], data.metric_trends || []);
  renderCheckIns(data.recent_check_ins || []);
  renderCheckOuts(data.recent_check_outs || []);
  renderStrengthResults(data.recent_check_outs || []);
  renderLastWorkout(data.recent_check_outs || []);
}

byId("refreshButton").addEventListener("click", () => {
  loadDashboard().catch((error) => alert(error.message));
});

loadDashboard().catch((error) => alert(error.message));
