import test from "node:test";
import assert from "node:assert/strict";
import {
  checkInSchema,
  goalConfirmSchema,
  movementAnalysisSchema,
  profileContextSchema,
  trackingFieldsSchema,
  trainingPlanSchema
} from "../src/validation.js";

test("context changes require explicit user confirmation", () => {
  assert.equal(profileContextSchema.safeParse({ change_reason: "Neuer Job", user_context: { job: "neu" } }).success, false);
  assert.equal(profileContextSchema.safeParse({
    user_confirmed: true, change_reason: "Vom Nutzer mitgeteilt", user_context: { job: "neu" }
  }).success, true);
});

test("supporting goals require confirmation", () => {
  assert.equal(goalConfirmSchema.safeParse({ goals: [{ title: "Knie stabilisieren" }] }).success, false);
  assert.equal(goalConfirmSchema.safeParse({
    user_confirmed: true, replacement_mode: "supplement",
    goals: [{ title: "Knie stabilisieren", goal_level: "supporting" }]
  }).success, true);
});

test("tracking fields distinguish custom and temporary fields", () => {
  assert.equal(trackingFieldsSchema.safeParse({ fields: [{
    metric_key: "adductor_soreness", label: "Adduktoren", category: "recovery",
    field_kind: "temporary", value_type: "scale", scale_min: 0, scale_max: 10,
    rationale: "Aktuelle Beschwerden beobachten"
  }]}).success, true);
});

test("check-in accepts regional body data", () => {
  assert.equal(checkInSchema.safeParse({
    date: "2026-08-03", sleep_quality: 8, energy: 7, soreness: 3, motivation: 8,
    mood_wellbeing: 7,
    body_regions: [{ region_key: "calves_feet", region_label: "Waden und Fuesse", soreness_score: 2 }]
  }).success, true);
});

test("measurement plan needs no training blocks", () => {
  assert.equal(trainingPlanSchema.safeParse({
    date: "2026-08-03", should_train: true, plan_type: "measurement",
    session_title: "Messtag", goal: "Sprungkraft messen", exercises: []
  }).success, true);
});

test("normal training still requires all three blocks", () => {
  assert.equal(trainingPlanSchema.safeParse({
    date: "2026-08-03", should_train: true, plan_type: "training",
    session_title: "Kraft", goal: "Kraftreiz", exercises: []
  }).success, false);
});

test("movement analysis stores deductions without a video URL", () => {
  const parsed = movementAnalysisSchema.safeParse({
    entry_date: "2026-08-03", movement_name: "Vertikalsprung",
    summary: "Landung stabil, Armschwung spaet."
  });
  assert.equal(parsed.success, true);
  assert.equal("file_url" in parsed.data, false);
});
