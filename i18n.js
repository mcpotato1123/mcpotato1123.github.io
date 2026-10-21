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
  var LANGS = ['zh', 'en', 'ja'];
  var LABEL = { zh: '中文', en: 'English', ja: '日本語' };
  var HTML_LANG = { zh: 'zh-CN', en: 'en', ja: 'ja' };

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
      if (tag.indexOf('zh') === 0) return { lang: 'zh', remember: false };
      if (tag.indexOf('ja') === 0) return { lang: 'ja', remember: false };
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
      if (d.remember) { try { localStorage.setItem(KEY, d.lang); } catch (e) {} }
      return d.lang;
    }
  };
})();
