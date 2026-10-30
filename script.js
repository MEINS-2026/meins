// --- 1. テーマ切り替え ---
function initTheme() {
    const themeSelect = document.getElementById("themeSelect");
    if (!themeSelect) return;
    const savedTheme = localStorage.getItem("site_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    themeSelect.value = savedTheme;
    themeSelect.addEventListener("change", (e) => {
        document.documentElement.setAttribute("data-theme", e.target.value);
        localStorage.setItem("site_theme", e.target.value);
    });
}

// --- 2. プロフィール & ヘッダー読み込み ---
async function loadProfile() {
    try {
        const res = await fetch("profile.json");
        const profile = await res.json();

        const heroEl = document.querySelector(".hero-section");
        const heroName = document.getElementById("heroName");
        const heroTitle = document.getElementById("heroTitle");
        const heroBio = document.getElementById("heroBio");
        const heroAvatar = document.getElementById("heroAvatar");

        if (heroName) heroName.textContent = profile.name;
        if (heroTitle) heroTitle.textContent = profile.title;
        if (heroBio) heroBio.textContent = profile.bio;

        // --- 1. アバター画像 & 背景色の適用 ---
        if (heroAvatar && profile.avatar) {
            heroAvatar.src = profile.avatar;
            if (profile.avatar_bg) {
                heroAvatar.style.backgroundColor = profile.avatar_bg;
            }
        }

        // --- 2. ヒーローヘッダー背景（単色 or 画像）の切り替え ---
        if (heroEl) {
            if (profile.hero_bg_type === "image" && profile.hero_bg_image) {
                heroEl.style.backgroundImage = `url('${profile.hero_bg_image}')`;
                heroEl.style.backgroundSize = "cover";
                heroEl.style.backgroundPosition = "center";
            } else if (profile.hero_bg_color) {
                heroEl.style.background = profile.hero_bg_color;
            }
        }

        // ヘッダーナビ & SNSの生成
        const headerNav = document.getElementById("headerNav");
        if (headerNav && profile.header_links) {
            headerNav.innerHTML = "";
            profile.header_links.forEach(l => {
                const a = document.createElement("a");
                a.href = l.url;
                a.className = "header-nav-link";
                a.innerHTML = `<i class="${l.icon}"></i> ${l.name}`;
                headerNav.appendChild(a);
            });
        }

        const socialNav = document.getElementById("socialNav");
        if (socialNav && profile.socials) {
            socialNav.innerHTML = "";
            profile.socials.forEach(s => {
                const a = document.createElement("a");
                a.href = s.url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.innerHTML = `<i class="${s.icon}"></i>`;
                socialNav.appendChild(a);
            });
        }
        return profile;
    } catch (e) {
        console.error("Profile load error:", e);
        return null;
    }
}

// --- 3. posts/ フォルダを自動スキャンして .md ファイルを回収する ---
async function fetchAllPosts() {
    let slugs = [];

    try {
        // ローカルサーバーのディレクトリリスティング機能を利用
        const res = await fetch("posts/");
        if (res.ok) {
            const htmlText = await res.text();
            const doc = new DOMParser().parseFromString(htmlText, "text/html");
            
            doc.querySelectorAll("a").forEach(a => {
                let href = a.getAttribute("href");
                if (href && href.endsWith(".md")) {
                    // ファイル名（拡張子なし）を綺麗に抽出
                    let cleanName = href.split("/").pop().replace(".md", "");
                    if (cleanName && !slugs.includes(cleanName)) {
                        slugs.push(cleanName);
                    }
                }
            });
        }
    } catch (err) {
        console.warn("自動スキャンに失敗しました:", err);
    }

    // 万が一スキャンできなかった場合のフォールバック（あなたの画像の "firest" を救済）
    if (slugs.length === 0) {
        slugs = ["firest"];
    }

    // 各 .md ファイルのデータを並行して取得
    const posts = await Promise.all(slugs.map(async (slug) => {
        try {
            const mdRes = await fetch(`posts/${slug}.md`);
            if (!mdRes.ok) return null;
            const text = await mdRes.text();
            
            // 1行目の # タイトルを自動抽出
            const titleMatch = text.match(/^#\s+(.*)$/m);
            const title = titleMatch ? titleMatch[1] : slug;
            
            // 最初の画像をサムネイルとして自動抽出
            const imgMatch = text.match(/!\[.*?\]\((.*?)\)/);
            let image = imgMatch ? imgMatch[1] : null;
            if (image && !image.startsWith("http")) {
                image = `posts/${image}`;
            }

            return { slug, title, image };
        } catch {
            return null;
        }
    }));

    return posts.filter(p => p !== null);
}

// --- 4. ホームページ初期化 ---
async function initHomePage() {
    initTheme();
    await loadProfile();

    try {
        const res = await fetch("content.md");
        document.getElementById("markdownContent").innerHTML = marked.parse(await res.text());
    } catch {
        document.getElementById("markdownContent").innerHTML = "<p>content.md が見つかりません。</p>";
    }

    const feedEl = document.getElementById("postsFeed");
    const posts = await fetchAllPosts();

    feedEl.innerHTML = posts.length === 0 ? "<p class='loading-text'>投稿がありません。</p>" : "";
    posts.slice(0, 5).forEach(post => feedEl.appendChild(createPostCard(post)));
}

// --- 5. 投稿一覧ページ初期化 ---
async function initPostsPage() {
    initTheme();
    await loadProfile();

    const container = document.getElementById("allPostsContainer");
    const posts = await fetchAllPosts();

    container.innerHTML = posts.length === 0 ? "<p class='loading-text'>投稿がありません。</p>" : "";
    posts.forEach(post => container.appendChild(createPostCard(post)));
}

function createPostCard(post) {
    const a = document.createElement("a");
    a.className = "reddit-post-card";
    a.href = `post.html?slug=${post.slug}`;

    const imageHtml = post.image ? `<img src="${post.image}" class="post-card-media" alt="media">` : "";

    a.innerHTML = `
    <div class="post-meta"><i class="fa-solid fa-feather-pointed"></i> Post</div>
    <div class="post-card-title">${post.title}</div>
    ${imageHtml}
    `;
    return a;
}

// --- 6. 個別ポスト詳細ページ初期化 ---
async function initPostPage() {
    initTheme();
    await loadProfile();

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug"); // 例: ?slug=firest

    if (!slug) {
        document.getElementById("postContent").innerHTML = "<h2>エラー</h2><p>記事が指定されていません。</p>";
        return;
    }

    try {
        const res = await fetch(`posts/${slug}.md`);
        if (!res.ok) throw new Error("Markdown not found");
        
        const markdown = await res.text();
        
        // 画像の相対パスを正しく解決
        let fixedMd = markdown.replace(/src="(?!http)(.*?)"/g, `src="posts/$1"`);
        fixedMd = fixedMd.replace(/src='(?!http)(.*?)'/g, `src='posts/$1'`);

        document.getElementById("postContent").innerHTML = marked.parse(fixedMd);
    } catch (err) {
        document.getElementById("postContent").innerHTML = `<h2>記事の読み込みに失敗しました</h2><p>${err.message}</p>`;
    }
}