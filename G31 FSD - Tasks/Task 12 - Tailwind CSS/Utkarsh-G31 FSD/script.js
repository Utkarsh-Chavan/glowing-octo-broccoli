const menuButton = document.getElementById("menu-button");
const mobileMenu = document.getElementById("mobile-menu");

menuButton.addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
});

const themeButton = document.getElementById("theme-button");
const mobileThemeButton = document.getElementById("mobile-theme-button");

function updateThemeButton(isDark) {
    themeButton.textContent = isDark ? "☀️" : "🌙";
    mobileThemeButton.textContent = isDark
        ? "☀️ Light Mode"
        : "🌙 Dark Mode";
}

function toggleDarkMode() {
    document.documentElement.classList.toggle("dark");

    const isDark = document.documentElement.classList.contains("dark");

    updateThemeButton(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
}

// Load saved theme
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    updateThemeButton(true);
}

themeButton.addEventListener("click", toggleDarkMode);
mobileThemeButton.addEventListener("click", toggleDarkMode);