// ============================================================
//  CURIO — App Logic (P1 Prototype v0.3)
// ============================================================

// ── Mock Data ─────────────────────────────────────────────────

const VOCAB = {
  ambiguous: {
    word: 'ambiguous',
    pos: 'adj.',
    ukPhonetic: '/æmˈbɪɡ.ju.əs/',
    usPhonetic: '/æmˈbɪɡ.ju.əs/',
    meaning: '模糊的；有歧义的（含多种解读可能）',
    example: '那封信的内容极为 ambiguous，每一句话都像是在同时指向两个截然不同的方向。',
    scene: '第一章 · 深夜快车',
    type: 'core',
    wordFamily: [
      { form: 'ambiguity',   pos: 'n.',   meaning: '歧义性；含糊不清' },
      { form: 'unambiguous', pos: 'adj.', meaning: '明确的；无歧义的' },
      { form: 'ambiguously', pos: 'adv.', meaning: '含糊地；模棱两可地' }
    ],
    nearSynonym: {
      word: 'vague',
      distinction: 'ambiguous 指同一表述同时存在多种明确但相互矛盾的解读（语言设计层面的双重含义）；vague 指表达印象模糊、缺乏具体细节（信息量不足层面）',
      tip: '完形口诀：ambiguous = 两可（能往两边解读）；vague = 说不清（描述不够具体）'
    },
    crossContext: {
      sentence: "The government's statement on the new policy remained ambiguous, leaving both supporters and critics uncertain about the actual direction.",
      translation: '政府关于新政策的声明依然模棱两可，让支持者和批评者都无法确定实际走向。',
      question: '在这段政治新闻语境中，ambiguous 最接近的意思是？',
      options: [
        { text: '充满争议的，令各方强烈不满的', correct: false },
        { text: '含有多种截然相反解读的，指向不明确的', correct: true },
        { text: '过于复杂晦涩，令人难以理解的', correct: false },
        { text: '故意回避问题的，明显不愿表态的', correct: false }
      ]
    }
  },
  deduce: {
    word: 'deduce',
    pos: 'v.',
    ukPhonetic: '/dɪˈdjuːs/',
    usPhonetic: '/dɪˈduːs/',
    meaning: '推断；推论（基于证据的系统性演绎）',
    example: '林亦闭上眼睛，综合分析杯子温度和手表时间，以此 deduce 出真实的冲突时刻。',
    scene: 'Onboarding · 停滞的钟表',
    type: 'core',
    wordFamily: [
      { form: 'deduction',  pos: 'n.',   meaning: '推断；演绎；扣除' },
      { form: 'deductive',  pos: 'adj.', meaning: '演绎性的；推论的' },
      { form: 'deducible',  pos: 'adj.', meaning: '可推断的；可演绎的' }
    ],
    nearSynonym: null,
    crossContext: {
      sentence: 'From the fossil records, scientists were able to deduce that the ancient species had lived in tropical environments millions of years ago.',
      translation: '从化石记录中，科学家们能够推断出这种古代物种数百万年前生活在热带环境中。',
      question: '在这段科学语境中，deduce 最接近的意思是？',
      options: [
        { text: '凭直觉或想象进行主观猜测', correct: false },
        { text: '基于客观证据，通过系统性逻辑推理得出结论', correct: true },
        { text: '从他人处被动接受或获取信息', correct: false },
        { text: '基于个人经验或偏好做出主观判断', correct: false }
      ]
    }
  },
  concealed: {
    word: 'concealed',
    pos: 'adj./v.',
    ukPhonetic: '/kənˈsiːld/',
    usPhonetic: '/kənˈsiːld/',
    meaning: '隐藏的；隐蔽的（刻意为之）',
    example: '那封 concealed 在油画背后的信件，已经在黑暗里静静等待了整整三年。',
    scene: 'Onboarding · 消失的信件',
    type: 'core',
    wordFamily: [
      { form: 'conceal',     pos: 'v.',   meaning: '隐藏；隐瞒；遮蔽（动词原形）' },
      { form: 'concealment', pos: 'n.',   meaning: '隐藏；掩饰；藏匿状态' },
      { form: 'unconcealed', pos: 'adj.', meaning: '未隐藏的；公开表露的' }
    ],
    nearSynonym: null,
    crossContext: null
  },
  resilient: {
    word: 'resilient',
    pos: 'adj.',
    ukPhonetic: '/rɪˈzɪl.i.ənt/',
    usPhonetic: '/rɪˈzɪl.jənt/',
    meaning: '有韧性的；能快速恢复的',
    example: '在过去三年的无数个失望夜晚，她正是凭借着 resilient 的性格撑了过来。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'resilience',  pos: 'n.',   meaning: '韧性；恢复力；弹性' },
      { form: 'resiliently', pos: 'adv.', meaning: '坚韧地；有弹性地' }
    ],
    nearSynonym: null,
    crossContext: null
  },
  persevere: {
    word: 'persevere',
    pos: 'v.',
    ukPhonetic: '/ˌpɜː.sɪˈvɪə/',
    usPhonetic: '/ˌpɝː.səˈvɪr/',
    meaning: '坚持不懈；锲而不舍',
    example: '林亦发誓要 persevere 到最后一刻，绝不放弃寻找父亲的下落。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'perseverance', pos: 'n.',   meaning: '坚持不懈；毅力；锲而不舍' },
      { form: 'persevering',  pos: 'adj.', meaning: '坚持不懈的；锲而不舍的' }
    ],
    nearSynonym: null,
    crossContext: null
  },
};

const ONBOARDING_DEMOS = [
  {
    id: 'concealed',
    title: '消失的信件',
    genre: '悬疑推理',
    word: 'concealed',
    content: [
      { type: 'text', text: '林亦推开父亲旧办公室的门。空气中弥漫着陈旧纸张和霉味。书桌上的东西都被搬空了，唯独墙上还挂着那幅暴风雨中的灯塔油画。林亦走上前，注意到这幅画挂得太正了——正到不自然。她把画框小心翼翼地从墙上取下，指尖在画框背后的凹槽里触到了一个硬纸角。有人花了很大力气，让这个小信封彻底消失在所有人的视线里。这封被 ' },
      { type: 'word', word: 'concealed', text: 'concealed' },
      { type: 'text', text: ' 在阴影中的信件，已经在黑暗里静静等待了整整三年。这一刻，尘封的往事终于露出了一角。' }
    ],
    choice: {
      question: '面对这封被刻意隐藏的信，林亦接下来应该如何行动？',
      options: [
        { id: 'A', text: '立即拆开信件，并按照上面的地址寻找发信人', correct: false, reason: '认为 concealed 只是偶然遗忘，忽略了潜在危险' },
        { id: 'B', text: '先戴上手套，仔细检查信封封口的蜡印和封存痕迹', correct: true, reason: '正确理解 concealed 代表着刻意防范与机密，防范潜在陷阱' },
        { id: 'C', text: '觉得这只是父亲遗落的普通草稿，不值一提，随手塞进口袋', correct: false, reason: '误解为普通遗忘，没有意识到隐藏的刻意性' },
        { id: 'D', text: '怀疑信件有毒，立刻用火烧掉它', correct: false, reason: '过度反应，误认为 concealed 代表绝对的物理危险' }
      ],
      correctFeedback: '推理正确！林亦戴上手套，小心翼翼地取下信封。她明白，这封 concealed 的信件能被藏得如此隐蔽，其重要性不言而喻，任何大意的触碰都可能破坏关键指纹……',
      branchText: '林亦伸出手指，刚要徒手撕开信封封口，她的动作突然凝固了。她看着在暗格里被挤压变形的信角——如果这只是一封普通家书，为何要如此煞费苦心地藏在画框暗槽中？这里的每一道胶漆，都写着「不可告人」。在危机四伏的苍澜市，任何对“隐藏之物”的轻率触碰都可能触发毁灭性的警报。林亦冷静下来，戴上橡胶手套，开始像对待危险品一样剥离这封 concealed 的信……（主线汇流）'
    }
  },
  {
    id: 'deduce',
    title: '停滞的钟表',
    genre: '悬疑推理',
    word: 'deduce',
    content: [
      { type: 'text', text: '深夜二点，暴雨敲打着苍澜市码头的铁皮屋顶。林亦蹲在废弃的调度室里，手电筒的光束照亮了地上的打斗痕迹。一只摔碎的手表指针停在 11:15，而桌上的咖啡杯杯壁还是温热的。两个嫌疑人提供了完全相反的供词：守卫说他整晚都在值班没看到任何人，而清洁工发誓他在十一点半听到这里有剧烈争吵。所有的碎片都散落在眼前，林亦闭上眼睛。作为一个侦探，她的工作不是猜测，而是从这些冰冷的事实中 ' },
      { type: 'word', word: 'deduce', text: 'deduce' },
      { type: 'text', text: ' 出唯一的真相。' }
    ],
    choice: {
      question: '根据现场信息，林亦应该如何开展理性的 "deduce"？',
      options: [
        { id: 'A', text: '直接相信清洁工的证词，因为他看起来老实且慌乱', correct: false, reason: '把 deduce 理解为“基于情绪直觉去相信某人”' },
        { id: 'B', text: '综合分析咖啡杯温度与表盘撞击力，排除守卫谎言，算出冲突时间', correct: true, reason: '正确理解 deduce = 基于客观证据的逻辑推理' },
        { id: 'C', text: '觉得线索过于凌乱且相互矛盾，放弃推论并离开现场', correct: false, reason: '误以为 deduction 在证据不完美时就完全行不通' },
        { id: 'D', text: '决定在原地被动等待，直到有更多的目击证人出现', correct: false, reason: '把推理过程误解为被动地等待更多事实直接呈现在眼前' }
      ],
      correctFeedback: '推理正确！林亦通过咖啡温度与表盘裂痕，迅速 deduce 出搏斗发生在20分钟前，直接戳穿了守卫谎言……',
      branchText: '林亦下意识地倾向于清洁工那双战战兢兢的眼睛，准备在记录本上落笔。然而手电筒光忽然扫过咖啡杯底——桌面上有一圈未干的水渍。这意味着咖啡杯是在十分钟前刚刚被放在这里的。直觉欺骗了她，如果只凭好恶去断定清白，绝不叫推断。真正的推理是让客观证据自己拼成拼图。林亦深吸一口气，强迫思维回归理性的天平，重新去 deduction 每一个物证……（主线汇流）'
    }
  }
];

const STAGE2_DIAGNOSIS = {
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

const MAIN_STORY = {
  title: '深夜的第七号车厢',
  genre: '悬疑推理',
  totalChapters: 5,
  chapters: [
    {
      id: 1,
      title: '午夜快车',
      readTime: 8,
      wordCount: 5,
      content: [
        { type: 'text', text: '夜晚十一点整，穿越苍澜市北郊山脉的快车缓缓驶出站台。车厢里，昏黄的壁灯将每个人的脸映成了琥珀色。林亦靠窗坐下，展开手中那封皱巴巴的信件——这是她在父亲失踪三年的书房夹层中发现的。笔迹虽然是父亲的，但内容却极为 ' },
        { type: 'word', word: 'ambiguous', text: 'ambiguous' },
        { type: 'text', text: '，每一句话都像是在同时指向两个截然不同的方向。如果无法理清这层含混不清的字面意思，她将永远无法迈出寻找真相的第一步。她强迫自己保持冷静。在过去三年的无数个失望夜晚，她正是凭借着 ' },
        { type: 'word', word: 'resilient', text: 'resilient' },
        { type: 'text', text: ' 的性格一次次重新站起来的。为了找到父亲失踪的秘密，她愿意 ' },
        { type: 'word', word: 'persevere', text: 'persevere' },
        { type: 'text', text: ' 到生命的最后一刻，绝不退缩。此时，列车长 Marco 穿过走廊，脚步比平时急促。林亦抬眼观察他——袖口的黄泥，微微发抖的右手，以及那个他以为无人注意的 ' },
        { type: 'word', word: 'concealed', text: 'concealed' },
        { type: 'text', text: ' 的小包裹，被他压在报纸下面。林亦根据这些反常的细节，开始在脑海中默默 ' },
        { type: 'word', word: 'deduce', text: 'deduce' },
        { type: 'text', text: ' 他的真实意图。<br><br>就在这时，斜对面座位上的陈顾放下手机，瞥了一眼林亦手里的信纸。「这封信？」他压低声音，「措辞只是有些含糊，vague 而已。你父亲当时可能只是随意记录，没想着给外人看。」<br><br>林亦摇了摇头，把信纸对着昏黄的车厢灯光重新看了一遍。「不，」她说，「这不是 vague。每一句话都同时存在两种截然相反的解读——这是刻意的。有人费了心思让它看起来像普通家信，但每句话都同时指向另一条线索。这是 ambiguous——不是模糊，是精心设计的双重含义。」<br><br>陈顾沉默了几秒，重新看向那封信。' }
      ],
      choice: {
        keyword: 'ambiguous',
        context: 'Elena 确认这封信是 ambiguous 的——',
        question: '她的下一步推理，必须建立在以下哪个前提之上？',
        options: [
          { id: 'A', text: '父亲当时匆忙，没有时间仔细选词——两种读法只是无意为之的结果', correct: false, reason: '混淆了 ambiguous（刻意设计的双重含义）和 vague（无意的措辞不清晰）——如果只是匆忙随意，两条路不会都完整自洽' },
          { id: 'B', text: '写信人刻意设计了两条截然相反的线索路径，两条路都能在逻辑上完整自洽', correct: true, reason: '正确理解 ambiguous 的核心属性：同一表述刻意包含两种相互矛盾但各自完整的解读路径，两条路都成立' },
          { id: 'C', text: '信件内容本身是错误的，两种读法都指向虚假线索，父亲在故意误导', correct: false, reason: '混淆了 ambiguous（双重有效解读）和 misleading（故意误导）——ambiguous 不代表两条路都是假的，而是两条路都真实存在' },
          { id: 'D', text: '既然两种解读都可能成立，这封信对案件毫无价值，应当转移调查方向', correct: false, reason: '把 ambiguous 误解为 inconclusive——双重含义恰恰是最高密度的情报信号，不是信息无效的标志' }
        ],
        correctFeedback: '正确。Ambiguous 的本质是「刻意设计的双重有效性」——两条路都完整自洽，说明写信人极其用心。这不是粗心的产物，而是精密设计的情报加密。Elena 将这个推论写入案件记录，合上本子。她现在需要弄清楚：这两条截然相反的路径，各自通向何处。',
        branchText: 'Elena 按照这个方向继续分析，但很快陷入了困境——如果父亲只是匆忙随意，那为什么两条解读路径都如此完整？随意写下的话，不会恰好产生两条各自自洽的逻辑链。<br><br>她重新看向那封信，意识到问题所在：ambiguous 和 vague 描述的根本不是同一种状态。Vague 是表达者自己不清楚，是信息不足；ambiguous 是读者无法确定——因为两条路都成立。父亲的信太「完整」了，这种完整，只能是精心设计的结果。Elena 合上记录本，重新校准前提。（主线汇流）'
      }
    }
  ]
};

// ── State ──────────────────────────────────────────────────────
const state = {
  screen: 'landing',
  onboardingStage: 0, // 0: Landing, 1: Demo, 2: Diagnosis, 3: Preferences, 4: Ready animation
  selectedDemo: null, // Selected onboarding demo object
  preferences: { genres: [], intensity: 'medium' },
  diagAnswers: [], // Selected diagnosis answers
  diagScore: 0,
  diagLevel: '高考水平：进阶 (B)',
  readingChapter: 1,
  activeTooltip: null,
  choiceState: 'pending', // pending | answered
  unlockedWords: new Set(),
  streakState: 'normal', // normal | missed1 | missed2
  hasCompletedChapter1: false,
  outputSelectedWord: null,  // null = not yet selected (blank slot)
  outputAttempts: 0,          // tracks retry count for corrective feedback
};

// ── Screen Router ─────────────────────────────────────────────
function showScreen(id) {
  // Close any active tooltips
  document.querySelectorAll('.word-tooltip').forEach(t => t.remove());
  state.activeTooltip = null;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    state.screen = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Particle System ───────────────────────────────────────────
function initParticles() {
  const container = document.querySelector('.particles');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${1 + Math.random() * 2}px;
      height: ${1 + Math.random() * 2}px;
      animation-delay: ${Math.random() * 20}s;
      animation-duration: ${15 + Math.random() * 20}s;
      opacity: ${0.1 + Math.random() * 0.3};
    `;
    container.appendChild(p);
  }
}

// ── Real Human Audio Pronunciation helper ───────────────────────
function speakWord(e, word, isUS = false) {
  if (e) {
    if (typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  }
  try {
    // NetEase Youdao Open CDN Voice API (type 1 = UK English, type 2 = US English)
    // Provides high-fidelity, real human native speaker audio assets
    const type = isUS ? 2 : 1;
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.warn("Audio play failed, falling back to Web Speech:", err);
      // Fallback to local TTS if network audio fails
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
}

// Bind to window to guarantee inline onclick elements can always find it
window.speakWord = speakWord;

// ── Output Signal Collector ───────────────────────────────────
let outputCountdownInterval = null;

function selectOutputWord(word) {
  state.outputSelectedWord = word;
  // Update the blank slot
  const slot = document.getElementById('output-word-slot');
  if (slot) {
    slot.textContent = word;
    slot.style.color = 'var(--accent-gold)';
    slot.style.borderBottomColor = 'var(--accent-gold)';
    slot.style.fontStyle = 'normal';
    slot.style.fontWeight = '700';
  }
  // Update button highlight states
  ['ambiguous', 'vague', 'unclear'].forEach(w => {
    const btn = document.getElementById('obtn-' + w);
    if (!btn) return;
    if (w === word) {
      btn.style.background = 'rgba(245,200,66,0.15)';
      btn.style.borderColor = 'var(--accent-gold)';
      btn.style.color = 'var(--accent-gold)';
      btn.style.fontWeight = '600';
    } else {
      btn.style.background = 'transparent';
      btn.style.borderColor = 'var(--border-subtle)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.fontWeight = '400';
    }
  });
  // Enable confirm button (was disabled until first selection)
  const confirmBtn = document.getElementById('output-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.background = 'rgba(245,200,66,0.12)';
    confirmBtn.style.borderColor = 'rgba(245,200,66,0.4)';
    confirmBtn.style.color = 'var(--accent-gold)';
    confirmBtn.textContent = '确认记录 →';
  }
}

function confirmOutputSignal() {
  const signalBox = document.getElementById('output-signal-box');
  if (!signalBox) return;
  const word = state.outputSelectedWord;
  if (!word) return; // button is disabled until a word is selected

  const isCorrect = word === 'ambiguous';
  state.outputAttempts++;

  if (isCorrect) {
    // ✅ Correct: celebrate and reveal finish button
    signalBox.innerHTML = `
      <div style="font-size:0.85rem;color:var(--accent-teal);padding:8px 0;display:flex;align-items:center;gap:8px;line-height:1.6">
        <span style="flex-shrink:0;font-size:1.1rem">✅</span>
        <span>Elena 满意地点头，在记录本上工整写下「<strong style="color:var(--accent-gold)">ambiguous</strong>」，画了一个圆圈。</span>
      </div>
    `;
    setTimeout(() => {
      const finishBtn = document.getElementById('finish-chapter-btn');
      if (finishBtn) {
        finishBtn.style.display = 'block';
        finishBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 600);

  } else if (state.outputAttempts < 2) {
    // 📖 First wrong attempt: targeted corrective hint + allow retry
    const hintEl = document.getElementById('output-hint');
    if (hintEl) {
      hintEl.style.display = 'block';
      const hintText = word === 'vague'
        ? `<strong style="color:var(--accent-coral)">注意区分</strong>：vague 描述的是表达者自身的不清晰——说话人没想好就开口了。但父亲的信太「精准」了，它不是说不清楚，而是两条路都完整自洽。这种精准，只有 <strong style="color:var(--accent-gold)">ambiguous</strong> 才能描述。`
        : `<strong style="color:var(--accent-coral)">提示</strong>：unclear 是最宽泛的「不明确」，但它没有指向「为什么不明确」。这封信不是因为信息不足而不明确，而是它同时包含了两条完整的解读路径。这种「两可性」，用 <strong style="color:var(--accent-gold)">ambiguous</strong> 才最准确。`;
      hintEl.innerHTML = `
        <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.6;padding:8px 12px;background:rgba(255,107,107,0.05);border-radius:8px;border-left:2px solid var(--accent-coral);margin-bottom:6px">
          📖 ${hintText}
        </div>
      `;
    }
    // Update confirm button for retry
    const confirmBtn = document.getElementById('output-confirm-btn');
    if (confirmBtn) confirmBtn.textContent = '再次确认 →';

  } else {
    // 📝 Second wrong attempt: show correct answer + mnemonic, then reveal finish button
    signalBox.innerHTML = `
      <div style="font-size:0.83rem;color:var(--text-secondary);padding:6px 0;line-height:1.6">
        <div style="margin-bottom:10px">📝 Elena 轻轻擦去「${word}」，重新写上 <strong style="color:var(--accent-gold)">ambiguous</strong>。</div>
        <div style="font-size:0.75rem;color:var(--text-muted);padding:9px 12px;background:rgba(245,200,66,0.04);border-radius:8px;border:1px solid rgba(245,200,66,0.15);line-height:1.6">
          💡 记忆锚：<strong style="color:var(--accent-gold)">ambiguous</strong> = 两条路都完整自洽（刻意设计）；<strong>vague</strong> = 说不清楚（信息不足）；<strong>unclear</strong> = 泛指的不明确
        </div>
      </div>
    `;
    setTimeout(() => {
      const finishBtn = document.getElementById('finish-chapter-btn');
      if (finishBtn) {
        finishBtn.style.display = 'block';
        finishBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 1000);
  }
}

function selectCrossContextAnswer(word, optIdx, isCorrect) {
  const data = VOCAB[word];
  if (!data || !data.crossContext) return;
  const totalOptions = data.crossContext.options.length;
  for (let i = 0; i < totalOptions; i++) {
    const el = document.getElementById('cc-' + word + '-' + i);
    if (!el) continue;
    el.style.pointerEvents = 'none';
    if (i === optIdx) {
      el.style.background = isCorrect ? 'rgba(45,212,191,0.1)' : 'rgba(255,107,107,0.08)';
      el.style.borderColor = isCorrect ? 'var(--accent-teal)' : 'var(--accent-coral)';
      el.style.color = isCorrect ? 'var(--accent-teal)' : 'var(--accent-coral)';
    }
    if (data.crossContext.options[i].correct && i !== optIdx) {
      el.style.borderColor = 'var(--accent-teal)';
      el.style.color = 'var(--accent-teal)';
    }
  }
  const resultEl = document.getElementById('cc-result-' + word);
  if (resultEl) {
    resultEl.style.display = 'block';
    const correctText = data.crossContext.options.find(o => o.correct).text;
    resultEl.innerHTML = isCorrect
      ? '✅ 语境迁移正确！你在全新语域中精准识别了这个词的核心语义。'
      : `📖 高考提示：无论语境如何变化，<strong style="color:var(--accent-gold)">${word}</strong> 的核心语义不变——「${correctText}」`;
  }
}

// ── Word Tooltip Logic ────────────────────────────────────────
function bindWordHighlights() {
  document.querySelectorAll('.word-highlight').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = el.dataset.word;
      const data = VOCAB[word];
      if (!data) return;

      // Close existing
      document.querySelectorAll('.word-tooltip').forEach(t => t.remove());
      if (state.activeTooltip === word) { state.activeTooltip = null; return; }

      const tooltip = document.createElement('div');
      tooltip.innerHTML = `
        <div class="wt-word">
          ${data.word}
          <span class="badge ${data.type === 'core' ? 'badge-gold' : 'badge-teal'}" style="font-size:0.6rem;padding:1px 4px">${data.type === 'core' ? '核心' : '语境'}</span>
          ${data.pos ? `<span style="font-size:0.65rem;color:var(--accent-blue);font-weight:600;margin-left:4px;font-family:monospace">${data.pos}</span>` : ''}
        </div>
        <div class="wt-phonetic" style="display:flex; flex-direction:column; gap:4px; margin-top:6px; font-size:0.75rem; color:var(--text-secondary)">
          <div class="uk-speak-btn" style="cursor:pointer; display:flex; align-items:center; gap:4px">
            <span style="color:var(--accent-gold); font-weight:bold">UK 🔊</span> ${data.ukPhonetic}
          </div>
          <div class="us-speak-btn" style="cursor:pointer; display:flex; align-items:center; gap:4px">
            <span style="color:var(--accent-blue); font-weight:bold">US 🔊</span> ${data.usPhonetic}
          </div>
        </div>
        <div class="wt-meaning" style="margin-top:8px">${data.meaning}</div>
        ${data.wordFamily ? `
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-subtle)">
            <div style="font-size:0.7rem;color:var(--text-secondary);font-weight:700;letter-spacing:0.08em;margin-bottom:6px">🌿 词族</div>
            ${data.wordFamily.map(f => `
              <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:3px">
                <span style="font-size:0.82rem;font-weight:700;color:var(--accent-gold)">${f.form}</span>
                <span style="font-size:0.6rem;color:var(--accent-blue);font-family:monospace">${f.pos}</span>
                <span style="font-size:0.75rem;color:var(--text-primary)">${f.meaning}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${data.nearSynonym ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle)">
            <div style="font-size:0.7rem;color:var(--text-secondary);font-weight:700;letter-spacing:0.08em;margin-bottom:4px">⚡ 近义辨析 vs ${data.nearSynonym.word}</div>
            <div style="font-size:0.75rem;color:var(--text-primary);line-height:1.5">${data.nearSynonym.distinction}</div>
          </div>
        ` : ''}
      `;
      
      // Stop clicks inside the tooltip from bubbling up and closing it
      tooltip.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });

      // Bind speech synthesis programmatically to avoid any inline handler execution failures
      tooltip.querySelector('.uk-speak-btn').addEventListener('click', (ev) => {
        speakWord(ev, data.word, false);
      });
      tooltip.querySelector('.us-speak-btn').addEventListener('click', (ev) => {
        speakWord(ev, data.word, true);
      });

      // Position tooltip absolute on document.body to prevent clipping by parent scrollbars / sticky headers
      const rect = el.getBoundingClientRect();
      const showBelow = rect.top < 280; // Not enough space above (header is ~60px + tooltip is ~200px)

      tooltip.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
      
      if (showBelow) {
        tooltip.style.top = `${rect.bottom + window.scrollY}px`;
        tooltip.className = 'word-tooltip position-below';
      } else {
        tooltip.style.top = `${rect.top + window.scrollY}px`;
        tooltip.className = 'word-tooltip position-above';
      }

      document.body.appendChild(tooltip);
      requestAnimationFrame(() => tooltip.classList.add('visible'));
      state.activeTooltip = word;
      
      // Track that word has been looked at (helps with analytics or diagnostics simulation)
      state.unlockedWords.add(word);
      updateDashboardStats();
    });
  });

  // Close tooltip on click outside, scroll, or resize
  const closeTooltip = () => {
    document.querySelectorAll('.word-tooltip').forEach(t => t.remove());
    state.activeTooltip = null;
  };

  document.addEventListener('click', closeTooltip);
  window.addEventListener('scroll', closeTooltip, { passive: true });
  window.addEventListener('resize', closeTooltip, { passive: true });
}

// ── Onboarding Controller ─────────────────────────────────────
function renderOnboarding() {
  const container = document.getElementById('onboarding-content');
  const fills = document.querySelectorAll('.ob-step');
  
  // Sync step indicators
  fills.forEach((f, i) => {
    f.classList.toggle('active', i === (state.onboardingStage - 1));
    f.classList.toggle('done', i < (state.onboardingStage - 1));
  });

  if (state.onboardingStage === 1) {
    // Stage 1: Demo Experience
    if (!state.selectedDemo) {
      // Randomly pick Demo A or B
      const idx = Math.floor(Math.random() * ONBOARDING_DEMOS.length);
      state.selectedDemo = ONBOARDING_DEMOS[idx];
    }
    renderDemoStage();
  } else if (state.onboardingStage === 2) {
    // Stage 2: Baseline Diagnosis
    renderDiagStage();
  } else if (state.onboardingStage === 3) {
    // Stage 3: Preference Selection
    renderPrefsStage();
  } else if (state.onboardingStage === 4) {
    // Stage 4: Loading Screen Animation
    renderReadyStage();
  }
}

// ── Onboarding Stage 1: Demo Story Reader ───────────────────────
function renderDemoStage() {
  const demo = state.selectedDemo;
  const container = document.getElementById('onboarding-content');
  const nextBtn = document.getElementById('ob-next-btn');

  // Disable global onboarding footer button, let reader internal events drive progress
  nextBtn.style.display = 'none';

  let storyHTML = '';
  demo.content.forEach(seg => {
    if (seg.type === 'text') storyHTML += seg.text;
    else if (seg.type === 'word') {
      storyHTML += `<span class="word-highlight" data-word="${seg.word}">${seg.text}</span>`;
    }
  });

  container.innerHTML = `
    <div>
      <div class="flex justify-between items-center mb-4">
        <span class="badge badge-purple">🕵️ ${demo.genre} · 体验Demo</span>
        <span style="font-size:0.75rem;color:var(--text-muted)">还有 5 种故事类型等你探索</span>
      </div>
      <h2>${demo.title}</h2>
      <div class="word-tip-hint mt-2 mb-4">
        <span>💡</span>
        <span>点击金色下划线单词，查看词义。体会词语如何与案情精密契合。</span>
      </div>
      <div class="story-text" style="font-size: 1.05rem; line-height: 1.85">
        ${storyHTML}
      </div>

      <!-- Choice panel -->
      <div id="demo-choice-box" style="border-top: 1px solid var(--border-subtle); margin-top: 32px; padding-top: 24px">
        <div class="flex items-center gap-2 mb-4">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(245,200,66,0.15);display:flex;align-items:center;justify-content:center;font-size:0.9rem">⚡</div>
          <span style="font-size:0.8rem;color:var(--text-muted);font-weight:700">抉择关卡</span>
        </div>
        <h3 class="mb-4" style="font-size: 1.05rem">${demo.choice.question}</h3>
        <div class="flex flex-col gap-3">
          ${demo.choice.options.map(opt => `
            <div class="choice-card" onclick="handleDemoChoice(this, ${opt.correct})">
              <div class="flex items-center gap-3">
                <div class="choice-letter">${opt.id}</div>
                <span style="font-size:0.92rem;color:var(--text-secondary)">${opt.text}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div id="demo-feedback" style="display:none; margin-top:20px"></div>
      </div>
    </div>
  `;

  bindWordHighlights();
}

function handleDemoChoice(el, isCorrect) {
  const demo = state.selectedDemo;
  const feedbackEl = document.getElementById('demo-feedback');
  
  // Disable all cards
  document.querySelectorAll('#demo-choice-box .choice-card').forEach(card => {
    card.style.pointerEvents = 'none';
  });

  el.classList.add(isCorrect ? 'correct' : 'wrong');

  if (isCorrect) {
    state.unlockedWords.add(demo.word);
    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div class="glass-card" style="padding:20px; border-color: rgba(45,212,191,0.25); background: rgba(45,212,191,0.02)">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:1.1rem">✅</span>
          <span style="font-weight:700;color:var(--accent-teal)">直觉正确</span>
        </div>
        <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">${demo.choice.correctFeedback}</p>
        <button class="btn btn-primary" onclick="advanceOnboarding()">建立我的词汇起点 →</button>
      </div>
    `;
  } else {
    // Trigger Branching Path (支线汇流模式)
    state.unlockedWords.add(demo.word);
    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div class="branch-story-container">
        <div class="branch-header">
          <span>⚡</span>
          <span>触发支线剧情 · 语境无感纠错</span>
        </div>
        <p style="color:var(--text-primary);margin-bottom:16px">${demo.choice.branchText}</p>
        <div class="glass-card" style="padding: 16px; border-color: var(--border-gold); background: rgba(245,200,66,0.02)">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">💡 核心词汇小结:</div>
          <div style="font-weight:800;color:var(--accent-gold);font-size:0.95rem">${demo.word}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">${VOCAB[demo.word].meaning}</div>
        </div>
        <button class="btn btn-primary mt-4" onclick="advanceOnboarding()">建立我的词汇起点 →</button>
      </div>
    `;
  }
  
  feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function advanceOnboarding() {
  state.onboardingStage++;
  renderOnboarding();
}

// ── Onboarding Stage 2: Baseline Diagnosis ─────────────────────
function renderDiagStage() {
  const container = document.getElementById('onboarding-content');
  const nextBtn = document.getElementById('ob-next-btn');

  // Diagnosis stage utilizes internal progression, hide main next button temporarily
  nextBtn.style.display = 'none';
  state.diagAnswers = new Array(STAGE2_DIAGNOSIS.questions.length).fill(null);

  container.innerHTML = `
    <div>
      <span class="badge badge-teal mb-4">📈 STAGE 2 · 能力诊断</span>
      <h2>${STAGE2_DIAGNOSIS.title}</h2>
      <p class="text-secondary mt-1 mb-4" style="font-size:0.85rem">${STAGE2_DIAGNOSIS.subtitle}</p>
      
      <!-- Diagnosis text box -->
      <div class="glass-card mb-6" style="padding:20px; font-family:var(--font-story); font-size:1rem; line-height:1.8; color:var(--text-primary)">
        ${STAGE2_DIAGNOSIS.text}
      </div>

      <!-- Questions List -->
      <div class="flex flex-col gap-6" id="diag-questions-list">
        ${STAGE2_DIAGNOSIS.questions.map((q, qidx) => `
          <div class="glass-card" style="padding:20px" id="diag-q-${qidx}">
            <h4 style="font-size:0.92rem;line-height:1.5;margin-bottom:12px;color:var(--text-primary)">${q.q}</h4>
            <div class="flex flex-col gap-2">
              ${q.options.map((opt, oidx) => `
                <div class="choice-card" style="padding: 10px 16px" onclick="selectDiagAnswer(${qidx}, ${oidx}, ${opt.correct})">
                  <div class="flex items-center gap-2">
                    <div class="choice-letter" style="width:22px;height:22px;font-size:0.75rem">${opt.text.split('.')[0]}</div>
                    <span style="font-size:0.88rem;color:var(--text-secondary)">${opt.text.split('.')[1]}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-end mt-6">
        <button class="btn btn-primary" id="diag-submit-btn" disabled onclick="submitDiagnosis()">提交诊断并分析 →</button>
      </div>
    </div>
  `;
}

function selectDiagAnswer(qidx, oidx, isCorrect) {
  // Save answer state
  state.diagAnswers[qidx] = { oidx, isCorrect };

  // Highlight selection
  const cards = document.querySelectorAll(`#diag-q-${qidx} .choice-card`);
  cards.forEach((c, idx) => {
    c.classList.toggle('selected', idx === oidx);
  });

  // Check if all answered
  const allAnswered = state.diagAnswers.every(ans => ans !== null);
  const btn = document.getElementById('diag-submit-btn');
  if (btn) btn.disabled = !allAnswered;
}

function submitDiagnosis() {
  let correctCount = 0;
  state.diagAnswers.forEach(ans => {
    if (ans.isCorrect) correctCount++;
  });

  state.diagScore = correctCount;
  
  // Decide level based on score
  if (correctCount === 4) {
    state.diagLevel = '高考水平：优秀 (A)';
  } else if (correctCount >= 2) {
    state.diagLevel = '高考水平：进阶 (B)';
  } else {
    state.diagLevel = '高考水平：基础 (C)';
  }

  // Display result screen in onboarding Stage 2
  const container = document.getElementById('onboarding-content');
  container.innerHTML = `
    <div style="text-align:center; padding: 20px 0">
      <div style="font-size:4rem; margin-bottom:16px">📊</div>
      <h2>诊断完成！初始档案建立</h2>
      <p class="text-secondary mt-1 mb-6">我们已经精准算出了你的英语语境阅读水平</p>
      
      <div class="glass-card w-full mb-6" style="padding:24px; max-width: 460px; margin: 0 auto">
        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:700">词汇诊断结果</div>
        <div class="stat-num mt-2 mb-2" style="font-size:2.2rem; color:var(--accent-teal)">${state.diagLevel}</div>
        <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">
          语境迁移正确率：<strong>${state.diagScore * 25}%</strong>。孩子在阅读中能通过模糊字面还原其内在的语意。接下来，我们将按此基准配置你的故事难度。
        </p>
      </div>

      <button class="btn btn-primary" onclick="advanceOnboarding()">确认我的起点 →</button>
    </div>
  `;
}

// ── Onboarding Stage 3: Preferences ────────────────────────────
const ONBOARDING_GENRES = [
  { id: 'mystery', label: '🔍 悬疑推理', desc: '扑朔迷离的探案故事' },
  { id: 'scifi',   label: '🚀 科幻冒险', desc: '星际深空的未来构想' },
  { id: 'campus',  label: '🌸 校园青春', desc: '温情真实的拼搏岁月' },
  { id: 'history', label: '⚔️ 历史架空', desc: '历史疑云的沙盘推演' }
];

function renderPrefsStage() {
  const container = document.getElementById('onboarding-content');
  const nextBtn = document.getElementById('ob-next-btn');

  nextBtn.style.display = 'inline-flex';
  nextBtn.textContent = '开始生成故事 →';
  nextBtn.onclick = () => advanceOnboarding();

  container.innerHTML = `
    <div>
      <span class="badge badge-purple mb-4">⚙️ STAGE 3 · 偏好设置</span>
      <h2>定制你的故事世界</h2>
      <p class="text-secondary mt-1">我们将今天要学的单词，融入你最喜爱的情景里。</p>

      <div class="section-label mt-6">1. 喜欢的故事题材 (可多选)</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
        ${ONBOARDING_GENRES.map(g => `
          <div class="toggle-chip ${state.preferences.genres.includes(g.id) ? 'selected' : ''}"
               style="border-radius:var(--radius-md); padding:14px; flex-direction:column; align-items:flex-start; text-align:left; width:100%"
               onclick="toggleGenre('${g.id}', this)">
            <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">${g.label}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${g.desc}</span>
          </div>
        `).join('')}
      </div>

      <div class="section-label mt-6">2. 设定挑战强度</div>
      <div class="intensity-container">
        <div class="intensity-card ${state.preferences.intensity === 'light' ? 'selected' : ''}" onclick="selectIntensity('light')">
          <div class="intensity-icon">🌙</div>
          <div class="intensity-title">睡前放松</div>
          <div class="intensity-desc">每次 5 分钟，3个词</div>
        </div>
        <div class="intensity-card ${state.preferences.intensity === 'medium' ? 'selected' : ''}" onclick="selectIntensity('medium')">
          <div class="intensity-icon">📚</div>
          <div class="intensity-title">每日学习</div>
          <div class="intensity-desc">每次 15 分钟，5个词</div>
        </div>
        <div class="intensity-card ${state.preferences.intensity === 'deep' ? 'selected' : ''}" onclick="selectIntensity('deep')">
          <div class="intensity-icon">🔥</div>
          <div class="intensity-title">全力备考</div>
          <div class="intensity-desc">每次 25 分钟，8个词</div>
        </div>
      </div>
    </div>
  `;
}

function toggleGenre(id, el) {
  const idx = state.preferences.genres.indexOf(id);
  if (idx > -1) {
    state.preferences.genres.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    state.preferences.genres.push(id);
    el.classList.add('selected');
  }
}

function selectIntensity(level) {
  state.preferences.intensity = level;
  document.querySelectorAll('.intensity-card').forEach((card, idx) => {
    const types = ['light', 'medium', 'deep'];
    card.classList.toggle('selected', types[idx] === level);
  });
}

// ── Onboarding Stage 4: Loading Screen ─────────────────────────
function renderReadyStage() {
  const container = document.getElementById('onboarding-content');
  const nextBtn = document.getElementById('ob-next-btn');

  nextBtn.style.display = 'none';

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center gap-6 mt-8" style="text-align:center">
      <div style="position:relative; width: 100px; height: 100px">
        <div class="ready-ring"></div>
        <div style="font-size:3rem;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1">🧬</div>
      </div>
      <h3 style="font-size:1.3rem; margin-top:20px">正在织造你专属的故事世界...</h3>
      <p class="text-secondary" style="font-size:0.85rem;max-width:320px">
        正在将高考词汇高密度融入「${state.preferences.genres.length > 0 ? '悬疑推理等' : '悬疑推理'}」题材的线索链中...
      </p>
      
      <div class="progress-bar w-full" style="height:4px; max-width:280px; margin-top:10px">
        <div class="progress-fill" id="story-generator-progress" style="width:0%"></div>
      </div>
    </div>
  `;

  // Animate progress bar then redirect to dashboard
  const progressFill = document.getElementById('story-generator-progress');
  let pct = 0;
  const interval = setInterval(() => {
    pct += 5;
    if (progressFill) progressFill.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        showScreen('home');
        renderHome();
        showToast('🎉 故事世界生成完毕！进入首页');
      }, 500);
    }
  }, 100);
}

// ── Dashboard Controller ──────────────────────────────────────
function renderHome() {
  updateDashboardStats();
  
  // Render Narrative Streak Card dynamically based on simulation states
  const streakCard = document.getElementById('dashboard-streak-card');
  
  let headline = '';
  let subtext = '';
  let quote = '';
  let streakDays = 3;

  if (state.streakState === 'normal') {
    headline = 'Elena Voss 正在等你';
    streakDays = state.hasCompletedChapter1 ? 4 : 3;
    subtext = `你已连续探索故事世界 ${streakDays} 天。今天的新线索刚刚显现。`;
    quote = '❝ 上次你帮她推断出了停滞的手表，但幕后之人已经遁入黑暗…… ❞';
  } else if (state.streakState === 'missed1') {
    headline = '🌙 故事暂停了一天';
    streakDays = 3;
    subtext = 'Elena Voss 在昨晚等了很久，但好在案件还在，线索还在。现在继续还不算晚。';
    quote = '❝ 列车正穿过山洞，黑暗中那双手正在摸索什么…… ❞';
  } else if (state.streakState === 'missed2') {
    headline = '📖 你离开故事世界 2 天了';
    streakDays = 0;
    subtext = '没关系。好的侦探随时可以归队，Elena 把那封信保存好了，等你回来重新连击！';
    quote = '❝ 深夜的列车依旧轰鸣，那一缕微光正慢慢熄灭…… ❞';
  }

  streakCard.innerHTML = `
    <div class="streak-header">
      <div class="streak-flame">${state.streakState === 'normal' ? '🔥' : '⏳'}</div>
      <div>
        <div class="streak-headline">${headline}</div>
        <div class="streak-text">${subtext}</div>
      </div>
      <div style="margin-left:auto">
        <span class="badge badge-gold" style="font-weight:700">${state.streakState === 'normal' ? '当前' : '折损'} Streak: ${streakDays}天</span>
      </div>
    </div>
    <div class="streak-quote">${quote}</div>
    
    <!-- Simulation tools in P1 to allow users to interact with PRD requirements -->
    <div class="streak-simulation-bar">
      <span>🛠️ 模拟留存机制:</span>
      <button class="streak-sim-btn ${state.streakState === 'normal' ? 'active' : ''}" onclick="simulateStreak('normal')">正常连击</button>
      <button class="streak-sim-btn ${state.streakState === 'missed1' ? 'active' : ''}" onclick="simulateStreak('missed1')">缺席1天 (暂停)</button>
      <button class="streak-sim-btn ${state.streakState === 'missed2' ? 'active' : ''}" onclick="simulateStreak('missed2')">缺席2天 (清零)</button>
    </div>
  `;
}

function simulateStreak(val) {
  state.streakState = val;
  renderHome();
  showToast(`已切换为留存机制：${val === 'normal' ? '正常连击' : val === 'missed1' ? '缺席1天暂停' : '缺席2天归零'}`);
}

function updateDashboardStats() {
  const profileVocab = document.getElementById('profile-vocab-count');
  const profileStreak = document.getElementById('profile-streak-count');
  const profileDiag = document.getElementById('profile-diag-level');
  const profileAcc = document.getElementById('profile-accuracy');

  // Update profile labels
  if (profileVocab) profileVocab.textContent = `${state.unlockedWords.size} / 5 个`;
  
  let streakDays = 3;
  if (state.streakState === 'normal') {
    streakDays = state.hasCompletedChapter1 ? 4 : 3;
  } else if (state.streakState === 'missed2') {
    streakDays = 0;
  }
  if (profileStreak) profileStreak.textContent = `${streakDays} 天`;
  if (profileDiag) profileDiag.textContent = state.diagLevel;
  
  if (profileAcc) {
    profileAcc.textContent = state.hasCompletedChapter1 
      ? (state.choiceState === 'correct' ? '100%' : '50%') 
      : '--';
  }

  // Sync Vocab count in badge
  const vocabBadge = document.getElementById('vocab-book-count');
  if (vocabBadge) vocabBadge.textContent = `${state.unlockedWords.size} 个词汇`;
}

// ── Story Reader (Chapter 1) ──────────────────────────────────
function renderStoryReader(chapterIdx = 0) {
  const chapter = MAIN_STORY.chapters[chapterIdx];
  const contentEl = document.getElementById('story-content');
  const titleEl   = document.getElementById('story-chapter-title');
  const metaEl    = document.getElementById('story-meta');
  const choiceEl  = document.getElementById('choice-section');
  const progressEl = document.getElementById('story-progress');

  titleEl.textContent = `第一章 · ${chapter.title}`;
  metaEl.innerHTML = `
    <span class="badge badge-purple">${MAIN_STORY.genre}</span>
    <span class="badge badge-gold">⏱ ${chapter.readTime} 分钟</span>
    <span class="badge badge-teal">📖 ${chapter.wordCount} 个高考词汇</span>
  `;

  // Build story content (Double track highlights)
  let html = '<div class="story-text">';
  chapter.content.forEach(segment => {
    if (segment.type === 'text') {
      html += segment.text;
    } else if (segment.type === 'word') {
      // Both core and context highlights
      const isCore = VOCAB[segment.word].type === 'core';
      html += `<span class="word-highlight" data-word="${segment.word}">${segment.text}</span>`;
    }
  });
  html += '</div>';
  contentEl.innerHTML = html;

  // Build choice section at 70% of the read
  const c = chapter.choice;
  choiceEl.innerHTML = `
    <div style="border-top:1px solid var(--border-subtle);margin:40px 0 32px;padding-top:32px">
      <div class="flex items-center gap-3 mb-2">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(245,200,66,0.15);border:1.5px solid rgba(245,200,66,0.3);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">⚡</div>
        <div>
          <div style="font-size:0.78rem;color:var(--text-muted);font-weight:600;letter-spacing:0.08em;text-transform:uppercase">视角冲突 · 近义辨析 — ambiguous vs vague</div>
          <div style="font-size:0.88rem;color:var(--text-secondary);margin-top:2px">${c.context}</div>
        </div>
      </div>
      <h3 class="mt-4 mb-4" style="font-size:1.05rem;line-height:1.5">${c.question}</h3>
      <div class="flex flex-col gap-3" id="reader-choices-list">
        ${c.options.map(opt => `
          <div class="choice-card" onclick="handleReaderChoice(this, ${opt.correct})">
            <div class="flex items-center gap-3">
              <div class="choice-letter">${opt.id}</div>
              <span style="font-size:0.95rem;color:var(--text-secondary)">${opt.text}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div id="reader-feedback" style="display:none;margin-top:20px"></div>
    </div>
  `;

  // Set progress
  progressEl.style.width = '70%'; // Placed at 70% read mark

  bindWordHighlights();
  state.choiceState = 'pending';
}

function handleReaderChoice(el, isCorrect) {
  if (state.choiceState !== 'pending') return;

  const chapter = MAIN_STORY.chapters[0];
  const c = chapter.choice;
  const feedbackEl = document.getElementById('reader-feedback');
  const progressEl = document.getElementById('story-progress');

  // Disable all choices
  document.querySelectorAll('#reader-choices-list .choice-card').forEach(card => {
    card.style.pointerEvents = 'none';
  });

  el.classList.add(isCorrect ? 'correct' : 'wrong');

  // Add all words of the story to Vocab Book
  MAIN_STORY.chapters[0].content.forEach(seg => {
    if (seg.type === 'word') state.unlockedWords.add(seg.word);
  });

  state.hasCompletedChapter1 = true;

  if (isCorrect) {
    state.choiceState = 'correct';
    state.outputSelectedWord = 'ambiguous';
    progressEl.style.width = '100%';
    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div class="glass-card" style="padding:20px; border-color: rgba(45,212,191,0.25); background: rgba(45,212,191,0.02)">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:1.2rem">✅</span>
          <span style="font-weight:700;color:var(--accent-teal)">推理正确！林亦的判断更准确</span>
        </div>
        <p style="font-size:0.92rem;color:var(--text-secondary);line-height:1.7;margin-bottom:16px">${c.correctFeedback}</p>

        <!-- Output Signal Collector: blank slot, mandatory selection, no auto-confirm -->
        <div id="output-signal-box" style="border-top:1px solid var(--border-subtle);padding-top:14px;margin-bottom:16px">
          <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;letter-spacing:0.08em;margin-bottom:8px">✏️ 帮 ELENA 完成推理记录</div>
          <div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.7;margin-bottom:10px;font-style:italic">
            Elena 在记录本上写道：「这封信的措辞是
            <span id="output-word-slot" style="color:var(--text-muted);font-style:italic;border-bottom:1px dashed var(--border-subtle);padding:0 6px;min-width:72px;display:inline-block;text-align:center">___</span>
            的，而非单纯的含糊——它指向了两个截然相反的可能。」
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
            <button id="obtn-ambiguous" onclick="selectOutputWord('ambiguous')"
              style="padding:4px 14px;border-radius:20px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font-size:0.78rem;cursor:pointer;transition:all 0.2s">
              ambiguous
            </button>
            <button id="obtn-vague" onclick="selectOutputWord('vague')"
              style="padding:4px 14px;border-radius:20px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font-size:0.78rem;cursor:pointer;transition:all 0.2s">
              vague
            </button>
            <button id="obtn-unclear" onclick="selectOutputWord('unclear')"
              style="padding:4px 14px;border-radius:20px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font-size:0.78rem;cursor:pointer;transition:all 0.2s">
              unclear
            </button>
          </div>
          <div id="output-hint" style="display:none;margin-bottom:8px"></div>
          <div>
            <button id="output-confirm-btn" onclick="confirmOutputSignal()" disabled
              style="padding:5px 16px;border-radius:20px;background:rgba(100,100,100,0.08);color:var(--text-muted);font-size:0.78rem;font-weight:700;border:1px solid var(--border-subtle);cursor:not-allowed;opacity:0.45;transition:all 0.25s">
              先选择一个词 →
            </button>
          </div>
        </div>

        <button class="btn btn-primary" id="finish-chapter-btn" style="display:none" onclick="finishChapter(true)">
          完成第一章，回到首页 →
        </button>
      </div>
    `;
  } else {
    // Trigger Branching Path (支线汇流模式)
    state.choiceState = 'wrong-branch';
    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div class="branch-story-container">
        <div class="branch-header">
          <span>⚡</span>
          <span>触发支线故事 · 语境理解深度纠偏</span>
        </div>
        <p style="color:var(--text-primary);margin-bottom:16px">${c.branchText}</p>
        
        <div class="glass-card mb-4" style="padding:16px; border-color:var(--accent-coral); background:rgba(255,107,107,0.02)">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">💡 核心词汇 ambiguous (模糊的) 强化纠偏:</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6">
            因为信件是 ambiguous 的，所以在查明真相前不应盲目行动。支线故事的挫败印证了这一点。
          </div>
        </div>

        <button class="btn btn-primary" onclick="finishChapter(false)">
          理解并回到主线，完成第一章 →
        </button>
      </div>
    `;
  }

  feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishChapter(wasCorrect) {
  if (outputCountdownInterval) {
    clearInterval(outputCountdownInterval);
    outputCountdownInterval = null;
  }
  showToast(wasCorrect ? '🎉 恭喜你答对并完成了第一章！' : '📖 已理清支线后果并完成第一章！');
  const progressEl = document.getElementById('story-progress');
  if (progressEl) progressEl.style.width = '100%';
  setTimeout(() => {
    showScreen('home');
    renderHome();
  }, 1000);
}

// ── Vocab Book Controller ──────────────────────────────────────
function renderVocabBook() {
  const list = document.getElementById('vocab-list');
  
  if (state.unlockedWords.size === 0) {
    list.innerHTML = `
      <div class="glass-card text-center" style="padding:40px 24px">
        <div style="font-size:3rem;margin-bottom:12px">📭</div>
        <h3 class="mb-2">你的词汇世界空空如也</h3>
        <p class="text-secondary" style="font-size:0.88rem">在 Onboarding 体验中阅读故事，或开始第一章，唤醒的词汇就会进入这里。</p>
        <button class="btn btn-primary mt-4 btn-sm" onclick="showScreen('home')">去读故事 →</button>
      </div>
    `;
    return;
  }

  list.innerHTML = Array.from(state.unlockedWords).map(word => {
    const data = VOCAB[word];
    if (!data) return '';
    return `
      <div class="vocab-scene-card">
        <div class="vocab-card-header">
          <div style="width: 100%">
            <div class="flex items-center justify-between" style="width: 100%">
              <div class="flex items-center">
                <span class="vocab-word-title">${data.word}</span>
                <span class="badge ${data.type === 'core' ? 'badge-gold' : 'badge-teal'}" style="margin-left:10px; font-size:0.6rem; padding:1px 6px">
                  ${data.type === 'core' ? '核心词汇' : '语境复现词'}
                </span>
              </div>
              ${data.pos ? `<span style="font-size:0.72rem;color:var(--accent-blue);font-weight:600;font-family:monospace;opacity:0.8">${data.pos}</span>` : ''}
            </div>
            <div class="flex flex-col gap-2 mt-2 mb-2" style="font-size:0.78rem; color:var(--text-muted)">
              <div style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; width:fit-content" onclick="speakWord(event, '${data.word}', false)">
                <span style="color:var(--accent-gold); font-weight:bold">UK 🔊</span> ${data.ukPhonetic}
              </div>
              <div style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; width:fit-content" onclick="speakWord(event, '${data.word}', true)">
                <span style="color:var(--accent-blue); font-weight:bold">US 🔊</span> ${data.usPhonetic}
              </div>
            </div>
            <div class="vocab-word-meaning" style="font-weight:600; margin-top:6px">${data.meaning}</div>
          </div>
        </div>

        ${data.wordFamily ? `
          <div style="margin-top:12px;padding:10px 14px;background:rgba(245,200,66,0.04);border-radius:8px;border:1px solid rgba(245,200,66,0.15)">
            <div style="font-size:0.62rem;color:var(--text-muted);font-weight:700;letter-spacing:0.08em;margin-bottom:7px">🌿 词族 WORD FAMILY</div>
            ${data.wordFamily.map(f => `
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:5px">
                <span style="font-size:0.88rem;font-weight:700;color:var(--accent-gold)">${f.form}</span>
                <span style="font-size:0.62rem;color:var(--accent-blue);font-family:monospace">${f.pos}</span>
                <span style="font-size:0.75rem;color:var(--text-muted)">${f.meaning}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${data.nearSynonym ? `
          <div style="margin-top:10px;padding:10px 14px;background:rgba(99,102,241,0.04);border-radius:8px;border:1px solid rgba(99,102,241,0.2)">
            <div style="font-size:0.62rem;color:var(--text-muted);font-weight:700;letter-spacing:0.08em;margin-bottom:6px">⚡ 近义辨析 vs ${data.nearSynonym.word}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;margin-bottom:5px">${data.nearSynonym.distinction}</div>
            <div style="font-size:0.74rem;color:var(--accent-gold);line-height:1.5">💡 ${data.nearSynonym.tip}</div>
          </div>
        ` : ''}

        <div class="vocab-quote-box" style="margin-top:12px">
          ${data.example}
        </div>
        <div class="vocab-scene-tag">
          <span>📍</span>
          <span>${data.scene}</span>
        </div>

        ${data.crossContext ? `
          <div style="margin-top:14px;padding:14px;background:rgba(30,215,255,0.03);border-radius:10px;border:1px solid rgba(30,215,255,0.12)">
            <div style="font-size:0.62rem;color:var(--text-muted);font-weight:700;letter-spacing:0.08em;margin-bottom:9px">📊 跨语境迁移测试 · 高考仿真语境</div>
            <div style="font-size:0.85rem;color:var(--text-primary);line-height:1.75;font-style:italic;margin-bottom:6px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:2px solid var(--accent-gold)">
              &ldquo;${data.crossContext.sentence}&rdquo;
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px;line-height:1.5">${data.crossContext.translation}</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;font-weight:600">${data.crossContext.question}</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${data.crossContext.options.map((opt, idx) => `
                <div id="cc-${word}-${idx}"
                  onclick="selectCrossContextAnswer('${word}', ${idx}, ${opt.correct})"
                  style="padding:9px 13px;border-radius:8px;border:1px solid var(--border-subtle);cursor:pointer;font-size:0.8rem;color:var(--text-secondary);transition:all 0.2s;line-height:1.4">
                  ${'ABCD'[idx]}. ${opt.text}
                </div>
              `).join('')}
            </div>
            <div id="cc-result-${word}" style="display:none;margin-top:10px;font-size:0.78rem;color:var(--text-secondary);line-height:1.6;padding:6px 0"></div>
          </div>
        ` : ''}

      </div>
    `;
  }).join('');
}

// ── Parent Report Controller (v0.3) ────────────────────────────
function renderParentReport() {
  // Update simulated stats based on active progress
  const statWords = document.getElementById('parent-stat-words');
  const statAccuracy = document.getElementById('parent-stat-accuracy');
  const statImprovement = document.getElementById('parent-stat-improvement');
  const statProgress = document.getElementById('parent-stat-progress');
  const statChoiceAcc = document.getElementById('parent-stat-choice-acc');

  // Baseline diagnosis determines starting point
  let diagImprovePct = 12; // default simulated improvement
  if (state.hasCompletedChapter1) {
    diagImprovePct += 12; // added value when Chapter 1 completes
  }

  let wordsCount = state.unlockedWords.size;
  // If user completed diagnostic only, they might have 1, if chapter 1, they have 5. Let's make it look like a rolling report with mock baseline!
  let simulatedTotalWords = 28 + wordsCount;
  let simulatedAccuracy = 78;
  if (state.hasCompletedChapter1) {
    simulatedAccuracy = state.choiceState === 'correct' ? 84 : 80;
  }

  if (statWords) statWords.textContent = `${simulatedTotalWords} 个`;
  if (statAccuracy) statAccuracy.textContent = `${simulatedAccuracy}%`;
  if (statImprovement) statImprovement.textContent = `+${diagImprovePct}%`;
  
  if (statProgress) {
    const pct = ((simulatedTotalWords / 3500) * 100).toFixed(2);
    statProgress.textContent = `${simulatedTotalWords} / 3500 词 (${pct}%)`;
  }

  if (statChoiceAcc) {
    statChoiceAcc.textContent = `${simulatedAccuracy}% (高于同省 88% 学生)`;
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Global error handler to catch and display any unexpected JS errors directly in the app toast
  window.addEventListener('error', function(e) {
    showToast("⚠️ JS Error: " + e.message + " (" + e.filename.split('/').pop() + ":" + e.lineno + ")", 5000);
  });

  initParticles();
  
  // Set up router navigations
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.nav;
      if (target === 'vocab-screen') {
        renderVocabBook();
      } else if (target === 'reader') {
        renderStoryReader(0);
      } else if (target === 'parent-screen') {
        renderParentReport();
      } else if (target === 'home') {
        renderHome();
      }
      showScreen(target);
    });
  });

  showScreen('landing');

  // Landing button clicks
  document.getElementById('start-btn').addEventListener('click', () => {
    state.onboardingStage = 1;
    showScreen('onboarding');
    renderOnboarding();
  });

  // Home Main chapter card click
  document.getElementById('main-story-btn')?.addEventListener('click', () => {
    renderStoryReader(0);
    showScreen('reader');
  });
});
