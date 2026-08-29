/*
 * 佩剑体能训练 · 循环训练周期计划 — 数据模型
 * 依据训练计划文档整理:4 大模块 / 每周安排 / 4 周循环 / 热身冷身
 */
'use strict';

const APP_NAME = '佩剑体能训练';
const APP_SUB = 'Sabre Circuit Training';

/* 四大循环模块 */
const MODULES = {
  A: {
    short: 'A', name: '下肢爆发冲刺', freq: '每周 2 次',
    desc: '佩剑步伐核心:冲刺、弓步、Fleche 的爆发力来源',
    color: '#4C8DFF', dark: '#16305F',
    progression: '进阶:箱高 ↑(每循环 +5cm)、负重 ↑(+2kg)、冲刺距离 ↑'
  },
  B: {
    short: 'B', name: '腕臂爆发', freq: '每周 2 次',
    desc: '佩剑特色:手腕挥砍速度、剑柄控制与肩袖强化',
    color: '#E9B44C', dark: '#4A3410',
    progression: '进阶:速度优先、重量其次;记录 30 秒劈砍次数逐周提升;腕部酸痛时降低强度'
  },
  C: {
    short: 'C', name: '无氧体能', freq: '每周 1–2 次',
    desc: '模拟佩剑攻防节奏:折返、弓步冲刺与乳酸耐力',
    color: '#E4572E', dark: '#4A1C0E',
    progression: '可选 Tabata 模式:20 秒全力 / 10 秒休息 × 8 轮,适合时间特别紧的日子'
  },
  D: {
    short: 'D', name: '核心稳定防伤', freq: '每周 1–2 次',
    desc: '抗旋转核心、平衡与肩部防伤',
    color: '#2A9D8F', dark: '#0D3B35',
    progression: '可与 A/B 模块合并半轮,控制总量'
  }
};

/* 各模块动作库:每动作含 要点/进阶提示 */
const EXERCISES = {
  A: [
    { name: '冲刺弓步(Fleche 模拟)', tip: '3 步快速冲刺接弓步触线,落地即回中' },
    { name: '快速弓步回收', tip: '实战姿势反复前弓步—回中,越快越好' },
    { name: '低箱跳箱(20–40cm)', tip: '落地轻、膝盖对准脚尖' },
    { name: '保加利亚分腿蹲', tip: '自重 → 负重(哑铃/壶铃),每侧 15 秒' },
    { name: '快速踝泵 / 快节奏跳绳', tip: '脚踝弹性训练' },
    { name: '阻力带侧向滑步', tip: '敏捷 + 臀中肌,防膝内扣' }
  ],
  B: [
    { name: '快速腕屈伸', tip: '轻哑铃/水瓶快节奏腕屈伸 30 秒' },
    { name: '空击劈砍', tip: '持剑(或短棍)连续快速劈砍 30 秒,专注速度与放松' },
    { name: '弹力带肩外旋', tip: '肩袖强化 + 快速挥臂' },
    { name: '药球砸地 / 胸前快传', tip: '上肢旋转爆发' },
    { name: '毛巾鞭打', tip: '湿毛巾对地/对墙快速鞭打,练手腕鞭击' },
    { name: '握力挤压', tip: '握力球/抓握训练,强化剑柄控制' }
  ],
  C: [
    { name: '10m 折返冲刺(击剑步)', tip: '摸线急停转身,模拟佩剑攻防节奏' },
    { name: '弓步冲刺 10m', tip: '连续前弓步快速移动' },
    { name: '波比跳', tip: '全身无氧' },
    { name: '跳绳(双摇)', tip: '脚踝 + 心肺' },
    { name: '高抬腿冲刺 30 秒', tip: '步频训练' },
    { name: '靠墙静蹲 30–45 秒', tip: '腿部乳酸耐力' }
  ],
  D: [
    { name: '平板支撑', tip: '正面 45 秒 + 侧面各 30 秒,抗旋转核心' },
    { name: '死虫式', tip: '下背保护' },
    { name: '俄罗斯转体(负重)', tip: '模拟挥砍旋转发力' },
    { name: '单腿平衡 + 抛接球', tip: '模拟对抗中的平衡干扰' },
    { name: '鸟狗式', tip: '核心 + 髋稳定' },
    { name: '弹力带肩袖(内外旋)', tip: '肩部防伤' }
  ]
};

/* 每周安排:module 取值为 A/B/C/D 或 R(主动恢复)/X(休息)/AC(A·C 加强) */
const WEEK_SCHEDULE = [
  { day: 1, module: 'A',  label: '爆发冲刺',   note: '下肢爆发与冲刺,佩剑步伐核心' },
  { day: 2, module: 'C',  label: '无氧体能',   note: '模拟佩剑攻防节奏' },
  { day: 3, module: 'B',  label: '腕臂爆发',   note: '手腕是佩剑的"生命线"' },
  { day: 4, module: 'R',  label: '主动恢复',   note: '慢走 / 骑行 / 游泳 20–30 分钟 + 拉伸,打有氧底子' },
  { day: 5, module: 'D',  label: '核心稳定',   note: '核心 + 防伤' },
  { day: 6, module: 'AC', label: 'A·C 加强',   note: '下肢 + 无氧组合强化' },
  { day: 0, module: 'X',  label: '完全休息',   note: '不做任何训练,好好恢复' }
];

/* 4 周循环周期:渐进超负荷 → 减量 */
const CYCLE = [
  { w: 1, theme: '基础适应', work: 30, rest: 45, rounds: 3, load: '自重为主,动作标准优先' },
  { w: 2, theme: '容量提升', work: 30, rest: 30, rounds: 4, load: '增加 1 轮、缩短组间休息' },
  { w: 3, theme: '强度冲刺', work: 40, rest: 20, rounds: 4, load: '负重/箱高/速度全面上调,最累的一周' },
  { w: 4, theme: '减量恢复', work: 20, rest: 40, rounds: 3, load: '强度降至 50–60%,为下一循环蓄力' }
];

/* 30 / 60 分钟版本配置 */
const VERSION_30 = { warmupDur: 300, rounds: 2, exCount: 5, cooldownDur: 200 };
const VERSION_60 = { warmupDur: 480, rounds: null, exCount: 6, cooldownDur: 480 }; // rounds 跟随当前周
const ROUND_REST = 150; // 轮间休息 2.5 分钟

/* 热身步骤(按版本) */
const WARMUP_30 = [
  { name: '踝膝髋肩动态活动', dur: 90 },
  { name: '手腕绕环激活', dur: 60 },
  { name: '实战姿势弓步移动', dur: 90 },
  { name: '轻跳绳 1–2 分钟', dur: 60 }
];
const WARMUP_60 = [
  { name: '踝膝髋肩动态活动', dur: 120 },
  { name: '手腕绕环激活', dur: 90 },
  { name: '实战姿势弓步移动', dur: 120 },
  { name: '轻跳绳', dur: 90 },
  { name: '弓步节奏冲刺预备', dur: 60 }
];

/* 冷身步骤(静态拉伸 + 深呼吸) */
const COOLDOWN_30 = [
  { name: '股四头肌拉伸', dur: 40 },
  { name: '腘绳肌拉伸', dur: 40 },
  { name: '小腿拉伸', dur: 40 },
  { name: '髋屈肌拉伸', dur: 40 },
  { name: '肩与腕拉伸', dur: 40 }
];
const COOLDOWN_60 = [
  { name: '股四头肌拉伸', dur: 80 },
  { name: '腘绳肌拉伸', dur: 80 },
  { name: '小腿拉伸', dur: 80 },
  { name: '髋屈肌拉伸', dur: 80 },
  { name: '肩与腕拉伸', dur: 80 },
  { name: '深呼吸放松', dur: 80 }
];

/* 周六 A·C 加强:各取关键动作合成 6 个 */
const AC_COMBINED = [
  { name: '冲刺弓步(Fleche 模拟)', tip: '3 步快速冲刺接弓步触线,落地即回中' },
  { name: '快速弓步回收', tip: '实战姿势反复前弓步—回中,越快越好' },
  { name: '低箱跳箱(20–40cm)', tip: '落地轻、膝盖对准脚尖' },
  { name: '10m 折返冲刺(击剑步)', tip: '摸线急停转身,模拟佩剑攻防节奏' },
  { name: '波比跳', tip: '全身无氧' },
  { name: '靠墙静蹲 30–45 秒', tip: '腿部乳酸耐力' }
];

/* 基础训练(实在没时间时的保底方案) */
const MINIMUM_SESSION = [
  { name: '弓步步伐', dur: 600, tip: '10 分钟,前弓步—回中循环' },
  { name: '空击劈砍', dur: 300, tip: '5 分钟,持剑/短棍快速劈砍' },
  { name: '核心(模块 D)', dur: 300, tip: '5 分钟,平板支撑 + 死虫式' }
];

/* 执行与恢复要点 */
const TIPS = [
  { icon: '🗓', title: '与专项训练错开', text: '技术/实战训练日只做 1 轮轻量循环或纯核心(模块 D);体能日当天不再做大强度实战。' },
  { icon: '✋', title: '手腕劳损预防', text: '腕部酸痛立即降低模块 B 强度并冰敷观察;空击可改用软剑/短棍;持续疼痛及时就医。' },
  { icon: '🍚', title: '营养', text: '训练前 60–90 分钟进食(以碳水为主);训练中每 15 分钟补水 150–200ml;训练后 30 分钟内补充蛋白质 + 碳水。' },
  { icon: '😴', title: '睡眠 7–9 小时', text: '体能增长发生在恢复期,睡不够练再多效果也打折。' },
  { icon: '🚑', title: '伤病红线', text: '膝、踝、腕出现疼痛立即停练,冰敷观察,持续疼痛及时就医;每次训练前务必激活踝膝髋与手腕。' },
  { icon: '📹', title: '自查与记录', text: '每 8–12 周录一次训练视频检查动作质量(膝盖方向、落地缓冲、劈砍是否放松);记录轮数、重量、30 秒劈砍次数,用于下一循环加量。' }
];

/* 比赛周调整 */
const COMPETITION_TIPS = [
  '赛前 1 周:采用第 4 周减量模式',
  '赛前 3 天:停止大强度力量训练',
  '赛前 1 天:只做轻松空击 + 拉伸,不做体能'
];
