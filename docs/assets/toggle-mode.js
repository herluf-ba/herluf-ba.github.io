  // Determine if we should be in darkmode
  if (localStorage.getItem("mode") === "dark") {
    toggleMode();
  }

  function toggleMode() {
    const isDarkMode =
      document.documentElement.classList.contains("dark-mode");
    if (isDarkMode) {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("mode", "light");
    } else {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("mode", "dark");
    }
  }