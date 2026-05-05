let mobileForklift = null;
let drawing = false;

document.addEventListener("DOMContentLoaded", () => {
  $("#mobileLoginForm").addEventListener("submit", mobileLogin);
  $("#mobileLogout").addEventListener("click", mobileLogout);
  $("#backToForklifts").addEventListener("click", () => showMobile("forkliftList"));
  $("#inspectionForm").addEventListener("submit", submitMobileInspection);
  $("#clearSignature").addEventListener("click", clearSignature);
  setupSignaturePad();
});

async function mobileLogin(event) {
  event.preventDefault();
  $("#mobileError").textContent = "";
  try {
    const data = await api("login", {
      username: $("#mobileUsername").value.trim(),
      password: $("#mobilePassword").value
    });
    state.session = { token: data.token, user: data.user };
    if (!["Admin", "Area Manager", "Manager", "Supervisor", "Operator"].includes(data.user.user_role)) {
      throw new Error("This account cannot use mobile inspections");
    }
    await loadMobileForklifts();
    $("#mobileLogout").classList.remove("hidden");
    showMobile("forkliftList");
  } catch (error) {
    $("#mobileError").textContent = error.message;
  }
}

function mobileLogout() {
  state.session = null;
  $("#mobileLogout").classList.add("hidden");
  showMobile("mobileLogin");
}

function showMobile(id) {
  ["mobileLogin", "forkliftList", "inspectionPanel"].forEach((panel) => {
    $(`#${panel}`).classList.toggle("hidden", panel !== id);
  });
}

async function loadMobileForklifts() {
  const data = await api("list", { sheet: "Forklifts" });
  const user = state.session.user;
  const rows = data.rows.filter((row) => {
    if (user.user_role !== "Operator") return true;
    return !row.user_assigned || row.user_assigned === user.user_id || row.user_assigned === user.username;
  });
  $("#mobileForklifts").innerHTML = rows.map((row) => `
    <article class="forklift-tile">
      <strong>${row.forklift_brand || ""} ${row.forklift_model || ""}</strong>
      <span class="muted">Serial ${row.forklift_serial || row.forklift_id}</span>
      <span class="muted">Status ${row.forklift_status || "active"}</span>
      <button class="primary-btn" data-start="${row.forklift_id}">Start inspection</button>
    </article>
  `).join("");
  $("#mobileForklifts").querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", async () => {
      mobileForklift = rows.find((row) => row.forklift_id === button.dataset.start);
      await startInspection();
    });
  });
}

async function startInspection() {
  const checklist = await api("list", { sheet: "Checklist Template" });
  $("#inspectionTitle").textContent = `Inspect ${mobileForklift.forklift_serial || mobileForklift.forklift_id}`;
  $("#checklistFields").innerHTML = checklist.rows.filter((row) => String(row.active).toLowerCase() !== "no").map((row) => `
    <label class="check-row">
      <span>${row.question_text}</span>
      <select name="check_${row.question_id}" ${String(row.required).toLowerCase() === "yes" ? "required" : ""}>
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
        <option value="na">N/A</option>
      </select>
    </label>
  `).join("");
  clearSignature();
  showMobile("inspectionPanel");
}

async function submitMobileInspection(event) {
  event.preventDefault();
  const form = new FormData($("#inspectionForm"));
  const checklist = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("check_")) checklist[key.replace("check_", "")] = value;
  }
  const photo1 = await uploadInputFile("photo_1", form.get("photo_1"));
  const photo2 = await uploadInputFile("photo_2", form.get("photo_2"));
  const signature = await uploadSignature();
  await api("submitInspection", {
    record: {
      forklift_id: mobileForklift.forklift_id,
      mileage: form.get("mileage"),
      checklist_results: JSON.stringify(checklist),
      issues_found: form.get("issues_found"),
      notes: form.get("notes"),
      photo_1: photo1.url,
      photo_2: photo2.url,
      signature_image: signature.url,
      overall_status: form.get("overall_status")
    }
  });
  $("#inspectionForm").reset();
  await loadMobileForklifts();
  showMobile("forkliftList");
}

async function uploadInputFile(field, file) {
  if (!file || !file.size) throw new Error(`${field} is required`);
  return uploadBlob(file.name, file.type, await blobToBase64(file));
}

async function uploadSignature() {
  const canvas = $("#signaturePad");
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return uploadBlob(`signature-${Date.now()}.png`, "image/png", await blobToBase64(blob));
}

async function uploadBlob(fileName, mimeType, base64) {
  if (!API_URL) return { url: "demo-upload" };
  const data = await api("uploadFile", { fileName, mimeType, base64 });
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

function setupSignaturePad() {
  const canvas = $("#signaturePad");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#19202a";
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  const start = (event) => {
    drawing = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.preventDefault();
  };
  const move = (event) => {
    if (!drawing) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    event.preventDefault();
  };
  const end = () => {
    drawing = false;
  };
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}

function clearSignature() {
  const canvas = $("#signaturePad");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
