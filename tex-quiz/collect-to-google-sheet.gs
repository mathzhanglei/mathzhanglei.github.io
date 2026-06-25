function doPost(e) {
  const sheet = getResultSheet_();
  const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

  sheet.appendRow([
    new Date(),
    data.quizTitle || "",
    data.course || "",
    data.student && data.student.name || "",
    data.student && data.student.className || "",
    data.student && data.student.studentId || "",
    data.score || 0,
    data.total || 0,
    data.percent || 0,
    data.correctCount || 0,
    data.questionCount || 0,
    data.startedAt || "",
    data.endedAt || "",
    data.durationSeconds || 0,
    JSON.stringify(data.answers || [])
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getResultSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Results";
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "submitted_at",
      "quiz",
      "course",
      "name",
      "class",
      "student_id",
      "score",
      "total",
      "percent",
      "correct",
      "questions",
      "started_at",
      "ended_at",
      "duration_seconds",
      "answers_json"
    ]);
  }

  return sheet;
}
