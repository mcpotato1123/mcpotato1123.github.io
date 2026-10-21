/* ============================================================================
   多语言（中 / 英 / 日）

   设计取舍：
   1. HTML 里保留**中文原文**，只加 data-i18n 键。这样 JS 失效时页面仍然是
      完整可读的中文版，而不是一片空白 —— 内容站不该把可读性押在脚本上。
   2. 词典集中在本文件，不散在 HTML 属性里。三语对照一眼能看到，
      改一句不用翻三个文件。
   3. 语言解析顺序：URL ?lang= > localStorage > 浏览器语言 > 中文兜底。
      URL 参数优先级最高，方便分享「直接是日文版」的链接。

   标记方式：
     data-i18n="key"            替换该元素的文本（会清掉子节点，见下方注意）
     data-i18n-html="key"       同上，但允许词典值里带 <em>/<strong>
     data-i18n-attr="aria-label:key,alt:key2"
                                替换属性，多个用逗号分隔

   注意：data-i18n 会**替换整个元素的文本内容**，所以只能用在纯文本元素上，
   元素里含 <em>/<svg>/<strong> 等子节点时要用 data-i18n-html（保留子节点则
   不能用，得给子节点单独标记）。
   ========================================================================== */
window.I18N = (function () {
  'use strict';

  var KEY = 'cenilla-lang';
  var LANGS = ['zh', 'zh-hant', 'en', 'ja', 'ko', 'es', 'ar'];
  var LABEL = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어', es: 'Español', ar: 'العربية', 'zh-hant': '繁體中文' };
  var HTML_LANG = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', es: 'es', ar: 'ar', 'zh-hant': 'zh-Hant' };
  /* 从右往左书写的语言。目前只有阿拉伯语，
     用来给 <html dir> 赋值 —— 整站的 RTL 排版都靠这个属性开关。 */
  var RTL_LANG = { ar: true };

  var DICT = {
    /* ---------- 顶栏 ---------- */
    'nav.works':      { zh: '作品下载', en: 'Downloads', ja: 'ダウンロード' },
    'nav.collage':    { zh: '合集卡片', en: 'Card Deck', ja: 'カード' },
    'nav.tools':      { zh: '在线工具', en: 'Tools', ja: 'ツール' },
    'nav.links':      { zh: '快速链接', en: 'Links', ja: 'リンク' },
    'nav.future':     { zh: '未来计划', en: 'Roadmap', ja: '今後の予定' },
    'nav.futureFull': { zh: '未来开发项目', en: 'Planned projects', ja: '今後の開発予定' },
    'nav.mirrors':    { zh: '镜像下载', en: 'Mirrors', ja: 'ミラー' },
    'nav.mirrorsFull':{ zh: 'Linux 镜像下载', en: 'Linux mirrors', ja: 'Linux ミラー' },
    'nav.faq':        { zh: '常见问题', en: 'FAQ', ja: 'よくある質問' },

    'a11y.brand':     { zh: 'mcpotato1123 的主页', en: 'mcpotato1123 — home', ja: 'mcpotato1123 のホーム' },
    'a11y.nav':       { zh: '站内导航', en: 'Site navigation', ja: 'サイト内ナビ' },
    'a11y.navMobile': { zh: '移动端导航', en: 'Mobile navigation', ja: 'モバイルナビ' },
    'a11y.github':    { zh: 'GitHub 主页', en: 'GitHub profile', ja: 'GitHub プロフィール' },
    'a11y.theme':     { zh: '切换深色 / 浅色主题', en: 'Toggle dark / light theme', ja: 'ダーク / ライトテーマを切り替え' },
    'a11y.menu':      { zh: '打开菜单', en: 'Open menu', ja: 'メニューを開く' },
    'a11y.lang':      { zh: '切换语言', en: 'Change language', ja: '言語を切り替え' },
    'a11y.accent':    { zh: '切换主色', en: 'Change accent colour', ja: 'アクセントカラーを変更' },

    /* 色板名称。读屏器靠它区分八个纯色圆点，所以每个都必须有名字。 */
    'accent.title':    { zh: '主色', en: 'Accent', ja: 'アクセント' },
    'accent.custom':   { zh: '自定义', en: 'Custom', ja: 'カスタム' },
    'accent.hue':      { zh: '色相', en: 'Hue', ja: '色相' },
    'accent.sv':       { zh: '饱和度与明度', en: 'Saturation and brightness', ja: '彩度と明度' },
    'accent.hex':      { zh: '十六进制色号', en: 'Hex colour code', ja: '16進カラーコード' },
    'accent.blue':     { zh: '品牌蓝',   en: 'Brand blue', ja: 'ブランドブルー' },
    'accent.violet':   { zh: '紫罗兰',   en: 'Violet',     ja: 'バイオレット' },
    'accent.teal':     { zh: '青色',     en: 'Teal',       ja: 'ティール' },
    'accent.emerald':  { zh: '墨绿',     en: 'Emerald',    ja: 'エメラルド' },
    'accent.amber':    { zh: '琥珀',     en: 'Amber',      ja: 'アンバー' },
    'accent.rose':     { zh: '玫红',     en: 'Rose',       ja: 'ローズ' },
    'accent.magenta':  { zh: '品红',     en: 'Magenta',    ja: 'マゼンタ' },
    'accent.graphite': { zh: '石墨',     en: 'Graphite',   ja: 'グラファイト' },
    'accent.sky':      { zh: '天蓝',     en: 'Sky blue',   ja: 'スカイブルー' },
    'accent.indigo':   { zh: '靛蓝',     en: 'Indigo',     ja: 'インディゴ' },
    'accent.olive':    { zh: '橄榄',     en: 'Olive',      ja: 'オリーブ' },
    'accent.coral':    { zh: '珊瑚',     en: 'Coral',      ja: 'コーラル' },
    'a11y.toTop':     { zh: '回到顶部', en: 'Back to top', ja: 'トップへ戻る' },

    /* 主题按钮的三态说明。**由 app.js 读取，不挂 data-i18n**（文案是动态的：
       按钮的 aria-label 要跟着当前主题变，静态标记做不到），
       所以「HTML 里没引用」不代表可以删。 */
    'theme.light':    { zh: '当前：浅色。点击切到深色', en: 'Now: light. Click for dark', ja: '現在：ライト。クリックでダーク' },
    'theme.dark':     { zh: '当前：深色。点击跟随系统', en: 'Now: dark. Click to follow system', ja: '現在：ダーク。クリックで自動' },
    'theme.auto':     { zh: '当前：跟随系统。点击切到浅色', en: 'Now: following system. Click for light', ja: '現在：自動。クリックでライト' },

    /* ---------- 首屏 ---------- */
    'hero.pill':      { zh: '欢迎来到项目主页', en: 'Welcome to the project home', ja: 'プロジェクトホームへようこそ' },
    'hero.lede': {
      zh: 'mcpotato1123 的主页 —— 小米手环快应用非官方移植，以及几个纯本地运行的小工具。很高兴你来到这里，欢迎访问。',
      en: 'The home page of mcpotato1123 — unofficial Mi Band quick-app ports, plus a few tools that run entirely in your browser. Glad you dropped by.',
      ja: 'mcpotato1123 のホームページ — Xiaomi スマートバンド向けクイックアプリの非公式移植と、ブラウザだけで動く小さなツール置き場です。ようこそ。'
    },
    'hero.ctaWorks':  { zh: '看看作品', en: 'See the ports', ja: '作品を見る' },
    'hero.ctaGithub': { zh: 'GitHub 主页', en: 'GitHub profile', ja: 'GitHub プロフィール' },
    'hero.stat1':     { zh: '款手环移植', en: 'band ports', ja: '件の移植' },
    'hero.stat2':     { zh: '个在线工具', en: 'web tools', ja: '個のツール' },
    'hero.stat3':     { zh: '浏览器本地处理', en: 'runs locally', ja: 'ブラウザ内処理' },
    'hero.scroll':    { zh: '向下浏览', en: 'Scroll down', ja: 'スクロール' },

    /* ---------- 走马灯 ---------- */
    'marquee.1': { zh: '小米手环快应用', en: 'Mi Band quick apps', ja: 'スマートバンド クイックアプリ' },
    'marquee.2': { zh: 'Vela 平台移植', en: 'Vela platform ports', ja: 'Vela プラットフォーム移植' },
    'marquee.3': { zh: '非官方移植', en: 'Unofficial ports', ja: '非公式移植' },
    'marquee.4': { zh: '纯本地文本工具', en: 'Local-only text tools', ja: 'ローカル完結のテキストツール' },
    'marquee.5': { zh: 'GitHub Pages', en: 'GitHub Pages', ja: 'GitHub Pages' },
    'marquee.6': { zh: 'Linux 镜像', en: 'Linux mirrors', ja: 'Linux ミラー' },
    'marquee.7': { zh: '开源 · 共建', en: 'Open source · contributions welcome', ja: 'オープンソース · 貢献歓迎' },

    /* ---------- 作品下载 ---------- */
    'works.kicker': { zh: '作品下载', en: 'Downloads', ja: 'ダウンロード' },
    'works.title':  { zh: '已经<em>戴得上手的作品。</em>', en: 'Ports you can <em>wear right now.</em>', ja: 'もう<em>身につけられる作品。</em>' },
    'works.lede': {
      zh: '目前公开的五款小米手环移植作品，均为非官方个人移植、免费提供。点下面的按钮会唤起 Astrobox 直接安装。',
      en: 'Five Mi Band ports are public so far — unofficial, made by one person, free of charge. The buttons below hand off to Astrobox to install.',
      ja: '現在公開中のスマートバンド移植は5作品。いずれも個人による非公式移植で、無料です。下のボタンから Astrobox を呼び出してインストールできます。'
    },
    'works.install':  { zh: '前往 Astrobox 安装', en: 'Install via Astrobox', ja: 'Astrobox でインストール' },
    'works.source':   { zh: '查看源码', en: 'View source', ja: 'ソースを見る' },
    'works.pending':  { zh: '待上传', en: 'Not uploaded yet', ja: '未アップロード' },
    'works.disabled': { zh: '暂不可用', en: 'Unavailable', ja: '利用不可' },
    'works.hint': {
      zh: '链接会唤起已安装的 Astrobox 客户端；还没装的话先去 Astrobox 官网下载。',
      en: 'The link opens your installed Astrobox client. If you do not have it yet, grab it from the Astrobox site first.',
      ja: 'リンクはインストール済みの Astrobox を起動します。未導入の場合は先に Astrobox 公式サイトから入手してください。'
    },
    'works.hintPending': {
      zh: '这一部还没上传，安装与源码都暂时打不开，等传完会一起放出来。',
      en: 'This one is not uploaded yet — both the install and the source link will open once it is.',
      ja: 'こちらはまだ未アップロードです。公開後にインストールとソースの両方が使えるようになります。'
    },
    'works.note': {
      zh: 'Astrobox 是一个穿戴设备第三方工具箱，可以在电脑或手机上把快应用安装到手环。',
      en: 'Astrobox is a third-party toolbox for wearables that installs quick apps onto the band from a computer or phone.',
      ja: 'Astrobox はウェアラブル向けのサードパーティ製ツールボックスで、PC やスマホからバンドにクイックアプリを入れられます。'
    },
    'works.noteLink': { zh: '前往 Astrobox 官网', en: 'Visit the Astrobox site', ja: 'Astrobox 公式サイトへ' },

    /* 作品状态角标 */
    'flag.live':      { zh: '已上线', en: 'Live', ja: '公開中' },
    'flag.pending':   { zh: '待上传', en: 'Pending', ja: '準備中' },

    /* 作品共同标签 */
    'tag.band9':      { zh: '小米手环 9 Pro', en: 'Mi Band 9 Pro', ja: 'Xiaomi Smart Band 9 Pro' },
    'tag.unofficial': { zh: '非官方移植', en: 'Unofficial port', ja: '非公式移植' },
    'tag.free':       { zh: '免费', en: 'Free', ja: '無料' },
    'tag.subtitle':   { zh: '小米手环非官方移植', en: 'Unofficial Mi Band port', ja: 'スマートバンド非公式移植' },

    /* 作品一：小小的身影 */
    'w1.title':   { zh: '小小的身影，重叠的内心', en: 'Tiny Shadows, Overlapping Hearts', ja: '小さな影、重なる心' },
    'w1.summary': {
      zh: '把《小小的身影，重叠的内心》搬进小米手环的非官方移植版，不用掏出手机，抬起手腕就能接着读下去。',
      en: 'An unofficial port that brings Tiny Shadows, Overlapping Hearts to the Mi Band. No need to pull out your phone — raise your wrist and keep reading.',
      ja: '『小さな影、重なる心』を Xiaomi スマートバンドに移植した非公式版。スマホを取り出さず、手首を上げるだけで続きが読めます。'
    },
    /* 作品二：GalGod */
    'w2.title':   { zh: '想成为 Galgame 领域大神！！！', en: 'I Want to Be a Galgame Master!!!', ja: 'ギャルゲーの神になりたい！！！' },
    'w2.summary': {
      zh: 'Galgod 的小米手环非官方移植版。原作是一部视觉小说，要做的只有读，然后在关键的地方替主角做决定。',
      en: 'An unofficial Mi Band port of Galgod. The original is a visual novel: all you do is read, and at the key moments decide on the protagonist\u2019s behalf.',
      ja: 'Galgod のスマートバンド非公式移植版。原作はビジュアルノベルで、やることは読むこと、そして要所で主人公の代わりに選択することだけです。'
    },
    /* 作品三：永恒与星辰与日常 */
    'w3.title':   { zh: '永恒与星辰与日常', en: 'Eternity, the Stars, and Everyday', ja: '永遠と星々と日常' },
    'w3.summary': {
      zh: '《永恒与星辰与日常》的小米手环非官方移植版。原作是一部视觉小说，讲的是普通日常里慢慢长出来的那点不普通。安装包正在上传，源码已经先公开了。',
      en: 'An unofficial Mi Band port of Eternity, the Stars, and Everyday. The original is a visual novel about the small extraordinary things that grow out of ordinary days. The build is still being uploaded; the source is already public.',
      ja: '『永遠と星々と日常』のスマートバンド非公式移植版。原作は、ありふれた日常の中に少しずつ芽生える「普通でないもの」を描いたビジュアルノベルです。ビルドはアップロード準備中で、ソースは先に公開しています。'
    },

    /* 作品五：夏末白夜 */
    'w5.title':   { zh: '夏末白夜', en: 'The White Night in Late Summer', ja: '夏末白夜' },
    'w5.summary': {
      zh: '《夏末白夜》的小米手环非官方移植版。还在整理阶段，安装包暂时没有上传到 Astrobox，源码已经先公开了。',
      en: 'An unofficial Mi Band port of The White Night in Late Summer. Still being put together — the build is not on Astrobox yet, but the source is already public.',
      ja: '『夏末白夜』のスマートバンド非公式移植版。まだ整理中で、ビルドは Astrobox に未アップロードですが、ソースは先に公開しています。'
    },
    /* 「尚未上传、但源码已公开」的提示。
       与 works.hintPendingBuild 的区别：那一条说的是「每日构建阶段」，
       这一条只说还没传 —— 不能把两件事的说法混用。 */
    'works.hintPendingSource': {
      zh: '安装包还没上传到 Astrobox，所以暂时装不了；想先看代码点「查看源码」。',
      en: 'The build is not on Astrobox yet, so it cannot be installed for now — hit “View source” to look at the code first.',
      ja: 'ビルドはまだ Astrobox に上がっていないため、今はインストールできません。先にコードを見るなら「ソースを見る」から。'
    },

    /* ---------- 合集卡片 ---------- */
    'collage.kicker': { zh: '合集卡片', en: 'Card deck', ja: 'カード' },
    'collage.title':  { zh: 'Galgame合集卡片喵~', en: 'The Galgame card deck~', ja: 'ギャルゲーカードコレクションにゃ〜' },
    'collage.lede': {
      zh: '一张卡把整套移植作品收在一起。按住往上拖、滚鼠标滚轮、或用方向键和下面的按钮都能翻页；序号下面的作品名就是安装入口，点进去由 Astrobox 打开。',
      en: 'One card holds the whole collection. Drag upward, use the mouse wheel, the arrow keys, or the buttons below to page through. The title under each number is the install entry — Astrobox takes over from there.',
      ja: '1枚のカードに作品をまとめています。上へドラッグ、マウスホイール、矢印キー、下のボタンのどれでもページを送れます。番号の下の作品名がインストール入口で、Astrobox が開きます。'
    },
    'collage.hint':   { zh: '拖动 / 滚轮翻页', en: 'Drag or scroll to flip', ja: 'ドラッグ / ホイールで送る' },
    'collage.a11yCard': { zh: 'Galgame 合集卡片，可上下拖动或滚动鼠标滚轮切换作品', en: 'Galgame card deck — drag vertically or scroll to switch works', ja: 'ギャルゲーカード。上下ドラッグまたはホイールで作品を切り替え' },
    'collage.a11yDots': { zh: '选择作品', en: 'Choose a work', ja: '作品を選択' },
    'collage.prev':   { zh: '上一部作品', en: 'Previous work', ja: '前の作品' },
    'collage.next':   { zh: '下一部作品', en: 'Next work', ja: '次の作品' },
    'collage.p1':     { zh: 'Galgame 移植合集', en: 'Galgame port collection', ja: 'ギャルゲー移植コレクション' },
    'collage.p1meta': { zh: '5 部作品 · 手环 9 Pro/10 Pro', en: '5 works · Band 9 Pro / 10 Pro', ja: '5作品 · バンド 9 Pro / 10 Pro' },
    'collage.p3meta': { zh: '快应用 · 手环 9 Pro', en: 'Quick app · Band 9 Pro', ja: 'クイックアプリ · バンド 9 Pro' },
    'collage.p2meta': { zh: '快应用 · 手环 9 Pro/10 Pro', en: 'Quick app · Band 9 Pro / 10 Pro', ja: 'クイックアプリ · バンド 9 Pro / 10 Pro' },
    'collage.p4meta': { zh: '待上传 · 源码已公开', en: 'Pending · source available', ja: '未アップロード · ソース公開中' },
    'collage.p5meta': { zh: '每日构建 · 源码已公开', en: 'Nightly build · source available', ja: 'デイリービルド · ソース公開中' },
    'collage.p6meta': { zh: '待上传 · 源码已公开', en: 'Pending · source available', ja: '未アップロード · ソース公開中' },

    /* ---------- 作品四：黄莓C（demo） ---------- */
    'w4.title':   { zh: '黄莓C', en: 'HUANGMEI C', ja: '黄莓C' },
    'w4.summary': {
      zh: '《黄莓C》的小米手环非官方移植版。目前是 demo 阶段，处于每日构建状态，安装包还没上传到 Astrobox，源码已经先公开了。',
      en: 'An unofficial Mi Band port of HUANGMEI C. It is a demo in nightly-build stage — the build is not on Astrobox yet, but the source is already public.',
      ja: '『黄莓C』のスマートバンド非公式移植版。現在は demo 段階でデイリービルド中、ビルドはまだ Astrobox に上がっていませんが、ソースは先に公開しています。'
    },
    'tag.demo':   { zh: 'Demo', en: 'Demo', ja: 'Demo' },
    'tag.pkg':    { zh: 'com.huangmeic.band', en: 'com.huangmeic.band', ja: 'com.huangmeic.band' },
    'works.hintPendingBuild': {
      zh: '每日构建阶段，安装包还没上传到 Astrobox，所以暂时装不了；想先看代码点「查看源码」。',
      en: 'It is in nightly-build stage and the build is not on Astrobox yet, so it cannot be installed for now — press \u201cView source\u201d to look at the code first.',
      ja: '現在はデイリービルド段階で、ビルドはまだ Astrobox に上がっていないため今はインストールできません。先にコードを見たい場合は「ソースを見る」を押してください。'
    },

    /* ---------- 快速链接 ---------- */
    'links.kicker': { zh: '快速链接', en: 'Links', ja: 'リンク' },
    'links.title':  { zh: '先从这里<em>找到我。</em>', en: 'Start here to <em>find me.</em>', ja: 'まずはここから<em>見つけてください。</em>' },
    'links.lede': {
      zh: '主要的活动据点。代码和各个项目都放在 GitHub，问题反馈也走那里。',
      en: 'My main haunts. Code and projects all live on GitHub, and that is where feedback goes too.',
      ja: '主な活動拠点です。コードと各プロジェクトは GitHub にあり、フィードバックもそちらで受けています。'
    },
    'links.ghDesc': { zh: '所有开源项目与源代码所在的地方，也是提交 Issue 和 PR 的入口。', en: 'Where all open-source projects and source code live — also the place to file issues and pull requests.', ja: 'オープンソースプロジェクトとソースコードの置き場。Issue や PR の窓口でもあります。' },
    'links.ghCta':  { zh: '打开主页', en: 'Open profile', ja: 'プロフィールを開く' },
    'links.mcbbsDesc': { zh: '早年混迹的 MCBBS 个人空间，站点本身早已关停，这里只留一个纪念性的入口。', en: 'My old MCBBS profile. The site itself shut down long ago, so this is just a memorial link.', ja: '昔お世話になった MCBBS の個人スペース。サイト自体はすでに閉鎖されているため、記念のリンクとして残しています。' },
    'links.mcbbsCta':  { zh: '去怀旧一下', en: 'Take a look back', ja: '懐かしむ' },

    /* ---------- 在线工具 ---------- */
    'tools.kicker': { zh: '在线工具', en: 'Tools', ja: 'ツール' },
    'tools.title':  { zh: '写剧本用的<em>那几把家伙。</em>', en: 'The <em>tools I write scripts with.</em>', ja: '台本を書くための<em>道具たち。</em>' },
    'tools.lede': {
      zh: '自己做的几个小工具，都是纯前端、本地运行 —— 文件不会被上传到任何服务器，断网也能用。',
      en: 'A few small tools I built myself. All front-end, all local — your files are never uploaded anywhere, and they work offline.',
      ja: '自分で作った小さなツール群。すべてフロントエンドのみでローカル動作 — ファイルはどこにも送信されず、オフラインでも使えます。'
    },
    'tools.live':   { zh: '已上线', en: 'Live', ja: '公開中' },
    'tools.t1':     { zh: 'Galgame 剧本编辑器', en: 'Galgame script editor', ja: 'ギャルゲー台本エディタ' },
    'tools.t1desc': { zh: '导入剧本后按页编辑背景、立绘、CG、说话人与文本，支持选项分支、批量替换文本、实时预览、撤销重做，最后导出成 <code>scriptData\\*.txt</code>。', en: 'Import a script and edit backgrounds, character art, CGs, speakers and text page by page. Supports branching choices, bulk text replacement, live preview and undo/redo, then exports to <code>scriptData\\*.txt</code>.', ja: '台本を読み込み、ページごとに背景・立ち絵・CG・話者・テキストを編集。選択肢分岐、テキスト一括置換、リアルタイムプレビュー、元に戻す / やり直しに対応し、<code>scriptData\\*.txt</code> として書き出します。' },
    'tools.t2':     { zh: 'Galgame 剧本格式转换器', en: 'Galgame script converter', ja: 'ギャルゲー台本フォーマット変換' },
    'tools.t2desc': { zh: '在原始剧本格式与 JSON 之间互转，也可以导入 JSON、导出 TXT，方便接别的流程或做批量处理。', en: 'Converts between the original script format and JSON. You can also import JSON or export TXT, handy for other pipelines or batch work.', ja: '独自の台本形式と JSON を相互変換します。JSON の読み込みや TXT の書き出しもでき、他の処理や一括作業に便利です。' },
    'tools.t3':     { zh: 'TXT 切割器', en: 'TXT splitter', ja: 'TXT 分割ツール' },
    'tools.t3desc': { zh: '把一个 TXT 按大小、行数、块数或章节分隔符切成多份，支持超大文本文件。拖入文件即用，全程在浏览器本地处理。', en: 'Splits a TXT by size, line count, chunk count or chapter delimiter, and handles very large files. Drop a file in and go — everything happens locally in the browser.', ja: 'TXT をサイズ・行数・分割数・章区切りで複数に分割。巨大なテキストファイルにも対応します。ファイルをドロップするだけで、処理はすべてブラウザ内で完結します。' },

    /* ---------- 未来开发项目 ---------- */
    'future.kicker': { zh: '未来开发项目', en: 'Roadmap', ja: '今後の予定' },
    'future.title':  { zh: '还在图纸上的<em>那一块。</em>', en: 'Still <em>on the drawing board.</em>', ja: 'まだ<em>図面の上にあるもの。</em>' },
    'future.lede':   { zh: '计划已经有了，时间也标了。在真正开起来之前，先放在这里。', en: 'The plans exist and the timing is marked. Until work actually starts, they sit here.', ja: '計画はすでにあり、時期も決めています。実際に動き出すまではここに置いておきます。' },
    'future.plan':   { zh: '计划中', en: 'Planned', ja: '計画中' },
    'future.tbd':    { zh: '待定', en: 'TBD', ja: '未定' },
    'future.f1':     { zh: '移植更多 Galgame', en: 'Port more Galgames', ja: 'さらなるギャルゲー移植' },
    'future.f1desc': { zh: '继续挑合适的作品做手环移植，流程走顺之后会稳定更新，欢迎在群里点名想看的。', en: 'I will keep picking suitable titles to port to the band. Once the workflow settles, updates should come steadily — feel free to name what you want to see.', ja: '引き続き合いそうな作品を選んでバンド移植していきます。流れが整えば安定して更新できる予定なので、見たい作品のリクエストも歓迎です。' },
    'future.f2':     { zh: '更多手环设备适配', en: 'Support more band models', ja: '対応バンドを増やす' },
    'future.f2desc': { zh: '现有移植只在小米手环 9 Pro 上验证过，后续会视设备情况继续扩。', en: 'The current ports are only verified on the Mi Band 9 Pro. Support will widen as devices allow.', ja: '現状の移植は Xiaomi Smart Band 9 Pro でのみ動作確認済みです。端末の状況に応じて順次対応を広げていきます。' },

    /* ---------- 镜像下载 ---------- */
    'mirrors.kicker': { zh: 'Linux 镜像下载', en: 'Linux mirrors', ja: 'Linux ミラー' },
    'mirrors.title':  { zh: '装系统要用的<em>那几张盘。</em>', en: 'The <em>images you need to install.</em>', ja: 'インストールに使う<em>あのイメージ。</em>' },
    'mirrors.lede':   { zh: '这里提供一些 Linux 镜像下载链接。', en: 'A few download links for Linux images.', ja: 'Linux イメージのダウンロードリンクをいくつか置いています。' },
    'mirrors.badge':  { zh: '123 云盘', en: '123 Cloud Drive', ja: '123 クラウド' },
    'mirrors.row':    { zh: 'Linux 镜像合集', en: 'Linux image collection', ja: 'Linux イメージ集' },
    'mirrors.rowDesc':{ zh: '常用发行版镜像打包上传，直接下载即可。', en: 'Common distribution images bundled together — just download.', ja: 'よく使うディストリビューションのイメージをまとめてあります。そのままダウンロードできます。' },

    /* ---------- 常见问题 ---------- */
    'faq.kicker': { zh: '常见问题', en: 'FAQ', ja: 'よくある質問' },
    'faq.title':  { zh: '你大概会问的<em>几个问题。</em>', en: 'The <em>questions you probably have.</em>', ja: 'たぶん気になる<em>いくつかの質問。</em>' },
    'faq.lede':   { zh: '关于作品状态、手环移植与本地工具，先把常见疑问集中在这里。', en: 'Common questions about release status, band ports and the local tools — collected in one place.', ja: '公開状況・バンド移植・ローカルツールについて、よくある疑問をここにまとめました。' },

    'faq.q1': { zh: '手环移植版是官方版本吗？', en: 'Are the band ports official releases?', ja: 'バンド移植版は公式ですか？' },
    'faq.a1': {
      zh: '不是。它是面向小米 Vela 设备的个人技术研究与适配成果，并非原作官方版本或授权衍生产品。作品名称、角色、剧情与美术资源的著作权归原作者及相关权利人所有，本站不主张任何原作权利。原项目地址见卡片上的仓库链接。',
      en: 'No. It is personal technical research and adaptation work for Xiaomi Vela devices, not an official release or a licensed derivative. The rights to the titles, characters, story and artwork belong to the original authors and their rights holders; this site claims no rights over the original works. The upstream project link is on each card.',
      ja: 'いいえ。Xiaomi Vela デバイス向けの個人的な技術研究・移植成果であり、原作の公式版や許諾を得た派生作品ではありません。作品名・キャラクター・シナリオ・美術素材の著作権は原作者および権利者に帰属し、当サイトはいかなる原作の権利も主張しません。原プロジェクトの URL は各カードにあります。'
    },

    'faq.q2': { zh: '目前适配了哪些设备？', en: 'Which devices are supported so far?', ja: '対応している端末は？' },
    'faq.a2': {
      zh: '当前公开的两款移植都面向<strong>小米手环 9 Pro</strong>。快应用形态的适配高度依赖屏幕尺寸，方屏设备（如手环 8 Pro / 10 Pro、REDMI Watch 系列）比例不同，直接安装会出现构图错位，请不要混装。更多机型的适配会视设备情况陆续补上。',
      en: 'The two ports released so far target the <strong>Mi Band 9 Pro</strong>. Quick-app layouts depend heavily on screen dimensions; square-screen devices (Band 8 Pro / 10 Pro, REDMI Watch series) have different proportions, so installing directly will misalign the composition — please do not mix them. More models will be added as devices allow.',
      ja: '現在公開している2作品はいずれも<strong>Xiaomi Smart Band 9 Pro</strong>向けです。クイックアプリは画面サイズに強く依存するため、角型画面の端末（Band 8 Pro / 10 Pro、REDMI Watch シリーズ）では比率が異なり、そのまま入れると構図がずれます。混在させないでください。対応機種は端末の状況に応じて順次追加します。'
    },

    'faq.q3': { zh: '怎么把作品装到手环上？', en: 'How do I install a port on my band?', ja: 'バンドへの入れ方は？' },
    'faq.a3': {
      zh: '通过 <a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a> 安装。先装好客户端并连接手环，再点作品卡上的「前往 Astrobox 安装」按钮，浏览器会唤起 Astrobox 并直接打开对应资源。装好后在手环的应用列表里就能找到它。',
      en: 'Install it through <a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a>. Set up the client and connect your band first, then press the install button on the card — the browser hands off to Astrobox and opens the resource directly. Once done, the app shows up in your band\u2019s app list.',
      ja: '<a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a> からインストールします。先にクライアントを用意してバンドを接続し、カードのインストールボタンを押すと、ブラウザが Astrobox を起動して該当リソースを直接開きます。完了するとバンドのアプリ一覧に表示されます。'
    },

    'faq.q4': { zh: '这两款作品收费吗？', en: 'Do these ports cost anything?', ja: 'これらの作品は有料ですか？' },
    'faq.a4': {
      zh: '免费。《小小的身影，重叠的内心》与《想成为 Galgame 领域大神！！！》都是非官方的个人移植作品，不收取任何费用，也不代表原作售价。',
      en: 'They are free. Both Tiny Shadows, Overlapping Hearts and I Want to Be a Galgame Master!!! are unofficial personal ports. No fee is charged, and this says nothing about the price of the original works.',
      ja: '無料です。『小さな影、重なる心』と『ギャルゲーの神になりたい！！！』はいずれも非公式の個人移植作品で、一切の費用はかかりません。原作の価格を示すものでもありません。'
    },

    'faq.q5': { zh: '那些工具会把我的文件传走吗？', en: 'Do the tools upload my files?', ja: 'ツールはファイルを送信しますか？' },
    'faq.a5': {
      zh: '不会。「在线工具」里的三个工具（剧本编辑器、剧本格式转换器、TXT 切割器）全部纯前端运行，文件只在你自己的浏览器里读写，不会离开本机，也不经过任何服务器。断网状态下同样可以正常使用。',
      en: 'No. All three tools under “Tools” (script editor, script converter, TXT splitter) run purely on the front end. Files are read and written only inside your own browser — they never leave your machine and never touch a server. They also work with no network at all.',
      ja: 'いいえ。「ツール」にある3つ（台本エディタ、台本フォーマット変換、TXT 分割）はすべてフロントエンドのみで動作します。ファイルはお使いのブラウザ内だけで読み書きされ、端末から出ることもサーバーを経由することもありません。オフラインでも問題なく使えます。'
    },

    'faq.q6': { zh: '遇到问题去哪里反馈？', en: 'Where should I report problems?', ja: '問題の報告先は？' },
    'faq.a6': {
      zh: '最直接的方式是在对应项目的 GitHub 仓库里提 Issue，附上设备和复现步骤。也可以通过页脚的 QQ 群找到我。',
      en: 'The most direct way is to open an issue on the relevant GitHub repository, including your device and the steps to reproduce. You can also reach me through the QQ group in the footer.',
      ja: 'もっとも確実なのは、該当する GitHub リポジトリで Issue を立てていただく方法です。端末と再現手順を添えてください。フッターの QQ グループから連絡していただくこともできます。'
    },

    /* ---------- 页脚 ---------- */
    'footer.tagline': { zh: '小米手环快应用非官方移植，以及几个纯本地运行的小工具。', en: 'Unofficial Mi Band quick-app ports, plus a few tools that run entirely locally.', ja: 'Xiaomi スマートバンド向けクイックアプリの非公式移植と、ローカル完結の小さなツール群。' },
    'footer.tag1':    { zh: '快应用移植', en: 'Quick-app ports', ja: 'クイックアプリ移植' },
    'footer.tag2':    { zh: '本地处理', en: 'Local processing', ja: 'ローカル処理' },
    'footer.tag3':    { zh: '持续更新', en: 'Actively updated', ja: '継続更新' },
    'footer.findMe':  { zh: '找到我', en: 'Find me', ja: '連絡先' },
    'footer.bili':    { zh: '哔哩哔哩 · mcpotato', en: 'Bilibili · mcpotato', ja: 'bilibili · mcpotato' },
    'footer.qq':      { zh: '玩家交流 QQ 群', en: 'Player QQ group', ja: 'プレイヤー QQ グループ' },
    'footer.navA11y': { zh: '页脚导航', en: 'Footer navigation', ja: 'フッターナビ' },
    'footer.onSite':  { zh: '站内', en: 'On this site', ja: 'サイト内' },
    'footer.offSite': { zh: '站外', en: 'Elsewhere', ja: 'サイト外' },
    'footer.ghProfile': { zh: 'GitHub 主页', en: 'GitHub profile', ja: 'GitHub プロフィール' },
    'footer.srcObe':  { zh: 'ourbriefeternity-band 源码', en: 'ourbriefeternity-band source', ja: 'ourbriefeternity-band ソース' },
    'footer.srcHm':   { zh: 'huangmeic-band 源码', en: 'huangmeic-band source', ja: 'huangmeic-band ソース' },
    'footer.srcGal':  { zh: 'galgod-band 源码', en: 'galgod-band source', ja: 'galgod-band ソース' },
    'footer.srcTiny': { zh: 'tinyshadows-band 源码', en: 'tinyshadows-band source', ja: 'tinyshadows-band ソース' },
    'footer.mcbbs':   { zh: 'MCBBS 存档', en: 'MCBBS archive', ja: 'MCBBS アーカイブ' },
    'footer.related': { zh: '相关链接', en: 'Related links', ja: '関連リンク' },
    'footer.relInstall': { zh: 'Astrobox 安装 · 手环 9 Pro', en: 'Install via Astrobox · Band 9 Pro', ja: 'Astrobox でインストール · バンド 9 Pro' },
    'footer.relTinySrc': { zh: '《小小的身影》移植源码', en: 'Tiny Shadows port source', ja: '『小さな影』移植ソース' },
    'footer.relGalSrc':  { zh: 'GalGod 移植源码', en: 'GalGod port source', ja: 'GalGod 移植ソース' },
    'footer.relObeSrc':  { zh: '《永恒与星辰与日常》源码 · 安装包待上传', en: 'Eternity port source · build pending', ja: '『永遠と星々と日常』ソース · ビルド準備中' },
    'footer.relHmSrc':   { zh: '《黄莓C》源码 · 安装包待上传', en: 'HUANGMEI C port source · build pending', ja: '『黄莓C』ソース · ビルド準備中' },
    'footer.relMirror':  { zh: 'Linux 镜像合集', en: 'Linux image collection', ja: 'Linux イメージ集' },
    'footer.relMirrorSub': { zh: '123 云盘直链', en: 'Direct link on 123 Cloud Drive', ja: '123 クラウドの直リンク' },
    'footer.relGhList':  { zh: 'GitHub 仓库列表', en: 'GitHub repositories', ja: 'GitHub リポジトリ一覧' },
    'footer.relGhListSub': { zh: '全部开源项目', en: 'All open-source projects', ja: 'オープンソースプロジェクト一覧' },

    'footer.disclaimer': { zh: '免责声明', en: 'Disclaimer', ja: '免責事項' },
    'footer.disclaimer1': {
      zh: '「作品下载」中的五款移植均为面向小米 Vela 设备的<strong>非官方个人移植</strong>，并非原作官方版本或授权衍生产品，与原作者、小米（Xiaomi）及 Astrobox 官方均无关联。《小小的身影，重叠的内心》《想成为 Galgame 领域大神！！！》（GalGod）《永恒与星辰与日常》《黄莓C》《夏末白夜》的名称、角色、剧情与美术资源，著作权均归各自原作者及相关权利人所有，本站不主张任何原作权利。',
      en: 'The five ports under “Downloads” are <strong>unofficial personal ports</strong> for Xiaomi Vela devices. They are not official releases or licensed derivatives, and are unaffiliated with the original authors, Xiaomi, or Astrobox. Rights to the titles, characters, story and artwork of Tiny Shadows, Overlapping Hearts; I Want to Be a Galgame Master!!! (GalGod); Eternity, the Stars, and Everyday; HUANGMEI C; and The White Night in Late Summer belong to their respective authors and rights holders; this site claims no rights over the original works.',
      ja: '「ダウンロード」に掲載している5作品の移植は、Xiaomi Vela デバイス向けの<strong>非公式な個人移植</strong>であり、原作の公式版や許諾を得た派生作品ではありません。原作者、Xiaomi、Astrobox のいずれとも関係ありません。『小さな影、重なる心』『ギャルゲーの神になりたい！！！』（GalGod）『永遠と星々と日常』『黄莓C』『夏末白夜』の名称・キャラクター・シナリオ・美術素材の著作権は、それぞれの原作者および権利者に帰属し、当サイトはいかなる原作の権利も主張しません。'
    },
    'footer.disclaimer2': {
      zh: '五款移植均免费提供，不收取任何费用，也不代表原作售价；请通过正规渠道支持原作。使用、修改或传播本站所涉内容所产生的<strong>风险与责任由使用者自行承担</strong>。',
      en: 'All five ports are provided free of charge, and this does not reflect the price of the original works; please support the originals through official channels. <strong>Any risk or liability arising from using, modifying or redistributing content referenced here rests with the user.</strong>',
      ja: '移植はいずれも無料で提供しており、費用は一切かかりません。原作の価格を示すものでもありません。原作は正規の手段でご支援ください。当サイトの内容を利用・改変・配布することで生じる<strong>リスクと責任は利用者ご自身が負うものとします</strong>。'
    },
    'footer.copyright': { zh: '持续更新中', en: 'updated regularly', ja: '随時更新中' },
    'footer.builtWith': { zh: '用 HTML / CSS / JS 手写，没有框架', en: 'Hand-written in HTML / CSS / JS — no framework', ja: 'HTML / CSS / JS で手書き。フレームワーク不使用' },

    /* ---------- 移植预告横幅 ----------
       键名仍用 ginka.* —— 那是这枚横幅最初的代号，换文案不必动键名
       （改名要同时改 HTML、CSS、JS 三处，收益为零）。 */
    'ginka.tag':  { zh: '移植预告', en: 'Coming next', ja: '移植予告' },
    'ginka.text': {
      zh: '下一部：<strong>海蓝星之梦</strong> —— 将要开始移植，不久就能在手环上看到它。',
      en: 'Next up: <strong>Dream of BluePlanet</strong> — the port is about to start; it will land on the band soon.',
      ja: '次は <strong>海藍星の夢</strong> —— まもなく移植に着手します。もうすぐにバンドで見られるようになります。'
    },


  };

  /* ---------- 后加的三种语言：韩语 / 西班牙语 / 阿拉伯语 ------------------
     为什么用“补丁表”而不是把上面每一行拆开重排：
     一条词条已经写了 zh/en/ja 三列，再往里塞三列会把 179 行全部拉长，
     既难对照也难 diff。这里单独罗列后加语言，有一对一的完整覆盖，
     缺一条在下面的校验里会直接报出来。 */
  var EXTRA = {
    'nav.works':      { ko: '작품 다운로드', es: 'Descargas', ar: 'التنزيلات' },
    'nav.collage':    { ko: '모음 카드', es: 'Baraja', ar: 'بطاقة المجموعة' },
    'nav.tools':      { ko: '온라인 도구', es: 'Herramientas', ar: 'الأدوات' },
    'nav.links':      { ko: '바로가기', es: 'Enlaces', ar: 'روابط' },
    'nav.future':     { ko: '향후 계획', es: 'Hoja de ruta', ar: 'الخطة' },
    'nav.futureFull': { ko: '향후 개발 프로젝트', es: 'Proyectos previstos', ar: 'مشاريع قادمة' },
    'nav.mirrors':    { ko: '미러 다운로드', es: 'Espejos', ar: 'مرايا' },
    'nav.mirrorsFull':{ ko: 'Linux 미러 다운로드', es: 'Espejos de Linux', ar: 'مرايا Linux' },
    'nav.faq':        { ko: '자주 묻는 질문', es: 'Preguntas frecuentes', ar: 'الأسئلة الشائعة' },

    'a11y.brand':     { ko: 'mcpotato1123의 홈', es: 'Inicio de mcpotato1123', ar: 'الصفحة الرئيسية لـ mcpotato1123' },
    'a11y.nav':       { ko: '사이트 내비게이션', es: 'Navegación del sitio', ar: 'تنقل الموقع' },
    'a11y.navMobile': { ko: '모바일 내비게이션', es: 'Navegación móvil', ar: 'تنقل الجوال' },
    'a11y.github':    { ko: 'GitHub 프로필', es: 'Perfil de GitHub', ar: 'ملف GitHub' },
    'a11y.theme':     { ko: '다크 / 라이트 테마 전환', es: 'Cambiar tema claro / oscuro', ar: 'تبديل الوضع الفاتح / الداكن' },
    'a11y.menu':      { ko: '메뉴 열기', es: 'Abrir menú', ar: 'فتح القائمة' },
    'a11y.lang':      { ko: '언어 변경', es: 'Cambiar idioma', ar: 'تغيير اللغة' },
    'a11y.accent':    { ko: '강조색 변경', es: 'Cambiar color de acento', ar: 'تغيير اللون المميز' },

    'accent.title':    { ko: '강조색', es: 'Acento', ar: 'اللون المميز' },
    'accent.custom':   { ko: '사용자 지정', es: 'Personalizado', ar: 'مخصص' },
    'accent.hue':      { ko: '색상', es: 'Tono', ar: 'درجة اللون' },
    'accent.sv':       { ko: '채도와 밝기', es: 'Saturación y brillo', ar: 'التشبع والسطوع' },
    'accent.hex':      { ko: '16진수 색상 코드', es: 'Código de color hex', ar: 'رمز اللون السداسي عشري' },
    'accent.blue':     { ko: '브랜드 블루', es: 'Azul de marca', ar: 'الأزرق الأساسي' },
    'accent.violet':   { ko: '바이올렛', es: 'Violeta', ar: 'بنفسجي' },
    'accent.teal':     { ko: '틸', es: 'Verde azulado', ar: 'أزرق مخضر' },
    'accent.emerald':  { ko: '에메랄드', es: 'Esmeralda', ar: 'زمردي' },
    'accent.amber':    { ko: '앰버', es: 'Ámbar', ar: 'عنبري' },
    'accent.rose':     { ko: '로즈', es: 'Rosa', ar: 'وردي' },
    'accent.magenta':  { ko: '마젠타', es: 'Magenta', ar: 'أرجواني' },
    'accent.graphite': { ko: '그래파이트', es: 'Grafito', ar: 'جرافيت' },
    'accent.sky':      { ko: '스카이 블루', es: 'Azul cielo', ar: 'أزرق سماوي' },
    'accent.indigo':   { ko: '인디고', es: 'Índigo', ar: 'نيلي' },
    'accent.olive':    { ko: '올리브', es: 'Oliva', ar: 'زيتوني' },
    'accent.coral':    { ko: '코럴', es: 'Coral', ar: 'مرجاني' },
    'a11y.toTop':      { ko: '맨 위로', es: 'Volver arriba', ar: 'العودة إلى الأعلى' },
    'theme.light':     { ko: '현재: 라이트. 클릭하면 다크', es: 'Ahora: claro. Pulsa para oscuro', ar: 'الآن: فاتح. اضغط للداكن' },
    'theme.dark':      { ko: '현재: 다크. 클릭하면 시스템 설정', es: 'Ahora: oscuro. Pulsa para seguir el sistema', ar: 'الآن: داكن. اضغط لمتابعة النظام' },
    'theme.auto':      { ko: '현재: 시스템 설정. 클릭하면 라이트', es: 'Ahora: siguiendo el sistema. Pulsa para claro', ar: 'الآن: يتبع النظام. اضغط للفاتح' },

    'hero.pill':      { ko: '프로젝트 홈페이지에 오신 것을 환영합니다', es: 'Bienvenido a la página del proyecto', ar: 'مرحبًا بك في الصفحة الرئيسية للمشروع' },
    'hero.lede':      { ko: 'mcpotato1123의 홈 — 샤오미 밴드 퀵 앱 비공식 이식과 브라우저에서 완전히 실행되는 몇 가지 도구. 방문해 주셔서 감사합니다.', es: 'La página de mcpotato1123: ports no oficiales de quick apps para Xiaomi Smart Band y algunas herramientas que funcionan por completo en tu navegador. Gracias por pasarte.', ar: 'الصفحة الرئيسية لـ mcpotato1123 — نُسخ منقولة غير رسمية لتطبيقات Xiaomi Smart Band السريعة، وأدوات تعمل بالكامل داخل متصفحك. شكرًا لمرورك.' },
    'hero.ctaWorks':  { ko: '작품 보기', es: 'Ver los ports', ar: 'شاهد الأعمال' },
    'hero.ctaGithub': { ko: 'GitHub 프로필', es: 'Perfil de GitHub', ar: 'ملف GitHub' },
    'hero.stat1':     { ko: '개의 밴드 이식', es: 'ports para band', ar: 'نُسخ للساعة' },
    'hero.stat2':     { ko: '개의 웹 도구', es: 'herramientas web', ar: 'أدوات ويب' },
    'hero.stat3':     { ko: '브라우저에서 처리', es: 'se ejecuta local', ar: 'يعمل محليًا' },
    'hero.scroll':    { ko: '아래로 스크롤', es: 'Desplázate', ar: 'اسحب لأسفل' },

    'marquee.1': { ko: '샤오미 밴드 퀵 앱', es: 'Quick apps para Mi Band', ar: 'تطبيقات سريعة للساعة' },
    'marquee.2': { ko: 'Vela 플랫폼 이식', es: 'Ports para la plataforma Vela', ar: 'نقل لمنصة Vela' },
    'marquee.3': { ko: '비공식 이식', es: 'Ports no oficiales', ar: 'نقل غير رسمي' },
    'marquee.4': { ko: '로컬 전용 텍스트 도구', es: 'Herramientas de texto locales', ar: 'أدوات نصية محلية' },
    'marquee.5': { ko: 'GitHub Pages', es: 'GitHub Pages', ar: 'GitHub Pages' },
    'marquee.6': { ko: 'Linux 미러', es: 'Espejos de Linux', ar: 'مرايا Linux' },
    'marquee.7': { ko: '오픈 소스 · 함께 만들기', es: 'Código abierto · contribuciones', ar: 'مفتوح المصدر · مرحّب بالمساهمات' },

    'works.kicker': { ko: '작품 다운로드', es: 'Descargas', ar: 'التنزيلات' },
    'works.title':  { ko: '지금 <em>손목에 차는 작품.</em>', es: 'Ports que puedes <em>llevar puestos.</em>', ar: 'أعمال <em>يمكنك ارتداؤها الآن.</em>' },
    'works.lede': {
      ko: '현재 공개된 샤오미 밴드 이식 작품 다섯 개입니다. 모두 개인이 만든 비공식 이식이며 무료입니다. 아래 버튼을 누르면 Astrobox가 열려 바로 설치할 수 있습니다.',
      es: 'Hasta ahora hay cinco ports para Xiaomi Smart Band, todos no oficiales, hechos por una persona y gratis. Los botones de abajo abren Astrobox para instalarlos.',
      ar: 'خمس نُسخ منقولة لساعة Xiaomi Smart Band منشورة حتى الآن، وكلها غير رسمية وبجهد فردي ومجانية. الأزرار أدناه تفتح Astrobox للتثبيت.'
    },
    'works.install':  { ko: 'Astrobox로 설치', es: 'Instalar con Astrobox', ar: 'التثبيت عبر Astrobox' },
    'works.source':   { ko: '소스 보기', es: 'Ver código', ar: 'عرض المصدر' },
    'works.pending':  { ko: '업로드 대기', es: 'Sin subir aún', ar: 'لم يُرفع بعد' },
    'works.disabled': { ko: '사용 불가', es: 'No disponible', ar: 'غير متاح' },
    'works.hint': {
      ko: '링크를 누르면 설치된 Astrobox 클라이언트가 열립니다. 아직 없다면 Astrobox 공식 사이트에서 먼저 받아 주세요.',
      es: 'El enlace abre el cliente Astrobox instalado. Si aún no lo tienes, descárgalo antes desde el sitio de Astrobox.',
      ar: 'يفتح الرابط تطبيق Astrobox المثبت لديك. وإن لم يكن مثبتًا فحمّله أولًا من موقع Astrobox.'
    },
    'works.hintPending': {
      ko: '이 작품은 아직 업로드되지 않아 설치와 소스 링크가 모두 열리지 않습니다. 업로드가 끝나면 함께 공개됩니다.',
      es: 'Este aún no está subido, así que ni la instalación ni el enlace al código funcionan por ahora. Se abrirán juntos cuando esté listo.',
      ar: 'لم يُرفع هذا العمل بعد، لذا لا يعمل رابطا التثبيت والمصدر الآن. سيُتاحان معًا عند الرفع.'
    },
    'works.note': {
      ko: 'Astrobox는 웨어러블용 서드파티 도구 상자로, PC나 휴대폰에서 밴드에 퀵 앱을 설치할 수 있습니다.',
      es: 'Astrobox es una caja de herramientas de terceros para wearables que instala quick apps en la band desde un ordenador o un móvil.',
      ar: 'Astrobox صندوق أدوات خارجي للأجهزة القابلة للارتداء، يتيح تثبيت التطبيقات السريعة على الساعة من الحاسوب أو الهاتف.'
    },
    'works.noteLink': { ko: 'Astrobox 공식 사이트로', es: 'Ir al sitio de Astrobox', ar: 'زيارة موقع Astrobox' },
    'flag.live':      { ko: '공개 중', es: 'Publicado', ar: 'متاح' },
    'flag.pending':   { ko: '업로드 대기', es: 'Pendiente', ar: 'قيد الانتظار' },
    'tag.band9':      { ko: '샤오미 밴드 9 Pro', es: 'Xiaomi Smart Band 9 Pro', ar: 'Xiaomi Smart Band 9 Pro' },
    'tag.unofficial': { ko: '비공식 이식', es: 'Port no oficial', ar: 'نقل غير رسمي' },
    'tag.free':       { ko: '무료', es: 'Gratis', ar: 'مجاني' },
    'tag.subtitle':   { ko: '샤오미 밴드 비공식 이식', es: 'Port no oficial para Mi Band', ar: 'نقل غير رسمي لساعة Xiaomi' },
    'w1.title':   { ko: '작은 모습, 겹치는 마음', es: 'Pequeñas sombras, corazones que se cruzan', ar: 'ظلال صغيرة وقلوب متقاطعة' },
    'w1.summary': {
      ko: '《작은 모습, 겹치는 마음》을 샤오미 밴드로 옮긴 비공식 이식판입니다. 휴대폰을 꺼내지 않고 손목만 들어도 이어서 읽을 수 있습니다.',
      es: 'Un port no oficial que lleva Pequeñas sombras, corazones que se cruzan a la Mi Band. Sin sacar el móvil: levanta la muñeca y sigue leyendo.',
      ar: 'نسخة منقولة غير رسمية تنقل «ظلال صغيرة وقلوب متقاطعة» إلى ساعة Mi Band. لا حاجة لإخراج هاتفك — ارفع معصمك وتابع القراءة.'
    },
    'w2.title':   { ko: '갸루게 장르의 신이 되고 싶어!!!', es: '¡Quiero ser un maestro del galgame!', ar: 'أريد أن أصبح سيد الغالغيم!!!' },
    'w2.summary': {
      ko: 'Galgod의 샤오미 밴드 비공식 이식판입니다. 원작은 비주얼 노벨로, 읽고 중요한 순간에 주인공 대신 선택하는 것이 전부입니다.',
      es: 'Un port no oficial de Galgod para la Mi Band. El original es una novela visual: solo lees y, en los momentos clave, decides por el protagonista.',
      ar: 'نسخة منقولة غير رسمية من Galgod إلى ساعة Mi Band. الأصل رواية بصرية: تقرأ فقط، وفي اللحظات المفصلية تقرر نيابة عن البطل.'
    },
    'w3.title':   { ko: '영원과 별과 일상', es: 'Eternidad, las estrellas y lo cotidiano', ar: 'الأبد والنجوم واليومي' },
    'w3.summary': {
      ko: '《영원과 별과 일상》의 샤오미 밴드 비공식 이식판입니다. 평범한 일상에서 천천히 자라나는 조금 특별한 무언가를 그린 비주얼 노벨입니다. 설치 파일은 업로드 중이고, 소스는 먼저 공개했습니다.',
      es: 'Un port no oficial de Eternidad, las estrellas y lo cotidiano. El original es una novela visual sobre lo extraordinario que crece despacio en los días normales. El paquete aún se está subiendo; el código ya es público.',
      ar: 'نسخة منقولة غير رسمية من «الأبد والنجوم واليومي». الأصل رواية بصرية عن الأشياء غير العادية التي تنمو ببطء داخل الأيام العادية. ما زال الملف يُرفع، والمصدر متاح بالفعل.'
    },
    'w5.title':   { ko: '여름 끝의 백야', es: 'La noche blanca del final del verano', ar: 'الليلة البيضاء في آخر الصيف' },
    'w5.summary': {
      ko: '《여름 끝의 백야》의 샤오미 밴드 비공식 이식판입니다. 아직 정리 중이라 설치 파일은 Astrobox에 올라가지 않았고, 소스는 먼저 공개했습니다.',
      es: 'Un port no oficial de La noche blanca del final del verano. Todavía en preparación: el paquete no está en Astrobox, pero el código ya es público.',
      ar: 'نسخة منقولة غير رسمية من «الليلة البيضاء في آخر الصيف». ما زال قيد الإعداد، فالملف ليس على Astrobox بعد، لكن المصدر متاح بالفعل.'
    },
    'works.hintPendingSource': {
      ko: '설치 파일이 아직 Astrobox에 올라가지 않아 지금은 설치할 수 없습니다. 코드부터 보려면 「소스 보기」를 누르세요.',
      es: 'El paquete aún no está en Astrobox, así que por ahora no se puede instalar; pulsa «Ver código» para echar un vistazo primero.',
      ar: 'الملف ليس على Astrobox بعد، لذا لا يمكن التثبيت حاليًا؛ اضغط «عرض المصدر» لتفقّد الشيفرة أولًا.'
    },

    'collage.kicker': { ko: '모음 카드', es: 'Baraja', ar: 'بطاقة المجموعة' },
    'collage.title':  { ko: '갸루게 모음 카드냥~', es: 'La baraja de galgames~', ar: 'بطاقة أعمال الغالغيم~' },
    'collage.lede': {
      ko: '카드 하나에 이식 작품 전체가 담겨 있습니다. 위로 끌거나 마우스 휠, 방향키, 아래 버튼으로 넘길 수 있습니다. 번호 아래 작품명이 설치 입구이고, 누르면 Astrobox가 열립니다.',
      es: 'Una sola tarjeta reúne toda la colección. Arrastra hacia arriba, usa la rueda, las flechas o los botones de abajo para pasar páginas. El título bajo cada número es la entrada de instalación: Astrobox toma el relevo.',
      ar: 'بطاقة واحدة تجمع المجموعة كاملة. اسحب لأعلى أو استخدم عجلة الفأرة أو الأسهم أو الأزرار أدناه لتقليب الصفحات. عنوان كل عمل هو مدخل التثبيت، ويتولى Astrobox الأمر من هناك.'
    },
    'collage.hint':   { ko: '끌기 / 휠로 넘기기', es: 'Arrastra o usa la rueda', ar: 'اسحب أو مرّر للتقليب' },
    'collage.a11yCard': { ko: '갸루게 모음 카드, 위아래로 끌거나 휠을 굴려 작품 전환', es: 'Baraja de galgames: arrastra en vertical o usa la rueda para cambiar de obra', ar: 'بطاقة أعمال الغالغيم — اسحب رأسيًا أو مرّر للتنقل بين الأعمال' },
    'collage.a11yDots': { ko: '작품 선택', es: 'Elige una obra', ar: 'اختر عملًا' },
    'collage.prev':   { ko: '이전 작품', es: 'Obra anterior', ar: 'العمل السابق' },
    'collage.next':   { ko: '다음 작품', es: 'Obra siguiente', ar: 'العمل التالي' },
    'collage.p1':     { ko: '갸루게 이식 모음', es: 'Colección de ports de galgame', ar: 'مجموعة نقل الغالغيم' },
    'collage.p1meta': { ko: '작품 5종 · 밴드 9 Pro/10 Pro', es: '5 obras · Band 9 Pro / 10 Pro', ar: '5 أعمال · Band 9 Pro / 10 Pro' },
    'collage.p3meta': { ko: '퀵 앱 · 밴드 9 Pro', es: 'Quick app · Band 9 Pro', ar: 'تطبيق سريع · Band 9 Pro' },
    'collage.p2meta': { ko: '퀵 앱 · 밴드 9 Pro/10 Pro', es: 'Quick app · Band 9 Pro / 10 Pro', ar: 'تطبيق سريع · Band 9 Pro / 10 Pro' },
    'collage.p4meta': { ko: '업로드 대기 · 소스 공개됨', es: 'Pendiente · código disponible', ar: 'قيد الرفع · المصدر متاح' },
    'collage.p5meta': { ko: '데일리 빌드 · 소스 공개됨', es: 'Compilación diaria · código disponible', ar: 'بناء يومي · المصدر متاح' },
    'collage.p6meta': { ko: '업로드 대기 · 소스 공개됨', es: 'Pendiente · código disponible', ar: 'قيد الرفع · المصدر متاح' },
    'w4.title':   { ko: '황메이C', es: 'HUANGMEI C', ar: 'HUANGMEI C' },
    'w4.summary': {
      ko: '《황메이C》의 샤오미 밴드 비공식 이식판입니다. 현재 데모 단계로 데일리 빌드 중이며, 설치 파일은 아직 Astrobox에 올라가지 않았고 소스는 먼저 공개했습니다.',
      es: 'Un port no oficial de HUANGMEI C para la Mi Band. Está en fase de demo, con compilaciones diarias: el paquete aún no está en Astrobox, pero el código ya es público.',
      ar: 'نسخة منقولة غير رسمية من HUANGMEI C إلى ساعة Mi Band. ما زالت في مرحلة العرض التجريبي ببناء يومي، والملف ليس على Astrobox بعد، لكن المصدر متاح بالفعل.'
    },
    'tag.demo':   { ko: '데모', es: 'Demo', ar: 'تجريبي' },
    'tag.pkg':    { ko: 'com.huangmeic.band', es: 'com.huangmeic.band', ar: 'com.huangmeic.band' },
    'works.hintPendingBuild': {
      ko: '데일리 빌드 단계라 설치 파일이 아직 Astrobox에 없어 지금은 설치할 수 없습니다. 코드부터 보려면 「소스 보기」를 누르세요.',
      es: 'Está en fase de compilación diaria y el paquete aún no está en Astrobox, así que por ahora no se puede instalar; pulsa «Ver código» para verlo primero.',
      ar: 'ما زال في مرحلة البناء اليومي والملف ليس على Astrobox بعد، لذا لا يمكن التثبيت حاليًا؛ اضغط «عرض المصدر» لتفقّد الشيفرة أولًا.'
    },

    'links.kicker': { ko: '바로가기', es: 'Enlaces', ar: 'روابط' },
    'links.title':  { ko: '여기서부터 <em>저를 찾아보세요.</em>', es: 'Empieza por aquí para <em>encontrarme.</em>', ar: 'ابدأ من هنا <em>لتجدني.</em>' },
    'links.lede': {
      ko: '제 주요 활동 거점입니다. 코드와 프로젝트는 모두 GitHub에 있고, 문제 제보도 그쪽으로 받습니다.',
      es: 'Mis puntos principales. El código y los proyectos están en GitHub, y las incidencias también van allí.',
      ar: 'أماكن نشاطي الأساسية. الشيفرة والمشاريع كلها على GitHub، والملاحظات تصل عبره أيضًا.'
    },
    'links.ghDesc': {
      ko: '모든 오픈 소스 프로젝트와 소스 코드가 있는 곳이며, Issue와 PR을 보내는 입구이기도 합니다.',
      es: 'Donde viven todos los proyectos de código abierto y su código, y también el lugar para abrir issues y pull requests.',
      ar: 'حيث توجد كل المشاريع مفتوحة المصدر وشيفرتها، وهو أيضًا مدخل فتح البلاغات وطلبات الدمج.'
    },
    'links.ghCta':  { ko: '프로필 열기', es: 'Abrir perfil', ar: 'فتح الملف' },
    'links.mcbbsDesc': {
      ko: '예전에 활동하던 MCBBS 개인 공간입니다. 사이트 자체는 오래전에 종료되었고, 여기에는 기념용 입구만 남겨 두었습니다.',
      es: 'Mi antiguo perfil de MCBBS. El sitio cerró hace mucho, así que este es solo un enlace conmemorativo.',
      ar: 'ملفي القديم على MCBBS. أُغلق الموقع نفسه منذ زمن، لذا هذا مجرد رابط تذكاري.'
    },
    'links.mcbbsCta': { ko: '추억 보러 가기', es: 'Echar un vistazo al pasado', ar: 'استحضار الذكرى' },

    'tools.kicker': { ko: '온라인 도구', es: 'Herramientas', ar: 'الأدوات' },
    'tools.title':  { ko: '대본 쓸 때 쓰는 <em>그 도구들.</em>', es: 'Las <em>herramientas con las que escribo.</em>', ar: 'الأدوات <em>التي أكتب بها النصوص.</em>' },
    'tools.lede': {
      ko: '직접 만든 작은 도구들로, 모두 순수 프런트엔드에서 로컬로 실행됩니다. 파일이 어떤 서버로도 전송되지 않으며 오프라인에서도 쓸 수 있습니다.',
      es: 'Unas herramientas pequeñas que hice yo. Todas de front-end y locales: tus archivos nunca se suben a ningún servidor y funcionan sin conexión.',
      ar: 'أدوات صغيرة صنعتها بنفسي. كلها واجهة أمامية وتعمل محليًا: لا تُرفع ملفاتك إلى أي خادم، وتعمل دون اتصال أيضًا.'
    },
    'tools.live':   { ko: '공개 중', es: 'Publicada', ar: 'متاحة' },
    'tools.t1':     { ko: '갸루게 대본 편집기', es: 'Editor de guiones galgame', ar: 'محرر نصوص الغالغيم' },
    'tools.t1desc': {
      ko: '대본을 불러오면 페이지별로 배경, 입화, CG, 화자와 텍스트를 편집할 수 있습니다. 선택지 분기, 텍스트 일괄 치환, 실시간 미리보기, 실행 취소/다시 실행을 지원하고 마지막에 <code>scriptData*.txt</code>로 내보냅니다.',
      es: 'Importa un guion y edita página a página fondos, personajes, CGs, hablantes y texto. Admite ramas de decisión, reemplazo masivo, vista previa en vivo y deshacer/rehacer, y exporta a <code>scriptData*.txt</code>.',
      ar: 'استورد النص وحرّر الخلفيات والشخصيات وصور CG والمتحدثين والنص صفحة بصفحة. يدعم فروع الخيارات والاستبدال الجماعي والمعاينة الحية والتراجع والإعادة، ثم يصدّر إلى <code>scriptData*.txt</code>.'
    },
    'tools.t2':     { ko: '갸루게 대본 형식 변환기', es: 'Conversor de formato de guiones', ar: 'محوّل صيغة نصوص الغالغيم' },
    'tools.t2desc': {
      ko: '원본 대본 형식과 JSON을 서로 변환하며, JSON 가져오기와 TXT 내보내기도 됩니다. 다른 흐름에 붙이거나 일괄 처리할 때 편합니다.',
      es: 'Convierte entre el formato original del guion y JSON. También puedes importar JSON o exportar TXT, útil para otros flujos o procesamiento por lotes.',
      ar: 'يحوّل بين صيغة النص الأصلية وJSON. يمكنك أيضًا استيراد JSON أو تصدير TXT، وهو مفيد لمسار آخر أو للمعالجة الجماعية.'
    },
    'tools.t3':     { ko: 'TXT 분할기', es: 'Divisor de TXT', ar: 'مقسّم TXT' },
    'tools.t3desc': {
      ko: 'TXT 하나를 크기, 줄 수, 블록 수, 장 구분자 기준으로 여러 개로 나눕니다. 아주 큰 텍스트 파일도 지원하며, 파일을 끌어다 놓으면 브라우저 안에서만 처리됩니다.',
      es: 'Divide un TXT por tamaño, número de líneas, número de bloques o delimitador de capítulo, y admite archivos muy grandes. Suelta el archivo y listo: todo ocurre localmente en el navegador.',
      ar: 'يقسّم ملف TXT حسب الحجم أو عدد الأسطر أو عدد الكتل أو فاصل الفصول، ويتعامل مع الملفات الضخمة. أفلت الملف وابدأ — كل شيء يجري محليًا داخل المتصفح.'
    },

    'future.kicker': { ko: '향후 개발 프로젝트', es: 'Hoja de ruta', ar: 'مشاريع قادمة' },
    'future.title':  { ko: '아직 <em>도면 위에 있는 것들.</em>', es: 'Todavía <em>en la mesa de dibujo.</em>', ar: 'ما زال <em>على لوح الرسم.</em>' },
    'future.lede': {
      ko: '계획은 있고 시점도 표시해 두었습니다. 실제로 시작하기 전까지는 여기에 둡니다.',
      es: 'Los planes existen y los tiempos están marcados. Hasta que el trabajo empiece de verdad, se quedan aquí.',
      ar: 'الخطط موجودة ومواعيدها محددة. وإلى أن يبدأ العمل فعليًا تبقى هنا.'
    },
    'future.plan': { ko: '계획 중', es: 'Previsto', ar: 'مخطط له' },
    'future.tbd':  { ko: '미정', es: 'Por determinar', ar: 'يُحدد لاحقًا' },
    'future.f1':   { ko: '갸루게 이식 확대', es: 'Portar más galgames', ar: 'نقل المزيد من أعمال الغالغيم' },
    'future.f1desc': {
      ko: '적합한 작품을 계속 골라 밴드로 이식할 예정입니다. 작업 흐름이 자리 잡으면 꾸준히 업데이트하니, 보고 싶은 작품을 알려 주셔도 좋습니다.',
      es: 'Seguiré eligiendo títulos adecuados para portarlos a la band. Cuando el flujo de trabajo se estabilice, las actualizaciones serán regulares: puedes decirme qué te gustaría ver.',
      ar: 'سأواصل اختيار أعمال مناسبة لنقلها إلى الساعة. وعندما يستقر مسار العمل ستأتي التحديثات بانتظام — ويمكنك إخباري بما تريد رؤيته.'
    },
    'future.f2':   { ko: '더 많은 밴드 기기 지원', es: 'Soportar más modelos de band', ar: 'دعم مزيد من موديلات الساعة' },
    'future.f2desc': {
      ko: '현재 이식은 샤오미 밴드 9 Pro에서만 검증했습니다. 기기 상황에 따라 지원을 넓혀 갈 예정입니다.',
      es: 'Los ports actuales solo están verificados en la Mi Band 9 Pro. El soporte se ampliará según lo permitan los dispositivos.',
      ar: 'النُسخ الحالية مُتحقَّق منها على Mi Band 9 Pro فقط. وسيتوسّع الدعم بحسب الأجهزة المتاحة.'
    },

    'mirrors.kicker': { ko: 'Linux 미러 다운로드', es: 'Espejos de Linux', ar: 'مرايا Linux' },
    'mirrors.title':  { ko: '설치에 필요한 <em>그 이미지들.</em>', es: 'Las <em>imágenes que necesitas instalar.</em>', ar: 'الصور <em>اللازمة للتثبيت.</em>' },
    'mirrors.lede':   { ko: 'Linux 이미지 다운로드 링크를 모아 두었습니다.', es: 'Algunos enlaces de descarga de imágenes de Linux.', ar: 'روابط تنزيل لبعض صور Linux.' },
    'mirrors.badge':  { ko: '123 클라우드', es: '123 Cloud Drive', ar: '123 Cloud Drive' },
    'mirrors.row':    { ko: 'Linux 이미지 모음', es: 'Colección de imágenes Linux', ar: 'مجموعة صور Linux' },
    'mirrors.rowDesc': {
      ko: '자주 쓰는 배포판 이미지를 묶어 올려 두었습니다. 바로 받으시면 됩니다.',
      es: 'Imágenes de las distribuciones habituales empaquetadas juntas: solo tienes que descargarlas.',
      ar: 'صور التوزيعات الشائعة مجموعة معًا — نزّلها مباشرة.'
    },

    'faq.kicker': { ko: '자주 묻는 질문', es: 'Preguntas frecuentes', ar: 'الأسئلة الشائعة' },
    'faq.title':  { ko: '아마 궁금하실 <em>몇 가지.</em>', es: 'Las <em>preguntas que probablemente tengas.</em>', ar: 'الأسئلة <em>التي قد تخطر ببالك.</em>' },
    'faq.lede': {
      ko: '작품 상태, 밴드 이식, 로컬 도구에 관한 흔한 질문을 여기에 모았습니다.',
      es: 'Las dudas habituales sobre el estado de los ports, la adaptación a la band y las herramientas locales, reunidas en un solo lugar.',
      ar: 'الأسئلة المتكررة عن حالة الأعمال ونقلها إلى الساعة والأدوات المحلية، مجموعة في مكان واحد.'
    },
    'faq.q1': { ko: '밴드 이식판은 공식 버전인가요?', es: '¿Los ports para la band son versiones oficiales?', ar: 'هل نُسخ الساعة إصدارات رسمية؟' },
    'faq.a1': {
      ko: '아닙니다. 샤오미 Vela 기기를 대상으로 한 개인 기술 연구 및 적응 결과물이며, 원작의 공식 버전이나 허가받은 파생물이 아닙니다. 작품명, 캐릭터, 시나리오, 미술 자원의 저작권은 각 원작자와 권리자에게 있으며, 본 사이트는 어떤 원작 권리도 주장하지 않습니다. 원본 프로젝트 주소는 카드의 저장소 링크에 있습니다.',
      es: 'No. Es trabajo personal de investigación técnica y adaptación para dispositivos Xiaomi Vela, no una versión oficial ni un derivado con licencia. Los derechos sobre títulos, personajes, historia y arte pertenecen a sus autores y titulares; este sitio no reclama ningún derecho sobre las obras originales. El enlace al proyecto original está en cada tarjeta.',
      ar: 'لا. هو عمل بحث وتكييف تقني شخصي لأجهزة Xiaomi Vela، وليس إصدارًا رسميًا ولا مشتقًا مرخّصًا. حقوق العناوين والشخصيات والقصة والرسوم تعود لأصحابها؛ وهذا الموقع لا يدّعي أي حق على الأعمال الأصلية. رابط المشروع الأصلي موجود في كل بطاقة.'
    },
    'faq.q2': { ko: '지금 어떤 기기를 지원하나요?', es: '¿Qué dispositivos son compatibles ahora?', ar: 'ما الأجهزة المدعومة حتى الآن؟' },
    'faq.a2': {
      ko: '현재 공개된 이식판은 <strong>샤오미 밴드 9 Pro</strong>를 대상으로 합니다. 퀵 앱 형태는 화면 크기에 크게 의존하며, 사각 화면 기기(밴드 8 Pro / 10 Pro, REDMI Watch 계열)는 비율이 달라 그대로 설치하면 구도가 어긋납니다. 섞어서 설치하지 마세요. 더 많은 기기는 상황에 따라 차례로 지원할 예정입니다.',
      es: 'Los ports publicados hasta ahora apuntan a la <strong>Mi Band 9 Pro</strong>. Las quick apps dependen mucho del tamaño de pantalla; los dispositivos de pantalla cuadrada (Band 8 Pro / 10 Pro, serie REDMI Watch) tienen otras proporciones, así que instalarlas tal cual descuadra la composición: no las mezcles. Se irán añadiendo más modelos según lo permitan los dispositivos.',
      ar: 'تستهدف النُسخ المنشورة حتى الآن <strong>Mi Band 9 Pro</strong>. تعتمد التطبيقات السريعة كثيرًا على مقاس الشاشة، والأجهزة ذات الشاشة المربعة (Band 8 Pro / 10 Pro وسلسلة REDMI Watch) لها نسب مختلفة، ولذلك سيختل التكوين إذا ثبّتتها مباشرة — الرجاء عدم الخلط بينها. وستُضاف موديلات أخرى تدريجيًا بحسب الأجهزة.'
    },
    'faq.q3': { ko: '작품을 밴드에 어떻게 설치하나요?', es: '¿Cómo instalo un port en mi band?', ar: 'كيف أثبّت نسخة على الساعة؟' },
    'faq.a3': {
      ko: '<a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a>로 설치합니다. 먼저 클라이언트를 설치하고 밴드를 연결한 뒤, 작품 카드의 「Astrobox로 설치」 버튼을 누르면 브라우저가 Astrobox를 열어 해당 리소스를 바로 엽니다. 설치가 끝나면 밴드의 앱 목록에서 찾을 수 있습니다.',
      es: 'Se instala con <a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a>. Primero instala el cliente y conecta la band; luego pulsa el botón de instalación de la tarjeta y el navegador abrirá Astrobox con el recurso correspondiente. Al terminar, la app aparecerá en la lista de tu band.',
      ar: 'يُثبَّت عبر <a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a>. ثبّت التطبيق واتصل بالساعة أولًا، ثم اضغط زر التثبيت في البطاقة وسيفتح المتصفح Astrobox على المورد المطلوب مباشرة. وبعد الانتهاء ستجده في قائمة تطبيقات الساعة.'
    },
    'faq.q4': { ko: '이 작품들은 유료인가요?', es: '¿Estos ports cuestan dinero?', ar: 'هل هذه النُسخ مدفوعة؟' },
    'faq.a4': {
      ko: '무료입니다. 《작은 모습, 겹치는 마음》과 《갸루게 장르의 신이 되고 싶어!!!》 모두 개인이 만든 비공식 이식판으로, 어떤 비용도 받지 않으며 원작 가격과도 무관합니다.',
      es: 'Son gratis. Tanto Pequeñas sombras, corazones que se cruzan como ¡Quiero ser un maestro del galgame! son ports no oficiales hechos por una persona. No se cobra nada y esto no dice nada sobre el precio de las obras originales.',
      ar: 'مجانية. كلٌّ من «ظلال صغيرة وقلوب متقاطعة» و«أريد أن أصبح سيد الغالغيم!!!» نسختان منقولتان غير رسميتان بجهد فردي، ولا يُحصَّل أي مقابل، ولا علاقة لذلك بسعر الأعمال الأصلية.'
    },
    'faq.q5': { ko: '그 도구들이 제 파일을 전송하나요?', es: '¿Esas herramientas suben mis archivos?', ar: 'هل ترفع تلك الأدوات ملفاتي؟' },
    'faq.a5': {
      ko: '아니요. 「온라인 도구」의 세 도구(대본 편집기, 대본 형식 변환기, TXT 분할기)는 모두 순수 프런트엔드로 동작합니다. 파일은 오직 사용자의 브라우저 안에서만 읽고 쓰이며, 기기를 벗어나지 않고 어떤 서버도 거치지 않습니다. 네트워크 없이도 정상적으로 사용할 수 있습니다.',
      es: 'No. Las tres herramientas de «Herramientas» (editor de guiones, conversor de formato y divisor de TXT) funcionan por completo en el front-end. Los archivos solo se leen y escriben dentro de tu navegador: nunca salen de tu equipo ni pasan por ningún servidor. También funcionan sin conexión.',
      ar: 'لا. الأدوات الثلاث في «الأدوات» (محرر النصوص ومحوّل الصيغة ومقسّم TXT) تعمل بواجهة أمامية بحتة. تُقرأ الملفات وتُكتب داخل متصفحك فقط، ولا تغادر جهازك ولا تمر بأي خادم. وهي تعمل أيضًا دون اتصال بالشبكة.'
    },
    'faq.q6': { ko: '문제가 생기면 어디에 알리나요?', es: '¿Dónde informo de un problema?', ar: 'أين أبلّغ عن مشكلة؟' },
    'faq.a6': {
      ko: '가장 직접적인 방법은 해당 프로젝트의 GitHub 저장소에 Issue를 올리는 것입니다. 기기와 재현 절차를 적어 주세요. 페이지 하단의 QQ 그룹으로도 연락할 수 있습니다.',
      es: 'Lo más directo es abrir un issue en el repositorio de GitHub del proyecto, indicando el dispositivo y los pasos para reproducirlo. También puedes encontrarme en el grupo de QQ del pie de página.',
      ar: 'الطريقة الأكثر مباشرة هي فتح بلاغ في مستودع GitHub الخاص بالمشروع، مع ذكر الجهاز وخطوات إعادة المشكلة. ويمكنك أيضًا الوصول إليّ عبر مجموعة QQ في تذييل الصفحة.'
    },

    'footer.tagline': { ko: '샤오미 밴드 퀵 앱 비공식 이식, 그리고 완전히 로컬에서 도는 몇 가지 도구.', es: 'Ports no oficiales de quick apps para Mi Band y algunas herramientas que funcionan por completo en local.', ar: 'نُسخ منقولة غير رسمية لتطبيقات Xiaomi Smart Band السريعة، وأدوات تعمل محليًا بالكامل.' },
    'footer.tag1': { ko: '퀵 앱 이식', es: 'Ports de quick apps', ar: 'نقل التطبيقات السريعة' },
    'footer.tag2': { ko: '로컬 처리', es: 'Procesado local', ar: 'معالجة محلية' },
    'footer.tag3': { ko: '계속 업데이트', es: 'Actualizado con frecuencia', ar: 'يُحدَّث باستمرار' },
    'footer.findMe': { ko: '연락처', es: 'Encuéntrame', ar: 'تجدني هنا' },
    'footer.bili': { ko: '빌리빌리 · mcpotato', es: 'Bilibili · mcpotato', ar: 'Bilibili · mcpotato' },
    'footer.qq': { ko: '플레이어 QQ 그룹', es: 'Grupo QQ de jugadores', ar: 'مجموعة QQ للاعبين' },
    'footer.navA11y': { ko: '바닥글 내비게이션', es: 'Navegación del pie', ar: 'تنقل التذييل' },
    'footer.onSite': { ko: '이 사이트', es: 'En este sitio', ar: 'داخل الموقع' },
    'footer.offSite': { ko: '외부', es: 'Fuera del sitio', ar: 'خارج الموقع' },
    'footer.ghProfile': { ko: 'GitHub 프로필', es: 'Perfil de GitHub', ar: 'ملف GitHub' },
    'footer.srcObe': { ko: 'ourbriefeternity-band 소스', es: 'Código de ourbriefeternity-band', ar: 'مصدر ourbriefeternity-band' },
    'footer.srcHm': { ko: 'huangmeic-band 소스', es: 'Código de huangmeic-band', ar: 'مصدر huangmeic-band' },
    'footer.srcGal': { ko: 'galgod-band 소스', es: 'Código de galgod-band', ar: 'مصدر galgod-band' },
    'footer.srcTiny': { ko: 'tinyshadows-band 소스', es: 'Código de tinyshadows-band', ar: 'مصدر tinyshadows-band' },
    'footer.mcbbs': { ko: 'MCBBS 아카이브', es: 'Archivo de MCBBS', ar: 'أرشيف MCBBS' },
    'footer.related': { ko: '관련 링크', es: 'Enlaces relacionados', ar: 'روابط ذات صلة' },
    'footer.relInstall': { ko: 'Astrobox 설치 · 밴드 9 Pro', es: 'Instalar con Astrobox · Band 9 Pro', ar: 'التثبيت عبر Astrobox · Band 9 Pro' },
    'footer.relTinySrc': { ko: '《작은 모습》 이식 소스', es: 'Código del port de Pequeñas sombras', ar: 'مصدر نقل ظلال صغيرة' },
    'footer.relGalSrc': { ko: 'GalGod 이식 소스', es: 'Código del port de GalGod', ar: 'مصدر نقل GalGod' },
    'footer.relObeSrc': { ko: '《영원과 별과 일상》 소스 · 설치 파일 업로드 대기', es: 'Código de Eternidad · paquete pendiente', ar: 'مصدر الأبد · الملف قيد الرفع' },
    'footer.relHmSrc': { ko: '《황메이C》 소스 · 설치 파일 업로드 대기', es: 'Código de HUANGMEI C · paquete pendiente', ar: 'مصدر HUANGMEI C · الملف قيد الرفع' },
    'footer.relMirror': { ko: 'Linux 이미지 모음', es: 'Colección de imágenes Linux', ar: 'مجموعة صور Linux' },
    'footer.relMirrorSub': { ko: '123 클라우드 직링크', es: 'Enlace directo en 123 Cloud Drive', ar: 'رابط مباشر على 123 Cloud Drive' },
    'footer.relGhList': { ko: 'GitHub 저장소 목록', es: 'Lista de repositorios de GitHub', ar: 'قائمة مستودعات GitHub' },
    'footer.relGhListSub': { ko: '전체 오픈 소스 프로젝트', es: 'Todos los proyectos abiertos', ar: 'كل المشاريع مفتوحة المصدر' },
    'footer.disclaimer': { ko: '면책 조항', es: 'Aviso legal', ar: 'إخلاء المسؤولية' },
    'footer.disclaimer1': {
      ko: '「작품 다운로드」의 다섯 이식판은 모두 샤오미 Vela 기기를 위한 <strong>비공식 개인 이식</strong>이며, 원작의 공식 버전이나 허가받은 파생물이 아닙니다. 원작자, 샤오미(Xiaomi), Astrobox 공식과도 무관합니다. 《작은 모습, 겹치는 마음》《갸루게 장르의 신이 되고 싶어!!!》(GalGod)《영원과 별과 일상》《황메이C》《여름 끝의 백야》의 이름, 캐릭터, 시나리오, 미술 자원의 저작권은 각 원작자와 권리자에게 있으며, 본 사이트는 어떤 원작 권리도 주장하지 않습니다.',
      es: 'Los cinco ports de «Descargas» son <strong>ports personales no oficiales</strong> para dispositivos Xiaomi Vela. No son versiones oficiales ni derivados con licencia, y no tienen relación con los autores originales, Xiaomi ni Astrobox. Los derechos sobre títulos, personajes, historia y arte de Pequeñas sombras, corazones que se cruzan; ¡Quiero ser un maestro del galgame! (GalGod); Eternidad, las estrellas y lo cotidiano; HUANGMEI C; y La noche blanca del final del verano pertenecen a sus respectivos autores y titulares; este sitio no reclama ningún derecho sobre las obras originales.',
      ar: 'النُسخ الخمس في «التنزيلات» هي <strong>نُسخ شخصية غير رسمية</strong> لأجهزة Xiaomi Vela، وليست إصدارات رسمية ولا مشتقات مرخّصة، ولا علاقة لها بأصحاب الأعمال الأصلية ولا بـ Xiaomi ولا بـ Astrobox. حقوق العناوين والشخصيات والقصة والرسوم في «ظلال صغيرة وقلوب متقاطعة» و«أريد أن أصبح سيد الغالغيم!!!» (GalGod) و«الأبد والنجوم واليومي» وHUANGMEI C و«الليلة البيضاء في آخر الصيف» تعود لأصحابها؛ وهذا الموقع لا يدّعي أي حق على الأعمال الأصلية.'
    },
    'footer.disclaimer2': {
      ko: '다섯 이식판 모두 무료로 제공되며 어떤 비용도 받지 않습니다. 이는 원작의 가격을 뜻하지 않으니 정식 경로로 원작을 응원해 주세요. 본 사이트가 다루는 내용을 사용·수정·배포함으로써 발생하는 <strong>위험과 책임은 이용자 본인에게 있습니다</strong>.',
      es: 'Los cinco ports se ofrecen gratis y no suponen ningún coste, ni reflejan el precio de las obras originales; apoya a los originales por canales oficiales. <strong>Cualquier riesgo o responsabilidad derivada de usar, modificar o redistribuir el contenido aquí referido recae en el usuario.</strong>',
      ar: 'تُقدَّم النُسخ الخمس مجانًا دون أي مقابل، وهذا لا يعبّر عن سعر الأعمال الأصلية؛ ادعم الأعمال الأصلية عبر القنوات الرسمية. <strong>أي مخاطر أو مسؤولية تنشأ عن استخدام محتوى هذا الموقع أو تعديله أو إعادة توزيعه تقع على المستخدم.</strong>'
    },
    'footer.copyright': { ko: '계속 업데이트 중', es: 'actualizado con frecuencia', ar: 'يُحدَّث باستمرار' },
    'footer.builtWith': { ko: 'HTML / CSS / JS로 직접 작성, 프레임워크 없음', es: 'Escrito a mano en HTML / CSS / JS, sin frameworks', ar: 'مكتوب يدويًا بـ HTML / CSS / JS دون أي إطار عمل' },

    'ginka.tag':  { ko: '이식 예고', es: 'Próximamente', ar: 'قريبًا' },
    'ginka.text': {
      ko: '다음 작품: <strong>바다빛 별의 꿈</strong> —— 곧 이식을 시작합니다. 머지않아 밴드에서 만날 수 있습니다.',
      es: 'Siguiente: <strong>Dream of BluePlanet</strong> — el port está a punto de empezar; pronto llegará a la band.',
      ar: 'التالي: <strong>Dream of BluePlanet</strong> — سيبدأ النقل قريبًا، وسيصل إلى الساعة بعد وقت قصير.'
    }
  };

  Object.keys(EXTRA).forEach(function (k) {
    if (!DICT[k]) return;                 /* 对应不上的键直接跳过，不会把 DICT 污染 */
    DICT[k].ko = EXTRA[k].ko;
    DICT[k].es = EXTRA[k].es;
    DICT[k].ar = EXTRA[k].ar;
  });

  /* ---------- 繁體中文 ----------------------------------------------------
     台灣/港澳用词不只是字形差异（下載 vs 下载、程式碼 vs 代码、
     資訊 vs 信息），所以这一表是按用词惯例重寫的，不是简转繁字形。
     键名用 'zh-hant' 而不是 'tw'：它是语言子标签，不代表地区。 */
  var HANT = {
    'nav.works': '作品下載',
    'nav.collage': '合集卡片',
    'nav.tools': '線上工具',
    'nav.links': '快速連結',
    'nav.future': '未來計畫',
    'nav.futureFull': '未來開發專案',
    'nav.mirrors': '鏡像下載',
    'nav.mirrorsFull': 'Linux 鏡像下載',
    'nav.faq': '常見問題',
    'a11y.brand': 'mcpotato1123 的首頁',
    'a11y.nav': '站內導覽',
    'a11y.navMobile': '行動版導覽',
    'a11y.github': 'GitHub 個人頁',
    'a11y.theme': '切換深色 / 淺色主題',
    'a11y.menu': '開啟選單',
    'a11y.lang': '切換語言',
    'a11y.accent': '切換主色',
    'accent.title': '主色',
    'accent.custom': '自訂',
    'accent.hue': '色相',
    'accent.sv': '飽和度與明度',
    'accent.hex': '十六進位色碼',
    'accent.blue': '品牌藍',
    'accent.violet': '紫羅蘭',
    'accent.teal': '青色',
    'accent.emerald': '墨綠',
    'accent.amber': '琥珀',
    'accent.rose': '玫紅',
    'accent.magenta': '品紅',
    'accent.graphite': '石墨',
    'accent.sky': '天藍',
    'accent.indigo': '靛藍',
    'accent.olive': '橄欖',
    'accent.coral': '珊瑚',
    'a11y.toTop': '回到頂端',
    'theme.light': '目前：淺色。點擊切換深色',
    'theme.dark': '目前：深色。點擊跟隨系統',
    'theme.auto': '目前：跟隨系統。點擊切換淺色',
    'hero.pill': '歡迎來到專案首頁',
    'hero.lede': 'mcpotato1123 的首頁 —— 小米手環快應用非官方移植，以及幾個完全在本機執行的小工具。很高興你來到這裡，歡迎參觀。',
    'hero.ctaWorks': '看看作品',
    'hero.ctaGithub': 'GitHub 個人頁',
    'hero.stat1': '款手環移植',
    'hero.stat2': '個線上工具',
    'hero.stat3': '瀏覽器本機處理',
    'hero.scroll': '向下瀏覽',
    'marquee.1': '小米手環快應用',
    'marquee.2': 'Vela 平台移植',
    'marquee.3': '非官方移植',
    'marquee.4': '純本機文字工具',
    'marquee.5': 'GitHub Pages',
    'marquee.6': 'Linux 鏡像',
    'marquee.7': '開源 · 共建',
    'works.kicker': '作品下載',
    'works.title': '已經<em>戴得上手的作品。</em>',
    'works.lede': '目前公開的五款小米手環移植作品，皆為非官方個人移植、免費提供。點下面的按鈕會喚起 Astrobox 直接安裝。',
    'works.install': '前往 Astrobox 安裝',
    'works.source': '查看原始碼',
    'works.pending': '待上傳',
    'works.disabled': '暫不可用',
    'works.hint': '連結會喚起已安裝的 Astrobox 用戶端；還沒裝的話請先到 Astrobox 官網下載。',
    'works.hintPending': '這部還沒上傳，安裝與原始碼都暫時無法開啟，上傳完成後會一起公開。',
    'works.note': 'Astrobox 是一個穿戴裝置的第三方工具箱，可以在電腦或手機上把快應用安裝到手環。',
    'works.noteLink': '前往 Astrobox 官網',
    'flag.live': '已上線',
    'flag.pending': '待上傳',
    'tag.band9': '小米手環 9 Pro',
    'tag.unofficial': '非官方移植',
    'tag.free': '免費',
    'tag.subtitle': '小米手環非官方移植',
    'w1.title': '小小的身影，重疊的內心',
    'w1.summary': '把《小小的身影，重疊的內心》搬進小米手環的非官方移植版，不用拿出手機，抬起手腕就能繼續讀下去。',
    'w2.title': '想成為 Galgame 領域大神！！！',
    'w2.summary': 'Galgod 的小米手環非官方移植版。原作是一部視覺小說，要做的只有閱讀，然後在關鍵時刻替主角做決定。',
    'w3.title': '永恆與星辰與日常',
    'w3.summary': '《永恆與星辰與日常》的小米手環非官方移植版。原作是一部視覺小說，講的是平凡日常裡慢慢長出來的那一點不平凡。安裝包正在上傳，原始碼已經先公開了。',
    'w5.title': '夏末白夜',
    'w5.summary': '《夏末白夜》的小米手環非官方移植版。還在整理階段，安裝包暫時沒有上傳到 Astrobox，原始碼已經先公開了。',
    'works.hintPendingSource': '安裝包還沒上傳到 Astrobox，所以暫時裝不了；想先看程式碼請點「查看原始碼」。',
    'collage.kicker': '合集卡片',
    'collage.title': 'Galgame合集卡片喵～',
    'collage.lede': '一張卡把整套移植作品收在一起。按住往上拖、滾滑鼠滾輪、或用方向鍵和下面的按鈕都能翻頁；序號下面的作品名就是安裝入口，點進去由 Astrobox 開啟。',
    'collage.hint': '拖曳 / 滾輪翻頁',
    'collage.a11yCard': 'Galgame 合集卡片，可上下拖曳或滾動滑鼠滾輪切換作品',
    'collage.a11yDots': '選擇作品',
    'collage.prev': '上一部作品',
    'collage.next': '下一部作品',
    'collage.p1': 'Galgame 移植合集',
    'collage.p1meta': '5 部作品 · 手環 9 Pro/10 Pro',
    'collage.p3meta': '快應用 · 手環 9 Pro',
    'collage.p2meta': '快應用 · 手環 9 Pro/10 Pro',
    'collage.p4meta': '待上傳 · 原始碼已公開',
    'collage.p5meta': '每日建置 · 原始碼已公開',
    'collage.p6meta': '待上傳 · 原始碼已公開',
    'w4.title': '黃莓C',
    'w4.summary': '《黃莓C》的小米手環非官方移植版。目前是 demo 階段，處於每日建置狀態，安裝包還沒上傳到 Astrobox，原始碼已經先公開了。',
    'tag.demo': 'Demo',
    'tag.pkg': 'com.huangmeic.band',
    'works.hintPendingBuild': '每日建置階段，安裝包還沒上傳到 Astrobox，所以暫時裝不了；想先看程式碼請點「查看原始碼」。',
    'links.kicker': '快速連結',
    'links.title': '先從這裡<em>找到我。</em>',
    'links.lede': '主要活動據點。程式碼和各個專案都放在 GitHub，問題回報也走那裡。',
    'links.ghDesc': '所有開源專案與原始碼所在的地方，也是提交 Issue 和 PR 的入口。',
    'links.ghCta': '開啟個人頁',
    'links.mcbbsDesc': '早年混跡的 MCBBS 個人空間，站點本身早已關閉，這裡只留一個紀念性的入口。',
    'links.mcbbsCta': '去懷舊一下',
    'tools.kicker': '線上工具',
    'tools.title': '寫劇本用的<em>那幾把傢伙。</em>',
    'tools.lede': '自己做的幾個小工具，都是純前端、本機執行 —— 檔案不會被上傳到任何伺服器，斷網也能用。',
    'tools.live': '已上線',
    'tools.t1': 'Galgame 劇本編輯器',
    'tools.t1desc': '匯入劇本後可依頁編輯背景、立繪、CG、說話者與文字，支援選項分支、批次取代文字、即時預覽、復原重做，最後匯出成 <code>scriptData*.txt</code>。',
    'tools.t2': 'Galgame 劇本格式轉換器',
    'tools.t2desc': '在原始劇本格式與 JSON 之間互轉，也可以匯入 JSON、匯出 TXT，方便接其他流程或做批次處理。',
    'tools.t3': 'TXT 切割器',
    'tools.t3desc': '把一個 TXT 依大小、行數、區塊數或章節分隔符切成多份，支援超大文字檔。拖入檔案即可使用，全程在瀏覽器本機處理。',
    'future.kicker': '未來開發專案',
    'future.title': '還在藍圖上的<em>那一塊。</em>',
    'future.lede': '計畫已經有了，時間也標好了。在真正開始之前，先放在這裡。',
    'future.plan': '計畫中',
    'future.tbd': '待定',
    'future.f1': '移植更多 Galgame',
    'future.f1desc': '繼續挑合適的作品做手環移植，流程順了之後會穩定更新，歡迎在群裡點名想看的。',
    'future.f2': '更多手環裝置適配',
    'future.f2desc': '現有移植只在小米手環 9 Pro 上驗證過，後續會視裝置情況繼續擴充。',
    'mirrors.kicker': 'Linux 鏡像下載',
    'mirrors.title': '裝系統要用的<em>那幾張光碟。</em>',
    'mirrors.lede': '這裡提供一些 Linux 鏡像下載連結。',
    'mirrors.badge': '123 雲盤',
    'mirrors.row': 'Linux 鏡像合集',
    'mirrors.rowDesc': '常用發行版鏡像打包上傳，直接下載即可。',
    'faq.kicker': '常見問題',
    'faq.title': '你大概會問的<em>幾個問題。</em>',
    'faq.lede': '關於作品狀態、手環移植與本機工具，先把常見疑問集中在這裡。',
    'faq.q1': '手環移植版是官方版本嗎？',
    'faq.a1': '不是。它是針對小米 Vela 裝置的個人技術研究與適配成果，並非原作官方版本或授權衍伸產品。作品名稱、角色、劇情與美術資源的著作權歸原作者及相關權利人所有，本站不主張任何原作權利。原專案位址見卡片上的倉庫連結。',
    'faq.q2': '目前適配了哪些裝置？',
    'faq.a2': '目前公開的兩款移植都面向<strong>小米手環 9 Pro</strong>。快應用形態的適配高度依賴螢幕尺寸，方螢幕裝置（如手環 8 Pro / 10 Pro、REDMI Watch 系列）比例不同，直接安裝會出現構圖錯位，請不要混裝。更多機型的適配會視裝置情況陸續補上。',
    'faq.q3': '怎麼把作品裝到手環上？',
    'faq.a3': '透過 <a href="https://abox.run/" target="_blank" rel="noopener noreferrer">Astrobox</a> 安裝。先裝好用戶端並連接手環，再點作品卡上的「前往 Astrobox 安裝」按鈕，瀏覽器會喚起 Astrobox 並直接開啟對應資源。裝好後在手環的應用程式清單裡就能找到它。',
    'faq.q4': '這兩款作品收費嗎？',
    'faq.a4': '免費。《小小的身影，重疊的內心》與《想成為 Galgame 領域大神！！！》都是非官方的個人移植作品，不收取任何費用，也不代表原作售價。',
    'faq.q5': '那些工具會把我的檔案傳走嗎？',
    'faq.a5': '不會。「線上工具」裡的三個工具（劇本編輯器、劇本格式轉換器、TXT 切割器）全部純前端執行，檔案只在你自己的瀏覽器裡讀寫，不會離開本機，也不經過任何伺服器。斷網狀態下同樣可以正常使用。',
    'faq.q6': '遇到問題去哪裡回報？',
    'faq.a6': '最直接的方式是在對應專案的 GitHub 倉庫開 Issue，附上裝置與重現步驟。也可以透過頁尾的 QQ 群找到我。',
    'footer.tagline': '小米手環快應用非官方移植，以及幾個完全在本機執行的小工具。',
    'footer.tag1': '快應用移植',
    'footer.tag2': '本機處理',
    'footer.tag3': '持續更新',
    'footer.findMe': '找到我',
    'footer.bili': '嗶哩嗶哩 · mcpotato',
    'footer.qq': '玩家交流 QQ 群',
    'footer.navA11y': '頁尾導覽',
    'footer.onSite': '站內',
    'footer.offSite': '站外',
    'footer.ghProfile': 'GitHub 個人頁',
    'footer.srcObe': 'ourbriefeternity-band 原始碼',
    'footer.srcHm': 'huangmeic-band 原始碼',
    'footer.srcGal': 'galgod-band 原始碼',
    'footer.srcTiny': 'tinyshadows-band 原始碼',
    'footer.mcbbs': 'MCBBS 存檔',
    'footer.related': '相關連結',
    'footer.relInstall': 'Astrobox 安裝 · 手環 9 Pro',
    'footer.relTinySrc': '《小小的身影》移植原始碼',
    'footer.relGalSrc': 'GalGod 移植原始碼',
    'footer.relObeSrc': '《永恆與星辰與日常》原始碼 · 安裝包待上傳',
    'footer.relHmSrc': '《黃莓C》原始碼 · 安裝包待上傳',
    'footer.relMirror': 'Linux 鏡像合集',
    'footer.relMirrorSub': '123 雲盤直連',
    'footer.relGhList': 'GitHub 儲存庫清單',
    'footer.relGhListSub': '全部開源專案',
    'footer.disclaimer': '免責聲明',
    'footer.disclaimer1': '「作品下載」中的五款移植皆為面向小米 Vela 裝置的<strong>非官方個人移植</strong>，並非原作官方版本或授權衍伸產品，與原作者、小米（Xiaomi）及 Astrobox 官方均無關聯。《小小的身影，重疊的內心》《想成為 Galgame 領域大神！！！》（GalGod）《永恆與星辰與日常》《黃莓C》《夏末白夜》的名稱、角色、劇情與美術資源，著作權均歸各自原作者及相關權利人所有，本站不主張任何原作權利。',
    'footer.disclaimer2': '五款移植皆免費提供，不收取任何費用，也不代表原作售價；請透過正規管道支持原作。使用、修改或散布本站所涉內容所產生的<strong>風險與責任由使用者自行承擔</strong>。',
    'footer.copyright': '持續更新中',
    'footer.builtWith': '以 HTML / CSS / JS 手寫，沒有框架',
    'ginka.tag': '移植預告',
    'ginka.text': '下一部：<strong>海藍星之夢</strong> —— 即將開始移植，不久就能在手環上看到它。'
  };

  Object.keys(HANT).forEach(function (k) {
    if (DICT[k]) DICT[k]['zh-hant'] = HANT[k];
  });

  /* 运行时状态 */
  var current = 'zh';

  function detect() {
    /* URL 参数优先，方便分享指定语言的链接 */
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (q && LANGS.indexOf(q) >= 0) return { lang: q, remember: true };

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved && LANGS.indexOf(saved) >= 0) return { lang: saved, remember: false };

    /* 浏览器语言：ja / en 前缀命中就用，其余一律中文兜底。
       注意顺序 —— 简体中文的标签是 zh-CN，要先排除掉再判断其它。 */
    var list = navigator.languages || [navigator.language || 'zh'];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i]).toLowerCase();
      if (tag.indexOf('zh') === 0) {
        /* 中文必须先分繁简：zh-TW / zh-HK / zh-MO / zh-Hant 才是繁體，
           其余（zh-CN / zh-SG / zh-Hans / 裸 zh）一律简体。 */
        if (/hant|tw|hk|mo/.test(tag)) return { lang: 'zh-hant', remember: false };
        return { lang: 'zh', remember: false };
      }
      if (tag.indexOf('ja') === 0) return { lang: 'ja', remember: false };
      if (tag.indexOf('ko') === 0) return { lang: 'ko', remember: false };
      if (tag.indexOf('ar') === 0) return { lang: 'ar', remember: false };
      if (tag.indexOf('es') === 0) return { lang: 'es', remember: false };
      if (tag.indexOf('en') === 0) return { lang: 'en', remember: false };
    }
    return { lang: 'zh', remember: false };
  }

  function t(key) {
    var e = DICT[key];
    if (!e) return null;
    return e[current] != null ? e[current] : e.zh;
  }

  /* 把一棵子树里所有带标记的节点按当前语言写一遍 */
  function apply(root) {
    var scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v != null) el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-html'));
      if (v != null) el.innerHTML = v;
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length !== 2) return;
        var v = t(bits[1].trim());
        if (v != null) el.setAttribute(bits[0].trim(), v);
      });
    });
  }

  function set(lang, remember) {
    if (LANGS.indexOf(lang) < 0) lang = 'zh';
    current = lang;
    document.documentElement.setAttribute('lang', HTML_LANG[lang]);
    document.documentElement.setAttribute('data-lang', lang);
    /* dir 和 lang 一样必须同步：阿拉伯语要把整个文档切成 RTL */
    document.documentElement.setAttribute('dir', RTL_LANG[lang] ? 'rtl' : 'ltr');
    if (remember) { try { localStorage.setItem(KEY, lang); } catch (e) {} }
    apply(document);
    /* 通知外部（app.js 里的动态文案要跟着重画） */
    try {
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('langchange', true, true);
      document.dispatchEvent(ev);
    }
  }

  return {
    LANGS: LANGS,
    LABEL: LABEL,
    t: t,
    apply: apply,
    set: set,
    get: function () { return current; },
    /* 首帧之前调用：只定语言、先不写 DOM（此时 DOM 还没解析到） */
    boot: function () {
      var d = detect();
      current = d.lang;
      document.documentElement.setAttribute('lang', HTML_LANG[d.lang]);
      document.documentElement.setAttribute('data-lang', d.lang);
      document.documentElement.setAttribute('dir', RTL_LANG[d.lang] ? 'rtl' : 'ltr');
      if (d.remember) { try { localStorage.setItem(KEY, d.lang); } catch (e) {} }
      return d.lang;
    }
  };
})();
