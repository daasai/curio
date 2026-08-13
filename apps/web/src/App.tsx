import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore, ONBOARDING_DEMOS, VOCAB_MOCK, createClientId, type VocabItem } from './store';
import { LoginScreen } from './components/LoginScreen';
import { PasswordSettings } from './components/PasswordSettings';
import { SiteHome } from './components/SiteHome';
import { getMeApi, getLearningSnapshotApi, startLearningSessionApi, completeLearningSessionApi, getLearningReportApi, postPosterExportedApi, getLearningVocabularyApi, getLearningVocabularyItemApi } from './apiClient';
import html2canvas from 'html2canvas';
import { sanitizeStoryHtml } from './sanitizeHtml';

// Real Human Audio Pronunciation using NetEase Youdao CDN API
const speakWord = (word: string, isUS: boolean = false) => {
  try {
    const type = isUS ? 2 : 1;
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.warn("Audio play failed, falling back to Web Speech Synthesis:", err);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = isUS ? 'en-US' : 'en-GB';
        window.speechSynthesis.speak(utterance);
      }
    });
  } catch (err) {
    console.error("Audio playback error:", err);
  }
};

// --- Toast Component ---
const Toast: React.FC = () => {
  const { toast, clearToast } = useAppStore();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="toast show">
      {toast}
    </div>
  );
};

function parseWordFamily(value: unknown): Array<{ form: string; pos: string; meaning: string }> {
  if (Array.isArray(value)) {
    return value.filter((item): item is { form: string; pos: string; meaning: string } => (
      Boolean(item) && typeof item === 'object' && typeof (item as any).form === 'string'
    )).map((item) => ({
      form: item.form,
      pos: item.pos || '',
      meaning: item.meaning || '',
    }));
  }
  if (typeof value === 'string') {
    return value.split(',').map((form) => form.trim()).filter(Boolean).map((form) => ({ form, pos: '', meaning: '' }));
  }
  return [];
}

function chapterDisplayTitle(rawTitle: unknown, fallback: string): string {
  if (typeof rawTitle !== 'string' || !rawTitle.trim()) return fallback;
  return rawTitle.trim().replace(/^第\s*\d+\s*章\s*[：:]\s*/, '') || fallback;
}

const toVocabItem = (record: any): VocabItem => {
  const wordFamily = parseWordFamily(record.wordFamily ?? record.word_family);
  return {
    word: record.word || '',
    pos: record.pos || '',
    ukPhonetic: record.phonetic || '',
    usPhonetic: record.phonetic || '',
    meaning: record.meaningCn || record.meaning_cn || '',
    example: record.example || '',
    scene: record.scene || '苍澜迷雾 · 章节故事',
    type: record.type === 'core' ? 'core' : 'context',
    wordFamily,
    nearSynonym: record.nearSynonym || null,
    crossContext: record.crossContext || null,
  };
};

function extractStorySentence(storyText: unknown, word: string): string {
  if (typeof storyText !== 'string' || !word.trim()) return '';
  const text = storyText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return '';
  const starts = [text.lastIndexOf('。', index), text.lastIndexOf('！', index), text.lastIndexOf('？', index), text.lastIndexOf('\n', index)];
  const start = Math.max(-1, ...starts) + 1;
  const ending = text.slice(index).search(/[。！？]/);
  const end = ending < 0 ? text.length : index + ending + 1;
  return text.slice(start, end).trim();
}

// --- Word Highlight with Tooltip Component ---
const WordHighlight: React.FC<{ word: string; text: string; storyExample?: string }> = ({ word, text, storyExample = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);
  const elRef = useRef<HTMLSpanElement>(null);
  const { unlockWord, submitEvent } = useAppStore();
  const [serverData, setServerData] = useState<VocabItem | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [cardLoadFailed, setCardLoadFailed] = useState(false);

  const loadCard = () => {
    setIsLoadingCard(true);
    setCardLoadFailed(false);
    setServerData(null);
    getLearningVocabularyItemApi(word).then((result) => {
      if (result?.item) {
        setServerData({ ...toVocabItem(result.item), example: storyExample });
      } else {
        setCardLoadFailed(true);
      }
    }).catch(() => setCardLoadFailed(true)).finally(() => setIsLoadingCard(false));
  };

  const handleWordClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockWord(word);
    submitEvent('word_opened', { word });
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) loadCard();
    
    if (elRef.current) {
      const rect = elRef.current.getBoundingClientRect();
      const showBelow = rect.top < 280;
      
      setCoords({
        left: rect.left + rect.width / 2 + window.scrollX,
        top: showBelow ? rect.bottom + window.scrollY : rect.top + window.scrollY
      });
      setPosition(showBelow ? 'below' : 'above');
    }
    
  };

  useEffect(() => {
    const handleClose = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnViewportChange = () => setIsOpen(false);
    document.addEventListener('click', handleClose);
    window.addEventListener('resize', closeOnViewportChange);
    return () => {
      document.removeEventListener('click', handleClose);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, []);

  const data = serverData;

  return (
    <span ref={containerRef} className="relative" style={{ display: 'inline' }}>
      <span
        ref={elRef}
        className="word-highlight"
        data-word={word}
        onClick={handleWordClick}
      >
        {text}
      </span>
      {isOpen && (
        <span
          className={`word-tooltip position-${position} visible`}
          style={{
            position: 'absolute',
            left: `${coords.left - (elRef.current ? elRef.current.getBoundingClientRect().left + elRef.current.getBoundingClientRect().width / 2 : 0)}px`,
            top: position === 'above' ? '-10px' : '30px',
            transform: `translateX(-50%)`,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isLoadingCard && <span className="wt-meaning" style={{ display: 'block' }}>正在加载词汇卡…</span>}
          {cardLoadFailed && <span className="wt-meaning" style={{ display: 'block' }}>词卡暂未加载。<button className="btn btn-ghost btn-sm" onClick={loadCard}>重试</button></span>}
          {data && <>
          <span className="wt-word" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {data.word}
            <span className={`badge ${data.type === 'core' ? 'badge-gold' : 'badge-teal'}`} style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
              {data.type === 'core' ? '核心' : '语境'}
            </span>
            {data.pos && <span style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', fontWeight: 600, fontFamily: 'monospace' }}>{data.pos}</span>}
          </span>
          <span className="wt-phonetic" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => speakWord(data.word, false)}>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>UK 🔊</span> {data.ukPhonetic}
            </span>
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => speakWord(data.word, true)}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>US 🔊</span> {data.usPhonetic}
            </span>
          </span>
          <span className="wt-meaning" style={{ display: 'block', marginTop: '8px' }}>{data.meaning}</span>
          
          {data.example && (
            <span style={{ display: 'block', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>📖 本章语境</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>{data.example}</span>
            </span>
          )}
          <span style={{ display: 'block', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>🌿 词族</span>
            {data.wordFamily && data.wordFamily.length > 0 ? data.wordFamily.map(f => (
              <span key={f.form} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '3px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{f.form}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{f.pos}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{f.meaning}</span>
              </span>
            )) : <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>暂无可验证的高中范围词族</span>}
          </span>
          {data.nearSynonym && (
            <span style={{ display: 'block', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>⚡ 近义辨析 vs {data.nearSynonym.word}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{data.nearSynonym.distinction}</span>
            </span>
          )}
          </>}
        </span>
      )}
    </span>
  );
};

// --- Ambient Glow & Particles ---
const BackgroundDecorations: React.FC = () => {
  const particles = useMemo(() => Array.from({ length: 15 }, () => ({
    left: `${Math.random() * 100}%`,
    size: `${1 + Math.random() * 2}px`,
    animationDelay: `${Math.random() * 10}s`,
    animationDuration: `${12 + Math.random() * 15}s`,
    opacity: 0.1 + Math.random() * 0.3,
  })), []);

  return (
    <>
      <div className="ambient ambient-1"></div>
      <div className="ambient ambient-2"></div>
      <div className="particles">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.animationDelay,
              animationDuration: particle.animationDuration,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>
    </>
  );
};

// ============================================================
// SCREENS
// ============================================================

// --- 1. LANDING SCREEN ---
const LandingScreen: React.FC = () => {
  const { setScreen, setOnboardingStage } = useAppStore();

  const handleStart = () => {
    setOnboardingStage(1);
    setScreen('onboarding');
  };

  return (
    <div id="landing" className="screen">
      <div className="z-1" style={{ width: '100%', maxWidth: '600px' }}>
        <div className="landing-logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">Curio</span>
        </div>

        <h1 style={{ marginBottom: '16px' }}>
          每个单词<br />
          <span style={{ background: 'var(--grad-gold)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            都是一个世界的入口
          </span>
        </h1>
        <p className="landing-tagline">
          AI 将高考词汇嵌入沉浸式冒险故事。读剧情，做抉择。专注提升阅读语境理解，科学提分。
        </p>

        <div className="landing-feature-pills">
          <span className="badge badge-gold">✦ AI 专属故事</span>
          <span className="badge badge-purple">🎭 沉浸式叙事</span>
          <span className="badge badge-teal">⚡ 关键抉择机制</span>
          <span className="badge badge-coral">📚 高考词汇对齐</span>
          <span className="badge badge-gold">🕵️ 剧本杀式体验</span>
        </div>

        <div className="feature-preview">
          <div className="preview-card">
            <div className="icon">📖</div>
            <div className="label">双轨语境<br />故事世界</div>
          </div>
          <div className="preview-card">
            <div className="icon">⚡</div>
            <div className="label">支线汇流<br />无感纠错</div>
          </div>
          <div className="preview-card">
            <div className="icon">📈</div>
            <div className="label">基线诊断<br />效果可见</div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ marginTop: '8px' }} onClick={handleStart}>
          先读一段故事 →
        </button>
        <p className="mt-3" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          高考核心词汇表 · 100% 科学记忆
        </p>
      </div>
    </div>
  );
};

// --- 2. ONBOARDING SCREEN ---
const OnboardingScreen: React.FC = () => {
  const { onboardingStage, selectedDemo, selectDemo } = useAppStore();

  useEffect(() => {
    // Pick random demo on load
    if (onboardingStage === 1 && !selectedDemo) {
      const idx = Math.floor(Math.random() * ONBOARDING_DEMOS.length);
      selectDemo(ONBOARDING_DEMOS[idx]);
    }
  }, [onboardingStage, selectedDemo, selectDemo]);

  // Stage 1: Demo Experience
  const renderDemo = () => {
    if (!selectedDemo) return null;
    return <DemoStage demo={selectedDemo} />;
  };

  // Stage 2: Baseline Diagnosis
  const renderDiagnosis = () => {
    return <DiagnosisStage />;
  };

  // Stage 3: Preferences Configuration
  const renderPreferences = () => {
    return <PreferencesStage />;
  };

  // Stage 4: Loading Screen
  const renderReady = () => {
    return <ReadyStage />;
  };

  return (
    <div id="onboarding" className="screen">
      <div className="ob-container z-1">
        <div className="ob-steps">
          <div className={`ob-step ${onboardingStage === 1 ? 'active' : onboardingStage > 1 ? 'done' : ''}`} />
          <div className={`ob-step ${onboardingStage === 2 ? 'active' : onboardingStage > 2 ? 'done' : ''}`} />
          <div className={`ob-step ${onboardingStage === 3 ? 'active' : onboardingStage > 3 ? 'done' : ''}`} />
          <div className={`ob-step ${onboardingStage === 4 ? 'active' : onboardingStage > 4 ? 'done' : ''}`} />
        </div>

        <div id="onboarding-content">
          {onboardingStage === 1 && renderDemo()}
          {onboardingStage === 2 && renderDiagnosis()}
          {onboardingStage === 3 && renderPreferences()}
          {onboardingStage === 4 && renderReady()}
        </div>
      </div>
    </div>
  );
};

// Sub-Stage: Demo Experience
const DemoStage: React.FC<{ demo: typeof ONBOARDING_DEMOS[0] }> = ({ demo }) => {
  const [choiceMade, setChoiceMade] = useState<string | null>(null);
  const { setOnboardingStage, unlockWord } = useAppStore();

  const handleChoice = (id: string) => {
    setChoiceMade(id);
    unlockWord(demo.word);
  };

  const selectedOption = demo.choice.options.find(o => o.id === choiceMade);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="badge badge-purple">🕵️ {demo.genre} · 体验Demo</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>还有 5 种故事类型等你探索</span>
      </div>
      <h2>{demo.title}</h2>
      <div className="word-tip-hint mt-2 mb-4">
        <span>💡</span>
        <span>点击金色下划线单词，查看词义。体会词语如何与案情精密契合。</span>
      </div>
      <div className="story-text" style={{ fontSize: '1.05rem', lineHeight: 1.85, marginBottom: '24px' }}>
        {demo.content.map((seg, i) => {
          if (seg.type === 'text') return seg.text;
          return <WordHighlight key={i} word={seg.word!} text={seg.text} />;
        })}
      </div>

      <div id="demo-choice-box" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '32px', paddingTop: '24px' }}>
        <div className="flex items-center gap-2 mb-4">
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(245,200,66,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>⚡</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>抉择关卡</span>
        </div>
        <h3 className="mb-4" style={{ fontSize: '1.05rem' }}>{demo.choice.question}</h3>
        <div className="flex flex-col gap-3">
          {demo.choice.options.map(opt => {
            const isChosen = choiceMade === opt.id;
            const classVal = isChosen ? (opt.correct ? 'choice-card correct' : 'choice-card wrong') : 'choice-card';
            return (
              <div
                key={opt.id}
                className={classVal}
                style={{ pointerEvents: choiceMade ? 'none' : 'auto' }}
                onClick={() => handleChoice(opt.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="choice-letter">{opt.id}</div>
                  <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{opt.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        {choiceMade && selectedOption && (
          <div id="demo-feedback" style={{ marginTop: '20px' }}>
            {selectedOption.correct ? (
              <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(45,212,191,0.25)', background: 'rgba(45,212,191,0.02)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span>✅</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>直觉正确</span>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                  {demo.choice.correctFeedback}
                </p>
                <button className="btn btn-primary" onClick={() => setOnboardingStage(2)}>
                  建立我的词汇起点 →
                </button>
              </div>
            ) : (
              <div className="branch-story-container">
                <div className="branch-header">
                  <span>⚡</span>
                  <span>触发支线剧情 · 语境无感纠错</span>
                </div>
                <p style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>{demo.choice.branchText}</p>
                <div className="glass-card" style={{ padding: '16px', borderColor: 'var(--border-gold)', background: 'rgba(245,200,66,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>💡 核心词汇小结:</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent-gold)', fontSize: '0.95rem' }}>{demo.word}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {VOCAB_MOCK[demo.word].meaning}
                  </div>
                </div>
                <button className="btn btn-primary mt-4" onClick={() => setOnboardingStage(2)}>
                  建立我的词汇起点 →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-Stage: Diagnosis
const DiagnosisStage: React.FC = () => {
  const { diagAnswers, setDiagAnswer, submitDiagnosis, diagScore, diagLevel, setOnboardingStage } = useAppStore();
  const [submitted, setSubmitted] = useState(false);

  const qData = {
    title: '词汇起点基线诊断',
    subtitle: '阅读下面一小段故事（无高亮提示），针对其中的词汇做出你的语境判断，Curio 将基于此建立你的初始能力档案。',
    text: '林亦沿着老城区的石板路快步走着。暴雨让整座城市在夜色中显得有些 ambiguous。街角咖啡馆里，那个擦拭杯子的服务员正用 vague 的眼神看着她。林亦知道自己必须保持 resilient，因为接下来的每一步都将决定她能否在今晚查出父亲的下落。她藏在衣袖里的手指微微收紧，暗自发誓要 persevere 到最后一刻。',
    questions: [
      {
        q: '1. 故事中说“暴雨让城市显得 ambiguous”，这个词在这里最接近的意思是？',
        options: [
          { text: 'A. 危险重重的', correct: false },
          { text: 'B. 模糊不清、充满歧义的', correct: true },
          { text: 'C. 热闹非凡的', correct: false },
          { text: 'D. 冰冷刺骨的', correct: false }
        ]
      },
      {
        q: '2. 服务员擦拭杯子时眼神“vague”，意思是服务员？',
        options: [
          { text: 'A. 愤怒而带有敌意', correct: false },
          { text: 'B. 充满笑意与温暖', correct: false },
          { text: 'C. 眼神游离、茫然含糊的', correct: true },
          { text: 'D. 警惕并且在打量林亦', correct: false }
        ]
      },
      {
        q: '3. 林亦知道接下来的道路需要自己保持“resilient”，代表她需要？',
        options: [
          { text: 'A. 跑得足够快', correct: false },
          { text: 'B. 拥有强大的抗挫折和恢复韧性', correct: true },
          { text: 'C. 保持绝对的安静与隐秘', correct: false },
          { text: 'D. 身体能够保暖不挨冻', correct: false }
        ]
      },
      {
        q: '4. 林亦发誓要“persevere”到最后一刻，说明她决定？',
        options: [
          { text: 'A. 坚持不懈，永不放弃', correct: true },
          { text: 'B. 适时放弃以寻找新的出路', correct: false },
          { text: 'C. 寻找帮手共同调查', correct: false },
          { text: 'D. 隐姓埋名保护自己', correct: false }
        ]
      }
    ]
  };

  const handleSelect = (qidx: number, oidx: number, isCorrect: boolean) => {
    if (submitted) return;
    setDiagAnswer(qidx, oidx, isCorrect);
  };

  const handleSubmit = () => {
    submitDiagnosis();
    setSubmitted(true);
  };

  const allAnswered = diagAnswers.every(a => a !== null);

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📊</div>
        <h2>诊断完成！初始档案建立</h2>
        <p className="text-secondary mt-1 mb-6">我们已经精准算出了你的英语语境阅读水平</p>
        
        <div className="glass-card w-full mb-6" style={{ padding: '24px', maxWidth: '460px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>词汇诊断结果</div>
          <div className="stat-num mt-2 mb-2" style={{ fontSize: '2.2rem', color: 'var(--accent-teal)' }}>{diagLevel}</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            语境迁移正确率：<strong>{diagScore * 25}%</strong>。你可以非常好地在阅读中通过模糊字面还原其内在的语意。接下来，我们将按此基准配置你的故事难度。
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setOnboardingStage(3)}>
          确认我的起点 →
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="badge badge-teal mb-4">📈 STAGE 2 · 能力诊断</span>
      <h2>{qData.title}</h2>
      <p className="text-secondary mt-1 mb-4" style={{ fontSize: '0.85rem' }}>{qData.subtitle}</p>
      
      <div className="glass-card mb-6" style={{ padding: '20px', fontFamily: 'var(--font-story)', fontSize: '1rem', lineHeight: 1.8, color: 'var(--text-primary)' }}>
        {qData.text}
      </div>

      <div className="flex flex-col gap-6">
        {qData.questions.map((q, qidx) => (
          <div key={qidx} className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '12px', color: 'var(--text-primary)' }}>{q.q}</h4>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oidx) => {
                const answer = diagAnswers[qidx];
                const isSelected = answer?.oidx === oidx;
                return (
                  <div
                    key={oidx}
                    className={`choice-card ${isSelected ? 'selected' : ''}`}
                    style={{ padding: '10px 16px' }}
                    onClick={() => handleSelect(qidx, oidx, opt.correct)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="choice-letter" style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}>
                        {opt.text.substring(0, 1)}
                      </div>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        {opt.text.substring(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <button
          className="btn btn-primary"
          disabled={!allAnswered}
          onClick={handleSubmit}
        >
          提交诊断并分析 →
        </button>
      </div>
    </div>
  );
};

// Sub-Stage: Preferences Selection
const PreferencesStage: React.FC = () => {
  const { preferences, toggleGenre, setIntensity, setOnboardingStage } = useAppStore();

  const genres = [
    { id: 'mystery', label: '🔍 悬疑推理', desc: '扑朔迷离的探案故事' },
    { id: 'scifi',   label: '🚀 科幻冒险', desc: '星际深空的未来构想' },
    { id: 'campus',  label: '🌸 校园青春', desc: '温情真实的拼搏岁月' },
    { id: 'history', label: '⚔️ 历史架空', desc: '历史疑云的沙盘推演' }
  ];

  return (
    <div>
      <span className="badge badge-purple mb-4">⚙️ STAGE 3 · 偏好设置</span>
      <h2>定制你的故事世界</h2>
      <p className="text-secondary mt-1">我们将今天要学的单词，融入你最喜爱的情景里。</p>

      <div className="section-label mt-6">1. 喜欢的故事题材 (可多选)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {genres.map(g => (
          <div
            key={g.id}
            className={`toggle-chip ${preferences.genres.includes(g.id) ? 'selected' : ''}`}
            style={{ borderRadius: 'var(--radius-md)', padding: '14px', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}
            onClick={() => toggleGenre(g.id)}
          >
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{g.label}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{g.desc}</span>
          </div>
        ))}
      </div>

      <div className="section-label mt-6">2. 设定挑战强度</div>
      <div className="intensity-container">
        <div className={`intensity-card ${preferences.intensity === 'light' ? 'selected' : ''}`} onClick={() => setIntensity('light')}>
          <div className="intensity-icon">🌙</div>
          <div className="intensity-title">睡前放松</div>
          <div className="intensity-desc">每次 5 分钟，3个词</div>
        </div>
        <div className={`intensity-card ${preferences.intensity === 'medium' ? 'selected' : ''}`} onClick={() => setIntensity('medium')}>
          <div className="intensity-icon">📚</div>
          <div className="intensity-title">每日学习</div>
          <div className="intensity-desc">每次 15 分钟，5个词</div>
        </div>
        <div className={`intensity-card ${preferences.intensity === 'deep' ? 'selected' : ''}`} onClick={() => setIntensity('deep')}>
          <div className="intensity-icon">🔥</div>
          <div className="intensity-title">全力备考</div>
          <div className="intensity-desc">每次 25 分钟，8个词</div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button className="btn btn-primary" onClick={() => setOnboardingStage(4)}>
          开始生成故事 →
        </button>
      </div>
    </div>
  );
};

// Sub-Stage: Loading Animation
const ReadyStage: React.FC = () => {
  const { preferences, completeOnboarding, showToast } = useAppStore();
  const [pct, setPct] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);

  const finishOnboarding = async () => {
    setSaveFailed(false);
    const saved = await completeOnboarding();
    if (!saved) {
      setSaveFailed(true);
      showToast('初始档案尚未保存，请检查网络后重试');
      return;
    }
    showToast('🎉 故事世界生成完毕！进入首页');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setPct((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            void finishOnboarding();
          }, 400);
          return 100;
        }
        return prev + 5;
      });
    }, 80);
    return () => clearInterval(timer);
  }, [completeOnboarding, showToast]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 mt-8" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <div className="ready-ring"></div>
        <div style={{ fontSize: '3rem', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1 }}>🧬</div>
      </div>
      <h3 style={{ fontSize: '1.3rem', marginTop: '20px' }}>正在织造你专属的故事世界...</h3>
      <p className="text-secondary" style={{ fontSize: '0.85rem', maxWidth: '320px' }}>
        正在将高考词汇高密度融入「{preferences.genres.length > 0 ? '悬疑推理等' : '悬疑推理'}」题材的线索链中...
      </p>
      
      <div className="progress-bar w-full" style={{ height: '4px', maxWidth: '280px', marginTop: '10px' }}>
        <div className="progress-fill" style={{ width: `${pct}%` }}></div>
      </div>
      {saveFailed && (
        <div className="flex flex-col items-center gap-3" role="alert">
          <p className="text-secondary" style={{ fontSize: '0.85rem', margin: 0 }}>初始档案暂未同步成功。</p>
          <button className="btn btn-primary" onClick={() => void finishOnboarding()}>
            重试保存并进入首页
          </button>
        </div>
      )}
    </div>
  );
};

// --- 3. HOME SCREEN ---
const HomeScreen: React.FC = () => {
  const { streakDays, completedChapterCount, diagLevel, unlockedWords, currentChapter, activeSessionId, mustChangePassword, setScreen } = useAppStore();
  const [serverVocabularyCount, setServerVocabularyCount] = useState<number | null>(null);
  const [coreFirstAttemptRate, setCoreFirstAttemptRate] = useState<number | null>(null);
  const chapterIndex = currentChapter?.chapterIndex || completedChapterCount + 1;
  const title = chapterDisplayTitle(currentChapter?.title, chapterIndex === 1 ? '深夜的第七号车厢' : `第 ${chapterIndex} 章`);
  const chapterStatus = activeSessionId ? '进行中' : '未开始';
  const headline = '林亦正在等你';
  const subtext = `你已连续探索故事世界 ${streakDays} 天。今天的新线索刚刚显现。`;
  const chapterSummary = typeof currentChapter?.chapterSummary === 'string' ? currentChapter.chapterSummary.trim() : '';
  const quote = chapterSummary ? `❝ ${chapterSummary} ❞` : '❝ 新的线索正在浮现，开始本章阅读后查看详情。 ❞';
  const chapterExcerpt = typeof currentChapter?.storyText === 'string'
    ? currentChapter.storyText.replace(/<[^>]*>/g, '').trim().slice(0, 120)
    : '';
  const chapterHighlights = Array.isArray(currentChapter?.vocabHighlights)
    ? currentChapter.vocabHighlights.filter((item: any) => typeof item?.word === 'string').slice(0, 5)
    : [];

  useEffect(() => {
    let cancelled = false;
    void getLearningVocabularyApi().then((result) => {
      if (!cancelled && Array.isArray(result?.list)) setServerVocabularyCount(result.list.length);
    });
    void getLearningReportApi().then((result) => {
      const rate = result?.coreFirstAttempt?.ratePct;
      if (!cancelled) setCoreFirstAttemptRate(typeof rate === 'number' ? rate : null);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div id="home" className="screen">
      <nav className="home-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">✦</div>
          <span className="nav-logo-text">Curio</span>
        </div>
        <div className="home-nav-links">
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('home')}>首页</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('vocab-screen')}>词汇本</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('password-settings')}>账户</button>
          <button className="btn btn-ghost btn-sm" style={{ border: '1px solid rgba(45,212,191,0.25)', color: 'var(--accent-teal)' }} onClick={() => setScreen('parent-screen')}>
            家长报告 (v0.3)
          </button>
        </div>
      </nav>

      <main className="home-main z-1">
        {mustChangePassword && (
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', borderColor: 'rgba(245,200,66,0.35)' }}>
            <span>为保护账号安全，请先修改管理员提供的初始密码。</span>{' '}
            <button className="btn btn-primary btn-sm" onClick={() => setScreen('password-settings')}>去修改</button>
          </div>
        )}
        <div className="home-grid">
          {/* Left Block */}
          <div>
            <div className="section-label">🔥 故事连击状态</div>
            <div className="streak-card mb-6">
              <div className="streak-header">
                <div className="streak-flame">🔥</div>
                <div>
                  <div className="streak-headline" style={{ color: 'var(--accent-gold)' }}>{headline}</div>
                  <div className="streak-text" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{subtext}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="badge badge-gold" style={{ fontWeight: 700 }}>
                    当前 Streak: {streakDays}天
                  </span>
                </div>
              </div>
              <div className="streak-quote">{quote}</div>
            </div>

            <div className="section-label">📖 今日主线章节</div>
            <div className="main-story-card" onClick={() => setScreen('reader')}>
              <div className="story-card-chapter">第 {chapterIndex} 章 · 悬疑推理</div>
              <div className="story-card-title">{title}</div>
              <div className="story-card-excerpt">
                {chapterExcerpt ? `“${chapterExcerpt}${currentChapter.storyText.length > chapterExcerpt.length ? '…' : ''}”` : '开始阅读后查看本章线索。'}
              </div>
              <div className="story-card-meta">
                <span className="badge badge-purple">悬疑推理</span>
                <span className="badge badge-gold">⏱ 8 分钟</span>
                <span className="badge badge-teal">今日：{chapterHighlights.length || 0} 个词汇</span>
              </div>
              <div className="progress-section">
                <div className="progress-label">
                  <span>阅读进度</span>
                  <span>{chapterStatus}（第 {chapterIndex} / 10 章）</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: activeSessionId ? '70%' : '0%' }}></div>
                </div>
              </div>
              <button className="btn btn-primary" style={{ pointerEvents: 'none' }}>
                继续调查故事 →
              </button>
            </div>
          </div>

          {/* Right Block */}
          <div>
            <div className="section-label">📊 学习档案</div>
            <div className="stats-card-mini mb-6">
              <div className="mini-stat-row">
                <span className="mini-stat-label">词汇世界收录</span>
                <span className="mini-stat-val">{serverVocabularyCount ?? unlockedWords.size} / 5 个</span>
              </div>
              <div className="mini-stat-row">
                <span className="mini-stat-label">连续探索天数</span>
                <span className="mini-stat-val">{streakDays} 天</span>
              </div>
              <div className="mini-stat-row">
                <span className="mini-stat-label">起点诊断水平</span>
                <span className="mini-stat-val">{diagLevel}</span>
              </div>
              <div className="mini-stat-row">
                <span className="mini-stat-label">核心抉择正确率</span>
                <span className="mini-stat-val">{coreFirstAttemptRate === null ? '数据积累中' : `${coreFirstAttemptRate}%`}</span>
              </div>
            </div>

            <div className="section-label">💡 今日学习目标</div>
            <div className="glass-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                本章服务端内容中的重点词汇：
              </p>
              <div className="flex flex-col gap-3">
                {chapterHighlights.length > 0 ? chapterHighlights.map((highlight: any) => (
                  <div className="flex items-center gap-3" key={highlight.word}>
                    <span className={`badge ${highlight.type === 'core' ? 'badge-gold' : 'badge-teal'}`} style={{ padding: '2px 6px' }}>
                      {highlight.type === 'core' ? '核心' : '语境'}
                    </span>
                    <span style={{ fontWeight: highlight.type === 'core' ? 700 : 600, color: highlight.type === 'core' ? 'var(--accent-gold)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {highlight.word}
                    </span>
                  </div>
                )) : <span className="text-secondary">本章词汇将在开始阅读后加载。</span>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function normalizeChapter(raw: any) {
  if (!raw) return null;
  if (raw.content && raw.choice) return raw;

  const storyText: string = raw.storyText || raw.story_text || '';
  const vocabHighlights: Array<{ word: string; type: string }> = raw.vocabHighlights || [];

  const wordsToFind = vocabHighlights.map(v => v.word).filter(Boolean);
  let content: Array<{ type: 'text' | 'word'; text: string; word?: string }> = [];
  
  if (wordsToFind.length > 0) {
    const escaped = wordsToFind.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(storyText)) !== null) {
      if (match.index > lastIndex) {
        content.push({ type: 'text', text: storyText.substring(lastIndex, match.index) });
      }
      content.push({ type: 'word', word: match[0], text: match[0] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < storyText.length) {
      content.push({ type: 'text', text: storyText.substring(lastIndex) });
    }
  } else {
    content = [{ type: 'text', text: storyText }];
  }

  const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
  const correctChoice = rawChoices.find((c: any) => c.isCorrect);

  const choice = {
    context: '阅读关键情节，依据核心词表达准确抉择：',
    question: raw.choicePrompt || '基于故事细节的选择决策：',
    correctFeedback: correctChoice?.reason || '推理正确！完美理清了剧情主线。',
    options: rawChoices.map((c: any) => ({
      id: c.id,
      text: c.text,
      correct: !!c.isCorrect,
      reason: c.reason || ''
    }))
  };

  return {
    ...raw,
    title: raw.title || '深夜的第七号车厢',
    readTime: Math.ceil(storyText.length / 250) || 3,
    wordCount: vocabHighlights.length || 15,
    content,
    choice,
    branchStories: raw.branchStories || {},
    illustration: raw.illustration || null,
  };
}

// --- 4. READER SCREEN ---
const ReaderScreen: React.FC = () => {
  const { setScreen, choiceState, setChoiceState, outputSelectedWord, selectOutputWord, outputAttempts, setOutputAttempts, showToast, currentChapter: rawChapter, activeSessionId, completedChapterCount, completeSession, submitEvent, clientRevision } = useAppStore();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [chapterLoadError, setChapterLoadError] = useState(false);

  const chapter = useMemo(() => normalizeChapter(rawChapter), [rawChapter]);
  const chapterIndex = chapter?.chapterIndex || completedChapterCount + 1;
  const chapterTitle = chapterDisplayTitle(chapter?.title, chapterIndex === 1 ? '深夜的第七号车厢' : `第 ${chapterIndex} 章`);
  const focusWords: string[] = Array.isArray(chapter?.coreWords) && chapter.coreWords.length > 0
    ? chapter.coreWords
    : (chapter?.vocabHighlights || []).filter((highlight: any) => highlight.type === 'core').map((highlight: any) => highlight.word);
  const coreWord = focusWords[0] || null;
  const completionButtonLabel = `理解并回到主线，完成第 ${chapterIndex} 章 →`;

  const loadChapterSession = async () => {
    setChapterLoadError(false);
    const res = await startLearningSessionApi();
    if (res?.chapter) {
      useAppStore.getState().loadSnapshot(res);
    } else if (!chapter) {
      setChapterLoadError(true);
    }
  };

  useEffect(() => {
    if (!activeSessionId) {
      void loadChapterSession();
    }
  }, [activeSessionId]);

  const handleChoice = (id: string, correct: boolean) => {
    setSelectedLetter(id);
    setChoiceState(correct ? 'correct' : 'wrong-branch');
    submitEvent('critical_choice_submitted', { optionId: id, isCorrect: correct });
  };

  const [outputConfirmed, setOutputConfirmed] = useState(false);

  const handleOutputConfirm = () => {
    if (!outputSelectedWord) return;
    const nextAttempts = outputAttempts + 1;
    setOutputAttempts(nextAttempts);

    if (outputSelectedWord === 'ambiguous') {
      setOutputConfirmed(true);
    } else if (nextAttempts >= 2) {
      setOutputConfirmed(true);
    }
  };

  const handleFinish = async (wasCorrect: boolean) => {
    let eventsRecorded = true;
    if (wasCorrect) {
      eventsRecorded = await submitEvent('discrimination_submitted', { isCorrect: true });
    } else {
      eventsRecorded = await submitEvent('branch_completed', {});
      if (eventsRecorded) {
        eventsRecorded = await submitEvent('discrimination_submitted', { isCorrect: false });
      }
    }

    if (!eventsRecorded) {
      showToast('学习记录暂未同步，请检查网络后重试');
      return;
    }
    
    if (activeSessionId) {
      try {
        const res = await completeLearningSessionApi(activeSessionId, createClientId(), clientRevision);
        if (!res) {
          showToast('章节完成未确认，请检查网络后重试');
        } else if (res && (res.progress || res.idempotent || res.user || res.success)) {
          completeSession(res);
          showToast('🎉 恭喜你完成第一章！');
          setScreen('home');
        } else if (res?.error?.code === 'REVISION_CONFLICT') {
          showToast('进度已在另一设备更新');
          getLearningSnapshotApi().then(snap => {
            if (snap) {
              useAppStore.getState().loadSnapshot(snap);
              setScreen('home');
            }
          });
        } else if (res?.error) {
          showToast('章节完成未确认，请重试');
        } else {
          showToast('章节完成未确认，请重试');
        }
      } catch (err) {
        showToast('章节完成未确认，请检查网络后重试');
      }
    } else {
      setScreen('home');
    }
  };

  if (!chapter) {
    if (chapterLoadError) {
      return (
        <div id="reader-load-error" className="screen" style={{ color: 'white', padding: '40px 24px', textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}>
          <h3>Unable to load this chapter</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px', maxWidth: '420px' }}>
            This chapter is not available yet. Please try again later or return to the home page.
          </p>
          <div className="flex gap-3" style={{ marginTop: '24px' }}>
            <button className="btn btn-primary" onClick={() => void loadChapterSession()}>Retry</button>
            <button className="btn btn-ghost" onClick={() => setScreen('home')}>Back to home</button>
          </div>
        </div>
      );
    }
    return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Loading chapter data...</div>;
  }

  return (
    <div id="reader" className="screen">
      <nav className="reader-nav" style={{ position: 'relative' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setScreen('home')}>
          ← 返回首页
        </button>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          第 {chapterIndex} 章 · {chapterTitle}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setScreen('vocab-screen')}>词汇本</button>
        <div className="reader-progress-bar progress-bar" style={{ height: '3px' }}>
          <div className="progress-fill" style={{ width: choiceState !== 'pending' ? '100%' : '70%' }}></div>
        </div>
      </nav>

      <div className="reader-body z-1">
        <div className="chapter-badge">
          <div className="flex gap-2 flex-wrap">
            <span className="badge badge-purple">悬疑推理</span>
            <span className="badge badge-gold">⏱ {chapter.readTime} 分钟</span>
            <span className="badge badge-teal">📖 {chapter.wordCount} 个高考词汇</span>
          </div>
        </div>

        <h2 className="chapter-title" style={{ fontFamily: 'var(--font-story)' }}>{chapterTitle}</h2>

        {chapter.illustration?.assetPath && (
          <figure className="chapter-illustration" aria-label={chapter.illustration.alt || '本章关键情节四格漫画'}>
            <img src={chapter.illustration.assetPath} alt={chapter.illustration.alt || '本章关键情节四格漫画'} />
            <figcaption>关键情节 · 阅读前导</figcaption>
          </figure>
        )}

        <div className="word-tip-hint">
          <span>💡</span>
          <span>点击金色高亮单词，查看词义提示。重点关注核心词含义，它将成为关键抉择的决策依据。</span>
        </div>

        <div id="story-content" className="story-text" style={{ fontSize: '1.125rem', lineHeight: '1.9', color: 'var(--text-primary)', marginBottom: '24px' }}>
          {chapter.content.map((seg: { type: 'text' | 'word'; text: string; word?: string }, i: number) => {
            if (seg.type === 'text') {
              return <span key={i} dangerouslySetInnerHTML={{ __html: sanitizeStoryHtml(seg.text) }} />;
            }
            return <WordHighlight key={i} word={seg.word!} text={seg.text} storyExample={extractStorySentence(chapter.storyText, seg.word!)} />;
          })}
        </div>

        <div id="choice-section">
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '40px 0 32px', paddingTop: '32px' }}>
            <div className="choice-focus-banner" role="note">
              <div className="choice-focus-kicker"><span className="choice-focus-icon">⚡</span><span>本章辨识重点</span></div>
              <div className="choice-focus-words" aria-label="本章核心词">
                {focusWords.length > 0 ? focusWords.map((word: string) => <span className="choice-focus-word" key={word}>{word}</span>) : <span className="choice-focus-word">核心词</span>}
              </div>
              <div id="choice-focus-question" className="choice-focus-question">{chapter.choice.question}</div>
              <div className="choice-focus-hint">先回看正文中这些词的具体语境，再选择最准确的解释。</div>
            </div>
            <h3 className="mt-4 mb-4" style={{ fontSize: '1.05rem', lineHeight: 1.5 }}>{chapter.choice.question}</h3>
            
            <div className="flex flex-col gap-3">
              {chapter.choice.options.map((opt: { id: string; text: string; correct: boolean }) => {
                const isChosen = selectedLetter === opt.id;
                const classVal = isChosen ? (opt.correct ? 'choice-card correct' : 'choice-card wrong') : 'choice-card';
                return (
                  <div
                    key={opt.id}
                    className={classVal}
                    style={{ pointerEvents: choiceState !== 'pending' ? 'none' : 'auto' }}
                    onClick={() => handleChoice(opt.id, opt.correct)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="choice-letter">{opt.id}</div>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{opt.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {choiceState === 'correct' && (
              <div id="reader-feedback" style={{ marginTop: '20px' }}>
                <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(45,212,191,0.25)', background: 'rgba(45,212,191,0.02)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>推理正确！林亦的判断更准确</span>
                  </div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>{chapter.choice.correctFeedback}</p>

                  <div id="output-signal-box" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>✏️ 帮 ELENA 完成推理记录</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '10px', fontStyle: 'italic' }}>
                      Elena 在记录本上写道：「这封信的措辞是
                      <span id="output-word-slot" style={{ color: outputSelectedWord ? 'var(--accent-gold)' : 'var(--text-muted)', fontStyle: outputSelectedWord ? 'normal' : 'italic', fontWeight: outputSelectedWord ? '700' : 'normal', borderBottom: '1px dashed var(--border-subtle)', padding: '0 6px', minWidth: '72px', display: 'inline-block', textAlign: 'center' }}>
                        {outputSelectedWord || '___'}
                      </span>
                      的，而非单纯的含糊——它指向了两个截然相反的可能。」
                    </div>

                    {!outputConfirmed ? (
                      <>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {['ambiguous', 'vague', 'unclear'].map(w => (
                            <button
                              key={w}
                              onClick={() => selectOutputWord(w)}
                              style={{
                                padding: '4px 14px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-subtle)',
                                background: outputSelectedWord === w ? 'rgba(245,200,66,0.15)' : 'transparent',
                                borderColor: outputSelectedWord === w ? 'var(--accent-gold)' : 'var(--border-subtle)',
                                color: outputSelectedWord === w ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                fontWeight: outputSelectedWord === w ? '600' : '400',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                        {outputAttempts === 1 && outputSelectedWord !== 'ambiguous' && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,107,107,0.05)', borderRadius: '8px', borderLeft: '2px solid var(--accent-coral)', marginBottom: '10px' }}>
                            📖 {outputSelectedWord === 'vague' ? (
                              <><strong>注意区分</strong>：vague 描述的是表达者自身的不清晰——说话人没想好就开口了。但父亲的信太「精准」了，它不是说不清楚，而是两条路都完整自洽。这种精准，只有 <strong>ambiguous</strong> 才能描述。</>
                            ) : (
                              <><strong>提示</strong>：unclear 是最宽泛的「不明确」，但它没有指向「为什么不明确」。这封信不是因为信息不足而不明确，而是它同时包含了一条以上完整的解读路径。这种「双重可能」，用 <strong>ambiguous</strong> 才最准确。</>
                            )}
                          </div>
                        )}
                        <button
                          className="btn"
                          disabled={!outputSelectedWord}
                          onClick={handleOutputConfirm}
                          style={{
                            padding: '5px 16px',
                            borderRadius: '20px',
                            background: outputSelectedWord ? 'rgba(245,200,66,0.12)' : 'rgba(100,100,100,0.08)',
                            color: outputSelectedWord ? 'var(--accent-gold)' : 'var(--text-muted)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            border: '1px solid var(--border-subtle)',
                            cursor: outputSelectedWord ? 'pointer' : 'not-allowed',
                            opacity: outputSelectedWord ? 1 : 0.45,
                            transition: 'all 0.25s'
                          }}
                        >
                          {outputAttempts > 0 ? '再次确认 →' : '确认记录 →'}
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', padding: '6px 0', lineHeight: 1.6 }}>
                        {outputSelectedWord === 'ambiguous' ? (
                          <div style={{ color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>✅</span>
                            <span>Elena 满意地点头，在记录本上工整写下「ambiguous」，画了一个圆圈。</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ marginBottom: '10px' }}>📝 Elena 轻轻擦去「{outputSelectedWord}」，重新写上 <strong style={{ color: 'var(--accent-gold)' }}>ambiguous</strong>。</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '9px 12px', background: 'rgba(245,200,66,0.04)', borderRadius: '8px', border: '1px solid rgba(245,200,66,0.15)', lineHeight: 1.6 }}>
                              💡 记忆锚：<strong>ambiguous</strong> = 两条路都完整自洽（刻意设计）；<strong>vague</strong> = 说不清楚（信息不足）；<strong>unclear</strong> = 泛指的不明确
                            </div>
                          </>
                        )}
                        <button className="btn btn-primary mt-4" onClick={() => handleFinish(outputSelectedWord === 'ambiguous')}>
                          完成第 {chapterIndex} 章，回到首页 →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {choiceState === 'wrong-branch' && (
              <div id="reader-feedback" style={{ marginTop: '20px' }}>
                <div className="branch-story-container">
                  <div className="branch-header">
                    <span>⚡</span>
                    <span>触发支线故事 · 语境理解深度纠偏</span>
                  </div>
                  <p style={{ color: 'var(--text-primary)', marginBottom: '16px' }} dangerouslySetInnerHTML={{ __html: sanitizeStoryHtml(selectedLetter ? (chapter.branchStories?.[selectedLetter] || '') : '') }}></p>
                  
                  <div className="glass-card mb-4" style={{ padding: '16px', borderColor: 'var(--accent-coral)', background: 'rgba(255,107,107,0.02)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      💡 {coreWord ? `核心词汇 ${coreWord} 强化纠偏:` : '语境理解强化纠偏:'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {coreWord ? `支线故事会把 ${coreWord} 的准确含义放回具体情境，帮助你完成这次语境纠偏。` : '支线故事会把关键语境放回具体情境，帮助你完成这次语境纠偏。'}
                    </div>
                  </div>

                  <button className="btn btn-primary" onClick={() => handleFinish(false)}>
                    {completionButtonLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 5. VOCAB BOOK SCREEN ---
const VocabScreen: React.FC = () => {
  const { setScreen, unlockedWords } = useAppStore();
  const [ccAnswers, setCcAnswers] = useState<Record<string, { idx: number; correct: boolean }>>({});
  const [serverVocabulary, setServerVocabulary] = useState<Record<string, VocabItem>>({});

  useEffect(() => {
    getLearningVocabularyApi().then((result) => {
      if (!result?.list) return;
      setServerVocabulary(Object.fromEntries(result.list.map((item) => [
        item.word,
        toVocabItem(item),
      ])));
    });
  }, []);

  const handleCcAnswer = (word: string, idx: number, correct: boolean) => {
    if (ccAnswers[word]) return; // already answered
    setCcAnswers(prev => ({
      ...prev,
      [word]: { idx, correct }
    }));
  };

  const unlockedList = Array.from(new Set([...unlockedWords, ...Object.keys(serverVocabulary)]));

  return (
    <div id="vocab-screen" className="screen">
      <nav className="home-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">✦</div>
          <span className="nav-logo-text">Curio</span>
        </div>
        <div className="home-nav-links">
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('home')}>首页</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('vocab-screen')}>词汇本</button>
          <button className="btn btn-ghost btn-sm" style={{ border: '1px solid rgba(45,212,191,0.25)', color: 'var(--accent-teal)' }} onClick={() => setScreen('parent-screen')}>
            家长报告 (v0.3)
          </button>
        </div>
      </nav>

      <div className="vocab-header">
        <div className="flex justify-between items-center w-full">
          <div>
            <h2>我的词汇世界</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>它们都活在你的故事里</p>
          </div>
          <span className="badge badge-gold" id="vocab-book-count" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {unlockedList.length} 个词汇
          </span>
        </div>
      </div>

      <div id="vocab-list">
        {unlockedList.length === 0 ? (
          <div className="glass-card text-center" style={{ padding: '40px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
            <h3 className="mb-2">你的词汇世界空空如也</h3>
            <p className="text-secondary" style={{ fontSize: '0.88rem' }}>在 Onboarding 体验中阅读故事，或开始第一章，唤醒的词汇就会进入这里。</p>
            <button className="btn btn-primary mt-4 btn-sm" onClick={() => setScreen('home')}>去读故事 →</button>
          </div>
        ) : (
          unlockedList.map(word => {
            const data = serverVocabulary[word];
            if (!data) return null;
            const ans = ccAnswers[word];

            return (
              <div key={word} className="vocab-scene-card">
                <div className="vocab-card-header">
                  <div style={{ width: '100%' }}>
                    <div className="flex items-center justify-between" style={{ width: '100%' }}>
                      <div className="flex items-center">
                        <span className="vocab-word-title">{data.word}</span>
                        <span className={`badge ${data.type === 'core' ? 'badge-gold' : 'badge-teal'}`} style={{ marginLeft: '10px', fontSize: '0.6rem', padding: '1px 6px' }}>
                          {data.type === 'core' ? '核心词汇' : '语境复现词'}
                        </span>
                      </div>
                      {data.pos && <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600, fontFamily: 'monospace', opacity: 0.8 }}>{data.pos}</span>}
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-2 mb-2" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }} onClick={() => speakWord(data.word, false)}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>UK 🔊</span> {data.ukPhonetic}
                      </div>
                      <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }} onClick={() => speakWord(data.word, true)}>
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>US 🔊</span> {data.usPhonetic}
                      </div>
                    </div>

                    <div className="vocab-word-meaning" style={{ fontWeight: 600, marginTop: '6px' }}>{data.meaning}</div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(245,200,66,0.04)', borderRadius: '8px', border: '1px solid rgba(245,200,66,0.15)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '7px' }}>🌿 词族 WORD FAMILY</div>
                    {data.wordFamily && data.wordFamily.length > 0 ? data.wordFamily.map(f => (
                      <div key={f.form} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{f.form}</span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{f.pos}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.meaning}</span>
                      </div>
                    )) : <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>暂无可验证的高中范围词族</div>}
                </div>

                {data.nearSynonym && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(99,102,241,0.04)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>⚡ 近义辨析 vs {data.nearSynonym.word}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '5px' }}>{data.nearSynonym.distinction}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--accent-gold)', lineHeight: 1.5 }}>💡 {data.nearSynonym.tip}</div>
                  </div>
                )}

                <div className="vocab-quote-box" style={{ marginTop: '12px' }}>
                  {data.example}
                </div>
                
                <div className="vocab-scene-tag">
                  <span>📍</span>
                  <span>{data.scene}</span>
                </div>

                {data.crossContext && (
                  <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(30,215,255,0.03)', borderRadius: '10px', border: '1px solid rgba(30,215,255,0.12)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '9px' }}>📊 跨语境迁移测试 · 高考仿真语境</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.75, fontStyle: 'italic', marginBottom: '6px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '2px solid var(--accent-gold)' }}>
                      &ldquo;{data.crossContext.sentence}&rdquo;
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>{data.crossContext.translation}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>{data.crossContext.question}</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {data.crossContext.options.map((opt, oidx) => {
                        const isAnswered = ans !== undefined;
                        const isThisSelected = ans?.idx === oidx;
                        const isThisCorrect = opt.correct;
                        let cardStyle: React.CSSProperties = {
                          padding: '9px 13px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          cursor: isAnswered ? 'default' : 'pointer',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          transition: 'all 0.2s',
                          lineHeight: '1.4'
                        };

                        if (isAnswered) {
                          if (isThisSelected) {
                            cardStyle.background = isThisCorrect ? 'rgba(45,212,191,0.1)' : 'rgba(255,107,107,0.08)';
                            cardStyle.borderColor = isThisCorrect ? 'var(--accent-teal)' : 'var(--accent-coral)';
                            cardStyle.color = isThisCorrect ? 'var(--accent-teal)' : 'var(--accent-coral)';
                          } else if (isThisCorrect) {
                            cardStyle.borderColor = 'var(--accent-teal)';
                            cardStyle.color = 'var(--accent-teal)';
                          }
                        }

                        return (
                          <div
                            key={oidx}
                            style={cardStyle}
                            onClick={() => !isAnswered && handleCcAnswer(word, oidx, opt.correct)}
                          >
                            {'ABCD'[oidx]}. {opt.text}
                          </div>
                        );
                      })}
                    </div>
                    
                    {ans && (
                      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {ans.correct ? (
                          <>✅ 语境迁移正确！你在全新语域中精准识别了这个词的核心语义。</>
                        ) : (
                          <>📖 高考提示：无论语境如何变化，<strong style={{ color: 'var(--accent-gold)' }}>{word}</strong> 的核心语义不变——「{data.crossContext.options.find(o => o.correct)?.text}」</>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// --- 6. PARENT SCREEN ---
const ParentScreen: React.FC = () => {
  const { setScreen, showToast } = useAppStore();
  const [reportData, setReportData] = useState<any>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLearningReportApi().then(data => {
      if (data && !data.error) setReportData(data);
    });
  }, []);

  const handleGeneratePoster = async () => {
    if (!posterRef.current) return;
    try {
      const canvas = await html2canvas(posterRef.current, { scale: 2, useCORS: true, backgroundColor: '#0a0a0e' });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('海报生成失败');
          return;
        }
        
        await postPosterExportedApi();
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const file = new File([blob], 'curio-learning-report.png', { type: 'image/png' });
        
        if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: 'Curio 学习报告',
          }).catch(() => {
            showImageModal(blob);
          });
        } else if (isMobile) {
          showImageModal(blob);
        } else {
          // PC download fallback
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'curio-learning-report.png';
          a.click();
          URL.revokeObjectURL(url);
          showToast('海报已保存');
        }
      }, 'image/png');
    } catch (err) {
      showToast('海报生成出错，请重试');
    }
  };

  const [posterImgSrc, setPosterImgSrc] = useState<string | null>(null);
  
  const showImageModal = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setPosterImgSrc(url);
  };

  const getStat = (val: number | null | undefined, suffix = '') => {
    if (val === null || val === undefined) return '数据积累中';
    return `${val}${suffix}`;
  };

  return (
    <div id="parent-screen" className="screen">
      <nav className="home-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">✦</div>
          <span className="nav-logo-text">Curio</span>
        </div>
        <div className="home-nav-links">
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('home')}>首页</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setScreen('vocab-screen')}>词汇本</button>
          <button className="btn btn-ghost btn-sm" style={{ border: '1px solid rgba(45,212,191,0.25)', color: 'var(--accent-teal)' }} onClick={() => setScreen('parent-screen')}>
            家长报告
          </button>
        </div>
      </nav>

      <div className="parent-container z-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '20px' }}>
        <div 
          className="parent-report-card" 
          ref={posterRef} 
          style={{ 
            padding: '40px', 
            background: 'var(--bg-dark, #0a0a0e)', 
            width: '1080px', 
            maxWidth: '100%', 
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div className="parent-title-group text-center" style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '12px', color: 'var(--text-primary)' }}>学习者简报</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>基于高考真题考点与记忆遗忘曲线自动跟踪生成</p>
          </div>

          <div className="report-stat-grid" style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '40px' }}>
            <div className="report-stat-item" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '32px 24px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="report-stat-num" style={{ color: 'var(--accent-teal)', fontSize: '2.2rem', fontWeight: 'bold' }}>
                {reportData ? getStat(reportData.validLearningDays, ' 天') : '数据积累中'}
              </div>
              <div className="report-stat-label" style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '1.1rem' }}>有效学习天数</div>
            </div>
            <div className="report-stat-item" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '32px 24px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="report-stat-num" style={{ color: 'var(--accent-gold)', fontSize: '2.2rem', fontWeight: 'bold' }}>
                {reportData ? getStat(reportData.completedChapters, ' 章') : '数据积累中'}
              </div>
              <div className="report-stat-label" style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '1.1rem' }}>完成章节数</div>
            </div>
            <div className="report-stat-item" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '32px 24px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="report-stat-num" style={{ color: 'var(--accent-coral)', fontSize: '2.2rem', fontWeight: 'bold' }}>
                {reportData ? getStat(reportData.lookedUpUniqueWords, ' 词') : '数据积累中'}
              </div>
              <div className="report-stat-label" style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '1.1rem' }}>查阅词汇数</div>
            </div>
          </div>

          <div className="report-card-list" style={{ background: 'rgba(255,255,255,0.03)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="report-detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem' }}>
              <span className="text-secondary" style={{ color: 'var(--text-secondary)' }}>核心词首答正确率</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData?.coreFirstAttempt?.ratePct !== null && reportData?.coreFirstAttempt?.ratePct !== undefined 
                  ? `${reportData.coreFirstAttempt.ratePct}%` 
                  : '数据积累中'}
              </span>
            </div>
            <div className="report-detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', fontSize: '1.2rem' }}>
              <span className="text-secondary" style={{ color: 'var(--text-secondary)' }}>语境辨析正确率</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData?.discriminationFirstAttempt?.ratePct !== null && reportData?.discriminationFirstAttempt?.ratePct !== undefined 
                  ? `${reportData.discriminationFirstAttempt.ratePct}%` 
                  : '数据积累中'}
              </span>
            </div>
          </div>
        </div>

        <div className="sharing-cta-box" style={{ marginTop: '32px', textAlign: 'center', maxWidth: '400px' }}>
          <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '1.1rem', width: '100%' }} onClick={handleGeneratePoster}>
            保存学习海报
          </button>
        </div>
      </div>
      
      {posterImgSrc && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setPosterImgSrc(null)}>
          <p style={{ color: 'white', marginBottom: '16px', fontSize: '1.1rem' }}>长按图片保存到相册</p>
          <img src={posterImgSrc} alt="学习海报" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px' }} onClick={(e) => e.stopPropagation()} />
          <button className="btn btn-ghost mt-4" onClick={() => setPosterImgSrc(null)}>关闭</button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN APPLICATION SHELL
// ============================================================
const App: React.FC = () => {
  const { screen, setScreen, resetAll, loadSnapshot, flushRetryQueue } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [isCurioRoute, setIsCurioRoute] = useState(() => window.location.pathname === '/curio' || window.location.pathname.startsWith('/curio/'));

  const navigateToSite = () => {
    window.history.pushState({}, '', '/');
    setIsCurioRoute(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const navigateToCurio = () => {
    window.history.pushState({}, '', '/curio');
    setIsCurioRoute(true);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  useEffect(() => {
    // Globally register error handler
    const handler = (e: ErrorEvent) => {
      console.error("Global captured error:", e.error);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  useEffect(() => {
    const flush = () => { void flushRetryQueue(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') flush();
    };
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(flush, 30_000);
    flush();
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [flushRetryQueue]);

  useEffect(() => {
    const syncRoute = () => setIsCurioRoute(window.location.pathname === '/curio' || window.location.pathname.startsWith('/curio/'));
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const boot = () => {
    setBootError(false);
    getMeApi().then(res => {
      if (res && res.user) {
        // Logged in, fetch snapshot
        getLearningSnapshotApi().then(snap => {
          if (snap) {
            loadSnapshot(snap);
            setScreen('home');
            setAuthChecked(true);
          } else {
            setBootError(true);
          }
        }).catch(() => {
          setBootError(true);
        });
      } else {
        // Not logged in
        setScreen('login');
        setAuthChecked(true);
      }
    }).catch(() => {
      setScreen('login');
      setAuthChecked(true);
    });
  };

  useEffect(() => {
    if (!isCurioRoute) {
      setBootError(false);
      setAuthChecked(false);
      return;
    }
    boot();
  }, [isCurioRoute, setScreen]);

  if (!isCurioRoute) {
    return <SiteHome onOpenCurio={navigateToCurio} />;
  }

  if (bootError) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>
        <h3>Failed to load learning progress.</h3>
        <button className="btn btn-primary mt-4" onClick={boot}>重试</button>
      </div>
    );
  }

  if (!authChecked) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;
  }


  return (
    <>
      <BackgroundDecorations />
      <Toast />

      {/* Main Switcher */}
      {screen === 'login' && <LoginScreen onSuccess={() => setScreen('landing')} onExit={navigateToSite} />}
      {screen === 'password-settings' && <PasswordSettings onClose={() => setScreen('home')} />}
      {screen === 'landing' && <LandingScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'reader' && <ReaderScreen />}
      {screen === 'vocab-screen' && <VocabScreen />}
      {screen === 'parent-screen' && <ParentScreen />}

      {/* Dev Reset Floating Button */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 10000, opacity: 0.35 }}>
        <button
          onClick={resetAll}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-muted)',
            fontSize: '0.65rem',
            padding: '4px 8px',
            cursor: 'pointer'
          }}
        >
          重置体验
        </button>
      </div>
    </>
  );
};

export default App;
