const storageKey = "assessment-item-coach-bank";
let currentMode = "whole-test";
let currentReview = [];

const verbMap = {
  Comparing: "Useful verbs: compare, contrast, distinguish, identify similarities, identify differences.",
  Classifying: "Useful verbs: classify, categorize, sort, group, identify the type.",
  Analyzing: "Useful verbs: analyze, identify parts, determine relationships, explain causes.",
  "Inductive Reasoning": "Useful verbs: infer, generalize, identify a pattern, draw a conclusion from examples.",
  "Deductive Reasoning": "Useful verbs: apply a rule, predict, determine the result, draw a conclusion from a principle.",
  Evaluating: "Useful verbs: judge, justify, defend, critique, determine the better option."
};

const form = document.querySelector("#itemForm");
const itemFormat = document.querySelector("#itemFormat");
const targetType = document.querySelector("#targetType");
const reasoningSkill = document.querySelector("#reasoningSkill");
const selectedFields = document.querySelector("#selectedFields");
const essayFields = document.querySelector("#essayFields");
const verbSupport = document.querySelector("#verbSupport");
const coachQuestions = document.querySelector("#coachQuestions");
const reviewResults = document.querySelector("#reviewResults");
const readinessStatus = document.querySelector("#readinessStatus");
const readinessSummary = document.querySelector("#readinessSummary");
const storageCount = document.querySelector("#storageCount");
const bankList = document.querySelector("#bankList");
const exportPreview = document.querySelector("#exportPreview");
const nextStep = document.querySelector("#nextStep");
const formSteps = [...document.querySelectorAll("details.form-section")];
let mobileStepIndex = 0;

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll(".chip, .start-card").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
    currentMode = button.dataset.mode;
    document.querySelectorAll(".chip, .start-card").forEach((control) => {
      control.classList.toggle("active", control.dataset.mode === currentMode);
    });
    updateCoachQuestions();
    runReview(false);
  });
});

itemFormat.addEventListener("change", () => {
  updateItemTypeFields();
  updateCoachQuestions();
  runReview(false);
});

targetType.addEventListener("change", () => {
  if (targetType.value !== "Reasoning") reasoningSkill.value = "";
  updateCoachQuestions();
  runReview(false);
});

reasoningSkill.addEventListener("change", () => {
  verbSupport.textContent = verbMap[reasoningSkill.value] || "Choose a reasoning skill to see suggested verbs.";
  runReview(false);
});

form.addEventListener("input", () => runReview(false));
form.addEventListener("reset", () => {
  window.setTimeout(() => {
    currentReview = [];
    updateItemTypeFields();
    updateCoachQuestions();
    renderReview([]);
  });
});

document.querySelector("#reviewButton").addEventListener("click", () => runReview(true));
document.querySelector("#saveButton").addEventListener("click", saveCurrentItem);
document.querySelector("#refreshRankButton").addEventListener("click", renderBank);
document.querySelector("#backupButton").addEventListener("click", downloadBackup);
document.querySelector("#restoreButton").addEventListener("click", () => document.querySelector("#restoreFile").click());
document.querySelector("#restoreFile").addEventListener("change", restoreBackup);
document.querySelector("#importButton").addEventListener("click", importCsv);
document.querySelector("#templateButton").addEventListener("click", downloadCsvTemplate);
document.querySelector("#downloadDocxButton").addEventListener("click", downloadDocx);
document.querySelector("#printPdfButton").addEventListener("click", () => {
  renderExport();
  showView("export");
  window.print();
});
document.querySelector("#mobileBackButton").addEventListener("click", () => setMobileStep(mobileStepIndex - 1));
document.querySelector("#mobileNextButton").addEventListener("click", () => setMobileStep(mobileStepIndex + 1));
window.addEventListener("resize", applyMobileStepMode);

function showView(view) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  if (view === "bank") renderBank();
  if (view === "export") renderExport();
}

function getBank() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function setBank(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
  updateStorageCount();
}

function updateStorageCount() {
  const count = getBank().length;
  storageCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
}

function updateItemTypeFields() {
  const isEssay = itemFormat.value === "Essay";
  selectedFields.hidden = isEssay;
  essayFields.hidden = !isEssay;
}

function isPhoneLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function applyMobileStepMode() {
  if (!formSteps.length) return;
  if (isPhoneLayout()) {
    setMobileStep(mobileStepIndex);
  }
}

function setMobileStep(index) {
  if (isPhoneLayout() && index > formSteps.length - 1) {
    runReview(true);
    document.querySelector("#reviewResults")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  mobileStepIndex = Math.max(0, Math.min(index, formSteps.length - 1));
  if (isPhoneLayout()) {
    formSteps.forEach((step, stepIndex) => {
      step.open = stepIndex === mobileStepIndex;
    });
    formSteps[mobileStepIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelector("#mobileStepLabel").textContent = `Step ${mobileStepIndex + 1} of ${formSteps.length}`;
  document.querySelector("#mobileBackButton").disabled = mobileStepIndex === 0;
  document.querySelector("#mobileNextButton").textContent = mobileStepIndex === formSteps.length - 1 ? "Review" : "Next";
  if (mobileStepIndex === formSteps.length - 1) runReview(false);
}

function formDataToItem() {
  const data = new FormData(form);
  const item = Object.fromEntries(data.entries());
  item.mode = currentMode;
  item.id = item.id || crypto.randomUUID();
  item.updatedAt = new Date().toISOString();
  item.review = currentReview;
  return item;
}

function fillForm(item) {
  form.reset();
  Object.entries(item).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value || "";
  });
  currentMode = item.mode || "single-build";
  document.querySelectorAll(".chip, .start-card").forEach((control) => {
    control.classList.toggle("active", control.dataset.mode === currentMode);
  });
  updateItemTypeFields();
  updateCoachQuestions();
  runReview(true);
  showView("workspace");
}

function updateCoachQuestions() {
  const isEssay = itemFormat.value === "Essay";
  const isReasoning = targetType.value === "Reasoning";
  const questions = [];

  if (currentMode === "whole-test") {
    questions.push("Which TOS or blueprint cell does this item serve?");
  } else if (currentMode === "single-evaluate") {
    questions.push("What did you intend this existing item to measure?");
  } else {
    questions.push("What target should this item help assess?");
  }

  questions.push("Is the item assessing knowledge, or does it require reasoning?");

  if (isReasoning) {
    questions.push("What reasoning skill is intended, and what verb best matches it?");
    questions.push("Where is the new situation, case, example, or data?");
    questions.push("What previously taught knowledge must the learner use?");
  }

  if (isEssay) {
    questions.push("Can you answer your own essay exercise before writing the rubric?");
    questions.push("Does the rubric score the same evidence described in the expected response?");
  } else {
    questions.push("What proposition is this selected-response item based on?");
    questions.push("Why might a learner choose each distractor?");
    questions.push("Is there only one defensible answer?");
  }

  coachQuestions.innerHTML = questions.map((question) => `<div class="review-card"><strong>Probe</strong>${escapeHtml(question)}</div>`).join("");
}

function runReview(showDetails) {
  const item = formDataToItem();
  currentReview = evaluateItem(item);
  renderReadiness(currentReview);
  if (showDetails) renderReview(currentReview);
}

function evaluateItem(item) {
  const checks = [];
  const isEssay = item.itemFormat === "Essay";
  const isReasoning = item.targetType === "Reasoning";
  const itemMode = item.mode || currentMode;
  const required = [
    ["learningTarget", "Learning target is stated", "The item needs a clear learning target or outcome."],
    ["itemFormat", "Item format is selected", "Choose the item format."],
    ["stem", "Item stem or prompt is written", "Write the item stem or essay prompt."]
  ];

  if (itemMode === "whole-test") {
    required.push(["tosCell", "TOS or blueprint cell is identified", "For whole-test work, connect the item to a TOS or blueprint cell."]);
  }

  if (!isEssay) {
    required.push(["proposition", "Proposition is written", "Selected-response items need a clear proposition to assess."]);
    required.push(["answerKey", "Answer key is provided", "Provide the correct answer."]);
    required.push(["distractorAnalysis", "Distractor analysis is attempted", "Explain why learners might choose the wrong options."]);
  }

  if (isEssay) {
    required.push(["knowledgeNeeded", "Knowledge needed is identified", "State the previously taught knowledge needed to answer."]);
    required.push(["reasoningPath", "Guide to correct response is written", "Describe how a proficient learner should answer."]);
    required.push(["studentEssayAnswer", "Student item-writer answered the essay", "Answer your own essay exercise before finalizing it."]);
    required.push(["expectedResponse", "Expected response is written", "Write what a strong answer should contain."]);
    required.push(["rubric", "Rubric or scoring guide is provided", "Add scoring criteria before marking the item ready."]);
  }

  if (isReasoning) {
    required.push(["reasoningSkill", "Reasoning skill is selected", "Choose the intended reasoning skill."]);
    required.push(["knowledgeNeeded", "Knowledge needed is identified", "Reasoning items use previously taught knowledge."]);
    required.push(["novelSituation", "Novel situation is present", "Reasoning items need a new situation, case, example, or data."]);
    required.push(["reasoningPath", "Reasoning path is written", "State the correct path of reasoning."]);
  }

  required.forEach(([field, pass, fail]) => {
    checks.push({
      level: item[field]?.trim() ? "good" : "bad",
      title: pass,
      message: item[field]?.trim() ? "Present." : fail
    });
  });

  checks.push(cognitiveMatchCheck(item));

  if (!isEssay) {
    checks.push(...selectedResponseChecks(item));
  } else {
    checks.push(...essayChecks(item));
  }

  checks.push(revisionCheck(item));
  return checks;
}

function cognitiveMatchCheck(item) {
  const stem = `${item.stem || ""} ${item.novelSituation || ""}`.toLowerCase();
  if (item.targetType !== "Reasoning") {
    return {
      level: "good",
      title: "Cognitive level check",
      message: "The item is currently treated as a knowledge item. Check that it asks for taught content rather than unsupported reasoning."
    };
  }

  const hasNovel = Boolean(item.novelSituation?.trim());
  const skill = item.reasoningSkill;
  const cues = {
    Comparing: ["compare", "contrast", "similar", "different", "alike"],
    Classifying: ["classify", "category", "type", "group", "which statement correctly"],
    Analyzing: ["analyze", "relationship", "cause", "part", "effect"],
    "Inductive Reasoning": ["infer", "pattern", "generalize", "examples"],
    "Deductive Reasoning": ["apply", "rule", "principle", "conclusion"],
    Evaluating: ["evaluate", "judge", "justify", "defend", "better"]
  };
  const skillCues = cues[skill] || [];
  const hasCue = skillCues.some((cue) => stem.includes(cue));

  if (hasNovel && hasCue) {
    return {
      level: "good",
      title: "Cognitive level match",
      message: `The item appears to match reasoning: ${skill}. It includes a new situation and a cue for the intended reasoning.`
    };
  }

  if (!hasNovel) {
    return {
      level: "bad",
      title: "Cognitive level mismatch risk",
      message: "The item is marked as reasoning, but the new situation is not yet visible. It may collapse into recall."
    };
  }

  return {
    level: "warn",
    title: "Cognitive level needs checking",
    message: `A new situation is present, but the wording does not clearly signal ${skill || "the intended reasoning skill"}.`
  };
}

function selectedResponseChecks(item) {
  const checks = [];
  const options = [item.optionA, item.optionB, item.optionC, item.optionD].filter((value) => value?.trim());
  if (["Multiple Choice", "True/False"].includes(item.itemFormat)) {
    checks.push({
      level: options.length >= 2 ? "good" : "bad",
      title: "Options are provided",
      message: options.length >= 2 ? `${options.length} options are present.` : "Provide the answer choices."
    });
  }

  if (item.itemFormat === "Multiple Choice" && options.length >= 3) {
    const lengths = options.map((option) => option.length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    checks.push({
      level: max - min > 80 ? "warn" : "good",
      title: "Answer-length clue check",
      message: max - min > 80 ? "One option is much longer or shorter than the others. Check for answer clues." : "No major answer-length clue detected."
    });
  }

  const weakDistractors = /obvious|random|none/i.test(item.distractorAnalysis || "");
  checks.push({
    level: item.distractorAnalysis?.trim() && !weakDistractors ? "good" : "warn",
    title: "Distractor quality",
    message: item.distractorAnalysis?.trim()
      ? "Check whether each distractor represents a likely misconception or reasoning error."
      : "Add distractor analysis so the item shows plausible learner errors."
  });

  return checks;
}

function essayChecks(item) {
  const checks = [];
  const answer = (item.studentEssayAnswer || "").toLowerCase();
  const promptWords = meaningfulWords(item.stem);
  const overlap = promptWords.filter((word) => answer.includes(word)).length;
  checks.push({
    level: item.studentEssayAnswer?.trim() && overlap >= Math.min(3, promptWords.length) ? "good" : "warn",
    title: "Essay answer-to-prompt alignment",
    message: item.studentEssayAnswer?.trim()
      ? "The student's own answer has been compared with the prompt. Review whether it uses the required knowledge, reasoning, and novel situation."
      : "The student item-writer should answer the essay first so the prompt can be tested."
  });

  checks.push({
    level: item.rubric?.trim() && item.expectedResponse?.trim() ? "good" : "bad",
    title: "Rubric alignment",
    message: item.rubric?.trim() && item.expectedResponse?.trim()
      ? "Rubric and expected response are both present. Check that the criteria score the expected evidence."
      : "The rubric and expected response should be written together."
  });
  return checks;
}

function revisionCheck(item) {
  return {
    level: item.revisionNotes?.trim() ? "good" : "warn",
    title: "Revision cycle",
    message: item.revisionNotes?.trim()
      ? "Revision or reflection is documented."
      : "Before teacher feedback, the student should revise or explain why no revision is needed yet."
  };
}

function meaningfulWords(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 5)
    .slice(0, 12);
}

function renderReadiness(checks) {
  const bad = checks.filter((check) => check.level === "bad").length;
  const warn = checks.filter((check) => check.level === "warn").length;
  if (bad > 0) {
    readinessStatus.textContent = "Needs major revision";
    readinessSummary.textContent = `${bad} required area${bad === 1 ? "" : "s"} still need attention.`;
    nextStep.textContent = nextStepText(checks);
  } else if (warn > 0) {
    readinessStatus.textContent = "Needs refinement";
    readinessSummary.textContent = `${warn} area${warn === 1 ? "" : "s"} should be reviewed before teacher feedback.`;
    nextStep.textContent = nextStepText(checks);
  } else {
    readinessStatus.textContent = "Ready for teacher feedback";
    readinessSummary.textContent = "The item has passed the required self-checks. Teacher judgment is still needed.";
    nextStep.textContent = "Save the item to the test bank or export the matrix for teacher feedback.";
  }
}

function nextStepText(checks) {
  const issue = checks.find((check) => check.level === "bad") || checks.find((check) => check.level === "warn");
  if (!issue) return "Start with the purpose and learning target.";
  return `Next: ${issue.message}`;
}

function renderReview(checks) {
  if (!checks.length) {
    reviewResults.innerHTML = "<p>No review yet.</p>";
    return;
  }
  const priority = checks.filter((check) => check.level !== "good");
  const passed = checks.filter((check) => check.level === "good").length;
  const visible = priority.length ? priority : checks;
  reviewResults.innerHTML = [
    `<div class="review-card ${priority.length ? "warn" : "good"}"><strong>${priority.length ? "Review Focus" : "Ready for teacher feedback"}</strong>${priority.length ? "Work on these items first. The app is guiding revision, not giving a grade." : "The required self-checks are complete. Teacher judgment is still needed."}</div>`,
    ...visible.map((check) => `<div class="review-card ${check.level}"><strong>${escapeHtml(check.title)}</strong>${escapeHtml(check.message)}</div>`),
    `<div class="review-card good"><strong>Checks already in place</strong>${passed} check${passed === 1 ? "" : "s"} are complete or acceptable.</div>`
  ].join("");
}

function saveCurrentItem() {
  runReview(true);
  const item = formDataToItem();
  item.review = currentReview;
  item.supportScore = supportScore(currentReview);
  item.readiness = readinessLabel(currentReview);
  const bank = getBank();
  const index = bank.findIndex((existing) => existing.id === item.id);
  if (index >= 0) bank[index] = item;
  else bank.unshift(item);
  setBank(bank);
  renderBank();
}

function downloadBackup() {
  const bank = getBank();
  const backup = {
    app: "Assessment Item Coach",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Editable backup for moving work between phone and desktop. Import this JSON file into the same app.",
    items: bank
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `assessment-item-bank-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(incoming)) throw new Error("Backup does not contain items.");
      const existing = getBank();
      const byId = new Map(existing.map((item) => [item.id, item]));
      incoming.forEach((item) => {
        const id = item.id || crypto.randomUUID();
        byId.set(id, { ...item, id, updatedAt: item.updatedAt || new Date().toISOString() });
      });
      setBank([...byId.values()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))));
      renderBank();
      showView("bank");
      bankList.insertAdjacentHTML("afterbegin", '<div class="review-card good"><strong>Backup opened</strong>The editable items from the backup file are now in this browser test bank.</div>');
    } catch (error) {
      bankList.insertAdjacentHTML("afterbegin", `<div class="review-card bad"><strong>Backup could not be opened</strong>${escapeHtml(error.message)}</div>`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function supportScore(review) {
  return review.reduce((score, check) => score + (check.level === "bad" ? 2 : check.level === "warn" ? 1 : 0), 0);
}

function readinessLabel(review) {
  if (review.some((check) => check.level === "bad")) return "Needs major revision";
  if (review.some((check) => check.level === "warn")) return "Needs refinement";
  return "Ready for teacher feedback";
}

function renderBank() {
  const bank = getBank()
    .map((item) => {
      const review = evaluateItem(item);
      return { ...item, review, supportScore: supportScore(review), readiness: readinessLabel(review) };
    })
    .sort((a, b) => b.supportScore - a.supportScore);

  if (!bank.length) {
    bankList.innerHTML = '<div class="panel form-section"><p class="muted">No saved items yet.</p></div>';
    return;
  }

  bankList.innerHTML = bank
    .map((item, index) => {
      const concern = item.review.find((check) => check.level === "bad") || item.review.find((check) => check.level === "warn");
      return `
        <article class="bank-item">
          <div class="bank-meta">
            <span class="badge">${item.supportScore ? `Needs attention ${index + 1}` : "Ready group"}</span>
            <span>${escapeHtml(item.itemFormat || "Item")}</span>
            <span>${escapeHtml(item.targetType || "Target")}</span>
            <span>${formatDate(item.updatedAt)}</span>
          </div>
          <strong>${escapeHtml(item.topic || item.learningTarget || "Untitled item")}</strong>
          <p class="muted">${escapeHtml((item.stem || "").slice(0, 220))}</p>
          <div class="review-card ${item.supportScore ? "warn" : "good"}">
            <strong>${escapeHtml(item.readiness)}</strong>
            ${escapeHtml(concern ? `Why it appears here: ${concern.message}` : "Ready for teacher feedback.")}
          </div>
          <div class="bank-actions">
            <button type="button" onclick="loadBankItem('${item.id}')">Open</button>
            <button type="button" class="ghost" onclick="deleteBankItem('${item.id}')">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

window.loadBankItem = (id) => {
  const item = getBank().find((entry) => entry.id === id);
  if (item) fillForm(item);
};

window.deleteBankItem = (id) => {
  setBank(getBank().filter((item) => item.id !== id));
  renderBank();
};

function importCsv() {
  const file = document.querySelector("#csvFile").files[0];
  const results = document.querySelector("#importResults");
  if (!file) {
    results.innerHTML = '<div class="review-card bad"><strong>No file selected</strong>Select a CSV file first.</div>';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(reader.result);
    if (!rows.length) {
      results.innerHTML = '<div class="review-card bad"><strong>No rows found</strong>Check the CSV file.</div>';
      return;
    }
    const bank = getBank();
    const imported = rows.map((row) => {
      const item = {
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        mode: row.mode || "single-evaluate",
        ...row
      };
      const review = evaluateItem(item);
      item.review = review;
      item.supportScore = supportScore(review);
      item.readiness = readinessLabel(review);
      return item;
    });
    setBank([...imported, ...bank]);
    results.innerHTML = `<div class="review-card good"><strong>Imported ${imported.length} item${imported.length === 1 ? "" : "s"}</strong>The items were saved to the test bank and ranked by support priority.</div>`;
    renderBank();
  };
  reader.readAsText(file);
}

function downloadCsvTemplate() {
  const headers = [
    "subject",
    "gradeLevel",
    "topic",
    "learningTarget",
    "tosCell",
    "itemFormat",
    "targetType",
    "reasoningSkill",
    "proposition",
    "knowledgeNeeded",
    "novelSituation",
    "reasoningPath",
    "stem",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "answerKey",
    "distractorAnalysis",
    "studentEssayAnswer",
    "expectedResponse",
    "rubric",
    "revisionNotes"
  ];
  const sample = [
    "Assessment of Learning",
    "BSED 3",
    "Formative and summative assessment",
    "Classify assessment activities as formative or summative based on purpose.",
    "Assessment concepts / Reasoning / Classifying",
    "Multiple Choice",
    "Reasoning",
    "Classifying",
    "Assessment activities may be classified according to purpose.",
    "Characteristics of formative and summative assessment.",
    "A teacher uses weekly quizzes to monitor learning and quarterly exams to assign grades.",
    "Identify each activity purpose and match it to the assessment type.",
    "Based on the characteristics of formative and summative assessment, how should these activities be classified?",
    "Both are formative assessments.",
    "Weekly quizzes are formative; quarterly exams are summative.",
    "Weekly quizzes are summative; quarterly exams are formative.",
    "Both are summative assessments.",
    "B",
    "A: thinks all quizzes are formative. C: reverses concepts. D: thinks all tests are summative.",
    "",
    "",
    "",
    "Teacher will review after app self-check."
  ];
  const csv = `${headers.join(",")}\n${sample.map(csvEscape).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "assessment-item-import-template.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const text = String(value || "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      current.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(value);
      rows.push(current);
      current = [];
      value = "";
    } else {
      value += char;
    }
  }
  current.push(value);
  rows.push(current);

  const [headers, ...dataRows] = rows.filter((row) => row.some((cell) => cell.trim()));
  if (!headers) return [];
  return dataRows.map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header.trim()] = (row[index] || "").trim();
    });
    return object;
  });
}

function renderExport() {
  const bank = getBank();
  const currentItem = formDataToItem();
  const items = bank.length ? bank : [currentItem];
  exportPreview.innerHTML = items.map((item, index) => matrixHtml(item, index + 1)).join("");
}

function matrixHtml(item, number) {
  const review = evaluateItem(item);
  const quality = qualitySummary(review);
  const rows = [
    ["App Note", "This app was developed by J. Arawiran. The review is a learning support and does not replace teacher feedback."],
    ["Privacy and Sources Note", "Items are saved locally in this browser unless exported or imported by the user. The review is informed by classroom assessment principles associated with Stiggins, Popham, Brookhart, McMillan, Nitko, and related assessment literature."],
    ["Student Name", item.studentName],
    ["Subject / Course", item.subject],
    ["Grade Level / Class", item.gradeLevel],
    ["Topic", item.topic],
    ["Learning Target", item.learningTarget],
    ["Blueprint / TOS Cell", item.tosCell],
    ["Item Format", item.itemFormat],
    ["Target Type", item.targetType],
    ["Reasoning Skill", item.reasoningSkill],
    ["Proposition", item.proposition],
    ["Knowledge Needed", item.knowledgeNeeded],
    ["Novel Situation", item.novelSituation],
    ["Reasoning Path / Guide", item.reasoningPath],
    ["Final Item / Prompt", item.stem],
    ["Options", formatOptions(item)],
    ["Answer Key", item.answerKey],
    ["Student Distractor Analysis", item.distractorAnalysis],
    ["Student Item-Writer's Answer", item.studentEssayAnswer],
    ["Expected Response", item.expectedResponse],
    ["Rubric / Scoring Guide", item.rubric],
    ["Quality Review Summary", quality.summary],
    ["Areas for Teacher Feedback", quality.concerns],
    ["Readiness", readinessLabel(review)],
    ["Revision Notes", item.revisionNotes]
  ].filter(([, value]) => value && String(value).trim());

  return `
    <table class="matrix">
      <caption>Item ${number}: ${escapeHtml(item.topic || item.itemFormat || "Assessment Item")}</caption>
      <tbody>
        ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function qualitySummary(review) {
  const bad = review.filter((check) => check.level === "bad");
  const warn = review.filter((check) => check.level === "warn");
  const good = review.filter((check) => check.level === "good");
  const concerns = [...bad, ...warn].slice(0, 5);
  return {
    summary: `${good.length} check${good.length === 1 ? "" : "s"} complete; ${bad.length} required concern${bad.length === 1 ? "" : "s"}; ${warn.length} refinement concern${warn.length === 1 ? "" : "s"}.`,
    concerns: concerns.length
      ? concerns.map((check) => `${check.title}: ${check.message}`).join("\n")
      : "No major concern from the app self-check. Submit for teacher feedback."
  };
}

function formatOptions(item) {
  const options = [
    ["A", item.optionA],
    ["B", item.optionB],
    ["C", item.optionC],
    ["D", item.optionD]
  ].filter(([, value]) => value?.trim());
  return options.map(([letter, value]) => `${letter}. ${value}`).join("\n");
}

function downloadDocx() {
  renderExport();
  const content = exportPreview.innerHTML;
  const body = htmlToWordXml(content);
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": body
  };
  const blob = new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "assessment-item-matrix.docx";
  link.click();
  URL.revokeObjectURL(link.href);
}

function htmlToWordXml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraphs = [];
  container.querySelectorAll("table").forEach((table) => {
    const caption = table.querySelector("caption")?.textContent || "Assessment Item";
    paragraphs.push(wordParagraph(caption, true));
    table.querySelectorAll("tr").forEach((row) => {
      const cells = [...row.children].map((cell) => cell.innerText);
      paragraphs.push(wordTableRow(cells[0], cells[1] || ""));
    });
    paragraphs.push(wordParagraph(""));
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
}

function wordParagraph(text, bold = false) {
  const boldTag = bold ? "<w:b/>" : "";
  return `<w:p><w:r><w:rPr>${boldTag}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function wordTableRow(label, detail) {
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/></w:tcPr>${wordParagraph(label, true)}</w:tc><w:tc><w:tcPr><w:tcW w:w="7600" w:type="dxa"/></w:tcPr>${String(detail).split("\n").map((line) => wordParagraph(line)).join("")}</w:tc></w:tr></w:tbl>`;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data
    ]);
    localParts.push(local);
    centralParts.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), nameBytes
    ]));
    offset += local.length;
  });
  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(Object.keys(files).length), u16(Object.keys(files).length),
    u32(central.length), u32(offset), u16(0)
  ]);
  return concatBytes([...localParts, central, end]);
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function xmlEscape(value) {
  return escapeHtml(value).replace(/&#039;/g, "&apos;");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

updateItemTypeFields();
updateCoachQuestions();
updateStorageCount();
renderReview([]);
applyMobileStepMode();
