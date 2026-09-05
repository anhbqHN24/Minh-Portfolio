async function loadLanguage(lang) {
    try {
        const response = await fetch(`/lang/${lang}.json`);
        const translations = await response.json();
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                if (el.innerHTML.includes('<span')) {
                    // if it has HTML inside, replace innerHTML
                    el.innerHTML = translations[key];
                } else {
                    el.textContent = translations[key];
                }
            }
        });

        localStorage.setItem('portfolio_lang', lang);
        
        // Update active class on dropdown options and update flag
        document.querySelectorAll('.lang-option').forEach(btn => {
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
                
                // Update the button flag to match the selected option
                const flag = btn.querySelector('.flag').textContent;
                const wrapper = btn.closest('.lang-dropdown-wrapper');
                if(wrapper) {
                    const currentFlagEl = wrapper.querySelector('.current-flag');
                    if(currentFlagEl) {
                        currentFlagEl.textContent = flag;
                    }
                }
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.documentElement.lang = lang;
    } catch (error) {
        console.error('Error loading language:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('portfolio_lang') || 'en';
    loadLanguage(savedLang);

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = btn.getAttribute('data-lang');
            loadLanguage(lang);
            
            // Close dropdown after selection
            const menu = btn.closest('.lang-dropdown-menu');
            if(menu) menu.classList.remove('show');
        });
    });

    // Dropdown toggle logic
    document.querySelectorAll('.lang-dropdown-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.lang-dropdown-wrapper');
            const menu = wrapper.querySelector('.lang-dropdown-menu');
            // Toggle this menu
            menu.classList.toggle('show');
            
            // Close others
            document.querySelectorAll('.lang-dropdown-menu').forEach(m => {
                if(m !== menu) m.classList.remove('show');
            });
        });
    });

    // Close on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.lang-dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    });
});
