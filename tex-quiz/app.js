(function () {
  const config = window.QUIZ_CONFIG || {};
  const meta = config.meta || {};
  const settings = {
    questionSource: "",
    shuffleQuestions: false,
    shuffleOptions: false,
    showCorrectAnswers: true,
    submitEndpoint: "",
    ...(config.settings || {})
  };

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let originalQuestions = Array.isArray(config.questions) ? config.questions : [];
  let activeQuestionSource = originalQuestions.length ? "内置题库" : "";
  const state = {
    student: null,
    startedAt: null,
    endedAt: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    timerId: null,
    deadline: null,
    submitted: false,
    result: null
  };

  const $ = (id) => document.getElementById(id);

  const elements = {
    courseLabel: $("courseLabel"),
    quizTitle: $("quizTitle"),
    timer: $("timer"),
    timerText: $("timerText"),
    themeToggle: $("themeToggle"),
    startView: $("startView"),
    studentForm: $("studentForm"),
    introText: $("introText"),
    studentName: $("studentName"),
    studentClass: $("studentClass"),
    studentId: $("studentId"),
    startButton: $("startButton"),
    sourceStatus: $("sourceStatus"),
    quizView: $("quizView"),
    progressText: $("progressText"),
    answeredText: $("answeredText"),
    progressFill: $("progressFill"),
    numberGrid: $("numberGrid"),
    questionBadge: $("questionBadge"),
    questionScore: $("questionScore"),
    questionText: $("questionText"),
    options: $("options"),
    prevButton: $("prevButton"),
    nextButton: $("nextButton"),
    submitButton: $("submitButton"),
    resultView: $("resultView"),
    scoreNumber: $("scoreNumber"),
    scoreDetail: $("scoreDetail"),
    submitStatus: $("submitStatus"),
    reviewPanel: $("reviewPanel"),
    downloadCsvButton: $("downloadCsvButton"),
    copySummaryButton: $("copySummaryButton"),
    restartButton: $("restartButton")
  };

  async function boot() {
    elements.quizTitle.textContent = meta.title || "TeX 单选测验";
    document.title = meta.title || "TeX 单选测验";
    elements.courseLabel.textContent = meta.course || "Quiz";
    if (meta.instructions) {
      elements.introText.innerHTML = cleanQuestionText(meta.instructions);
      elements.introText.hidden = false;
    }
    elements.startButton.disabled = true;

    const savedTheme = localStorage.getItem("texQuizTheme");
    if (savedTheme === "dark") {
      document.documentElement.dataset.theme = "dark";
      updateThemeIcon();
    }

    elements.studentForm.addEventListener("submit", startQuiz);
    elements.prevButton.addEventListener("click", () => goToQuestion(state.currentIndex - 1));
    elements.nextButton.addEventListener("click", () => goToQuestion(state.currentIndex + 1));
    elements.submitButton.addEventListener("click", () => submitQuiz(false));
    elements.restartButton.addEventListener("click", restart);
    elements.downloadCsvButton.addEventListener("click", downloadCsv);
    elements.copySummaryButton.addEventListener("click", copySummary);
    elements.themeToggle.addEventListener("click", toggleTheme);

    await loadQuestionBank();
    refreshIcons();
  }

  async function loadQuestionBank() {
    const source = String(settings.questionSource || "").trim();
    if (!source) {
      updateSourceStatus(`已载入 ${originalQuestions.length} 题 · ${activeQuestionSource || "内置题库"}`);
      elements.startButton.disabled = !originalQuestions.length;
      return;
    }

    updateSourceStatus("正在加载题库表...");
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const csv = await response.text();
      const { questions, skipped } = questionsFromCsv(csv);
      if (!questions.length) throw new Error("题库表没有可用题目");

      originalQuestions = questions;
      activeQuestionSource = source;
      const skippedText = skipped ? `，跳过 ${skipped} 行` : "";
      updateSourceStatus(`已从题库表载入 ${questions.length} 题${skippedText}`);
      elements.startButton.disabled = false;
    } catch (error) {
      if (originalQuestions.length) {
        updateSourceStatus(`题库表读取失败，已改用内置题库 ${originalQuestions.length} 题`);
        elements.startButton.disabled = false;
      } else {
        updateSourceStatus("题库加载失败，请联系老师检查题库表。");
        elements.startButton.disabled = true;
      }
    }
  }

  function questionsFromCsv(csv) {
    const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
    if (rows.length < 2) return { questions: [], skipped: rows.length };

    const headers = rows[0].map(normalizeHeader);
    const questions = [];
    let skipped = 0;

    rows.slice(1).forEach((row, index) => {
      const record = {};
      headers.forEach((header, cellIndex) => {
        record[header] = (row[cellIndex] || "").trim();
      });

      if (isDisabledRow(getField(record, ["enabled", "enable", "启用", "是否启用", "发布"]))) return;

      const prompt = getField(record, ["prompt", "question", "title", "题干", "题目", "问题"]);
      const answer = normalizeAnswerText(getField(record, ["answer", "correct", "正确答案", "答案"]));
      const score = Number(getField(record, ["score", "points", "point", "分值", "分数"]) || 1);
      const id = getField(record, ["id", "编号", "题号"]) || `q${index + 1}`;
      const options = optionFields(record);

      if (!prompt || options.length < 2 || !answer || normalizeAnswer(answer, options) < 0) {
        skipped += 1;
        return;
      }

      questions.push({
        id,
        prompt: cleanQuestionText(prompt),
        options: options.map(cleanQuestionText),
        answer,
        score: Number.isFinite(score) && score > 0 ? score : 1
      });
    });

    return { questions, skipped };
  }

  function parseCsv(csv) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  function normalizeHeader(header) {
    return String(header || "")
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function getField(record, names) {
    for (const name of names) {
      const value = record[normalizeHeader(name)];
      if (value !== undefined && value !== "") return value;
    }
    return "";
  }

  function optionFields(record) {
    return letters
      .map((letter) => getField(record, [letter, `选项${letter}`, `option${letter}`]))
      .filter((value) => value !== "");
  }

  function isDisabledRow(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["0", "false", "no", "n", "否", "不启用", "停用", "隐藏"].includes(normalized);
  }

  function normalizeAnswerText(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/^选项/i, "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
    return /^[a-z]$/i.test(normalized) ? normalized.toUpperCase() : normalized;
  }

  function cleanQuestionText(value) {
    return escapeHtml(String(value || "").trim()).replace(/\n/g, "<br>");
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateSourceStatus(message) {
    elements.sourceStatus.textContent = message;
  }

  function startQuiz(event) {
    event.preventDefault();
    if (!originalQuestions.length) {
      updateSourceStatus("题库还没有可用题目。");
      return;
    }

    state.student = {
      name: elements.studentName.value.trim(),
      className: elements.studentClass.value.trim(),
      studentId: elements.studentId.value.trim()
    };
    state.startedAt = new Date();
    state.endedAt = null;
    state.currentIndex = 0;
    state.answers = {};
    state.submitted = false;
    state.result = null;
    state.questions = prepareQuestions(originalQuestions);

    elements.startView.hidden = true;
    elements.quizView.hidden = false;
    elements.resultView.hidden = true;
    buildNumberGrid();
    setupTimer();
    renderQuestion();
  }

  function prepareQuestions(questions) {
    const prepared = questions.map((question, questionIndex) => {
      const normalizedOptions = question.options.map((text, optionIndex) => ({
        text,
        originalIndex: optionIndex,
        originalLetter: letters[optionIndex]
      }));
      const correctIndex = normalizeAnswer(question.answer, question.options);
      const options = settings.shuffleOptions ? shuffle(normalizedOptions) : normalizedOptions;
      return {
        ...question,
        sourceIndex: questionIndex,
        score: Number(question.score || 0),
        correctIndex,
        options
      };
    });
    return settings.shuffleQuestions ? shuffle(prepared) : prepared;
  }

  function normalizeAnswer(answer, options) {
    if (typeof answer === "number") {
      return answer >= 0 && answer < options.length ? answer : answer - 1;
    }
    if (typeof answer === "string") {
      const trimmed = answer.trim().toUpperCase();
      if (/^[A-Z]$/.test(trimmed)) {
        return letters.indexOf(trimmed);
      }
      const optionIndex = options.findIndex((option) => option.trim() === answer.trim());
      if (optionIndex >= 0) return optionIndex;
    }
    return -1;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function setupTimer() {
    clearInterval(state.timerId);
    const minutes = Number(meta.timeLimitMinutes || 0);
    if (!minutes) {
      elements.timer.hidden = true;
      return;
    }

    state.deadline = Date.now() + minutes * 60 * 1000;
    elements.timer.hidden = false;
    updateTimer();
    state.timerId = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const remaining = Math.max(0, state.deadline - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    elements.timerText.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    elements.timer.classList.toggle("danger", remaining <= 60000);
    if (remaining === 0) submitQuiz(true);
  }

  function buildNumberGrid() {
    elements.numberGrid.innerHTML = "";
    state.questions.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.className = "number-button";
      button.setAttribute("aria-label", `第 ${index + 1} 题`);
      button.addEventListener("click", () => goToQuestion(index));
      elements.numberGrid.append(button);
    });
  }

  function goToQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    state.currentIndex = index;
    renderQuestion();
  }

  function renderQuestion() {
    const question = state.questions[state.currentIndex];
    const selected = state.answers[question.id];
    elements.progressText.textContent = `第 ${state.currentIndex + 1} / ${state.questions.length} 题`;
    elements.answeredText.textContent = `${Object.keys(state.answers).length} 已答`;
    elements.progressFill.style.width = `${((state.currentIndex + 1) / state.questions.length) * 100}%`;
    elements.questionBadge.textContent = "单选";
    elements.questionScore.textContent = `${question.score} 分`;
    elements.questionText.innerHTML = question.prompt;
    elements.options.innerHTML = "";

    question.options.forEach((option, visibleIndex) => {
      const label = document.createElement("label");
      label.className = "option";
      if (selected === option.originalIndex) label.classList.add("selected");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question-${question.id}`;
      input.value = String(option.originalIndex);
      input.checked = selected === option.originalIndex;
      input.addEventListener("change", () => {
        state.answers[question.id] = option.originalIndex;
        renderQuestion();
      });

      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = letters[visibleIndex];

      const text = document.createElement("span");
      text.className = "option-text";
      text.innerHTML = option.text;

      label.append(input, letter, text);
      elements.options.append(label);
    });

    elements.prevButton.disabled = state.currentIndex === 0;
    elements.nextButton.disabled = state.currentIndex === state.questions.length - 1;
    updateNumberGrid();
    typeset();
    refreshIcons();
  }

  function updateNumberGrid() {
    [...elements.numberGrid.children].forEach((button, index) => {
      const question = state.questions[index];
      button.classList.toggle("active", index === state.currentIndex);
      button.classList.toggle("answered", state.answers[question.id] !== undefined);
    });
  }

  function submitQuiz(isAutoSubmit) {
    if (state.submitted) return;
    if (!isAutoSubmit) {
      const unanswered = state.questions.length - Object.keys(state.answers).length;
      if (unanswered > 0) {
        const ok = window.confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`);
        if (!ok) return;
      }
    }

    state.submitted = true;
    state.endedAt = new Date();
    clearInterval(state.timerId);
    state.result = gradeQuiz();
    renderResult(isAutoSubmit);
    sendResult();
  }

  function gradeQuiz() {
    let earned = 0;
    let total = 0;
    let correctCount = 0;

    const items = state.questions.map((question) => {
      total += question.score;
      const selectedIndex = state.answers[question.id];
      const selectedVisibleIndex = question.options.findIndex((option) => option.originalIndex === selectedIndex);
      const correctVisibleIndex = question.options.findIndex((option) => option.originalIndex === question.correctIndex);
      const isCorrect = selectedIndex === question.correctIndex;
      if (isCorrect) {
        earned += question.score;
        correctCount += 1;
      }
      return {
        id: question.id,
        prompt: question.prompt,
        selectedIndex,
        selectedLetter: selectedIndex === undefined ? "" : letters[selectedVisibleIndex],
        correctIndex: question.correctIndex,
        correctLetter: letters[correctVisibleIndex],
        isCorrect,
        score: isCorrect ? question.score : 0,
        maxScore: question.score,
        options: question.options
      };
    });

    return {
      earned,
      total,
      percent: total ? Math.round((earned / total) * 100) : 0,
      correctCount,
      questionCount: state.questions.length,
      durationSeconds: Math.round((state.endedAt - state.startedAt) / 1000),
      items
    };
  }

  function renderResult(isAutoSubmit) {
    elements.quizView.hidden = true;
    elements.resultView.hidden = false;
    elements.scoreNumber.textContent = `${state.result.earned}`;
    elements.scoreDetail.textContent = `${state.result.total} 分满分 · ${state.result.correctCount}/${state.result.questionCount} 题正确 · ${formatDuration(state.result.durationSeconds)}`;
    elements.submitStatus.textContent = isAutoSubmit ? "时间到，已自动交卷。" : "";

    elements.reviewPanel.innerHTML = "";
    state.result.items.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = `review-item ${item.isCorrect ? "correct" : "wrong"}`;

      const title = document.createElement("div");
      title.className = "review-title";
      title.innerHTML = `<strong>${index + 1}.</strong> ${item.prompt}`;

      const meta = document.createElement("div");
      meta.className = "review-meta";
      const selected = item.selectedLetter || "未答";
      const correct = settings.showCorrectAnswers ? ` · 正确答案 ${item.correctLetter}` : "";
      meta.textContent = `${item.isCorrect ? "正确" : "错误"} · 你的答案 ${selected}${correct}`;

      article.append(title, meta);
      if (settings.showCorrectAnswers) {
        const options = document.createElement("div");
        options.className = "review-options";
        item.options.forEach((option, optionIndex) => {
          const row = document.createElement("div");
          const originalLetter = letters[option.originalIndex];
          row.className = "review-option";
          row.classList.toggle("is-answer", option.originalIndex === item.correctIndex);
          row.classList.toggle("is-selected", option.originalIndex === item.selectedIndex);
          row.innerHTML = `<span>${letters[optionIndex]}</span><span>${option.text}</span><small>原选项 ${originalLetter}</small>`;
          options.append(row);
        });
        article.append(options);
      }
      elements.reviewPanel.append(article);
    });

    typeset();
    refreshIcons();
  }

  function sendResult() {
    const endpoint = settings.submitEndpoint.trim();
    if (!endpoint) {
      elements.submitStatus.textContent = elements.submitStatus.textContent || "成绩已在本机生成。";
      return;
    }

    const payload = buildPayload();
    fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(() => {
        elements.submitStatus.textContent = "成绩已提交。";
      })
      .catch(() => {
        elements.submitStatus.textContent = "成绩提交失败，请导出结果后交给老师。";
      });
  }

  function buildPayload() {
    return {
      quizTitle: meta.title || "",
      course: meta.course || "",
      student: state.student,
      score: state.result.earned,
      total: state.result.total,
      percent: state.result.percent,
      correctCount: state.result.correctCount,
      questionCount: state.result.questionCount,
      startedAt: state.startedAt.toISOString(),
      endedAt: state.endedAt.toISOString(),
      durationSeconds: state.result.durationSeconds,
      answers: state.result.items.map((item) => ({
        id: item.id,
        selected: item.selectedLetter,
        correct: item.correctLetter,
        isCorrect: item.isCorrect,
        score: item.score,
        maxScore: item.maxScore
      }))
    };
  }

  function downloadCsv() {
    const payload = buildPayload();
    const rows = [
      ["quiz", "name", "class", "student_id", "score", "total", "percent", "correct", "questions", "started_at", "ended_at", "duration_seconds"],
      [
        payload.quizTitle,
        payload.student.name,
        payload.student.className,
        payload.student.studentId,
        payload.score,
        payload.total,
        payload.percent,
        payload.correctCount,
        payload.questionCount,
        payload.startedAt,
        payload.endedAt,
        payload.durationSeconds
      ],
      [],
      ["question_id", "selected", "correct", "is_correct", "score", "max_score"],
      ...payload.answers.map((answer) => [answer.id, answer.selected, answer.correct, answer.isCorrect ? "TRUE" : "FALSE", answer.score, answer.maxScore])
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFileName(payload.student.name || "result")}-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  function sanitizeFileName(value) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
  }

  function copySummary() {
    const payload = buildPayload();
    const text = [
      `${payload.quizTitle}`,
      `姓名：${payload.student.name}`,
      `班级：${payload.student.className || "-"}`,
      `学号：${payload.student.studentId || "-"}`,
      `成绩：${payload.score}/${payload.total}`,
      `正确：${payload.correctCount}/${payload.questionCount}`,
      `用时：${formatDuration(payload.durationSeconds)}`
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      elements.submitStatus.textContent = "摘要已复制。";
    });
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}分${String(rest).padStart(2, "0")}秒`;
  }

  function restart() {
    clearInterval(state.timerId);
    elements.resultView.hidden = true;
    elements.startView.hidden = false;
    elements.submitStatus.textContent = "";
    state.questions = [];
    state.answers = {};
    state.currentIndex = 0;
    state.submitted = false;
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("texQuizTheme", next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const isDark = document.documentElement.dataset.theme === "dark";
    elements.themeToggle.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function typeset() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
