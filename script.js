
(() => {
  "use strict";

  const STORAGE_KEY = "deadlineRescue.complete.v2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const el = {
    todayLabel: $("#todayLabel"),
    openCount: $("#openCount"),
    urgentCount: $("#urgentCount"),
    doneCount: $("#doneCount"),
    hoursLeft: $("#hoursLeft"),
    taskInput: $("#taskInput"),
    organizeBtn: $("#organizeBtn"),
    inputMessage: $("#inputMessage"),
    manualForm: $("#manualForm"),
    manualTitle: $("#manualTitle"),
    manualDate: $("#manualDate"),
    manualHours: $("#manualHours"),
    manualPriority: $("#manualPriority"),
    manualMessage: $("#manualMessage"),
    textEntry: $("#textEntry"),
    reviewSection: $("#reviewSection"),
    reviewList: $("#reviewList"),
    reviewCount: $("#reviewCount"),
    reviewTemplate: $("#reviewTemplate"),
    confirmTasksBtn: $("#confirmTasksBtn"),
    cancelReviewBtn: $("#cancelReviewBtn"),
    planSummary: $("#planSummary"),
    planList: $("#planList"),
    emptyPlan: $("#emptyPlan"),
    capacityInput: $("#capacityInput"),
    capacityWarning: $("#capacityWarning"),
    replanBtn: $("#replanBtn"),
    searchInput: $("#searchInput"),
    filterSelect: $("#filterSelect"),
    taskList: $("#taskList"),
    taskCount: $("#taskCount"),
    emptyTasks: $("#emptyTasks"),
    saveStatus: $("#saveStatus")
  };

  let tasks = [];
  let pendingTasks = [];

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function localISO(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dateFromISO(value) {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] ||
        date.getMonth() !== parts[1] - 1 ||
        date.getDate() !== parts[2]) return null;
    return date;
  }

  function daysUntil(value) {
    const target = dateFromISO(value);
    const today = dateFromISO(localISO());
    return target ? Math.round((target - today) / 86400000) : null;
  }

  function formatDate(value) {
    const date = dateFromISO(value);
    if (!date) return "No deadline";
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function message(node, text, success = false) {
    node.textContent = text;
    node.classList.toggle("success-message", success);
  }

  function priorityName(priority) {
    return priority === 3 ? "High" : priority === 1 ? "Low" : "Normal";
  }

  function cleanTitle(value) {
    return String(value)
      .replace(/\s+/g, " ")
      .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
      .trim()
      .slice(0, 100);
  }

  function parseHours(text) {
    const match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
    if (!match) return null;
    const hours = Number(match[1]);
    return hours > 0 && hours <= 100 ? hours : null;
  }

  function parsePriority(text) {
    if (/\b(urgent|high priority|critical|asap|very important)\b/i.test(text)) return 3;
    if (/\b(low priority|not urgent|can wait)\b/i.test(text)) return 1;
    return 2;
  }

  function parseDate(text) {
    const source = text.toLowerCase().replace(/,/g, " ");
    const today = dateFromISO(localISO());

    if (/\b(today|tonight)\b/.test(source)) return localISO();

    const offset =
  /\b(?:by\s+)?day after (?:tomorrow|tmr)\b/.test(source) ? 2 :
  /\b(?:by\s+)?(?:tomorrow|tmr)\b/.test(source) ? 1 :
  null;

    if (offset !== null) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return localISO(date);
    }

    const monthNames = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };
    const monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

    let match = source.match(new RegExp("\\b(" + monthPattern + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(20\\d{2}))?\\b", "i"));
    if (match) {
      const month = monthNames[match[1]] ?? monthNames[match[1].slice(0, 3)];
      const day = Number(match[2]);
      const year = Number(match[3] || today.getFullYear());
      const date = new Date(year, month, day);
      if (date.getMonth() === month && date.getDate() === day) return localISO(date);
    }

    match = source.match(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + monthPattern + ")(?:\\s+(20\\d{2}))?\\b", "i"));
    if (match) {
      const month = monthNames[match[2]] ?? monthNames[match[2].slice(0, 3)];
      const day = Number(match[1]);
      const year = Number(match[3] || today.getFullYear());
      const date = new Date(year, month, day);
      if (date.getMonth() === month && date.getDate() === day) return localISO(date);
    }

    const weekdayNames = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };

    for (const [name, weekday] of Object.entries(weekdayNames)) {
      const matchDay = new RegExp("\\b(next\\s+)?" + name + "\\b", "i").exec(source);
      if (matchDay) {
        let offset = (weekday - today.getDay() + 7) % 7;
        if (offset === 0) offset = 7;
        if (matchDay[1]) offset += 7;
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        return localISO(date);
      }
    }

    const iso = source.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) {
      const value = `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
      if (dateFromISO(value)) return value;
    }

    const numeric = source.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      const year = Number(numeric[3] || today.getFullYear());
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day);
      if (date.getMonth() === month - 1 && date.getDate() === day) return localISO(date);
    }

    return "";
  }

  function stripDateAndMetadata(text) {
    const monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

    return text
      .replace(new RegExp("\\b(?:due|by|on|deadline)\\s+(?:today|tonight|tomorrow|next\\s+\\w+|\\w+day|(?:" + monthPattern + ")\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+20\\d{2})?|\\d{1,2}\\s+(?:" + monthPattern + ")(?:\\s+20\\d{2})?|\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?|20\\d{2}-\\d{1,2}-\\d{1,2})\\b", "ig"), "")
      .replace(new RegExp("\\b(?:" + monthPattern + ")\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+20\\d{2})?\\b", "ig"), "")
      .replace(new RegExp("\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:" + monthPattern + ")(?:\\s+20\\d{2})?\\b", "ig"), "")
      .replace(/\b(today|tonight|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, "")
      .replace(/\b(?:high priority|low priority|very important|not urgent|can wait|urgent|critical|asap)\b/ig, "")
      .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)\b/ig, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitTaskText(text) {
    return text
      .replace(/\r/g, "\n")
      .replace(/[•●▪]/g, "\n")
      .replace(/^\s*(?:[-*]|\d+[.)])\s*/gm, "")
      .split(/\n+/)
      .map(part => part.trim())
      .filter(Boolean);
  }

  function parseBrainDump(text) {
    const parts = splitTaskText(text);
    const results = [];

    for (const part of parts) {
      const dueDate = parseDate(part);
      const hours = parseHours(part);
      const priority = parsePriority(part);
      let title = stripDateAndMetadata(part);

      title = title
        .replace(/\b(?:i have|i need to|i need|please add|add|my deadline is|due|by|deadline)\b/ig, "")
        .replace(/[,:;.!–—-]+$/g, "")
        .trim();

      title = cleanTitle(title);
      if (!title || title.length < 2) continue;

      results.push({
        id: makeId(),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        dueDate,
        hours,
        priority,
        progress: 0,
        done: false
      });
    }

    const seen = new Set();
    return results.filter(task => {
      const key = task.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Rule-based score: urgency + priority + workload effort.
  function scoreTask(task) {
    if (task.done) return -100;

    const days = daysUntil(task.dueDate);
    let score = task.priority * 3;

    if (days !== null) {
      if (days < 0) score += 14 + Math.min(Math.abs(days), 30);
      else if (days === 0) score += 12;
      else if (days === 1) score += 9;
      else if (days <= 3) score += 6;
      else if (days <= 7) score += 3;
      else score += 1;
    }

    if (task.hours !== null && task.hours >= 4) score += 1;
    if (task.progress > 0) score -= task.progress / 40;

    return score;
  }

  function dueLabel(task) {
    const days = daysUntil(task.dueDate);
    if (days === null) return "No deadline";
    if (days < 0) return `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due ${formatDate(task.dueDate)}`;
  }

  function isUrgent(task) {
    const days = daysUntil(task.dueDate);
    return !task.done && days !== null && days <= 2;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      el.saveStatus.textContent = "Saved on this device";
    } catch (error) {
      console.error("Could not save tasks:", error);
      el.saveStatus.textContent = "Couldn't save — check browser storage";
    }
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(data)) return;

      tasks = data.filter(task => task && typeof task.title === "string").map(task => ({
        id: task.id || makeId(),
        title: cleanTitle(task.title),
        dueDate: dateFromISO(task.dueDate) ? task.dueDate : "",
        hours: Number.isFinite(task.hours) && task.hours > 0 ? task.hours : null,
        priority: [1, 2, 3].includes(task.priority) ? task.priority : 2,
        progress: Math.min(100, Math.max(0, Number(task.progress) || 0)),
        done: Boolean(task.done)
      }));
    } catch (error) {
      console.warn("Could not read saved tasks:", error);
      tasks = [];
    }
  }

  function addTasks(items) {
    const existing = new Set(tasks.map(task => task.title.toLowerCase()));
    const fresh = items.filter(task => {
      const key = task.title.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    tasks.push(...fresh);
    save();
    renderAll();
    return fresh.length;
  }

  function switchMode(mode) {
    $$(".entry-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.mode === mode);
    });
    el.textEntry.classList.toggle("hidden", mode !== "text");
    el.manualForm.classList.toggle("hidden", mode !== "manual");
  }

  function renderReview(items) {
    pendingTasks = items;
    el.reviewList.innerHTML = "";
    el.reviewCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

    items.forEach((task, index) => {
      const fragment = el.reviewTemplate.content.cloneNode(true);
      const card = $(".review-card", fragment);

      $(".review-number", card).textContent = `TASK ${String(index + 1).padStart(2, "0")}`;
      $(".review-title", card).value = task.title;
      $(".review-date", card).value = task.dueDate || "";
      $(".review-date", card).min = localISO();
      $(".review-hours", card).value = task.hours ?? "";
      $(".review-priority", card).value = String(task.priority || 2);

      const warnings = [];
      if (!task.dueDate) warnings.push("No deadline detected; add one if you know it.");
      if (task.hours === null) warnings.push("No time estimate; this is optional.");
      $(".review-warning", card).textContent = warnings.join(" ");

      $(".remove-review", card).addEventListener("click", () => {
        const cards = $$(".review-card", el.reviewList);
        const currentIndex = cards.indexOf(card);
        pendingTasks.splice(currentIndex, 1);
        renderReview(pendingTasks);
        if (!pendingTasks.length) el.reviewSection.classList.add("hidden");
      });

      el.reviewList.appendChild(fragment);
    });

    el.reviewSection.classList.remove("hidden");
    el.reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function confirmReview() {
    const cards = $$(".review-card", el.reviewList);
    const items = [];

    for (const card of cards) {
      const title = cleanTitle($(".review-title", card).value);
      const rawHours = $(".review-hours", card).value.trim();
      const hours = rawHours === "" ? null : Number(rawHours);

      if (!title) {
        message(el.inputMessage, "Each task needs a name, or remove that task.");
        $(".review-title", card).focus();
        return;
      }

      if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 100)) {
        message(el.inputMessage, "Enter hours from 0.25 to 100, or leave the estimate blank.");
        $(".review-hours", card).focus();
        return;
      }

      items.push({
        id: makeId(),
        title,
        dueDate: $(".review-date", card).value,
        hours,
        priority: Number($(".review-priority", card).value) || 2,
        progress: 0,
        done: false
      });
    }

    if (!items.length) return;

    const count = addTasks(items);
    el.reviewSection.classList.add("hidden");
    el.taskInput.value = "";

    message(
      el.inputMessage,
      count ? `${count} task${count === 1 ? "" : "s"} added to your dashboard.` : "Those tasks are already on your dashboard.",
      Boolean(count)
    );
  }

  function submitManual(event) {
    event.preventDefault();

    const title = cleanTitle(el.manualTitle.value);
    const date = el.manualDate.value;
    const rawHours = el.manualHours.value.trim();
    const hours = rawHours === "" ? null : Number(rawHours);
    const priority = Number(el.manualPriority.value);

    if (!title) {
      message(el.manualMessage, "Please enter a task name.");
      el.manualTitle.focus();
      return;
    }

    if (date && !dateFromISO(date)) {
      message(el.manualMessage, "Please choose a valid deadline.");
      return;
    }

    if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 100)) {
      message(el.manualMessage, "Hours must be between 0.25 and 100, or leave it blank.");
      el.manualHours.focus();
      return;
    }

    const count = addTasks([{
      id: makeId(),
      title,
      dueDate: date,
      hours,
      priority: [1, 2, 3].includes(priority) ? priority : 2,
      progress: 0,
      done: false
    }]);

    if (!count) {
      message(el.manualMessage, "A task with that name already exists.");
      return;
    }

    el.manualForm.reset();
    el.manualPriority.value = "2";
    message(el.manualMessage, "Task added! Your workload plan has been updated.", true);
  }

  function renderPlan() {
    const open = tasks.filter(task => !task.done).sort((a, b) => scoreTask(b) - scoreTask(a));
    const totalHours = open.reduce((sum, task) => sum + (task.hours || 0), 0);
    const urgent = open.filter(isUrgent).length;
    const capacity = Math.max(0.5, Math.min(24, Number(el.capacityInput.value) || 4));

    el.openCount.textContent = open.length;
    el.urgentCount.textContent = urgent;
    el.doneCount.textContent = tasks.filter(task => task.done).length;
    el.hoursLeft.textContent = `${Math.round(totalHours * 10) / 10}h`;

    el.planSummary.textContent = open.length
      ? `${open.length} open task${open.length === 1 ? "" : "s"} · ${urgent} need${urgent === 1 ? "s" : ""} attention. Start with the highest-scoring task, then reassess.`
      : "You're all caught up. Take a breath — you've earned it.";

    el.planList.innerHTML = "";
    let plannedHours = 0;
    const planned = [];

    for (const task of open) {
      const duration = task.hours || 1;

      if (planned.length && plannedHours + duration > capacity) continue;
      if (!planned.length && duration > capacity) {
        planned.push(task);
        plannedHours += duration;
        break;
      }

      planned.push(task);
      plannedHours += duration;
      if (planned.length >= 5 || plannedHours >= capacity) break;
    }

    planned.forEach((task, index) => {
      const item = document.createElement("article");
      item.className = "plan-item";
      item.innerHTML = `
        <span class="plan-index">${index + 1}</span>
        <div>
          <h4>${escapeHTML(task.title)}</h4>
          <p>${escapeHTML(dueLabel(task))} · ${task.hours ? `${task.hours}h estimate` : "Estimate missing; using 1h for today's plan"}</p>
          <div class="plan-meta">
            <span class="mini-tag">${priorityName(task.priority)} priority</span>
            <span class="mini-tag">${task.progress}% complete</span>
          </div>
        </div>
      `;
      el.planList.appendChild(item);
    });

    el.emptyPlan.classList.toggle("hidden", planned.length > 0);

    const beyondCapacity = open.filter(task => task.hours !== null).reduce((sum, task) => sum + task.hours, 0);
    const warning = open.length && (beyondCapacity > capacity || open.some(task => {
      const days = daysUntil(task.dueDate);
      return days !== null && days <= 2 && !task.done;
    }));

    el.capacityWarning.classList.toggle("hidden", !warning);
    if (warning) {
      el.capacityWarning.textContent = beyondCapacity > capacity
        ? `Your estimated open workload is ${Math.round(beyondCapacity * 10) / 10} hours, above today's ${capacity}-hour capacity. This plan shows only a starting set of tasks.`
        : "Some deadlines are close. Review the urgent tasks and adjust your available hours if needed.";
    }
  }
function renderTasks() {
  const search = el.searchInput.value.trim().toLowerCase();
  const filter = el.filterSelect.value;

  const filtered = [...tasks]
    .sort((a, b) => Number(a.done) - Number(b.done) || scoreTask(b) - scoreTask(a))
    .filter(task => {
      if (search && !task.title.toLowerCase().includes(search)) return false;
      if (filter === "open" && task.done) return false;
      if (filter === "done" && !task.done) return false;
      if (filter === "urgent" && !isUrgent(task)) return false;
      return true;
    });

  el.taskList.innerHTML = "";
  el.taskCount.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  filtered.forEach(task => {
    const card = document.createElement("article");
    card.className = `task-card${task.done ? " is-done" : ""}`;

    const days = daysUntil(task.dueDate);
    const dueClass = !task.done && days !== null && days < 0
      ? "tag-overdue"
      : !task.done && days !== null && days <= 2
        ? "tag-soon"
        : "tag-date";

    card.innerHTML = `
      <div class="task-card-top">
        <input
          class="task-check"
          type="checkbox"
          aria-label="Mark task complete"
          ${task.done ? "checked" : ""}
        >

        <div class="task-main">
          <p class="task-title">${escapeHTML(task.title)}</p>
          <p class="task-subtitle">
            ${task.hours ? `${task.hours}h estimated` : "No time estimate"}
            · ${escapeHTML(formatDate(task.dueDate))}
          </p>
        </div>

        <div class="task-actions">
          <button
            type="button"
            class="task-edit"
            aria-label="Edit task"
            title="Edit task"
          >✎ Edit</button>

          <button
            type="button"
            class="task-delete"
            aria-label="Delete task"
            title="Delete task"
          >×</button>
        </div>
      </div>

      <div class="task-tags">
        <span class="tag ${
          task.priority === 3
            ? "tag-high"
            : task.priority === 1
              ? "tag-low"
              : "tag-normal"
        }">${priorityName(task.priority)} priority</span>

        <span class="tag ${dueClass}">
          ${escapeHTML(dueLabel(task))}
        </span>
      </div>

      <div class="task-progress">
        <span style="width:${task.done ? 100 : task.progress}%"></span>
      </div>

      <div class="task-progress-controls">
        <label>
          Progress:
          <strong>${task.done ? 100 : task.progress}%</strong>
        </label>

        <input
          type="range"
          min="0"
          max="100"
          step="10"
          value="${task.done ? 100 : task.progress}"
          aria-label="Task progress"
          ${task.done ? "disabled" : ""}
        >
      </div>
    `;

    // Edit task
    $(".task-edit", card).addEventListener("click", () => {
      const title = prompt("Edit task name:", task.title);
      if (title === null) return;

      const newTitle = cleanTitle(title);
      if (!newTitle) {
        alert("Task name cannot be empty.");
        return;
      }

      const dueDate = prompt(
        "Edit deadline (YYYY-MM-DD, or leave blank):",
        task.dueDate || ""
      );
      if (dueDate === null) return;

      const normalizedDate = dueDate.trim();

      if (normalizedDate && !dateFromISO(normalizedDate)) {
        alert("Enter a valid date in YYYY-MM-DD format.");
        return;
      }

      const hours = prompt(
        "Edit estimated hours (leave blank if unknown):",
        task.hours ?? ""
      );
      if (hours === null) return;

      const normalizedHours = hours.trim();
      const parsedHours = normalizedHours === ""
        ? null
        : Number(normalizedHours);

      if (
        parsedHours !== null &&
        (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 100)
      ) {
        alert("Enter hours greater than 0 and up to 100, or leave blank.");
        return;
      }

      const priority = prompt(
        "Priority: 3 = High, 2 = Normal, 1 = Low",
        String(task.priority ?? 2)
      );
      if (priority === null) return;

      const parsedPriority = Number(priority);

      if (![1, 2, 3].includes(parsedPriority)) {
        alert("Priority must be 1, 2, or 3.");
        return;
      }

      task.title = newTitle;
      task.dueDate = normalizedDate;
      task.hours = parsedHours;
      task.priority = parsedPriority;

      save();
      renderAll();
    });

    // Mark task complete or reopen it
    $(".task-check", card).addEventListener("change", event => {
      task.done = event.target.checked;
      task.progress = task.done ? 100 : 0;
      save();
      renderAll();
    });

    // Delete task
    $(".task-delete", card).addEventListener("click", () => {
      if (!confirm(`Delete "${task.title}"?`)) return;

      tasks = tasks.filter(item => item.id !== task.id);
      save();
      renderAll();
    });

    // Update progress immediately while moving the slider
    const range = $('input[type="range"]', card);

    range.addEventListener("input", () => {
      task.progress = Number(range.value);
      $(".task-progress span", card).style.width = `${task.progress}%`;
      $(".task-progress-controls strong", card).textContent =
        `${task.progress}%`;
    });

    // Save progress
    range.addEventListener("change", () => {
      if (task.progress === 100) {
        task.done = true;
      } else {
        task.done = false;
      }

      save();
      renderAll();
    });

    el.taskList.appendChild(card);
  });

  el.emptyTasks.classList.toggle("hidden", filtered.length > 0);

  if (!filtered.length) {
    $("p", el.emptyTasks).textContent = tasks.length
      ? "No tasks match your search or filter."
      : "Your tasks will appear here once you add them.";
  }
}

  function renderAll() {
    el.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short"
    });
    renderPlan();
    renderTasks();
  }

  
function handleReorganizationRequest(text) {
  const source = text.toLowerCase();

  const isReorganization = /\b(reorganize|re-organize|replan|re-plan|reschedule|remaining tasks|unfinished tasks|pending tasks|couldn't finish|could not finish|didn't finish|did not finish|not finished|ran out of time|move .* to tomorrow|update my plan|update my schedule)\b/i.test(source);

  if (!isReorganization) return false;

  const wordsToIgnore = new Set([
    "i", "me", "my", "the", "a", "an", "to", "for", "of", "on",
    "in", "at", "and", "or", "today", "tonight", "tomorrow",
    "couldnt", "couldn't", "could", "not", "finish", "finished",
    "didnt", "didn't", "did", "have", "has", "help", "please",
    "reorganize", "re-organize", "replan", "re-plan", "reschedule",
    "remaining", "unfinished", "pending", "tasks", "task", "my",
    "schedule", "plan", "update", "work"
  ]);

  const getKeywords = value =>
    value.toLowerCase()
      .replace(/couldn't/g, "couldnt")
      .replace(/didn't/g, "didnt")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(word => word && !wordsToIgnore.has(word));

  const requestWords = new Set(getKeywords(source));
  const openTasks = tasks.filter(task => !task.done);

  // Try to find the task mentioned in the user's sentence.
  const matches = openTasks.map(task => {
    const titleWords = getKeywords(task.title);
    const overlap = titleWords.filter(word => requestWords.has(word)).length;
    return { task, overlap, titleLength: titleWords.length };
  }).filter(item =>
    item.overlap > 0 &&
    (item.overlap >= item.titleLength || item.overlap >= 2)
  ).sort((a, b) => b.overlap - a.overlap);

  // If the sentence identifies one clear task, keep it pending.
  if (
    matches.length > 0 &&
    (matches.length === 1 || matches[0].overlap > matches[1].overlap)
  ) {
    const task = matches[0].task;

    // Don't invent a new deadline or erase existing progress.
    task.done = false;

    save();
    renderAll();

    message(
      el.inputMessage,
      `Got it — "${task.title}" is still pending. I've refreshed your plan using its existing deadline and priority. Edit its deadline if it needs to change.`,
      true
    );
    return true;
  }

  // General requests can refresh the plan without changing task details.
  if (
    /\b(reorganize|re-organize|replan|re-plan|reschedule|remaining tasks|unfinished tasks|pending tasks|update my plan|update my schedule)\b/i.test(source)
  ) {
    renderAll();

    message(
      el.inputMessage,
      "I've refreshed your plan using your current unfinished tasks, deadlines and priorities. If a deadline changed, edit that task to update it.",
      true
    );
    return true;
  }

  message(
    el.inputMessage,
    "I understand that something wasn't finished, but I couldn't confidently match it to a task. Try mentioning its task title exactly as it appears on your dashboard."
  );
  return true;
}

  
function organize() {
  const text = el.taskInput.value.trim();
  message(el.inputMessage, "");

  if (!text) {
    message(
      el.inputMessage,
      "Write whatever is on your mind. It doesn't need to be perfectly organized."
    );
    el.taskInput.focus();
    return;
  }

  // First check whether the user wants to update or reorganize existing work.
  if (handleReorganizationRequest(text)) {
    el.taskInput.value = "";
    return;
  }

  // Otherwise, continue with the existing task-adding workflow.
  const items = parseBrainDump(text);

  if (!items.length) {
    message(
      el.inputMessage,
      "I couldn't identify a task. Try mentioning an assignment, project, lab, exam or report."
    );
    return;
  }

  renderReview(items);
}

  function bindEvents() {
    $$(".entry-tab").forEach(tab => {
      tab.addEventListener("click", () => switchMode(tab.dataset.mode));
    });

    $$(".prompt-chip").forEach(button => {
      button.addEventListener("click", () => {
        el.taskInput.value = button.dataset.prompt || "";
        el.taskInput.focus();
      });
    });

    el.organizeBtn.addEventListener("click", organize);
    el.taskInput.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") organize();
    });

    el.manualForm.addEventListener("submit", submitManual);
    el.confirmTasksBtn.addEventListener("click", confirmReview);

    el.cancelReviewBtn.addEventListener("click", () => {
      el.reviewSection.classList.add("hidden");
      pendingTasks = [];
    });

    el.searchInput.addEventListener("input", renderTasks);
    el.filterSelect.addEventListener("change", renderTasks);
    el.capacityInput.addEventListener("input", renderPlan);
    el.replanBtn.addEventListener("click", renderAll);
  }

  load();
  bindEvents();
  renderAll();
})();