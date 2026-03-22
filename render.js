const appState = {
  client: null,
  concepts: null,
  posts: [],
  ratio: '1:1'
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function flattenPosts(concepts) {
  return concepts.varieties.flatMap((variety) =>
    variety.posts.map((post) => ({
      ...post,
      varietyName: variety.name,
      varietyDescription: variety.description
    }))
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanBullet(value) {
  return String(value ?? '').replace(/^\s*✓\s*/, '').trim();
}

function renderLayout(post) {
  const { layout, content } = post;

  if (layout === 'STAT_BIG_NUMBER') {
    return `
      <div class="tile-content layout-stat">
        <p class="stat-number">${escapeHtml(content.stat)}</p>
        <p class="stat-label">${escapeHtml(content.label)}</p>
        <p class="stat-subtext">${escapeHtml(content.subtext)}</p>
      </div>
    `;
  }

  if (layout === 'QUOTE_TESTIMONIAL') {
    return `
      <div class="tile-content layout-quote">
        <div class="quote-mark">“</div>
        <p class="quote-text">${escapeHtml(content.quote)}</p>
        <p class="quote-author">${escapeHtml(content.author)}</p>
        <p class="quote-title">${escapeHtml(content.title)}</p>
      </div>
    `;
  }

  if (layout === 'SERVICE_3_BULLETS') {
    const items = (content.bullets || [])
      .map((bullet) => `<li>${escapeHtml(cleanBullet(bullet))}</li>`)
      .join('');

    return `
      <div class="tile-content layout-bullets">
        <h3 class="bullet-title">${escapeHtml(content.title)}</h3>
        <ul class="bullet-list">${items}</ul>
      </div>
    `;
  }

  return `
    <div class="tile-content">
      <p class="stat-subtext">Unsupported layout: ${escapeHtml(layout)}</p>
    </div>
  `;
}

function createBoardItem(post) {
  const wrapper = document.createElement('article');
  wrapper.className = 'board-item';

  const ratioClass = appState.ratio === '4:5' ? 'ratio-4-5' : 'ratio-1-1';
  const typeLabel = post.layout.replaceAll('_', ' ');

  wrapper.innerHTML = `
    <div class="tile">
      <div class="tile-frame ${ratioClass}" data-post-id="${escapeHtml(post.id)}">
        <div class="tile-canvas">
          <div class="tile-meta">
            <span class="tile-id">Post ${escapeHtml(post.id)}</span>
            <span class="tile-variety">${escapeHtml(post.varietyName)}</span>
          </div>
          ${renderLayout(post)}
          <img src="./assets/logo.svg" alt="${escapeHtml(appState.client.clientName)} logo" class="tile-logo" />
        </div>
      </div>
    </div>
    <div class="tile-actions">
      <button type="button" class="btn btn-outline tile-download" data-post-id="${escapeHtml(post.id)}">Download PNG</button>
    </div>
  `;

  wrapper.querySelector('.tile').setAttribute('data-layout', typeLabel);
  return wrapper;
}

function renderBoard() {
  const boardGrid = document.getElementById('boardGrid');

  if (!appState.posts.length) {
    boardGrid.innerHTML = '<div class="empty-state">No posts available.</div>';
    return;
  }

  boardGrid.innerHTML = '';
  appState.posts.forEach((post) => {
    boardGrid.appendChild(createBoardItem(post));
  });
}

function updateRatioButtons() {
  document.querySelectorAll('.ratio-btn').forEach((button) => {
    const isActive = button.dataset.ratio === appState.ratio;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function setRatio(ratio) {
  appState.ratio = ratio;
  updateRatioButtons();
  renderBoard();
}

async function captureElement(element) {
  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false
  });
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not create PNG blob.'));
      }
    }, 'image/png');
  });
}

function fileName(postId, ratio) {
  return `my-food-store-post-${postId}-${ratio.replace(':', 'x')}.png`;
}

async function downloadPost(postId, triggerButton) {
  const target = document.querySelector(`[data-post-id="${CSS.escape(String(postId))}"]`);
  if (!target) {
    throw new Error(`Post ${postId} not found.`);
  }

  const originalText = triggerButton ? triggerButton.textContent : '';
  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = 'Preparing...';
  }

  try {
    const canvas = await captureElement(target);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = fileName(postId, appState.ratio);
    link.click();
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalText;
    }
  }
}

async function downloadAll() {
  const button = document.getElementById('downloadAllBtn');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing ZIP...';

  try {
    const zip = new JSZip();

    for (const post of appState.posts) {
      const target = document.querySelector(`[data-post-id="${CSS.escape(String(post.id))}"]`);
      const canvas = await captureElement(target);
      const blob = await canvasToBlob(canvas);
      zip.file(fileName(post.id, appState.ratio), blob);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `my-food-store-social-board-${appState.ratio.replace(':', 'x')}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function bindEvents() {
  document.querySelectorAll('.ratio-btn').forEach((button) => {
    button.addEventListener('click', () => setRatio(button.dataset.ratio));
  });

  document.getElementById('boardGrid').addEventListener('click', async (event) => {
    const button = event.target.closest('.tile-download');
    if (!button) return;

    try {
      await downloadPost(button.dataset.postId, button);
    } catch (error) {
      console.error(error);
      alert('Unable to download this tile.');
    }
  });

  document.getElementById('downloadAllBtn').addEventListener('click', async () => {
    try {
      await downloadAll();
    } catch (error) {
      console.error(error);
      alert('Unable to prepare ZIP download.');
    }
  });
}

async function init() {
  const [client, concepts] = await Promise.all([
    loadJson('./client.json'),
    loadJson('./concepts.json')
  ]);

  appState.client = client;
  appState.concepts = concepts;
  appState.posts = flattenPosts(concepts);

  updateRatioButtons();
  renderBoard();
  bindEvents();
}

init().catch((error) => {
  console.error(error);
  document.getElementById('boardGrid').innerHTML = '<div class="empty-state">Unable to load board data.</div>';
});
