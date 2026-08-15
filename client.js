const APP_URL = window.location.origin;
const PAGE_URLS = {
  home: '/',
  'user-login': '/user-login.html',
  'user-register': '/user-register.html',
  'user-dashboard': '/user-dashboard.html',
  'admin-login': '/admin-login.html',
  'admin-dashboard': '/admin-dashboard.html'
};

const page = document.body.dataset.page;
  const state = { publicData: null, adminData: null, userSession: null };
  const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    applyPhoneLayout();
    initRailMenu();
    if (page === 'home') initHome();
    if (page === 'user-login') initUserLogin();
    if (page === 'user-register') initUserRegister();
    if (page === 'user-dashboard') initUserDashboard();
    if (page === 'admin-login') initAdminLogin();
    if (page === 'admin-dashboard') initAdminDashboard();
  }

  function initRailMenu() {
    const rail = document.querySelector('.rail');
    const button = document.querySelector('.rail-menu-button');
    if (!rail || !button) return;

    button.addEventListener('click', () => {
      const isOpen = rail.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', event => {
      if (!rail.classList.contains('is-open')) return;
      if (rail.contains(event.target)) return;
      rail.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      rail.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function applyPhoneLayout() {
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Messenger|FBAN|FBAV/i.test(ua);
    const narrowScreen = Math.min(screen.width || 9999, window.innerWidth || 9999) <= 520;
    const portrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;

    if (isMobileUA || narrowScreen || portrait) {
      document.body.classList.add('phone-layout');
    }
  }

  async function serverCall(name, ...args) {
    const response = await fetch('/api/gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toServerPayload(name, args))
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result) {
      throw new Error(result && result.error ? result.error : 'Unable to reach the server.');
    }

    if (result.ok === false) {
      throw new Error(result.error || 'The request failed.');
    }

    const { ok, ...data } = result;
    return data;
  }

  function toServerPayload(name, args) {
    switch (name) {
      case 'loginRenter':
        return { action: name, username: args[0], password: args[1] };
      case 'registerRenter':
        return { action: name, ...(args[0] || {}) };
      case 'updateRenterPhone':
        return { action: name, username: args[0], password: args[1], phone: args[2] };
      case 'submitRoomChangeRequest':
        return { action: name, username: args[0], password: args[1], request: args[2] || {} };
      case 'getAdminData':
        return { action: name, password: args[0] };
      case 'addBilling':
        return { action: name, password: args[0], form: args[1] || {} };
      case 'updateBilling':
        return { action: name, password: args[0], transactionId: args[1], update: args[2] || {} };
      case 'adminMarkRoomUnoccupied':
        return { action: name, password: args[0], rentalPlace: args[1], roomNumber: args[2] };
      default:
        return { action: name };
    }
  }

  async function initHome() {
    return;
  }

  function initUserLogin() {
    document.getElementById('userLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        setBusy(event.submitter, true);
        await serverCall('loginRenter', form.username, form.password);
        sessionStorage.setItem('renterAuth', JSON.stringify(form));
        showContinue('Login successful', 'Open your renter dashboard.', 'Open Dashboard', 'user-dashboard');
      } catch (error) {
        showToast(error.message || 'Unable to sign in.');
      } finally {
        setBusy(event.submitter, false);
      }
    });
  }

  async function initUserRegister() {
    const data = await safeLoadPublic();
    populatePlaceSelect(document.getElementById('registerPlace'), data.availableRooms || []);
    populateRoomSelect(document.getElementById('registerRoom'), document.getElementById('registerPlace').value, data.availableRooms || []);
    document.getElementById('registerPlace').addEventListener('change', () => {
      populateRoomSelect(document.getElementById('registerRoom'), document.getElementById('registerPlace').value, data.availableRooms || []);
    });

    document.getElementById('userRegisterForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        setBusy(event.submitter, true);
        await serverCall('registerRenter', form);
        sessionStorage.setItem('renterAuth', JSON.stringify({ username: form.username, password: form.password }));
        showContinue('Account created', 'Your renter dashboard is ready.', 'Open Dashboard', 'user-dashboard');
      } catch (error) {
        showToast(error.message || 'Unable to create account.');
      } finally {
        setBusy(event.submitter, false);
      }
    });
  }

  async function initUserDashboard() {
    initRenterSpreadsheetLink();
    const auth = readSession('renterAuth');
    if (!auth) {
      showContinue('Session needed', 'Please sign in again to view your renter dashboard.', 'Back to Login', 'user-login');
      return;
    }

    try {
      state.userSession = await serverCall('loginRenter', auth.username, auth.password);
      renderUserDashboard();
      bindRenterSelfService(auth);
    } catch (error) {
      sessionStorage.removeItem('renterAuth');
      showContinue('Session expired', 'Please sign in again to continue.', 'Back to Login', 'user-login');
    }

    document.getElementById('userLogout').addEventListener('click', () => {
      sessionStorage.removeItem('renterAuth');
      goToPage('user-login');
    });
  }

  function initAdminLogin() {
    document.getElementById('adminLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        setBusy(event.submitter, true);
        await serverCall('getAdminData', form.password);
        sessionStorage.setItem('adminPassword', form.password);
        showContinue('Admin verified', 'Your management dashboard is ready.', 'Open Admin Dashboard', 'admin-dashboard');
      } catch (error) {
        showToast(error.message || 'Unable to open admin dashboard.');
      } finally {
        setBusy(event.submitter, false);
      }
    });
  }

  async function initAdminDashboard() {
    const password = sessionStorage.getItem('adminPassword');
    if (!password) {
      showContinue('Admin session needed', 'Please enter the admin password again.', 'Back to Admin Login', 'admin-login');
      return;
    }

    try {
      state.publicData = await serverCall('getPublicData');
      state.adminData = await serverCall('getAdminData', password);
      renderAdminDashboard();
      bindBillingForm(password);
    } catch (error) {
      sessionStorage.removeItem('adminPassword');
      showContinue('Admin session expired', 'Please enter the admin password again.', 'Back to Admin Login', 'admin-login');
    }

    document.getElementById('adminLogout').addEventListener('click', () => {
      sessionStorage.removeItem('adminPassword');
      goToPage('admin-login');
    });
  }

  function renderUserDashboard() {
    const session = state.userSession;
    const user = session.user;
    document.getElementById('userWelcome').textContent = `Welcome, ${user.fullName}`;
    document.getElementById('userAccountChips').innerHTML = accountChips(user);
    document.getElementById('userDetailsPanel').innerHTML = renderUserDetails(user);
    document.getElementById('userPhoneInput').value = user.phone || '';
    const sheetLink = document.getElementById('userSpreadsheetLink');
    if (sheetLink) {
      setRenterSpreadsheetLink(user.renterSheetUrl);
    }
    populatePlaceSelect(document.getElementById('requestPlace'), session.rooms || []);
    populateRoomSelect(document.getElementById('requestRoom'), document.getElementById('requestPlace').value, session.rooms || []);
    document.getElementById('requestPlace').onchange = () => {
      populateRoomSelect(document.getElementById('requestRoom'), document.getElementById('requestPlace').value, state.userSession.rooms || []);
    };
    renderUserBills(session.bills || []);
  }

  function initRenterSpreadsheetLink() {
    const sheetLink = document.getElementById('userSpreadsheetLink');
    if (!sheetLink) return;

    sheetLink.addEventListener('click', event => {
      if (!sheetLink.dataset.href) {
        event.preventDefault();
        showToast('Your private spreadsheet is still being prepared. Try signing in again in a moment.');
      }
    });
  }

  function setRenterSpreadsheetLink(url) {
    const sheetLink = document.getElementById('userSpreadsheetLink');
    if (!sheetLink) return;

    if (!url) {
      sheetLink.removeAttribute('target');
      sheetLink.removeAttribute('rel');
      sheetLink.removeAttribute('href');
      delete sheetLink.dataset.href;
      sheetLink.setAttribute('aria-disabled', 'true');
      sheetLink.classList.add('disabled');
      return;
    }

    sheetLink.href = url;
    sheetLink.dataset.href = url;
    sheetLink.target = '_blank';
    sheetLink.rel = 'noopener';
    sheetLink.setAttribute('aria-disabled', 'false');
    sheetLink.classList.remove('disabled');
  }

  function bindRenterSelfService(auth) {
    const phoneForm = document.getElementById('userPhoneForm');
    const requestForm = document.getElementById('roomRequestForm');

    phoneForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());

      try {
        setBusy(event.submitter, true);
        state.userSession = await serverCall('updateRenterPhone', auth.username, auth.password, form.phone);
        renderUserDashboard();
        showToast('Phone number updated.');
      } catch (error) {
        showToast(error.message || 'Unable to update phone.');
      } finally {
        setBusy(event.submitter, false);
      }
    });

    requestForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());

      try {
        setBusy(event.submitter, true);
        state.userSession = await serverCall('submitRoomChangeRequest', auth.username, auth.password, form);
        renderUserDashboard();
        event.currentTarget.reset();
        showToast('Room change request sent to admin.');
      } catch (error) {
        showToast(error.message || 'Unable to send request.');
      } finally {
        setBusy(event.submitter, false);
      }
    });
  }

  function renderAdminDashboard() {
    document.getElementById('adminRenterCount').textContent = `${state.adminData.renters.length} renters`;
    document.getElementById('adminBillCount').textContent = `${state.adminData.bills.length} billings`;
    renderRoomCards(state.adminData.rooms || []);
    populateBillingPlaces();
    renderAdminBills(state.adminData.bills || []);
    renderAdminRequests(state.adminData.requests || []);
    setTodayDefaults();
    populateBillingAmounts();
  }

  function bindBillingForm(password) {
    document.getElementById('billingPlace').addEventListener('change', () => {
      populateBillingRooms();
      populateBillingRenter();
      populateBillingAmounts();
    });
    document.getElementById('billingRoom').addEventListener('change', () => {
      populateBillingRenter();
      populateBillingAmounts();
    });
    document.querySelector('#billingForm [name="billingMonth"]').addEventListener('change', populateBillingAmounts);
    document.getElementById('billingForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        assertPositiveBillingTotal(form);
        setBusy(event.submitter, true);
        state.adminData = await serverCall('addBilling', password, form);
        event.currentTarget.reset();
        renderAdminDashboard();
        setTodayDefaults();
        populateBillingPlaces();
        populateBillingAmounts();
        showToast('Billing added.');
      } catch (error) {
        showToast(error.message || 'Unable to add billing.');
      } finally {
        setBusy(event.submitter, false);
      }
    });
  }

  function assertPositiveBillingTotal(form) {
    const total = moneyValue(form.rent) + moneyValue(form.waterBill) + moneyValue(form.electricityBill);
    if (total <= 0) {
      throw new Error('Enter at least one billing amount greater than 0.');
    }
  }

  function moneyValue(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }

  async function saveBillRow(button) {
    const password = sessionStorage.getItem('adminPassword');
    const row = button.closest('tr');
    const update = Object.fromEntries(Array.from(row.querySelectorAll('input, select')).map(input => [input.name, input.value]));
    try {
      setBusy(button, true);
      state.adminData = await serverCall('updateBilling', password, row.dataset.id, update);
      renderAdminDashboard();
      showToast('Billing updated.');
    } catch (error) {
      showToast(error.message || 'Unable to update billing.');
    } finally {
      setBusy(button, false);
    }
  }

  function populateBillingPlaces() {
    populatePlaceSelect(document.getElementById('billingPlace'), state.publicData.rooms || []);
    populateBillingRooms();
    populateBillingRenter();
  }

  function populateBillingRooms() {
    populateRoomSelect(document.getElementById('billingRoom'), document.getElementById('billingPlace').value, state.publicData.rooms || []);
  }

  function populateBillingRenter() {
    const place = document.getElementById('billingPlace').value;
    const room = document.getElementById('billingRoom').value;
    const renter = (state.adminData.renters || []).find(item => item.accountStatus === 'Renting' && item.rentalPlace === place && item.roomNumber === room);
    const submitButton = document.querySelector('#billingForm button[type="submit"]');
    document.getElementById('billingRenterName').value = renter ? renter.fullName : '';
    if (submitButton) {
      submitButton.disabled = !renter;
      submitButton.textContent = renter ? 'Add Billing' : 'Room Unoccupied';
    }
  }

  function populateBillingAmounts() {
    const form = document.getElementById('billingForm');
    const place = form.rentalPlace.value;
    const room = form.roomNumber.value;
    const billingMonth = form.billingMonth.value;
    const renter = (state.adminData.renters || []).find(item =>
      item.accountStatus === 'Renting' &&
      item.rentalPlace === place &&
      item.roomNumber === room
    );

    if (!place || !room || !billingMonth) {
      return;
    }

    const billTemplate = findBillingTemplate(place, room, billingMonth, renter);

    if (!billTemplate) {
      form.rent.value = 0;
      form.waterBill.value = 0;
      form.electricityBill.value = 0;
      return;
    }

    form.rent.value = billTemplate.rent || 0;
    form.waterBill.value = billTemplate.waterBill || 0;
    form.electricityBill.value = billTemplate.electricityBill || 0;
  }

  function findBillingTemplate(place, room, billingMonth, renter) {
    const bills = state.adminData.bills || [];
    const sameRoom = bills.filter(bill =>
      bill.rentalPlace === place &&
      bill.roomNumber === room &&
      (!renter || bill.username === renter.username)
    );
    const exactMonth = sameRoom.find(bill => bill.billingMonth === billingMonth);

    return exactMonth || sameRoom[0] || null;
  }

  async function safeLoadPublic() {
    try {
      state.publicData = await serverCall('getPublicData');
      return state.publicData;
    } catch (error) {
      showToast(error.message || 'Unable to load rooms.');
      return { rooms: [], availableRooms: [] };
    }
  }

  function renderRoomCards(rooms) {
    const cards = rooms || [];
    const count = document.getElementById('availableCount');
    if (count) count.textContent = `${cards.filter(room => !room.occupied).length} available`;
    const target = document.getElementById('roomCards');
    if (!target) return;
    target.innerHTML = cards.map(room => `
      <article class="room-card">
        <div class="room-card-top">
          <span class="place">${escapeHtml(room.place)}</span>
          <span class="status status-${room.occupied ? 'renting' : 'available'}">${room.occupied ? 'Occupied' : 'Available'}</span>
        </div>
        <strong class="room">${escapeHtml(room.roomNumber)}</strong>
        <span class="meta primary-meta">${room.renterName ? escapeHtml(room.renterName) : 'No renter assigned'}</span>
        <span class="meta">Billing Month: ${room.billingMonth ? escapeHtml(room.billingMonth) : '-'}</span>
        <span class="meta">Billing Date: ${room.billingDate ? escapeHtml(room.billingDate) : '-'}</span>
        ${page === 'admin-dashboard' && room.occupied ? `
          <button
            class="button small ghost room-action"
            type="button"
            onclick="markRoomUnoccupied('${escapeJs(room.place)}', '${escapeJs(room.roomNumber)}')"
          >
            Mark Unoccupied
          </button>
        ` : ''}
      </article>
    `).join('');
  }

  async function markRoomUnoccupied(place, roomNumber) {
    const password = sessionStorage.getItem('adminPassword');

    if (!password) {
      showContinue('Admin session needed', 'Please enter the admin password again.', 'Back to Admin Login', 'admin-login');
      return;
    }

    if (!confirm(`Mark ${place} ${roomNumber} as unoccupied?`)) {
      return;
    }

    try {
      state.adminData = await serverCall('adminMarkRoomUnoccupied', password, place, roomNumber);
      state.publicData = await serverCall('getPublicData');
      renderAdminDashboard();
      showToast('Room marked unoccupied.');
    } catch (error) {
      showToast(error.message || 'Unable to update room.');
    }
  }

  function renderUserBills(bills) {
    const tbody = document.getElementById('userBillsTable');
    const cards = document.getElementById('userBillsCards');
    const sorted = [...bills].sort((a, b) => String(b.billingMonth).localeCompare(String(a.billingMonth)));
    if (cards) {
      cards.innerHTML = sorted.length ? sorted.map(bill => `
        <article class="mobile-bill-card">
          <div>
            <span class="mobile-bill-month">${escapeHtml(bill.billingMonth)}</span>
            <span class="status status-${statusClass(bill.paymentStatus)}">${escapeHtml(bill.paymentStatus)}</span>
          </div>
          <strong>${peso.format(bill.total)}</strong>
          <dl>
            <div><dt>Date</dt><dd>${escapeHtml(bill.billingDate)}</dd></div>
            <div><dt>Rent</dt><dd>${peso.format(bill.rent)}</dd></div>
            <div><dt>Water</dt><dd>${peso.format(bill.waterBill)}</dd></div>
            <div><dt>Electricity</dt><dd>${peso.format(bill.electricityBill)}</dd></div>
          </dl>
        </article>
      `).join('') : '<p class="empty-mobile">No billing records yet.</p>';
    }
    tbody.innerHTML = sorted.length ? sorted.map(bill => `
      <tr>
        <td>${escapeHtml(bill.billingMonth)}</td><td>${escapeHtml(bill.billingDate)}</td><td>${escapeHtml(bill.rentalPlace)}</td><td>${escapeHtml(bill.roomNumber)}</td>
        <td>${peso.format(bill.rent)}</td><td>${peso.format(bill.waterBill)}</td><td>${peso.format(bill.electricityBill)}</td><td>${peso.format(bill.total)}</td>
        <td><span class="status status-${statusClass(bill.paymentStatus)}">${escapeHtml(bill.paymentStatus)}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="9">No billing records yet.</td></tr>';
  }

  function renderAdminBills(bills) {
    const tbody = document.getElementById('adminBillsTable');
    tbody.innerHTML = bills.length ? bills.map(bill => `
      <tr data-id="${escapeHtml(bill.transactionId)}">
        <td>${escapeHtml(bill.transactionId)}</td><td>${escapeHtml(bill.renterName)}</td><td>${escapeHtml(bill.rentalPlace)}</td><td>${escapeHtml(bill.roomNumber)}</td>
        <td><input name="billingMonth" type="month" value="${escapeHtml(bill.billingMonth)}"></td>
        <td><input name="billingDate" type="date" value="${escapeHtml(bill.billingDate)}"></td>
        <td><input name="rent" type="number" min="0" value="${bill.rent}"></td>
        <td><input name="waterBill" type="number" min="0" value="${bill.waterBill}"></td>
        <td><input name="electricityBill" type="number" min="0" value="${bill.electricityBill}"></td>
        <td><select name="paymentStatus">${['Unpaid', 'Partial', 'Paid'].map(status => `<option ${status === bill.paymentStatus ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
        <td><input name="notes" value="${escapeHtml(bill.notes)}"></td>
        <td><button class="button small ghost" type="button" onclick="saveBillRow(this)">Save</button></td>
      </tr>
    `).join('') : '<tr><td colspan="12">No billing transactions yet.</td></tr>';
  }

  function renderAdminRequests(requests) {
    const target = document.getElementById('adminRequestsList');
    if (!target) return;

    target.innerHTML = requests.length ? requests.map(request => `
      <article class="request-card">
        <div>
          <span class="status status-${statusClass(request.status)}">${escapeHtml(request.status)}</span>
          <h3>${escapeHtml(request.renterName)}</h3>
          <p>@${escapeHtml(request.username)} | ${escapeHtml(request.phone || 'No phone')}</p>
        </div>
        <dl>
          <div><dt>Current</dt><dd>${escapeHtml(request.currentPlace || '-')} ${escapeHtml(request.currentRoom || '')}</dd></div>
          <div><dt>Requested</dt><dd>${escapeHtml(request.requestedPlace)} ${escapeHtml(request.requestedRoom)}</dd></div>
          <div><dt>Message</dt><dd>${escapeHtml(request.message || '-')}</dd></div>
          <div><dt>Date</dt><dd>${escapeHtml(request.createdAt)}</dd></div>
        </dl>
      </article>
    `).join('') : '<p class="empty-mobile">No room change requests yet.</p>';
  }

  function accountChips(user) {
    const chips = [`<span class="chip">@${escapeHtml(user.username)}</span>`, `<span class="chip">${escapeHtml(user.accountStatus)}</span>`];
    if (user.accountStatus === 'Renting') chips.push(`<span class="chip">${escapeHtml(user.rentalPlace)} ${escapeHtml(user.roomNumber)}</span>`);
    if (user.phone) chips.push(`<span class="chip">${escapeHtml(user.phone)}</span>`);
    return chips.join('');
  }

  function renderUserDetails(user) {
    const details = [
      ['Full Name', user.fullName],
      ['Username', `@${user.username}`],
      ['Email', user.email || 'Not provided'],
      ['Phone', user.phone || 'Not provided'],
      ['Account Status', user.accountStatus]
    ];

    if (user.accountStatus === 'Renting') {
      details.push(['Rental Place', user.rentalPlace || '-']);
      details.push(['Room Number', user.roomNumber || '-']);
    }

    return details.map(([label, value]) => `
      <div class="readonly-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');
  }

  function getRoomsForUser(session) {
    const rooms = [...(session.rooms || [])];
    const user = session.user;
    if (user.accountStatus === 'Renting' && user.rentalPlace && user.roomNumber) rooms.push({ place: user.rentalPlace, roomNumber: user.roomNumber });
    return uniqueRooms(rooms);
  }

  function populatePlaceSelect(select, rooms) {
    if (!select) return;
    const places = [...new Set((rooms || []).map(room => room.place).filter(Boolean))];
    select.innerHTML = '<option value="">Choose place</option>' + places.map(place => `<option value="${escapeHtml(place)}">${escapeHtml(place)}</option>`).join('');
  }

  function populateRoomSelect(select, place, rooms) {
    if (!select) return;
    const matching = (rooms || []).filter(room => room.place === place);
    select.innerHTML = '<option value="">Choose room</option>' + matching.map(room => `<option value="${escapeHtml(room.roomNumber)}">${escapeHtml(room.roomNumber)}</option>`).join('');
  }

  function uniqueRooms(rooms) {
    const seen = new Set();
    return rooms.filter(room => {
      const key = `${room.place}:${room.roomNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function setTodayDefaults() {
    const form = document.getElementById('billingForm');
    if (!form) return;
    form.billingDate.value = new Date().toISOString().slice(0, 10);
    form.billingMonth.value = new Date().toISOString().slice(0, 7);
  }

  function readSession(key) {
    try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; }
  }

  function goToPage(targetPage) {
    window.location.href = pageUrl(targetPage);
  }

  function pageUrl(targetPage) {
    return PAGE_URLS[targetPage] || '/';
  }

  function showContinue(title, message, label, targetPage) {
    const main = document.querySelector('main') || document.body;
    main.classList.add('continue-stage');
    main.innerHTML = `
      <section class="continue-card">
        <div class="continue-badge">Success</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <a class="link-button primary large" href="${pageUrl(targetPage)}">${escapeHtml(label)}</a>
      </section>
    `;
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = busy ? 'Please wait...' : button.dataset.originalText;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function statusClass(status) {
    return String(status || '').toLowerCase().replace(/\s+/g, '-');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escapeJs(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
  }
