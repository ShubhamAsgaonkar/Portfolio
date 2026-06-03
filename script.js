document.addEventListener('DOMContentLoaded', () => {

    /* -----------------------------
       MOBILE MENU
    ------------------------------ */
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');

    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(n =>
        n.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            navMenu.classList.remove('active');
        })
    );


    /* -----------------------------
       SMOOTH SCROLLING
    ------------------------------ */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });


    /* -----------------------------
       CUSTOM CURSOR
    ------------------------------ */
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    window.addEventListener('mousemove', (e) => {
        const posX = e.clientX;
        const posY = e.clientY;

        cursorDot.style.left = `${posX}px`;
        cursorDot.style.top = `${posY}px`;

        cursorOutline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });
    });

    document.querySelectorAll('a, button, .project-card, .blog-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(1.5)';
            cursorOutline.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        el.addEventListener('mouseleave', () => {
            cursorOutline.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorOutline.style.backgroundColor = 'transparent';
        });
    });


    /* -----------------------------
       INTERSECTION OBSERVER (MUST COME BEFORE BLOG RENDERING)
    ------------------------------ */
    const observerOptions = { threshold: 0.1 };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);


    /* -----------------------------
       DYNAMIC BLOG RENDERING
    ------------------------------ */
    const blogGrid = document.querySelector('.blog-grid');

    if (blogGrid && typeof blogData !== 'undefined') {
        blogGrid.innerHTML = '';

        blogData.forEach((blog, index) => {
            const article = document.createElement('article');
            article.className = 'blog-card';

            // Handle Image
            let imageHtml;
            if (blog.image && blog.image !== 'placeholder.jpg') {
                imageHtml = `<div class="blog-image" style="background-image: url('${blog.image}'); background-size: cover; background-position: center;"></div>`;
            } else {
                const gradientClass = `placeholder-gradient-${(index % 3) + 1}`;
                imageHtml = `<div class="blog-image ${gradientClass}"></div>`;
            }

            // Build Blog Card
            article.innerHTML = `
                ${imageHtml}
                <div class="blog-content">
                    <span class="blog-date">${blog.date}</span>
                    <h3>${blog.title}</h3>
                    <p>${blog.excerpt}</p>
                    <a href="Blogs/${blog.title}/index.html" class="read-more">Read More <i class="fas fa-arrow-right"></i></a>
                </div>
            `;

            // Initial animation state
            article.style.opacity = '0';
            article.style.transform = 'translateY(20px)';
            article.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

            blogGrid.appendChild(article);

            // Observe AFTER observer exists
            observer.observe(article);
        });
    }


    /* -----------------------------
       CONTACT FORM
    ------------------------------ */
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = contactForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Sending...';
            btn.disabled = true;

            const formData = new FormData(contactForm);

            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    btn.innerText = 'Message Sent!';
                    btn.style.background = 'var(--accent-secondary)';
                    contactForm.reset();
                } else {
                    btn.innerText = 'Error!';
                    alert("There was a problem submitting your form");
                }
            } catch (error) {
                btn.innerText = 'Error!';
                alert("There was a problem submitting your form");
            } finally {
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    btn.style.background = '';
                }, 3000);
            }
        });
    }


    /* -----------------------------
       APPLY OBSERVER TO STATIC ELEMENTS
    ------------------------------ */
    document.querySelectorAll('.section-title, .skill-card, .project-card, .contact-wrapper')
        .forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(el);
        });

});


const text = `
apiVersion: engineer.shubham/v1
kind: Profile
metadata:
  name: shubham-asgaonkar
spec:
  roles:
    - Cloud Engineer
    - MLOps
    - LLMOps
  specialties:
    - GenAI & LLM Solutions
    - Kubernetes (EKS & AKS)
    - DevSecOps & Compliance
  deliverables:
    - "Production-Ready AI Services"
    - "Scalable Cloud Infrastructure"
    - "End-to-End CI/CD Automation"`;

const codeElement = document.getElementById('typedCode');

let index = 0;

function typeEffect() {
    if (index < text.length) {
        codeElement.textContent += text.charAt(index);
        index++;
        setTimeout(typeEffect, 35); // typing speed
    } else {
        // Add blinking cursor when finished
        codeElement.innerHTML += '<span class="cursor"></span>';
    }
}
typeEffect();
