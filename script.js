const header = document.querySelector('.site-header');
const navLinks = [...document.querySelectorAll('.main-nav a')];
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const cursorGlow = document.querySelector('.cursor-glow');
const portraitInput = document.querySelector('#portrait-upload');
const portraitImage = document.querySelector('#portrait-image');
const contactForm = document.querySelector('#contact-form');
const formFeedback = document.querySelector('#form-feedback');

// Keep the navigation compact once the visitor starts exploring the page.
const onScroll = () => {
  header.classList.toggle('is-scrolled', window.scrollY > 18);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

menuToggle?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'فتح القائمة');
  });
});

// Highlight the current section in the navigation.
const sections = [...document.querySelectorAll('main section[id]')];
const setActiveLink = () => {
  const position = window.scrollY + window.innerHeight * 0.35;
  let current = 'top';

  sections.forEach((section) => {
    if (position >= section.offsetTop) current = section.id;
  });

  navLinks.forEach((link) => {
    const target = link.getAttribute('href').slice(1);
    link.classList.toggle('active', target === current);
  });
};
window.addEventListener('scroll', setActiveLink, { passive: true });
setActiveLink();

// Gentle reveal transitions respect visitors who ask for reduced movement.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -35px' },
  );

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
}

// Let the owner preview a personal photo without changing any code.
portraitInput?.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    portraitInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    portraitImage.src = reader.result;
    portraitImage.alt = 'الصورة الشخصية لعبد الرحمن ياسر الأسيوطي';
    portraitImage.classList.add('is-personal-photo');
  });
  reader.readAsDataURL(file);
});

// The cursor glow is purely decorative and stays off on touch devices.
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
  window.addEventListener('pointermove', (event) => {
    cursorGlow.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    cursorGlow.style.opacity = '1';
  });
}

// A ready-to-copy message makes the static contact form useful before it is connected to a mail service.
contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = contactForm.elements.name.value.trim();
  const email = contactForm.elements.email.value.trim();
  const message = contactForm.elements.message.value.trim();

  if (!name || !email || !message || !contactForm.checkValidity()) {
    formFeedback.textContent = 'يرجى إكمال الحقول المطلوبة بالبريد الإلكتروني الصحيح.';
    formFeedback.classList.add('is-error');
    return;
  }

  const brief = `رسالة مشروع جديدة\nالاسم: ${name}\nالبريد: ${email}\n\n${message}`;

  try {
    await navigator.clipboard.writeText(brief);
    formFeedback.textContent = 'تم نسخ ملخص رسالتك. شاركه عبر وسيلة التواصل المناسبة.';
  } catch {
    formFeedback.textContent = 'رسالتك جاهزة. يمكنك نسخها من الحقول ومشاركتها عبر وسيلة التواصل المناسبة.';
  }

  formFeedback.classList.remove('is-error');
  formFeedback.classList.add('is-success');
});

document.querySelector('#current-year').textContent = new Date().getFullYear();
