const SPREADSHEET_ID = '12GxOoQuLLXFlFWCJP0HRCauA-AMasfsd5izJjUv6gwQ';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
const ADMIN_PASSWORD = 'tatapulido1977';
const DATABASE_EDITOR_EMAILS = [
  'charishpulido04@gmail.com',
  'tatapulido1@gmail.com'
];
const BILLS_SHEET = 'Bills';
const RENTERS_SHEET = 'Renters';
const REQUESTS_SHEET = 'Room Requests';
const WIFI_LICENSES_SHEET = 'WiFi Licenses';

const ROOM_INVENTORY = [
  { place: 'Malatabis', roomNumber: 'Room 1' },
  { place: 'Malatabis', roomNumber: 'Room 2' },
  { place: 'Malatabis', roomNumber: 'Room 3' },
  { place: 'Feriols', roomNumber: 'Room 1' },
  { place: 'Feriols', roomNumber: 'Room 2' },
  { place: 'Feriols', roomNumber: 'Room 3' }
];

const RENTER_HEADERS = [
  'Username',
  'Password Hash',
  'Full Name',
  'Phone',
  'Account Status',
  'Rental Place',
  'Room Number',
  'Created At',
  'Updated At',
  'Email',
  'Renter Sheet ID',
  'Renter Sheet URL'
];

const BILL_HEADERS = [
  'Transaction ID',
  'Username',
  'Renter Name',
  'Phone',
  'Rental Place',
  'Room Number',
  'Billing Month',
  'Billing Date',
  'Rent',
  'Water Bill',
  'Electricity Bill',
  'Total',
  'Payment Status',
  'Account Status',
  'Notes',
  'Created At',
  'Updated At'
];

const REQUEST_HEADERS = [
  'Request ID',
  'Username',
  'Renter Name',
  'Phone',
  'Current Place',
  'Current Room',
  'Requested Place',
  'Requested Room',
  'Message',
  'Status',
  'Created At',
  'Updated At'
];

const WIFI_LICENSE_HEADERS = [
  'WiFi Connection Name',
  'License ID',
  'Created At',
  'Updated At'
];

const RENTER_PROFILE_HEADERS = ['Field', 'Value'];
const RENTER_LEDGER_HEADERS = [
  'Transaction ID',
  'Billing Month',
  'Billing Date',
  'Rental Place',
  'Room Number',
  'Rent',
  'Water Bill',
  'Electricity Bill',
  'Total',
  'Payment Status',
  'Notes',
  'Updated At'
];

function doGet() {
  ensureDatabaseSharing_();
  const page = String(arguments[0] && arguments[0].parameter && arguments[0].parameter.page || 'home');
  const pages = {
    home: 'Index',
    'user-login': 'UserLogin',
    'user-register': 'UserRegister',
    'user-dashboard': 'UserDashboard',
    'admin-login': 'AdminLogin',
    'admin-dashboard': 'AdminDashboard'
  };

  return HtmlService
    .createTemplateFromFile(pages[page] || 'Index')
    .evaluate()
    .setTitle('Apartment Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = String(payload.action || '');
    let result;

    switch (action) {
      case 'getPublicData':
        result = getPublicData();
        break;
      case 'databaseUrl':
        result = { url: databaseUrl() };
        break;
      case 'loginRenter':
      case 'validateRenterLogin':
        result = loginRenter(payload.username, payload.password);
        break;
      case 'registerRenter':
      case 'createRenterAccount':
        result = registerRenter(normalizeSignupPayload_(payload.signup || payload.form || payload));
        break;
      case 'updateRenterPhone':
        result = updateRenterPhone(payload.username, payload.password, payload.phone);
        break;
      case 'submitRoomChangeRequest':
        result = submitRoomChangeRequest(payload.username, payload.password, payload.request || payload);
        break;
      case 'getRenterBills':
      case 'findBillsByUsername':
        result = { bills: getRenterBills(payload.username) };
        break;
      case 'getAvailableRooms':
        result = { rooms: getAvailableRooms_(payload.username || '') };
        break;
      case 'getAdminData':
        result = getAdminData(payload.password || payload.adminPassword);
        break;
      case 'addBilling':
      case 'addBill':
        result = addBilling(payload.password || payload.adminPassword, normalizeBillingPayload_(payload.form || payload.bill || payload));
        break;
      case 'updateBilling':
        result = updateBilling(payload.password || payload.adminPassword, payload.transactionId, payload.update || payload);
        break;
      case 'adminMarkRoomUnoccupied':
        result = adminMarkRoomUnoccupied(payload.password || payload.adminPassword, payload.rentalPlace, payload.roomNumber);
        break;
      case 'adminResolveRoomRequest':
        result = adminResolveRoomRequest(payload.password || payload.adminPassword, payload.requestId, payload.decision);
        break;
      case 'adminAddWifiLicense':
        result = adminAddWifiLicense(payload.password || payload.adminPassword, payload.form || payload);
        break;
      default:
        throw new Error('Unknown API action.');
    }

    return json_({ ok: true, ...result });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function appUrl() {
  return ScriptApp.getService().getUrl();
}

function databaseUrl() {
  return SPREADSHEET_URL;
}

function ensureDatabaseSharing_() {
  const file = DriveApp.getFileById(SPREADSHEET_ID);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  file.setShareableByEditors(false);
  file.getEditors().forEach(user => {
    const email = user.getEmail().toLowerCase();
    if (DATABASE_EDITOR_EMAILS.indexOf(email) === -1) {
      file.removeEditor(email);
    }
  });
  file.getViewers().forEach(user => {
    const email = user.getEmail().toLowerCase();
    if (DATABASE_EDITOR_EMAILS.indexOf(email) === -1) {
      file.removeViewer(email);
    }
  });
  DATABASE_EDITOR_EMAILS.forEach(email => file.addEditor(email));
}

function getPublicData() {
  return {
    rooms: getRoomCards_(),
    availableRooms: getAvailableRooms_()
  };
}

function getAdminData(password) {
  assertAdmin_(password);
  ensureDatabaseSharing_();
  return {
    bills: getAllBills_(),
    renters: getPublicRenters_(),
    rooms: getRoomCards_(),
    requests: getAllRoomRequests_(),
    wifiLicenses: getAllWifiLicenses_()
  };
}

function registerRenter(form) {
  const username = normalizeUsername_(form.username);
  const password = String(form.password || '');
  const fullName = String(form.fullName || '').trim();
  const email = normalizeEmail_(form.email);
  const phone = String(form.phone || '').trim();
  const accountStatus = 'Renting';
  const rentalPlace = String(form.rentalPlace || '').trim();
  const roomNumber = String(form.roomNumber || '').trim();

  if (!username || !password || !fullName || !email || !rentalPlace || !roomNumber) {
    throw new Error('Complete the account and room details.');
  }

  assertValidRoom_(rentalPlace, roomNumber);

  if (getRenterByUsername_(username)) {
    throw new Error('This username already exists.');
  }

  if (getActiveRenterByRoom_(rentalPlace, roomNumber)) {
    throw new Error(`${rentalPlace} ${roomNumber} is already booked.`);
  }

  const now = now_();
  sheet_(RENTERS_SHEET, RENTER_HEADERS).appendRow([
    username,
    hashPassword_(username, password),
    fullName,
    phone,
    accountStatus,
    rentalPlace,
    roomNumber,
    now,
    now,
    email,
    '',
    ''
  ]);

  return renterSession_(provisionRenterSpreadsheet_(getRenterByUsername_(username)));
}

function loginRenter(username, password) {
  const normalized = normalizeUsername_(username);
  let renter = getRenterByUsername_(normalized);

  if (!renter || renter.passwordHash !== hashPassword_(normalized, String(password || ''))) {
    throw new Error('Invalid username or password.');
  }

  renter = provisionRenterSpreadsheet_(renter);
  return renterSession_(renter);
}

function updateRenterAccount(username, password, update) {
  const normalized = normalizeUsername_(username);
  const renter = getRenterByUsername_(normalized);

  if (!renter || renter.passwordHash !== hashPassword_(normalized, String(password || ''))) {
    throw new Error('Invalid username or password.');
  }

  const status = String(update.accountStatus || 'Renting').trim();
  const rentalPlace = status === 'Renting' ? String(update.rentalPlace || '').trim() : '';
  const roomNumber = status === 'Renting' ? String(update.roomNumber || '').trim() : '';

  if (status === 'Renting') {
    assertValidRoom_(rentalPlace, roomNumber);
    const occupied = getActiveRenterByRoom_(rentalPlace, roomNumber, normalized);
    if (occupied) {
      throw new Error(`${rentalPlace} ${roomNumber} is already booked.`);
    }
  }

  const sheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
  sheet.getRange(renter.rowNumber, 5, 1, 5).setValues([[
    status,
    rentalPlace,
    roomNumber,
    renter.createdAt,
    now_()
  ]]);

  return renterSession_(getRenterByUsername_(normalized));
}

function updateRenterPhone(username, password, phone) {
  const normalized = normalizeUsername_(username);
  const renter = getRenterByUsername_(normalized);

  if (!renter || renter.passwordHash !== hashPassword_(normalized, String(password || ''))) {
    throw new Error('Invalid username or password.');
  }

  const sheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
  sheet.getRange(renter.rowNumber, 4).setValue(String(phone || '').trim());
  sheet.getRange(renter.rowNumber, 9).setValue(now_());

  const updated = getRenterByUsername_(normalized);
  syncRenterSpreadsheet_(updated);
  return renterSession_(updated);
}

function submitRoomChangeRequest(username, password, request) {
  const normalized = normalizeUsername_(username);
  const renter = getRenterByUsername_(normalized);

  if (!renter || renter.passwordHash !== hashPassword_(normalized, String(password || ''))) {
    throw new Error('Invalid username or password.');
  }

  const requestedPlace = String(request.requestedPlace || '').trim();
  const requestedRoom = String(request.requestedRoom || '').trim();

  if (!requestedPlace || !requestedRoom) {
    throw new Error('Choose the room you want to request.');
  }

  assertValidRoom_(requestedPlace, requestedRoom);

  if (getActiveRenterByRoom_(requestedPlace, requestedRoom, normalized)) {
    throw new Error(`${requestedPlace} ${requestedRoom} is already occupied.`);
  }

  const now = now_();
  sheet_(REQUESTS_SHEET, REQUEST_HEADERS).appendRow([
    makeRequestId_(),
    renter.username,
    renter.fullName,
    renter.phone,
    renter.rentalPlace,
    renter.roomNumber,
    requestedPlace,
    requestedRoom,
    String(request.message || '').trim(),
    'Pending',
    now,
    now
  ]);

  return renterSession_(renter);
}

function adminMarkRoomUnoccupied(password, rentalPlace, roomNumber) {
  assertAdmin_(password);
  const place = String(rentalPlace || '').trim();
  const room = String(roomNumber || '').trim();
  const renter = getActiveRenterByRoom_(place, room);

  if (!renter) {
    throw new Error('This room is already unoccupied.');
  }

  const sheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
  sheet.getRange(renter.rowNumber, 5, 1, 5).setValues([[
    'Not Renting',
    '',
    '',
    renter.createdAt,
    now_()
  ]]);

  syncRenterSpreadsheet_(getRenterByUsername_(renter.username));
  return getAdminData(password);
}

function adminResolveRoomRequest(password, requestId, decision) {
  assertAdmin_(password);
  const normalizedId = String(requestId || '').trim();
  const action = String(decision || '').trim().toLowerCase();
  const requestRow = findRequestRow_(normalizedId);

  if (!requestRow) {
    throw new Error('Room change request was not found.');
  }
  if (action !== 'approve' && action !== 'reject') {
    throw new Error('Choose approve or reject for the request.');
  }

  const sheet = sheet_(REQUESTS_SHEET, REQUEST_HEADERS);
  const request = requestFromRow_(sheet.getRange(requestRow, 1, 1, REQUEST_HEADERS.length).getDisplayValues()[0], requestRow);

  if (request.status !== 'Pending') {
    throw new Error('This request has already been resolved.');
  }

  if (action === 'reject') {
    sheet.getRange(requestRow, 10, 1, 3).setValues([['Rejected', request.createdAt, now_()]]);
    return getAdminData(password);
  }

  const renter = getRenterByUsername_(request.username);
  if (!renter) {
    throw new Error('The renter for this request was not found.');
  }

  assertValidRoom_(request.requestedPlace, request.requestedRoom);
  const occupied = getActiveRenterByRoom_(request.requestedPlace, request.requestedRoom, request.username);
  if (occupied) {
    throw new Error(`${request.requestedPlace} ${request.requestedRoom} is already occupied.`);
  }

  const renterSheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
  renterSheet.getRange(renter.rowNumber, 5, 1, 5).setValues([[
    'Renting',
    request.requestedPlace,
    request.requestedRoom,
    renter.createdAt,
    now_()
  ]]);
  sheet.getRange(requestRow, 10, 1, 3).setValues([['Approved', request.createdAt, now_()]]);

  syncRenterSpreadsheet_(getRenterByUsername_(request.username));
  return getAdminData(password);
}

function adminAddWifiLicense(password, form) {
  assertAdmin_(password);
  const wifiConName = String(form.wifiConName || '').trim();
  const licenseId = String(form.licenseId || '').trim();

  if (!wifiConName || !licenseId) {
    throw new Error('WiFi connection name and license ID are required.');
  }

  const now = now_();
  sheet_(WIFI_LICENSES_SHEET, WIFI_LICENSE_HEADERS).appendRow([
    wifiConName,
    licenseId,
    now,
    now
  ]);

  return getAdminData(password);
}

function addBilling(password, form) {
  assertAdmin_(password);

  const rentalPlace = String(form.rentalPlace || '').trim();
  const roomNumber = String(form.roomNumber || '').trim();
  const renter = getActiveRenterByRoom_(rentalPlace, roomNumber);

  if (!renter) {
    throw new Error('No active renter is assigned to this room.');
  }

  const billingMonth = String(form.billingMonth || '').trim();
  const billingDate = String(form.billingDate || '').trim();
  const rent = money_(form.rent);
  const waterBill = money_(form.waterBill);
  const electricityBill = money_(form.electricityBill);
  const total = rent + waterBill + electricityBill;
  const now = now_();

  if (!billingMonth || !billingDate) {
    throw new Error('Billing month and billing date are required.');
  }
  if (total <= 0) {
    throw new Error('Enter at least one billing amount greater than 0.');
  }

  const transactionId = makeTransactionId_();
  sheet_(BILLS_SHEET, BILL_HEADERS).appendRow([
    transactionId,
    renter.username,
    renter.fullName,
    renter.phone,
    rentalPlace,
    roomNumber,
    billingMonth,
    billingDate,
    rent,
    waterBill,
    electricityBill,
    total,
    String(form.paymentStatus || 'Unpaid').trim(),
    renter.accountStatus,
    String(form.notes || '').trim(),
    now,
    now
  ]);

  syncRenterSpreadsheet_(getRenterByUsername_(renter.username));
  return getAdminData(password);
}

function updateBilling(password, transactionId, update) {
  assertAdmin_(password);
  const sheet = sheet_(BILLS_SHEET, BILL_HEADERS);
  const rowNumber = findBillRow_(transactionId);

  if (!rowNumber) {
    throw new Error('Billing transaction was not found.');
  }

  const current = billFromRow_(sheet.getRange(rowNumber, 1, 1, BILL_HEADERS.length).getValues()[0], rowNumber);
  const rent = money_(update.rent);
  const waterBill = money_(update.waterBill);
  const electricityBill = money_(update.electricityBill);
  const total = rent + waterBill + electricityBill;

  if (total <= 0) {
    throw new Error('Enter at least one billing amount greater than 0.');
  }

  sheet.getRange(rowNumber, 7, 1, 11).setValues([[
    String(update.billingMonth || current.billingMonth).trim(),
    String(update.billingDate || current.billingDate).trim(),
    rent,
    waterBill,
    electricityBill,
    total,
    String(update.paymentStatus || current.paymentStatus).trim(),
    current.accountStatus,
    String(update.notes || '').trim(),
    current.createdAt,
    now_()
  ]]);

  syncRenterSpreadsheet_(getRenterByUsername_(current.username));
  return getAdminData(password);
}

function getRenterBills(username) {
  const normalized = normalizeUsername_(username);
  return getAllBills_().filter(bill => bill.username === normalized);
}

function getAvailableRoomsForUser(username) {
  return getAvailableRooms_(normalizeUsername_(username));
}

function getAllRenters_() {
  const sheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), RENTER_HEADERS.length))
    .getDisplayValues()
    .filter(row => row.some(Boolean))
    .map((row, index) => renterFromRow_(row, index + 2));
}

function getPublicRenters_() {
  return getAllRenters_().map(renter => ({
    username: renter.username,
    fullName: renter.fullName,
    email: renter.email,
    phone: renter.phone,
    accountStatus: renter.accountStatus,
    rentalPlace: renter.rentalPlace,
    roomNumber: renter.roomNumber,
    renterSheetUrl: renter.renterSheetUrl
  }));
}

function getAllBills_() {
  const sheet = sheet_(BILLS_SHEET, BILL_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), BILL_HEADERS.length))
    .getDisplayValues()
    .filter(row => row.some(Boolean))
    .map((row, index) => billFromRow_(row, index + 2))
    .reverse();
}

function getAllRoomRequests_() {
  const sheet = sheet_(REQUESTS_SHEET, REQUEST_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, REQUEST_HEADERS.length)
    .getDisplayValues()
    .filter(row => row.some(Boolean))
    .map((row, index) => requestFromRow_(row, index + 2))
    .reverse();
}

function getAllWifiLicenses_() {
  const sheet = sheet_(WIFI_LICENSES_SHEET, WIFI_LICENSE_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, WIFI_LICENSE_HEADERS.length)
    .getDisplayValues()
    .filter(row => row.some(Boolean))
    .map((row, index) => wifiLicenseFromRow_(row, index + 2))
    .reverse();
}

function getRoomCards_() {
  const bills = getAllBills_();
  return ROOM_INVENTORY.map(room => {
    const renter = getActiveRenterByRoom_(room.place, room.roomNumber);
    const latestBill = bills.find(bill =>
      bill.rentalPlace === room.place && bill.roomNumber === room.roomNumber
    );

    return {
      place: room.place,
      roomNumber: room.roomNumber,
      occupied: Boolean(renter),
      renterName: renter ? renter.fullName : '',
      username: renter ? renter.username : '',
      accountStatus: renter ? renter.accountStatus : 'Available',
      billingMonth: latestBill ? latestBill.billingMonth : '',
      billingDate: latestBill ? latestBill.billingDate : '',
      paymentStatus: latestBill ? latestBill.paymentStatus : ''
    };
  });
}

function getAvailableRooms_(exceptUsername) {
  const except = normalizeUsername_(exceptUsername);
  return ROOM_INVENTORY.filter(room => !getActiveRenterByRoom_(room.place, room.roomNumber, except));
}

function getRenterByUsername_(username) {
  return getAllRenters_().find(renter => renter.username === normalizeUsername_(username));
}

function getActiveRenterByRoom_(rentalPlace, roomNumber, exceptUsername) {
  const except = normalizeUsername_(exceptUsername);
  return getAllRenters_().find(renter =>
    renter.username !== except &&
    renter.accountStatus === 'Renting' &&
    renter.rentalPlace === rentalPlace &&
    renter.roomNumber === roomNumber
  );
}

function findBillRow_(transactionId) {
  const normalized = String(transactionId || '').trim();
  const sheet = sheet_(BILLS_SHEET, BILL_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = values.findIndex(row => String(row[0]).trim() === normalized);
  return index === -1 ? 0 : index + 2;
}

function findRequestRow_(requestId) {
  const normalized = String(requestId || '').trim();
  const sheet = sheet_(REQUESTS_SHEET, REQUEST_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = values.findIndex(row => String(row[0]).trim() === normalized);
  return index === -1 ? 0 : index + 2;
}

function renterSession_(renter) {
  return {
    user: {
      username: renter.username,
      fullName: renter.fullName,
      email: renter.email,
      phone: renter.phone,
      accountStatus: renter.accountStatus,
      rentalPlace: renter.accountStatus === 'Renting' ? renter.rentalPlace : '',
      roomNumber: renter.accountStatus === 'Renting' ? renter.roomNumber : '',
      renterSheetUrl: renter.renterSheetUrl
    },
    bills: getRenterBills(renter.username),
    rooms: getAvailableRooms_(renter.username)
  };
}

function renterFromRow_(row, rowNumber) {
  const oldRooms = String(row[4] || '');
  const oldFormat = oldRooms && oldRooms !== 'Renting' && oldRooms !== 'Not Renting';
  const inferredRoom = parseRoom_(oldRooms);

  return {
    rowNumber,
    username: normalizeUsername_(row[0]),
    passwordHash: row[1] || '',
    fullName: row[2] || '',
    phone: row[3] || '',
    accountStatus: oldFormat ? 'Renting' : row[4] || 'Renting',
    rentalPlace: oldFormat ? inferredRoom.place : row[5] || '',
    roomNumber: oldFormat ? inferredRoom.roomNumber : row[6] || '',
    createdAt: oldFormat ? row[5] || '' : row[7] || '',
    updatedAt: oldFormat ? row[5] || '' : row[8] || '',
    email: oldFormat ? '' : normalizeEmail_(row[9]),
    renterSheetId: oldFormat ? '' : row[10] || '',
    renterSheetUrl: oldFormat ? '' : row[11] || ''
  };
}

function billFromRow_(row, rowNumber) {
  const oldFormat = String(row[0] || '').indexOf('APT-') === 0 || row.length < BILL_HEADERS.length;

  if (oldFormat) {
    const parsedRoom = parseRoom_(row[5] || '');
    const rent = money_(row[7]);
    const waterBill = money_(row[8]);
    const electricityBill = money_(row[9]);

    return {
      rowNumber,
      transactionId: row[0] || '',
      username: normalizeUsername_(row[1]),
      renterName: row[3] || '',
      phone: row[4] || '',
      rentalPlace: parsedRoom.place,
      roomNumber: parsedRoom.roomNumber || row[5] || '',
      billingMonth: row[6] || '',
      billingDate: row[2] || '',
      rent,
      waterBill,
      electricityBill,
      total: money_(row[10]) || rent + waterBill + electricityBill,
      paymentStatus: row[11] || 'Unpaid',
      accountStatus: '',
      notes: row[12] || '',
      createdAt: '',
      updatedAt: ''
    };
  }

  return {
    rowNumber,
    transactionId: row[0] || '',
    username: normalizeUsername_(row[1]),
    renterName: row[2] || '',
    phone: row[3] || '',
    rentalPlace: row[4] || '',
    roomNumber: row[5] || '',
    billingMonth: row[6] || '',
    billingDate: row[7] || '',
    rent: money_(row[8]),
    waterBill: money_(row[9]),
    electricityBill: money_(row[10]),
    total: money_(row[11]),
    paymentStatus: row[12] || 'Unpaid',
    accountStatus: row[13] || '',
    notes: row[14] || '',
    createdAt: row[15] || '',
    updatedAt: row[16] || ''
  };
}

function requestFromRow_(row, rowNumber) {
  return {
    rowNumber,
    requestId: row[0] || '',
    username: normalizeUsername_(row[1]),
    renterName: row[2] || '',
    phone: row[3] || '',
    currentPlace: row[4] || '',
    currentRoom: row[5] || '',
    requestedPlace: row[6] || '',
    requestedRoom: row[7] || '',
    message: row[8] || '',
    status: row[9] || 'Pending',
    createdAt: row[10] || '',
    updatedAt: row[11] || ''
  };
}

function wifiLicenseFromRow_(row, rowNumber) {
  return {
    rowNumber,
    wifiConName: row[0] || '',
    licenseId: row[1] || '',
    createdAt: row[2] || '',
    updatedAt: row[3] || ''
  };
}

function ensureRenterSpreadsheet_(renter) {
  if (renter.renterSheetId) {
    return {
      id: renter.renterSheetId,
      url: renter.renterSheetUrl || `https://docs.google.com/spreadsheets/d/${renter.renterSheetId}/edit`
    };
  }

  if (!renter.email) {
    throw new Error('Renter email is required to create a private spreadsheet.');
  }

  const spreadsheet = SpreadsheetApp.create(`${renter.username}_rent`);
  const file = DriveApp.getFileById(spreadsheet.getId());
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  file.setShareableByEditors(false);
  DATABASE_EDITOR_EMAILS.forEach(email => file.addEditor(email));
  file.addViewer(renter.email);

  return {
    id: spreadsheet.getId(),
    url: spreadsheet.getUrl()
  };
}

function provisionRenterSpreadsheet_(renter) {
  if (!renter || !renter.email) return renter;

  if (!renter.renterSheetId) {
    const renterSheet = ensureRenterSpreadsheet_(renter);
    const sheet = sheet_(RENTERS_SHEET, RENTER_HEADERS);
    sheet.getRange(renter.rowNumber, 11, 1, 2).setValues([[renterSheet.id, renterSheet.url]]);
    renter = getRenterByUsername_(renter.username);
  }

  syncRenterSpreadsheet_(renter);
  return renter;
}

function syncRenterSpreadsheet_(renter) {
  if (!renter || !renter.renterSheetId) return;

  const spreadsheet = SpreadsheetApp.openById(renter.renterSheetId);
  const file = DriveApp.getFileById(renter.renterSheetId);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  file.setShareableByEditors(false);
  pruneFileAccess_(file, renter.email);
  DATABASE_EDITOR_EMAILS.forEach(email => file.addEditor(email));
  if (renter.email) {
    file.addViewer(renter.email);
  }

  const profile = getOrCreateSheet_(spreadsheet, 'Profile');
  profile.clearContents();
  profile.getRange(1, 1, 1, RENTER_PROFILE_HEADERS.length).setValues([RENTER_PROFILE_HEADERS]);
  profile.getRange(2, 1, 8, 2).setValues([
    ['Username', renter.username],
    ['Full Name', renter.fullName],
    ['Email', renter.email],
    ['Phone', renter.phone],
    ['Account Status', renter.accountStatus],
    ['Rental Place', renter.rentalPlace],
    ['Room Number', renter.roomNumber],
    ['Updated At', now_()]
  ]);
  profile.setFrozenRows(1);

  const ledger = getOrCreateSheet_(spreadsheet, 'Rent Ledger');
  ledger.clearContents();
  ledger.getRange(1, 1, 1, RENTER_LEDGER_HEADERS.length).setValues([RENTER_LEDGER_HEADERS]);
  const bills = getRenterBills(renter.username).map(bill => [
    bill.transactionId,
    bill.billingMonth,
    bill.billingDate,
    bill.rentalPlace,
    bill.roomNumber,
    bill.rent,
    bill.waterBill,
    bill.electricityBill,
    bill.total,
    bill.paymentStatus,
    bill.notes,
    bill.updatedAt
  ]);
  if (bills.length) {
    ledger.getRange(2, 1, bills.length, RENTER_LEDGER_HEADERS.length).setValues(bills);
  }
  ledger.setFrozenRows(1);
}

function pruneFileAccess_(file, viewerEmail) {
  const allowed = DATABASE_EDITOR_EMAILS.concat(viewerEmail ? [viewerEmail] : []);
  file.getEditors().forEach(user => {
    const email = user.getEmail().toLowerCase();
    if (allowed.indexOf(email) === -1) {
      file.removeEditor(email);
    }
  });
  file.getViewers().forEach(user => {
    const email = user.getEmail().toLowerCase();
    if (allowed.indexOf(email) === -1) {
      file.removeViewer(email);
    }
  });
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function sheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  return sheet;
}

function assertAdmin_(password) {
  if (String(password || '') !== ADMIN_PASSWORD) {
    throw new Error('Invalid admin password.');
  }
}

function assertValidRoom_(rentalPlace, roomNumber) {
  const exists = ROOM_INVENTORY.some(room =>
    room.place === rentalPlace && room.roomNumber === roomNumber
  );

  if (!exists) {
    throw new Error('Choose a valid room.');
  }
}

function normalizeUsername_(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword_(username, password) {
  const text = `${normalizeUsername_(username)}:${password}`;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function money_(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeTransactionId_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${date}-${random}`;
}

function makeRequestId_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REQ-${date}-${random}`;
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function parseRoom_(value) {
  const text = String(value || '').trim();
  const exact = ROOM_INVENTORY.find(room =>
    text === `${room.place} ${room.roomNumber}` ||
    text === `${room.place} - ${room.roomNumber}` ||
    text === room.roomNumber
  );

  if (exact) {
    return exact;
  }

  const place = ROOM_INVENTORY.find(room =>
    text.toLowerCase().indexOf(room.place.toLowerCase()) > -1
  );
  const roomNumber = ROOM_INVENTORY.find(room =>
    text.toLowerCase().indexOf(room.roomNumber.toLowerCase()) > -1
  );

  return {
    place: place ? place.place : '',
    roomNumber: roomNumber ? roomNumber.roomNumber : text
  };
}

function normalizeSignupPayload_(payload) {
  const parsedRoom = parseRoom_(payload.rooms || payload.room || '');
  return {
    username: payload.username,
    password: payload.password,
    fullName: payload.fullName || payload.renterName,
    email: payload.email,
    phone: payload.phone,
    rentalPlace: payload.rentalPlace || parsedRoom.place,
    roomNumber: payload.roomNumber || parsedRoom.roomNumber
  };
}

function normalizeBillingPayload_(payload) {
  const parsedRoom = parseRoom_(payload.roomNumber || payload.room || '');
  return {
    rentalPlace: payload.rentalPlace || parsedRoom.place,
    roomNumber: payload.roomNumber || parsedRoom.roomNumber,
    billingMonth: payload.billingMonth,
    billingDate: payload.billingDate || payload.trackingDate,
    rent: payload.rent,
    waterBill: payload.waterBill,
    electricityBill: payload.electricityBill,
    paymentStatus: payload.paymentStatus || payload.status,
    notes: payload.notes
  };
}
