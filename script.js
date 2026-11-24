
const SUPABASE_URL = "https://jtzldhrbtzbundkjvznh.supabase.co";
const SUPABASE_KEY = "sb_publishable_uGvgyHNizyh9ON_12PQLWA_fLfm6Oln";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let selectedRole = "";

// YO'NALISHNI TANLASH
function selectRole(role) {
    selectedRole = role;

    document.getElementById("homeSection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");

    document.getElementById("loginMessage").textContent = "";

    if (role === "student") {
        document.getElementById("loginTitle").textContent = "O'quvchi kabineti";
        document.getElementById("loginSticker").textContent = "🎓";
    } else {
        document.getElementById("loginTitle").textContent = "Ustoz kabineti";
        document.getElementById("loginSticker").textContent = "👨‍🏫";
    }
}

// BOSH SAHIFAGA QAYTISH
async function goHome() {
    await supabaseClient.auth.signOut();

    document.getElementById("homeSection").classList.remove("hidden");
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("studentCabinet").classList.add("hidden");
    document.getElementById("adminCabinet").classList.add("hidden");

    document.getElementById("loginForm").reset();
    document.getElementById("loginMessage").textContent = "";

    selectedRole = "";
}

// LOGIN VA PAROLNI TEKSHIRISH
document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const message = document.getElementById("loginMessage");
    message.textContent = "Tekshirilmoqda...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: username,
            password: password
        });

        if (error) throw error;

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("full_name, username, role, grade")
                .eq("id", data.user.id)
                .single();

        if (profileError || !profile) {
            await supabaseClient.auth.signOut();
            throw new Error("Profil ma'lumotlari topilmadi.");
        }

        // ADMINISTRATOR
        if (profile.role === "admin") {
            document.getElementById("homeSection").classList.add("hidden");
            document.getElementById("loginSection").classList.add("hidden");
            document.getElementById("studentCabinet").classList.add("hidden");
            document.getElementById("adminCabinet").classList.remove("hidden");
            return;
        }

        // O'QUVCHI
        if (profile.role === "student" && selectedRole === "student") {
            document.getElementById("studentName").textContent = profile.full_name;
            document.getElementById("studentGrade").textContent =
                "Sinf: " + profile.grade;

            document.getElementById("homeSection").classList.add("hidden");
            document.getElementById("loginSection").classList.add("hidden");
            document.getElementById("studentCabinet").classList.remove("hidden");
            return;
        }

        // USTOZ
        if (profile.role === "teacher" && selectedRole === "teacher") {
            message.textContent = "Ustoz kabineti tayyorlanmoqda.";
            await supabaseClient.auth.signOut();
            return;
        }

        await supabaseClient.auth.signOut();
        throw new Error("Siz tanlagan yo'nalish uchun ruxsat yo'q.");

    } catch (error) {
        message.textContent = error.message;
        console.error("Login xatosi:", error);
    }
});

// O'QUVCHI QO'SHISH
const addStudentForm = document.getElementById("addStudentForm");

if (addStudentForm) {
    const addButton = addStudentForm.querySelector("button");

    if (addButton) {
        addButton.disabled = false;
        addButton.type = "button";
        addButton.textContent = "O'quvchini saqlash";

        addButton.addEventListener("click", addStudent);
    }
}

async function addStudent() {
    const name = document.getElementById("newStudentName").value.trim();
    const grade = document.getElementById("newStudentGrade").value;
    const username = document.getElementById("newStudentUsername").value.trim();
    const password = document.getElementById("newStudentPassword").value;

    const button = addStudentForm.querySelector("button");

    if (!name || !grade || !username || !password) {
        alert("Barcha maydonlarni to'ldiring!");
        return;
    }

    if (password.length < 8) {
        alert("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
        alert("Login hozircha haqiqiy email manzili bo'lishi kerak.");
        return;
    }

    button.disabled = true;
    button.textContent = "Saqlanmoqda...";

    try {
        const { data, error } = await supabaseClient.functions.invoke(
            "smart-worker",
            {
                body: {
                    full_name: name,
                    grade: Number(grade),
                    username: username,
                    password: password
                }
            }
        );

        if (error) {
            let details = error.message;

            if (error.context) {
                try {
                    const response = await error.context.json();
                    if (response.error) details = response.error;
                } catch (_) {}
            }

            throw new Error(details);
        }

        if (!data || !data.success) {
            throw new Error(data?.error || "O'quvchi qo'shilmadi.");
        }

        alert("O'quvchi muvaffaqiyatli qo'shildi!");

        addStudentForm.reset();

    } catch (error) {
        console.error("O'quvchi qo'shish xatosi:", error);
        alert("Xatolik: " + error.message);

    } finally {
        button.disabled = false;
        button.textContent = "O'quvchini saqlash";
    }
}
