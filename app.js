const API_URL = "https://dauvsboeeuimrkykkqlh.functions.supabase.co/event-rsvp";
const token = new URLSearchParams(window.location.search).get("token");

const elements = {
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  rsvp: document.querySelector("#rsvp"),
  intro: document.querySelector("#intro"),
  member: document.querySelector("#member"),
  schedule: document.querySelector("#schedule"),
  location: document.querySelector("#location"),
  availability: document.querySelector("#availability"),
  actionArea: document.querySelector("#action-area"),
  confirmButton: document.querySelector("#confirm-button"),
  outcome: document.querySelector("#outcome"),
  outcomeIcon: document.querySelector("#outcome-icon"),
  outcomeTitle: document.querySelector("#outcome-title"),
  outcomeMessage: document.querySelector("#outcome-message"),
};

let preview = null;

function apiUrl() {
  const url = new URL(API_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("token", token ?? "");
  return url.toString();
}

function showError(title, message) {
  elements.loading.hidden = true;
  elements.rsvp.hidden = true;
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  elements.error.hidden = false;
}

function formatDate(eventDate) {
  const date = new Date(`${eventDate}T12:00:00-07:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSchedule(data) {
  const date = formatDate(data.eventDate);
  const start = formatTime(data.startsAt);
  const end = formatTime(data.endsAt);
  return start && end ? `${date} · ${start}–${end}` : date;
}

function isWaitlisted(status) {
  return status === "WAITLISTED" || status === "OVERFLOW_RECORD";
}

function showOutcome(status, position, duplicate = false) {
  const waitlisted = isWaitlisted(status);
  elements.actionArea.hidden = true;
  elements.intro.textContent = duplicate
    ? "Your response was already recorded. Here are your current RSVP details."
    : "Your response has been saved.";
  elements.outcome.classList.toggle("waitlist", waitlisted);
  elements.outcomeIcon.textContent = waitlisted ? "#" : "✓";
  elements.outcomeTitle.textContent = waitlisted
    ? "You’re on the waitlist"
    : "Your spot is confirmed";
  elements.outcomeMessage.textContent = waitlisted
    ? `You are waitlist #${Math.max(1, position - preview.capacity)}. We’ll contact you if a spot opens.`
    : `You’re registered at position ${position} of ${preview.capacity}. We look forward to seeing you.`;
  elements.outcome.hidden = false;
}

function render(data) {
  preview = data;
  elements.member.textContent = `${data.fullName} · ${data.email}`;
  elements.schedule.textContent = formatSchedule(data);
  elements.availability.textContent = `${data.capacity} spots · First come, first served`;

  if (data.location) {
    elements.location.textContent = data.location;
    elements.location.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.location)}`;
  } else {
    elements.location.textContent = "Location to be announced";
    elements.location.removeAttribute("href");
  }

  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.rsvp.hidden = false;

  if (data.existingStatus && Number.isInteger(data.existingPosition)) {
    showOutcome(data.existingStatus, data.existingPosition, true);
  } else if (!data.isOpen) {
    elements.actionArea.hidden = true;
    elements.intro.textContent = "Registration for this event is closed.";
  }
}

async function loadPreview() {
  if (!token) {
    showError(
      "This link is incomplete",
      "Please open the full RSVP link from your ALI email or contact support.",
    );
    return;
  }

  try {
    const response = await fetch(apiUrl(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload?.error?.message ?? "This RSVP could not be loaded.");
    }
    render(payload.data.preview);
  } catch (error) {
    showError(
      "We couldn’t open this RSVP",
      error instanceof Error
        ? error.message
        : "Please try again or contact support@ali-ca.org.",
    );
  }
}

async function confirmSpot() {
  elements.confirmButton.disabled = true;
  elements.confirmButton.textContent = "Saving…";

  try {
    const response = await fetch(apiUrl(), {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({ confirm: "yes" }),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload?.error?.message ?? "Your RSVP could not be saved.");
    }
    preview = payload.data.preview;
    showOutcome(
      payload.data.result.signup_status,
      payload.data.result.submission_position,
      payload.data.result.duplicate,
    );
  } catch (error) {
    elements.confirmButton.disabled = false;
    elements.confirmButton.textContent = "Confirm my spot";
    showError(
      "We couldn’t save your RSVP",
      error instanceof Error
        ? error.message
        : "Please try again or contact support@ali-ca.org.",
    );
  }
}

elements.confirmButton.addEventListener("click", confirmSpot);
loadPreview();
