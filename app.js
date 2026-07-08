import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjddW-JDup7ZIBoNUDaJOQPDgBF3_KWM8",
  authDomain: "ankita-f04c8.firebaseapp.com",
  projectId: "ankita-f04c8",
  storageBucket: "ankita-f04c8.firebasestorage.app",
  messagingSenderId: "455308326153",
  appId: "1:455308326153:web:2401a863b16c38ca3a4fd8",
  measurementId: "G-KFS0ZDR8M0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Mock data has been removed. Data is fetched directly from Cloud Firestore in real-time.


// App State
let transactions = [];
let schedules = [];
let activeFormType = "in"; // 'in' or 'out'
let editingId = null;
let editingSchedId = null;
let kasChartInstance = null;

// DOM Elements
const elements = {
    // Navigation
    navBtnJamaah: document.getElementById("nav-btn-jamaah"),
    navBtnLogin: document.getElementById("nav-btn-login"),
    navBtnLogout: document.getElementById("nav-btn-logout"),
    
    // Views
    jamaahSection: document.getElementById("jamaah-section"),
    adminSection: document.getElementById("admin-section"),
    
    // Modals
    loginModalOverlay: document.getElementById("login-modal-overlay"),
    btnCloseLogin: document.getElementById("btn-close-login"),
    loginForm: document.getElementById("login-form"),
    
    // Stats Displays
    jamaahTotalSaldo: document.getElementById("jamaah-total-saldo"),
    jamaahTotalPemasukan: document.getElementById("jamaah-total-pemasukan"),
    jamaahTotalPengeluaran: document.getElementById("jamaah-total-pengeluaran"),
    
    adminTotalSaldo: document.getElementById("admin-total-saldo"),
    adminTotalPemasukan: document.getElementById("admin-total-pemasukan"),
    adminTotalPengeluaran: document.getElementById("admin-total-pengeluaran"),
    
    // Search & Filters
    jamaahSearch: document.getElementById("jamaah-search"),
    jamaahFilterType: document.getElementById("jamaah-filter-type"),
    adminSearch: document.getElementById("admin-search"),
    adminFilterType: document.getElementById("admin-filter-type"),
    
    // Lists
    jamaahTxList: document.getElementById("jamaah-tx-list"),
    adminTxList: document.getElementById("admin-tx-list"),
    
    // Admin Form
    adminSidebar: document.querySelector(".admin-sidebar"),
    formActionTitle: document.getElementById("form-action-title"),
    txEditId: document.getElementById("tx-edit-id"),
    toggleTypeIn: document.getElementById("toggle-type-in"),
    toggleTypeOut: document.getElementById("toggle-type-out"),
    txForm: document.getElementById("tx-form"),
    txAmount: document.getElementById("tx-amount"),
    txCategory: document.getElementById("tx-category"),
    txDate: document.getElementById("tx-date"),
    txDescription: document.getElementById("tx-description"),
    txContributor: document.getElementById("tx-contributor"),
    btnSubmitForm: document.getElementById("btn-submit-form"),
    btnCancelEdit: document.getElementById("btn-cancel-edit"),
    
    // Extras
    btnExportPdf: document.getElementById("btn-export-pdf"),
    toastContainer: document.getElementById("toast-container")
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initData();
    setupEventListeners();
    
    // Let Firebase Auth handle the login state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            elements.jamaahSection.classList.remove("active");
            elements.adminSection.classList.add("active");
            updateHeaderButtons();
        } else {
            elements.adminSection.classList.remove("active");
            elements.jamaahSection.classList.add("active");
            updateHeaderButtons();
        }
        updateUI();
        updateChart();
    });
});

// Seed and load data
function initData() {
    console.log("Loading data from Firebase...");
    
    // Listen to transactions collection in real-time
    onSnapshot(collection(db, "transactions"), (snapshot) => {
        transactions = [];
        snapshot.forEach((d) => {
            transactions.push({ id: d.id, ...d.data() });
        });
        // Sort transactions by date descending
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        updateUI();
        updateChart();
    }, (error) => {
        console.error("Firestore transactions subscription error:", error);
        showToast("Gagal memuat data transaksi.", "error");
    });

    // Listen to schedules collection in real-time
    onSnapshot(collection(db, "schedules"), (snapshot) => {
        schedules = [];
        snapshot.forEach((d) => {
            schedules.push({ id: d.id, ...d.data() });
        });
        renderJamaahSchedules();
        renderAdminSchedules();
    }, (error) => {
        console.error("Firestore schedules subscription error:", error);
        showToast("Gagal memuat data jadwal.", "error");
    });
    
    // Set default date in form to today
    elements.txDate.value = new Date().toISOString().split("T")[0];
    const schedDateInput = document.getElementById("sched-date");
    if (schedDateInput) {
        schedDateInput.value = new Date().toISOString().split("T")[0];
    }
}

// Setup all click / change / submit listeners
function setupEventListeners() {
    // Navigation / View Swaps
    elements.navBtnLogin.addEventListener("click", () => {
        const loggedIn = auth && auth.currentUser !== null;
        if (loggedIn) {
            elements.jamaahSection.classList.remove("active");
            elements.adminSection.classList.add("active");
            updateHeaderButtons();
        } else {
            elements.loginModalOverlay.classList.add("open");
        }
    });
    
    elements.btnCloseLogin.addEventListener("click", () => {
        elements.loginModalOverlay.classList.remove("open");
    });
    
    elements.navBtnJamaah.addEventListener("click", () => {
        elements.adminSection.classList.remove("active");
        elements.jamaahSection.classList.add("active");
        updateHeaderButtons();
    });
    
    elements.navBtnLogout.addEventListener("click", logout);
    
    // Login Submission
    elements.loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const emailOrUser = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        
        // Show loading state
        const submitBtn = elements.loginForm.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...';
        
        signInWithEmailAndPassword(auth, emailOrUser, password)
            .then((userCredential) => {
                login();
            })
            .catch((error) => {
                console.error("Firebase Login Error:", error);
                let errMsg = "Email atau Password salah!";
                if (error.code === "auth/invalid-credential") {
                    errMsg = "Email atau Password salah!";
                } else if (error.code === "auth/too-many-requests") {
                    errMsg = "Terlalu banyak percobaan masuk. Silakan coba lagi nanti.";
                }
                showToast(errMsg, "error");
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            });
    });
    
    // Search and Filter Listeners
    elements.jamaahSearch.addEventListener("input", filterJamaahTransactions);
    elements.jamaahFilterType.addEventListener("change", filterJamaahTransactions);
    
    elements.adminSearch.addEventListener("input", filterAdminTransactions);
    elements.adminFilterType.addEventListener("change", filterAdminTransactions);
    
    // Form Submission (Add / Edit)
    elements.txForm.addEventListener("submit", handleFormSubmit);
    
    // Export to PDF
    elements.btnExportPdf.addEventListener("click", exportToPDF);

    // Schedule Form Submission
    const schedForm = document.getElementById("sched-form");
    if (schedForm) {
        schedForm.addEventListener("submit", handleSchedFormSubmit);
    }
    
    // Admin Tab Switching Listeners
    const tabBtnTx = document.getElementById("tab-btn-tx");
    const tabBtnSched = document.getElementById("tab-btn-sched");
    const gridTx = document.getElementById("admin-tx-grid");
    const gridSched = document.getElementById("admin-sched-grid");
    
    if (tabBtnTx && tabBtnSched && gridTx && gridSched) {
        tabBtnTx.addEventListener("click", () => {
            tabBtnTx.classList.add("active");
            tabBtnSched.classList.remove("active");
            gridTx.style.display = "grid";
            gridSched.style.display = "none";
        });
        
        tabBtnSched.addEventListener("click", () => {
            tabBtnSched.classList.add("active");
            tabBtnTx.classList.remove("active");
            gridTx.style.display = "none";
            gridSched.style.display = "grid";
        });
    }

    // Map Search Helper Button
    const btnSearchMap = document.getElementById("btn-search-map");
    if (btnSearchMap) {
        btnSearchMap.addEventListener("click", () => {
            const locationVal = document.getElementById("sched-location").value.trim();
            if (!locationVal) {
                showToast("Harap isi Lokasi / Tempat terlebih dahulu untuk mencari!", "error");
                return;
            }
            const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationVal)}`;
            window.open(searchUrl, "_blank");
        });
    }

    // Form Toggle Buttons
    const toggleIn = document.getElementById("toggle-type-in");
    const toggleOut = document.getElementById("toggle-type-out");
    if (toggleIn && toggleOut) {
        toggleIn.addEventListener("click", () => setFormType('in'));
        toggleOut.addEventListener("click", () => setFormType('out'));
    }

    // Cancel Buttons
    if (elements.btnCancelEdit) {
        elements.btnCancelEdit.addEventListener("click", resetForm);
    }
    const btnCancelSchedEdit = document.getElementById("btn-cancel-sched-edit");
    if (btnCancelSchedEdit) {
        btnCancelSchedEdit.addEventListener("click", resetSchedForm);
    }

    // Event Delegation for Admin Transactions List
    if (elements.adminTxList) {
        elements.adminTxList.addEventListener("click", (e) => {
            const editBtn = e.target.closest(".edit-tx-btn");
            const deleteBtn = e.target.closest(".delete-tx-btn");
            if (editBtn) {
                const id = editBtn.dataset.id;
                startEditTransaction(id);
            } else if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (!deleteBtn.classList.contains("confirm-active")) {
                    // Step 1: Request confirmation
                    document.querySelectorAll(".delete").forEach(btn => {
                        btn.classList.remove("confirm-active");
                        btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Hapus`;
                    });
                    deleteBtn.classList.add("confirm-active");
                    deleteBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Yakin?`;
                    
                    // Auto-reset after 3 seconds
                    setTimeout(() => {
                        if (deleteBtn.classList.contains("confirm-active")) {
                            deleteBtn.classList.remove("confirm-active");
                            deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Hapus`;
                        }
                    }, 3000);
                } else {
                    // Step 2: Delete confirmed
                    deleteTransaction(id);
                }
            }
        });
    }

    // Event Delegation for Admin Schedules List
    const adminSchedList = document.getElementById("admin-sched-list");
    if (adminSchedList) {
        adminSchedList.addEventListener("click", (e) => {
            const completeBtn = e.target.closest(".complete-sched-btn");
            const editBtn = e.target.closest(".edit-sched-btn");
            const deleteBtn = e.target.closest(".delete-sched-btn");
            if (completeBtn) {
                const id = completeBtn.dataset.id;
                markScheduleAsCompleted(id);
            } else if (editBtn) {
                const id = editBtn.dataset.id;
                startEditSchedule(id);
            } else if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (!deleteBtn.classList.contains("confirm-active")) {
                    // Step 1: Request confirmation
                    document.querySelectorAll(".delete").forEach(btn => {
                        btn.classList.remove("confirm-active");
                        btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Hapus`;
                    });
                    deleteBtn.classList.add("confirm-active");
                    deleteBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Yakin?`;
                    
                    // Auto-reset after 3 seconds
                    setTimeout(() => {
                        if (deleteBtn.classList.contains("confirm-active")) {
                            deleteBtn.classList.remove("confirm-active");
                            deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Hapus`;
                        }
                    }, 3000);
                } else {
                    // Step 2: Delete confirmed
                    deleteSchedule(id);
                }
            }
        });
    }

    // Budget Pending Checkbox Toggle
    const budgetPendingCheck = document.getElementById("sched-budget-pending");
    const budgetInput = document.getElementById("sched-budget");
    if (budgetPendingCheck && budgetInput) {
        budgetPendingCheck.addEventListener("change", () => {
            budgetInput.disabled = budgetPendingCheck.checked;
            if (budgetPendingCheck.checked) {
                budgetInput.value = "";
            }
        });
    }

    // Ensure date/time inputs open their pickers when clicked or focused
    const dateInputs = document.querySelectorAll('input[type="date"], input[type="time"]');
    dateInputs.forEach(input => {
        const handler = () => {
            try {
                input.showPicker();
            } catch (e) {
                console.warn("showPicker is not supported or failed:", e);
            }
        };
        input.addEventListener("click", handler);
        input.addEventListener("focus", handler);
    });
}

// Helper to format numbers as Indonesian Rupiah
function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

// Update statistics and render lists
function updateUI() {
    // Calc stats
    let totalSaldo = 0;
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    
    transactions.forEach(tx => {
        const amt = parseFloat(tx.amount);
        if (tx.type === "in") {
            totalPemasukan += amt;
            totalSaldo += amt;
        } else {
            totalPengeluaran += amt;
            totalSaldo -= amt;
        }
    });
    
    // Format and output
    const formattedSaldo = formatRupiah(totalSaldo);
    const formattedPemasukan = formatRupiah(totalPemasukan);
    const formattedPengeluaran = formatRupiah(totalPengeluaran);
    
    elements.jamaahTotalSaldo.textContent = formattedSaldo;
    elements.jamaahTotalPemasukan.textContent = formattedPemasukan;
    elements.jamaahTotalPengeluaran.textContent = formattedPengeluaran;
    
    elements.adminTotalSaldo.textContent = formattedSaldo;
    elements.adminTotalPemasukan.textContent = formattedPemasukan;
    elements.adminTotalPengeluaran.textContent = formattedPengeluaran;
    
    // Render transactions lists
    filterJamaahTransactions();
    filterAdminTransactions();

    // Render schedules lists
    renderJamaahSchedules();
    renderAdminSchedules();
}

// Authentication Logic
function login() {
    elements.loginModalOverlay.classList.remove("open");
    elements.loginForm.reset();
    
    showToast("Berhasil login sebagai Admin!", "success");
    updateHeaderButtons();
    updateChart();
}

function logout() {
    signOut(auth)
        .then(() => {
            showToast("Anda telah keluar dari dashboard admin.", "success");
        })
        .catch((error) => {
            console.error("Firebase SignOut Error:", error);
            showToast("Gagal keluar. Coba lagi.", "error");
        });
}

function updateHeaderButtons() {
    const isCurrentlyAdmin = elements.adminSection.classList.contains("active");
    const loggedIn = auth && auth.currentUser !== null;
    
    if (loggedIn) {
        if (isCurrentlyAdmin) {
            elements.navBtnJamaah.style.display = "inline-flex";
            elements.navBtnLogin.style.display = "none";
            elements.navBtnLogout.style.display = "inline-flex";
        } else {
            elements.navBtnJamaah.style.display = "none";
            elements.navBtnLogin.innerHTML = `<i class="fa-solid fa-screwdriver-wrench"></i> Dashboard Admin`;
            elements.navBtnLogin.style.display = "inline-flex";
            elements.navBtnLogout.style.display = "inline-flex";
        }
    } else {
        // Not logged in
        elements.navBtnJamaah.style.display = "none";
        elements.navBtnLogin.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Dashboard Admin`;
        elements.navBtnLogin.style.display = "inline-flex";
        elements.navBtnLogout.style.display = "none";
    }
}

// Set form type (Pemasukan vs Pengeluaran toggle)
function setFormType(type) {
    activeFormType = type;
    if (type === "in") {
        elements.toggleTypeIn.classList.add("active");
        elements.toggleTypeOut.classList.remove("active");
    } else {
        elements.toggleTypeOut.classList.add("active");
        elements.toggleTypeIn.classList.remove("active");
    }
}

// Handle Form Submission (Add or Edit)
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(elements.txAmount.value);
    const category = elements.txCategory.value.trim();
    const date = elements.txDate.value;
    const description = elements.txDescription.value.trim();
    const contributor = elements.txContributor.value.trim();
    
    if (amount <= 0 || !category || !date || !description || !contributor) {
        showToast("Harap isi semua kolom dengan benar!", "error");
        return;
    }
    
    const submitBtn = elements.btnSubmitForm;
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menyimpan...';
    
    try {
        if (editingId) {
            const txRef = doc(db, "transactions", editingId);
            await updateDoc(txRef, {
                type: activeFormType,
                amount,
                category,
                date,
                description,
                contributor
            });
            showToast("Transaksi berhasil diperbarui!", "success");
        } else {
            await addDoc(collection(db, "transactions"), {
                type: activeFormType,
                amount,
                category,
                date,
                description,
                contributor
            });
            showToast("Transaksi baru berhasil disimpan!", "success");
        }
        resetForm();
    } catch (error) {
        console.error("Firestore Save Error:", error);
        showToast("Gagal menyimpan ke database cloud.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Populate form for editing
function startEditTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    editingId = id;
    elements.formActionTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Ubah Transaksi`;
    setFormType(tx.type);
    
    elements.txAmount.value = tx.amount;
    elements.txCategory.value = tx.category;
    elements.txDate.value = tx.date;
    elements.txDescription.value = tx.description;
    elements.txContributor.value = tx.contributor;
    
    elements.btnCancelEdit.style.display = "inline-flex";
    elements.btnSubmitForm.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
    
    // Scroll to the sidebar form on small devices
    elements.adminSidebar.scrollIntoView({ behavior: 'smooth' });
}

// Delete transaction
async function deleteTransaction(id) {
    try {
        const txRef = doc(db, "transactions", id);
        await deleteDoc(txRef);
        showToast("Transaksi berhasil dihapus.", "success");
        if (editingId === id) {
            resetForm();
        }
    } catch (error) {
        console.error("Firestore Delete Error:", error);
        showToast("Gagal menghapus transaksi dari database cloud.", "error");
    }
}

// Reset form to default state
function resetForm() {
    editingId = null;
    elements.formActionTitle.innerHTML = `<i class="fa-solid fa-folder-plus"></i> Tambah Transaksi`;
    setFormType("in");
    elements.txForm.reset();
    elements.txDate.value = new Date().toISOString().split("T")[0];
    elements.btnCancelEdit.style.display = "none";
    elements.btnSubmitForm.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
}

// Render list of transactions for Jamaah section
function filterJamaahTransactions() {
    const query = elements.jamaahSearch.value.toLowerCase();
    const typeFilter = elements.jamaahFilterType.value;
    
    const filtered = transactions.filter(tx => {
        const matchesQuery = tx.description.toLowerCase().includes(query) || 
                             tx.category.toLowerCase().includes(query) || 
                             tx.contributor.toLowerCase().includes(query);
        const matchesType = typeFilter === "all" || tx.type === typeFilter;
        return matchesQuery && matchesType;
    });
    
    renderTxList(filtered, elements.jamaahTxList, false);
}

// Render list of transactions for Admin section
function filterAdminTransactions() {
    const query = elements.adminSearch.value.toLowerCase();
    const typeFilter = elements.adminFilterType.value;
    
    const filtered = transactions.filter(tx => {
        const matchesQuery = tx.description.toLowerCase().includes(query) || 
                             tx.category.toLowerCase().includes(query) || 
                             tx.contributor.toLowerCase().includes(query);
        const matchesType = typeFilter === "all" || tx.type === typeFilter;
        return matchesQuery && matchesType;
    });
    
    renderTxList(filtered, elements.adminTxList, true);
}

// Generic Render Transaction List Function
function renderTxList(txArray, containerElement, isAdmin = false) {
    containerElement.innerHTML = "";
    
    if (txArray.length === 0) {
        containerElement.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="fa-solid fa-circle-question" style="font-size: 28px; margin-bottom: 10px;"></i>
                <p>Tidak ada transaksi yang cocok.</p>
            </div>
        `;
        return;
    }
    
    txArray.forEach(tx => {
        // Date formatting: e.g. "Sabtu, 15 Jun 2026"
        let formattedDate = tx.date;
        if (tx.date) {
            const parts = tx.date.split("-");
            if (parts.length === 3) {
                const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
                formattedDate = dateObj.toLocaleDateString('id-ID', options);
            }
        }
        
        const isIncome = tx.type === "in";
        const symbol = isIncome ? "+" : "-";
        const badgeClass = isIncome ? "in" : "out";
        const amountClass = isIncome ? "in" : "out";
        const icon = isIncome ? "fa-circle-arrow-down" : "fa-circle-arrow-up";
        
        const item = document.createElement("div");
        item.className = "transaction-item";
        
        let actionButtons = "";
        if (isAdmin) {
            actionButtons = `
                <div class="tx-actions">
                    <button class="tx-action-btn edit-tx-btn" data-id="${tx.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="tx-action-btn delete-tx-btn delete" data-id="${tx.id}">
                        <i class="fa-solid fa-trash-can"></i> Hapus
                    </button>
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="tx-left">
                <div class="tx-badge ${badgeClass}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="tx-details">
                    <h5>${tx.description}</h5>
                    <p><i class="fa-solid fa-tag"></i> ${tx.category}</p>
                    <span class="tx-contributor"><i class="fa-solid fa-user"></i> ${tx.contributor}</span>
                </div>
            </div>
            <div class="tx-right">
                <div class="tx-amount ${amountClass}">${symbol} ${formatRupiah(tx.amount)}</div>
                <div class="tx-date">${formattedDate}</div>
                ${actionButtons}
            </div>
        `;
        
        containerElement.appendChild(item);
    });
}

// Notification System (Toasts)
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto-remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.add("fadeOut");
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 3500);
}

// Data Export (PDF)
function exportToPDF() {
    if (transactions.length === 0) {
        showToast("Tidak ada data transaksi untuk diekspor!", "error");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Laporan Kas Hadrah Nurul Ali", 14, 22);
    doc.setFontSize(11);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 30);
    
    const tableColumn = ["Tipe", "Nominal (Rp)", "Kategori", "Tanggal", "Keterangan", "Donatur/PJ"];
    const tableRows = [];
    
    const monthlySummary = {};
    
    transactions.forEach(tx => {
        const typeStr = tx.type === "in" ? "Pemasukan" : "Pengeluaran";
        
        // Format amount: e.g. 50000 -> 50.000
        const formattedAmount = tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        const txData = [
            typeStr,
            formattedAmount,
            tx.category,
            tx.date,
            tx.description,
            tx.contributor
        ];
        tableRows.push(txData);
        
        // Calculate monthly summary
        if (tx.date) {
            const [year, month] = tx.date.split("-");
            if (year && month) {
                const monthKey = `${year}-${month}`; // e.g. "2026-07"
                if (!monthlySummary[monthKey]) {
                    monthlySummary[monthKey] = { in: 0, out: 0 };
                }
                const amt = parseFloat(tx.amount) || 0;
                if (tx.type === "in") {
                    monthlySummary[monthKey].in += amt;
                } else {
                    monthlySummary[monthKey].out += amt;
                }
            }
        }
    });
    
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    // Monthly Summary Table
    const summaryColumn = ["Bulan", "Total Pemasukan (Rp)", "Total Pengeluaran (Rp)", "Saldo (Rp)"];
    const summaryRows = [];
    const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const sortedMonths = Object.keys(monthlySummary).sort();
    
    sortedMonths.forEach(key => {
        const [year, month] = key.split("-");
        const monthName = `${monthNames[parseInt(month, 10)]} ${year}`;
        const data = monthlySummary[key];
        const saldo = data.in - data.out;
        
        const fmtIn = data.in.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const fmtOut = data.out.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const fmtSaldo = saldo.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        summaryRows.push([monthName, fmtIn, fmtOut, fmtSaldo]);
    });
    
    if (summaryRows.length > 0) {
        const finalY = doc.lastAutoTable.finalY || 40;
        
        doc.setFontSize(12);
        doc.text("Rekapitulasi per Bulan", 14, finalY + 15);
        
        doc.autoTable({
            head: [summaryColumn],
            body: summaryRows,
            startY: finalY + 20,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [44, 62, 80] }
        });
    }
    
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`Laporan_Kas_Hadrah_Nurul_Ali_${dateStr}.pdf`);
    
    showToast("File laporan PDF berhasil diunduh!", "success");
}

// Chart.js Visualization Integration
function initChart() {
    const canvas = document.getElementById("kasChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Aggregate data for the last 4 months
    const aggregated = getAggregatedChartData();
    
    kasChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: aggregated.labels,
            datasets: [
                {
                    label: 'Pemasukan (Rp)',
                    data: aggregated.income,
                    backgroundColor: 'rgba(16, 185, 129, 0.65)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Pengeluaran (Rp)',
                    data: aggregated.expenses,
                    backgroundColor: 'rgba(239, 68, 68, 0.65)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Kumulatif Saldo (Rp)',
                    data: aggregated.balance,
                    type: 'line',
                    borderColor: 'rgba(223, 179, 61, 1)',
                    backgroundColor: 'rgba(223, 179, 61, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: 'rgba(223, 179, 61, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.35,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: {
                            family: 'Plus Jakarta Sans',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatRupiah(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            family: 'Plus Jakarta Sans'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            family: 'Plus Jakarta Sans'
                        },
                        callback: function(value) {
                            return formatRupiah(value);
                        }
                    }
                }
            }
        }
    });
}

// Redraw chart when transactions change
function updateChart() {
    if (!kasChartInstance) return;
    
    const aggregated = getAggregatedChartData();
    
    kasChartInstance.data.labels = aggregated.labels;
    kasChartInstance.data.datasets[0].data = aggregated.income;
    kasChartInstance.data.datasets[1].data = aggregated.expenses;
    kasChartInstance.data.datasets[2].data = aggregated.balance;
    
    kasChartInstance.update();
}

// Calculate chart values by month
function getAggregatedChartData() {
    // We want the last 4 calendar months (relative to transaction dates)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    
    // Find unique year-months present in transactions or just get last 4 calendar months
    // Let's build last 4 calendar months including current local month
    const monthsToTrack = [];
    const today = new Date();
    
    for (let i = 3; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthsToTrack.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        });
    }
    
    // Sort transactions chronologically to calculate running balance correctly
    const cronTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate totals for each month in scope
    const incomeData = [];
    const expenseData = [];
    const balanceData = [];
    
    let runningBalance = 0;
    
    monthsToTrack.forEach(m => {
        let monthlyIncome = 0;
        let monthlyExpense = 0;
        
        // Filter transactions for this month
        cronTx.forEach(tx => {
            const txDateObj = new Date(tx.date);
            const txYear = txDateObj.getFullYear();
            const txMonth = txDateObj.getMonth();
            const txAmt = parseFloat(tx.amount);
            
            // Check if transaction dates are equal or prior to this month to compute balance
            if (txYear < m.year || (txYear === m.year && txMonth <= m.month)) {
                // If it is EXACTLY this month, add to monthly totals
                if (txYear === m.year && txMonth === m.month) {
                    if (tx.type === "in") {
                        monthlyIncome += txAmt;
                    } else {
                        monthlyExpense += txAmt;
                    }
                }
            }
        });
        
        // Cumulative balance up to the end of this month
        let cumulativeBal = 0;
        cronTx.forEach(tx => {
            const txDateObj = new Date(tx.date);
            const txYear = txDateObj.getFullYear();
            const txMonth = txDateObj.getMonth();
            const txAmt = parseFloat(tx.amount);
            
            if (txYear < m.year || (txYear === m.year && txMonth <= m.month)) {
                if (tx.type === "in") {
                    cumulativeBal += txAmt;
                } else {
                    cumulativeBal -= txAmt;
                }
            }
        });
        
        incomeData.push(monthlyIncome);
        expenseData.push(monthlyExpense);
        balanceData.push(cumulativeBal);
    });
    
    return {
        labels: monthsToTrack.map(m => m.label),
        income: incomeData,
        expenses: expenseData,
        balance: balanceData
    };
}

// ==================== DYNAMIC SCHEDULE MANAGEMENT ====================

// Helper function to resolve schedule map URL, falling back to search query if empty or using dummy placeholders
function getScheduleMapUrl(s) {
    if (!s.mapUrl || s.mapUrl.includes("3ZJ7fG1a2b3c4d5e") || s.mapUrl.includes("9Y8x7w6v5u4t3s2r") || s.mapUrl.trim() === "") {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`;
    }
    return s.mapUrl;
}

// Render Jamaah Schedules dynamically
function renderJamaahSchedules() {
    const container = document.getElementById("jamaah-sched-list");
    if (!container) return;
    container.innerHTML = "";
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 25px; color: var(--text-muted);">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 28px; margin-bottom: 10px;"></i>
                <p>Belum ada jadwal undangan saat ini.</p>
            </div>
        `;
        return;
    }
    
    // Sort schedules chronologically by date
    const sortedSchedules = [...schedules].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedSchedules.forEach(s => {
        const badgeClass = s.status === "completed" ? "status-completed" : "status-upcoming";
        const badgeLabel = s.status === "completed" ? "Selesai" : "Mendatang";
        
        let formattedDate = "";
        if (s.date) {
            const parts = s.date.split("-");
            if (parts.length === 3) {
                const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
                formattedDate = dateObj.toLocaleDateString('id-ID', options);
            }
        }
        
        // Location mapping link (always clickable, fallback to Google Maps search)
        const mapUrl = getScheduleMapUrl(s);
        const locationHTML = `
            <a href="${mapUrl}" target="_blank" class="schedule-map-link">
                <i class="fa-solid fa-map-location-dot"></i> ${s.location} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i>
            </a>
        `;
        
        const item = document.createElement("div");
        item.className = "schedule-item";

        // Budget display
        const budgetHTML = s.budgetPending
            ? `<span class="sched-budget pending"><i class="fa-solid fa-hourglass-half"></i> Budget: Pending</span>`
            : (s.budget && s.budget > 0)
                ? `<span class="sched-budget confirmed"><i class="fa-solid fa-money-bill-wave"></i> Budget: ${formatRupiah(s.budget)}</span>`
                : "";

        item.innerHTML = `
            <div class="schedule-meta">
                <div>
                    <div class="schedule-day">${s.day}</div>
                    <div class="schedule-date-label" style="font-size: 11px; color: var(--text-secondary); text-align: center; margin-top: 5px; font-weight: 600;">${formattedDate}</div>
                </div>
                <span class="status-badge ${badgeClass}">${badgeLabel}</span>
            </div>
            <div class="schedule-content">
                <div class="schedule-desc">${s.desc}</div>
                <div class="schedule-time">
                    <span class="schedule-time-item">
                        <i class="fa-solid fa-clock"></i> ${formatScheduleTime(s.time)}
                    </span>
                    ${locationHTML}
                </div>
                ${budgetHTML}
            </div>
        `;
        container.appendChild(item);
    });
}

// Render Admin Schedules dynamically
function renderAdminSchedules() {
    const container = document.getElementById("admin-sched-list");
    if (!container) return;
    container.innerHTML = "";
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 28px; margin-bottom: 10px;"></i>
                <p>Belum ada jadwal undangan saat ini.</p>
            </div>
        `;
        return;
    }
    
    // Sort schedules chronologically by date
    const sortedSchedules = [...schedules].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedSchedules.forEach(s => {
        const badgeClass = s.status === "completed" ? "status-completed" : "status-upcoming";
        const badgeLabel = s.status === "completed" ? "Selesai" : "Mendatang";
        
        let formattedDate = "";
        if (s.date) {
            const parts = s.date.split("-");
            if (parts.length === 3) {
                const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
                formattedDate = dateObj.toLocaleDateString('id-ID', options);
            }
        }
        
        // Location mapping HTML (always clickable, fallback to Google Maps search)
        const mapUrl = getScheduleMapUrl(s);
        const locationHTML = `
            <a href="${mapUrl}" target="_blank" class="schedule-map-link" style="margin-top: 4px; display: inline-flex;">
                <i class="fa-solid fa-map-location-dot"></i> ${s.location} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px; margin-left: 2px;"></i>
            </a>
        `;
        
        // Selesai button is only shown if not completed yet
        const completeBtn = s.status !== "completed" ? `
            <button class="tx-action-btn complete-sched-btn" data-id="${s.id}" style="color: var(--accent-emerald); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">
                <i class="fa-solid fa-circle-check"></i> Selesai
            </button>
        ` : "";
        
        // Budget display in admin list
        const budgetAdminHTML = s.budgetPending
            ? `<span class="sched-budget pending"><i class="fa-solid fa-hourglass-half"></i> Budget: Pending</span>`
            : (s.budget && s.budget > 0)
                ? `<span class="sched-budget confirmed"><i class="fa-solid fa-money-bill-wave"></i> Budget: ${formatRupiah(s.budget)}</span>`
                : `<span class="sched-budget none"><i class="fa-solid fa-circle-minus"></i> Budget: -</span>`;

        const item = document.createElement("div");
        item.className = "transaction-item";
        item.innerHTML = `
            <div class="tx-left">
                <div>
                    <div class="schedule-day" style="min-width: 68px;">${s.day}</div>
                    <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 4px; font-weight: 500;">${formattedDate}</div>
                </div>
                <div class="tx-details">
                    <h5>${s.desc}</h5>
                    <p><i class="fa-solid fa-clock"></i> ${formatScheduleTime(s.time)}</p>
                    ${locationHTML}
                    ${budgetAdminHTML}
                </div>
            </div>
            <div class="tx-right">
                <div>
                    <span class="status-badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div class="tx-actions">
                    ${completeBtn}
                    <button class="tx-action-btn edit-sched-btn" data-id="${s.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="tx-action-btn delete-sched-btn delete" data-id="${s.id}">
                        <i class="fa-solid fa-trash-can"></i> Hapus
                    </button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Start editing a schedule item
function startEditSchedule(id) {
    const s = schedules.find(item => item.id === id);
    if (!s) return;
    
    editingSchedId = id;
    document.getElementById("sched-form-title").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Ubah Jadwal`;
    
    document.getElementById("sched-date").value = s.date || "";
    document.getElementById("sched-status").value = s.status;
    document.getElementById("sched-desc").value = s.desc;
    document.getElementById("sched-time").value = parseRawTime(s.time);
    document.getElementById("sched-location").value = s.location;
    document.getElementById("sched-map-url").value = s.mapUrl || "";
    
    // Populate budget fields
    const budgetPendingCheck = document.getElementById("sched-budget-pending");
    const budgetInput = document.getElementById("sched-budget");
    if (budgetPendingCheck && budgetInput) {
        budgetPendingCheck.checked = s.budgetPending || false;
        budgetInput.value = (!s.budgetPending && s.budget) ? s.budget : "";
        budgetInput.disabled = s.budgetPending || false;
    }
    
    document.getElementById("btn-cancel-sched-edit").style.display = "inline-flex";
    document.getElementById("btn-submit-sched").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
    
    // Scroll to form container
    document.getElementById("admin-sched-grid").querySelector(".admin-sidebar").scrollIntoView({ behavior: 'smooth' });
}

// Delete a schedule item
async function deleteSchedule(id) {
    try {
        const schedRef = doc(db, "schedules", id);
        await deleteDoc(schedRef);
        showToast("Jadwal undangan berhasil dihapus.", "success");
        if (editingSchedId === id) {
            resetSchedForm();
        }
    } catch (error) {
        console.error("Firestore Schedule Delete Error:", error);
        showToast("Gagal menghapus jadwal dari database cloud.", "error");
    }
}

// Mark schedule as completed
async function markScheduleAsCompleted(id) {
    try {
        const s = schedules.find(item => item.id === id);
        if (!s) {
            showToast("Jadwal tidak ditemukan.", "error");
            return;
        }
        
        if (s.status === "completed") {
            showToast("Jadwal ini sudah ditandai selesai.", "info");
            return;
        }

        const schedRef = doc(db, "schedules", id);
        await updateDoc(schedRef, {
            status: "completed"
        });

        // Automatically record to transactions if budget is set and not pending
        if (s.budget && s.budget > 0 && !s.budgetPending) {
            await addDoc(collection(db, "transactions"), {
                type: "in",
                amount: s.budget,
                category: "Manggung / Sholawatan",
                date: s.date || new Date().toISOString().split("T")[0],
                description: `Bisyaroh dari: ${s.desc} di ${s.location}`,
                contributor: "Sohibul Hajat / Undangan"
            });
            showToast("Jadwal ditandai Selesai & Pemasukan otomatis dicatat!", "success");
        } else {
            showToast("Jadwal ditandai sebagai Selesai!", "success");
        }
    } catch (error) {
        console.error("Firestore Schedule Mark Completed Error:", error);
        showToast("Gagal memperbarui status jadwal.", "error");
    }
}

// Helper function to get Indonesian weekday name from YYYY-MM-DD
function getIndonesianDayName(dateString) {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length !== 3) return "";
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
}

// Handle schedule form submission (Add or Edit)
async function handleSchedFormSubmit(e) {
    e.preventDefault();
    
    const date = document.getElementById("sched-date").value;
    const day = getIndonesianDayName(date);
    const status = document.getElementById("sched-status").value;
    const desc = document.getElementById("sched-desc").value.trim();
    const time = document.getElementById("sched-time").value.trim();
    const location = document.getElementById("sched-location").value.trim();
    const mapUrl = document.getElementById("sched-map-url").value.trim();
    
    // Budget fields
    const budgetPendingEl = document.getElementById("sched-budget-pending");
    const budgetEl = document.getElementById("sched-budget");
    const budgetPending = budgetPendingEl ? budgetPendingEl.checked : false;
    const budget = (!budgetPending && budgetEl && budgetEl.value) ? parseFloat(budgetEl.value) : 0;
    
    if (!date || !status || !desc || !time || !location) {
        showToast("Harap isi semua kolom dengan benar!", "error");
        return;
    }
    
    const submitBtn = document.getElementById("btn-submit-sched");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menyimpan...';
    
    try {
        if (editingSchedId) {
            const schedRef = doc(db, "schedules", editingSchedId);
            await updateDoc(schedRef, {
                day, date, status, desc, time, location, mapUrl,
                budget, budgetPending
            });
            showToast("Jadwal undangan berhasil diperbarui!", "success");
        } else {
            await addDoc(collection(db, "schedules"), {
                day, date, status, desc, time, location, mapUrl,
                budget, budgetPending
            });
            showToast("Jadwal undangan baru berhasil disimpan!", "success");
        }
        resetSchedForm();
    } catch (error) {
        console.error("Firestore Schedule Save Error:", error);
        showToast("Gagal menyimpan ke database cloud.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Reset schedule form to default
function resetSchedForm() {
    editingSchedId = null;
    document.getElementById("sched-form-title").innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Tambah Jadwal`;
    document.getElementById("sched-form").reset();
    document.getElementById("sched-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("sched-map-url").value = "";
    document.getElementById("btn-cancel-sched-edit").style.display = "none";
    document.getElementById("btn-submit-sched").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
    
    // Reset budget fields
    const budgetPendingEl = document.getElementById("sched-budget-pending");
    const budgetInput = document.getElementById("sched-budget");
    if (budgetPendingEl) budgetPendingEl.checked = false;
    if (budgetInput) {
        budgetInput.value = "";
        budgetInput.disabled = false;
    }
}

// Format schedule time string for display (e.g. "19:30" -> "19.30 WIB - Selesai")
function formatScheduleTime(timeStr) {
    if (!timeStr) return "";
    // Compatibility fallback if it's already formatted
    if (timeStr.includes("WIB")) return timeStr;
    
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]} WIB - Selesai`;
    }
    return timeStr;
}

// Parse raw time string to populating browser time input (e.g. "19.30 WIB - Selesai" -> "19:30")
function parseRawTime(timeStr) {
    if (!timeStr) return "19:30";
    // If it is already in format HH:MM
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    
    const match = timeStr.match(/^(\d{2})[.:](\d{2})/);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    return "19:30";
}
