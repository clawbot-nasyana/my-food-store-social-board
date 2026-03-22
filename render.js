const state = {
  client: null,
  concepts: null,
  currentRatio: '1:1',
  posts: []
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function flattenPosts(concepts) {
  return concepts.varieties.flatMap((variety) =>
    variety.posts.map((post) => ({ ...post, varietyName: variety.name, varietyDescription: variety.description }))
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPostBody(post) {
  const { content, layout } = post;

  if (layout === 'STAT_BIG_NUMBER') {
    return `
      <div class="layout-stat">
        <div>
          <p class="stat-number">${escapeHtml(content.stat)}</p>
          <p class="stat-label">${escapeHtml(content.label)}</p>
          <p class="stat-subtext">${escapeHtml(content.subtext || '')}</p>
        </div>
      </div>
    `;
  }

  if (layout === 'QUOTE_TESTIMONIAL') {
    return `
      <div class="layout-quote">
        <div class="quote-mark">“</div>
        <p class="quote-text">${escapeHtml(content.quote)}</p>
        <div>
          <p class="quote-author">${escapeHtml(content.author)}</p>
          <p class="quote-title">${escapeHtml(content.title || '')}</p>
        </div>
      </div>
    `;
  }

  if (layout === 'SERVICE_3_BULLETS') {
    const bullets = (content.bullets || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `
      <div class="layout-bullets">
        <div>
          <h4 class="bullet-title">${escapeHtml(content.title)}</h4>
          <p class="bullet-note">Small joys. Big flavor.</p>
        </div>
        <ul class="bullet-list">${bullets}</ul>
      </div>
    `;
  }

  return `<div class="empty-state">Unsupported layout: ${escapeHtml(layout)}</div>`;
}

function createTile(post, index) {
  const ratioClass = state.currentRatio === '4:5' ? 'ratio-4-5' : 'ratio-1-1';
  const layoutClass = post.layout === 'STAT_BIG_NUMBER' ? 'layout-stat' : post.layout === 'QUOTE_TESTIMONIAL' ? 'layout-quote' : 'layout-bullets';
  const article = document.createElement('article');
  article.className = 'board-tile';
  article.innerHTML = `
    <div class="tile-head">
      <div class="tile-meta">
        <h3>Post ${escapeHtml(post.id)} · ${escapeHtml(post.varietyName)}</h3>
        <p>${escapeHtml(post.layout.replaceAll('_', ' '))}</p>
      </div>
      <button class="tile-download" data-id="${escapeHtml(post.id)}">Download PNG</button>
    </div>
    <div class="post-card ${ratioClass}" data-post-id="${escapeHtml(post.id)}">
      <div class="post-inner ${layoutClass}">
        <div class="post-topline">
          <div class="post-brand">
            <img src="./assets/logo.svg" alt="My Food Store logo" />
            <span>${escapeHtml(state.client.clientName)}</span>
          </div>
          <span class="variety-pill">${escapeHtml(post.varietyName)}</span>
        </div>
        ${renderPostBody(post)}
      </div>
    </div>
    <div class="tile-foot">Concept ${index + 1} of ${state.posts.length}</div>
  `;
  return article;
}

function renderBoard() {
  const grid = document.getElementById('boardGrid');
  grid.innerHTML = '';
  state.posts.forEach((post, index) => grid.appendChild(createTile(post, index)));
}

function setRatio(ratio) {
  state.currentRatio = ratio;
  document.querySelectorAll('.ratio-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.ratio === ratio);
  });
  renderBoard();
}

async function capturePostElement(element) {
  return html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false
  });
}

async function downloadSingle(postId) {
  const card = document.querySelector(`[data-post-id="${CSS.escape(String(postId))}"]`);
  const canvas = await capturePostElement(card);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `my-food-store-post-${postId}-${state.currentRatio.replace(':', 'x')}.png`;
  link.click();
}

async function downloadAll() {
  const button = document.getElementById('downloadAllBtn');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing ZIP…';

  try {
    const zip = new JSZip();
    for (const post of state.posts) {
      const card = document.querySelector(`[data-post-id="${CSS.escape(String(post.id))}"]`);
      const canvas = await capturePostElement(card);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      zip.file(`my-food-store-post-${post.id}-${state.currentRatio.replace(':', 'x')}.png`, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `my-food-store-social-board-${state.currentRatio.replace(':', 'x')}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    console.error(error);
    alert('Download failed. Open the console for details.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function attachEvents() {
  document.querySelectorAll('.ratio-btn').forEach((btn) => {
    btn.addEventListener('click', () => setRatio(btn.dataset.ratio));
  });

  document.getElementById('boardGrid').addEventListener('click', (event) => {
    const button = event.target.closest('.tile-download');
    if (!button) return;
    downloadSingle(button.dataset.id).catch((error) => {
      console.error(error);
      alert('Tile download failed.');
    });
  });

  document.getElementById('downloadAllBtn').addEventListener('click', () => {
    downloadAll();
  });
}

async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  const [client, concepts] = await Promise.all([
    loadJson('./client.json'),
    loadJson('./concepts.json')
  ]);
  state.client = client;
  state.concepts = concepts;
  state.posts = flattenPosts(concepts);
  renderBoard();
  attachEvents();
}

init().catch((error) => {
  console.error(error);
  document.getElementById('boardGrid').innerHTML = `<div class="empty-state">Unable to load board data.</div>`;
});
