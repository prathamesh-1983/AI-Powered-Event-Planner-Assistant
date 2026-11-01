const STORAGE_KEY = "eventgenie-planner-v1";
const currencySymbols = { USD: "$", INR: "₹" };
const categoryColors = {
  Venue: "#a78bfa",
  Catering: "#f472b6",
  Decor: "#70c4ec",
  Photography: "#f5bb70",
  Miscellaneous: "#63dbb2",
  Other: "#9da4b8",
};
const expenseIcons = {
  Venue: "fa-building",
  Catering: "fa-utensils",
  Decor: "fa-wand-magic-sparkles",
  Photography: "fa-camera",
  Miscellaneous: "fa-ellipsis",
  Other: "fa-receipt",
};
const vendorDefaults = [
  { category: "Venue", description: "Space, date & capacity", icon: "fa-building", status: "Not contacted", estimate: 7200, actual: 0 },
  { category: "Caterer", description: "Menu, tasting & service", icon: "fa-utensils", status: "Not contacted", estimate: 5400, actual: 0 },
  { category: "Makeup artist", description: "Trial & day-of styling", icon: "fa-wand-magic-sparkles", status: "Not contacted", estimate: 750, actual: 0 },
  { category: "DJ / Music", description: "Sound, playlist & setup", icon: "fa-music", status: "Not contacted", estimate: 900, actual: 0 },
  { category: "Decorator", description: "Florals, stage & lighting", icon: "fa-palette", status: "Not contacted", estimate: 2200, actual: 0 },
];
const seedPlan = {
  event: {
    name: "Meera & Arjun’s Celebration",
    type: "Wedding",
    date: daysFromToday(92),
    guests: 120,
    budget: 24000,
    currency: "USD",
    vibe: "Modern Minimalist",
    preferences: "A warm, intimate evening with vegetarian options.",
    theme: "An evening under the stars",
  },
  expenses: [
    { id: "exp-venue", name: "Garden venue & lighting", category: "Venue", amount: 9200 },
    { id: "exp-catering", name: "Seasonal dinner & drinks", category: "Catering", amount: 6800 },
    { id: "exp-decor", name: "Florals & table styling", category: "Decor", amount: 3400 },
    { id: "exp-photo", name: "Photo & film coverage", category: "Photography", amount: 2400 },
    { id: "exp-misc", name: "Invites, transport & extras", category: "Miscellaneous", amount: 1000 },
  ],
  tasks: [
    { id: "task-venue", title: "Shortlist and tour three venues", phase: "6 months out", priority: "High", done: true },
    { id: "task-style", title: "Decide on your celebration style", phase: "6 months out", priority: "Medium", done: false },
    { id: "task-caterer", title: "Book your caterer and confirm tasting", phase: "3 months out", priority: "High", done: false },
    { id: "task-invites", title: "Send invitations and collect RSVPs", phase: "1 month out", priority: "Medium", done: false },
    { id: "task-final", title: "Share the final run-of-show with vendors", phase: "Day of", priority: "High", done: false },
  ],
  vendors: copy(vendorDefaults),
  recommendations: [
    { title: "Make the guest experience feel personal", body: "A handwritten welcome note and a small seasonal favor can make a lovely first impression without stretching your budget." },
    { title: "Build in a little breathing room", body: "Keep a 5% contingency for last-minute rentals, transport, or weather changes." },
    { title: "Book your venue before the extras", body: "Confirm date, capacity, and what’s included before committing to decor or rentals." },
  ],
  chat: [],
};
const views = {
  dashboard: "Overview",
  wizard: "Event wizard",
  budget: "Budget planner",
  timeline: "Timeline",
  vendors: "Vendor checklist",
  assistant: "EventCopilot",
};

let state = loadState();
let activeView = "dashboard";
let wizardStep = 1;
let wizardDraft = null;
let recommendationIndex = 0;
let searchTerm = "";
let apiStatus = { available: false, configured: false };

const appView = document.querySelector("#app-view");
const sidebar = document.querySelector("#sidebar");

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
document.addEventListener("keydown", handleChatKeydown);
document.querySelector("#global-search").addEventListener("keydown", handleSearchKeydown);
document.querySelector("#mobile-menu").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelector("#notifications-button").addEventListener("click", () => {
  document.querySelector("#notification-panel").classList.toggle("hidden");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#global-search").focus();
  }
  if (event.key === "Escape") {
    document.querySelector("#notification-panel").classList.add("hidden");
    document.querySelector("#modal-root").innerHTML = "";
    sidebar.classList.remove("open");
  }
});

render();
checkApiStatus();

function handleClick(event) {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    navigate(nav.dataset.view);
    return;
  }

  const taskButton = event.target.closest("[data-toggle-task]");
  if (taskButton) {
    const task = state.tasks.find((item) => item.id === taskButton.dataset.toggleTask);
    if (task) {
      task.done = !task.done;
      persist();
      render();
    }
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  switch (action.dataset.action) {
    case "wizard-next":
      if (validateWizardStep()) {
        wizardStep = Math.min(3, wizardStep + 1);
        render();
      }
      break;
    case "wizard-back":
      wizardStep = Math.max(1, wizardStep - 1);
      render();
      break;
    case "generate-blueprint":
      generateBlueprint();
      break;
    case "add-expense":
      openExpenseModal();
      break;
    case "save-expense": {
      const form = document.querySelector("#expense-form");
      if (form?.reportValidity()) saveExpense(new FormData(form));
      break;
    }
    case "recommendation-previous":
      recommendationIndex = (recommendationIndex - 1 + state.recommendations.length) % state.recommendations.length;
      render();
      break;
    case "recommendation-next":
      recommendationIndex = (recommendationIndex + 1) % state.recommendations.length;
      render();
      break;
    case "edit-expense":
      openExpenseModal(action.dataset.id);
      break;
    case "delete-expense":
      deleteExpense(action.dataset.id);
      break;
    case "add-task":
      openTaskModal();
      break;
    case "save-task": {
      const form = document.querySelector("#task-form");
      if (form?.reportValidity()) saveTask(new FormData(form));
      break;
    }
    case "add-recommendation":
      navigate("wizard");
      break;
    case "send-chat":
      sendChatMessage();
      break;
    case "clear-chat":
      state.chat = [];
      persist();
      render();
      toast("Chat history cleared.");
      break;
    case "chat-suggestion":
      sendChatMessage(action.dataset.prompt);
      break;
    case "close-modal":
      document.querySelector("#modal-root").innerHTML = "";
      break;
    case "reset-plan":
      if (window.confirm("Restore the example event plan? This replaces the plan saved on this device.")) {
        state = copy(seedPlan);
        recommendationIndex = 0;
        persist();
        navigate("dashboard");
        toast("Example plan restored.");
      }
      break;
  }
}

function handleInput(event) {
  if (event.target.id === "guest-count") {
    const output = document.querySelector("#guest-count-value");
    if (output) output.textContent = Number(event.target.value).toLocaleString();
    updateWizardPreview();
  }
  if (event.target.closest("#wizard-form")) updateWizardPreview();
  if (event.target.id === "global-search") {
    searchTerm = event.target.value.trim();
    if (activeView === "dashboard") render();
  }
}

function handleChange(event) {
  const field = event.target.dataset;
  if (field.vendorField) {
    const vendor = state.vendors.find((item) => item.category === field.vendorCategory);
    if (!vendor) return;
    if (field.vendorField === "status") vendor.status = event.target.value;
    else vendor[field.vendorField] = Math.max(0, Number(event.target.value) || 0);
    persist();
    render();
  }
  if (event.target.id === "currency-select") updateWizardPreview();
}

function handleSubmit(event) {
  event.preventDefault();
  if (event.target.matches("#expense-form")) saveExpense(new FormData(event.target));
  if (event.target.matches("#task-form")) saveTask(new FormData(event.target));
  if (event.target.matches("#chat-form")) sendChatMessage();
}

function handleChatKeydown(event) {
  if (event.target.id === "chat-input" && event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
  if (event.target.id === "chat-form") sendChatMessage();
}

function handleSearchKeydown(event) {
  if (event.key !== "Enter") return;
  const term = event.target.value.trim();
  if (!term) return;
  searchTerm = term;
  navigate("dashboard");
  event.target.blur();
}

function navigate(view) {
  if (!(view in views)) return;
  activeView = view;
  if (view === "wizard") {
    wizardDraft = wizardDraft || copy(state.event);
    wizardStep = 1;
  }
  sidebar.classList.remove("open");
  document.querySelector("#notification-panel").classList.add("hidden");
  render();
  appView.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === activeView);
  });
  document.querySelector("#view-breadcrumb").textContent = views[activeView];
  document.querySelector("#task-nav-count").textContent = state.tasks.filter((task) => !task.done).length;
  const renderers = {
    dashboard: renderDashboard,
    wizard: renderWizard,
    budget: renderBudget,
    timeline: renderTimeline,
    vendors: renderVendors,
    assistant: renderAssistant,
  };
  appView.innerHTML = renderers[activeView]();
  if (activeView === "wizard") syncWizardForm();
  if (activeView === "assistant") scrollChatToBottom();
}

function renderDashboard() {
  const total = state.event.budget;
  const allocated = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = total - allocated;
  const complete = completionPercent();
  const days = daysUntil(state.event.date);
  const upcoming = state.tasks.filter((task) => !task.done).slice(0, 3);
  const searchResults = searchTerm ? findResults(searchTerm) : [];
  const categoryTotals = getCategoryTotals();
  const recommendation = state.recommendations[recommendationIndex % state.recommendations.length]
    || seedPlan.recommendations[0];
  const recommendationTitle = recommendation.title === "A little planning idea"
    ? `Planning idea ${recommendationIndex + 1}`
    : recommendation.title;
  return `
    ${searchTerm ? renderSearchResults(searchResults) : ""}
    <section class="page-heading">
      <div><div class="eyebrow">YOUR CELEBRATION, AT A GLANCE</div><h1>Good ${greeting()}, planner <span aria-hidden="true">✦</span></h1>
      <p>Your big day is coming together. Here’s the little bit of magic happening behind the scenes.</p></div>
      <div class="heading-actions"><button class="btn" data-view="budget"><i class="fa-solid fa-arrow-trend-up"></i> Budget details</button><button class="btn btn-primary" data-view="wizard"><i class="fa-solid fa-wand-magic-sparkles"></i> Plan with AI</button></div>
    </section>
    <section class="metric-grid">
      ${metricCard("Total budget", formatMoney(total), "Your celebration budget", "fa-wallet", "#a78bfa")}
      ${metricCard("Allocated", formatMoney(allocated), `${total ? Math.round((allocated / total) * 100) : 0}% of your total budget`, "fa-chart-pie", "#70c4ec")}
      ${metricCard("Remaining", formatMoney(remaining), remaining >= 0 ? "You’re on track with your budget" : "Over budget — review your expenses", "fa-sack-dollar", remaining >= 0 ? "#63dbb2" : "#f472b6")}
      ${metricCard("Planning progress", `${complete}%`, `${state.tasks.filter((task) => task.done).length} of ${state.tasks.length} milestones complete`, "fa-list-check", "#f5bb70")}
    </section>
    <section class="dashboard-grid">
      <article class="event-hero">
        <div class="event-hero-top"><i class="fa-solid fa-sparkles"></i> YOUR NEXT BIG MOMENT <span class="status-badge">SAVED LOCALLY</span></div>
        <h2>${escapeHtml(state.event.name)}</h2><p>${escapeHtml(state.event.theme || `A ${state.event.vibe.toLowerCase()} celebration, thoughtfully planned around your people.`)}</p>
        <div class="event-facts"><span><i class="fa-regular fa-calendar"></i>${escapeHtml(formatDate(state.event.date))}</span><span><i class="fa-solid fa-users"></i>${Number(state.event.guests).toLocaleString()} guests</span><span><i class="fa-solid fa-wand-magic-sparkles"></i>${escapeHtml(state.event.vibe)}</span></div>
      </article>
      <article class="panel-card countdown-card"><i class="fa-regular fa-hourglass-half countdown-icon"></i><div class="countdown-number">${days >= 0 ? days : 0}<small>days to go</small></div><div class="countdown-caption">${days < 0 ? "Your event date has passed" : "Every little detail is coming together."}</div><div class="countdown-date">${escapeHtml(formatDate(state.event.date, { month: "long", day: "numeric", year: "numeric" }))}</div></article>
    </section>
    <section class="dashboard-grid">
      <article class="panel-card">
        <div class="panel-head"><div><h2>Budget at a glance</h2><p>Where your celebration budget is going</p></div><button class="btn btn-subtle" data-view="budget">View plan <i class="fa-solid fa-arrow-right"></i></button></div>
        <div class="budget-layout"><div class="donut" style="${donutStyle(categoryTotals, total)}"><div class="donut-center"><strong>${total ? Math.round((allocated / total) * 100) : 0}%</strong><span>allocated</span></div></div><div class="legend-list">${renderLegend(categoryTotals, total)}</div></div>
      </article>
      <article class="panel-card">
        <div class="panel-head"><div><h2>Planning progress</h2><p>You’re making lovely progress</p></div><strong class="tiny-label">${complete}%</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${complete}%"></div></div><div class="progress-row"><span>Milestones completed</span><strong>${state.tasks.filter((task) => task.done).length} / ${state.tasks.length}</strong></div>
        <div class="task-list">${upcoming.length ? upcoming.map((task) => renderTask(task)).join("") : '<div class="empty-state">All caught up — beautifully done!</div>'}</div>
        <button class="btn" style="width:100%;margin-top:11px" data-view="timeline">Open timeline <i class="fa-solid fa-arrow-right"></i></button>
      </article>
    </section>
    <section class="dashboard-grid">
      <article class="panel-card"><div class="panel-head"><div><h2>Your next little wins</h2><p>Small thoughtful touches, made for your event</p></div><div style="display:flex;align-items:center;gap:4px"><span class="tiny-label">${recommendationIndex + 1} / ${state.recommendations.length}</span><button class="icon-button" data-action="recommendation-previous" aria-label="Previous recommendation"><i class="fa-solid fa-chevron-left"></i></button><button class="icon-button" data-action="recommendation-next" aria-label="Next recommendation"><i class="fa-solid fa-chevron-right"></i></button><button class="icon-button" data-view="assistant" aria-label="Ask EventCopilot"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></div></div>
        <div class="recommendation-card"><i class="fa-solid fa-sparkles sparkle"></i><small>EVENTGENIE PICK · ${escapeHtml(state.event.type.toUpperCase())}</small><h3>${escapeHtml(recommendationTitle || "Make room for the moments")}</h3><p>${escapeHtml(recommendation.body || "Bring your celebration to life with a personal touch.")}</p></div>
      </article>
      <article class="panel-card"><div class="panel-head"><div><h2>Vendor check-in</h2><p>Your people behind the perfect day</p></div><button class="btn btn-subtle" data-view="vendors">View all</button></div>
        <div class="task-list">${state.vendors.slice(0, 3).map((vendor) => `<div class="task-row"><span class="metric-icon" style="width:26px;height:26px"><i class="fa-solid ${escapeHtml(vendorIcon(vendor.category))}"></i></span><div class="task-copy"><strong>${escapeHtml(vendor.category)}</strong><span>${escapeHtml(vendor.status)}</span></div><span class="priority ${vendor.status === "Paid" ? "low" : vendor.status === "Booked" ? "medium" : "high"}">${vendor.status === "Paid" ? "PAID" : vendor.status === "Booked" ? "BOOKED" : "TO DO"}</span></div>`).join("")}</div>
      </article>
    </section>`;
}

function renderWizard() {
  if (!wizardDraft) wizardDraft = copy(state.event);
  const steps = ["The basics", "Budget & vibe", "Your blueprint"];
  return `
    <section class="page-heading"><div><div class="eyebrow">LET’S MAKE SOMETHING TO CELEBRATE</div><h1>Your event, your way</h1><p>A few thoughtful details are all we need to create a plan that feels like you.</p></div></section>
    <div class="wizard-layout">
      <article class="panel-card wizard-card">
        <div class="stepper">${steps.map((label, index) => `<div class="step-item ${wizardStep === index + 1 ? "active" : ""} ${wizardStep > index + 1 ? "complete" : ""}"><span class="step-number">${wizardStep > index + 1 ? '<i class="fa-solid fa-check"></i>' : index + 1}</span><span>${label}</span></div>${index < steps.length - 1 ? '<span class="step-line"></span>' : ""}`).join("")}</div>
        <form id="wizard-form">
          <div class="wizard-step ${wizardStep === 1 ? "active" : ""}" data-step="1"><div class="form-grid">
            <div class="field"><label for="event-type">What are we celebrating?</label><select id="event-type" name="type">${["Wedding", "Birthday", "Anniversary", "Corporate Gala", "Community Festival"].map((item) => option(item, wizardDraft.type)).join("")}</select></div>
            <div class="field"><label for="event-name">Give your event a name</label><input id="event-name" name="name" maxlength="100" required value="${escapeAttr(wizardDraft.name)}" placeholder="e.g. Maya's Garden Party" /></div>
            <div class="field"><label for="event-date">When’s the big day?</label><input id="event-date" name="date" type="date" required min="${todayISO()}" value="${escapeAttr(wizardDraft.date)}" /></div>
            <div class="field"><label for="guest-count">How many lovely people?</label><div class="range-row"><input id="guest-count" name="guests" type="range" min="10" max="2000" step="10" value="${escapeAttr(wizardDraft.guests)}" /><span class="range-value" id="guest-count-value">${Number(wizardDraft.guests).toLocaleString()}</span></div><span class="field-hint">You can adjust your guest count anytime.</span></div>
          </div></div>
          <div class="wizard-step ${wizardStep === 2 ? "active" : ""}" data-step="2"><div class="form-grid">
            <div class="field"><label for="total-budget">What feels comfortable?</label><input id="total-budget" name="budget" type="number" min="1" max="1000000000" step="any" required value="${escapeAttr(wizardDraft.budget)}" /></div>
            <div class="field"><label for="currency-select">Choose your currency</label><select id="currency-select" name="currency"><option value="USD" ${wizardDraft.currency === "USD" ? "selected" : ""}>USD · US Dollar</option><option value="INR" ${wizardDraft.currency === "INR" ? "selected" : ""}>INR · Indian Rupee</option></select></div>
            <div class="field full"><label for="event-vibe">Pick the feeling</label><select id="event-vibe" name="vibe">${["Modern Minimalist", "Royal Traditional", "Bohemian", "Cyberpunk"].map((item) => option(item, wizardDraft.vibe)).join("")}</select></div>
            <div class="field full"><label for="event-preferences">Traditions, must-haves & little details</label><textarea id="event-preferences" name="preferences" maxlength="500" placeholder="Dietary needs, cultural traditions, favorite colors, or anything else that makes it yours...">${escapeHtml(wizardDraft.preferences || "")}</textarea><span class="field-hint">Your preferences stay in your browser and are only sent to Gemini when you create a blueprint.</span></div>
          </div></div>
          <div class="wizard-step ${wizardStep === 3 ? "active" : ""}" data-step="3">
            <div class="eyebrow">READY WHEN YOU ARE</div><h2 style="margin:5px 0 8px;font:700 17px Manrope">A celebration that feels like you.</h2><p style="margin:0;color:#9296a7;font-size:10px;line-height:1.7">We’ll shape your budget, vendor checklist, and planning milestones around your event. Gemini can add tailored ideas when configured; without a key, the planner still works beautifully in local mode.</p>
            <div id="ai-progress" class="ai-progress hidden"><div class="ai-progress-row" data-progress="0"><i class="fa-regular fa-circle"></i>Calculating guest allocations...</div><div class="ai-progress-row" data-progress="1"><i class="fa-regular fa-circle"></i>Curating vendor checklists...</div><div class="ai-progress-row" data-progress="2"><i class="fa-regular fa-circle"></i>Synthesizing theme ideas...</div></div>
            <div id="blueprint-result" class="hidden"></div>
          </div>
        </form>
        <div class="wizard-actions">${wizardStep > 1 ? '<button class="btn" data-action="wizard-back"><i class="fa-solid fa-arrow-left"></i> Back</button>' : "<span></span>"}${wizardStep < 3 ? '<button class="btn btn-primary" data-action="wizard-next">Continue <i class="fa-solid fa-arrow-right"></i></button>' : '<button class="btn btn-primary" id="generate-button" data-action="generate-blueprint"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate event blueprint</button>'}</div>
      </article>
      <aside class="wizard-preview"><div class="preview-orb"></div><div class="eyebrow">A LITTLE PREVIEW</div><h3 id="preview-name">${escapeHtml(wizardDraft.name)}</h3><p id="preview-summary">Your celebration begins with a few details. We’ll take care of the thoughtful planning from there.</p>
        <div class="preview-stat"><i class="fa-regular fa-calendar"></i><span id="preview-date">${escapeHtml(formatDate(wizardDraft.date))}</span></div><div class="preview-stat"><i class="fa-solid fa-users"></i><span id="preview-guests">${Number(wizardDraft.guests).toLocaleString()} guests</span></div><div class="preview-stat"><i class="fa-solid fa-wallet"></i><span id="preview-budget">${formatMoney(wizardDraft.budget, wizardDraft.currency)} planned</span></div>
        <div class="recommendation-card" style="margin-top:17px;min-height:auto"><i class="fa-solid fa-shield-heart sparkle"></i><small>YOUR PLAN, YOUR CALL</small><p style="margin-top:8px">AI suggestions are a starting point. Your preferences and choices always come first.</p></div>
      </aside>
    </div>`;
}

function renderBudget() {
  const allocated = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = state.event.budget - allocated;
  const categories = getCategoryTotals();
  const rows = state.expenses.map((expense) => {
    const pct = state.event.budget > 0 ? Math.min(100, (expense.amount / state.event.budget) * 100) : 0;
    return `<tr><td><div class="expense-name"><span class="metric-icon" style="width:25px;height:25px;--glow:${categoryColors[expense.category] || "#9da4b8"}"><i class="fa-solid ${expenseIcons[expense.category] || expenseIcons.Other}"></i></span>${escapeHtml(expense.name)}</div></td><td><span class="expense-category">${escapeHtml(expense.category)}</span></td><td>${formatMoney(expense.amount)}</td><td><div class="inline-progress"><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${categoryColors[expense.category] || "#9da4b8"}"></div></div><span>${Math.round(pct)}%</span></div></td><td><div class="table-actions"><button class="icon-button" data-action="edit-expense" data-id="${escapeAttr(expense.id)}" aria-label="Edit ${escapeAttr(expense.name)}"><i class="fa-solid fa-pen"></i></button><button class="icon-button" data-action="delete-expense" data-id="${escapeAttr(expense.id)}" aria-label="Delete ${escapeAttr(expense.name)}"><i class="fa-regular fa-trash-can"></i></button></div></td></tr>`;
  }).join("");
  return `<section class="page-heading"><div><div class="eyebrow">MONEY WELL SPENT, MEMORIES WELL MADE</div><h1>Your budget, beautifully balanced</h1><p>Keep a clear view of every celebration expense. Changes are saved right here on your device.</p></div><div class="heading-actions"><button class="btn btn-primary" data-action="add-expense"><i class="fa-solid fa-plus"></i> Add expense</button></div></section>
    <div class="budget-summary"><div class="summary-chip"><span>Total celebration budget</span><strong>${formatMoney(state.event.budget)}</strong></div><div class="summary-chip"><span>Allocated so far</span><strong>${formatMoney(allocated)}</strong></div><div class="summary-chip"><span>Still available</span><strong style="color:${remaining >= 0 ? "#86dfbc" : "#f29ba6"}">${formatMoney(remaining)}</strong></div></div>
    <section class="dashboard-grid"><article class="panel-card"><div class="panel-head"><div><h2>Recommended category mix</h2><p>A flexible starting point based on your total budget</p></div><span class="tiny-label">${Number(state.event.guests).toLocaleString()} guests</span></div><div class="budget-layout"><div class="donut" style="${donutStyle(categories, state.event.budget)}"><div class="donut-center"><strong>${state.event.currency}</strong><span>budget mix</span></div></div><div class="legend-list">${renderLegend(categories, state.event.budget)}</div></div></article><article class="panel-card"><div class="panel-head"><div><h2>Allocation progress</h2><p>${allocated > state.event.budget ? "A little over your budget — take a look below." : "A simple way to stay on top of spending."}</p></div><strong class="tiny-label">${state.event.budget ? Math.round((allocated / state.event.budget) * 100) : 0}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, state.event.budget ? allocated / state.event.budget * 100 : 0)}%"></div></div><div class="progress-row"><span>Allocated</span><strong>${formatMoney(allocated)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, state.event.budget ? Math.max(0, remaining) / state.event.budget * 100 : 0)}%;background:linear-gradient(90deg,#63dbb2,#70c4ec)"></div></div><div class="progress-row"><span>Remaining</span><strong>${formatMoney(remaining)}</strong></div></article></section>
    <article class="panel-card"><div class="panel-head"><div><h2>Expense breakdown</h2><p>Add, edit, or remove items as your plans take shape.</p></div><span class="tiny-label">${state.expenses.length} items</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Expense</th><th>Category</th><th>Amount</th><th>Budget share</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5"><div class="empty-state">No expenses yet. Add one to start planning your budget.</div></td></tr>'}</tbody></table></div></article>`;
}

function renderTimeline() {
  const phases = ["6 months out", "3 months out", "1 month out", "Day of"];
  return `<section class="page-heading"><div><div class="eyebrow">ONE LOVELY STEP AT A TIME</div><h1>Your celebration timeline</h1><p>Keep the big picture in sight and make the next small thing feel easy.</p></div><div class="heading-actions"><button class="btn btn-primary" data-action="add-task"><i class="fa-solid fa-plus"></i> Add milestone</button></div></section>
    <article class="panel-card" style="margin-bottom:14px"><div class="panel-head"><div><h2>Your planning progress</h2><p>Check off milestones as they happen.</p></div><strong class="tiny-label">${completionPercent()}% complete</strong></div><div class="progress-track"><div class="progress-fill" style="width:${completionPercent()}%"></div></div><div class="progress-row"><span>${state.tasks.filter((task) => task.done).length} completed</span><strong>${state.tasks.filter((task) => !task.done).length} left to go</strong></div></article>
    <article class="panel-card"><div class="timeline-wrap">${phases.map((phase) => {
      const tasks = state.tasks.filter((task) => task.phase.toLowerCase() === phase.toLowerCase());
      if (!tasks.length) return "";
      return `<section class="timeline-phase"><div class="phase-label">${escapeHtml(phase)}</div><div class="phase-content"><h3>${phase === "Day of" ? "The day you’ve been dreaming of" : "A little more of the plan falls into place"}</h3><div class="task-list">${tasks.map((task) => renderTask(task, true)).join("")}</div></div></section>`;
    }).join("")}${state.tasks.some((task) => !phases.includes(task.phase)) ? `<section class="timeline-phase"><div class="phase-label">More to plan</div><div class="phase-content"><h3>Your added milestones</h3><div class="task-list">${state.tasks.filter((task) => !phases.includes(task.phase)).map((task) => renderTask(task, true)).join("")}</div></div></section>` : ""}</div></article>`;
}

function renderVendors() {
  const count = state.vendors.filter((vendor) => vendor.status !== "Not contacted").length;
  return `<section class="page-heading"><div><div class="eyebrow">GOOD PEOPLE MAKE GREAT CELEBRATIONS</div><h1>Your vendor dream team</h1><p>Keep the conversations, quotes, and booking status all in one calm little place.</p></div><div class="heading-actions"><span class="btn btn-subtle"><i class="fa-solid fa-check"></i> ${count} of ${state.vendors.length} contacted</span></div></section>
    <div class="metric-grid">${metricCard("Vendors to contact", String(state.vendors.filter((vendor) => vendor.status === "Not contacted").length), "Your next conversations", "fa-phone", "#f5bb70")}${metricCard("Booked", String(state.vendors.filter((vendor) => vendor.status === "Booked").length), "Date & details confirmed", "fa-calendar-check", "#a78bfa")}${metricCard("Paid", String(state.vendors.filter((vendor) => vendor.status === "Paid").length), "One less thing to think about", "fa-circle-check", "#63dbb2")}${metricCard("Est. vendor total", formatMoney(state.vendors.reduce((sum, item) => sum + Number(item.estimate || 0), 0)), "Based on your latest estimates", "fa-wallet", "#70c4ec")}</div>
    <section class="vendor-grid">${state.vendors.map((vendor) => `<article class="vendor-card"><div class="vendor-top"><div><span class="vendor-icon"><i class="fa-solid ${escapeHtml(vendor.icon || vendorIcon(vendor.category))}"></i></span><h3>${escapeHtml(vendor.category)}</h3><p>${escapeHtml(vendor.description || "A special part of your celebration")}</p></div><select class="vendor-status ${vendor.status === "Paid" ? "paid" : vendor.status === "Booked" ? "booked" : ""}" aria-label="${escapeAttr(vendor.category)} status" data-vendor-category="${escapeAttr(vendor.category)}" data-vendor-field="status">${["Not contacted", "Booked", "Paid"].map((status) => option(status, vendor.status)).join("")}</select></div><div class="vendor-costs"><label>Estimated cost (${state.event.currency})<input type="number" min="0" step="50" value="${escapeAttr(vendor.estimate)}" data-vendor-category="${escapeAttr(vendor.category)}" data-vendor-field="estimate" /></label><label>Actual cost (${state.event.currency})<input type="number" min="0" step="50" value="${escapeAttr(vendor.actual)}" data-vendor-category="${escapeAttr(vendor.category)}" data-vendor-field="actual" /></label></div></article>`).join("")}</section>`;
}

function renderAssistant() {
  const history = state.chat;
  const starter = history.length
    ? ""
    : `<div class="chat-message"><p>Hi there! I’m EventCopilot, your thoughtful planning sidekick. I know about your event and budget, so ask me anything — from menu ideas to the little details that make a day yours.</p><p>What shall we dream up?</p></div>`;
  return `<section class="page-heading"><div><div class="eyebrow">A CLEVER LITTLE PLANNING SIDEKICK</div><h1>Meet EventCopilot</h1><p>Brainstorm ideas, untangle a detail, or get a fresh perspective on your celebration.</p></div><div class="heading-actions"><button class="btn" data-action="clear-chat"><i class="fa-regular fa-trash-can"></i> Clear chat</button></div></section>
    <div class="chat-shell"><article class="panel-card chat-card"><header class="chat-head"><div class="copilot-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div class="chat-head-copy"><strong>EventCopilot</strong><span><i class="fa-solid fa-circle"></i>${apiStatus.configured ? "Gemini AI is ready" : "Local mode — add a Gemini key for AI answers"}</span></div><button class="icon-button" data-action="clear-chat" aria-label="Clear conversation"><i class="fa-solid fa-ellipsis"></i></button></header>
      <div class="chat-messages" id="chat-messages">${starter}${history.map((message) => renderChatMessage(message)).join("")}${history.at(-1)?.pending ? '<div class="chat-message"><i class="fa-solid fa-ellipsis" style="color:#bba8ff"></i> Thinking through the details...</div>' : ""}</div>
      <form class="chat-compose" id="chat-form"><textarea class="chat-input" id="chat-input" rows="1" maxlength="2000" placeholder="Ask anything about your celebration..." aria-label="Message EventCopilot"></textarea><button class="chat-send" type="button" data-action="send-chat" aria-label="Send message"><i class="fa-solid fa-arrow-up"></i></button></form></article>
      <aside class="panel-card chat-aside"><h3>Ideas to get you started</h3><p>Tap one to bring it into the conversation.</p><div class="suggestion-list"><button class="suggestion-chip" data-action="chat-suggestion" data-prompt="Suggest 3 unique stage decoration themes within my remaining decor budget.">✨ Stage ideas within my decor budget</button><button class="suggestion-chip" data-action="chat-suggestion" data-prompt="Give me a delicious menu plan for ${Number(state.event.guests)} guests, taking my traditions and preferences into account.">🍽️ A menu my guests will love</button><button class="suggestion-chip" data-action="chat-suggestion" data-prompt="What should I prioritize next for my event, and what can wait?">🗓️ What should I plan next?</button><button class="suggestion-chip" data-action="chat-suggestion" data-prompt="Suggest thoughtful ways to make my celebration feel personal without spending too much.">💜 Personal touches on a budget</button></div><div class="chat-context"><span>PLANNING TOGETHER</span><strong>${escapeHtml(state.event.name)}</strong><span style="margin-top:5px">${Number(state.event.guests).toLocaleString()} guests · ${formatMoney(state.event.budget)}</span></div></aside></div>`;
}

function metricCard(title, value, note, icon, glow) {
  return `<article class="metric-card" style="--glow:${glow}"><div class="metric-top"><span>${escapeHtml(title)}</span><span class="metric-icon"><i class="fa-solid ${icon}"></i></span></div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-note">${escapeHtml(note)}</div></article>`;
}

function renderTask(task, showPriority = false) {
  return `<div class="task-row ${task.done ? "is-done" : ""}"><button class="task-check ${task.done ? "checked" : ""}" data-toggle-task="${escapeAttr(task.id)}" aria-label="${task.done ? "Mark incomplete" : "Mark complete"}: ${escapeAttr(task.title)}">${task.done ? '<i class="fa-solid fa-check"></i>' : ""}</button><div class="task-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.phase)}</span></div>${showPriority ? `<span class="priority ${escapeAttr(task.priority.toLowerCase())}">${escapeHtml(task.priority)}</span>` : ""}</div>`;
}

function renderLegend(categories, budget) {
  return Object.entries(categories).map(([name, value]) => `<div class="legend-item"><span class="legend-label"><span class="legend-dot" style="--dot:${categoryColors[name] || "#9da4b8"}"></span>${escapeHtml(name)}</span><strong>${formatMoney(value)} <span style="color:#777b8d;font-weight:400">${budget ? `${Math.round(value / budget * 100)}%` : "0%"}</span></strong></div>`).join("");
}

function donutStyle(categories, budget) {
  const entries = Object.entries(categories);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const source = total > 0
    ? entries.map(([name, value]) => ({ name, value }))
    : [{ name: "Venue", value: 40 }, { name: "Catering", value: 30 }, { name: "Decor", value: 15 }, { name: "Photography", value: 10 }, { name: "Miscellaneous", value: 5 }];
  let cursor = 0;
  const stops = source.map(({ name, value }) => {
    const start = cursor;
    cursor += total > 0 ? (value / total) * 100 : value;
    return `${categoryColors[name] || "#9da4b8"} ${start}% ${cursor}%`;
  });
  return `background:conic-gradient(${stops.join(",")})`;
}

function getCategoryTotals() {
  const totals = {};
  for (const expense of state.expenses) {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  }
  if (!Object.keys(totals).length) {
    return {
      Venue: state.event.budget * 0.4,
      Catering: state.event.budget * 0.3,
      Decor: state.event.budget * 0.15,
      Photography: state.event.budget * 0.1,
      Miscellaneous: state.event.budget * 0.05,
    };
  }
  return totals;
}

function renderSearchResults(results) {
  if (!results.length) return `<div class="search-results"><strong>No matches for “${escapeHtml(searchTerm)}”</strong><span class="tiny-label">Try a vendor, expense, or milestone name.</span></div>`;
  return `<div class="search-results"><strong>Found ${results.length} match${results.length === 1 ? "" : "es"} for “${escapeHtml(searchTerm)}”</strong>${results.map((result) => `<button data-view="${result.view}">${escapeHtml(result.label)} <i class="fa-solid fa-arrow-right"></i></button>`).join("")}</div>`;
}

function findResults(term) {
  const query = term.toLowerCase();
  const matches = [];
  if (`${state.event.name} ${state.event.type} ${state.event.theme}`.toLowerCase().includes(query)) {
    matches.push({ label: `${state.event.name} · event details`, view: "wizard" });
  }
  state.expenses.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query))
    .forEach((item) => matches.push({ label: `${item.name} · ${formatMoney(item.amount)}`, view: "budget" }));
  state.tasks.filter((item) => `${item.title} ${item.phase}`.toLowerCase().includes(query))
    .forEach((item) => matches.push({ label: `${item.title} · ${item.phase}`, view: "timeline" }));
  state.vendors.filter((item) => `${item.category} ${item.description}`.toLowerCase().includes(query))
    .forEach((item) => matches.push({ label: `${item.category} · ${item.status}`, view: "vendors" }));
  return matches.slice(0, 6);
}

function syncWizardForm() {
  const form = document.querySelector("#wizard-form");
  if (!form) return;
  for (const [key, value] of Object.entries(wizardDraft)) {
    const input = form.elements.namedItem(key);
    if (input && key !== "theme") input.value = value;
  }
  const guestValue = document.querySelector("#guest-count-value");
  if (guestValue) guestValue.textContent = Number(wizardDraft.guests).toLocaleString();
  updateWizardPreview();
}

function updateWizardPreview() {
  const form = document.querySelector("#wizard-form");
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const name = document.querySelector("#preview-name");
  const date = document.querySelector("#preview-date");
  const guests = document.querySelector("#preview-guests");
  const budget = document.querySelector("#preview-budget");
  if (name) name.textContent = data.name || "Your celebration";
  if (date) date.textContent = data.date ? formatDate(data.date) : "Choose a date";
  if (guests) guests.textContent = `${Number(data.guests || 0).toLocaleString()} guests`;
  if (budget) budget.textContent = `${formatMoney(Number(data.budget || 0), data.currency || "USD")} planned`;
  wizardDraft = { ...wizardDraft, ...data, guests: Number(data.guests || 0), budget: Number(data.budget || 0) };
}

function validateWizardStep() {
  const form = document.querySelector("#wizard-form");
  const firstStep = document.querySelector(`.wizard-step[data-step="${wizardStep}"]`);
  const controls = [...firstStep.querySelectorAll("input,select,textarea")];
  for (const control of controls) {
    if (control.type === "range") continue;
    if (!control.reportValidity()) return false;
  }
  if (wizardStep === 1 && new Date(`${form.elements.date.value}T00:00:00`) < new Date(`${todayISO()}T00:00:00`)) {
    toast("Choose a date that’s today or later.", true);
    return false;
  }
  updateWizardPreview();
  return true;
}

async function generateBlueprint() {
  const form = document.querySelector("#wizard-form");
  if (!form.reportValidity()) return;
  updateWizardPreview();
  const event = { ...wizardDraft, guests: Number(wizardDraft.guests), budget: Number(wizardDraft.budget) };
  const progress = document.querySelector("#ai-progress");
  const button = document.querySelector("#generate-button");
  const result = document.querySelector("#blueprint-result");
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating your plan...';
  progress.classList.remove("hidden");
  result.classList.add("hidden");
  const progressItems = [...progress.querySelectorAll(".ai-progress-row")];
  let timerIndex = 0;
  const timer = window.setInterval(() => {
    progressItems.forEach((item, index) => {
      item.classList.toggle("done", index < timerIndex);
      item.classList.toggle("active", index === timerIndex);
      item.querySelector("i").className = index < timerIndex ? "fa-solid fa-circle-check" : index === timerIndex ? "fa-solid fa-spinner fa-spin" : "fa-regular fa-circle";
    });
    timerIndex = Math.min(timerIndex + 1, progressItems.length - 1);
  }, 850);
  let generated;
  let localMode = false;
  try {
    const response = await fetch("/api/blueprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Gemini could not create your blueprint.");
    generated = payload.blueprint;
    apiStatus = { available: true, configured: true };
    updateApiStatus();
  } catch (error) {
    localMode = true;
    generated = makeLocalBlueprint(event);
    toast(`${error.message} Your plan was created locally instead; your event is still saved.`, true);
  } finally {
    window.clearInterval(timer);
    progressItems.forEach((item) => {
      item.classList.remove("active");
      item.classList.add("done");
      item.querySelector("i").className = "fa-solid fa-circle-check";
    });
  }

  applyBlueprint(event, generated);
  result.innerHTML = `<div class="recommendation-card" style="margin-top:16px"><i class="fa-solid ${localMode ? "fa-floppy-disk" : "fa-sparkles"} sparkle"></i><small>${localMode ? "LOCAL STARTER PLAN" : "YOUR AI BLUEPRINT"}</small><h3>${escapeHtml(generated.theme || event.theme || "Your celebration plan")}</h3><p>${escapeHtml(generated.summary || "Your event details, budget, vendors, and milestones are ready in your workspace.")}</p><button class="btn btn-subtle" style="margin-top:12px" data-view="dashboard">Open your dashboard <i class="fa-solid fa-arrow-right"></i></button></div>`;
  result.classList.remove("hidden");
  button.disabled = false;
  button.innerHTML = '<i class="fa-solid fa-rotate"></i> Regenerate blueprint';
  toast(localMode ? "Your local event plan is ready." : "Your AI event blueprint is ready.");
}

function applyBlueprint(event, blueprint) {
  const keepTasks = state.tasks.filter((task) => task.done);
  const tasks = Array.isArray(blueprint.timeline) && blueprint.timeline.length
    ? blueprint.timeline.map((item, index) => ({
        id: `ai-task-${Date.now()}-${index}`,
        title: item.title,
        phase: normalizePhase(item.phase),
        priority: index < 3 ? "High" : "Medium",
        done: false,
      }))
    : defaultTasks(event.type);
  state.event = { ...event, theme: blueprint.theme || `${event.vibe} ${event.type.toLowerCase()}` };
  state.expenses = allocateBudget(event.budget, event.currency);
  state.tasks = [...keepTasks.slice(0, 1), ...tasks];
  state.vendors = vendorDefaults.map((vendor) => ({
    ...vendor,
    estimate: Math.round(event.budget * vendorShare(vendor.category)),
    actual: 0,
  }));
  if (Array.isArray(blueprint.vendors)) {
    for (const suggestion of blueprint.vendors) {
      const matched = state.vendors.find((vendor) => vendor.category.toLowerCase() === suggestion.category.toLowerCase());
      if (matched && suggestion.estimate) matched.estimate = Math.round(suggestion.estimate);
    }
  }
  const recs = [...(blueprint.recommendations || []), ...(blueprint.budgetTips || [])];
  state.recommendations = recs.length
    ? recs.slice(0, 5).map((item, index) => ({ title: index === 0 ? blueprint.theme || "A thoughtful touch" : `Planning idea ${index + 1}`, body: item }))
    : copy(seedPlan.recommendations);
  recommendationIndex = 0;
  state.chat = [];
  wizardDraft = null;
  persist();
}

function makeLocalBlueprint(event) {
  return {
    theme: `${event.vibe}: ${event.type === "Wedding" ? "A day to remember" : "A celebration made yours"}`,
    summary: `A thoughtful ${event.vibe.toLowerCase()} ${event.type.toLowerCase()} for ${Number(event.guests).toLocaleString()} guests, with a ${formatMoney(event.budget, event.currency)} budget. Your starter budget, vendor list, and milestones are ready to personalize.`,
    recommendations: [
      `Confirm the guest list early so your ${Number(event.guests).toLocaleString()} guests can be planned for comfortably.`,
      "Keep a small contingency for the unexpected — it makes the day feel easier.",
      event.preferences || `Bring your ${event.vibe.toLowerCase()} vibe into the welcome, menu, and little details.`,
    ],
    timeline: defaultTasks(event.type).map((task) => ({ title: task.title, phase: task.phase })),
    vendors: [],
    budgetTips: ["Compare at least two quotes before booking a major vendor."],
  };
}

function defaultTasks(eventType) {
  const event = eventType.toLowerCase();
  return [
    { title: "Set your date, guest list, and celebration priorities", phase: "6 months out" },
    { title: "Book your venue and key vendors", phase: "3 months out" },
    { title: "Confirm guest count, menu, and final details", phase: "1 month out" },
    { title: "Share your run-of-show and enjoy your day", phase: "Day of" },
  ];
}

function allocateBudget(budget, currency) {
  const parts = [
    ["Venue", "Venue & space", 0.4],
    ["Catering", "Food & catering", 0.3],
    ["Decor", "Decor & florals", 0.15],
    ["Photography", "Photography", 0.1],
    ["Miscellaneous", "Other essentials", 0.05],
  ];
  let used = 0;
  return parts.map(([category, name, share], index) => {
    const amount = index === parts.length - 1 ? budget - used : Math.round(budget * share);
    used += amount;
    return { id: `generated-${category.toLowerCase()}`, name, category, amount: Math.max(0, Math.round(amount)) };
  });
}

function openExpenseModal(id = "") {
  const existing = state.expenses.find((item) => item.id === id);
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title"><h2 id="expense-modal-title">${existing ? "Edit expense" : "Add an expense"}</h2><p>Keep your celebration budget up to date, one little detail at a time.</p><form id="expense-form"><input type="hidden" name="id" value="${escapeAttr(existing?.id || "")}"><div class="form-grid"><div class="field full"><label for="expense-name">What’s the expense?</label><input id="expense-name" name="name" maxlength="90" required value="${escapeAttr(existing?.name || "")}" placeholder="e.g. Welcome dinner" /></div><div class="field"><label for="expense-category">Category</label><select id="expense-category" name="category">${["Venue", "Catering", "Decor", "Photography", "Miscellaneous", "Other"].map((item) => option(item, existing?.category || "Other")).join("")}</select></div><div class="field"><label for="expense-amount">Amount (${state.event.currency})</label><input id="expense-amount" name="amount" type="number" min="0.01" max="1000000000" step="0.01" required value="${escapeAttr(existing?.amount || "")}" /></div></div><div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="button" class="btn btn-primary" data-action="save-expense">${existing ? "Save changes" : "Add expense"}</button></div></form></section></div>`;
  document.querySelector("#expense-name").focus();
}

function saveExpense(formData) {
  const id = String(formData.get("id") || "");
  const expense = {
    id: id || `expense-${Date.now()}`,
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "Other"),
    amount: Number(formData.get("amount")),
  };
  if (!expense.name || !Number.isFinite(expense.amount) || expense.amount <= 0) {
    toast("Add an expense name and a valid amount.", true);
    return;
  }
  const index = state.expenses.findIndex((item) => item.id === id);
  if (index >= 0) state.expenses[index] = expense;
  else state.expenses.push(expense);
  persist();
  document.querySelector("#modal-root").innerHTML = "";
  render();
  toast(index >= 0 ? "Expense updated." : "Expense added to your budget.");
}

function deleteExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense || !window.confirm(`Remove “${expense.name}” from your budget?`)) return;
  state.expenses = state.expenses.filter((item) => item.id !== id);
  persist();
  render();
  toast("Expense removed.");
}

function openTaskModal() {
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><h2 id="task-modal-title">Add a milestone</h2><p>Every big day comes together one small step at a time.</p><form id="task-form"><div class="form-grid"><div class="field full"><label for="task-title">What needs to happen?</label><input id="task-title" name="title" maxlength="120" required placeholder="e.g. Confirm the playlist" /></div><div class="field"><label for="task-phase">When’s the right time?</label><select id="task-phase" name="phase">${["6 months out", "3 months out", "1 month out", "Day of", "More to plan"].map((item) => option(item, "3 months out")).join("")}</select></div><div class="field"><label for="task-priority">Priority</label><select id="task-priority" name="priority">${["High", "Medium", "Low"].map((item) => option(item, "Medium")).join("")}</select></div></div><div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="button" class="btn btn-primary" data-action="save-task">Add milestone</button></div></form></section></div>`;
  document.querySelector("#task-title").focus();
}

function saveTask(formData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    toast("Give your milestone a name first.", true);
    return;
  }
  state.tasks.push({
    id: `task-${Date.now()}`,
    title,
    phase: String(formData.get("phase") || "More to plan"),
    priority: String(formData.get("priority") || "Medium"),
    done: false,
  });
  persist();
  document.querySelector("#modal-root").innerHTML = "";
  render();
  toast("Milestone added to your timeline.");
}

async function sendChatMessage(suggestedText) {
  const input = document.querySelector("#chat-input");
  const message = String(suggestedText || input?.value || "").trim();
  if (!message) return;
  const previous = state.chat.slice(-8).map(({ role, content }) => ({ role, content }));
  state.chat.push({ role: "user", content: message });
  state.chat.push({ role: "assistant", content: "", pending: true });
  persist();
  render();
  const context = [
    `Event: ${state.event.name} (${state.event.type})`,
    `Date: ${state.event.date}; guests: ${state.event.guests}; vibe: ${state.event.vibe}`,
    `Budget: ${formatMoney(state.event.budget)}; remaining: ${formatMoney(state.event.budget - state.expenses.reduce((sum, item) => sum + item.amount, 0))}`,
    `Preferences: ${state.event.preferences || "None specified"}`,
    `Expenses: ${state.expenses.map((item) => `${item.category}: ${formatMoney(item.amount)} (${item.name})`).join("; ")}`,
  ].join("\n");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: previous, context }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "EventCopilot could not answer.");
    state.chat[state.chat.length - 1] = { role: "assistant", content: payload.answer };
    apiStatus = { available: true, configured: true };
    updateApiStatus();
    persist();
    render();
  } catch (error) {
    state.chat.pop();
    state.chat.push({ role: "assistant", content: `${error.message}\n\nYour plan is still saved locally. Add GEMINI_API_KEY to the server's .env file to enable AI replies.` });
    persist();
    render();
    toast(error.message, true);
  }
}

function renderChatMessage(message) {
  return `<div class="chat-message ${message.role === "user" ? "user" : ""}">${message.pending ? '<i class="fa-solid fa-spinner fa-spin" style="color:#bba8ff"></i> Thinking through the details...' : formatMarkdown(message.content)}</div>`;
}

function formatMarkdown(text) {
  const escaped = escapeHtml(text);
  const blocks = escaped.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^\s*[-*]\s/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${formatInline(line.replace(/^\s*[-*]\s/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p>${lines.map(formatInline).join("<br>")}</p>`;
  });
  return blocks.join("");
}

function formatInline(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return copy(seedPlan);
    const parsed = JSON.parse(stored);
    if (!parsed?.event || !Array.isArray(parsed.expenses) || !Array.isArray(parsed.tasks)) {
      throw new Error("Saved plan is incomplete.");
    }
    return {
      ...copy(seedPlan),
      ...parsed,
      event: { ...copy(seedPlan.event), ...parsed.event },
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : copy(vendorDefaults),
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length
        ? parsed.recommendations
        : copy(seedPlan.recommendations),
      chat: Array.isArray(parsed.chat) ? parsed.chat.slice(-50) : [],
    };
  } catch (error) {
    console.error("Could not load the saved event plan:", error);
    return copy(seedPlan);
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save the event plan locally:", error);
    toast("Your browser could not save this update. Check your available storage.", true);
    return false;
  }
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error(`Health check returned ${response.status}`);
    const health = await response.json();
    apiStatus = { available: true, configured: Boolean(health.aiConfigured) };
  } catch (error) {
    apiStatus = { available: false, configured: false };
    console.error("Could not check EventGenie's AI status:", error);
  }
  updateApiStatus();
  if (activeView === "assistant") render();
}

function updateApiStatus() {
  const badge = document.querySelector("#ai-status");
  const label = document.querySelector("#ai-status-label");
  if (!badge || !label) return;
  badge.classList.toggle("offline", !apiStatus.configured);
  badge.title = apiStatus.configured
    ? "Gemini is configured on the server."
    : apiStatus.available
      ? "Local planning is ready. Add a Gemini API key to enable AI."
      : "Planner is available locally; the API server could not be reached.";
  label.textContent = apiStatus.configured ? "Gemini connected" : apiStatus.available ? "Local mode" : "API offline";
}

function toast(message, warning = false) {
  const region = document.querySelector("#toast-region");
  const item = document.createElement("div");
  item.className = `toast ${warning ? "warning" : ""}`;
  const icon = document.createElement("i");
  icon.className = `fa-solid ${warning ? "fa-triangle-exclamation" : "fa-circle-check"}`;
  const text = document.createElement("span");
  text.textContent = message;
  item.append(icon, text);
  region.append(item);
  window.setTimeout(() => item.remove(), 4800);
}

function completionPercent() {
  return state.tasks.length ? Math.round(state.tasks.filter((task) => task.done).length / state.tasks.length * 100) : 0;
}

function vendorShare(category) {
  return ({ Venue: .3, Caterer: .23, "Makeup artist": .04, "DJ / Music": .06, Decorator: .12 })[category] || .05;
}

function normalizePhase(value) {
  const phase = String(value || "").toLowerCase();
  if (phase.includes("day")) return "Day of";
  if (phase.includes("6") || phase.includes("six")) return "6 months out";
  if (phase.includes("1") || phase.includes("one")) return "1 month out";
  if (phase.includes("3") || phase.includes("three")) return "3 months out";
  return "More to plan";
}

function vendorIcon(category) {
  return ({ Venue: "fa-building", Caterer: "fa-utensils", "Makeup artist": "fa-wand-magic-sparkles", "DJ / Music": "fa-music", Decorator: "fa-palette" })[category] || "fa-store";
}

function option(value, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`;
}

function formatMoney(value, currency = state.event.currency) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currencySymbols[currency] || ""}${amount.toLocaleString()}`;
  }
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date to be decided" : new Intl.DateTimeFormat(undefined, options).format(date);
}

function daysUntil(value) {
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target.getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86_400_000);
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function todayISO() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function scrollChatToBottom() {
  const messages = document.querySelector("#chat-messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
