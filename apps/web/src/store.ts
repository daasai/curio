import { create } from 'zustand';

export function createClientId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const RETRY_QUEUE_KEY = 'curio.learning-retry-queue.v1';
const RETRY_QUEUE_LIMIT = 50;

export interface RetryEvent {
  eventId: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

function loadRetryQueue(): RetryEvent[] {
  try {
    const stored = window.localStorage.getItem(RETRY_QUEUE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is RetryEvent => (
      Boolean(item) && typeof item === 'object' && typeof (item as RetryEvent).eventId === 'string'
      && typeof (item as RetryEvent).sessionId === 'string' && typeof (item as RetryEvent).type === 'string'
      && typeof (item as RetryEvent).occurredAt === 'string'
    )).slice(-RETRY_QUEUE_LIMIT) : [];
  } catch {
    return [];
  }
}

function persistRetryQueue(queue: RetryEvent[]): void {
  try {
    window.localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // A quota failure must not prevent the in-memory retry attempt.
  }
}

export interface VocabItem {
  word: string;
  pos: string;
  ukPhonetic: string;
  usPhonetic: string;
  meaning: string;
  example: string;
  scene: string;
  type: 'core' | 'context';
  wordFamily?: Array<{ form: string; pos: string; meaning: string }>;
  nearSynonym?: { word: string; distinction: string; tip: string } | null;
  crossContext?: {
    sentence: string;
    translation: string;
    question: string;
    options: Array<{ text: string; correct: boolean }>;
  } | null;
}

export const VOCAB_MOCK: Record<string, VocabItem> = {
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
      { form: 'unconcleaed', pos: 'adj.', meaning: '未隐藏的；公开表露的' }
    ],
    nearSynonym: null,
    crossContext: null
  },
  resilient: {
    word: 'resilient',
    pos: 'adj.',
    ukPhonetic: '/rɪˈzɪl.i.ənt/',
    usPhonetic: '/rɪˈzɪl.jənt/',
    meaning: '有韧性的；能快速恢复的；适应力强的',
    example: '在过去三年的无数个失望夜晚，她正是凭借着 resilient 的性格撑了过来。',
    scene: '第一章 · 深夜快车',
    type: 'core',
    wordFamily: [
      { form: 'resilience',  pos: 'n.',   meaning: '韧性；恢复力；弹性' },
      { form: 'resiliently', pos: 'adv.', meaning: '坚韧地；有弹性地' }
    ],
    nearSynonym: {
      word: 'tough',
      distinction: 'resilient 强调遭受打击后能迅速弹回恢复原状的韧性；tough 强调经得起折磨、坚硬不屈服的硬度',
      tip: '完形口诀：resilient = 弹回/恢复力强；tough = 坚硬/能吃苦'
    },
    crossContext: null
  },
  persevere: {
    word: 'persevere',
    pos: 'v.',
    ukPhonetic: '/ˌpɜː.sɪˈvɪə/',
    usPhonetic: '/ˌpɝː.səˈvɪr/',
    meaning: '坚持不懈；锲而不舍',
    example: '林亦发誓要 persevere 到生命的最后一刻，绝不退缩。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'perseverance', pos: 'n.',   meaning: '坚持不懈；毅力；锲而不舍' },
      { form: 'persevering',  pos: 'adj.', meaning: '坚持不懈的；锲而不舍的' }
    ],
    nearSynonym: {
      word: 'persist',
      distinction: 'persevere 褒义词，指克服重重艰难险阻顽强坚持；persist 中性词，也可指固执己见或恶劣天气持续存在',
      tip: '完形口诀：persevere = 克服困难毅力坚持；persist = 持续/固执'
    },
    crossContext: null
  },
  conceal: {
    word: 'conceal',
    pos: 'v.',
    ukPhonetic: '/kənˈsiːl/',
    usPhonetic: '/kənˈsiːl/',
    meaning: '隐藏；隐瞒；掩盖（刻意为之）',
    example: '列车长把黑布包裹隐蔽地 conceal 在报纸下方。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'concealment', pos: 'n.',   meaning: '隐藏；掩盖；隐匿状态' },
      { form: 'unconcealed', pos: 'adj.', meaning: '未隐藏的；公开表露的' }
    ],
    nearSynonym: {
      word: 'hide',
      distinction: 'conceal 正式书面语，强调精心掩饰真相或意图；hide 口语通用词，指物理上的藏匿或躲藏',
      tip: '完形口诀：conceal = 掩盖真相/隐瞒；hide = 普通隐藏/藏身'
    },
    crossContext: null
  },
  logic: {
    word: 'logic',
    pos: 'n.',
    ukPhonetic: '/ˈlɒdʒ.ɪk/',
    usPhonetic: '/ˈlɑː.dʒɪk/',
    meaning: '逻辑；条理；推理方法',
    example: '她试图运用严密的 logic 从这重重暗藏的线索中寻出真相。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'logical', pos: 'adj.', meaning: '符合逻辑的；合理的' },
      { form: 'logically', pos: 'adv.', meaning: '逻辑上；合乎逻辑地' },
      { form: 'illogical', pos: 'adj.', meaning: '不合逻辑的；荒谬的' }
    ],
    nearSynonym: {
      word: 'reasoning',
      distinction: 'logic 指思维与推理的抽象规律与条理系统；reasoning 指具体的思考、推论与论证过程',
      tip: '完形口诀：logic = 逻辑/规律；reasoning = 推理过程'
    },
    crossContext: null
  },
  shadow: {
    word: 'shadow',
    pos: 'n./v.',
    ukPhonetic: '/ˈʃæd.əʊ/',
    usPhonetic: '/ˈʃæd.oʊ/',
    meaning: '影子；阴影；暗中跟踪',
    example: '从这重重暗藏的 shadow 中寻出可疑的线索。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'shadowy', pos: 'adj.', meaning: '阴暗的；模糊的；神秘的' },
      { form: 'overshadow', pos: 'v.', meaning: '使阴暗；使显得微不足道' }
    ],
    nearSynonym: {
      word: 'shade',
      distinction: 'shadow 指具体不透明物体遮挡光线形成的轮廓黑影；shade 指日光被遮挡后的整体阴凉处',
      tip: '完形口诀：shadow = 影子/轮廓；shade = 树荫/阴凉处'
    },
    crossContext: null
  },
  evidence: {
    word: 'evidence',
    pos: 'n./v.',
    ukPhonetic: '/ˈev.ɪ.dəns/',
    usPhonetic: '/ˈev.ə.dəns/',
    meaning: '证据；证明；迹象',
    example: '林亦仔细收集着可能证明列车长谎言的客观 evidence。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'evident', pos: 'adj.', meaning: '明显的；明白的' },
      { form: 'evidently', pos: 'adv.', meaning: '显而易见地；显然' }
    ],
    nearSynonym: {
      word: 'proof',
      distinction: 'evidence 指用来推导结论的线索材料（未必是最终决定性的）；proof 指无可置疑的终极证明',
      tip: '完形口诀：evidence = 证据线索；proof = 铁证/确凿证明'
    },
    crossContext: null
  },
  contradict: {
    word: 'contradict',
    pos: 'v.',
    ukPhonetic: '/ˌkɒn.trəˈdɪkt/',
    usPhonetic: '/ˌkɑːn.trəˈdɪkt/',
    meaning: '反驳；与…矛盾；相抵触',
    example: '车长看似镇定的表象与他慌张的脚步构成了明显的 contradict。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'contradiction', pos: 'n.', meaning: '矛盾；否认；反驳' },
      { form: 'contradictory', pos: 'adj.', meaning: '矛盾的；对立的' }
    ],
    nearSynonym: {
      word: 'deny',
      distinction: 'contradict 指事实或陈述互相抵触/反驳；deny 指口头坚决否认某种指控',
      tip: '完形口诀：contradict = 事物互相矛盾；deny = 口头矢口否认'
    },
    crossContext: null
  },
  secret: {
    word: 'secret',
    pos: 'n./adj.',
    ukPhonetic: '/ˈsiː.krət/',
    usPhonetic: '/ˈsiː.krət/',
    meaning: '秘密；机密；绝密的',
    example: '这说明列车上藏着不可告人的 secret。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'secrecy', pos: 'n.', meaning: '保密；保密状态' },
      { form: 'secretive', pos: 'adj.', meaning: '守口如瓶的；神秘兮兮的' },
      { form: 'secretly', pos: 'adv.', meaning: '秘密地；暗中' }
    ],
    nearSynonym: {
      word: 'confidential',
      distinction: 'secret 泛指不想让人知道的事；confidential 特指公文或商务层面受法律或规定保护的绝密信息',
      tip: '完形口诀：secret = 普通秘密；confidential = 绝密文件/机密'
    },
    crossContext: null
  },
  document: {
    word: 'document',
    pos: 'n./v.',
    ukPhonetic: '/ˈdɒk.jə.mənt/',
    usPhonetic: '/ˈdɑː.kjə.mənt/',
    meaning: '公文；文件；记录',
    example: '她迅速掏出随身携带的加密 document。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'documentation', pos: 'n.', meaning: '文件汇总；证明文件' },
      { form: 'documentary', pos: 'n./adj.', meaning: '纪录片；记载的' }
    ],
    nearSynonym: {
      word: 'paper',
      distinction: 'document 指正式有法律或行政效力的文件；paper 指普通的纸张或文章',
      tip: '完形口诀：document = 正式公文/档案；paper = 普通纸张'
    },
    crossContext: null
  },
  reveal: {
    word: 'reveal',
    pos: 'v.',
    ukPhonetic: '/rɪˈviːl/',
    usPhonetic: '/rɪˈviːl/',
    meaning: '揭露；显示；透漏',
    example: '希望能从中 reveal 出真相。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'revelation', pos: 'n.', meaning: '揭露；被揭示的真相' },
      { form: 'revealing', pos: 'adj.', meaning: '显露的；发人深省的' }
    ],
    nearSynonym: {
      word: 'disclose',
      distinction: 'reveal 指揭开原本隐藏/不可见的事物真相；disclose 指对外公开宣布秘而不宣的信息',
      tip: '完形口诀：reveal = 揭开面纱/呈现；disclose = 官方信息披露'
    },
    crossContext: null
  },
  peril: {
    word: 'peril',
    pos: 'n.',
    ukPhonetic: '/ˈper.əl/',
    usPhonetic: '/ˈper.əl/',
    meaning: '巨大危险；危难',
    example: '她深知自己已处于极度的 peril 之中。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'perilous', pos: 'adj.', meaning: '充满危险的；冒风险的' },
      { form: 'perilously', pos: 'adv.', meaning: '危险地；险恶地' }
    ],
    nearSynonym: {
      word: 'danger',
      distinction: 'peril 书面语，指极严重的致命危险；danger 最通用，指各种程度的危险',
      tip: '完形口诀：peril = 高考高频书面词（极其严重危难）；danger = 常用危险'
    },
    crossContext: null
  },
  survival: {
    word: 'survival',
    pos: 'n.',
    ukPhonetic: '/səˈvaɪ.vəl/',
    usPhonetic: '/sɚˈvaɪ.vəl/',
    meaning: '生存；幸存；幸存物',
    example: '对生命的 survival 渴望促使她必须将此事调查到底。',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'survive', pos: 'v.', meaning: '幸存；挺过；比…活得长' },
      { form: 'survivor', pos: 'n.', meaning: '幸存者；生还者' }
    ],
    nearSynonym: null,
    crossContext: null
  },
  investigate: {
    word: 'investigate',
    pos: 'v.',
    ukPhonetic: '/ɪnˈves.tɪ.ɡeɪt/',
    usPhonetic: '/ɪnˈves.tə.ɡeɪt/',
    meaning: '调查；审查；研究',
    example: '促使她必须将此事 investigate 到底！',
    scene: '第一章 · 深夜快车',
    type: 'context',
    wordFamily: [
      { form: 'investigation', pos: 'n.', meaning: '调查；侦查' },
      { form: 'investigator', pos: 'n.', meaning: '调查员；侦探' },
      { form: 'investigative', pos: 'adj.', meaning: '调查的；侦查的' }
    ],
    nearSynonym: {
      word: 'examine',
      distinction: 'investigate 指系统性地深入侦查未知事件以寻获真相；examine 指仔细查看、检查具体物体或病人',
      tip: '完形口诀：investigate = 案件/事件深入调查；examine = 仔细体检/检查'
    },
    crossContext: null
  },
};

export const ONBOARDING_DEMOS = [
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
      branchText: '林亦下意识地倾向于清洁工那双战战兢兢的眼睛，准备在记录本上落笔。然而手电筒光忽然扫过咖啡杯底——桌面上有一圈未干的水渍。这意味着咖啡杯是在十分钟前刚刚被放在这里的。直觉欺骗了她，如果只凭好恶去断定清白，逆向推理绝不叫推断。真正的推理是让客观证据自己拼成拼图。林亦深吸一口气，强迫思维回归理性的天平，重新去 deduction 每一个物证……（主线汇流）'
    }
  }
];

export interface AppState {
  screen: 'login' | 'landing' | 'onboarding' | 'home' | 'reader' | 'vocab-screen' | 'parent-screen' | 'password-settings';
  onboardingStage: number; // 1: Demo, 2: Diagnosis, 3: Preferences, 4: Ready
  selectedDemo: typeof ONBOARDING_DEMOS[0] | null;
  preferences: { genres: string[]; intensity: string };
  diagAnswers: Array<{ oidx: number; isCorrect: boolean } | null>;
  diagScore: number;
  diagLevel: string;
  unlockedWords: Set<string>;
  
  // Snapshot State
  snapshotLoaded: boolean;
  streakDays: number;
  completedChapterCount: number;
  activeSessionId: string | null;
  clientRevision: number;
  currentChapter: any | null;
  mustChangePassword: boolean;

  // UI State
  isLoading: boolean;
  errorMessage: string | null;
  retryQueue: RetryEvent[];

  choiceState: 'pending' | 'correct' | 'wrong-branch';
  outputSelectedWord: string | null;
  outputAttempts: number;
  toast: string | null;
  
  // Actions
  setScreen: (screen: AppState['screen']) => void;
  setOnboardingStage: (stage: number) => void;
  selectDemo: (demo: typeof ONBOARDING_DEMOS[0]) => void;
  toggleGenre: (genreId: string) => void;
  setIntensity: (intensity: string) => void;
  setDiagAnswer: (qidx: number, oidx: number, isCorrect: boolean) => void;
  submitDiagnosis: () => void;
  completeOnboarding: () => Promise<boolean>;
  setChoiceState: (state: AppState['choiceState']) => void;
  selectOutputWord: (word: string) => void;
  setOutputAttempts: (count: number) => void;
  unlockWord: (word: string) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  resetAll: () => void;

  // New Snapshot Actions
  loadSnapshot: (snapshot: any) => void;
  startSession: (sessionId: string) => void;
  submitEvent: (type: string, payload: any) => Promise<boolean>;
  flushRetryQueue: () => Promise<void>;
  completeSession: (nextSnapshot: any) => void;
  setError: (msg: string | null) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'landing',
  onboardingStage: 1,
  selectedDemo: null,
  preferences: { genres: [], intensity: 'medium' },
  diagAnswers: [null, null, null, null],
  diagScore: 0,
  diagLevel: '高考水平：进阶 (B)',
  unlockedWords: new Set<string>(),
  
  snapshotLoaded: false,
  streakDays: 0,
  completedChapterCount: 0,
  activeSessionId: null,
  clientRevision: 0,
  currentChapter: null,
  mustChangePassword: false,
  isLoading: false,
  errorMessage: null,
  retryQueue: typeof window === 'undefined' ? [] : loadRetryQueue(),

  choiceState: 'pending',
  outputSelectedWord: null,
  outputAttempts: 0,
  toast: null,

  setScreen: (screen) => set({ screen }),
  setOnboardingStage: (onboardingStage) => set({ onboardingStage }),
  selectDemo: (selectedDemo) => set({ selectedDemo }),
  toggleGenre: (genreId) => set((state) => {
    const genres = [...state.preferences.genres];
    const idx = genres.indexOf(genreId);
    if (idx > -1) {
      genres.splice(idx, 1);
    } else {
      genres.push(genreId);
    }
    return { preferences: { ...state.preferences, genres } };
  }),
  setIntensity: (intensity) => set((state) => ({ preferences: { ...state.preferences, intensity } })),
  setDiagAnswer: (qidx, oidx, isCorrect) => set((state) => {
    const answers = [...state.diagAnswers];
    answers[qidx] = { oidx, isCorrect };
    return { diagAnswers: answers };
  }),
  submitDiagnosis: () => {
    const { diagAnswers } = get();
    let correctCount = 0;
    diagAnswers.forEach(ans => {
      if (ans?.isCorrect) correctCount++;
    });
    
    let diagLevel = '高考水平：基础 (C)';
    if (correctCount === 4) {
      diagLevel = '高考水平：优秀 (A)';
    } else if (correctCount >= 2) {
      diagLevel = '高考水平：进阶 (B)';
    }

    set({ diagScore: correctCount, diagLevel });
  },
  completeOnboarding: async () => {
    const state = get();
    let result: { success?: boolean; idempotent?: boolean } | null;
    try {
      result = await import('./apiClient').then(({ saveOnboardingApi }) => saveOnboardingApi({
        commandId: createClientId(),
        preferences: {
          genres: state.preferences.genres,
          intensity: state.preferences.intensity as 'light' | 'medium' | 'deep',
        },
        diagnostic: {
          itemSetVersion: 'baseline-v1',
          correctCount: state.diagScore,
          itemCount: state.diagAnswers.length,
          derivedLevel: state.diagLevel,
        },
      }));
    } catch {
      return false;
    }
    if (!result?.success && !result?.idempotent) return false;
    const demoWord = get().selectedDemo?.word;
    if (demoWord) {
      get().unlockWord(demoWord);
    }
    // Treat the server profile as the source of truth before leaving the
    // onboarding flow. This prevents a success toast from masking a stale
    // client-only profile that disappears on the next page load.
    try {
      const snapshot = await import('./apiClient').then(({ getLearningSnapshotApi }) => getLearningSnapshotApi());
      if (snapshot) get().loadSnapshot(snapshot);
    } catch {
      return false;
    }
    set({ screen: 'home' });
    return true;
  },
  setChoiceState: (choiceState) => set({ choiceState }),
  selectOutputWord: (outputSelectedWord) => set({ outputSelectedWord }),
  setOutputAttempts: (outputAttempts) => set({ outputAttempts }),
  unlockWord: (word) => set((state) => {
    const next = new Set(state.unlockedWords);
    next.add(word);
    return { unlockedWords: next };
  }),
  showToast: (msg) => {
    set({ toast: msg });
  },
  clearToast: () => set({ toast: null }),
  
  loadSnapshot: (snapshot) => set((state) => ({
    snapshotLoaded: true,
    diagLevel: snapshot?.user?.diagnosticLevel ?? state.diagLevel,
    preferences: {
      genres: snapshot?.user?.preferences?.genres ?? state.preferences.genres,
      intensity: snapshot?.user?.preferences?.intensity ?? state.preferences.intensity,
    },
    streakDays: snapshot?.progress?.streakDays ?? snapshot?.user?.streak ?? 0,
    completedChapterCount: snapshot?.progress?.completedChapterCount ?? 0,
    clientRevision: snapshot?.progress?.revision ?? 0,
    currentChapter: snapshot?.chapter ?? null,
    mustChangePassword: Boolean(snapshot?.user?.mustChangePassword),
    activeSessionId: snapshot?.progress?.activeSessionId ?? null
  })),
  startSession: (sessionId) => set({ activeSessionId: sessionId }),
  submitEvent: async (type, payload) => {
    const state = get();
    const eventId = createClientId();
    const sessionId = state.activeSessionId;
    if (!sessionId) return false;
    try {
      const result = await import('./apiClient').then(m => m.submitLearningEventApi(
        sessionId,
        eventId,
        type,
        payload,
        new Date().toISOString()
      ));
      if (result?.success || result?.idempotent) return true;
    } catch (e) {
      // Keep the event available for a future retry, but do not let completion
      // advance a chapter whose audit trail was not persisted.
    }
    const queue = [...get().retryQueue, { eventId, sessionId, type, payload, occurredAt: new Date().toISOString() }];
    const overflowed = queue.length > RETRY_QUEUE_LIMIT;
    const boundedQueue = queue.slice(-RETRY_QUEUE_LIMIT);
    persistRetryQueue(boundedQueue);
    set({ retryQueue: boundedQueue });
    if (overflowed) get().showToast('部分离线学习记录已达上限，请尽快恢复网络同步');
    return false;
  },
  flushRetryQueue: async () => {
    const queue = get().retryQueue;
    if (queue.length === 0) return;
    const { submitLearningEventApi } = await import('./apiClient');
    const remaining: RetryEvent[] = [];
    for (const event of queue) {
      const result = await submitLearningEventApi(event.sessionId, event.eventId, event.type, event.payload, event.occurredAt);
      if (!result?.success && !result?.idempotent) remaining.push(event);
    }
    persistRetryQueue(remaining);
    set({ retryQueue: remaining });
  },
  completeSession: (nextSnapshot) => set((state) => {
    return {
      streakDays: nextSnapshot?.progress?.streakDays ?? nextSnapshot?.user?.streak ?? state.streakDays,
      completedChapterCount: nextSnapshot?.progress?.completedChapterCount ?? state.completedChapterCount,
      clientRevision: nextSnapshot?.progress?.revision ?? state.clientRevision,
      currentChapter: nextSnapshot?.chapter ?? state.currentChapter,
      mustChangePassword: Boolean(nextSnapshot?.user?.mustChangePassword),
      activeSessionId: null,
      choiceState: 'pending',
      outputSelectedWord: null,
      outputAttempts: 0,
      screen: 'home'
    };
  }),
  setError: (msg) => set({ errorMessage: msg }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  resetAll: () => {
    try { window.localStorage.removeItem(RETRY_QUEUE_KEY); } catch {}
    set({
    screen: 'landing',
    onboardingStage: 1,
    selectedDemo: null,
    preferences: { genres: [], intensity: 'medium' },
    diagAnswers: [null, null, null, null],
    diagScore: 0,
    diagLevel: '高考水平：进阶 (B)',
    unlockedWords: new Set<string>(),
    snapshotLoaded: false,
    streakDays: 0,
    completedChapterCount: 0,
    activeSessionId: null,
    clientRevision: 0,
    currentChapter: null,
    mustChangePassword: false,
    isLoading: false,
    errorMessage: null,
    retryQueue: [],
    choiceState: 'pending',
    outputSelectedWord: null,
    outputAttempts: 0,
      toast: null,
    });
  }
}));
