(function(){
  const checkbox = document.getElementById('toggleDarkMode');
  if (!checkbox) return;
  const apply = (enabled) => {
    document.body.classList.toggle('dark', enabled);
    checkbox.checked = enabled;
    localStorage.setItem('darkMode', enabled ? '1' : '0');
  };
  apply(localStorage.getItem('darkMode') === '1');
  checkbox.addEventListener('change', () => apply(checkbox.checked));
})();
