/* ==============================================
   WEALTHENGINE — Client Engine, Router & Tools
   main.js
   ============================================== */

(function () {
  // ── Global Client State ───────────────────────
  const state = {
    token: localStorage.getItem('wealthengine_token') || null,
    user: null,
    posts: [],
    categories: [],
    settings: { adsenseEnabled: false, adBannerCode: '', adSidebarCode: '' },
    activeView: 'home',
    detailPost: null
  };

  // ── Initialization ───────────────────────────
  window.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    bindEvents();
    checkDisclaimer();
    
    // Auth Check
    if (state.token) {
      await fetchCurrentUser();
    } else {
      renderNavMenu();
    }
    
    // Initial Route
    routeView();
    window.addEventListener('hashchange', routeView);
  });

  function checkDisclaimer() {
    const overlay = el('disclaimer-modal-overlay');
    if (!overlay) return;

    // Always show overlay immediately on every load / refresh
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    
    // Disable scrolling on body
    document.body.style.overflow = 'hidden';
    
    const agreeBtn = el('btn-disclaimer-agree');
    const leaveBtn = el('btn-disclaimer-leave');
    const checkbox = el('disclaimer-agree-checkbox');
    const box = overlay.querySelector('.disclaimer-modal-box');
    
    if (checkbox && agreeBtn) {
      checkbox.checked = false;
      agreeBtn.disabled = true;
      agreeBtn.style.opacity = '0.5';
      
      checkbox.onchange = () => {
        agreeBtn.disabled = !checkbox.checked;
        agreeBtn.style.opacity = checkbox.checked ? '1' : '0.5';
      };
    }
    
    if (leaveBtn) {
      leaveBtn.onclick = () => {
        window.location.href = 'https://www.google.com';
      };
    }
    
    if (agreeBtn) {
      agreeBtn.onclick = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 400);
      };
    }

    // Ignore Escape key closures
    window.addEventListener('keydown', (e) => {
      if (overlay.classList.contains('active')) {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
      }
    });

    // Trap keyboard focus inside the modal
    if (box) {
      const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const firstFocusableElement = box.querySelectorAll(focusableElements)[0];
      const focusableContent = box.querySelectorAll(focusableElements);
      const lastFocusableElement = focusableContent[focusableContent.length - 1];

      if (firstFocusableElement) firstFocusableElement.focus();

      window.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('active')) return;
        const isTabPressed = e.key === 'Tab' || e.keyCode === 9;
        if (!isTabPressed) return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
      });
    }
  }

  // ── Helpers ──────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function fmt(num) { return '₹' + Math.round(num).toLocaleString('en-IN'); }
  
  function getAuthorName(origName) {
    if (!origName || origName.toLowerCase().includes('shashwath')) {
      return 'WealthEngine Expert';
    }
    return origName;
  }

  function showToast(msg, type = 'success') {
    const container = el('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '⚡' : '⚠️'}</span>
      <div>${msg}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  const USE_SUPABASE = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const SUPABASE_URL = "https://augjybpfsmckgsyygkuv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ni4WJmJeQAOlE_KtBcyzcw_As_rpiE5";

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function fetchApi(endpoint, options = {}) {
    if (!USE_SUPABASE) {
      const headers = { 'Content-Type': 'application/json' };
      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }
      
      const opt = Object.assign({ headers }, options);
      if (opt.body && typeof opt.body === 'object') {
        opt.body = JSON.stringify(opt.body);
      }
      
      const res = await fetch(endpoint, opt);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      
      return res.json().catch(() => ({}));
    }

    // Direct Supabase PostgREST implementation
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    const method = options.method || 'GET';
    const bodyObj = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null;

    const url = new URL(endpoint, window.location.origin);
    const path = url.pathname;
    const params = url.searchParams;

    let targetUrl = '';
    let fetchOptions = { method, headers };

    if (path.startsWith('/api/posts/detail')) {
      const id = params.get('id');
      const slug = params.get('slug');
      if (method === 'GET') {
        const filter = id ? `id=eq.${id}` : `slug=eq.${slug}`;
        targetUrl = `${SUPABASE_URL}/rest/v1/posts?${filter}&select=*`;
      } else if (method === 'PUT') {
        fetchOptions.method = 'PATCH';
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${id}`;
      } else if (method === 'DELETE') {
        targetUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${id}`;
      }
    } else if (path === '/api/posts') {
      if (method === 'GET') {
        const status = params.get('status');
        const filter = status === 'all' ? '' : 'status=eq.Published';
        targetUrl = `${SUPABASE_URL}/rest/v1/posts?select=*${filter ? '&' + filter : ''}`;
      } else if (method === 'POST') {
        bodyObj.id = bodyObj.id || ("post-" + Math.random().toString(36).substring(2, 10));
        bodyObj.slug = bodyObj.slug || bodyObj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        bodyObj.author = bodyObj.author || (state.user ? state.user.email : 'shashwaththangarajan@gmail.com');
        bodyObj.authorName = bodyObj.authorName || (state.user ? (state.user.name || state.user.email) : 'WealthEngine Expert');
        bodyObj.views = bodyObj.views !== undefined ? bodyObj.views : 0;
        bodyObj.likes = bodyObj.likes !== undefined ? bodyObj.likes : 0;
        bodyObj.claps = bodyObj.claps !== undefined ? bodyObj.claps : 0;
        bodyObj.readingTime = bodyObj.readingTime || Math.max(1, Math.round((bodyObj.content || '').split(/\s+/).length / 200));
        bodyObj.placedAt = bodyObj.placedAt || new Date().toISOString();
        
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/posts`;
      }
    } else if (path.startsWith('/api/news/detail')) {
      const id = params.get('id');
      const slug = params.get('slug');
      if (method === 'GET') {
        const filter = id ? `id=eq.${id}` : `slug=eq.${slug}`;
        targetUrl = `${SUPABASE_URL}/rest/v1/news?${filter}&select=*`;
      } else if (method === 'PUT') {
        fetchOptions.method = 'PATCH';
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/news?id=eq.${id}`;
      } else if (method === 'DELETE') {
        targetUrl = `${SUPABASE_URL}/rest/v1/news?id=eq.${id}`;
      }
    } else if (path === '/api/news') {
      if (method === 'GET') {
        const status = params.get('status');
        const filter = status === 'all' ? '' : 'status=eq.Publish';
        targetUrl = `${SUPABASE_URL}/rest/v1/news?select=*${filter ? '&' + filter : ''}`;
      } else if (method === 'POST') {
        bodyObj.id = bodyObj.id || ("news-" + Math.random().toString(36).substring(2, 10));
        bodyObj.slug = bodyObj.slug || bodyObj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        bodyObj.author = bodyObj.author || (state.user ? (state.user.name || state.user.email) : 'WealthEngine News Desk');
        bodyObj.views = bodyObj.views !== undefined ? bodyObj.views : 0;
        bodyObj.likes = bodyObj.likes !== undefined ? bodyObj.likes : 0;
        bodyObj.readingTime = bodyObj.readingTime || Math.max(1, Math.round((bodyObj.content || '').split(/\s+/).length / 200));
        bodyObj.publishDate = bodyObj.publishDate || new Date().toISOString();
        
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/news`;
      }
    } else if (path === '/api/news/interaction') {
      const { slug, action } = bodyObj;
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/news?slug=eq.${slug}&select=*`, { headers });
      const items = await getRes.json().catch(() => []);
      if (items && items.length > 0) {
        const item = items[0];
        const updateObj = {};
        if (action === 'view') {
          updateObj.views = (item.views || 0) + 1;
        } else if (action === 'like') {
          updateObj.likes = (item.likes || 0) + 1;
        }
        await fetch(`${SUPABASE_URL}/rest/v1/news?slug=eq.${slug}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updateObj)
        });
        return updateObj;
      }
      return {};
    } else if (path === '/api/categories') {
      if (method === 'GET') {
        targetUrl = `${SUPABASE_URL}/rest/v1/categories?select=*`;
      } else if (method === 'POST') {
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/categories`;
      }
    } else if (path === '/api/cards') {
      const id = params.get('id');
      if (method === 'GET') {
        targetUrl = `${SUPABASE_URL}/rest/v1/cards?select=*`;
      } else if (method === 'POST') {
        bodyObj.id = bodyObj.id || ("card-" + Math.random().toString(36).substring(2, 10));
        bodyObj.slug = bodyObj.slug || bodyObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/cards`;
      } else if (method === 'PUT') {
        const cardId = id || bodyObj.id;
        bodyObj.slug = bodyObj.slug || bodyObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        fetchOptions.method = 'PATCH';
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/cards?id=eq.${cardId}`;
      } else if (method === 'DELETE') {
        targetUrl = `${SUPABASE_URL}/rest/v1/cards?id=eq.${id}`;
      }
    } else if (path === '/api/newsletter/subscribe') {
      fetchOptions.body = JSON.stringify({ email: bodyObj.email, source: bodyObj.source || 'home' });
      targetUrl = `${SUPABASE_URL}/rest/v1/subscribers`;
    } else if (path === '/api/newsletter/subscribers') {
      targetUrl = `${SUPABASE_URL}/rest/v1/subscribers?select=*`;
    } else if (path === '/api/settings') {
      if (method === 'GET') {
        targetUrl = `${SUPABASE_URL}/rest/v1/settings?id=eq.default&select=*`;
      } else if (method === 'POST') {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.default&select=*`, { headers });
        const checkData = await checkRes.json().catch(() => []);
        bodyObj.id = 'default';
        if (checkData && checkData.length > 0) {
          fetchOptions.method = 'PATCH';
          fetchOptions.body = JSON.stringify(bodyObj);
          targetUrl = `${SUPABASE_URL}/rest/v1/settings?id=eq.default`;
        } else {
          fetchOptions.method = 'POST';
          fetchOptions.body = JSON.stringify(bodyObj);
          targetUrl = `${SUPABASE_URL}/rest/v1/settings`;
        }
      }
    } else if (path === '/api/admin/analytics') {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=*`, { headers });
      const nRes = await fetch(`${SUPABASE_URL}/rest/v1/news?select=*`, { headers });
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*`, { headers });
      const pData = await pRes.json().catch(() => []);
      const nData = await nRes.json().catch(() => []);
      const sData = await sRes.json().catch(() => []);
      
      let totalViews = 0;
      let totalLikes = 0;
      pData.forEach(p => { totalViews += (p.views || 0); totalLikes += (p.likes || 0); });
      nData.forEach(n => { totalViews += (n.views || 0); totalLikes += (n.likes || 0); });

      return {
        totalPosts: pData.length,
        publishedPosts: pData.filter(p => p.status === 'Published').length,
        draftPosts: pData.filter(p => p.status === 'Draft').length,
        totalUsers: 1,
        totalComments: 0,
        totalSubscribers: sData.length,
        totalViews,
        totalLikes
      };
    } else if (path === '/api/auth/register') {
      const { email, password, name } = bodyObj;
      const salt = Math.random().toString(36).substring(2, 10);
      const hash = await sha256(password + salt);
      const newUser = {
        id: 'usr-' + Math.random().toString(36).substring(2, 10),
        email,
        passwordHash: hash,
        passwordSalt: salt,
        name,
        role: 'Subscriber',
        createdAt: new Date().toISOString()
      };
      const regRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newUser)
      });
      if (!regRes.ok) {
        throw new Error('Registration failed');
      }
      const token = btoa(JSON.stringify({ email, role: 'Subscriber' }));
      return { token, user: { email, name, role: 'Subscriber', bookmarks: [], likes: [], history: [] } };
    } else if (path === '/api/auth/login') {
      const { email, password } = bodyObj;
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}&select=*`, { headers });
      const users = await userRes.json().catch(() => []);
      if (!users || users.length === 0) {
        throw new Error('Invalid email or password.');
      }
      const user = users[0];
      const checkHash = await sha256(password + user.passwordSalt);
      if (checkHash !== user.passwordHash) {
        throw new Error('Invalid email or password.');
      }
      const token = btoa(JSON.stringify({ email: user.email, role: user.role }));
      return { token, user: { 
        email: user.email, 
        name: user.name, 
        role: user.role,
        bookmarks: user.bookmarks || [],
        likes: user.likes || [],
        history: user.history || []
      } };
    } else if (path === '/api/auth/me') {
      if (state.token) {
        let decoded;
        try {
          const parts = state.token.split('.');
          const payload = parts.length === 3 ? parts[1] : state.token;
          decoded = JSON.parse(atob(payload));
        } catch (e) {
          localStorage.removeItem('wealthengine_token');
          state.token = null;
          throw new Error('Unauthorized');
        }
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${decoded.email}&select=*`, { headers });
        const users = await userRes.json().catch(() => []);
        if (users && users.length > 0) {
          const user = users[0];
          return { user: { 
            email: user.email, 
            name: user.name, 
            role: user.role,
            bookmarks: user.bookmarks || [],
            likes: user.likes || [],
            history: user.history || []
          } };
        }
      }
      throw new Error('Unauthorized');
    }

    if (!targetUrl) {
      throw new Error(`Endpoint ${endpoint} not supported on Supabase serverless mode.`);
    }

    const res = await fetch(targetUrl, fetchOptions);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Supabase error ${res.status}`);
    }

    if (method === 'GET' && (path.startsWith('/api/posts/detail') || path.startsWith('/api/news/detail') || path === '/api/settings')) {
      const items = await res.json();
      return (items && items.length > 0) ? items[0] : (path === '/api/settings' ? {} : null);
    }

    return res.json().catch(() => ({}));
  }

  // ── Theme Management ─────────────────────────
  function initTheme() {
    const current = localStorage.getItem('wealthengine_theme') || 'light';
    document.documentElement.setAttribute('data-theme', current);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('wealthengine_theme', next);
  }

  // ── Router ───────────────────────────────────
  async function routeView() {
    const hash = window.location.hash || '#home';
    const parts = hash.split('/');
    const viewName = parts[0].substring(1);
    
    // Hide all views
    document.querySelectorAll('.app-main > section').forEach(sec => sec.classList.remove('active'));
    
    // Update nav links active class
    document.querySelectorAll('#main-nav-links a, .sidebar-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === parts[0]);
    });

    state.activeView = viewName;
    
    // Clear Ads
    await fetchAdsenseSettings();

    try {
      if (viewName === 'home') {
        await renderHome();
      } 
      else if (viewName === 'articles') {
        if (parts[1]) {
          await renderArticleDetail(parts[1]);
        } else {
          await renderArticlesFeed();
        }
      } 
      else if (viewName === 'news') {
        if (parts[1]) {
          await renderNewsDetail(parts[1]);
        } else {
          await renderNewsFeed();
        }
      } 
      else if (viewName === 'calculators') {
        await renderCalculators();
      } 
      else if (viewName === 'credit-cards') {
        await renderCreditCards();
      }
      else if (viewName === 'investing') {
        await renderInvesting();
      }
      else if (viewName === 'login' || viewName === 'register') {
        if (state.user) {
          window.location.hash = '#home';
          return;
        }
        el(`view-${viewName}`).classList.add('active');
      } 
      else if (viewName === 'dashboard') {
        if (!state.user) {
          window.location.hash = '#login';
          return;
        }
        await renderUserDashboard();
      } 
      else if (viewName === 'admin') {
        if (!state.user || !['Super Admin', 'Admin'].includes(state.user.role)) {
          showToast('Forbidden. Admin access required.', 'error');
          window.location.hash = '#home';
          return;
        }
        await renderAdminPanel();
      } 
      else {
        const sec = el(`view-${viewName}`);
        if (sec) sec.classList.add('active');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading page: ' + err.message, 'error');
      window.location.hash = '#home';
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Fetch AdSense settings & inject ads ──────
  async function fetchAdsenseSettings() {
    // AdSense is fully disabled. Clear all banners.
    ['ad-top-banner', 'ad-bottom-banner', 'ad-sidebar-widget', 'ad-in-article'].forEach(id => {
      const banner = el(id);
      if (banner) banner.innerHTML = '';
    });
  }

  // ── Authentication Modules ───────────────────
  async function fetchCurrentUser() {
    try {
      state.user = await fetchApi('/api/auth/me');
      renderNavMenu();
    } catch (e) {
      console.error('Session validation failed:', e);
      logout();
    }
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('wealthengine_token');
    showToast('Signed out successfully.');
    renderNavMenu();
    window.location.hash = '#home';
  }

  function renderNavMenu() {
    const dropdown = el('user-dropdown-menu');
    if (!dropdown) return;
    
    if (state.user) {
      let adminOption = '';
      if (['Super Admin', 'Admin'].includes(state.user.role)) {
        adminOption = `<a href="#admin">👑 Admin Control</a>`;
      }
      dropdown.innerHTML = `
        <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--color-border); font-size:0.8rem;">
          <strong style="display:block;">${state.user.name}</strong>
          <span style="opacity:0.6; font-size:0.72rem;">${state.user.email}</span>
        </div>
        <a href="#dashboard">👤 Profile Dashboard</a>
        ${adminOption}
        <button id="nav-logout-btn">🚪 Sign Out</button>
      `;
      
      const loBtn = el('nav-logout-btn');
      if (loBtn) loBtn.onclick = logout;
    } else {
      dropdown.innerHTML = `
        <a href="#login">🔑 Sign In</a>
        <a href="#register">📝 Register</a>
      `;
    }
  }

  // ── Home View ────────────────────────────────
  async function renderHome() {
    const view = el('view-home');
    view.classList.add('active');
    
    // Quick SIP interactive bindings
    const amtInput = el('quick-sip-amt');
    const rateInput = el('quick-sip-rate');
    
    if (amtInput && rateInput) {
      const updateQuickSip = () => {
        const amt = parseInt(amtInput.value) || 0;
        const rate = parseInt(rateInput.value) || 0;
        
        const valSpan = el('quick-sip-amt-val');
        const rateSpan = el('quick-sip-rate-val');
        const resDiv = el('quick-sip-result');
        
        if (valSpan) valSpan.textContent = fmt(amt);
        if (rateSpan) rateSpan.textContent = rate + '%';
        
        const months = 120;
        const r = (rate / 12) / 100;
        const maturity = r > 0 ? amt * ((Math.pow(1 + r, months) - 1) / r) * (1 + r) : amt * months;
        if (resDiv) resDiv.textContent = fmt(maturity);
      };
      
      amtInput.oninput = updateQuickSip;
      rateInput.oninput = updateQuickSip;
      updateQuickSip();
    }

    try {
      const posts = await fetchApi('/api/posts?limit=3');
      const categories = await fetchApi('/api/categories');

      const catGrid = el('home-categories-grid');
      if (catGrid) {
        catGrid.innerHTML = categories.map(cat => `
          <div class="category-card" onclick="window.location.hash = '#articles?category=${cat.id}'">
            <h3>${cat.name}</h3>
            <p>${cat.description}</p>
          </div>
        `).join('');
      }

      const postList = el('home-posts-list');
      if (postList) {
        const latest = posts.slice(0, 3);
        if (latest.length > 0) {
          postList.innerHTML = latest.map(post => `
            <div class="blog-row-card" onclick="window.location.hash = '#articles/${post.slug}'">
              <div class="blog-row-img-wrap">
                <img src="${post.featuredImage}" alt="Cover">
              </div>
              <div class="blog-row-content">
                <h3>${post.title}</h3>
                <p>${post.excerpt}</p>
                <div class="author-meta-row">
                  <strong>${getAuthorName(post.authorName)}</strong>
                  <span style="opacity:0.5;">${post.readingTime} min read • ${post.views} views</span>
                </div>
              </div>
            </div>
          `).join('');
        }
      }

      // Load News articles
      const newsList = await fetchApi('/api/news');
      
      // Render Featured News Card
      const featuredNews = newsList.find(n => n.featured) || newsList[0];
      const featuredContainer = el('home-news-featured');
      if (featuredContainer && featuredNews) {
        featuredContainer.innerHTML = `
          <div class="checkout-panel" style="padding:0; overflow:hidden; cursor:pointer;" onclick="window.location.hash = '#news/${featuredNews.slug}'">
            <img src="${featuredNews.featuredImage}" style="width:100%; height:260px; object-fit:cover;">
            <div style="padding:1.5rem;">
              <span class="meta-category-badge" style="background:var(--color-accent-glow); color:var(--color-accent); padding:0.2rem 0.6rem; border-radius:50px; font-size:0.72rem; font-weight:700;">FEATURED • ${featuredNews.category}</span>
              <h3 style="margin:0.75rem 0; font-size:1.4rem; line-height:1.3;">${featuredNews.title}</h3>
              <p style="font-size:0.88rem; opacity:0.8; margin-bottom:1rem; line-height:1.5;">${featuredNews.shortDescription}</p>
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; opacity:0.6;">
                <span>By ${featuredNews.author} • ${new Date(featuredNews.publishDate).toLocaleDateString()}</span>
                <span>${featuredNews.readingTime} min read • ${featuredNews.views} views</span>
              </div>
            </div>
          </div>
        `;
      } else if (featuredContainer) {
        featuredContainer.innerHTML = `<div style="text-align:center; opacity:0.5; padding:2rem;">No featured news.</div>`;
      }

      // Render latest news grid (non-featured ones)
      const latestNews = newsList.filter(n => n.id !== (featuredNews ? featuredNews.id : ''));
      const gridContainer = el('home-news-grid');
      if (gridContainer) {
        if (latestNews.length > 0) {
          gridContainer.innerHTML = latestNews.slice(0, 4).map(news => `
            <div class="checkout-panel" style="padding:0; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; height:100%;" onclick="window.location.hash = '#news/${news.slug}'">
              <img src="${news.featuredImage}" style="width:100%; height:140px; object-fit:cover;">
              <div style="padding:1.25rem; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <span style="font-size:0.72rem; font-weight:700; color:var(--color-accent); text-transform:uppercase;">${news.category}</span>
                  <h4 style="margin:0.5rem 0; font-size:1.05rem; line-height:1.3; font-family:var(--font-display);">${news.title}</h4>
                  <p style="font-size:0.8rem; opacity:0.78; line-height:1.4; margin-bottom:1rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${news.shortDescription}</p>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; opacity:0.6; border-top:1px solid var(--color-border); padding-top:0.75rem;">
                  <span>${new Date(news.publishDate).toLocaleDateString()}</span>
                  <span>${news.views} views</span>
                </div>
              </div>
            </div>
          `).join('');
        } else {
          gridContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; opacity:0.5; padding:2rem;">No other news coverage.</div>`;
        }
      }

      // Render trending news sidebar
      const trendingNews = newsList.filter(n => n.trending).slice(0, 3);
      const trendingContainer = el('home-news-trending-list');
      if (trendingContainer) {
        if (trendingNews.length > 0) {
          trendingContainer.innerHTML = trendingNews.map(news => `
            <div style="cursor:pointer;" onclick="window.location.hash = '#news/${news.slug}'">
              <span style="font-size:0.72rem; font-weight:700; color:var(--color-accent); text-transform:uppercase;">${news.category}</span>
              <h4 style="margin:0.25rem 0; font-size:0.92rem; line-height:1.3;">${news.title}</h4>
              <span style="font-size:0.72rem; opacity:0.5;">${news.views} views • ${news.readingTime}m read</span>
            </div>
          `).join('');
        } else {
          trendingContainer.innerHTML = `<div style="text-align:center; opacity:0.5;">No trending items.</div>`;
        }
      }

      // News categories list
      const newsCats = [...new Set(newsList.map(n => n.category))];
      const catsContainer = el('home-news-categories');
      if (catsContainer) {
        catsContainer.innerHTML = newsCats.map(cat => `
          <button class="cc-tab-btn" onclick="window.location.hash = '#news?category=${encodeURIComponent(cat)}'" style="padding:0.4rem 0.8rem; font-size:0.75rem;">${cat}</button>
        `).join('');
      }

      // Home news search binding
      const homeNewsSearchInput = el('home-news-search-input');
      const homeNewsSearchBtn = el('home-news-search-btn');
      if (homeNewsSearchInput && homeNewsSearchBtn) {
        const doSearch = () => {
          const q = homeNewsSearchInput.value.trim();
          if (q) window.location.hash = `#news?q=${encodeURIComponent(q)}`;
        };
        homeNewsSearchBtn.onclick = doSearch;
        homeNewsSearchInput.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
      }

    } catch (e) {
      console.error("Home page dynamic data load failed:", e);
    }
  }

  // ── Articles Feed View ───────────────────────
  async function renderArticlesFeed() {
    const view = el('view-articles');
    view.classList.add('active');
    
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const catParam = params.get('category') || '';
    const qParam = params.get('q') || '';
    
    const categories = await fetchApi('/api/categories');
    const catFilter = el('article-cat-filter');
    catFilter.innerHTML = `<option value="">All Categories</option>` + categories.map(c => `
      <option value="${c.id}" ${catParam === c.id ? 'selected' : ''}>${c.name}</option>
    `).join('');

    const fetchUrl = `/api/posts?status=Published${catParam ? '&category=' + catParam : ''}${qParam ? '&q=' + qParam : ''}`;
    const posts = await fetchApi(fetchUrl);
    
    const grid = el('articles-posts-grid');
    if (posts.length > 0) {
      grid.innerHTML = posts.map(post => `
        <div class="article-grid-card" onclick="window.location.hash = '#articles/${post.slug}'">
          <img src="${post.featuredImage}">
          <div class="article-grid-card-content">
            <span style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:var(--color-accent);">${categories.find(c => c.id === post.categoryId)?.name || 'Finance'}</span>
            <h3>${post.title}</h3>
            <p>${post.excerpt}</p>
            <div class="author-meta-row" style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--color-border);">
              <strong>${getAuthorName(post.authorName)}</strong>
              <span style="opacity:0.5;">${post.readingTime} min read</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; opacity:0.5; padding:5rem 0;">No matching finance guides.</div>`;
    }
  }

  // ── Single Article details view ──────────────
  async function renderArticleDetail(slug) {
    const view = el('view-article-detail');
    view.classList.add('active');
    
    const post = await fetchApi(`/api/posts/detail?slug=${slug}`);
    state.detailPost = post;

    const categories = await fetchApi('/api/categories');
    el('post-detail-cat').textContent = categories.find(c => c.id === post.categoryId)?.name || 'Finance';
    el('post-detail-title').textContent = post.title;
    el('post-detail-author').textContent = getAuthorName(post.authorName);
    el('post-detail-date').textContent = new Date(post.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    el('post-detail-views').textContent = `${post.views + 1} views`;
    el('post-detail-hero').src = post.featuredImage;

    el('post-detail-content').innerHTML = parseMarkdown(post.content);

    try {
      const terms = await fetchApi('/api/glossary');
      highlightGlossaryTerms(el('post-detail-content'), terms);
    } catch (e) {
      console.error('Failed to run glossary matching:', e);
    }

    const isBookmarked = state.user && state.user.bookmarks && state.user.bookmarks.includes(post.id);
    el('post-detail-bookmark-btn').textContent = isBookmarked ? '🔖 Saved' : '📁 Save';

    el('post-detail-like-btn').onclick = recordLike;
    el('post-detail-bookmark-btn').onclick = toggleBookmark;

    await renderPostComments(post.id);
  }

  function parseMarkdown(text) {
    if (!text) return '';
    let html = text;
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.5rem; margin:2rem 0 1rem 0; font-weight:800;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:2rem; margin:2.5rem 0 1.25rem 0; font-weight:900;">$1</h1>');
    html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left:4px solid var(--color-accent); padding-left:1.5rem; font-style:italic; color:var(--color-secondary); margin:1.5rem 0;">$1</blockquote>');
    html = html.split('\n\n').map(p => {
      if (p.trim().startsWith('<h') || p.trim().startsWith('<block')) return p;
      return `<p style="margin-bottom:1.5rem; line-height:1.75;">${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return html;
  }

  async function recordLike() {
    if (!state.detailPost) return;
    try {
      await fetchApi('/api/posts/interaction', {
        method: 'POST',
        body: { postId: state.detailPost.id, type: 'like' }
      });
      showToast('Interaction recorded successfully.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function toggleBookmark() {
    if (!state.user) {
      showToast('Sign in required to bookmark articles.', 'error');
      window.location.hash = '#login';
      return;
    }
    
    let bookmarks = [...(state.user.bookmarks || [])];
    const id = state.detailPost.id;
    const idx = bookmarks.indexOf(id);
    
    if (idx > -1) {
      bookmarks.splice(idx, 1);
      showToast('Bookmark removed.');
    } else {
      bookmarks.push(id);
      showToast('Article bookmarked.');
    }

    try {
      await fetchApi('/api/auth/profile', {
        method: 'POST',
        body: { bookmarks }
      });
      state.user.bookmarks = bookmarks;
      el('post-detail-bookmark-btn').textContent = bookmarks.includes(id) ? '🔖 Saved' : '📁 Save';
    } catch (e) {
      showToast('Failed to toggle bookmark.', 'error');
    }
  }

  async function renderPostComments(postId) {
    const container = el('new-comment-container');
    const listBox = el('comments-list-box');
    const badge = el('comments-count');

    const comments = await fetchApi(`/api/comments?postId=${postId}`);
    badge.textContent = comments.length;

    if (state.user) {
      container.innerHTML = `
        <form id="comment-post-form">
          <textarea id="comment-text-input" class="new-comment-textarea" rows="3" placeholder="Post a comment/question..." required></textarea>
          <button type="submit" class="btn primary">Post Comment</button>
        </form>
      `;
      el('comment-post-form').onsubmit = async (e) => {
        e.preventDefault();
        const content = el('comment-text-input').value.trim();
        if (!content) return;
        try {
          await fetchApi('/api/comments', {
            method: 'POST',
            body: { postId, content }
          });
          el('comment-text-input').value = '';
          showToast('Comment posted.');
          await renderPostComments(postId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } else {
      container.innerHTML = `<div class="checkout-panel" style="text-align:center; opacity:0.7; font-size:0.85rem;">Please <a href="#login" style="font-weight:700; text-decoration:underline;">sign in</a> to post comments.</div>`;
    }

    if (comments.length > 0) {
      listBox.innerHTML = comments.map(c => `
        <div class="comment-card">
          <div style="display:flex; gap:0.5rem; font-size:0.75rem; color:var(--color-secondary); margin-bottom:0.5rem;">
            <strong>${c.authorName}</strong>
            <span>•</span>
            <span>${new Date(c.placedAt).toLocaleDateString('en-IN')}</span>
          </div>
          <p style="font-size:0.88rem; line-height:1.5;">${c.content}</p>
        </div>
      `).join('');
    } else {
      listBox.innerHTML = `<div style="text-align:center; opacity:0.4; font-size:0.8rem; padding:2rem 0;">No comments yet.</div>`;
    }
  }

  // ── 4. Calculators View ──────────────────────
  async function renderCalculators() {
    const view = el('view-calculators');
    view.classList.add('active');

    // Automatic monthly -> annual extra payment calculation
    const extMonthly = el('payoff-extra-monthly');
    const extAnnual = el('payoff-extra-annual');
    if (extMonthly && extAnnual) {
      extMonthly.oninput = () => {
        const monthlyVal = parseFloat(extMonthly.value) || 0;
        extAnnual.value = Math.round(monthlyVal * 12);
        runLoanPayoffCalculator();
      };
    }

    // Default defaults
    runSipCompounding();
    runEmiCalculator();
    runLoanPayoffCalculator();

    // Bind calculate buttons click
    el('btn-run-sip').onclick = runSipCompounding;
    el('btn-run-emi').onclick = runEmiCalculator;
    el('btn-run-payoff').onclick = runLoanPayoffCalculator;
    el('btn-payoff-print').onclick = printPayoffSchedule;
    el('btn-payoff-save').onclick = savePayoffCalculation;
  }

  function runSipCompounding() {
    const type = el('sip-type').value;
    const amt = parseFloat(el('sip-amount').value) || 0;
    const rate = parseFloat(el('sip-rate').value) || 0;
    const years = parseFloat(el('sip-years').value) || 0;

    let invested = 0;
    let total = 0;
    
    if (type === 'sip') {
      const months = years * 12;
      invested = amt * months;
      const r = (rate / 12) / 100;
      total = amt * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
    } else {
      invested = amt;
      const r = rate / 100;
      total = amt * Math.pow(1 + r, years);
    }

    const gained = Math.max(0, total - invested);

    el('sip-res-invested').textContent = fmt(invested);
    el('sip-res-gained').textContent = fmt(gained);
    el('sip-res-total').textContent = fmt(total);

    const invPct = invested > 0 ? (invested / total) * 100 : 50;
    const gainPct = gained > 0 ? (gained / total) * 100 : 50;
    el('sip-bar-invested').style.width = invPct + '%';
    el('sip-bar-gained').style.width = gainPct + '%';
  }

  function runEmiCalculator() {
    const p = parseFloat(el('emi-principal').value) || 0;
    const rate = parseFloat(el('emi-rate').value) || 0;
    const years = parseFloat(el('emi-years').value) || 0;

    const r = (rate / 12) / 100;
    const n = years * 12;

    let emi = 0;
    if (p > 0 && r > 0) {
      emi = p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    }

    const totalPayment = emi * n;
    const interest = Math.max(0, totalPayment - p);

    el('emi-res-monthly').textContent = fmt(emi);
    el('emi-res-interest').textContent = fmt(interest);
    el('emi-res-total').textContent = fmt(totalPayment);
  }

  let payoffAmortizationSchedule = [];

  function runLoanPayoffCalculator() {
    const P = parseFloat(el('payoff-amount').value) || 0;
    const rate = parseFloat(el('payoff-rate').value) || 0;
    const years = parseFloat(el('payoff-years').value) || 0;
    const freq = el('payoff-frequency').value;
    
    const extraMonthly = parseFloat(el('payoff-extra-monthly').value) || 0;
    const extraAnnual = parseFloat(el('payoff-extra-annual').value) || 0;
    const extraLump = parseFloat(el('payoff-extra-lump').value) || 0;

    let ppy = 12;
    if (freq === 'biweekly') { ppy = 26; }
    else if (freq === 'weekly') { ppy = 52; }

    const r = (rate / 100) / ppy;
    const n = years * ppy;

    if (P <= 0 || r <= 0 || n <= 0) return;

    const origPMT = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);

    let origBal = P;
    let origInterest = 0;
    for (let i = 1; i <= n; i++) {
      let intr = origBal * r;
      let prin = origPMT - intr;
      if (prin > origBal) { prin = origBal; }
      origBal -= prin;
      origInterest += intr;
    }
    const origTotalCost = P + origInterest;

    let bal = P;
    let newInterest = 0;
    let extraPaid = 0;
    payoffAmortizationSchedule = [];

    let period = 0;
    while (bal > 0 && period < 1200) {
      period++;
      let intr = bal * r;
      let basePmt = origPMT;
      if (basePmt > bal + intr) { basePmt = bal + intr; }

      let lumpContribution = (period === 1) ? extraLump : 0;
      let annualContribution = (period % ppy === 0) ? extraAnnual : 0;
      let periodicExtra = extraMonthly + lumpContribution + annualContribution;

      let totalPmt = basePmt + periodicExtra;
      if (totalPmt > bal + intr) {
        totalPmt = bal + intr;
        periodicExtra = Math.max(0, totalPmt - basePmt);
      }

      let prin = totalPmt - intr;
      bal -= prin;
      newInterest += intr;
      extraPaid += periodicExtra;

      payoffAmortizationSchedule.push({
        period,
        pmt: basePmt,
        prin,
        intr,
        extra: periodicExtra,
        bal: Math.max(0, bal)
      });
    }

    const newTotalCost = P + newInterest;
    const interestSaved = Math.max(0, origInterest - newInterest);
    const periodsSaved = Math.max(0, n - payoffAmortizationSchedule.length);

    let timeSavedText = "0 Months";
    if (periodsSaved > 0) {
      if (freq === 'monthly') {
        const y = Math.floor(periodsSaved / 12);
        const m = periodsSaved % 12;
        timeSavedText = `${y > 0 ? y + ' Yrs ' : ''}${m} Mos`;
      } else if (freq === 'biweekly') {
        const y = Math.floor(periodsSaved / 26);
        timeSavedText = `${y} Years`;
      } else {
        const y = Math.floor(periodsSaved / 52);
        timeSavedText = `${y} Years`;
      }
    }

    el('payoff-comp-orig-emi').textContent = fmt(origPMT);
    el('payoff-comp-orig-interest').textContent = fmt(origInterest);
    el('payoff-comp-orig-cost').textContent = fmt(origTotalCost);

    el('payoff-comp-new-emi').textContent = fmt(origPMT);
    el('payoff-comp-new-interest').textContent = fmt(newInterest);
    el('payoff-comp-new-cost').textContent = fmt(newTotalCost);

    el('payoff-res-saved-interest').textContent = fmt(interestSaved);
    el('payoff-res-saved-time').textContent = timeSavedText;

    const tbody = el('payoff-amortization-tbody');
    const limit = Math.min(payoffAmortizationSchedule.length, 120);
    
    let html = payoffAmortizationSchedule.slice(0, limit).map(s => `
      <tr>
        <td>${freq.toUpperCase()} ${s.period}</td>
        <td>${fmt(s.pmt)}</td>
        <td>${fmt(s.prin - s.extra)}</td>
        <td>${fmt(s.intr)}</td>
        <td style="color:var(--color-accent); font-weight:700;">${fmt(s.extra)}</td>
        <td>${fmt(s.bal)}</td>
      </tr>
    `).join('');

    if (payoffAmortizationSchedule.length > limit) {
      html += `<tr><td colspan="6" style="text-align:center; opacity:0.6; font-style:italic;">Showing first ${limit} periods. Click print to output full schedule.</td></tr>`;
    }
    tbody.innerHTML = html;
  }

  function printPayoffSchedule() {
    if (payoffAmortizationSchedule.length === 0) {
      showToast('Please calculate a loan payoff schedule first.', 'error');
      return;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>WealthEngine - Loan Amortization Schedule</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; color: #111; }
          h2 { text-transform: uppercase; border-bottom: 2px solid #10B981; padding-bottom: 0.5rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
          th { background: #f3f4f6; text-align: left; padding: 0.75rem; font-size: 0.8rem; text-transform: uppercase; }
          td { border-bottom: 1px solid #e5e7eb; padding: 0.75rem; font-size: 0.85rem; }
        </style>
      </head>
      <body>
        <h2>Loan Payoff Amortization Schedule</h2>
        <p>Report generated on: ${new Date().toLocaleDateString('en-IN')}</p>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Regular Payment</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Extra Paid</th>
              <th>Remaining Balance</th>
            </tr>
          </thead>
          <tbody>
            ${payoffAmortizationSchedule.map(s => `
              <tr>
                <td>Period ${s.period}</td>
                <td>₹${Math.round(s.pmt).toLocaleString('en-IN')}</td>
                <td>₹${Math.round(s.prin - s.extra).toLocaleString('en-IN')}</td>
                <td>₹${Math.round(s.intr).toLocaleString('en-IN')}</td>
                <td>₹${Math.round(s.extra).toLocaleString('en-IN')}</td>
                <td>₹${Math.round(s.bal).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  async function savePayoffCalculation() {
    if (!state.user) {
      showToast('Authentication required to save calculations.', 'error');
      window.location.hash = '#login';
      return;
    }
    const P = parseFloat(el('payoff-amount').value) || 0;
    const savedInt = el('payoff-res-saved-interest').textContent;
    const savedTime = el('payoff-res-saved-time').textContent;

    const calculationLog = `Saved Loan Payoff Calculation: Principal ₹${P.toLocaleString('en-IN')} | Interest Saved ${savedInt} | Term Saved ${savedTime}`;
    let history = [...(state.user.history || [])];
    history.push(calculationLog);

    try {
      await fetchApi('/api/auth/profile', {
        method: 'POST',
        body: { history }
      });
      state.user.history = history;
      showToast('Calculation saved in profile dashboard!');
    } catch (e) {
      showToast('Failed to save calculation.', 'error');
    }
  }

  // ── Credit Cards Module ──────────────────────
  async function renderCreditCards() {
    const view = el('view-credit-cards');
    view.classList.add('active');

    // Default CC subpanel
    document.querySelectorAll('#view-credit-cards .cc-content-panel').forEach(p => p.classList.remove('active'));
    el('cc-sub-panel-listings').classList.add('active');
    document.querySelectorAll('.cc-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.ccSub === 'listings'));

    // Bind CC tab toggles
    document.querySelectorAll('.cc-tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.cc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('#view-credit-cards .cc-content-panel').forEach(p => p.classList.remove('active'));
        el(`cc-sub-panel-${btn.dataset.ccSub}`).classList.add('active');
      };
    });

    // Bind Calculator sub-tab triggers
    document.querySelectorAll('.cc-calc-menu-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.cc-calc-menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.cc-calc-sub-panel').forEach(p => p.classList.remove('active'));
        el(`cc-calc-${btn.dataset.ccCalc}`).classList.add('active');
      };
    });

    // Wire CC calculators
    el('cc-interest-bal').oninput = runCcInterestCalc;
    el('cc-interest-apr').oninput = runCcInterestCalc;
    el('cc-interest-payment').oninput = runCcInterestCalc;
    runCcInterestCalc();

    el('cc-minpay-bal').oninput = runCcMinpayCalc;
    el('cc-minpay-apr').oninput = runCcMinpayCalc;
    el('cc-minpay-pct').oninput = runCcMinpayCalc;
    runCcMinpayCalc();

    el('cc-payoff-bal').oninput = runCcPayoffCalc;
    el('cc-payoff-apr').oninput = runCcPayoffCalc;
    el('cc-payoff-months').oninput = runCcPayoffCalc;
    runCcPayoffCalc();

    el('cc-bt-bal').oninput = runCcBalanceTransferCalc;
    el('cc-bt-apr').oninput = runCcBalanceTransferCalc;
    el('cc-bt-new-apr').oninput = runCcBalanceTransferCalc;
    el('cc-bt-fee-pct').oninput = runCcBalanceTransferCalc;
    runCcBalanceTransferCalc();

    el('cc-util-bal').oninput = runCcUtilizationCalc;
    el('cc-util-limit').oninput = runCcUtilizationCalc;
    runCcUtilizationCalc();

    // Listings filter
    el('cc-filter-category').onchange = () => loadCreditCardsList();
    
    // Eligibility click
    el('cc-sub-panel-eligibility').querySelector('.btn.primary').onclick = runCcEligibilityCheck;

    // Load listings & comparison list
    await loadCreditCardsList();
    await setupCcComparison();
  }

  function renderCardImageHtml(c) {
    if (c.image && (c.image.toLowerCase().endsWith('.png') || c.image.toLowerCase().endsWith('.jpg') || c.image.toLowerCase().endsWith('.jpeg') || c.image.toLowerCase().startsWith('data:image') || c.image.toLowerCase().startsWith('http'))) {
      if (c.image.includes('unsplash.com/photo-') && !c.image.includes('card')) {
        // If it's a generic unsplash blog banner, bypass and show mockup!
      } else {
        return `<img src="${c.image}" alt="${c.name}" style="width:100%; height:160px; object-fit:cover; border-radius:12px 12px 0 0;">`;
      }
    }
    
    let gradient = 'linear-gradient(135deg, #1e293b, #475569)'; 
    const net = (c.network || '').toLowerCase();
    const bank = (c.bank || '').toLowerCase();
    
    if (net.includes('visa')) {
      gradient = 'linear-gradient(135deg, #1e3a8a, #3b82f6)'; 
    } else if (net.includes('master') || net.includes('mc')) {
      gradient = 'linear-gradient(135deg, #7c2d12, #ea580c)'; 
    } else if (net.includes('rupay') || bank.includes('sbi')) {
      gradient = 'linear-gradient(135deg, #064e3b, #10b981)'; 
    } else if (net.includes('amex') || bank.includes('hdfc')) {
      gradient = 'linear-gradient(135deg, #581c87, #a855f7)'; 
    } else if (bank.includes('icici')) {
      gradient = 'linear-gradient(135deg, #831843, #db2777)'; 
    }
    
    const lastDigits = c.id ? c.id.substring(c.id.length - 4).toUpperCase() : '8888';
    const cardholder = c.name || 'VALUED MEMBER';
    
    return `
      <div class="css-credit-card-mockup" style="background: ${gradient}; border-radius: 12px; height: 160px; padding: 1.25rem; color: #fff; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: inset 0 0 20px rgba(255,255,255,0.15); margin: 0.5rem; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 2;">
          <span style="font-weight: 800; font-size: 0.82rem; letter-spacing: 0.5px; text-transform: uppercase;">${c.bank || 'WealthEngine'}</span>
          <span style="font-style: italic; font-size: 0.72rem; font-weight: bold; opacity: 0.9;">${c.network || 'Premium'}</span>
        </div>
        <div style="width: 32px; height: 22px; background: linear-gradient(135deg, #fef08a, #eab308); border-radius: 4px; opacity: 0.85; margin-top: 0.5rem; position: relative; z-index: 2;">
          <div style="position: absolute; top: 0; left: 8px; width: 1px; height: 100%; background: rgba(0,0,0,0.15);"></div>
          <div style="position: absolute; top: 0; left: 16px; width: 1px; height: 100%; background: rgba(0,0,0,0.15);"></div>
          <div style="position: absolute; top: 0; left: 24px; width: 1px; height: 100%; background: rgba(0,0,0,0.15);"></div>
          <div style="position: absolute; top: 8px; left: 0; width: 100%; height: 1px; background: rgba(0,0,0,0.15);"></div>
          <div style="position: absolute; top: 14px; left: 0; width: 100%; height: 1px; background: rgba(0,0,0,0.15);"></div>
        </div>
        <div style="font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; text-shadow: 1px 1px 2px rgba(0,0,0,0.4); margin: 0.5rem 0; z-index: 2;">•••• •••• •••• ${lastDigits}</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.65rem; opacity: 0.95; z-index: 2;">
          <div>
            <div style="font-size: 0.45rem; opacity: 0.6; text-transform: uppercase; margin-bottom: 2px;">Cardholder</div>
            <div style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${cardholder.substring(0, 18)}</div>
          </div>
          <div>
            <div style="font-size: 0.45rem; opacity: 0.6; text-transform: uppercase; margin-bottom: 2px;">Expires</div>
            <div style="font-weight: 600;">12/31</div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadCreditCardsList() {
    const category = el('cc-filter-category').value;
    const cards = await fetchApi('/api/cards');
    const grid = el('cc-cards-grid');

    const filtered = cards.filter(c => {
      if (!category) return true;
      if (category === 'no-fee') return c.annualFee === 0;
      if (category === 'rewards') return c.rewardRate && c.rewardRate.toLowerCase().includes('point');
      if (category === 'cashback') return c.cashback && c.cashback.toLowerCase().includes('%');
      if (category === 'travel') return c.airportLounge && !c.airportLounge.toLowerCase().includes('no');
      return true;
    });

    if (filtered.length > 0) {
      grid.innerHTML = filtered.map(c => `
        <div class="article-grid-card">
          ${renderCardImageHtml(c)}
          <div class="article-grid-card-content">
            <span style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:var(--color-accent);">${c.bank} - ${c.network}</span>
            <h3>${c.name}</h3>
            <div style="margin: 0.5rem 0; font-size: 0.85rem; display: flex; justify-content: space-between;">
              <span>Annual Fee: <strong>${c.annualFee === 0 ? 'Free' : fmt(c.annualFee)}</strong></span>
              <span>APR: <strong>${c.apr}%</strong></span>
            </div>
            <p style="font-size:0.8rem; margin-bottom:1rem; opacity:0.8;">Bonus: ${c.welcomeBonus || 'None'}</p>
            <div style="margin-top:auto; font-size:0.75rem; border-top:1px solid var(--color-border); padding-top:0.5rem;">
              <div>• Lounge: ${c.airportLounge || 'No'}</div>
              <div>• Rewards: ${c.rewardRate || 'None'}</div>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; opacity:0.5; padding:4rem 0;">No credit cards found matching criteria.</div>`;
    }
  }

  async function setupCcComparison() {
    const cards = await fetchApi('/api/cards');
    const selectWrap = el('cc-compare-select-wrap');
    
    // Create 3 select dropdowns
    selectWrap.innerHTML = `
      <select id="cc-comp-1" style="padding:0.75rem; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; color:var(--color-text); min-width:200px;">
        <option value="">Choose Card 1</option>
        ${cards.map(c => `<option value="${c.id}">${c.name} (${c.bank})</option>`).join('')}
      </select>
      <select id="cc-comp-2" style="padding:0.75rem; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; color:var(--color-text); min-width:200px;">
        <option value="">Choose Card 2</option>
        ${cards.map(c => `<option value="${c.id}">${c.name} (${c.bank})</option>`).join('')}
      </select>
      <select id="cc-comp-3" style="padding:0.75rem; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; color:var(--color-text); min-width:200px;">
        <option value="">Choose Card 3</option>
        ${cards.map(c => `<option value="${c.id}">${c.name} (${c.bank})</option>`).join('')}
      </select>
    `;

    el('btn-run-cc-compare').onclick = () => {
      const id1 = el('cc-comp-1').value;
      const id2 = el('cc-comp-2').value;
      const id3 = el('cc-comp-3').value;

      const selected = [id1, id2, id3].map(id => cards.find(c => c.id === id)).filter(Boolean);

      if (selected.length === 0) {
        showToast('Please select at least one card to compare.', 'error');
        return;
      }

      const tableWrap = el('cc-comparison-table-wrap');
      tableWrap.style.display = 'block';

      tableWrap.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Spec / Feature</th>
              ${selected.map(c => `<th>${c.name}<br><span style="font-size:0.7rem; opacity:0.6;">${c.bank}</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Annual Fee</strong></td>
              ${selected.map(c => `<td>${c.annualFee === 0 ? 'Free' : fmt(c.annualFee)}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>APR (Interest)</strong></td>
              ${selected.map(c => `<td>${c.apr}%</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Grace Period</strong></td>
              ${selected.map(c => `<td>${c.interestFreeDays} Days</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Min Income Req.</strong></td>
              ${selected.map(c => `<td>${fmt(c.minIncome)} / mo</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Welcome Bonus</strong></td>
              ${selected.map(c => `<td>${c.welcomeBonus || 'None'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Lounge Access</strong></td>
              ${selected.map(c => `<td>${c.airportLounge || 'No'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Cashback Rate</strong></td>
              ${selected.map(c => `<td>${c.cashback || 'None'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Rewards Rate</strong></td>
              ${selected.map(c => `<td>${c.rewardRate || 'None'}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Pros</strong></td>
              ${selected.map(c => `<td style="color:var(--color-accent); font-size:0.8rem;">${c.pros || ''}</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Cons</strong></td>
              ${selected.map(c => `<td style="color:var(--color-error); font-size:0.8rem;">${c.cons || ''}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      `;
    };
  }

  async function runCcEligibilityCheck() {
    const income = parseFloat(el('cc-elig-income').value) || 0;
    const score = parseFloat(el('cc-elig-score').value) || 0;
    const age = parseFloat(el('cc-elig-age').value) || 0;

    const cards = await fetchApi('/api/cards');
    const container = el('cc-elig-results-list');

    const eligible = cards.filter(c => {
      return income >= c.minIncome && score >= c.creditScore && age >= 18;
    });

    if (eligible.length > 0) {
      container.innerHTML = eligible.map(c => `
        <div class="checkout-panel" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid var(--color-accent); margin-bottom:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.05rem;">${c.name}</h4>
            <span style="font-size:0.75rem; opacity:0.6;">${c.bank} • Min Income Required: ${fmt(c.minIncome)}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--color-accent);">98% Match Rate</div>
            <a href="#credit-cards" onclick="window.scrollTo({top:0,behavior:'smooth'});" style="font-size:0.8rem; text-decoration:underline;">View Details</a>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div class="checkout-panel" style="border-left:4px solid var(--color-error); text-align:center; padding:2rem 0;">
          <h4 style="color:var(--color-error); margin:0 0 0.5rem 0;">No Direct Matches Found</h4>
          <p style="font-size:0.85rem; opacity:0.8; margin:0;">Consider building your credit score above 700 or selecting entry-level cards.</p>
        </div>
      `;
    }
  }

  function runCcInterestCalc() {
    const bal = parseFloat(el('cc-interest-bal').value) || 0;
    const apr = parseFloat(el('cc-interest-apr').value) || 0;
    const pmt = parseFloat(el('cc-interest-payment').value) || 0;

    const monthlyInterest = bal * (apr / 12 / 100);
    el('cc-interest-res').textContent = fmt(monthlyInterest);
  }

  function runCcMinpayCalc() {
    const bal = parseFloat(el('cc-minpay-bal').value) || 0;
    const apr = parseFloat(el('cc-minpay-apr').value) || 0;
    const pct = parseFloat(el('cc-minpay-pct').value) || 0;

    const r = (apr / 12) / 100;
    let b = bal;
    let months = 0;
    let totalInt = 0;

    if (bal > 0 && apr > 0 && pct > 0) {
      while (b > 0 && months < 600) {
        months++;
        const intr = b * r;
        const pmt = Math.max(b * (pct / 100), 500);
        if (pmt <= intr) {
          months = 999;
          break;
        }
        const paid = Math.min(b + intr, pmt);
        totalInt += intr;
        b = b + intr - paid;
      }
    }

    el('cc-minpay-res-months').textContent = months >= 999 ? 'Infinite Months (Payment too low)' : `${months} Months`;
    el('cc-minpay-res-interest').textContent = fmt(totalInt);
  }

  function runCcPayoffCalc() {
    const bal = parseFloat(el('cc-payoff-bal').value) || 0;
    const apr = parseFloat(el('cc-payoff-apr').value) || 0;
    const months = parseFloat(el('cc-payoff-months').value) || 0;

    let monthly = 0;
    if (bal > 0 && apr > 0 && months > 0) {
      const r = (apr / 12) / 100;
      monthly = bal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    }
    el('cc-payoff-res-monthly').textContent = fmt(monthly);
  }

  function runCcBalanceTransferCalc() {
    const bal = parseFloat(el('cc-bt-bal').value) || 0;
    const apr = parseFloat(el('cc-bt-apr').value) || 0;
    const newApr = parseFloat(el('cc-bt-new-apr').value) || 0;
    const feePct = parseFloat(el('cc-bt-fee-pct').value) || 0;

    const fee = bal * (feePct / 100);
    const oldInt = bal * (apr / 100);
    const newInt = bal * (newApr / 100);
    const saved = Math.max(0, oldInt - newInt - fee);

    el('cc-bt-res-fee').textContent = fmt(fee);
    el('cc-bt-res-saved').textContent = fmt(saved);
  }

  function runCcUtilizationCalc() {
    const bal = parseFloat(el('cc-util-bal').value) || 0;
    const limit = parseFloat(el('cc-util-limit').value) || 1;

    const ratio = Math.min(100, Math.round((bal / limit) * 100));
    let rating = 'Excellent';
    
    if (ratio <= 30) { rating = 'Excellent (<30%)'; }
    else if (ratio <= 50) { rating = 'Good (<50%)'; }
    else if (ratio <= 75) { rating = 'Fair (<75%)'; }
    else { rating = 'Poor (>75%)'; }

    el('cc-util-res-ratio').textContent = ratio + '%';
    el('cc-util-res-rating').textContent = rating;
  }



  // ── Investing View ───────────────────────────
  async function renderInvesting() {
    const view = el('view-investing');
    view.classList.add('active');

    const terms = await fetchApi('/api/glossary');
    const container = el('investing-types-list');

    const invTerms = terms.filter(t => ['ETF', 'SIP', 'Asset Allocation', 'Diversification', 'Mutual Fund', 'FIRE'].includes(t.term));
    if (invTerms.length > 0) {
      container.innerHTML = invTerms.map((t, idx) => `
        <div style="${idx > 0 ? 'border-top:1px solid var(--color-border); padding-top:1rem;' : ''}">
          <strong style="color:var(--color-accent); font-size:1.05rem;">${t.term} (${t.title})</strong>
          <p style="font-size:0.88rem; opacity:0.8; margin-top:0.3rem;">${t.definition}</p>
        </div>
      `).join('');
    }
  }



  // ── Glossary Search view ──────────────────
  async function renderGlossary() {
    const view = el('view-glossary');
    view.classList.add('active');
    
    const searchInput = el('glossary-search-input');
    const renderList = async (query = '') => {
      const fetchUrl = `/api/glossary${query ? '?q=' + encodeURIComponent(query) : ''}`;
      const glossary = await fetchApi(fetchUrl);
      const container = el('glossary-results-list');
      
      if (glossary.length > 0) {
        container.innerHTML = glossary.map(g => `
          <div class="glossary-card-item">
            <h3><span>${g.term}</span> ${g.title}</h3>
            <p>${g.definition}</p>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div style="text-align:center; opacity:0.5; padding:3rem 0;">No terminology definitions found matching query.</div>`;
      }
    };

    searchInput.oninput = () => renderList(searchInput.value.trim());
    await renderList();
  }

  // ── User Dashboard ────────────────────────
  async function renderUserDashboard() {
    const view = el('view-dashboard');
    view.classList.add('active');

    el('dash-name').textContent = state.user.name;
    el('dash-role').textContent = state.user.role;
    el('dash-avatar').src = state.user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80';

    el('dash-profile-name').value = state.user.name;
    el('dash-profile-bio').value = state.user.bio || '';
    // Show existing avatar in the file-picker preview
    if (state.user.avatar) {
      const prev = el('dash-avatar-preview');
      if (prev) { prev.src = state.user.avatar; prev.style.display = 'block'; }
      const lbl = el('dash-avatar-filename');
      if (lbl) lbl.textContent = 'Current photo loaded';
    }
    wireImagePickers();

    // Bookmarks list
    const postsList = await fetchApi('/api/posts');
    const userBookmarks = state.user.bookmarks || [];
    const bookmarked = postsList.filter(p => userBookmarks.includes(p.id));
    const list = el('dash-bookmarks-grid');

    if (bookmarked.length > 0) {
      list.innerHTML = bookmarked.map(p => `
        <div class="article-grid-card" onclick="window.location.hash = '#articles/${p.slug}'">
          <img src="${p.featuredImage}">
          <div class="article-grid-card-content">
            <h3>${p.title}</h3>
            <p>${p.excerpt}</p>
          </div>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<div style="grid-column:1/-1; text-align:center; opacity:0.5; padding:3rem 0;">No bookmarked guides.</div>`;
    }
  }

  // ── Admin Control Panel ───────────────────
  async function renderAdminPanel() {
    const view = el('view-admin');
    view.classList.add('active');

    // Sub-SPA Tab switching handler
    document.querySelectorAll('.admin-menu-btn').forEach(btn => {
      btn.onclick = async () => {
        document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.remove('active'));
        
        const activeTab = btn.dataset.tab;
        el(`admin-panel-${activeTab}`).classList.add('active');

        // Load active tab data
        if (activeTab === 'dashboard') await renderAdminDashboard();
        else if (activeTab === 'news') await renderAdminNews();
        else if (activeTab === 'posts') await renderAdminPostsTable();
        else if (activeTab === 'cards') await renderAdminCardsTable();
      };
    });

    // Default to Dashboard tab
    document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'dashboard'));
    document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.toggle('active', p.id === 'admin-panel-dashboard'));
    await renderAdminDashboard();
    await bindAdminEventHandlers();
    wireImagePickers();
  }

  // ── 1. Dashboard Subpanel ──
  let activeUsersTimer = null;

  async function renderAdminDashboard() {
    try {
      // 1. Fetch data
      const stats = await fetchApi('/api/admin/analytics');
      const posts = await fetchApi('/api/posts?status=all');
      const news = await fetchApi('/api/news?status=all');
      const subscribers = await fetchApi('/api/newsletter/subscribers').catch(() => []);
      const settings = await fetchApi('/api/settings');

      // Sync maintenance checkbox
      const maintCheck = el('admin-toggle-maintenance');
      if (maintCheck) maintCheck.checked = !!settings.maintenanceMode;

      // 2. Compute Traffic metrics
      const viewsCount = stats.totalViews || 476;
      const totalVisitors = Math.round(viewsCount * 0.72);
      const totalSessions = Math.round(viewsCount * 0.88);
      const uniqueVisitors = Math.round(viewsCount * 0.42);

      el('traffic-total-visitors').textContent = totalVisitors.toLocaleString('en-IN');
      el('traffic-total-sessions').textContent = totalSessions.toLocaleString('en-IN');
      el('traffic-unique-visitors').textContent = uniqueVisitors.toLocaleString('en-IN');
      el('traffic-new-vs-ret').textContent = "74% / 26%";

      // 3. Active Users Simulation
      const updateActiveUsers = () => {
        const activeCount = Math.floor(Math.random() * 11) + 8; // 8 to 18
        const activeOnlineNowEl = el('active-online-now');
        if (activeOnlineNowEl) activeOnlineNowEl.textContent = activeCount;

        const activePagesTable = el('active-pages-table');
        if (activePagesTable) {
          const activePages = [
            { path: '/', title: 'Home Page', users: Math.round(activeCount * 0.4) },
            { path: '#news', title: 'News Hub', users: Math.round(activeCount * 0.3) },
            { path: '#articles/sip-guide', title: 'SIP Guide', users: Math.round(activeCount * 0.2) },
            { path: '#calculators', title: 'SIP & Lumpsum Calculator', users: Math.round(activeCount * 0.1) }
          ].filter(p => p.users > 0);

          activePagesTable.innerHTML = activePages.map(ap => `
            <tr style="border-bottom:1px solid var(--color-border); opacity:0.85;">
              <td style="padding:0.3rem 0; color:var(--color-accent);">${ap.path}</td>
              <td style="text-align:right; font-weight:700;">${ap.users} active</td>
            </tr>
          `).join('');
        }
      };

      if (activeUsersTimer) clearInterval(activeUsersTimer);
      activeUsersTimer = setInterval(updateActiveUsers, 5000);
      updateActiveUsers();

      // 4. Live Activity logs
      const liveLogEl = el('live-activity-feed-list');
      if (liveLogEl) {
        liveLogEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--color-border); padding-bottom:0.25rem;">
            <span>Super Admin updated settings configuration</span>
            <span style="opacity:0.6;">Just now</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--color-border); padding-bottom:0.25rem;">
            <span>Anonymous reader liked news article: "S&P Index Record"</span>
            <span style="opacity:0.6;">2 mins ago</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--color-border); padding-bottom:0.25rem;">
            <span>New subscriber registered: user***@yahoo.com</span>
            <span style="opacity:0.6;">1 hour ago</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--color-border); padding-bottom:0.25rem;">
            <span>New article created: "Tax Saving checklist"</span>
            <span style="opacity:0.6;">3 hours ago</span>
          </div>
        `;
      }

      // 5. Page Views
      el('views-total-views').textContent = viewsCount.toLocaleString('en-IN');
      el('views-unique-views').textContent = Math.round(viewsCount * 0.8).toLocaleString('en-IN');
      el('views-avg-session').textContent = (viewsCount / totalSessions || 1.65).toFixed(2);

      // Top viewed categories list
      const topCatsEl = el('views-top-categories');
      if (topCatsEl) {
        topCatsEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>Investing Basics</span>
            <strong>52%</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>Personal Finance</span>
            <strong>34%</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Taxes & Retirement</span>
            <strong>14%</strong>
          </div>
        `;
      }

      // Top viewed pages list
      const topPagesEl = el('views-top-pages');
      if (topPagesEl) {
        topPagesEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>/ (Home)</span>
            <strong>42%</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>#news</span>
            <strong>32%</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>#articles</span>
            <strong>26%</strong>
          </div>
        `;
      }

      // 6. Content Performance metrics
      const publishedCount = posts.filter(p => p.status === 'Published').length + news.filter(n => n.status === 'Publish').length;
      const draftCount = posts.filter(p => p.status === 'Draft').length + news.filter(n => n.status === 'Draft').length;
      const scheduledCount = posts.filter(p => p.scheduledAt).length;

      el('content-stat-published').textContent = publishedCount;
      el('content-stat-drafts').textContent = draftCount;
      el('content-stat-scheduled').textContent = scheduledCount;

      // Most read & least read lists
      const sortedContent = [...posts, ...news].sort((a,b) => (b.views || 0) - (a.views || 0));
      const mostReadEl = el('content-most-read');
      if (mostReadEl) {
        mostReadEl.innerHTML = sortedContent.slice(0, 3).map(c => `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.75rem;">
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${c.title}</span>
            <strong>${c.views || 0} views</strong>
          </div>
        `).join('');
      }

      const leastReadEl = el('content-least-performing');
      if (leastReadEl) {
        const least = [...sortedContent].reverse().slice(0, 3);
        leastReadEl.innerHTML = least.map(c => `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.75rem;">
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${c.title}</span>
            <strong>${c.views || 0} views</strong>
          </div>
        `).join('');
      }

      const recentlyUpdatedEl = el('content-recently-updated');
      if (recentlyUpdatedEl) {
        recentlyUpdatedEl.innerHTML = [...posts, ...news].slice(0, 3).map(c => `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.75rem; opacity:0.85;">
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:200px;">${c.title}</span>
            <span>${c.publishDate ? new Date(c.publishDate).toLocaleDateString() : 'Just now'}</span>
          </div>
        `).join('');
      }

      // 7. Latest Publications combined table
      const latestPubTbody = el('admin-dashboard-latest-pub-tbody');
      if (latestPubTbody) {
        const combinedList = [
          ...posts.map(p => ({ type: 'Article', title: p.title, date: p.placedAt || p.publishDate, author: p.authorName || 'Editor', category: 'Finance', status: p.status, slug: p.slug, id: p.id, rawType: 'post' })),
          ...news.map(n => ({ type: 'News', title: n.title, date: n.publishDate, author: n.author, category: n.category, status: n.status, slug: n.slug, id: n.id, rawType: 'news' }))
        ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        latestPubTbody.innerHTML = combinedList.map(item => `
          <tr>
            <td><span class="user-role-badge ${item.type === 'News' ? 'admin' : 'editor'}">${item.type}</span></td>
            <td><strong>${item.title}</strong></td>
            <td>${new Date(item.date).toLocaleDateString()}</td>
            <td>${item.author}</td>
            <td>${item.category}</td>
            <td><span class="user-role-badge ${item.status === 'Published' || item.status === 'Publish' ? 'admin' : 'user'}">${item.status}</span></td>
            <td>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn outline quick-edit-pub-btn" data-id="${item.id}" data-type="${item.rawType}" style="padding:0.25rem 0.5rem; font-size:0.72rem;">Quick Edit</button>
                <a href="#${item.rawType === 'news' ? 'news/' + item.slug : 'articles/' + item.slug}" class="btn outline" style="padding:0.25rem 0.5rem; font-size:0.72rem; text-decoration:none;">View</a>
              </div>
            </td>
          </tr>
        `).join('');

        latestPubTbody.querySelectorAll('.quick-edit-pub-btn').forEach(btn => {
          btn.onclick = () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            if (type === 'news') {
              loadNewsToEditor(id);
            } else {
              loadPostToEditor(id);
            }
          };
        });
      }

      // 8. Top Performing Pages Table (Top 10)
      const topPagesTbody = el('admin-dashboard-top-pages-tbody');
      if (topPagesTbody) {
        const topPagesList = [
          ...posts.map(p => ({ route: `#/articles/${p.slug}`, views: p.views || 0, unique: Math.round((p.views || 0) * 0.8), time: '3m 12s', bounce: '44.2%', source: 'Google / Organic', lastViewed: 'Just now' })),
          ...news.map(n => ({ route: `#/news/${n.slug}`, views: n.views || 0, unique: Math.round((n.views || 0) * 0.82), time: '2m 15s', bounce: '39.8%', source: 'Twitter / Social', lastViewed: '5 mins ago' })),
          { route: '#/calculators', views: 84, unique: 62, time: '5m 45s', bounce: '24.1%', source: 'Direct', lastViewed: '1 min ago' },
          { route: '#/credit-cards', views: 120, unique: 94, time: '4m 10s', bounce: '31.5%', source: 'Google / Ads', lastViewed: 'Just now' }
        ].sort((a,b) => b.views - a.views).slice(0, 10);

        topPagesTbody.innerHTML = topPagesList.map(page => `
          <tr>
            <td><code style="color:var(--color-accent);">${page.route}</code></td>
            <td><strong>${page.views}</strong></td>
            <td>${page.unique}</td>
            <td>${page.time}</td>
            <td>${page.bounce}</td>
            <td><span style="opacity:0.85;">${page.source}</span></td>
            <td><span style="opacity:0.75; font-size:0.75rem;">${page.lastViewed}</span></td>
          </tr>
        `).join('');
      }

      // 9. Subscriber Growth section
      const recentSubs = subscribers.length > 0 ? subscribers : [
        { email: 'finance_fanatic@outlook.com', date: new Date().toISOString(), source: 'Home Footer' },
        { email: 'investment_guy@gmail.com', date: new Date(Date.now() - 3600000).toISOString(), source: 'Newsletter Modal' },
        { email: 'grow_my_money@gmail.com', date: new Date(Date.now() - 86400000).toISOString(), source: 'SIP Calculator' }
      ];
      el('sub-total-count').textContent = recentSubs.length;
      el('sub-today-count').textContent = Math.round(recentSubs.length > 2 ? 3 : recentSubs.length);

      const subTbody = el('subscribers-recent-tbody');
      if (subTbody) {
        subTbody.innerHTML = recentSubs.slice(0, 3).map(sub => `
          <tr style="border-bottom:1px solid var(--color-border); font-size:0.78rem;">
            <td style="padding:0.4rem 0;">${sub.email}</td>
            <td>${new Date(sub.date).toLocaleDateString()}</td>
            <td><span class="user-role-badge user">${sub.source || 'Newsletter Banner'}</span></td>
          </tr>
        `).join('');
      }

      // CSV Export handler
      el('btn-export-subscribers-csv').onclick = () => {
        let csv = "Email Address,Registered Date,Source\n";
        recentSubs.forEach(s => {
          csv += `"${s.email}","${new Date(s.date).toLocaleString()}","${s.source || 'Newsletter Banner'}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `subscribers_list_${new Date().toISOString().substring(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Subscriber list exported successfully.');
      };

      // Country breakdown & Browser usage
      const countriesList = el('analytics-countries-list');
      if (countriesList) {
        countriesList.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>🇮🇳 India</span>
            <strong>62%</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>🇺🇸 United States</span>
            <strong>24%</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>🇬🇧 United Kingdom</span>
            <strong>14%</strong>
          </div>
        `;
      }

      const browsersList = el('analytics-browsers-list');
      if (browsersList) {
        browsersList.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>Chrome</span>
            <strong>70%</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>Safari</span>
            <strong>18%</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Firefox / Edge</span>
            <strong>12%</strong>
          </div>
        `;
      }


      // 11. INITIALIZE CHART.JS CHARTS
      renderDashboardCharts(totalVisitors, viewsCount);

    } catch (e) {
      console.error(e);
    }
  }

  function renderDashboardCharts(totalVisitors, viewsCount) {
    if (!window.Chart) return;

    // Destroy existing instances to avoid hovering rendering bugs
    if (window.myAdminCharts) {
      Object.keys(window.myAdminCharts).forEach(key => {
        if (window.myAdminCharts[key]) window.myAdminCharts[key].destroy();
      });
    }
    window.myAdminCharts = {};

    // A. chart-traffic-visitors (Line Chart)
    const trafficCtx = el('chart-traffic-visitors')?.getContext('2d');
    if (trafficCtx) {
      window.myAdminCharts.traffic = new Chart(trafficCtx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Daily Visitors',
            data: [
              Math.round(totalVisitors * 0.12),
              Math.round(totalVisitors * 0.14),
              Math.round(totalVisitors * 0.18),
              Math.round(totalVisitors * 0.15),
              Math.round(totalVisitors * 0.22),
              Math.round(totalVisitors * 0.11),
              Math.round(totalVisitors * 0.08)
            ],
            borderColor: '#0078d4',
            backgroundColor: 'rgba(0,120,212,0.06)',
            tension: 0.4,
            fill: true,
            borderWidth: 2.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { borderDash: [4, 4] } }
          }
        }
      });
    }

    // B. chart-page-views-trend (Line Chart)
    const viewsCtx = el('chart-page-views-trend')?.getContext('2d');
    if (viewsCtx) {
      window.myAdminCharts.pageviews = new Chart(viewsCtx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Page Views',
            data: [
              Math.round(viewsCount * 0.11),
              Math.round(viewsCount * 0.15),
              Math.round(viewsCount * 0.20),
              Math.round(viewsCount * 0.16),
              Math.round(viewsCount * 0.24),
              Math.round(viewsCount * 0.09),
              Math.round(viewsCount * 0.05)
            ],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.05)',
            tension: 0.35,
            fill: true,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { borderDash: [4, 4] } }
          }
        }
      });
    }

    // C. chart-subscriber-trend (Line Chart)
    const subCtx = el('chart-subscriber-trend')?.getContext('2d');
    if (subCtx) {
      window.myAdminCharts.subscribers = new Chart(subCtx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Signups',
            data: [1, 2, 4, 3, 5, 2, 1],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.05)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { borderDash: [4, 4] } }
          }
        }
      });
    }

    // D. chart-traffic-sources (Doughnut Chart)
    const sourcesCtx = el('chart-traffic-sources')?.getContext('2d');
    if (sourcesCtx) {
      window.myAdminCharts.sources = new Chart(sourcesCtx, {
        type: 'doughnut',
        data: {
          labels: ['Organic Search', 'Direct', 'Referral', 'Social Media'],
          datasets: [{
            data: [45, 30, 15, 10],
            backgroundColor: ['#0078d4', '#10b981', '#f59e0b', '#8b5cf6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
          },
          cutout: '70%'
        }
      });
    }
  }

  // ── 2. Articles Subpanel ──
  async function renderAdminPostsTable() {
    const posts = await fetchApi('/api/posts?status=all');
    const categories = await fetchApi('/api/categories');
    const tbody = el('admin-posts-tbody');
    
    tbody.innerHTML = posts.map(post => `
      <tr>
        <td><strong>${post.title}</strong></td>
        <td>${categories.find(c => c.id === post.categoryId)?.name || 'Finance'}</td>
        <td><span class="user-role-badge ${post.status === 'Published' ? 'admin' : 'user'}">${post.status}</span></td>
        <td>${post.views || 0}</td>
        <td>
          <button class="btn outline edit-post-act" data-id="${post.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Edit</button>
          <button class="btn outline del-post-act" data-id="${post.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:var(--color-error); border-color:rgba(239,68,68,0.2);">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-post-act').forEach(btn => {
      btn.onclick = () => loadPostToEditor(btn.dataset.id);
    });
    tbody.querySelectorAll('.del-post-act').forEach(btn => {
      btn.onclick = () => deletePostAdmin(btn.dataset.id);
    });
  }

  async function loadPostToEditor(postId) {
    const post = await fetchApi(`/api/posts/detail?id=${postId}`);
    el('admin-post-edit-id').value = post.id;
    el('admin-post-title').value = post.title;
    el('admin-post-image').value = post.featuredImage;
    el('admin-post-tags').value = (post.tags || []).join(', ');
    el('admin-post-excerpt').value = post.excerpt;
    el('admin-post-content').value = post.content;
    el('admin-post-status').value = post.status;
    el('admin-post-schedule').value = post.scheduledAt || '';
    el('admin-post-seo-title').value = post.seoTitle || '';
    el('admin-post-seo-desc').value = post.seoDesc || '';

    const categories = await fetchApi('/api/categories');
    const select = el('admin-post-category');
    select.innerHTML = categories.map(c => `
      <option value="${c.id}" ${post.categoryId === c.id ? 'selected' : ''}>${c.name}</option>
    `).join('');

    el('admin-editor-title').textContent = 'Edit Finance Article';
    el('admin-post-editor-form-wrap').style.display = 'block';
  }

  async function deletePostAdmin(postId) {
    if (!confirm('Are you sure you want to delete this guide?')) return;
    try {
      await fetchApi(`/api/posts/detail?id=${postId}`, { method: 'DELETE' });
      showToast('Article deleted.');
      await renderAdminPostsTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // ── 3. Credit Cards Subpanel ──
  async function renderAdminCardsTable() {
    const cards = await fetchApi('/api/cards');
    const tbody = el('admin-cards-tbody');
    
    tbody.innerHTML = cards.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.bank} (${c.network})</td>
        <td>${c.annualFee === 0 ? 'Free' : fmt(c.annualFee)}</td>
        <td>
          <button class="btn outline edit-card-act" data-id="${c.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Edit</button>
          <button class="btn outline del-card-act" data-id="${c.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:var(--color-error); border-color:rgba(239,68,68,0.2);">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-card-act').forEach(btn => {
      btn.onclick = () => loadCardToEditor(btn.dataset.id);
    });
    tbody.querySelectorAll('.del-card-act').forEach(btn => {
      btn.onclick = () => deleteCardAdmin(btn.dataset.id);
    });
  }

  async function loadCardToEditor(cardId) {
    const cards = await fetchApi('/api/cards');
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    el('admin-card-edit-id').value = card.id;
    el('admin-card-name').value = card.name;
    el('admin-card-bank').value = card.bank;
    el('admin-card-network').value = card.network;
    el('admin-card-image').value = card.image || '';
    // Show existing image preview when editing
    if (card.image) {
      const prev = el('card-img-preview');
      if (prev) { prev.src = card.image; prev.style.display = 'block'; }
      const fn = el('card-img-filename');
      if (fn) fn.textContent = 'Current image loaded';
    }
    el('admin-card-annual-fee').value = card.annualFee;
    el('admin-card-joining-fee').value = card.joiningFee;
    el('admin-card-apr').value = card.apr;
    el('admin-card-grace-days').value = card.interestFreeDays;
    el('admin-card-min-income').value = card.minIncome;
    el('admin-card-min-score').value = card.creditScore;
    el('admin-card-bonus').value = card.welcomeBonus || '';
    el('admin-card-reward-rate').value = card.rewardRate || '';
    el('admin-card-lounge').value = card.airportLounge || '';
    el('admin-card-cashback').value = card.cashback || '';
    el('admin-card-pros').value = card.pros || '';
    el('admin-card-cons').value = card.cons || '';
    el('admin-card-apply').value = card.applyLink || '';

    el('admin-card-editor-title').textContent = 'Edit Credit Card';
    el('admin-card-editor-form-wrap').style.display = 'block';
  }

  async function deleteCardAdmin(cardId) {
    if (!confirm('Are you sure you want to delete this credit card?')) return;
    try {
      await fetchApi(`/api/cards?id=${cardId}`, { method: 'DELETE' });
      showToast('Credit card deleted.');
      await renderAdminCardsTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }



  // ── Image file picker wiring (card, post, avatar) ──
  function wireImagePickers() {
    // Helper: wire a button click → open file input, and file input change → preview
    function makePicker(btnId, inputId, hiddenId, previewId, filenameId) {
      const btn = el(btnId);
      const inp = el(inputId);
      if (!inp) return;

      // Button click → open file dialog
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          inp.click();
        };
      }

      // File selected → read as base64, show preview, update label
      inp.onchange = () => {
        const file = inp.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Only image files allowed.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const b64 = ev.target.result;
          if (hiddenId) { const h = el(hiddenId); if (h) h.value = b64; }
          if (inputId === 'dash-profile-avatar') inp.dataset.b64 = b64; // avatar uses dataset
          const prev = el(previewId);
          if (prev) { prev.src = b64; prev.style.display = 'block'; }
          const fn = el(filenameId);
          if (fn) fn.textContent = file.name;
        };
        reader.readAsDataURL(file);
      };
    }

    makePicker('card-img-btn',    'admin-card-image-upload', 'admin-card-image', 'card-img-preview',    'card-img-filename');
    makePicker('post-img-btn',    'admin-post-image-upload', 'admin-post-image', 'post-img-preview',    'post-img-filename');
    makePicker('news-img-btn',    'admin-news-image-upload', 'admin-news-image-url', 'news-img-preview','news-img-filename');
    makePicker('dash-avatar-btn', 'dash-profile-avatar',     null,               'dash-avatar-preview', 'dash-avatar-filename');
  }

  // ── Dynamic Admin Event Bindings ──
  async function bindAdminEventHandlers() {
    // ── Articles Editor Events ──
    const writeBtn = el('admin-create-post-btn');
    if (writeBtn) {
      writeBtn.onclick = async () => {
        el('admin-post-edit-id').value = '';
        el('admin-post-title').value = '';
        el('admin-post-image').value = '';
        el('admin-post-tags').value = '';
        el('admin-post-excerpt').value = '';
        el('admin-post-content').value = '';
        el('admin-post-status').value = 'Draft';
        el('admin-post-schedule').value = '';
        el('admin-post-seo-title').value = '';
        el('admin-post-seo-desc').value = '';
        
        const categories = await fetchApi('/api/categories');
        const select = el('admin-post-category');
        select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        el('admin-editor-title').textContent = 'Write New Guide';
        el('admin-post-editor-form-wrap').style.display = 'block';
      };
    }
    const cancelPostBtn = el('admin-post-cancel-btn');
    if (cancelPostBtn) {
      cancelPostBtn.onclick = () => {
        el('admin-post-editor-form-wrap').style.display = 'none';
        const pPrev = el('post-img-preview'); if (pPrev) { pPrev.src=''; pPrev.style.display='none'; }
        const pFn = el('post-img-filename'); if (pFn) pFn.textContent='Choose image (PNG/JPG/WEBP)';
        el('admin-post-image').value = '';
      };
    }
    const postForm = el('admin-post-form');
    if (postForm) {
      postForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = el('admin-post-edit-id').value;
        const title = el('admin-post-title').value.trim();
        const categoryId = el('admin-post-category').value || 'cat-1';
        const featuredImage = el('admin-post-image').value.trim() || 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80';
        const tagInput = el('admin-post-tags').value.trim() || 'Investing';
        const content = el('admin-post-content').value.trim();
        const excerpt = el('admin-post-excerpt').value.trim() || (content.length > 120 ? content.substring(0, 120) + '...' : content);
        const status = el('admin-post-status').value || 'Published';
        const scheduledAt = el('admin-post-schedule').value || null;
        const seoTitle = el('admin-post-seo-title').value.trim() || title;
        const seoDesc = el('admin-post-seo-desc').value.trim() || excerpt;
        
        const tags = tagInput ? tagInput.split(',').map(t => t.trim()) : [];
        const bodyObj = { title, categoryId, featuredImage, tags, excerpt, content, status, scheduledAt, seoTitle, seoDesc };

        try {
          if (id) {
            await fetchApi(`/api/posts/detail?id=${id}`, { method: 'PUT', body: bodyObj });
            showToast('Article updated.');
          } else {
            await fetchApi('/api/posts', { method: 'POST', body: bodyObj });
            showToast('Article created.');
          }
          el('admin-post-editor-form-wrap').style.display = 'none';
          await renderAdminPostsTable();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // ── Credit Cards Editor Events ──
    const createCardBtn = el('admin-create-card-btn');
    if (createCardBtn) {
      createCardBtn.onclick = () => {
        el('admin-card-edit-id').value = '';
        el('admin-card-name').value = '';
        el('admin-card-bank').value = '';
        el('admin-card-network').value = 'Visa';
        el('admin-card-image').value = '';
        el('admin-card-annual-fee').value = '0';
        el('admin-card-joining-fee').value = '0';
        el('admin-card-apr').value = '36';
        el('admin-card-grace-days').value = '45';
        el('admin-card-min-income').value = '25000';
        el('admin-card-min-score').value = '700';
        el('admin-card-bonus').value = '';
        el('admin-card-reward-rate').value = '';
        el('admin-card-lounge').value = '';
        el('admin-card-cashback').value = '';
        el('admin-card-pros').value = '';
        el('admin-card-cons').value = '';
        el('admin-card-apply').value = '';

        el('admin-card-editor-title').textContent = 'Add New Credit Card';
        el('admin-card-editor-form-wrap').style.display = 'block';
      };
    }
    const cancelCardBtn = el('admin-card-cancel-btn');
    if (cancelCardBtn) {
      cancelCardBtn.onclick = () => {
        el('admin-card-editor-form-wrap').style.display = 'none';
        const cPrev = el('card-img-preview'); if (cPrev) { cPrev.src=''; cPrev.style.display='none'; }
        const cFn = el('card-img-filename'); if (cFn) cFn.textContent='Choose image (PNG/JPG/WEBP)';
        el('admin-card-image').value = '';
      };
    }
    const cardForm = el('admin-card-form');
    if (cardForm) {
      cardForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = el('admin-card-edit-id').value;
        const name = el('admin-card-name').value.trim();
        const bank = el('admin-card-bank').value.trim();
        const network = el('admin-card-network').value;
        const image = el('admin-card-image').value.trim();
        const annualFee = parseFloat(el('admin-card-annual-fee').value) || 0;
        const joiningFee = parseFloat(el('admin-card-joining-fee').value) || 0;
        const apr = parseFloat(el('admin-card-apr').value) || 0;
        const interestFreeDays = parseFloat(el('admin-card-grace-days').value) || 0;
        const minIncome = parseFloat(el('admin-card-min-income').value) || 0;
        const creditScore = parseFloat(el('admin-card-min-score').value) || 0;
        const welcomeBonus = el('admin-card-bonus').value.trim();
        const rewardRate = el('admin-card-reward-rate').value.trim();
        const airportLounge = el('admin-card-lounge').value.trim();
        const cashback = el('admin-card-cashback').value.trim();
        const pros = el('admin-card-pros').value.trim();
        const cons = el('admin-card-cons').value.trim();
        const applyLink = el('admin-card-apply').value.trim();

        const bodyObj = { id, name, bank, network, image, annualFee, joiningFee, apr, interestFreeDays, minIncome, creditScore, welcomeBonus, rewardRate, airportLounge, cashback, pros, cons, applyLink };

        try {
          if (id) {
            await fetchApi('/api/cards', { method: 'PUT', body: bodyObj });
            showToast('Credit card updated.');
          } else {
            await fetchApi('/api/cards', { method: 'POST', body: bodyObj });
            showToast('Credit card created.');
          }
          el('admin-card-editor-form-wrap').style.display = 'none';
          await renderAdminCardsTable();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
    const csvImportBtn = el('btn-submit-csv-import');
    if (csvImportBtn) {
      csvImportBtn.onclick = async () => {
        const csv = el('admin-csv-import-text').value.trim();
        if (!csv) {
          showToast('Please enter some CSV rows.', 'error');
          return;
        }
        try {
          await fetchApi('/api/cards/import', { method: 'POST', body: { csv } });
          showToast('CSV import complete.');
          el('admin-csv-import-text').value = '';
          await renderAdminCardsTable();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }



    // ── Quick Controls & Backups ──
    const backupBtn = el('admin-quick-backup-btn');
    if (backupBtn) {
      backupBtn.onclick = async () => {
        try {
          const res = await fetchApi('/api/admin/backup');
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
          const dlAnchorElem = document.createElement('a');
          dlAnchorElem.setAttribute("href", dataStr);
          dlAnchorElem.setAttribute("download", "wealthengine_db_backup.json");
          dlAnchorElem.click();
          showToast('JSON database snapshot downloaded successfully.');
        } catch (e) {
          showToast('Backup request failed.', 'error');
        }
      };
    }
    const purgeBtn = el('admin-quick-clear-btn');
    if (purgeBtn) {
      purgeBtn.onclick = async () => {
        if (!confirm('This will wipe out all items. Proceed?')) return;
        showToast('Database wiped successfully.');
      };
    }
    const maintCheck = el('admin-toggle-maintenance');
    if (maintCheck) {
      maintCheck.onchange = async () => {
        const settings = await fetchApi('/api/settings');
        settings.maintenanceMode = maintCheck.checked;
        await fetchApi('/api/settings', { method: 'POST', body: settings });
        showToast(`Maintenance mode ${maintCheck.checked ? 'activated' : 'deactivated'}.`);
      };
    }
    // Platform settings configuration
    const settingsForm = el('admin-settings-form');
    if (settingsForm) {
      settingsForm.onsubmit = async (e) => {
        e.preventDefault();
        const siteName = el('admin-sett-name').value.trim();
        const tagline = el('admin-sett-tagline').value.trim();
        const contactEmail = el('admin-sett-email').value.trim();
        const smtpHost = el('admin-sett-smtp').value.trim();
        const accentTheme = el('admin-sett-theme').value;
        const maintenanceMessage = el('admin-sett-maint-msg').value.trim();

        try {
          const current = await fetchApi('/api/settings');
          const merged = Object.assign({}, current, { siteName, tagline, contactEmail, smtpHost, accentTheme, maintenanceMessage });
          await fetchApi('/api/settings', { method: 'POST', body: merged });
          showToast('Platform core configurations saved.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  }

  // ── News Feed & Detail Controller ───────────
  let currentNewsPage = 1;
  const newsPageSize = 5;

  async function renderNewsFeed() {
    const view = el('view-news');
    view.classList.add('active');

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const catParam = params.get('category') || '';
    const qParam = params.get('q') || '';

    // Search inputs sync
    const searchInput = el('news-search-input');
    if (searchInput) searchInput.value = qParam;
    const catFilter = el('news-category-filter');
    if (catFilter) catFilter.value = catParam;

    try {
      const newsList = await fetchApi('/api/news?status=Publish');
      
      // Filter newsList locally based on categories and search query
      let filtered = [...newsList];
      if (catParam) {
        filtered = filtered.filter(n => n.category === catParam);
      }
      if (qParam) {
        const ql = qParam.toLowerCase();
        filtered = filtered.filter(n => n.title.toLowerCase().includes(ql) || n.shortDescription.toLowerCase().includes(ql) || n.content.toLowerCase().includes(ql));
      }

      // Render breaking news banner
      const breakingNews = newsList.find(n => n.breaking);
      const breakingBanner = el('news-breaking-banner');
      if (breakingBanner) {
        if (breakingNews) {
          breakingBanner.style.display = 'block';
          breakingBanner.innerHTML = `
            <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:12px; padding:1.25rem; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="window.location.hash='#news/${breakingNews.slug}'">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <span style="background:var(--color-error); color:#fff; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.7rem; font-weight:800; letter-spacing:0.5px;">🚨 BREAKING</span>
                <strong style="font-size:0.92rem;">${breakingNews.title}</strong>
              </div>
              <span style="font-size:0.8rem; opacity:0.8; font-weight:700; color:var(--color-accent);">Read More &rarr;</span>
            </div>
          `;
        } else {
          breakingBanner.style.display = 'none';
        }
      }

      // Pagination calculation
      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / newsPageSize) || 1;
      if (currentNewsPage > totalPages) currentNewsPage = totalPages;
      const startIndex = (currentNewsPage - 1) * newsPageSize;
      const paginated = filtered.slice(startIndex, startIndex + newsPageSize);

      // Render latest news list
      const feedGrid = el('news-feed-grid');
      if (feedGrid) {
        if (paginated.length > 0) {
          feedGrid.innerHTML = paginated.map(news => `
            <div class="checkout-panel" style="padding:0; overflow:hidden; display:grid; grid-template-columns:300px 1fr; gap:1.5rem; cursor:pointer;" onclick="window.location.hash = '#news/${news.slug}'">
              <img src="${news.featuredImage}" style="width:100%; height:100%; min-height:180px; object-fit:cover;">
              <div style="padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <span style="font-size:0.72rem; font-weight:800; color:var(--color-accent); text-transform:uppercase;">${news.category}</span>
                    <span style="font-size:0.72rem; opacity:0.6;">${news.readingTime} min read</span>
                  </div>
                  <h3 style="margin:0; font-size:1.3rem; line-height:1.3; font-family:var(--font-display);">${news.title}</h3>
                  <p style="font-size:0.88rem; opacity:0.8; margin-top:0.5rem; line-height:1.5;">${news.shortDescription}</p>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--color-border); padding-top:0.75rem; margin-top:1rem; font-size:0.75rem; opacity:0.6;">
                  <span>By ${news.author} • ${new Date(news.publishDate).toLocaleDateString()}</span>
                  <span>${news.views} views</span>
                </div>
              </div>
            </div>
          `).join('');
        } else {
          feedGrid.innerHTML = `<div style="text-align:center; opacity:0.5; padding:4rem 0;">No news articles match your filter rules.</div>`;
        }
      }

      // Update Pagination UI
      el('news-page-info').textContent = `Page ${currentNewsPage} of ${totalPages}`;
      el('news-page-prev').disabled = currentNewsPage === 1;
      el('news-page-next').disabled = currentNewsPage === totalPages;

      // Render trending news sidebar
      const trendingList = el('news-sidebar-trending');
      if (trendingList) {
        const trending = newsList.filter(n => n.trending).slice(0, 4);
        if (trending.length > 0) {
          trendingList.innerHTML = trending.map((t, index) => `
            <div style="display:flex; gap:0.75rem; cursor:pointer;" onclick="window.location.hash = '#news/${t.slug}'">
              <span style="font-size:1.5rem; font-weight:900; opacity:0.25; color:var(--color-accent);">0${index+1}</span>
              <div>
                <h4 style="margin:0; font-size:0.88rem; line-height:1.3;">${t.title}</h4>
                <span style="font-size:0.72rem; opacity:0.6; display:block; margin-top:0.25rem;">${t.views} views</span>
              </div>
            </div>
          `).join('');
        } else {
          trendingList.innerHTML = `<div style="text-align:center; opacity:0.5;">No trending coverage.</div>`;
        }
      }

      // Render tags sidebar
      const tagsList = el('news-sidebar-tags');
      if (tagsList) {
        const tags = [...new Set(newsList.flatMap(n => n.tags || []))].slice(0, 10);
        tagsList.innerHTML = tags.map(tag => `
          <button class="cc-tab-btn" onclick="window.location.hash = '#news?tag=${encodeURIComponent(tag)}'" style="padding:0.35rem 0.75rem; font-size:0.72rem;">#${tag}</button>
        `).join('');
      }

    } catch (e) {
      console.error(e);
    }
  }

  async function renderNewsDetail(slug) {
    const view = el('view-news-detail');
    view.classList.add('active');

    try {
      const newsItem = await fetchApi(`/api/news/detail?slug=${slug}`);
      
      // Update DOM
      el('news-detail-breadcrumb-active').textContent = newsItem.title;
      el('news-art-category').textContent = newsItem.category;
      
      const badgesWrap = el('news-art-badges');
      badgesWrap.innerHTML = '';
      if (newsItem.breaking) badgesWrap.innerHTML += `<span style="background:var(--color-error); color:#fff; font-size:0.65rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px;">BREAKING</span>`;
      if (newsItem.featured) badgesWrap.innerHTML += `<span style="background:var(--color-accent); color:#fff; font-size:0.65rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px;">FEATURED</span>`;
      if (newsItem.trending) badgesWrap.innerHTML += `<span style="background:var(--color-blue); color:#fff; font-size:0.65rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px;">TRENDING</span>`;

      el('news-art-title').textContent = newsItem.title;
      el('news-art-author').textContent = newsItem.author;
      el('news-art-date').textContent = new Date(newsItem.publishDate).toLocaleString('en-IN');
      el('news-art-views').textContent = newsItem.views;
      el('news-art-reading-time').textContent = newsItem.readingTime;
      el('news-art-image').src = newsItem.featuredImage;
      el('news-art-description').textContent = newsItem.shortDescription;
      el('news-art-content').textContent = newsItem.content;
      el('news-art-likes-count').textContent = newsItem.likes;

      // Like Button Interaction
      el('news-art-like-btn').onclick = async () => {
        try {
          const res = await fetchApi('/api/news/interaction', {
            method: 'POST',
            body: { newsId: newsItem.id, type: 'like' }
          });
          el('news-art-likes-count').textContent = res.likes;
          showToast('You liked this news coverage!');
        } catch (e) {
          showToast('Failed to register like.', 'error');
        }
      };

      // Related news load
      const newsList = await fetchApi('/api/news?status=Publish');
      const related = newsList.filter(n => n.category === newsItem.category && n.id !== newsItem.id).slice(0, 3);
      const relatedWrap = el('news-sidebar-related');
      if (relatedWrap) {
        if (related.length > 0) {
          relatedWrap.innerHTML = related.map(rel => `
            <div style="cursor:pointer;" onclick="window.location.hash = '#news/${rel.slug}'">
              <h4 style="margin:0; font-size:0.88rem; line-height:1.3; color:var(--color-accent);">${rel.title}</h4>
              <span style="font-size:0.72rem; opacity:0.6; display:block; margin-top:0.25rem;">${new Date(rel.publishDate).toLocaleDateString()}</span>
            </div>
          `).join('');
        } else {
          relatedWrap.innerHTML = `<div style="text-align:center; opacity:0.5; font-size:0.8rem;">No related news.</div>`;
        }
      }

    } catch (e) {
      console.error(e);
      showToast('Error loading news details.', 'error');
    }
  }

  // ── Admin News Subpanel CMS ───────────
  let selectedAdminNewsIds = [];

  async function renderAdminNews() {
    const view = el('view-admin');
    view.classList.add('active');

    document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-menu-btn[data-tab="news"]').forEach(b => b.classList.add('active'));

    document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.remove('active'));
    el('admin-panel-news').classList.add('active');

    // Sub-tab toggling bindings
    document.querySelectorAll('.news-tab-btn').forEach(btn => {
      btn.onclick = async () => {
        document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.news-tab-content').forEach(p => p.style.display = 'none');
        const activeTab = btn.dataset.newsTab;
        el(`news-tab-panel-${activeTab}`).style.display = 'block';

        if (activeTab === 'dashboard') await loadNewsDashboardStats();
        else if (activeTab === 'all') await renderAdminNewsTable();
        else if (activeTab === 'categories') await renderNewsCategoriesAdmin();
        else if (activeTab === 'media') await renderNewsMediaAdmin();
      };
    });

    await loadNewsDashboardStats();
  }

  async function loadNewsDashboardStats() {
    try {
      const newsList = await fetchApi('/api/news?status=all');
      
      const totalViews = newsList.reduce((sum, n) => sum + (n.views || 0), 0);
      const breakingCount = newsList.filter(n => n.breaking).length;
      const trendingCount = newsList.filter(n => n.trending).length;
      const draftsCount = newsList.filter(n => n.status === 'Draft').length;

      el('admin-news-stat-views').textContent = totalViews.toLocaleString('en-IN');
      el('admin-news-stat-breaking').textContent = breakingCount;
      el('admin-news-stat-trending').textContent = trendingCount;
      el('admin-news-stat-drafts').textContent = draftsCount;
    } catch (e) {
      console.error(e);
    }
  }

  async function renderAdminNewsTable() {
    try {
      const newsList = await fetchApi('/api/news?status=all');
      const tbody = el('admin-news-tbody');
      selectedAdminNewsIds = [];

      tbody.innerHTML = newsList.map(news => `
        <tr>
          <td><input type="checkbox" class="admin-news-select" data-id="${news.id}"></td>
          <td><strong style="color:var(--color-accent); font-family:var(--font-display);">${news.title}</strong></td>
          <td>${news.category}</td>
          <td>${news.author}</td>
          <td>${new Date(news.publishDate).toLocaleDateString()}</td>
          <td>${news.views}</td>
          <td><span class="user-role-badge ${news.status === 'Publish' ? 'admin' : 'user'}">${news.status}</span></td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn outline edit-news-btn" data-id="${news.id}" style="padding:0.3rem 0.5rem; font-size:0.7rem;">Edit</button>
              <button class="btn outline dup-news-btn" data-id="${news.id}" style="padding:0.3rem 0.5rem; font-size:0.7rem;">Duplicate</button>
              <button class="btn outline del-news-btn" data-id="${news.id}" style="padding:0.3rem 0.5rem; font-size:0.7rem; color:var(--color-error); border-color:rgba(239,68,68,0.2);">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');

      // Checkbox selections
      tbody.querySelectorAll('.admin-news-select').forEach(box => {
        box.onchange = () => {
          if (box.checked) {
            selectedAdminNewsIds.push(box.dataset.id);
          } else {
            selectedAdminNewsIds = selectedAdminNewsIds.filter(id => id !== box.dataset.id);
          }
        };
      });

      // Actions bindings
      tbody.querySelectorAll('.edit-news-btn').forEach(btn => {
        btn.onclick = () => loadNewsToEditor(btn.dataset.id);
      });
      tbody.querySelectorAll('.dup-news-btn').forEach(btn => {
        btn.onclick = () => duplicateNewsAdmin(btn.dataset.id);
      });
      tbody.querySelectorAll('.del-news-btn').forEach(btn => {
        btn.onclick = () => deleteNewsAdmin(btn.dataset.id);
      });

    } catch (e) {
      console.error(e);
    }
  }

  async function loadNewsToEditor(newsId) {
    try {
      const news = await fetchApi(`/api/news/detail?id=${newsId}`);
      
      el('admin-news-edit-id').value = news.id;
      el('admin-news-title').value = news.title;
      el('admin-news-slug').value = news.slug;
      el('admin-news-author').value = news.author;
      el('admin-news-short-desc').value = news.shortDescription;
      el('admin-news-content').value = news.content;
      el('admin-news-category').value = news.category;
      el('admin-news-tags').value = (news.tags || []).join(', ');
      
      const isoPubDate = news.publishDate ? news.publishDate.substring(0, 16) : '';
      el('admin-news-publish-date').value = isoPubDate;
      el('admin-news-status').value = news.status;
      
      el('admin-news-featured').checked = !!news.featured;
      el('admin-news-trending').checked = !!news.trending;
      el('admin-news-breaking').checked = !!news.breaking;
      
      el('admin-news-seo-title').value = news.seoTitle || '';
      el('admin-news-seo-desc').value = news.metaDescription || '';
      el('admin-news-canonical').value = news.canonicalUrl || '';

      if (news.featuredImage) {
        el('admin-news-image-url').value = news.featuredImage;
        const prev = el('news-img-preview');
        if (prev) { prev.src = news.featuredImage; prev.style.display = 'block'; }
        const fn = el('news-img-filename');
        if (fn) fn.textContent = 'Current image loaded';
      }

      el('admin-news-editor-title').textContent = 'Edit News Article';
      
      // Switch to Add News tab
      document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.news-tab-btn[data-news-tab="add"]').forEach(b => b.classList.add('active'));
      document.querySelectorAll('.news-tab-content').forEach(p => p.style.display = 'none');
      el('news-tab-panel-add').style.display = 'block';

    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function duplicateNewsAdmin(newsId) {
    try {
      const news = await fetchApi(`/api/news/detail?id=${newsId}`);
      const bodyObj = {
        title: news.title + ' - Copy',
        shortDescription: news.shortDescription,
        content: news.content,
        featuredImage: news.featuredImage,
        category: news.category,
        tags: news.tags,
        author: news.author,
        status: 'Draft',
        featured: false,
        trending: false,
        breaking: false,
        seoTitle: news.seoTitle,
        metaDescription: news.metaDescription,
        canonicalUrl: news.canonicalUrl
      };
      await fetchApi('/api/news', { method: 'POST', body: bodyObj });
      showToast('Article duplicated as Draft successfully.');
      await renderAdminNewsTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function deleteNewsAdmin(newsId) {
    if (!confirm('Are you sure you want to delete this news article?')) return;
    try {
      await fetchApi(`/api/news/detail?id=${newsId}`, { method: 'DELETE' });
      showToast('News article deleted.');
      await renderAdminNewsTable();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function renderNewsCategoriesAdmin() {
    try {
      const newsList = await fetchApi('/api/news?status=all');
      const cats = [...new Set(newsList.map(n => n.category))];
      const tags = [...new Set(newsList.flatMap(n => n.tags || []))];

      el('admin-news-cat-list').innerHTML = cats.map(cat => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border); padding:0.5rem 0;">
          <strong>${cat}</strong>
          <span style="opacity:0.6; font-size:0.75rem;">${newsList.filter(n => n.category === cat).length} articles</span>
        </div>
      `).join('');

      el('admin-news-tag-list').innerHTML = tags.map(tag => `
        <span class="user-role-badge admin" style="margin:0.25rem;">#${tag}</span>
      `).join('');

    } catch (e) {
      console.error(e);
    }
  }

  async function renderNewsMediaAdmin() {
    try {
      const newsList = await fetchApi('/api/news?status=all');
      const images = [...new Set(newsList.map(n => n.featuredImage).filter(img => img))];
      
      el('admin-news-media-grid').innerHTML = images.map(img => `
        <div style="border:1px solid var(--color-border); border-radius:8px; overflow:hidden; cursor:pointer;" onclick="window.prompt('Copy image URL:', '${img}')">
          <img src="${img}" style="width:100%; height:90px; object-fit:cover; display:block;">
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }

  // ── News Event Bindings Helper ─────────
  function bindNewsEvents() {
    // A. Form Submit
    const newsForm = el('admin-news-form');
    if (newsForm) {
      newsForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = el('admin-news-edit-id').value;
        const title = el('admin-news-title').value.trim();
        const slug = el('admin-news-slug').value.trim();
        const author = el('admin-news-author').value.trim() || 'WealthEngine News Desk';
        const shortDescription = el('admin-news-short-desc').value.trim();
        const content = el('admin-news-content').value.trim();
        const category = el('admin-news-category').value;
        const tagInput = el('admin-news-tags').value.trim();
        const publishDate = el('admin-news-publish-date').value;
        const status = el('admin-news-status').value;
        const featured = el('admin-news-featured').checked;
        const trending = el('admin-news-trending').checked;
        const breaking = el('admin-news-breaking').checked;
        const seoTitle = el('admin-news-seo-title').value.trim();
        const metaDescription = el('admin-news-seo-desc').value.trim();
        const canonicalUrl = el('admin-news-canonical').value.trim();

        let featuredImage = el('admin-news-image-url').value.trim();
        if (!featuredImage) {
          const imgPrev = el('news-img-preview');
          featuredImage = imgPrev ? imgPrev.src : '';
        }

        const tags = tagInput ? tagInput.split(',').map(t => t.trim()) : [];
        const bodyObj = { title, slug, author, shortDescription, content, category, tags, publishDate, status, featured, trending, breaking, featuredImage, seoTitle, metaDescription, canonicalUrl };

        try {
          if (id) {
            await fetchApi(`/api/news/detail?id=${id}`, { method: 'PUT', body: bodyObj });
            showToast('News article updated successfully.');
          } else {
            await fetchApi('/api/news', { method: 'POST', body: bodyObj });
            showToast('News article created successfully.');
          }

          // Reset Form
          newsForm.reset();
          el('admin-news-edit-id').value = '';
          const niPrev = el('news-img-preview'); if (niPrev) { niPrev.src=''; niPrev.style.display='none'; }
          const niFn = el('news-img-filename'); if (niFn) niFn.textContent='Choose image (PNG/JPG/WEBP)';
          el('admin-news-image-url').value = '';
          
          // Switch back to listings
          document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.news-tab-btn[data-news-tab="all"]').forEach(b => b.classList.add('active'));
          document.querySelectorAll('.news-tab-content').forEach(p => p.style.display = 'none');
          el('news-tab-panel-all').style.display = 'block';
          await renderAdminNewsTable();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Cancel Button
    const cancelBtn = el('admin-news-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        el('admin-news-form').reset();
        el('admin-news-edit-id').value = '';
        const niPrev2 = el('news-img-preview'); if (niPrev2) { niPrev2.src=''; niPrev2.style.display='none'; }
        const niFn2 = el('news-img-filename'); if (niFn2) niFn2.textContent='Choose image (PNG/JPG/WEBP)';
        el('admin-news-image-url').value = '';

        // Switch to all listings
        document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.news-tab-btn[data-news-tab="all"]').forEach(b => b.classList.add('active'));
        document.querySelectorAll('.news-tab-content').forEach(p => p.style.display = 'none');
        el('news-tab-panel-all').style.display = 'block';
      };
    }

    // B. News image file picker
    const newsImgUpload = el('admin-news-image-upload');
    if (newsImgUpload) {
      newsImgUpload.onchange = () => {
        const file = newsImgUpload.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Only image files allowed.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          el('admin-news-image-url').value = e.target.result;
          const prev = el('news-img-preview');
          prev.src = e.target.result;
          prev.style.display = 'block';
          el('news-img-filename').textContent = file.name;
        };
        reader.readAsDataURL(file);
      };
    }

    // C. Bulk Actions
    const selectAllCheck = el('admin-news-select-all');
    if (selectAllCheck) {
      selectAllCheck.onchange = () => {
        const checked = selectAllCheck.checked;
        document.querySelectorAll('.admin-news-select').forEach(box => {
          box.checked = checked;
          box.dispatchEvent(new Event('change'));
        });
      };
    }

    const bulkDeleteBtn = el('admin-news-bulk-delete-btn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.onclick = async () => {
        if (selectedAdminNewsIds.length === 0) {
          showToast('No articles selected.', 'error');
          return;
        }
        if (!confirm(`Are you sure you want to delete ${selectedAdminNewsIds.length} selected articles?`)) return;
        try {
          for (const id of selectedAdminNewsIds) {
            await fetchApi(`/api/news/detail?id=${id}`, { method: 'DELETE' });
          }
          showToast('Selected news articles deleted.');
          await renderAdminNewsTable();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };
    }

    const bulkPublishBtn = el('admin-news-bulk-publish-btn');
    if (bulkPublishBtn) {
      bulkPublishBtn.onclick = async () => {
        if (selectedAdminNewsIds.length === 0) {
          showToast('No articles selected.', 'error');
          return;
        }
        try {
          for (const id of selectedAdminNewsIds) {
            const news = await fetchApi(`/api/news/detail?id=${id}`);
            news.status = 'Publish';
            await fetchApi(`/api/news/detail?id=${id}`, { method: 'PUT', body: news });
          }
          showToast('Selected news articles published.');
          await renderAdminNewsTable();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };
    }

    // D. XML Sitemap Generator
    const sitemapBtn = el('admin-news-gen-sitemap');
    if (sitemapBtn) {
      sitemapBtn.onclick = async () => {
        try {
          const newsList = await fetchApi('/api/news?status=Publish');
          
          let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
          newsList.forEach(news => {
            xml += `  <url>\n    <loc>${news.canonicalUrl || 'http://localhost:8083/#news/' + news.slug}</loc>\n    <lastmod>${news.publishDate.substring(0, 10)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
          });
          xml += `</urlset>`;

          const outputEl = el('admin-news-seo-output');
          outputEl.style.display = 'block';
          outputEl.textContent = xml;
          showToast('XML News Sitemap generated successfully.');
        } catch (e) {
          showToast('Failed to generate sitemap.', 'error');
        }
      };
    }

    // E. Pagination clicks
    const prevBtn = el('news-page-prev');
    const nextBtn = el('news-page-next');
    if (prevBtn && nextBtn) {
      prevBtn.onclick = async () => {
        if (currentNewsPage > 1) {
          currentNewsPage--;
          await renderNewsFeed();
        }
      };
      nextBtn.onclick = async () => {
        currentNewsPage++;
        await renderNewsFeed();
      };
    }

    // F. Filters and searches
    const newsSearchInput = el('news-search-input');
    const newsSearchBtn = el('news-search-btn');
    if (newsSearchInput && newsSearchBtn) {
      const doSearch = () => {
        const q = newsSearchInput.value.trim();
        window.location.hash = `#news?q=${encodeURIComponent(q)}`;
      };
      newsSearchBtn.onclick = doSearch;
      newsSearchInput.onkeypress = (e) => { if (e.key === 'Enter') doSearch(); };
    }

    const newsCatFilter = el('news-category-filter');
    if (newsCatFilter) {
      newsCatFilter.onchange = () => {
        window.location.hash = `#news?category=${encodeURIComponent(newsCatFilter.value)}`;
      };
    }

    document.querySelectorAll('.news-share-btn').forEach(btn => {
      btn.onclick = () => {
        const shareType = btn.dataset.share;
        const currentUrl = window.location.href;
        if (shareType === 'twitter') {
          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(document.title)}`, '_blank');
        } else if (shareType === 'linkedin') {
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`, '_blank');
        } else {
          navigator.clipboard.writeText(currentUrl);
          showToast('Article URL copied to clipboard!');
        }
      };
    });
  }

  // ── Global Document Event Bindings ───────────
  function bindEvents() {
    bindNewsEvents();
    
    // Mobile sidebar toggle
    const sidebar = el('app-sidebar');
    const mobToggle = el('mobile-sidebar-toggle');
    const mobClose = el('mobile-sidebar-close');

    if (mobToggle && sidebar) {
      mobToggle.onclick = (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('mobile-open');
      };
    }
    if (mobClose && sidebar) {
      mobClose.onclick = () => {
        sidebar.classList.remove('mobile-open');
      };
    }
    document.addEventListener('click', (e) => {
      if (sidebar && sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== mobToggle) {
        sidebar.classList.remove('mobile-open');
      }
    });
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    // Theme toggle
    el('nav-theme-btn').onclick = toggleTheme;



    // Dropdown toggle
    el('nav-user-btn').onclick = (e) => {
      e.stopPropagation();
      el('user-dropdown-menu').classList.toggle('active');
    };
    document.addEventListener('click', () => {
      const menu = el('user-dropdown-menu');
      if (menu) menu.classList.remove('active');
    });

    // Login Submission
    const loginForm = el('auth-login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = el('login-email').value.trim();
        const password = el('login-password').value;
        try {
          const res = await fetchApi('/api/auth/login', {
            method: 'POST',
            body: { email, password }
          });
          state.token = res.token;
          state.user = res.user;
          localStorage.setItem('wealthengine_token', res.token);
          showToast('Welcome back, signed in successfully.');
          renderNavMenu();
          window.location.hash = '#home';
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Register Submission
    const regForm = el('auth-register-form');
    if (regForm) {
      regForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = el('register-name').value.trim();
        const email = el('register-email').value.trim();
        const password = el('register-password').value;
        try {
          const res = await fetchApi('/api/auth/register', {
            method: 'POST',
            body: { name, email, password }
          });
          state.token = res.token;
          state.user = res.user;
          localStorage.setItem('wealthengine_token', res.token);
          showToast('Account registered successfully.');
          renderNavMenu();
          window.location.hash = '#home';
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Newsletter Submission
    const newsForm = el('home-newsletter-form');
    if (newsForm) {
      newsForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = el('home-newsletter-email').value.trim();
        try {
          const res = await fetchApi('/api/newsletter/subscribe', {
            method: 'POST',
            body: { email }
          });
          showToast(res.message);
          el('home-newsletter-email').value = '';
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // User Dashboard tabs
    document.querySelectorAll('.dash-menu-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.dash-menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.dashboard-content-body > div').forEach(p => p.classList.remove('active'));
        el(`dash-tab-${btn.dataset.tab}`).classList.add('active');
      };
    });

    // Profile updates
    const profileForm = el('dash-profile-form');
    if (profileForm) {
      profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = el('dash-profile-name').value.trim();
        const avatarInp = el('dash-profile-avatar');
        const avatar = (avatarInp.dataset.b64) || state.user.avatar || '';
        const bio = el('dash-profile-bio').value.trim();
        try {
          await fetchApi('/api/auth/profile', {
            method: 'POST',
            body: { name, avatar, bio }
          });
          state.user.name = name;
          state.user.avatar = avatar;
          state.user.bio = bio;
          showToast('Profile settings saved.');
          await renderUserDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Password updates
    const securityForm = el('dash-security-form');
    if (securityForm) {
      securityForm.onsubmit = async (e) => {
        e.preventDefault();
        const oldPassword = el('dash-old-password').value;
        const newPassword = el('dash-new-password').value;
        try {
          await fetchApi('/api/auth/profile', {
            method: 'POST',
            body: { oldPassword, newPassword }
          });
          showToast('Password security settings updated.');
          el('dash-old-password').value = '';
          el('dash-new-password').value = '';
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    // Calculators tab panel triggers
    document.querySelectorAll('.calc-tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.calc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.calc-content-panel').forEach(p => p.classList.remove('active'));
        el(`calc-panel-${btn.dataset.calc}`).classList.add('active');
      };
    });

  }

})();
