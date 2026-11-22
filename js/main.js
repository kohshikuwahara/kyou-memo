const STORAGE_KEY = "kyou-memo";
let records = [];

const ATTEND_OPTIONS = ["行けた", "遅刻", "別室", "早退", "休み"];
const ATTEND_COLORS = ["#9fd4b6", "#f5d97a", "#a9c9ef", "#f5bd8a", "#e6b3b3"];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 配列からボタン（ラジオボタン）を作る
function makeAttendChoices() {
  const html = [];
  for (let i = 0; i < ATTEND_OPTIONS.length; i++) {
    html.push(`<label><input type="radio" name="attend" value="${ATTEND_OPTIONS[i]}">${ATTEND_OPTIONS[i]}</label>`);
  }
  $("#attend-choices").html(html.join(""));
}

// ① 読み出す（JSON → 配列）
if (localStorage.getItem(STORAGE_KEY)) {
  records = JSON.parse(localStorage.getItem(STORAGE_KEY));
}

// 色の見本（凡例）
function renderLegend() {
  const html = [];
  for (let j = 0; j < ATTEND_OPTIONS.length; j++) {
    html.push(`<span class="legend-item"><span class="legend-color" style="background: ${ATTEND_COLORS[j]};"></span>${ATTEND_OPTIONS[j]}</span>`);
  }
  $("#legend").html(html.join(""));
}

// 積み上げ棒を作る（曜日別でも週別でも使い回す）
// groups の中身：[{ label: "月", counts: [行けた, 遅刻, 別室, 早退, 休み], total: 合計 }, ...]
function makeStackedBars(groups) {
  // 一番多いグループの日数を、棒の長さの基準にする
  let max = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].total > max) {
      max = groups[i].total;
    }
  }

  const html = [];
  for (let i = 0; i < groups.length; i++) {
    const segments = [];
    for (let j = 0; j < ATTEND_OPTIONS.length; j++) {
      if (groups[i].counts[j] > 0) {
        const percent = (groups[i].counts[j] / max) * 100;
        segments.push(`<div class="seg" style="width: ${percent}%; background: ${ATTEND_COLORS[j]};"></div>`);
      }
    }
    html.push(`
      <div class="bar-row">
        <span class="bar-label">${groups[i].label}</span>
        <div class="bar-bg">${segments.join("")}</div>
        <span class="bar-count">${groups[i].total}日</span>
      </div>
    `);
  }
  return html.join("");
}

// 曜日別グラフ
function renderWeekdayChart() {
  // 月〜金の5つの箱を用意する
  const groups = [];
  for (let d = 1; d <= 5; d++) {
    groups.push({ label: WEEKDAYS[d], counts: [0, 0, 0, 0, 0], total: 0 });
  }

  for (let i = 0; i < records.length; i++) {
    const day = new Date(records[i].date + "T00:00:00").getDay(); // 0=日〜6=土
    const j = ATTEND_OPTIONS.indexOf(records[i].attend);          // 何番目の選択肢か
    if (day >= 1 && day <= 5 && j !== -1) {
      groups[day - 1].counts[j]++;
      groups[day - 1].total++;
    }
  }
  $("#weekday-chart").html(makeStackedBars(groups));
}

// 週ごとの推移グラフ
function renderWeeklyChart() {
  const groups = [];

  for (let i = 0; i < records.length; i++) {
    const j = ATTEND_OPTIONS.indexOf(records[i].attend);
    if (j !== -1) {
      // その週の月曜日を出す
      const start = new Date(records[i].date + "T00:00:00");
      const diff = (start.getDay() + 6) % 7; // 月曜から何日たっているか
      start.setDate(start.getDate() - diff);
      const label = `${start.getMonth() + 1}/${start.getDate()}〜`;

      // 同じ週の箱を探す（なければ作る）
      let found = -1;
      for (let k = 0; k < groups.length; k++) {
        if (groups[k].label === label) {
          found = k;
        }
      }
      if (found === -1) {
        groups.push({ label: label, time: start.getTime(), counts: [0, 0, 0, 0, 0], total: 0 });
        found = groups.length - 1;
      }
      groups[found].counts[j]++;
      groups[found].total++;
    }
  }

  // 古い週 → 新しい週の順に並べ、最後の8週だけ出す
  groups.sort(function (a, b) {
    return a.time - b.time;
  });
  $("#weekly-chart").html(makeStackedBars(groups.slice(-8)));
}

// ② 一覧を表示する
function render() {
  const html = [];
  for (let i = 0; i < records.length; i++) {
    html.push(`<p>${records[i].date}【${records[i].attend || "未選択"}】${records[i].memo} <button class="delete-btn" data-index="${i}">削除</button></p>`);
  }
  $("#list").html(html.join(""));

  renderWeekdayChart();   // ← 追加
  renderWeeklyChart();    // ← 追加
}


// ③ 保存する（配列 → JSON）
$("#save-btn").on("click", function () {
  const record = {
    date: $("#date").val(),
    attend: $("input[name='attend']:checked").val() || "",
    memo: $("#memo").val(),
  };

  // 日付が空なら保存しない
  if (record.date === "") {
    return;
  }

  // 同じ日付の記録があるか探す
  let found = -1;
  for (let i = 0; i < records.length; i++) {
    if (records[i].date === record.date) {
      found = i;
    }
  }

  if (found === -1) {
    records.push(record);     // なければ追加
  } else {
    records[found] = record;  // あれば上書き
  }

  // 日付の新しい順に並べる
  records.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();

  // 入力欄を空に戻す
  $("#memo").val("");
  $("input[name='attend']").prop("checked", false);
});

// ④ 1件だけ消す
$("#list").on("click", ".delete-btn", function () {
  const index = $(this).data("index");
  records.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
});

// ⑤ 全部消す
$("#clear-btn").on("click", function () {
  localStorage.removeItem(STORAGE_KEY);
  records = [];
  render();
});

makeAttendChoices();
renderLegend();   // ← 追加
render();
