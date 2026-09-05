// Mobile Menu Toggle
const menuToggle = document.querySelector('.menu-toggle');
const closeMenu = document.querySelector('.close-menu');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileLinks = document.querySelectorAll('.mobile-link');

if(menuToggle && closeMenu && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });

    closeMenu.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

// Scroll Reveal Animations
const revealElements = document.querySelectorAll('.reveal');

const revealOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
};

const revealOnScroll = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
        }
    });
}, revealOptions);

revealElements.forEach(el => {
    revealOnScroll.observe(el);
});

// Remove modal logic, we use standard page links now.

// FAQ Accordion
const faqQuestions = document.querySelectorAll('.faq-question');
faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
        const faqItem = btn.parentElement;
        const faqAnswer = faqItem.querySelector('.faq-answer');
        
        // Toggle active state
        const isActive = faqItem.classList.contains('active');
        
        // Close all other faqs
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
            item.querySelector('.faq-answer').style.maxHeight = null;
        });

        if (!isActive) {
            faqItem.classList.add('active');
            faqAnswer.style.maxHeight = faqAnswer.scrollHeight + "px";
        }
    });
});

// Project Filtering Logic for projects.html
const hash = window.location.hash;
const isProjectsPage = window.location.pathname.includes('projects.html');

if (isProjectsPage && hash && document.querySelector('.projects-grid')) {
    filterProjects(hash.substring(1));
}

function filterProjects(tagId) {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
        if(tagId === 'all') {
            card.style.display = 'block';
        } else {
            // checking if the card has a child anchor with href ending with hash
            const tagLink = card.querySelector('.thumbnail-project-tag-link');
            if (tagLink && tagLink.getAttribute('href').endsWith('#' + tagId)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Listen to hash changes without reloading
window.addEventListener('hashchange', () => {
    if (!window.location.pathname.includes('projects.html')) return;
    
    const currentHash = window.location.hash;
    if (currentHash && document.querySelector('.projects-grid')) {
        filterProjects(currentHash.substring(1));
    }
});

// Contact Form Submit Logic
const contactForm = document.querySelector('.minimal-contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const company = document.getElementById('company').value;
        const phone = document.getElementById('phone').value;
        const message = document.getElementById('message').value;

        const subject = `New Contact from ${name} - Portfolio`;
        const body = `Name: ${name}%0D%0AEmail: ${email}%0D%0ACompany: ${company}%0D%0APhone: ${phone}%0D%0A%0D%0AMessage:%0D%0A${message}`;

        window.location.href = `mailto:buinm2002@gmail.com?subject=${subject}&body=${body}`;
    });
}

// Remove skeleton-bg when image loads
document.querySelectorAll('img.skeleton-bg').forEach(img => {
    if (img.complete) {
        img.classList.remove('skeleton-bg');
    } else {
        img.addEventListener('load', () => img.classList.remove('skeleton-bg'));
    }
});
