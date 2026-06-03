const fs = require('fs');
const path = require('path');
const docxParser = require('docx-parser');
const { marked } = require('marked');

// Configure marked for clean output
marked.setOptions({ gfm: true, breaks: false });

// Strip markdown symbols for plain-text excerpts
function stripMarkdown(text) {
    return text
        .replace(/^#{1,6}\s+/gm, '')       // headings
        .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
        .replace(/\*(.+?)\*/g, '$1')       // italic
        .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
        .replace(/^>\s+/gm, '')            // blockquotes
        .replace(/^[-*+]\s+/gm, '')        // list bullets
        .replace(/^\d+\.\s+/gm, '')        // numbered lists
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
        .replace(/!\[.*?\]\(.*?\)/g, '')   // images
        .replace(/[-]{3,}/g, '')           // horizontal rules
        .replace(/\n{2,}/g, ' ')           // collapse newlines
        .trim();
}

const blogsDir = path.join(__dirname, 'Blogs');
const outputFile = path.join(__dirname, 'blog_data.js');
const templateFile = path.join(__dirname, 'index.html');

function readDocx(filePath) {
    return new Promise((resolve, reject) => {
        docxParser.parseDocx(filePath, (data) => {
            resolve(data || "");
        });
    });
}

async function getBlogContent(folderPath, contentFile) {
    const fullPath = path.join(folderPath, contentFile);

    if (contentFile.endsWith(".txt") || contentFile.endsWith(".md")) {
        return fs.readFileSync(fullPath, "utf8");
    }

    if (contentFile.endsWith(".docx")) {
        return await readDocx(fullPath);
    }

    return "";
}

function generateBlogPage(blog, templateHtml) {
    // Fix relative paths for assets since the file will be in Blogs/BlogName/index.html
    // We need to go up two levels: ../../
    let html = templateHtml.replace(/href="style.css"/g, 'href="../../style.css"')
        .replace(/src="script.js"/g, 'src="../../script.js"')
        .replace(/src="blog_data.js"/g, 'src="../../blog_data.js"')
        .replace(/href="Shubham_Asgaonkar_Resume.pdf"/g, 'href="../../Shubham_Asgaonkar_Resume.pdf"')
        .replace(/src="https:\/\/cdn\.jsdelivr\.net\/npm\/marked\/marked\.min\.js"/g, 'src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"')
        // Fix all in-page anchor links (navbar + CTA buttons) to point back to root index
        .replace(/href="#([^"]*)"/g, 'href="../../index.html#$1"');

    // Replace the main content with the blog post
    // We'll keep the navbar and footer, but replace the body content
    // Strategy: Find the start of the first section and the end of the last section before footer
    // Actually, let's just replace everything inside <body> except <nav> and <footer> and scripts

    // A safer approach: Remove specific sections we don't want (Home, About, Skills, Projects, Blog, Contact, Certifications)
    // And inject the blog content.

    // Let's use a simple regex to replace the main sections.
    // We want to keep <nav> (which ends with </nav>)
    // We want to keep <footer> (which starts with <footer>)

    const navEndIndex = html.indexOf('</nav>') + 6;
    const footerStartIndex = html.indexOf('<footer>');

    if (navEndIndex === 5 || footerStartIndex === -1) {
        console.log(`Could not parse template for blog: ${blog.title}`);
        return;
    }

    const header = html.substring(0, navEndIndex);
    const footer = html.substring(footerStartIndex);

    // Create the blog post HTML
    // Handle image path (it's relative to root, so for the blog page it should be ../../Blogs/Folder/Image)
    // But wait, blog.image is "Blogs/Folder/Image".
    // From "Blogs/Folder/index.html", "Blogs/Folder/Image" is WRONG.
    // It should be "./Image" or just "Image".
    // Or we can use absolute path if we were on a server, but for local file opening, relative is best.
    // blog.image is stored as "Blogs/Folder/Image.webp" in blog_data.js
    // We can just use the filename if it's in the same folder.

    const imageFilename = blog.image.split('/').pop();
    const imagePath = imageFilename !== 'placeholder.jpg' ? imageFilename : '../../placeholder.jpg'; // Assuming placeholder is at root if used, but actually we use gradients mostly.

    let imageHtml = '';
    if (blog.image && !blog.image.includes('placeholder.jpg')) {
        imageHtml = `<div class="blog-image" style="background-image: url('${imageFilename}'); background-size: cover; background-position: center; height: 400px; border-radius: 20px; margin-bottom: 30px;"></div>`;
    } else {
        imageHtml = `<div class="blog-image placeholder-gradient-1" style="height: 400px; border-radius: 20px; margin-bottom: 30px;"></div>`;
    }

    // Render markdown to HTML using marked
    const formattedContent = marked.parse(blog.content);

    const blogContentHtml = `
    <section class="section" style="padding-top: 120px; min-height: 80vh;">
        <div class="container">
            <a href="../../index.html" class="btn btn-secondary" style="margin-bottom: 30px;"><i class="fas fa-arrow-left"></i> Back to Home</a>
            <article class="blog-post-full">
                ${imageHtml}
                <h1 class="section-title" style="text-align: left; margin-bottom: 10px;">${blog.title}</h1>
                <p class="blog-date" style="color: var(--text-secondary); margin-bottom: 30px;">${blog.date}</p>
                <div class="blog-body" style="font-size: 1.1rem; line-height: 1.8; color: var(--text-primary);">
                    ${formattedContent}
                </div>
            </article>
        </div>
    </section>
    `;

    const finalHtml = header + blogContentHtml + footer;

    const blogFolderPath = path.join(blogsDir, blog.title);
    fs.writeFileSync(path.join(blogFolderPath, 'index.html'), finalHtml);
}

async function getBlogs() {
    if (!fs.existsSync(blogsDir)) return [];

    let templateHtml = "";
    if (fs.existsSync(templateFile)) {
        templateHtml = fs.readFileSync(templateFile, "utf8");
    } else {
        console.log("Warning: index.html template not found.");
    }

    const folders = fs
        .readdirSync(blogsDir)
        .filter((f) => fs.statSync(path.join(blogsDir, f)).isDirectory());

    const blogs = [];

    for (const folder of folders) {
        const folderPath = path.join(blogsDir, folder);
        const files = fs.readdirSync(folderPath);

        const contentFile = files.find((f) => /\.(txt|md|docx)$/i.test(f) && f.toLowerCase() !== "date.txt");
        const dateFile = files.find((f) => f.toLowerCase() === "date.txt");
        const imageFile = files.find((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

        let content = contentFile
            ? await getBlogContent(folderPath, contentFile)
            : "No content found.";

        let date = dateFile
            ? fs.readFileSync(path.join(folderPath, dateFile), "utf8").trim()
            : "Unknown Date";

        const image = imageFile
            ? `Blogs/${encodeURIComponent(folder)}/${encodeURIComponent(imageFile)}`
            : "placeholder.jpg";

        // Use plain-text excerpt for the blog card (no markdown symbols)
        const plainExcerpt = stripMarkdown(content);

        const blogObj = {
            title: folder,
            date,
            excerpt: plainExcerpt.substring(0, 200) + "...",
            content,
            image,
        };

        blogs.push(blogObj);

        // Generate static page
        if (templateHtml) {
            generateBlogPage(blogObj, templateHtml);
        }
    }

    return blogs;
}

(async () => {
    const blogs = await getBlogs();
    const jsContent = `const blogData = ${JSON.stringify(blogs, null, 4)};`;

    fs.writeFileSync(outputFile, jsContent);
    console.log(`✔ blog_data.js updated with ${blogs.length} blogs.`);
    console.log(`✔ Static blog pages generated in Blogs/ directory.`);
})();
