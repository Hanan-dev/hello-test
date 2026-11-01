const topicCategories = { All: "general", World: "general", Technology: "technology", Business: "business", Culture: "entertainment", Science: "science" };
const categoryColors = { World: "world", Technology: "technology", Business: "business", Culture: "culture", Science: "science" };
const topicNames = { general: "News", technology: "Technology", business: "Business", entertainment: "Culture", science: "Science" };
const availableTopics = Object.keys(topicCategories).filter((topic) => topic !== "All");
const state = { view: "for-you", topic: "All", favoriteTopics: loadFavoriteTopics(), query: "", sort: "recommended", country: "us", stories: [], saved: loadSaved(), loading: false, error: "", requestId: 0 };
const grid = document.querySelector("#story-grid");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const dialog = document.querySelector("#story-dialog");
const topicsDialog = document.querySelector("#topics-dialog");
const feedMessage = document.querySelector("#feed-message");
const feedMessageText = document.querySelector("#feed-message-text");
const retryButton = document.querySelector("#retry-button");
let toastTimer;
let searchTimer;

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("signal-saved-stories") || "[]");
    return Array.isArray(saved) ? saved.filter((story) => story && typeof story === "object" && story.url) : [];
  }
  catch { return []; }
}

function loadFavoriteTopics() {
  try {
    const topics = JSON.parse(localStorage.getItem("signal-favorite-topics") || "[]");
    return Array.isArray(topics) ? [...new Set(topics.filter((topic) => availableTopics.includes(topic)))] : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function safeUrl(value, allowHttp = false) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (allowHttp && url.protocol === "http:") ? url.href : "";
  } catch { return ""; }
}

function formatTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "RECENTLY";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR${hours === 1 ? "" : "S"} AGO`;
  return `${Math.floor(hours / 24)} DAY${hours < 48 ? "" : "S"} AGO`;
}

function normalizeArticle(article) {
  const url = safeUrl(article.url, true);
  if (!url || !article.title || article.title === "[Removed]") return null;
  const category = state.topic !== "All"
    ? state.topic
    : article.category === "general" && state.favoriteTopics.includes("World")
      ? "World"
      : topicNames[article.category] || "News";
  return {
    id: url,
    url,
    title: article.title,
    deck: article.description || "Open the full story for more details.",
    source: article.source?.name || "News source",
    author: article.author || article.source?.name || "News desk",
    image: safeUrl(article.urlToImage),
    publishedAt: article.publishedAt,
    category,
    color: categoryColors[category] || "news",
    minutes: "5 MIN READ"
  };
}

function render() {
  const query = state.query.trim().toLowerCase();
  const stories = state.view === "saved" ? state.saved : state.stories;
  let visible = stories.filter((story) => !query || `${story.title} ${story.deck} ${story.category} ${story.source} ${story.author}`.toLowerCase().includes(query));
  if (state.sort === "latest") visible = [...visible].sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt));
  const lead = state.view === "saved" ? null : visible[0];
  const leadSection = document.querySelector("#lead-story");
  leadSection.hidden = !lead;
  document.querySelector("#lead-count").textContent = `01 / ${String(visible.length).padStart(2, "0")}`;
  if (lead) {
    document.querySelector("#lead-category").className = `category-tag tag-${lead.color}`;
    document.querySelector("#lead-category").textContent = lead.category.toUpperCase();
    document.querySelector("#lead-time").textContent = formatTime(lead.publishedAt);
    document.querySelector("#lead-title").textContent = lead.title;
    document.querySelector("#lead-deck").textContent = lead.deck;
    document.querySelector("#lead-author").textContent = lead.author;
    document.querySelector("#lead-source").textContent = lead.source;
    document.querySelector("#lead-initials").textContent = lead.author.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    document.querySelector("#lead-image").src = lead.image || "";
    document.querySelector("#lead-image").alt = lead.title;
    const leadSave = document.querySelector("#lead-save");
    leadSave.dataset.save = lead.id;
    const isLeadSaved = state.saved.some((story) => story.id === lead.id);
    leadSave.classList.toggle("is-saved", isLeadSaved);
    leadSave.setAttribute("aria-pressed", String(isLeadSaved));
    leadSave.setAttribute("aria-label", isLeadSaved ? "Remove saved top story" : "Save top story");
    document.querySelector("#lead-story").dataset.storyId = lead.id;
  }
  const cardStories = visible.filter((story) => !lead || story.id !== lead.id);

  grid.innerHTML = cardStories.map((story, index) => `
    <article class="story-card" style="animation-delay:${Math.min(index * 45, 225)}ms">
      <div class="card-image-wrap">${story.image ? `<img class="card-image" src="${escapeHtml(story.image)}" alt="${escapeHtml(story.title)}" loading="lazy" />` : ""}<button class="icon-button save-button ${state.saved.some((saved) => saved.id === story.id) ? "is-saved" : ""}" data-save="${escapeHtml(story.id)}" type="button" aria-label="${state.saved.some((saved) => saved.id === story.id) ? "Remove saved story" : "Save story"}" aria-pressed="${state.saved.some((saved) => saved.id === story.id)}"><i data-lucide="bookmark"></i></button></div>
      <div class="card-copy"><div class="card-meta"><span class="category-tag tag-${story.color}">${escapeHtml(story.category.toUpperCase())}</span><span>${escapeHtml(story.source.toUpperCase())}</span><span>·</span><span>${escapeHtml(formatTime(story.publishedAt))}</span></div><h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.deck)}</p><div class="card-footer"><span class="card-author">${escapeHtml(story.author)} &nbsp;·&nbsp; ${story.minutes}</span><a class="card-read" href="#story" data-story="${escapeHtml(story.id)}">Read story <i data-lucide="arrow-up-right"></i></a></div></div>
    </article>`).join("");

  document.querySelector("#story-total").textContent = String(visible.length).padStart(2, "0");
  document.querySelector("#stories-heading-label").textContent = state.view === "saved"
    ? "Saved stories"
    : state.view === "for-you" && state.topic === "All" && state.favoriteTopics.length
      ? "Your daily mix"
      : state.topic === "All" ? "Today's stories" : `${state.topic} stories`;
  const subtitle = document.querySelector("#welcome-subtitle");
  if (state.view === "saved") {
    subtitle.textContent = "Stories you’ve saved to read later.";
  } else if (state.view === "for-you" && state.topic === "All" && state.favoriteTopics.length) {
    subtitle.textContent = `A thoughtful mix of ${state.favoriteTopics.join(", ")} stories, picked for you.`;
  } else if (state.view === "for-you" && state.topic === "All") {
    subtitle.textContent = "Choose favorite topics to make your daily mix yours.";
  } else {
    subtitle.textContent = "Here’s what’s worth your attention today.";
  }
  document.querySelector("#feed-count").textContent = state.stories.length || "";
  document.querySelector("#saved-count").textContent = state.saved.length || "";
  grid.hidden = cardStories.length === 0;
  emptyState.hidden = cardStories.length !== 0 || Boolean(lead) || state.loading;
  feedMessage.hidden = !state.loading && !state.error;
  feedMessage.classList.toggle("is-error", Boolean(state.error));
  feedMessageText.textContent = state.error || (state.loading ? "Fetching the latest headlines…" : "");
  retryButton.hidden = !state.error;
  document.querySelector("#briefing-list").innerHTML = visible.slice(0, 3).map((story, index) => `<li><span class="brief-number">${String(index + 1).padStart(2, "0")}</span><p><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(story.source)} · ${escapeHtml(formatTime(story.publishedAt).toLowerCase())}</small></p></li>`).join("");
  document.querySelector("#more-headlines").innerHTML = visible.slice(3, 6).map((story, index) => `<a href="${escapeHtml(story.url)}" class="most-read-item" target="_blank" rel="noreferrer"><span class="rank">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(story.source)} · ${escapeHtml(formatTime(story.publishedAt).toLowerCase())}</small></span></a>`).join("");
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.view));
  document.querySelectorAll(".topic-item").forEach((button) => {
    const isActive = button.dataset.topic === state.topic;
    const isFavorite = state.favoriteTopics.includes(button.dataset.topic);
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-favorite", isFavorite);
    button.setAttribute("aria-pressed", String(isActive));
    if (button.dataset.topic !== "All") {
      button.setAttribute("aria-label", `${button.dataset.topic}${isFavorite ? ", favorite topic" : ""}`);
    }
  });
  if (window.lucide) window.lucide.createIcons();
}

async function fetchStories() {
  const requestId = ++state.requestId;
  state.loading = true;
  state.error = "";
  render();
  const useFavorites = state.view === "for-you" && state.topic === "All" && state.favoriteTopics.length > 0;
  const parameters = new URLSearchParams({ country: state.country });
  if (useFavorites) {
    parameters.set("categories", state.favoriteTopics.map((topic) => topicCategories[topic]).join(","));
  } else {
    parameters.set("category", topicCategories[state.topic] || "general");
  }
  if (state.query.trim()) parameters.set("q", state.query.trim());
  try {
    const response = await fetch(`/api/news?${parameters.toString()}`);
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("The news API endpoint did not return JSON. Start the app with `python3 server.py` instead of a static file server.");
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Could not fetch headlines.");
    if (requestId !== state.requestId) return;
    state.stories = (payload.articles || []).map((article) => normalizeArticle(article)).filter(Boolean);
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.stories = [];
    state.error = error.message || "Could not fetch headlines. Try again.";
  } finally {
    if (requestId === state.requestId) {
      state.loading = false;
      render();
    }
  }
}

function saveStory(id) {
  const existingIndex = state.saved.findIndex((story) => story.id === id);
  if (existingIndex !== -1) {
    state.saved.splice(existingIndex, 1);
    showToast("Removed from your saved stories");
  } else {
    const story = [...state.stories, ...state.saved].find((item) => item.id === id);
    if (!story) return;
    state.saved = [story, ...state.saved].slice(0, 100);
    showToast("Saved for later");
  }
  try { localStorage.setItem("signal-saved-stories", JSON.stringify(state.saved)); }
  catch { showToast("Could not save this story in your browser"); }
  render();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

function openStory(id) {
  const story = [...state.stories, ...state.saved].find((item) => item.id === id);
  if (!story) return;
  document.querySelector("#dialog-category").className = `category-tag tag-${story.color}`;
  document.querySelector("#dialog-category").textContent = story.category.toUpperCase();
  document.querySelector("#dialog-title").textContent = story.title;
  document.querySelector("#dialog-deck").textContent = story.deck;
  document.querySelector("#dialog-byline").textContent = `${story.author} · ${story.source} · ${story.minutes}`;
  document.querySelector("#dialog-source").href = story.url;
  dialog.showModal();
}

function openTopicsDialog() {
  document.querySelectorAll('input[name="favorite-topic"]').forEach((input) => {
    input.checked = state.favoriteTopics.includes(input.value);
  });
  topicsDialog.showModal();
}

const today = new Date();
document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(today).toUpperCase();
document.querySelector("#edition-date").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(today).toUpperCase();
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  state.view = button.dataset.view;
  if (state.view === "saved") { state.loading = false; state.error = ""; render(); }
  else {
    state.sort = state.view === "latest" ? "latest" : "recommended";
    if (state.view === "for-you") state.topic = "All";
    document.querySelector("#sort-select").value = state.sort;
    fetchStories();
  }
}));
document.querySelectorAll(".topic-item").forEach((button) => button.addEventListener("click", () => { state.topic = button.dataset.topic; state.view = "for-you"; fetchStories(); }));
document.querySelector("#manage-topics").addEventListener("click", openTopicsDialog);
document.querySelector("#topics-dialog-close").addEventListener("click", () => topicsDialog.close());
document.querySelector("#topics-cancel").addEventListener("click", () => topicsDialog.close());
document.querySelector("#topics-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const favoriteTopics = [...document.querySelectorAll('input[name="favorite-topic"]:checked')].map((input) => input.value);
  try {
    localStorage.setItem("signal-favorite-topics", JSON.stringify(favoriteTopics));
  } catch {
    showToast("Could not save your topics in this browser");
    return;
  }
  state.favoriteTopics = favoriteTopics;
  state.topic = "All";
  state.view = "for-you";
  document.querySelector("#sort-select").value = "recommended";
  topicsDialog.close();
  fetchStories();
});
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  if (state.view === "saved") { render(); return; }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchStories, 350);
});
document.querySelector("#country-select").addEventListener("change", (event) => { state.country = event.target.value; fetchStories(); });
document.querySelector("#sort-select").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
document.querySelector("#story-grid").addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save]");
  if (saveButton) { saveStory(saveButton.dataset.save); return; }
  const storyLink = event.target.closest("[data-story]");
  if (storyLink) { event.preventDefault(); openStory(storyLink.dataset.story); }
});
document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => saveStory(button.dataset.save)));
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
document.querySelector("#clear-filters").addEventListener("click", () => {
  state.topic = "All"; state.query = ""; state.view = "for-you"; searchInput.value = ""; document.querySelector("#sort-select").value = "recommended"; fetchStories();
});
document.querySelector("#briefing-button").addEventListener("click", () => showToast("Audio briefings are coming soon"));
document.querySelector("#read-briefing").addEventListener("click", () => document.querySelector("#stories-heading").scrollIntoView({ behavior: "smooth" }));
document.querySelector("#retry-button").addEventListener("click", fetchStories);
document.querySelector("#lead-story").addEventListener("click", (event) => {
  if (event.target.closest("#lead-title")) openStory(event.currentTarget.dataset.storyId);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
  if (event.key === "Escape" && (dialog.open || topicsDialog.open)) {
    if (dialog.open) dialog.close();
    if (topicsDialog.open) topicsDialog.close();
  }
});

render();
fetchStories();