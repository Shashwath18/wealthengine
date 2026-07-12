/* ==============================================
   WEALTHENGINE — Client Engine, Router & Tools
   main.js
   Triggering clean UTF-8 Vercel build
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
    } else if (path.startsWith('/api/comments')) {
      if (method === 'GET') {
        const postId = params.get('postId');
        targetUrl = postId
          ? `${SUPABASE_URL}/rest/v1/comments?postId=eq.${postId}&select=*&order=createdAt.asc`
          : `${SUPABASE_URL}/rest/v1/comments?select=*&order=createdAt.asc`;
      } else if (method === 'POST') {
        bodyObj.id = bodyObj.id || ('cmt-' + Math.random().toString(36).substring(2, 10));
        bodyObj.authorId = bodyObj.authorId || (state.user ? state.user.id : 'anonymous');
        bodyObj.authorName = bodyObj.authorName || (state.user ? (state.user.name || state.user.email) : 'Guest');
        bodyObj.createdAt = bodyObj.createdAt || new Date().toISOString();
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/comments`;
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
    } else if (path === '/api/glossary') {
      const q = params.get('q');
      if (method === 'GET') {
        if (q) {
          targetUrl = `${SUPABASE_URL}/rest/v1/glossary?select=*&or=(term.ilike.*${encodeURIComponent(q)}*,title.ilike.*${encodeURIComponent(q)}*,definition.ilike.*${encodeURIComponent(q)}*)`;
        } else {
          targetUrl = `${SUPABASE_URL}/rest/v1/glossary?select=*`;
        }
      } else if (method === 'POST') {
        bodyObj.term = bodyObj.term.toUpperCase();
        fetchOptions.body = JSON.stringify(bodyObj);
        targetUrl = `${SUPABASE_URL}/rest/v1/glossary`;
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

    function toSnakeCase(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      const result = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          let snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          result[snakeKey] = obj[key];
        }
      }
      return result;
    }

    function toCamelCase(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
      }
      const result = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          result[camelKey] = obj[key];
        }
      }
      return result;
    }

    if (!targetUrl) {
      throw new Error(`Endpoint ${endpoint} not supported on Supabase serverless mode.`);
    }

    if (fetchOptions.body) {
      try {
        const parsedBody = JSON.parse(fetchOptions.body);
        fetchOptions.body = JSON.stringify(toSnakeCase(parsedBody));
      } catch (e) {
        // ignore
      }
    }

    const res = await fetch(targetUrl, fetchOptions);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Supabase error ${res.status}`);
    }

    if (method === 'GET' && (path.startsWith('/api/posts/detail') || path.startsWith('/api/news/detail') || path === '/api/settings')) {
      const items = await res.json();
      const item = (items && items.length > 0) ? items[0] : (path === '/api/settings' ? {} : null);
      return toCamelCase(item);
    }

    const data = await res.json().catch(() => ({}));
    return toCamelCase(data);
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
      const href = a.getAttribute('href');
      if (href === '#calculators') {
        a.classList.toggle('active', hash === '#calculators' || hash === '#calculators/wedding');
      } else {
        a.classList.toggle('active', href === parts[0]);
      }
    });

    state.activeView = viewName;
    updatePageDisclaimer(viewName);
    trackPageView(viewName);
    
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
        await renderCalculators(parts[1]);
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

  // ── Contextual Page Disclaimer Bar ──────────
  function updatePageDisclaimer(viewName) {
    const bar = el('page-disclaimer-bar');
    if (!bar) return;
    const disclaimers = {
      home:         { icon: '⚠️', label: 'General Disclaimer', text: 'WealthEngine provides financial education only. Nothing on this site constitutes personalised financial advice. Consult a qualified adviser before making any financial decision.' },
      news:         { icon: '📰', label: 'News Disclaimer', text: 'News articles are sourced for informational purposes. Market conditions change rapidly — always verify with official sources before acting on any news item.' },
      articles:     { icon: '📝', label: 'Editorial Disclaimer', text: 'Articles represent the author\'s views and general information only. They do not constitute investment, tax, or legal advice. Individual circumstances vary.' },
      calculators:  { icon: '🧮', label: 'Calculator Disclaimer', text: 'All calculator results are estimates based on the inputs you provide and standard assumptions. Actual figures will differ — consult a professional for accurate projections.' },
      'credit-cards': { icon: '💳', label: 'Credit Card Disclaimer', text: 'Credit card comparisons are for general reference only. Approval, rates, and fees depend on your individual credit profile. Always read the lender\'s Key Facts Document.' },
      investing:    { icon: '💹', label: 'Investment Disclaimer', text: 'Past performance is not a reliable indicator of future results. All investments carry risk including the possible loss of principal. This is not personalised investment advice.' },
      about:        { icon: 'ℹ️', label: 'About Disclaimer', text: 'WealthEngine is an independent educational platform. We are not affiliated with any financial institution, bank, or regulatory body.' },
      glossary:     { icon: '📖', label: 'Glossary Disclaimer', text: 'Definitions are provided for general educational purposes. Financial terms may have varying meanings depending on jurisdiction or context.' },
      dashboard:    { icon: '👤', label: 'Account Disclaimer', text: 'Your account data is stored securely. WealthEngine does not sell personal information to third parties.' },
      admin:        { icon: '🔒', label: 'Admin Area', text: 'Restricted area. Actions taken here directly affect live site content and user data. Proceed with care.' },
    };
    const d = disclaimers[viewName] || disclaimers.home;
    bar.innerHTML = `<span class="disc-icon">${d.icon}</span><span><strong>${d.label}:</strong>${d.text}</span>`;
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

    let comments = [];
    try {
      comments = await fetchApi(`/api/comments?postId=${postId}`);
      if (!Array.isArray(comments)) comments = [];
    } catch (e) {
      console.warn('Comments unavailable:', e.message);
    }
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
  async function renderCalculators(tabName = null) {
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

    // Initialize Wedding Budget Calculator
    initWeddingBudget();

    if (tabName) {
      const tabBtn = document.querySelector(`.calc-tab-btn[data-calc="${tabName}"]`);
      if (tabBtn) {
        tabBtn.click();
      }
    }
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

  // ── Wedding Budget Calculator Module ─────────
  let weddingCharts = {};
  let weddingInitialized = false;

  const defaultAllocations = {
    'Venue': 20,
    'Catering': 25,
    'Decoration': 10,
    'Photography': 8,
    'Videography': 7,
    'Clothing': 10,
    'Jewelry': 5,
    'Makeup': 3,
    'Entertainment': 4,
    'Invitations': 2,
    'Transportation': 2,
    'Accommodation': 2,
    'Gifts': 1,
    'Miscellaneous': 1
  };

  const defaultChecklist = [
    { task: 'Book Wedding Venue', category: 'Venue', checked: false },
    { task: 'Select Catering Menu', category: 'Catering', checked: false },
    { task: 'Hire Photographer & Videographer', category: 'Photography', checked: false },
    { task: 'Finalize Decoration Theme', category: 'Decoration', checked: false },
    { task: 'Print & Send Invitations', category: 'Invitations', checked: false },
    { task: 'Buy Bridal Dress', category: 'Clothing', checked: false },
    { task: 'Buy Groom Suit', category: 'Clothing', checked: false },
    { task: 'Book Makeup Artist', category: 'Makeup', checked: false },
    { task: 'Organize Reception Details', category: 'Venue', checked: false },
    { task: 'Plan & Book Honeymoon', category: 'Miscellaneous', checked: false },
    { task: 'Arrange Transportation', category: 'Transportation', checked: false },
    { task: 'Book Accommodation for Guests', category: 'Accommodation', checked: false }
  ];

  function getWeddingData() {
    const data = localStorage.getItem('wealthengine_wedding_data');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.checklist || parsed.checklist.length === 0) {
          parsed.checklist = JSON.parse(JSON.stringify(defaultChecklist));
        }
        if (!parsed.allocations) {
          parsed.allocations = JSON.parse(JSON.stringify(defaultAllocations));
        }
        if (!parsed.expenses) parsed.expenses = [];
        if (!parsed.vendors) parsed.vendors = [];
        if (!parsed.settings) {
          parsed.settings = {
            brideName: 'Jane',
            groomName: 'John',
            weddingDate: '2026-12-31',
            location: 'Grand Palace Hall',
            guestCount: 150,
            totalBudget: 1000000,
            currency: '₹'
          };
        }
        return parsed;
      } catch (e) {
        // Fallback
      }
    }
    return {
      settings: {
        brideName: 'Jane',
        groomName: 'John',
        weddingDate: '2026-12-31',
        location: 'Grand Palace Hall',
        guestCount: 150,
        totalBudget: 1000000,
        currency: '₹'
      },
      allocations: JSON.parse(JSON.stringify(defaultAllocations)),
      expenses: [],
      vendors: [],
      checklist: JSON.parse(JSON.stringify(defaultChecklist))
    };
  }

  function saveWeddingData(data) {
    localStorage.setItem('wealthengine_wedding_data', JSON.stringify(data));
  }

  function initWeddingBudget() {
    if (weddingInitialized) {
      runWeddingBudgetCalculations();
      return;
    }
    weddingInitialized = true;

    // Sub-tab toggling
    document.querySelectorAll('.wedding-subtab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.wedding-subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.wedding-subpanel').forEach(p => p.classList.remove('active'));
        el(`wedding-panel-${btn.dataset.wtab}`).classList.add('active');
        
        if (btn.dataset.wtab === 'overview') {
          setTimeout(updateWeddingCharts, 50);
        }
      };
    });

    // Populate Category dropdowns
    const categories = Object.keys(defaultAllocations);
    const catSelects = ['w-expense-category', 'w-expense-filter-cat', 'w-vendor-category'];
    catSelects.forEach(id => {
      const select = el(id);
      if (select) {
        const firstOpt = select.options.length > 0 ? select.options[0].outerHTML : '';
        select.innerHTML = firstOpt + categories.map(c => `<option value="${c}">${c}</option>`).join('');
      }
    });

    // Load initial settings
    const data = getWeddingData();
    el('wedding-bride-name').value = data.settings.brideName || 'Jane';
    el('wedding-groom-name').value = data.settings.groomName || 'John';
    el('wedding-date').value = data.settings.weddingDate || '2026-12-31';
    el('wedding-location').value = data.settings.location || 'Grand Palace Hall';
    el('wedding-guest-count').value = data.settings.guestCount || 150;
    el('wedding-total-budget').value = data.settings.totalBudget || 1000000;
    el('wedding-currency').value = data.settings.currency || '₹';

    // Save Wedding Settings button handler
    el('btn-save-wedding-details').onclick = () => {
      const updatedData = getWeddingData();
      updatedData.settings.brideName = el('wedding-bride-name').value.trim();
      updatedData.settings.groomName = el('wedding-groom-name').value.trim();
      updatedData.settings.weddingDate = el('wedding-date').value;
      updatedData.settings.location = el('wedding-location').value.trim();
      updatedData.settings.guestCount = parseInt(el('wedding-guest-count').value) || 0;
      updatedData.settings.totalBudget = parseFloat(el('wedding-total-budget').value) || 0;
      updatedData.settings.currency = el('wedding-currency').value;
      
      saveWeddingData(updatedData);
      showToast('Wedding settings updated successfully!');
      runWeddingBudgetCalculations();
    };

    // Reset allocations
    el('btn-reset-allocations').onclick = () => {
      const updatedData = getWeddingData();
      updatedData.allocations = JSON.parse(JSON.stringify(defaultAllocations));
      saveWeddingData(updatedData);
      showToast('Allocations reset to default percentages!');
      runWeddingBudgetCalculations();
    };

    // Vendor Star Rating Selector
    document.querySelectorAll('#w-vendor-rating-stars .star-btn').forEach(star => {
      star.onclick = () => {
        const rating = parseInt(star.dataset.val);
        el('w-vendor-rating').value = rating;
        document.querySelectorAll('#w-vendor-rating-stars .star-btn').forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.val) <= rating);
        });
      };
    });

    // Forms actions
    el('btn-save-w-expense').onclick = saveWeddingExpense;
    el('btn-cancel-w-expense').onclick = resetExpenseForm;
    el('btn-save-w-vendor').onclick = saveWeddingVendor;
    el('btn-cancel-w-vendor').onclick = resetVendorForm;

    // Filters
    el('w-expense-search').oninput = renderExpensesTable;
    el('w-expense-filter-cat').onchange = renderExpensesTable;
    el('w-expense-filter-status').onchange = renderExpensesTable;
    el('w-expense-sort').onchange = renderExpensesTable;

    // Reports
    el('btn-w-pdf').onclick = exportWeddingPDF;
    el('btn-w-excel').onclick = exportWeddingExcel;
    el('btn-w-csv').onclick = exportWeddingCSV;
    el('btn-w-save-json').onclick = backupWeddingJSON;
    el('btn-w-load-json').onchange = loadWeddingJSON;

    runWeddingBudgetCalculations();
  }

  function runWeddingBudgetCalculations() {
    const data = getWeddingData();
    const cur = data.settings.currency;
    const budget = data.settings.totalBudget;

    const totalSpent = data.expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const remaining = budget - totalSpent;
    const usedPct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
    const guests = data.settings.guestCount || 0;
    const costPerGuest = guests > 0 ? totalSpent / guests : 0;
    const pendingPayments = data.expenses.filter(e => e.status === 'Pending').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    const weddingDate = new Date(data.settings.weddingDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = weddingDate - today;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    el('w-stat-budget').textContent = cur + budget.toLocaleString();
    el('w-stat-spent').textContent = cur + totalSpent.toLocaleString();
    el('w-stat-remaining').textContent = cur + remaining.toLocaleString();
    el('w-stat-remaining').style.color = remaining >= 0 ? '#10B981' : '#EF4444';
    el('w-stat-used-pct').textContent = usedPct + '%';
    el('w-stat-guests').textContent = guests.toString();
    el('w-stat-cost-per-guest').textContent = cur + Math.round(costPerGuest).toLocaleString();
    el('w-stat-pending').textContent = cur + pendingPayments.toLocaleString();
    el('w-stat-days').textContent = daysRemaining.toString();

    let totalPct = 0;
    const categories = Object.keys(defaultAllocations);
    categories.forEach(cat => {
      totalPct += parseFloat(data.allocations[cat]) || 0;
    });

    const sumElement = el('allocation-current-sum');
    const warningBanner = el('allocation-warning-banner');
    const totalPctEl = el('allocation-total-pct');
    if (sumElement && warningBanner && totalPctEl) {
      sumElement.textContent = totalPct + '%';
      totalPctEl.textContent = totalPct + '%';
      if (totalPct !== 100) {
        warningBanner.style.display = 'block';
        totalPctEl.style.color = '#EF4444';
      } else {
        warningBanner.style.display = 'none';
        totalPctEl.style.color = '#0078D4';
      }
    }

    updateSpendingRecommendations(budget, totalSpent, remaining, costPerGuest, daysRemaining, data.expenses);
    renderAllocationTable(data, cur, budget);
    renderExpensesTable();
    renderVendorsTable();
    renderChecklistTable();
    updateWeddingCharts();
  }

  function updateSpendingRecommendations(budget, spent, remaining, costPerGuest, daysRemaining, expenses) {
    const listEl = el('wedding-recommendations-list');
    if (!listEl) return;

    let tips = [];

    if (remaining < 0) {
      tips.push(`<li style="color:#EF4444; font-weight:700;">🚨 BUDGET OVERSPENT! You have exceeded your total wedding budget by ${Math.abs(remaining).toLocaleString()}. Review your category allocations and reduce guest counts or select lower-priced vendors.</li>`);
    } else if (remaining < budget * 0.1) {
      tips.push(`<li style="color:#D97706; font-weight:600;">⚠️ Tight Budget: Less than 10% of your total budget remains. Limit any additional impulse purchases.</li>`);
    } else {
      tips.push(`<li>✨ Healthy Budget: You have ${remaining.toLocaleString()} remaining. You are currently on track!</li>`);
    }

    if (costPerGuest > 5000) {
      tips.push(`<li>👥 High Cost Per Guest: Your average spent per guest is high (${Math.round(costPerGuest).toLocaleString()}). Consider optimizing your catering options or simplifying dinner layouts to cut costs.</li>`);
    }

    if (daysRemaining === 0) {
      tips.push(`<li>🎉 Congratulations! Today is the wedding day!</li>`);
    } else if (daysRemaining < 30) {
      tips.push(`<li style="color:#D97706;">⌛ 1-Month Milestone: Only ${daysRemaining} days remaining! Make sure all final vendor payments are completed and details confirmed.</li>`);
    } else if (daysRemaining < 90) {
      tips.push(`<li>📅 3-Month Milestone: ${daysRemaining} days remaining. Send out all invitations and confirm outfit trials.</li>`);
    } else {
      tips.push(`<li>📆 Timeline: You have ${daysRemaining} days until the big day. Focus on booking venue and catering first.</li>`);
    }

    const data = getWeddingData();
    const categories = Object.keys(defaultAllocations);
    categories.forEach(cat => {
      const catBudget = budget * (parseFloat(data.allocations[cat]) || 0) / 100;
      const catSpent = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      if (catSpent > catBudget) {
        tips.push(`<li style="color:#EF4444;">⚠️ Overspending in <strong>${cat}</strong>: Spent ${catSpent.toLocaleString()} against budget of ${catBudget.toLocaleString()}. Try finding discounts or reducing specifications in this category.</li>`);
      }
    });

    listEl.innerHTML = `<ul style="margin:0; padding-left:1.2rem; display:flex; flex-direction:column; gap:0.35rem;">${tips.join('')}</ul>`;
  }

  function renderAllocationTable(data, cur, budget) {
    const tbody = el('wedding-allocation-tbody');
    if (!tbody) return;

    const categories = Object.keys(defaultAllocations);
    tbody.innerHTML = categories.map(cat => {
      const pct = parseFloat(data.allocations[cat]) || 0;
      const catBudget = budget * pct / 100;
      
      const actual = data.expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const remaining = catBudget - actual;
      const spendPct = catBudget > 0 ? Math.min(100, Math.round((actual / catBudget) * 100)) : 0;
      const barColor = actual > catBudget ? '#EF4444' : '#10B981';

      return `
        <tr>
          <td><strong>${cat}</strong></td>
          <td>
            <input type="number" class="w-alloc-pct-input" data-cat="${cat}" value="${pct}" min="0" max="100" style="width:70px; padding:0.25rem 0.5rem; background:var(--color-bg); border:1px solid var(--color-border); border-radius:6px; color:var(--color-text);">
          </td>
          <td>${cur}${Math.round(catBudget).toLocaleString()}</td>
          <td>${cur}${actual.toLocaleString()}</td>
          <td style="color:${remaining >= 0 ? '#10B981' : '#EF4444'}; font-weight:600;">
            ${remaining >= 0 ? cur + Math.round(remaining).toLocaleString() : '-' + cur + Math.round(Math.abs(remaining)).toLocaleString()}
          </td>
          <td>
            <div style="font-size:0.75rem; text-align:right; font-weight:700; color:${barColor};">${spendPct}%</div>
            <div class="alloc-progress-container">
              <div class="alloc-progress-bar" style="width:${spendPct}%; background:${barColor};"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.w-alloc-pct-input').forEach(input => {
      const updateAlloc = () => {
        const cat = input.dataset.cat;
        const val = parseFloat(input.value) || 0;
        const updatedData = getWeddingData();
        updatedData.allocations[cat] = val;
        saveWeddingData(updatedData);
        
        let sumPct = 0;
        Object.keys(defaultAllocations).forEach(c => {
          sumPct += parseFloat(updatedData.allocations[c]) || 0;
        });
        
        const sumElement = el('allocation-current-sum');
        const warningBanner = el('allocation-warning-banner');
        const totalPctEl = el('allocation-total-pct');
        if (sumElement && warningBanner && totalPctEl) {
          sumElement.textContent = sumPct + '%';
          totalPctEl.textContent = sumPct + '%';
          if (sumPct !== 100) {
            warningBanner.style.display = 'block';
            totalPctEl.style.color = '#EF4444';
          } else {
            warningBanner.style.display = 'none';
            totalPctEl.style.color = '#0078D4';
          }
        }
      };
      
      input.onchange = () => {
        updateAlloc();
        runWeddingBudgetCalculations();
      };
      input.onkeyup = updateAlloc;
    });
  }

  function saveWeddingExpense() {
    const id = el('w-expense-id').value;
    const name = el('w-expense-name').value.trim();
    const category = el('w-expense-category').value;
    const vendorId = el('w-expense-vendor').value;
    const amount = parseFloat(el('w-expense-amount').value) || 0;
    const date = el('w-expense-date').value;
    const status = el('w-expense-status').value;
    const notes = el('w-expense-notes').value.trim();

    if (!name || !date || amount <= 0) {
      showToast('Please fill in Name, Date, and Amount.', 'error');
      return;
    }

    const data = getWeddingData();
    let vendorName = '';
    if (vendorId) {
      const v = data.vendors.find(vd => vd.id === vendorId);
      if (v) vendorName = v.name;
    }

    if (id) {
      const expIdx = data.expenses.findIndex(e => e.id === id);
      if (expIdx !== -1) {
        data.expenses[expIdx] = { id, name, category, vendorId, vendorName, amount, date, status, notes };
        showToast('Expense updated.');
      }
    } else {
      const newExp = {
        id: 'exp-' + Math.random().toString(36).substring(2, 10),
        name, category, vendorId, vendorName, amount, date, status, notes
      };
      data.expenses.push(newExp);
      showToast('Expense added.');
    }

    saveWeddingData(data);
    resetExpenseForm();
    runWeddingBudgetCalculations();
  }

  function resetExpenseForm() {
    el('w-expense-id').value = '';
    el('w-expense-name').value = '';
    el('w-expense-amount').value = '';
    el('w-expense-date').value = '';
    el('w-expense-status').value = 'Paid';
    el('w-expense-notes').value = '';
    el('w-expense-vendor').value = '';
    el('expense-form-title').textContent = 'Add New Expense';
    el('btn-cancel-w-expense').style.display = 'none';
  }

  function editWeddingExpense(id) {
    const data = getWeddingData();
    const exp = data.expenses.find(e => e.id === id);
    if (!exp) return;

    el('w-expense-id').value = exp.id;
    el('w-expense-name').value = exp.name;
    el('w-expense-category').value = exp.category;
    el('w-expense-vendor').value = exp.vendorId || '';
    el('w-expense-amount').value = exp.amount;
    el('w-expense-date').value = exp.date;
    el('w-expense-status').value = exp.status;
    el('w-expense-notes').value = exp.notes || '';

    el('expense-form-title').textContent = 'Edit Expense';
    el('btn-cancel-w-expense').style.display = 'block';
    
    el('expense-form-title').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteWeddingExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    const data = getWeddingData();
    data.expenses = data.expenses.filter(e => e.id !== id);
    saveWeddingData(data);
    showToast('Expense deleted.');
    runWeddingBudgetCalculations();
  }

  function renderExpensesTable() {
    const tbody = el('wedding-expenses-tbody');
    if (!tbody) return;

    const data = getWeddingData();
    const cur = data.settings.currency;

    const expVendorSelect = el('w-expense-vendor');
    if (expVendorSelect) {
      const selectedVal = expVendorSelect.value;
      expVendorSelect.innerHTML = '<option value="">No Vendor</option>' + data.vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
      expVendorSelect.value = selectedVal;
    }

    const search = el('w-expense-search').value.toLowerCase();
    const filterCat = el('w-expense-filter-cat').value;
    const filterStatus = el('w-expense-filter-status').value;
    const sortBy = el('w-expense-sort').value;

    let filtered = [...data.expenses];

    if (search) {
      filtered = filtered.filter(e => e.name.toLowerCase().includes(search) || (e.vendorName && e.vendorName.toLowerCase().includes(search)));
    }
    if (filterCat) {
      filtered = filtered.filter(e => e.category === filterCat);
    }
    if (filterStatus) {
      filtered = filtered.filter(e => e.status === filterStatus);
    }
    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; opacity:0.5;">No expenses found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(exp => `
      <tr>
        <td><strong>${exp.name}</strong></td>
        <td><span class="checklist-badge completed" style="background:rgba(0,120,212,0.06); color:var(--color-accent);">${exp.category}</span></td>
        <td>${exp.vendorName ? exp.vendorName : '<span style="opacity:0.4;">—</span>'}</td>
        <td>${cur}${exp.amount.toLocaleString()}</td>
        <td style="font-size:0.8rem;">${exp.date}</td>
        <td>
          <span class="checklist-badge ${exp.status === 'Paid' ? 'completed' : 'pending'}">${exp.status}</span>
        </td>
        <td>
          <div style="display:flex; gap:0.35rem;">
            <button class="btn outline" onclick="editWeddingExpense('${exp.id}')" style="padding:0.25rem 0.5rem; font-size:0.75rem;">Edit</button>
            <button class="btn outline" onclick="deleteWeddingExpense('${exp.id}')" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-color:#EF4444; color:#EF4444;">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function saveWeddingVendor() {
    const id = el('w-vendor-id').value;
    const name = el('w-vendor-name').value.trim();
    const category = el('w-vendor-category').value;
    const phone = el('w-vendor-phone').value.trim();
    const email = el('w-vendor-email').value.trim();
    const website = el('w-vendor-website').value.trim();
    const quote = parseFloat(el('w-vendor-quote').value) || 0;
    const final = parseFloat(el('w-vendor-final').value) || 0;
    const advance = parseFloat(el('w-vendor-advance').value) || 0;
    const status = el('w-vendor-status').value;
    const rating = parseInt(el('w-vendor-rating').value) || 5;

    if (!name) {
      showToast('Please specify Vendor Name.', 'error');
      return;
    }

    const data = getWeddingData();
    const balance = final - advance;

    if (id) {
      const vIdx = data.vendors.findIndex(v => v.id === id);
      if (vIdx !== -1) {
        data.vendors[vIdx] = { id, name, category, phone, email, website, quote, final, advance, balance, status, rating };
        showToast('Vendor updated.');
      }
    } else {
      const newVendor = {
        id: 'vendor-' + Math.random().toString(36).substring(2, 10),
        name, category, phone, email, website, quote, final, advance, balance, status, rating
      };
      data.vendors.push(newVendor);
      showToast('Vendor added.');
    }

    saveWeddingData(data);
    resetVendorForm();
    runWeddingBudgetCalculations();
  }

  function resetVendorForm() {
    el('w-vendor-id').value = '';
    el('w-vendor-name').value = '';
    el('w-vendor-phone').value = '';
    el('w-vendor-email').value = '';
    el('w-vendor-website').value = '';
    el('w-vendor-quote').value = '';
    el('w-vendor-final').value = '';
    el('w-vendor-advance').value = '';
    el('w-vendor-status').value = 'Contacted';
    el('w-vendor-rating').value = '5';
    el('vendor-form-title').textContent = 'Add New Vendor';
    el('btn-cancel-w-vendor').style.display = 'none';

    document.querySelectorAll('#w-vendor-rating-stars .star-btn').forEach(s => s.classList.add('active'));
  }

  function editWeddingVendor(id) {
    const data = getWeddingData();
    const v = data.vendors.find(vd => vd.id === id);
    if (!v) return;

    el('w-vendor-id').value = v.id;
    el('w-vendor-name').value = v.name;
    el('w-vendor-category').value = v.category;
    el('w-vendor-phone').value = v.phone || '';
    el('w-vendor-email').value = v.email || '';
    el('w-vendor-website').value = v.website || '';
    el('w-vendor-quote').value = v.quote || '';
    el('w-vendor-final').value = v.final || '';
    el('w-vendor-advance').value = v.advance || '';
    el('w-vendor-status').value = v.status;
    el('w-vendor-rating').value = v.rating;

    document.querySelectorAll('#w-vendor-rating-stars .star-btn').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= v.rating);
    });

    el('vendor-form-title').textContent = 'Edit Vendor';
    el('btn-cancel-w-vendor').style.display = 'block';
    
    el('vendor-form-title').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteWeddingVendor(id) {
    if (!confirm('Are you sure you want to delete this vendor? This will also unbind it from expenses.')) return;
    const data = getWeddingData();
    data.vendors = data.vendors.filter(v => v.id !== id);
    data.expenses.forEach(e => {
      if (e.vendorId === id) {
        e.vendorId = '';
        e.vendorName = '';
      }
    });
    saveWeddingData(data);
    showToast('Vendor deleted.');
    runWeddingBudgetCalculations();
  }

  function renderVendorsTable() {
    const tbody = el('wedding-vendors-tbody');
    if (!tbody) return;

    const data = getWeddingData();
    const cur = data.settings.currency;

    if (data.vendors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; opacity:0.5;">No vendors added yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.vendors.map(v => {
      const contactInfo = `
        <div style="font-size:0.75rem;">
          ${v.phone ? `<div>📞 ${v.phone}</div>` : ''}
          ${v.email ? `<div>✉️ ${v.email}</div>` : ''}
          ${v.website ? `<div>🌐 <a href="${v.website}" target="_blank" style="color:var(--color-accent);">website</a></div>` : ''}
          ${(!v.phone && !v.email && !v.website) ? '<span style="opacity:0.4;">No contact info</span>' : ''}
        </div>
      `;

      const starsStr = '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating);

      return `
        <tr>
          <td><strong>${v.name}</strong></td>
          <td><span class="checklist-badge completed" style="background:rgba(0,120,212,0.06); color:var(--color-accent);">${v.category}</span></td>
          <td>${contactInfo}</td>
          <td>
            <div style="font-size:0.75rem; opacity:0.6; text-decoration:line-through;">Quote: ${cur}${v.quote.toLocaleString()}</div>
            <div style="font-weight:700;">Final: ${cur}${v.final.toLocaleString()}</div>
          </td>
          <td>
            <div>Paid: ${cur}${v.advance.toLocaleString()}</div>
            <div style="font-weight:700; color: ${v.balance > 0 ? '#D97706' : '#10B981'};">Bal: ${cur}${v.balance.toLocaleString()}</div>
          </td>
          <td>
            <span class="checklist-badge ${v.status === 'Completed' ? 'completed' : (v.status === 'Booked' ? 'completed' : 'pending')}" style="${v.status === 'Booked' ? 'background:rgba(59,130,246,0.1); color:#3B82F6;' : ''}">
              ${v.status}
            </span>
          </td>
          <td><span class="rating-stars-read" title="${v.rating}/5 stars">${starsStr}</span></td>
          <td>
            <div style="display:flex; gap:0.35rem;">
              <button class="btn outline" onclick="editWeddingVendor('${v.id}')" style="padding:0.25rem 0.5rem; font-size:0.75rem;">Edit</button>
              <button class="btn outline" onclick="deleteWeddingVendor('${v.id}')" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-color:#EF4444; color:#EF4444;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderChecklistTable() {
    const container = el('wedding-checklist-container');
    if (!container) return;

    const data = getWeddingData();

    const total = data.checklist.length;
    const checked = data.checklist.filter(c => c.checked).length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    el('checklist-progress-text').textContent = pct + '%';
    el('checklist-progress-bar').style.width = pct + '%';

    container.innerHTML = data.checklist.map((item, idx) => `
      <div class="checklist-card ${item.checked ? 'checked' : ''}">
        <div class="checklist-card-left">
          <input type="checkbox" class="w-checklist-cb" data-idx="${idx}" ${item.checked ? 'checked' : ''}>
          <span class="checklist-label">${item.task}</span>
        </div>
        <span class="checklist-badge ${item.checked ? 'completed' : 'pending'}">${item.checked ? 'completed' : 'pending'}</span>
      </div>
    `).join('');

    document.querySelectorAll('.w-checklist-cb').forEach(cb => {
      cb.onchange = () => {
        const idx = parseInt(cb.dataset.idx);
        const updatedData = getWeddingData();
        updatedData.checklist[idx].checked = cb.checked;
        saveWeddingData(updatedData);
        
        const totalItems = updatedData.checklist.length;
        const checkedItems = updatedData.checklist.filter(c => c.checked).length;
        const currentPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
        
        el('checklist-progress-text').textContent = currentPct + '%';
        el('checklist-progress-bar').style.width = currentPct + '%';
        
        cb.closest('.checklist-card').classList.toggle('checked', cb.checked);
        const badge = cb.closest('.checklist-card').querySelector('.checklist-badge');
        if (badge) {
          badge.className = `checklist-badge ${cb.checked ? 'completed' : 'pending'}`;
          badge.textContent = cb.checked ? 'completed' : 'pending';
        }
      };
    });
  }

  function updateWeddingCharts() {
    const data = getWeddingData();
    const categories = Object.keys(defaultAllocations);
    const budget = data.settings.totalBudget;

    const allocationData = categories.map(cat => budget * (parseFloat(data.allocations[cat]) || 0) / 100);
    const spentData = categories.map(cat => data.expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0));
    
    const totalSpent = spentData.reduce((sum, v) => sum + v, 0);
    const remaining = Math.max(0, budget - totalSpent);

    const monthlyGroups = {};
    data.expenses.forEach(e => {
      if (!e.date) return;
      const dateObj = new Date(e.date);
      const label = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyGroups[label] = (monthlyGroups[label] || 0) + e.amount;
    });
    const monthlyLabels = Object.keys(monthlyGroups).sort((a,b) => new Date(a) - new Date(b));
    const monthlyData = monthlyLabels.map(l => monthlyGroups[l]);

    const paidSum = data.expenses.filter(e => e.status === 'Paid').reduce((sum, e) => sum + e.amount, 0);
    const pendingSum = data.expenses.filter(e => e.status === 'Pending').reduce((sum, e) => sum + e.amount, 0);

    const renderChart = (chartId, config) => {
      if (weddingCharts[chartId]) {
        weddingCharts[chartId].destroy();
      }
      const ctx = document.getElementById(chartId);
      if (ctx) {
        weddingCharts[chartId] = new Chart(ctx, config);
      }
    };

    renderChart('chart-w-allocation', {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: allocationData,
          backgroundColor: [
            '#0078D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#3B82F6', '#059669', '#D97706', '#DC2626',
            '#7C3AED', '#DB2777', '#1D4ED8', '#047857'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    renderChart('chart-w-spent-bar', {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Budget',
            data: allocationData,
            backgroundColor: 'rgba(0, 120, 212, 0.4)',
            borderColor: '#0078D4',
            borderWidth: 1
          },
          {
            label: 'Spent',
            data: spentData,
            backgroundColor: '#10B981',
            borderColor: '#10B981',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    renderChart('chart-w-remaining-doughnut', {
      type: 'doughnut',
      data: {
        labels: ['Spent', 'Remaining'],
        datasets: [{
          data: [totalSpent, remaining],
          backgroundColor: ['#EF4444', '#10B981']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
      }
    });

    renderChart('chart-w-monthly-line', {
      type: 'line',
      data: {
        labels: monthlyLabels.length > 0 ? monthlyLabels : ['No Data'],
        datasets: [{
          label: 'Spent per Month',
          data: monthlyData.length > 0 ? monthlyData : [0],
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: '#10B981',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    renderChart('chart-w-payments-pie', {
      type: 'pie',
      data: {
        labels: ['Paid', 'Pending'],
        datasets: [{
          data: [paidSum, pendingSum],
          backgroundColor: ['#10B981', '#F59E0B']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
      }
    });
  }

  function exportWeddingPDF() {
    window.print();
  }

  function exportWeddingExcel() {
    const data = getWeddingData();
    const cur = data.settings.currency;
    let csv = '\uFEFF';
    
    csv += `"Wedding Budget Allocation Ledger"\n`;
    csv += `"Bride Name","${data.settings.brideName}","Groom Name","${data.settings.groomName}"\n`;
    csv += `"Wedding Date","${data.settings.weddingDate}","Location","${data.settings.location}"\n\n`;
    
    csv += `"Category","Percentage (%)","Budget Amount (${cur})","Actual Spent (${cur})","Remaining Balance (${cur})"\n`;
    const budget = data.settings.totalBudget;
    Object.keys(defaultAllocations).forEach(cat => {
      const pct = data.allocations[cat];
      const catBudget = budget * pct / 100;
      const actual = data.expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      const remaining = catBudget - actual;
      csv += `"${cat}","${pct}%","${Math.round(catBudget)}","${actual}","${Math.round(remaining)}"\n`;
    });
    
    csv += `\n\n"Expenses Details"\n`;
    csv += `"Expense Name","Category","Vendor","Amount (${cur})","Date","Payment Status","Notes"\n`;
    data.expenses.forEach(e => {
      csv += `"${e.name}","${e.category}","${e.vendorName || ''}","${e.amount}","${e.date}","${e.status}","${e.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `wedding_budget_ledger_${data.settings.brideName}_${data.settings.groomName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel ledger exported successfully.');
  }

  function exportWeddingCSV() {
    const data = getWeddingData();
    let csv = '"Expense ID","Expense Name","Category","Vendor","Amount","Date","Status","Notes"\n';
    data.expenses.forEach(e => {
      csv += `"${e.id}","${e.name}","${e.category}","${e.vendorName || ''}","${e.amount}","${e.date}","${e.status}","${e.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `wedding_expenses_${data.settings.brideName}_${data.settings.groomName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV expenses exported successfully.');
  }

  function backupWeddingJSON() {
    const data = getWeddingData();
    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `wedding_planner_backup_${data.settings.brideName}_${data.settings.groomName}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('JSON backup file generated successfully.');
  }

  function loadWeddingJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.settings && parsed.allocations) {
          saveWeddingData(parsed);
          showToast('Wedding budget details restored from JSON backup!');
          
          el('wedding-bride-name').value = parsed.settings.brideName || 'Jane';
          el('wedding-groom-name').value = parsed.settings.groomName || 'John';
          el('wedding-date').value = parsed.settings.weddingDate || '2026-12-31';
          el('wedding-location').value = parsed.settings.location || 'Grand Palace Hall';
          el('wedding-guest-count').value = parsed.settings.guestCount || 150;
          el('wedding-total-budget').value = parsed.settings.totalBudget || 1000000;
          el('wedding-currency').value = parsed.settings.currency || '₹';
          
          runWeddingBudgetCalculations();
        } else {
          showToast('Invalid backup file format.', 'error');
        }
      } catch (err) {
        showToast('Failed to parse backup JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  window.editWeddingExpense = editWeddingExpense;
  window.deleteWeddingExpense = deleteWeddingExpense;
  window.editWeddingVendor = editWeddingVendor;
  window.deleteWeddingVendor = deleteWeddingVendor;

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

    // Sub-SPA Tab switching handler for page sub-tabs
    const bindSubnavTabs = () => {
      document.querySelectorAll('.dash-tab-btn').forEach(btn => {
        btn.onclick = async () => {
          document.querySelectorAll('.dash-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.classList.add('outline');
          });
          btn.classList.add('active');
          btn.classList.remove('outline');

          document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.remove('active'));
          
          const activeTab = btn.dataset.tab;
          const panel = el(`admin-panel-${activeTab}`);
          if (panel) panel.classList.add('active');

          // Load active tab data
          if (activeTab === 'dashboard') await renderAdminDashboard();
          else if (activeTab === 'news') await renderAdminNews();
          else if (activeTab === 'posts') await renderAdminPostsTable();
          else if (activeTab === 'cards') await renderAdminCardsTable();
        };
      });
    };

    // Sidebar menu click (always has dashboard as active, resets page to overview stats tab)
    document.querySelectorAll('.admin-menu-btn').forEach(btn => {
      btn.onclick = async () => {
        document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Reset subnav buttons to dashboard tab active
        document.querySelectorAll('.dash-tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'dashboard');
          b.classList.toggle('outline', b.dataset.tab !== 'dashboard');
        });
        
        document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.remove('active'));
        el('admin-panel-dashboard').classList.add('active');
        await renderAdminDashboard();
      };
    });

    // Default to Dashboard tab on initial load
    document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'dashboard'));
    document.querySelectorAll('.dash-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === 'dashboard');
      b.classList.toggle('outline', b.dataset.tab !== 'dashboard');
    });
    document.querySelectorAll('.admin-content-body > .admin-subpanel').forEach(p => p.classList.toggle('active', p.id === 'admin-panel-dashboard'));
    
    bindSubnavTabs();
    await renderAdminDashboard();
    await bindAdminEventHandlers();
    wireImagePickers();
  }

  // ── Page View Tracker (bot-filtered, real users only) ──────────────
  const BOT_PATTERNS = /bot|crawler|spider|slurp|bingpreview|google|facebook|twitter|lighthouse|pingdom|semrush|ahrefs|moz|wget|curl|python|java|go-http|okhttp|libwww/i;

  function getOrCreateSessionId() {
    let sid = sessionStorage.getItem('we_sid');
    if (!sid) {
      sid = 'sess-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now();
      sessionStorage.setItem('we_sid', sid);
    }
    return sid;
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/mobile|android|iphone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  async function trackPageView(page) {
    if (BOT_PATTERNS.test(navigator.userAgent)) return;
    if (!USE_SUPABASE) return;

    const payload = {
      page: page || 'home',
      session_id: getOrCreateSessionId(),
      user_id: state.user ? state.user.id : null,
      device_type: getDeviceType(),
      referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      // Also upsert session for active-user tracking
      await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          session_id: payload.session_id,
          user_id: payload.user_id,
          last_seen: payload.created_at,
          device_type: payload.device_type,
          page: payload.page
        })
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ── Premium Analytics Dashboard ──────────────────────────────────────
  async function renderAdminDashboard() {
    try {
      const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      };

      const days = parseInt(el('dash-period')?.value || '30');
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const activeThreshold = new Date(Date.now() - 15 * 60000).toISOString();

      // Parallel fetches
      const [pvRes, usersRes, activeRes, loggedInRes, newUsersRes, postsRes, subsRes, topPagesRes, dailyRes, userGrowthRes, recentPvRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/page_views?created_at=gte.${since}&select=id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/users?select=id,created_at`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/user_sessions?last_seen=gte.${activeThreshold}&select=session_id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/user_sessions?last_seen=gte.${activeThreshold}&user_id=not.is.null&select=session_id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/users?created_at=gte.${todayStart.toISOString()}&select=id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/posts?status=eq.Published&select=id,title,views`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=email`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/page_views?created_at=gte.${since}&select=page`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/page_views?created_at=gte.${since}&select=created_at`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/users?created_at=gte.${since}&select=created_at&order=created_at.asc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/page_views?select=page,created_at,device_type,referrer&order=created_at.desc&limit=30`, { headers })
      ]);

      const pvData       = await pvRes.json().catch(() => []);
      const usersData    = await usersRes.json().catch(() => []);
      const activeData   = await activeRes.json().catch(() => []);
      const loggedInData = await loggedInRes.json().catch(() => []);
      const newUsersData = await newUsersRes.json().catch(() => []);
      const postsData    = await postsRes.json().catch(() => []);
      const subsData     = await subsRes.json().catch(() => []);
      const topPagesData = await topPagesRes.json().catch(() => []);
      const dailyData    = await dailyRes.json().catch(() => []);
      const growthData   = await userGrowthRes.json().catch(() => []);
      const recentPv     = await recentPvRes.json().catch(() => []);

      const fmtNum = n => n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);

      // ── KPI Values ──
      const totalViews = Array.isArray(pvData) ? pvData.length : 0;
      const totalUsers = Array.isArray(usersData) ? usersData.length : 0;
      const activeNow  = Array.isArray(activeData) ? activeData.length : 0;
      const loggedInNow = Array.isArray(loggedInData) ? loggedInData.length : 0;
      const newToday   = Array.isArray(newUsersData) ? newUsersData.length : 0;
      const publishedPosts = Array.isArray(postsData) ? postsData.length : 0;
      const totalSubs  = Array.isArray(subsData) ? subsData.length : 0;

      const setEl = (id, val) => { const e = el(id); if (e) e.textContent = val; };
      setEl('kpi-total-views', fmtNum(totalViews));
      setEl('kpi-users', fmtNum(totalUsers));
      setEl('kpi-active', activeNow);
      setEl('kpi-loggedin', loggedInNow);
      setEl('kpi-new-today', newToday);
      setEl('kpi-posts', publishedPosts);
      setEl('kpi-subs', fmtNum(totalSubs));
      setEl('dash-last-updated', `Last updated: ${new Date().toLocaleTimeString()} · ${days}-day window`);

      // ── Daily/Monthly Views Chart ──
      const dayBuckets = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dayBuckets[d.toISOString().slice(0,10)] = 0;
      }
      (Array.isArray(dailyData) ? dailyData : []).forEach(row => {
        const day = row.created_at?.slice(0,10);
        if (day && dayBuckets.hasOwnProperty(day)) dayBuckets[day]++;
      });
      const dayLabels = Object.keys(dayBuckets).map(d => d.slice(5));
      const dayValues = Object.values(dayBuckets);
      const totalInPeriod = dayValues.reduce((a,b)=>a+b,0);
      setEl('views-chart-badge', `${fmtNum(totalInPeriod)} total`);
      renderLineChart('chart-daily-views', dayLabels, dayValues, '#6366f1', 'Views');

      // ── Top Pages ──
      const pageCounts = {};
      (Array.isArray(topPagesData) ? topPagesData : []).forEach(r => {
        const p = r.page || 'home';
        pageCounts[p] = (pageCounts[p] || 0) + 1;
      });
      const sortedPages = Object.entries(pageCounts).sort((a,b) => b[1]-a[1]).slice(0,8);
      const maxPV = sortedPages[0]?.[1] || 1;
      const tbody = el('top-pages-tbody');
      if (tbody) {
        tbody.innerHTML = sortedPages.length ? sortedPages.map(([page, count]) => {
          const pct = Math.round((count/maxPV)*100);
          const share = Math.round((count/Math.max(totalViews,1))*100);
          return `<tr>
            <td style="font-weight:600;">#${page}</td>
            <td>${fmtNum(count)}</td>
            <td><div style="display:flex;align-items:center;gap:.5rem;"><div class="dash-bar" style="width:${pct*0.8}px;"></div><span style="font-size:.7rem;opacity:.6;">${share}%</span></div></td>
          </tr>`;
        }).join('') : '<tr><td colspan="3" style="opacity:.5;text-align:center;padding:1.5rem;">No views tracked yet. Browse some pages to generate data.</td></tr>';
      }

      // ── Traffic Sources (Device Breakdown) ──
      const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
      (Array.isArray(pvData) ? pvData : []).forEach(r => {
        const dt = r.device_type || 'desktop';
        if (deviceCounts.hasOwnProperty(dt)) deviceCounts[dt]++;
      });
      const sourceColors = ['#6366f1','#22c55e','#f59e0b'];
      const sourceLabels = ['Desktop','Mobile','Tablet'];
      const sourceValues = [deviceCounts.desktop, deviceCounts.mobile, deviceCounts.tablet];
      renderDonutChart('chart-traffic-sources', sourceLabels, sourceValues, sourceColors);
      const legend = el('traffic-sources-legend');
      if (legend) {
        legend.innerHTML = sourceLabels.map((l,i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sourceColors[i]};margin-right:.4rem;"></span>${l}</span>
            <strong>${sourceValues[i]}</strong>
          </div>`).join('');
      }

      // ── User Growth Chart ──
      const growthBuckets = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        growthBuckets[d.toISOString().slice(0,10)] = 0;
      }
      (Array.isArray(growthData) ? growthData : []).forEach(row => {
        const day = row.created_at?.slice(0,10);
        if (day && growthBuckets.hasOwnProperty(day)) growthBuckets[day]++;
      });
      let cumulative = 0;
      const growthValues = Object.values(growthBuckets).map(v => { cumulative += v; return cumulative; });
      setEl('user-growth-badge', `+${growthValues.reduce((a,b)=>a+b,0)} in ${days}d`);
      renderLineChart('chart-user-growth', dayLabels, growthValues, '#22c55e', 'Users');

      // ── Activity Timeline & Login Activity ──
      const timeline = el('activity-timeline');
      if (timeline) {
        const timeAgo = ts => {
          const diff = Date.now() - new Date(ts).getTime();
          if (diff < 60000) return 'just now';
          if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
          if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
          return Math.floor(diff/86400000) + 'd ago';
        };
        const items = (Array.isArray(recentPv) ? recentPv : []).slice(0, 20).map(r => ({
          type: 'view', page: r.page, ts: r.created_at, device: r.device_type, referrer: r.referrer || 'direct'
        }));
        if (items.length) {
          timeline.innerHTML = items.map(item => `
            <div class="activity-item">
              <div class="activity-dot view"></div>
              <span class="activity-text">Page viewed: <strong>#${item.page || 'home'}</strong> · ${item.device || 'desktop'} (Referrer: ${item.referrer})</span>
              <span class="activity-time">${timeAgo(item.ts)}</span>
            </div>`).join('');
        } else {
          timeline.innerHTML = '<div class="timeline-loading">No recent activity. Visit pages to start tracking.</div>';
        }
      }

      // ── Popular Content & Stock Pages ──
      const popList = el('popular-content-list');
      if (popList) {
        const sorted = (Array.isArray(postsData) ? postsData : [])
          .sort((a,b) => (b.views||0) - (a.views||0)).slice(0,6);
        popList.innerHTML = sorted.length ? sorted.map(p => `
          <div class="popular-item">
            <span class="popular-item-title">${p.title || 'Untitled'}</span>
            <span class="popular-item-views">${fmtNum(p.views||0)} views</span>
          </div>`).join('')
          : '<div style="opacity:.5;font-size:.8rem;text-align:center;padding:1rem;">No published articles yet.</div>';
      }

    } catch (err) {
      console.error('Dashboard error:', err);
      showToast('Dashboard load failed: ' + err.message, 'error');
    }

    // Refresh button
    const refreshBtn = el('dash-refresh-btn');
    if (refreshBtn) refreshBtn.onclick = () => renderAdminDashboard();
    const periodSel = el('dash-period');
    if (periodSel) periodSel.onchange = () => renderAdminDashboard();
  }

  // ── Chart helpers ─────────────────────────────────────────────────────
  function renderLineChart(canvasId, labels, values, color, label) {
    const canvas = el(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 220;
    const w = canvas.width, h = canvas.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...values, 1);
    const xStep = (w - pad.left - pad.right) / Math.max(labels.length - 1, 1);
    const yScale = (h - pad.top - pad.bottom) / max;
    const pts = values.map((v, i) => ({ x: pad.left + i * xStep, y: h - pad.bottom - v * yScale }));
    const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, h - pad.bottom);
    ctx.lineTo(pts[0].x, h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,150,180,0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.ceil(labels.length / 8);
    labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, pts[i].x, h - 8); });
  }

  function renderDonutChart(canvasId, labels, values, colors) {
    const canvas = el(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 200;
    canvas.height = canvas.offsetHeight || 170;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = Math.min(cx, cy) - 15;
    const inner = r * 0.55;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = -Math.PI / 2;
    values.forEach((v, i) => {
      const slice = (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      startAngle += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-panel') || '#1a1a2e';
    ctx.fill();
    ctx.fillStyle = 'rgba(200,200,220,0.9)';
    ctx.font = `bold ${Math.round(r*0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy);
  }

  // ── 1. Dashboard Subpanel ──
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
        el('admin-post-status').value = 'Published';
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

    // Collapsible Sidebar Toggle
    const collapseBtn = el('sidebar-collapse-btn');
    if (collapseBtn && sidebar) {
      const isCollapsed = localStorage.getItem('wealthengine_sidebar_collapsed') === 'true';
      if (isCollapsed) {
        sidebar.classList.add('collapsed');
        collapseBtn.innerHTML = '▶';
      }
      collapseBtn.onclick = (e) => {
        e.stopPropagation();
        const collapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('wealthengine_sidebar_collapsed', collapsed);
        collapseBtn.innerHTML = collapsed ? '▶' : '◀';
      };
    }

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
