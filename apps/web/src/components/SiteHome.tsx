import { useEffect, useState } from 'react';

interface SiteHomeProps {
  onOpenCurio: () => void;
}

type Variant = 'A' | 'B' | 'C';

const variants: Array<{ key: Variant; name: string }> = [
  { key: 'A', name: '编辑型长页' },
  { key: 'B', name: '三产品画廊' },
  { key: 'C', name: 'AI 原生宣言' },
];

function Brand() {
  return (
    <a className="dk-brand" href="/" aria-label="DAAS — Designing AI-native Adaptive Systems 首页">
      <img src="/assets/daas-logo-transparent.png" alt="" />
      <span className="dk-brand-copy">
        <b>DAAS</b>
        <small>Designing AI-native Adaptive Systems</small>
      </span>
    </a>
  );
}

function Navigation({ onOpenCurio }: SiteHomeProps) {
  return (
    <header className="dk-nav dk-shell">
      <Brand />
      <nav aria-label="主导航">
        <a href="#projects">项目</a>
        <a href="#ideas">探索</a>
        <a href="#about">关于</a>
        <button type="button" onClick={onOpenCurio}>体验 Curio</button>
      </nav>
    </header>
  );
}

function AlphaXWindow({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dk-product-window dk-alphax-window ${compact ? 'is-compact' : ''}`}>
      <div className="dk-window-bar"><i /><i /><i /><span>AlphaX · 研究工作台</span></div>
      <img src="/assets/alphax-workbench.png" alt="AlphaX AI 原生研究工作台界面" />
    </div>
  );
}

function CurioWindow({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dk-product-window dk-curio-window ${compact ? 'is-compact' : ''}`} aria-label="Curio 产品界面示意">
      <div className="dk-window-bar"><i /><i /><i /><span>Curio · Chapter 01</span></div>
      <div className="dk-curio-ui">
        <div className="dk-curio-kicker">苍澜迷雾 · 第一章</div>
        <div className="dk-curio-title">深夜快车驶离站台</div>
        <p>故事继续向前。每一个高亮词，都是理解线索的一部分。</p>
        <div className="dk-curio-line"><span>logical</span><span>contradictory</span><span>danger</span></div>
        <div className="dk-curio-choice"><b>关键抉择</b><span>用词义与剧情，判断下一步。</span></div>
      </div>
    </div>
  );
}

function KevinSystem({ compact = false }: { compact?: boolean }) {
  const nodes = ['观察', '因子', '变异', '发布', '反馈', '学习'];
  return (
    <div className={`dk-kevin-system ${compact ? 'is-compact' : ''}`} aria-label="Kevin AQAS 系统原理示意">
      <div className="dk-kevin-grid" />
      <div className="dk-kevin-core"><b>K</b><span>AQAS</span></div>
      <div className="dk-kevin-ring dk-ring-one" />
      <div className="dk-kevin-ring dk-ring-two" />
      {nodes.map((node, index) => <span className={`dk-kevin-node node-${index + 1}`} key={node}>{node}</span>)}
      <div className="dk-kevin-caption"><span className="dk-live-dot" /> SYSTEM FORMATION</div>
    </div>
  );
}

function KevinWindow({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dk-product-window dk-kevin-window ${compact ? 'is-compact' : ''}`}>
      <div className="dk-window-bar"><i /><i /><i /><span>Kevin · 工作区</span></div>
      <img src="/assets/kevin-workspace.png" alt="Kevin 自主化工作区界面" />
    </div>
  );
}

function ThemeStrip() {
  return (
    <section className="dk-theme-strip dk-shell" aria-label="三个探索方向">
      <article><span>01 / PRODUCT</span><h3>产品</h3><p>AI 如何进入产品的核心体验，而不只是成为附加功能。</p></article>
      <article><span>02 / TEAM</span><h3>团队</h3><p>个人和小团队如何获得研究、设计、开发与运营能力。</p></article>
      <article><span>03 / LIFE</span><h3>生活方式</h3><p>人与 AI 如何共同学习、判断、表达并持续创造。</p></article>
    </section>
  );
}

function ProjectHeader({ number, name, type, status }: { number: string; name: string; type: string; status: string }) {
  return (
    <div className="dk-project-meta">
      <span>{number}</span><b>{name}</b><span>{type}</span><em><i />{status}</em>
    </div>
  );
}

function CurioProject({ onOpenCurio }: SiteHomeProps) {
  return (
    <section className="dk-project-section dk-curio-section">
      <div className="dk-shell dk-project-layout">
        <div className="dk-project-copy">
          <ProjectHeader number="01" name="CURIO" type="AI 英语学习" status="受邀试用" />
          <h2>让词汇进入故事，<br />而不是停留在词表里。</h2>
          <p>把高中英语词汇放进连载故事、关键抉择和语境纠偏中，让学习建立在真正的阅读理解里。</p>
          <div className="dk-tag-row"><span>连载故事</span><span>语境词卡</span><span>学习回顾</span></div>
          <button className="dk-arrow-link" type="button" onClick={onOpenCurio}>进入 Curio 试用 <b>→</b></button>
        </div>
        <div className="dk-project-visual dk-curio-visual"><CurioWindow /><div className="dk-float-chip">15 词 / 章</div><div className="dk-float-card"><small>语境复现</small><b>不是背词，<br />是读懂故事。</b></div></div>
      </div>
    </section>
  );
}

function AlphaXProject() {
  return (
    <section className="dk-project-section dk-alphax-section">
      <div className="dk-shell dk-project-layout is-reversed">
        <div className="dk-project-visual dk-alphax-visual"><AlphaXWindow /><div className="dk-alpha-focus focus-one"><small>研究起点</small><b>持仓与关注对象</b></div><div className="dk-alpha-focus focus-two"><small>判断复核</small><b>关键事实变化</b></div></div>
        <div className="dk-project-copy">
          <ProjectHeader number="02" name="ALPHAX" type="投资策略分析助手" status="产品原型" />
          <h2>信息不缺，<br />缺的是可复核的判断。</h2>
          <p>面向研究型自主投资者的 AI 原生研究工作台：从持仓与关注对象出发，以自然语言发起研究，用可核查证据支撑判断。</p>
          <div className="dk-tag-row"><span>持仓上下文</span><span>证据核查</span><span>前提复核</span></div>
          <p className="dk-boundary dk-boundary-research">研究与策略分析辅助，不构成投资建议，不荐股，不执行自动交易。</p>
        </div>
      </div>
    </section>
  );
}

function KevinProject() {
  return (
    <section className="dk-project-section dk-kevin-section">
      <div className="dk-shell dk-project-layout">
        <div className="dk-project-copy">
          <ProjectHeader number="03" name="KEVIN / AQAS" type="注意力量化套利系统" status="研发启动" />
          <h2>不只是生成内容，<br />而是学习什么值得被注意。</h2>
          <p>Kevin 是一个自主化系统实验：在可观测的社交媒体环境中，将注意力信号转化为因子，通过变异规划、市场反馈与持续回测，逐步形成模因因子库与胜率模型。</p>
          <div className="dk-tag-row"><span>因子提取</span><span>高熵变异</span><span>闭环反馈</span></div>
          <p className="dk-boundary dk-boundary-stage">当前处于开发启动阶段，尚未开放产品试用。</p>
        </div>
        <div className="dk-project-visual dk-kevin-visual"><KevinWindow /><KevinSystem compact /><div className="dk-kevin-ui-note"><small>真实界面</small><b>工作区与资料库</b></div></div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <>
      <section id="about" className="dk-closing">
        <div className="dk-closing-track" aria-hidden="true">PRODUCT · TEAM · LIFE · PRODUCT · TEAM · LIFE ·</div>
        <div className="dk-shell">
          <p>ABOUT DAASKIT</p>
          <h2>AI 原生，不是把 AI 加进旧产品。<br /><span>是重新想象什么值得由人完成。</span></h2>
          <a href="#projects">回到项目 <b>↑</b></a>
        </div>
      </section>
      <footer className="dk-footer dk-shell"><div><Brand /><p>探索 AI 原生的产品、团队和生活方式。</p></div><div><span>© 2026 DaasKit</span><a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">苏ICP备2026056074号-1</a></div></footer>
    </>
  );
}

function VariantA({ onOpenCurio }: SiteHomeProps) {
  return (
    <main className="dk-home dk-variant-a">
      <div className="dk-hero-bg"><div className="dk-code-rain">PRODUCT&nbsp;&nbsp;TEAM&nbsp;&nbsp;LIFE&nbsp;&nbsp;PRODUCT&nbsp;&nbsp;TEAM&nbsp;&nbsp;LIFE</div></div>
      <Navigation onOpenCurio={onOpenCurio} />
      <section className="dk-hero dk-shell">
        <div className="dk-hero-copy">
          <p className="dk-kicker">AI-NATIVE EXPLORATIONS · 2026</p>
          <h1>探索 AI 原生的可能性：<br /><span>产品、团队和生活方式。</span></h1>
          <p>DaasKit 是一个持续生长的 AI 原生实验场。我们把想法做成产品，观察人与 AI 如何共同学习、判断、表达与创造。</p>
          <div className="dk-actions"><a className="dk-primary" href="#projects">查看项目 <b>↓</b></a><a className="dk-secondary" href="#ideas">我们在探索什么</a></div>
        </div>
        <div className="dk-hero-stack">
          <AlphaXWindow compact />
          <CurioWindow compact />
          <KevinWindow compact />
        </div>
      </section>
      <ThemeStrip />
      <section id="projects" className="dk-project-intro dk-shell"><p className="dk-kicker">PROJECTS / 01—03</p><h2>三个正在发生的<br />AI 原生实验。</h2><p>从真实问题出发，用产品回答。每个项目都清楚标记当前状态。</p></section>
      <CurioProject onOpenCurio={onOpenCurio} />
      <AlphaXProject />
      <KevinProject />
      <section id="ideas" className="dk-principles dk-shell"><p className="dk-kicker">HOW WE THINK</p><div><h2>学习</h2><p>Curio 探索人与 AI 如何共同学习。</p></div><div><h2>判断</h2><p>AlphaX 探索人与 AI 如何共同研究与复核。</p></div><div><h2>演化</h2><p>Kevin 探索自主系统如何从真实反馈中修正。</p></div></section>
      <Closing />
    </main>
  );
}

function VariantB({ onOpenCurio }: SiteHomeProps) {
  return (
    <main className="dk-home dk-variant-b">
      <Navigation onOpenCurio={onOpenCurio} />
      <section className="dk-gallery-hero dk-shell">
        <p className="dk-kicker">DAASKIT / AI-NATIVE STUDIO</p>
        <h1>产品，是我们理解<br /><span>AI 原生</span>的方式。</h1>
        <p>从学习、判断到自主演化，三个实验正在展开。</p>
        <div className="dk-gallery-stack"><AlphaXWindow compact /><CurioWindow compact /><KevinWindow compact /></div>
      </section>
      <section id="projects" className="dk-gallery-grid dk-shell">
        <article className="curio"><ProjectHeader number="01" name="CURIO" type="AI 英语学习" status="受邀试用" /><h2>学习</h2><CurioWindow compact /><p>让词汇进入故事，而不是停留在词表里。</p><button type="button" onClick={onOpenCurio}>体验产品 →</button></article>
        <article className="alphax"><ProjectHeader number="02" name="ALPHAX" type="策略分析" status="产品原型" /><h2>判断</h2><AlphaXWindow compact /><p>让研究建立在证据和自己的前提上。</p></article>
        <article className="kevin"><ProjectHeader number="03" name="KEVIN" type="AQAS" status="研发启动" /><h2>演化</h2><KevinWindow compact /><p>从注意力反馈中形成可验证的系统能力。</p></article>
      </section>
      <Closing />
    </main>
  );
}

function VariantC({ onOpenCurio }: SiteHomeProps) {
  return (
    <main className="dk-home dk-variant-c">
      <Navigation onOpenCurio={onOpenCurio} />
      <section className="dk-manifesto-hero dk-shell"><span>DAASKIT / 2026</span><h1>AI 原生，<br />不只是新的工具。</h1><p>它正在改变产品如何理解人，团队如何形成能力，以及我们如何学习、判断与表达。</p><a href="#projects">继续探索 ↓</a></section>
      <section id="projects" className="dk-manifesto-projects">
        <article><div className="dk-shell"><div><span>01 / LEARN</span><h2>Curio</h2><p>人与 AI 共同学习：从词表走进语境、故事与选择。</p><button type="button" onClick={onOpenCurio}>进入试用 →</button></div><CurioWindow /></div></article>
        <article><div className="dk-shell"><AlphaXWindow /><div><span>02 / DECIDE</span><h2>AlphaX</h2><p>人与 AI 共同判断：从资讯消费回到证据、前提和复核。</p><small>研究辅助，不构成投资建议。</small></div></div></article>
        <article><div className="dk-shell"><div><span>03 / EVOLVE</span><h2>Kevin</h2><p>自主系统持续演化：观察、变异、反馈，再学习。</p><small>研发启动阶段。</small></div><div className="dk-kevin-manifesto-visual"><KevinWindow /><KevinSystem compact /></div></div></article>
      </section>
      <Closing />
    </main>
  );
}

function PrototypeSwitcher({ current, onChange }: { current: Variant; onChange: (variant: Variant) => void }) {
  const index = variants.findIndex((item) => item.key === current);
  const move = (amount: number) => onChange(variants[(index + amount + variants.length) % variants.length].key);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  return <div className="dk-prototype-switcher"><button type="button" onClick={() => move(-1)}>←</button><span>{current} — {variants[index].name}</span><button type="button" onClick={() => move(1)}>→</button></div>;
}

export function SiteHome({ onOpenCurio }: SiteHomeProps) {
  const initial = new URLSearchParams(window.location.search).get('variant');
  const [variant, setVariant] = useState<Variant>(initial === 'B' || initial === 'C' ? initial : 'A');
  const changeVariant = (next: Variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', url);
    setVariant(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return <>{variant === 'A' && <VariantA onOpenCurio={onOpenCurio} />}{variant === 'B' && <VariantB onOpenCurio={onOpenCurio} />}{variant === 'C' && <VariantC onOpenCurio={onOpenCurio} />}{import.meta.env.DEV && <PrototypeSwitcher current={variant} onChange={changeVariant} />}</>;
}
