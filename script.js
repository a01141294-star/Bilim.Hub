
/* =====================================
   BILIM.HUB — APPLICATION
   Supabase + Login + Dashboard
   Student management + Delete
===================================== */

/* 1. SUPABASE */

const SUPABASE_URL = "https://jtzldhrbtzbundkjvznh.supabase.co";
const SUPABASE_KEY = "sb_publishable_uGvgyHNizyh9ON_12PQLWA_fLfm6Oln";

if (!window.supabase) {
    throw new Error("Supabase kutubxonasi yuklanmadi.");
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let selectedRole = null;
let selectedStudentGrade = "all";
let studentSearchQuery = "";
let cachedStudents = [];

const $ = id => document.getElementById(id);
const GRADES = [5, 6, 7, 8, 9, 10, 11];


/* 2. SCREEN SWITCH */

function showSection(id) {
    [
        "homeSection",
        "loginSection",
        "studentCabinet",
        "adminCabinet"
    ].forEach(sectionId => {
        const section = $(sectionId);
        if (section) section.classList.add("hidden");
    });

    const target = $(id);

    if (target) {
        target.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "instant" });
    }
}


/* 3. ROLE SELECTION */

function selectRole(role) {
    selectedRole = role;

    if ($("loginTitle")) {
        $("loginTitle").textContent =
            role === "student"
                ? "O'quvchi kabineti"
                : "Ustoz kabineti";
    }

    if ($("loginSticker")) {
        $("loginSticker").textContent =
            role === "student" ? "🎓" : "👨‍🏫";
    }

    if ($("username")) $("username").value = "";

    if ($("password")) {
        $("password").value = "";
        $("password").type = "password";
    }

    if ($("passwordToggle")) {
        $("passwordToggle").textContent = "◉";
    }

    showMessage("loginMessage", "");
    showSection("loginSection");
}


/* 4. MESSAGES */

function showMessage(id, message, success = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#20a879" : "#df4d5c";
}

function showCreateMessage(message, success = false) {
    let element = $("studentCreateMessage");

    if (!element) {
        element = document.createElement("p");
        element.id = "studentCreateMessage";
        element.className = "form-message-box";

        const form = $("addStudentForm");
        if (!form) return;

        form.appendChild(element);
    }

    element.textContent = message;
    element.style.color = success ? "#20a879" : "#df4d5c";
}


/* 5. SAFE TEXT */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


/* 6. PASSWORD VISIBILITY */

function setupPassword() {
    const toggle = $("passwordToggle");
    const password = $("password");

    if (!toggle || !password) return;

    toggle.addEventListener("click", () => {
        const show = password.type === "password";
        password.type = show ? "text" : "password";
        toggle.textContent = show ? "◎" : "◉";
    });
}


/* 7. LOGIN */

function setupLogin() {
    const form = $("loginForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = $("username")?.value.trim();
        const password = $("password")?.value;

        const button = form.querySelector('button[type="submit"]');

        if (!selectedRole) {
            showMessage("loginMessage", "Avval kirish turini tanlang.");
            return;
        }

        if (!email || !password) {
            showMessage("loginMessage", "Login va parolni kiriting.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Tekshirilmoqda...";
        }

        showMessage("loginMessage", "");

        try {
            const { data: authData, error: authError } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (authError) throw authError;

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("id, full_name, username, role, grade")
                    .eq("id", authData.user.id)
                    .single();

            if (profileError) throw profileError;

            if (selectedRole === "student") {
                if (profile.role !== "student") {
                    await supabaseClient.auth.signOut();
                    throw new Error("Bu akkaunt o'quvchi akkaunti emas.");
                }

                openStudentCabinet(profile);
            } else {
                if (
                    profile.role !== "admin" &&
                    profile.role !== "teacher"
                ) {
                    await supabaseClient.auth.signOut();
                    throw new Error("Bu akkaunt ustoz kabinetiga kira olmaydi.");
                }

                openAdminCabinet(profile);
            }

        } catch (error) {
            console.error("Login xatosi:", error);

            showMessage(
                "loginMessage",
                error.message || "Kirishda xatolik yuz berdi."
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = 'Kabinetga kirish <b>→</b>';
            }
        }
    });
}


/* 8. STUDENT CABINET */

function openStudentCabinet(profile) {
    const name = profile.full_name || "O'quvchi";
    const firstName = name.trim().split(/\s+/)[0];

    const grade = profile.grade
        ? profile.grade + "-sinf"
        : "Belgilanmagan";

    if ($("studentName")) $("studentName").textContent = name;
    if ($("studentFirstName")) $("studentFirstName").textContent = firstName;
    if ($("topStudentName")) $("topStudentName").textContent = name;
    if ($("studentGrade")) $("studentGrade").textContent = grade;
    if ($("studentProfileGrade")) $("studentProfileGrade").textContent = grade;

    showSection("studentCabinet");
    openView("studentCabinet", "studentOverview");
}


/* 9. ADMIN CABINET */

function openAdminCabinet(profile) {
    showSection("adminCabinet");

    const accountName = document.querySelector(
        "#adminCabinet .account-chip span:last-child"
    );

    if (accountName && profile?.full_name) {
        accountName.textContent = profile.full_name;
    }

    openView("adminCabinet", "adminOverview");
    loadAdminStatistics();
    loadTeacherList();
}


/* 10. PAGE TITLES */

const pageTitles = {
    studentOverview: "Bosh sahifa",
    studentLessons: "Darslarim",
    studentSubjects: "Fanlar",
    studentResults: "Natijalarim",
    studentProfile: "Profilim",
    adminOverview: "Bosh sahifa",
    adminStudents: "O'quvchilar",
    adminTeachers: "Ustozlar",
    adminSubjects: "Fanlar",
    adminTests: "Testlar",
    adminSettings: "Sozlamalar"
};


/* 11. NAVIGATION */

function openView(cabinetId, viewId) {
    const cabinet = $(cabinetId);
    if (!cabinet) return;

    cabinet.querySelectorAll(".view-panel").forEach(panel => {
        panel.classList.add("hidden");
        panel.classList.remove("active");
    });

    const target = $(viewId);

    if (target && cabinet.contains(target)) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }

    cabinet.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.view === viewId
        );
    });

    const titleId = cabinetId === "studentCabinet"
        ? "studentPageTitle"
        : "adminPageTitle";

    if ($(titleId)) {
        $(titleId).textContent = pageTitles[viewId] || "Bosh sahifa";
    }

    if (cabinetId === "adminCabinet") {
        if (viewId === "adminTeachers") {
            backToTeacherClasses();
            loadTeacherList();
        }

        if (viewId === "adminStudents") {
            loadStudentList();
        }
    }

    window.scrollTo({ top: 0, behavior: "instant" });
}

function setupNavigation() {
    ["studentCabinet", "adminCabinet"].forEach(cabinetId => {
        const cabinet = $(cabinetId);
        if (!cabinet) return;

        cabinet.querySelectorAll(".nav-link").forEach(button => {
            button.addEventListener("click", () => {
                openView(cabinetId, button.dataset.view);
            });
        });
    });
}


/* 12. ADMIN STATISTICS */

async function loadAdminStatistics() {
    try {
        const [students, teachers] = await Promise.all([
            supabaseClient
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("role", "student"),

            supabaseClient
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("role", "teacher")
        ]);

        if (students.error) throw students.error;
        if (teachers.error) throw teachers.error;

        if ($("totalStudents")) {
            $("totalStudents").textContent = students.count ?? 0;
        }

        if ($("totalTeachers")) {
            $("totalTeachers").textContent = teachers.count ?? 0;
        }

    } catch (error) {
        console.error("Statistika xatosi:", error);
    }
}


/* 13. STUDENT TABLE */

async function loadStudentList() {
    const list = $("studentList");
    if (!list) return;

    list.innerHTML = `
        <div class="student-loading">
            <span>⏳</span>
            <p>O'quvchilar yuklanmoqda...</p>
        </div>
    `;

    try {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, full_name, grade, username")
            .eq("role", "student")
            .order("full_name", { ascending: true });

        if (error) throw error;

        cachedStudents = data || [];
        renderStudentTable();

    } catch (error) {
        console.error("O'quvchilar ro'yxati:", error);

        list.innerHTML = `
            <div class="student-list-error">
                <strong>O'quvchilarni yuklab bo'lmadi.</strong>
                <p>${escapeHTML(error.message || "Noma'lum xatolik")}</p>
                <button type="button" class="btn btn-light"
                    onclick="loadStudentList()">↻ Qayta urinish</button>
            </div>
        `;
    }
}


/* 14. RENDER STUDENT TABLE */

function renderStudentTable() {
    const list = $("studentList");
    if (!list) return;

    const query = studentSearchQuery.toLocaleLowerCase("uz");

    const filteredStudents = cachedStudents.filter(student => {
        const grade = Number(student.grade);

        const gradeMatches =
            selectedStudentGrade === "all" ||
            (selectedStudentGrade === "unassigned"
                ? !GRADES.includes(grade)
                : grade === Number(selectedStudentGrade));

        const searchText = [
            student.full_name,
            student.username,
            student.grade
        ].join(" ").toLocaleLowerCase("uz");

        return gradeMatches && searchText.includes(query);
    });

    const gradeButtons = [
        { value: "all", label: "Barchasi" },
        ...GRADES.map(grade => ({
            value: String(grade),
            label: grade + "-sinf"
        })),
        { value: "unassigned", label: "Belgilanmagan" }
    ];

    const buttonsHTML = gradeButtons.map(item => {
        const active = selectedStudentGrade === item.value;

        return `
            <button
                type="button"
                class="student-filter-btn ${active ? "active" : ""}"
                data-grade="${item.value}"
                aria-pressed="${active}"
            >${item.label}</button>
        `;
    }).join("");

    const rowsHTML = filteredStudents.length
        ? filteredStudents.map((student, index) => {
            const grade = Number(student.grade);

            const gradeLabel = GRADES.includes(grade)
                ? grade + "-sinf"
                : "Belgilanmagan";

            const initial = (student.full_name || "O")
                .trim()
                .charAt(0)
                .toUpperCase();

            return `
                <tr>
                    <td class="student-row-number">${index + 1}</td>

                    <td>
                        <div class="student-name-cell">
                            <span class="student-avatar">
                                ${escapeHTML(initial)}
                            </span>
                            <strong>
                                ${escapeHTML(student.full_name || "Ism ko'rsatilmagan")}
                            </strong>
                        </div>
                    </td>

                    <td>
                        <span class="student-login">
                            ${escapeHTML(student.username || "—")}
                        </span>
                    </td>

                    <td>
                        <span class="student-grade-badge">
                            ${gradeLabel}
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="student-delete-btn"
                            data-student-id="${escapeHTML(student.id)}"
                            data-student-name="${escapeHTML(student.full_name || "O'quvchi")}"
                        >
                            🗑 O'chirish
                        </button>
                    </td>
                </tr>
            `;
        }).join("")
        : `
            <tr>
                <td colspan="5">
                    <div class="student-table-empty">
                        <span>♙</span>
                        <strong>O'quvchilar topilmadi</strong>
                        <p>Qidiruv so'zini yoki sinfni o'zgartirib ko'ring.</p>
                    </div>
                </td>
            </tr>
        `;

    list.innerHTML = `
        <div class="student-management">

            <div class="student-management-top">
                <div class="student-total">
                    <div class="student-total-icon">♙</div>
                    <div>
                        <strong>${cachedStudents.length}</strong>
                        <small>Jami o'quvchilar</small>
                    </div>
                </div>

                <div class="student-result-count">
                    Ko'rsatilmoqda:
                    <strong>${filteredStudents.length}</strong>
                </div>
            </div>

            <div class="student-filter-area">
                <div class="student-filter-heading">
                    <strong>Sinfni tanlang</strong>
                    <span>Kerakli sinf ro'yxatini oching</span>
                </div>

                <div class="student-filter-buttons">
                    ${buttonsHTML}
                </div>
            </div>

            <div class="student-table-toolbar">
                <div>
                    <h3>O'quvchilar ro'yxati</h3>
                    <p>Tanlangan sinf bo'yicha ma'lumotlar</p>
                </div>

                <label class="student-search">
                    <span>⌕</span>
                    <input
                        id="studentSearchInput"
                        type="search"
                        placeholder="Ism yoki login bo'yicha qidirish..."
                        value="${escapeHTML(studentSearchQuery)}"
                    >
                </label>
            </div>

            <div class="student-table-wrap">
                <table class="student-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>O'quvchi</th>
                            <th>Login</th>
                            <th>Sinf</th>
                            <th>Amal</th>
                        </tr>
                    </thead>

                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>

        </div>
    `;

    // Sinf filtrlari
    list.querySelectorAll(".student-filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            selectedStudentGrade = button.dataset.grade;
            renderStudentTable();
        });
    });

    // Qidiruv
    const searchInput = $("studentSearchInput");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            studentSearchQuery = searchInput.value;

            const cursorPosition = searchInput.selectionStart;

            renderStudentTable();

            const newInput = $("studentSearchInput");

            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(
                    cursorPosition,
                    cursorPosition
                );
            }
        });
    }

    // O'CHIRISH TUGMALARI
    list.querySelectorAll(".student-delete-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteStudent(
                button.dataset.studentId,
                button.dataset.studentName,
                button
            );
        });
    });
}


/* 15. DELETE STUDENT */

async function deleteStudent(studentId, studentName, button) {
    if (!studentId) {
        alert("O'quvchi ID raqami topilmadi.");
        return;
    }

    const confirmed = confirm(
        `"${studentName}" o'quvchisini o'chirmoqchimisiz?\n\n` +
        "Uning profili va akkaunti butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi."
    );

    if (!confirmed) return;

    if (button) {
        button.disabled = true;
        button.textContent = "O'chirilmoqda...";
    }

    try {
        const { data, error } =
            await supabaseClient.functions.invoke("smart-worker", {
                body: {
                    action: "delete",
                    student_id: studentId
                }
            });

        if (error) {
            let message = error.message || "Server xatosi.";

            try {
                const response = await error.context.json();
                if (response?.error) {
                    message = response.error;
                }
            } catch (_) {
                // Server javobi JSON bo'lmasa, asosiy xabar ishlatiladi.
            }

            throw new Error(message);
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        if (!data?.success) {
            throw new Error("O'quvchini o'chirish tasdiqlanmadi.");
        }

        // O'chirilgan o'quvchini ro'yxatdan olib tashlash
        cachedStudents = cachedStudents.filter(
            student => student.id !== studentId
        );

        renderStudentTable();

        // Statistikani yangilash
        await loadAdminStatistics();

        alert(
            data.message ||
            "O'quvchi muvaffaqiyatli o'chirildi."
        );

    } catch (error) {
        console.error("O'quvchini o'chirish xatosi:", error);

        alert(
            "O'quvchini o'chirishda xatolik:\n" +
            (error.message || "Noma'lum xatolik")
        );

        if (button) {
            button.disabled = false;
            button.textContent = "🗑 O'chirish";
        }
    }
}


/* 16. TEACHERS */

async function loadTeacherList() {
    const list = $("teacherList");
    if (!list) return;

    list.innerHTML = '<p class="muted">Ustozlar yuklanmoqda...</p>';

    try {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("full_name, username")
            .eq("role", "teacher")
            .order("full_name", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="muted">Hozircha ustozlar mavjud emas.</p>';
            return;
        }

        list.innerHTML = data.map(teacher => `
            <div class="profile-row">
                <span>👨‍🏫 ${escapeHTML(teacher.full_name || "Ustoz")}</span>
                <strong>${escapeHTML(teacher.username || "")}</strong>
            </div>
        `).join("");

    } catch (error) {
        console.error("Ustozlar ro'yxati:", error);

        list.innerHTML = `
            <p class="muted">Ustozlarni yuklashda xatolik yuz berdi.</p>
            <p class="muted">${escapeHTML(error.message || "")}</p>
        `;
    }
}


/* 17. TEACHER CLASS DETAILS */

async function openTeacherClass(grade) {
    const classesView = $("teacherClassesView");
    const detailView = $("teacherClassDetail");

    if (!classesView || !detailView) return;

    classesView.classList.add("hidden");
    detailView.classList.remove("hidden");

    if ($("teacherClassTitle")) {
        $("teacherClassTitle").textContent = grade + "-sinf";
    }

    const list = $("classTeacherList");
    if (!list) return;

    list.innerHTML = '<p class="muted">Ustozlar yuklanmoqda...</p>';

    try {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("full_name, username")
            .eq("role", "teacher")
            .order("full_name", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="muted">Hozircha ustozlar mavjud emas.</p>';
            return;
        }

        list.innerHTML = data.map(teacher => `
            <div class="profile-row">
                <span>👨‍🏫 ${escapeHTML(teacher.full_name || "Ustoz")}</span>
                <strong>${escapeHTML(teacher.username || "")}</strong>
            </div>
        `).join("");

    } catch (error) {
        console.error("Sinf ustozlari:", error);

        list.innerHTML = `
            <p class="muted">Ustozlarni yuklashda xatolik yuz berdi.</p>
        `;
    }
}


function backToTeacherClasses() {
    if ($("teacherClassDetail")) {
        $("teacherClassDetail").classList.add("hidden");
    }

    if ($("teacherClassesView")) {
        $("teacherClassesView").classList.remove("hidden");
    }
}


/* 18. CREATE STUDENT */

function setupStudentForm() {
    const form = $("addStudentForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const name = $("newStudentName")?.value.trim();
        const grade = Number($("newStudentGrade")?.value);
        const username = $("newStudentUsername")?.value.trim();
        const password = $("newStudentPassword")?.value;

        const button = form.querySelector('button[type="submit"]');

        if (!name || !grade || !username || !password) {
            showCreateMessage("Barcha maydonlarni to'ldiring.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
            showCreateMessage("To'g'ri email manzilini kiriting.");
            return;
        }

        if (password.length < 8) {
            showCreateMessage("Parol kamida 8 ta belgidan iborat bo'lsin.");
            return;
        }

        if (!GRADES.includes(grade)) {
            showCreateMessage("5–11-sinflardan birini tanlang.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Saqlanmoqda...";
        }

        showCreateMessage("");

        try {
            const { data, error } =
                await supabaseClient.functions.invoke("smart-worker", {
                    body: {
                        action: "create",
                        full_name: name,
                        grade,
                        username,
                        password
                    }
                });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            showCreateMessage(
                "✓ O'quvchi muvaffaqiyatli qo'shildi!",
                true
            );

            form.reset();

            selectedStudentGrade = String(grade);
            studentSearchQuery = "";

            await Promise.all([
                loadAdminStatistics(),
                loadStudentList()
            ]);

        } catch (error) {
            console.error("O'quvchi qo'shish xatosi:", error);

            showCreateMessage(
                "Xatolik: " +
                (error.message || "O'quvchini qo'shib bo'lmadi.")
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = 'O\'quvchini saqlash <b>→</b>';
            }
        }
    });
}


/* 19. LOGOUT */

async function goHome() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error("Chiqish xatosi:", error);
    }

    selectedRole = null;
    showSection("homeSection");
}


/* 20. START */

document.addEventListener("DOMContentLoaded", () => {
    setupPassword();
    setupLogin();
    setupNavigation();
    setupStudentForm();

    showSection("homeSection");

    console.log("Bilim.hub muvaffaqiyatli ishga tushdi!");
});
