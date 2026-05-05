const API_URL = window.FORKIO_API_URL || localStorage.getItem("forkioApiUrl") || "";

const modules = {
  dashboard: { label: "Dashboard", roles: ["Admin", "Area Manager", "Manager", "Supervisor", "Operator"] },
  businesses: { label: "Businesses", sheet: "Businesses", roles: ["Admin"] },
  locations: { label: "Locations", sheet: "Locations", roles: ["Admin", "Area Manager", "Manager"] },
  users: { label: "Users", sheet: "Users", roles: ["Admin", "Area Manager", "Manager", "Supervisor"] },
  forklifts: { label: "Forklifts", sheet: "Forklifts", roles: ["Admin", "Area Manager", "Manager", "Supervisor"] },
  inspections: { label: "Inspections", sheet: "Inspections", roles: ["Admin", "Area Manager", "Manager", "Supervisor", "Operator"] },
  certifications: { label: "Certifications", sheet: "Certifications", roles: ["Admin", "Area Manager", "Manager"] },
  maintenance: { label: "Maintenance", sheet: "Maintenance Records", roles: ["Admin", "Area Manager", "Manager"] },
  checklist: { label: "Checklist", sheet: "Checklist Template", roles: ["Admin", "Area Manager", "Manager"] }
};

const schemas = {
  Businesses: ["business_id", "business_name", "business_logo", "contact_person", "contact_number", "contact_email", "business_status"],
  Locations: ["location_id", "business_id", "location_name", "address", "manager_name", "manager_contact"],
  Users: ["user_id", "username", "full_name", "user_role", "profile_image", "email", "phone_number", "business_id", "location_id", "account_status"],
  Forklifts: ["forklift_id", "forklift_serial", "forklift_model", "forklift_brand", "forklift_year", "forklift_mileage", "forklift_type", "forklift_status", "business_id", "location_id", "user_assigned", "next_inspection_due", "certification_status", "certification_expiration", "notes"],
  Inspections: ["inspection_id", "forklift_id", "inspector_user", "inspection_date", "mileage", "checklist_results", "issues_found", "notes", "photo_1", "photo_2", "signature_image", "overall_status"],
  Certifications: ["certification_id", "forklift_id", "certification_name", "issue_date", "expiration_date", "document_url", "status"],
  "Maintenance Records": ["maintenance_id", "forklift_id", "service_date", "service_type", "issue_description", "technician", "cost", "next_service_due"],
  "Checklist Template": ["question_id", "category", "question_text", "required", "active"]
};

const userFormFields = ["username", "full_name", "password", "confirm_password", "profile_image", "email", "phone_number", "user_role", "business_id", "location_id", "account_status"];
const userStatusOptions = [
  ["active", "Active"],
  ["desactive", "Desactive"],
  ["locked", "Locked"]
];
const userRoleOptions = ["Admin", "Area Manager", "Manager", "Supervisor", "Operator"];

const demoData = {
  Businesses: [
    { business_id: "biz_001", business_name: "Northline Warehousing", contact_person: "Ada Flores", contact_email: "ops@northline.example", business_status: "active" }
  ],
  Locations: [
    { location_id: "loc_001", business_id: "biz_001", location_name: "Dallas DC", address: "1200 Industrial Way", manager_name: "R. Chen", manager_contact: "555-0160" }
  ],
  Users: [
    { user_id: "usr_001", username: "admin", full_name: "Forkio Admin", user_role: "Admin", business_id: "biz_001", location_id: "loc_001", account_status: "active" },
    { user_id: "usr_002", username: "operator", full_name: "Maya Ortiz", user_role: "Operator", business_id: "biz_001", location_id: "loc_001", account_status: "active" }
  ],
  Forklifts: [
    { forklift_id: "fl_001", forklift_serial: "TX-7781", forklift_model: "8FGCU25", forklift_brand: "Toyota", forklift_year: "2022", forklift_mileage: "1280", forklift_type: "Propane", forklift_status: "active", business_id: "biz_001", location_id: "loc_001", user_assigned: "usr_002", next_inspection_due: "2026-05-05", certification_status: "valid", certification_expiration: "2026-08-18" },
    { forklift_id: "fl_002", forklift_serial: "CL-4811", forklift_model: "C25", forklift_brand: "Clark", forklift_year: "2020", forklift_mileage: "3440", forklift_type: "Electric", forklift_status: "maintenance", business_id: "biz_001", location_id: "loc_001", next_inspection_due: "2026-05-01", certification_status: "expiring", certification_expiration: "2026-05-20" }
  ],
  Inspections: [
    { inspection_id: "ins_001", forklift_id: "fl_001", inspector_user: "usr_002", inspection_date: "2026-05-04", mileage: "1280", overall_status: "passed", issues_found: "" },
    { inspection_id: "ins_002", forklift_id: "fl_002", inspector_user: "usr_002", inspection_date: "2026-05-03", mileage: "3440", overall_status: "failed", issues_found: "Hydraulic leak" }
  ],
  Certifications: [],
  "Maintenance Records": [],
  "Checklist Template": [
    { question_id: "q_001", category: "Safety", question_text: "Horn and backup alarm are working", required: "yes", active: "yes" },
    { question_id: "q_002", category: "Hydraulics", question_text: "No visible leaks", required: "yes", active: "yes" }
  ]
};

let state = {
  session: null,
  activeModule: "dashboard",
  records: structuredClone(demoData),
  editingRecord: null,
  loadedSheets: new Set(),
  pendingSheets: new Map(),
  dashboardLoaded: false
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("forkioSession");
  if (saved) {
    state.session = JSON.parse(saved);
    if ($("#appView")) showApp();
  }
  $("#loginForm")?.addEventListener("submit", login);
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#searchInput")?.addEventListener("input", renderTable);
  $("#newRecordBtn")?.addEventListener("click", () => openRecordDialog());
  $("#recordForm")?.addEventListener("submit", saveRecord);
  document.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => $("#recordDialog").close());
  });
});

async function api(action, payload = {}) {
  if (!API_URL) {
    return demoApi(action, payload);
  }
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, token: state.session?.token, ...payload })
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function demoApi(action, payload) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (action === "login") {
    const user = demoData.Users.find((item) => item.username === payload.username);
    if (!user || !payload.password) throw new Error("Invalid username or password");
    return { ok: true, token: "demo-token", user };
  }
  if (action === "list") return { ok: true, rows: state.records[payload.sheet] || [] };
  if (action === "dashboard") return { ok: true, data: buildDashboardData() };
  if (action === "upsert") {
    const rows = state.records[payload.sheet] || [];
    const key = schemas[payload.sheet][0];
    const incoming = { ...payload.record };
    incoming[key] ||= `${key.split("_")[0]}_${Date.now()}`;
    const index = rows.findIndex((row) => row[key] === incoming[key]);
    if (index >= 0) rows[index] = { ...rows[index], ...incoming };
    else rows.push(incoming);
    state.records[payload.sheet] = rows;
    return { ok: true, record: incoming };
  }
  if (action === "archive") {
    const key = schemas[payload.sheet][0];
    const row = state.records[payload.sheet].find((item) => item[key] === payload.id);
    if (row) row[statusFieldFor(payload.sheet)] = "archived";
    return { ok: true };
  }
  if (action === "uploadFile") {
    return { ok: true, file: { url: payload.base64 ? `data:${payload.mimeType};base64,${payload.base64}` : "", name: payload.fileName } };
  }
  return { ok: true };
}

async function login(event) {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    const data = await api("login", {
      username: $("#username").value.trim(),
      password: $("#password").value
    });
    state.session = { token: data.token, user: data.user };
    localStorage.setItem("forkioSession", JSON.stringify(state.session));
    showApp();
  } catch (error) {
    $("#loginError").textContent = error.message;
  }
}

function logout() {
  localStorage.removeItem("forkioSession");
  state.session = null;
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#userName").textContent = state.session.user.full_name;
  $("#userRole").textContent = state.session.user.user_role;
  renderNav();
  switchModule("dashboard");
}

function allowed(module) {
  return modules[module].roles.includes(state.session.user.user_role);
}

function renderNav() {
  $("#navList").innerHTML = Object.entries(modules)
    .filter(([key]) => allowed(key))
    .map(([key, item]) => `<button data-module="${key}">${item.label}</button>`)
    .join("");
  $("#navList").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => switchModule(button.dataset.module));
  });
}

async function switchModule(module) {
  state.activeModule = module;
  document.querySelectorAll(".nav-list button").forEach((button) => {
    button.classList.toggle("active", button.dataset.module === module);
  });
  $("#pageTitle").textContent = modules[module].label;
  $("#dashboardModule").classList.toggle("hidden", module !== "dashboard");
  $("#tableModule").classList.toggle("hidden", module === "dashboard");
  if (module === "dashboard") {
    renderDashboard();
  } else {
    const usersLocked = module === "users" && !isAdmin();
    const operatorInspectionLocked = module === "inspections" && state.session.user.user_role === "Operator";
    $("#newRecordBtn").classList.toggle("hidden", usersLocked || operatorInspectionLocked);
    loadSheet(modules[module].sheet);
  }
}

async function loadSheet(sheet) {
  $("#searchInput").value = "";
  if (state.loadedSheets.has(sheet)) {
    renderTable();
    refreshSheet(sheet);
    return;
  }
  renderTableMessage("Loading records...");
  await refreshSheet(sheet);
}

async function refreshSheet(sheet) {
  if (state.pendingSheets.has(sheet)) return state.pendingSheets.get(sheet);
  const request = api("list", { sheet })
    .then((data) => {
      state.records[sheet] = data.rows;
      state.loadedSheets.add(sheet);
      if (modules[state.activeModule]?.sheet === sheet) renderTable();
      return data.rows;
    })
    .catch((error) => {
      if (modules[state.activeModule]?.sheet === sheet) renderTableMessage(error.message);
      throw error;
    })
    .finally(() => state.pendingSheets.delete(sheet));
  state.pendingSheets.set(sheet, request);
  return request;
}

function invalidateSheet(sheet) {
  state.loadedSheets.delete(sheet);
  state.dashboardLoaded = false;
}

function renderTableMessage(message) {
  const sheet = modules[state.activeModule].sheet;
  const columns = schemas[sheet];
  $("#tableHead").innerHTML = `<tr>${columns.slice(0, 8).map((column) => `<th>${humanize(column)}</th>`).join("")}<th>Actions</th></tr>`;
  $("#tableBody").innerHTML = `<tr><td class="muted" colspan="${Math.min(columns.length, 8) + 1}">${escapeHtml(message)}</td></tr>`;
}

async function preloadCoreSheets() {
  const sheets = ["Users", "Forklifts", "Inspections", "Certifications", "Maintenance Records"];
  sheets.forEach((sheet) => refreshSheet(sheet).catch(() => {}));
}

async function renderDashboard() {
  if (state.dashboardLoaded) {
    renderDashboardFromData(buildDashboardData());
    refreshDashboard();
    return;
  }
  renderDashboardSkeleton();
  await refreshDashboard();
}

async function refreshDashboard() {
  try {
    const data = (await api("dashboard")).data;
    state.dashboardLoaded = true;
    renderDashboardFromData(data);
    preloadCoreSheets();
  } catch (error) {
    $("#kpiGrid").innerHTML = `<article class="kpi-card"><span>Dashboard</span><strong>--</strong></article>`;
    $("#alertList").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    $("#recentInspections").innerHTML = "";
  }
}

function renderDashboardSkeleton() {
  $("#kpiGrid").innerHTML = ["Total forklifts", "Active forklifts", "Inspections due", "Expired certifications", "Maintenance alerts"]
    .map((label) => `<article class="kpi-card"><span>${label}</span><strong>...</strong></article>`)
    .join("");
  $("#alertList").innerHTML = `<p class="muted">Loading alerts...</p>`;
  $("#recentInspections").innerHTML = `<p class="muted">Loading inspections...</p>`;
}

function renderDashboardFromData(data) {
  if (state.activeModule !== "dashboard") return;
  $("#kpiGrid").innerHTML = [
    ["Total forklifts", data.totalForklifts],
    ["Active forklifts", data.activeForklifts],
    ["Inspections due", data.inspectionsDue],
    ["Expired certifications", data.expiredCertifications],
    ["Maintenance alerts", data.maintenanceAlerts]
  ].map(([label, value]) => `<article class="kpi-card"><span>${label}</span><strong>${value}</strong></article>`).join("");

  $("#alertList").innerHTML = data.alerts.length
    ? data.alerts.map((alert) => `<article class="alert-item ${alert.level}"><strong>${escapeHtml(alert.title)}</strong><span class="muted">${escapeHtml(alert.detail)}</span></article>`).join("")
    : `<p class="muted">No active alerts.</p>`;

  $("#recentInspections").innerHTML = data.recentInspections.length
    ? data.recentInspections.map((item) => `<article class="compact-item"><strong>${escapeHtml(item.forklift_id)} - ${escapeHtml(item.overall_status)}</strong><span class="muted">${escapeHtml(item.inspection_date)}</span></article>`).join("")
    : `<p class="muted">No inspections yet.</p>`;
}

function buildDashboardData() {
  const forklifts = state.records.Forklifts || [];
  const inspections = state.records.Inspections || [];
  const today = new Date();
  const due = forklifts.filter((item) => dateValue(item.next_inspection_due) <= today);
  const expired = forklifts.filter((item) => dateValue(item.certification_expiration) < today);
  const maintenance = forklifts.filter((item) => item.forklift_status === "maintenance");
  return {
    totalForklifts: forklifts.length,
    activeForklifts: forklifts.filter((item) => item.forklift_status === "active").length,
    inspectionsDue: due.length,
    expiredCertifications: expired.length,
    maintenanceAlerts: maintenance.length,
    alerts: [
      ...due.map((item) => ({ level: "danger", title: `${item.forklift_serial} inspection due`, detail: item.next_inspection_due || "No due date" })),
      ...maintenance.map((item) => ({ level: "warning", title: `${item.forklift_serial} in maintenance`, detail: item.notes || "Review service log" }))
    ],
    recentInspections: inspections.slice(-5).reverse()
  };
}

function dateValue(value) {
  return value ? new Date(`${value}T12:00:00`) : new Date("1900-01-01T12:00:00");
}

function renderTable() {
  const sheet = modules[state.activeModule].sheet;
  const columns = schemas[sheet];
  const term = $("#searchInput").value.toLowerCase();
  const rows = (state.records[sheet] || []).filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  const canEditUsers = sheet !== "Users" || isAdmin();

  $("#tableHead").innerHTML = `<tr>${columns.slice(0, 8).map((column) => `<th>${humanize(column)}</th>`).join("")}<th>Actions</th></tr>`;
  $("#tableBody").innerHTML = rows.map((row) => {
    const key = columns[0];
    const cells = columns.slice(0, 8).map((column) => `<td>${formatCell(column, row[column])}</td>`).join("");
    const actions = canEditUsers
      ? `<button class="ghost-btn" data-edit="${escapeAttr(row[key])}">Edit</button>${sheet === "Users" ? ` <button class="danger-btn ghost-btn" data-delete="${escapeAttr(row[key])}">Delete</button>` : ""}`
      : "";
    return `<tr>${cells}<td class="actions">${actions}</td></tr>`;
  }).join("");

  $("#tableBody").querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = columns[0];
      const row = rows.find((item) => item[key] === button.dataset.edit);
      openRecordDialog(row);
    });
  });
  $("#tableBody").querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.delete));
  });
}

async function openRecordDialog(record = null) {
  const sheet = modules[state.activeModule].sheet;
  if (sheet === "Users" && !isAdmin()) return;
  state.editingRecord = record;
  $("#dialogTitle").textContent = `${record ? "Edit" : "New"} ${modules[state.activeModule].label}`;
  if (sheet === "Users") {
    await ensureUserFormLookups();
    $("#formFields").innerHTML = renderUserForm(record);
    $("#formFields").querySelector("[name='phone_number']")?.addEventListener("input", formatPhoneInput);
  } else {
    $("#formFields").innerHTML = schemas[sheet].map((field) => {
      const value = record?.[field] || "";
      const wide = ["notes", "address", "issue_description", "checklist_results", "issues_found"].includes(field) ? "wide" : "";
      const input = wide
        ? `<textarea name="${field}">${escapeHtml(value)}</textarea>`
        : `<input name="${field}" value="${escapeAttr(value)}">`;
      return `<label class="${wide}">${humanize(field)}${input}</label>`;
    }).join("");
  }
  $("#recordDialog").showModal();
}

async function saveRecord(event) {
  event.preventDefault();
  try {
    const sheet = modules[state.activeModule].sheet;
    const form = new FormData($("#recordForm"));
    const record = {};
    if (sheet === "Users") {
      const password = String(form.get("password") || "");
      const confirmPassword = String(form.get("confirm_password") || "");
      if (!state.editingRecord && !password) throw new Error("Password is required");
      if (password !== confirmPassword) throw new Error("Passwords do not match");
      if (state.editingRecord?.user_id) record.user_id = state.editingRecord.user_id;
      ["username", "full_name", "user_role", "profile_image", "email", "phone_number", "business_id", "location_id", "account_status"].forEach((field) => {
        record[field] = form.get(field) || "";
      });
      if (password) record.password = password;
      const imageFile = form.get("profile_image_file");
      if (imageFile && imageFile.size) {
        const uploaded = await uploadDashboardFile(imageFile);
        record.profile_image = uploaded.directUrl || uploaded.url;
      }
    } else {
      schemas[sheet].forEach((field) => {
        record[field] = form.get(field) || "";
      });
    }
    await api("upsert", { sheet, record });
    invalidateSheet(sheet);
    $("#recordDialog").close();
    await loadSheet(sheet);
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteRecord(id) {
  const sheet = modules[state.activeModule].sheet;
  if (sheet !== "Users" || !isAdmin()) return;
  const row = (state.records.Users || []).find((item) => item.user_id === id);
  const name = row?.full_name || row?.username || id;
  if (!window.confirm(`Delete user ${name}?`)) return;
  await api("archive", { sheet, id });
  invalidateSheet(sheet);
  await loadSheet(sheet);
}

async function ensureUserFormLookups() {
  await Promise.all([
    refreshSheet("Businesses").catch(() => []),
    refreshSheet("Locations").catch(() => [])
  ]);
}

function renderUserForm(record) {
  return userFormFields.map((field) => renderUserField(field, record)).join("");
}

function renderUserField(field, record) {
  const value = record?.[field] || "";
  if (field === "profile_image") {
    const previewUrl = profileImageUrl(value);
    return `
      <label class="wide">Profile Image
        ${previewUrl ? `<img class="image-preview" src="${escapeAttr(previewUrl)}" alt="">` : ""}
        <input type="hidden" name="profile_image" value="${escapeAttr(value)}">
        <input name="profile_image_file" type="file" accept="image/*">
      </label>
    `;
  }
  if (field === "password" || field === "confirm_password") {
    const required = state.editingRecord ? "" : " required";
    const autocomplete = field === "password" ? "new-password" : "new-password";
    return `<label>${humanize(field)}<input name="${field}" type="password" autocomplete="${autocomplete}"${required}></label>`;
  }
  if (field === "business_id") {
    return `<label>Business ID${selectInput(field, value, businessOptions(), "Select business")}</label>`;
  }
  if (field === "location_id") {
    return `<label>Location ID${selectInput(field, value, locationOptions(), "Select location")}</label>`;
  }
  if (field === "account_status") {
    return `<label>Status${selectInput(field, value || "active", userStatusOptions, "Select status")}</label>`;
  }
  if (field === "user_role") {
    return `<label>User Role${selectInput(field, value || "Operator", userRoleOptions.map((role) => [role, role]), "Select role")}</label>`;
  }
  const type = field === "email" ? "email" : field === "phone_number" ? "tel" : "text";
  const required = ["username", "full_name"].includes(field) ? " required" : "";
  const maxlength = field === "phone_number" ? " maxlength=\"12\"" : "";
  const placeholder = field === "phone_number" ? " placeholder=\"xxx-xxx-xxxx\"" : "";
  return `<label>${humanize(field)}<input name="${field}" type="${type}" value="${escapeAttr(value)}"${required}${maxlength}${placeholder}></label>`;
}

function businessOptions() {
  return (state.records.Businesses || []).map((item) => [item.business_id, `${item.business_id} - ${item.business_name || "Business"}`]);
}

function locationOptions() {
  return (state.records.Locations || []).map((item) => [item.location_id, `${item.location_id} - ${item.location_name || "Location"}`]);
}

function selectInput(name, value, options, placeholder) {
  const optionHtml = options.map(([optionValue, label]) => `<option value="${escapeAttr(optionValue)}"${String(optionValue) === String(value) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  return `<select name="${name}" required><option value="">${escapeHtml(placeholder)}</option>${optionHtml}</select>`;
}

function formatPhoneInput(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
  event.target.value = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join("-");
}

async function uploadDashboardFile(file) {
  const base64 = await blobToBase64(file);
  const data = await api("uploadFile", {
    fileName: file.name,
    mimeType: file.type,
    base64
  });
  return data.file;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatCell(column, value) {
  if (column === "profile_image") {
    const url = profileImageUrl(value);
    return url ? `<img class="avatar-cell" src="${escapeAttr(url)}" alt="">` : "";
  }
  return escapeHtml(value || "");
}

function profileImageUrl(value) {
  const text = String(value || "");
  const match = text.match(/=IMAGE\("([^"]+)"/i);
  const url = match ? match[1].replaceAll('""', '"') : text;
  return driveThumbnailUrl(url);
}

function driveThumbnailUrl(url) {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w160` : url;
}

function extractDriveFileId(url) {
  const text = String(url || "");
  const match = text.match(/\/d\/([^/?]+)/) || text.match(/[?&]id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function statusFieldFor(sheet) {
  if (sheet === "Users") return "account_status";
  if (sheet === "Businesses") return "business_status";
  if (sheet === "Forklifts") return "forklift_status";
  if (sheet === "Certifications") return "status";
  return "status";
}

function isAdmin() {
  return state.session?.user?.user_role === "Admin";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function humanize(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
