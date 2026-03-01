/** Content Pipeline - Main JavaScript */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
  initCopyButtons();
  initMobileMenu();
  initScrollAnimations();
});

// Navbar scroll effect
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = document.getElementById('navbar')?.offsetHeight || 72;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Close mobile menu if open
        const navLinks = document.getElementById('navLinks');
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (navLinks?.classList.contains('active')) {
          navLinks.classList.remove('active');
          mobileBtn?.classList.remove('active');
        }
      }
    });
  });
}

// Copy code functionality
function initCopyButtons() {
  const copyBtn = document.getElementById('copyBtn');
  if (!copyBtn) return;
  
  copyBtn.addEventListener('click', async () => {
    const code = `# Clone repository
git clone https://github.com/kevin-claw-agent/content-pipeline.git
cd content-pipeline

# Start dependencies
docker-compose -f docker/docker-compose.yml up -d

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Start API server
npm run dev

# Start workers (new terminal)
npm run workers`;
    
    try {
      await navigator.clipboard.writeText(code);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        已复制
      `;
      copyBtn.classList.add('copied');
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
}

// Mobile menu toggle
function initMobileMenu() {
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  
  if (!mobileBtn || !navLinks) return;
  
  mobileBtn.addEventListener('click', () => {
    mobileBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
    
    if (navLinks.classList.contains('active')) {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '72px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = 'var(--bg-secondary)';
      navLinks.style.padding = '24px';
      navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      navLinks.style.backdropFilter = 'blur(20px)';
      navLinks.style.zIndex = '999';
    } else {
      navLinks.style.display = '';
      navLinks.style.flexDirection = '';
      navLinks.style.position = '';
      navLinks.style.top = '';
      navLinks.style.left = '';
      navLinks.style.right = '';
      navLinks.style.background = '';
      navLinks.style.padding = '';
      navLinks.style.borderBottom = '';
      navLinks.style.backdropFilter = '';
      navLinks.style.zIndex = '';
    }
  });
}

// Scroll animations
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe elements for animation
  const animateElements = document.querySelectorAll('.feature-card, .doc-card, .step-item, .tech-category');
  animateElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// Add CSS for animate-in class
const style = document.createElement('style');
style.textContent = `
  .animate-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);
