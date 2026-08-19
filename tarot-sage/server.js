const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));
// ============ 环境变量 ============
const TRUSTOKEN_BASE_URL = process.env.TRUSTOKEN_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.trustoken.cn/v1';
const TRUSTOKEN_MODEL = process.env.TRUSTOKEN_MODEL || process.env.OPENAI_CHAT_MODEL || 'auto';
const TRUSTOKEN_API_KEY = process.env.TRUSTOKEN_API_KEY || process.env.OPENAI_API_KEY || '{{API_KEY}}';
// ============ 塔罗牌数据 ============
const TAROT_CARDS = [
  { id: 1, name: '愚人', type: 'major', number: 0, element: '风', keywords: '开始、冒险、天真、自由', meaning_upright: '新的开始，充满无限可能。放下过去，勇敢迈出第一步。', meaning_reversed: '鲁莽行事，冒险冲动，需要三思而后行。' },
  { id: 2, name: '魔术师', type: 'major', number: 1, element: '水', keywords: '创造、技能、自信、资源', meaning_upright: '你拥有实现目标所需的一切资源。发挥你的创造力。', meaning_reversed: '才华被埋没，缺乏方向，需要重新审视自己的才能。' },
  { id: 3, name: '女祭司', type: 'major', number: 2, element: '水', keywords: '直觉、智慧、神秘、内在', meaning_upright: '倾听内心的声音，答案就在你的潜意识中。', meaning_reversed: '忽视直觉，表面化，需要深入探索内心。' },
  { id: 4, name: '女皇', type: 'major', number: 3, element: '土', keywords: '丰收、滋养、美丽、自然', meaning_upright: '丰饶与收获，享受生活的美好，母性的关怀。', meaning_reversed: '创造力受阻，过度依赖他人，需要独立自主。' },
  { id: 5, name: '皇帝', type: 'major', number: 4, element: '火', keywords: '权威、稳定、领导、父亲', meaning_upright: '建立秩序与规则，用理性与权威掌控局面。', meaning_reversed: '专制独裁，缺乏灵活性，需要放下控制欲。' },
  { id: 6, name: '教皇', type: 'major', number: 5, element: '土', keywords: '传统、信仰、教导、指引', meaning_upright: '寻求精神指引，遵循传统智慧，向长者学习。', meaning_reversed: '打破常规，质疑权威，需要找到自己的信仰。' },
  { id: 7, name: '恋人', type: 'major', number: 6, element: '风', keywords: '爱情、选择、结合、和谐', meaning_upright: '重要的关系或选择，跟随内心做出决定。', meaning_reversed: '关系失衡，选择困难，需要重新评估价值观。' },
  { id: 8, name: '战车', type: 'major', number: 7, element: '水', keywords: '胜利、意志、决心、征服', meaning_upright: '凭借强大的意志力克服困难，取得胜利。', meaning_reversed: '缺乏方向，冲突加剧，需要调整策略。' },
  { id: 9, name: '力量', type: 'major', number: 8, element: '火', keywords: '勇气、力量、耐心、温柔', meaning_upright: '内在的力量与勇气，用温柔而非暴力解决问题。', meaning_reversed: '软弱无力，缺乏自信，需要找回内在的力量。' },
  { id: 10, name: '隐士', type: 'major', number: 9, element: '土', keywords: '内省、智慧、孤独、指引', meaning_upright: '独处与反思，寻找内在的智慧与真理。', meaning_reversed: '孤立无援，拒绝帮助，需要走出孤独。' },
  { id: 11, name: '命运之轮', type: 'major', number: 10, element: '火', keywords: '变化、循环、命运、机遇', meaning_upright: '命运的转折点，好运即将到来，抓住机遇。', meaning_reversed: '厄运循环，抗拒改变，需要接受命运的安排。' },
  { id: 12, name: '正义', type: 'major', number: 11, element: '风', keywords: '公平、真相、法律、平衡', meaning_upright: '公正的裁决，真相大白，因果报应。', meaning_reversed: '不公对待，逃避责任，需要诚实面对。' },
  { id: 13, name: '倒吊人', type: 'major', number: 12, element: '水', keywords: '牺牲、等待、换位、觉悟', meaning_upright: '以退为进，换位思考，从不同角度看问题。', meaning_reversed: '无谓的牺牲，拖延不决，需要停止自我折磨。' },
  { id: 14, name: '死神', type: 'major', number: 13, element: '水', keywords: '结束、转变、重生、放下', meaning_upright: '旧事物的结束，新生的开始，放下过去。', meaning_reversed: '抗拒改变，停滞不前，需要接受必然的转变。' },
  { id: 15, name: '节制', type: 'major', number: 14, element: '火', keywords: '平衡、适度、调和、耐心', meaning_upright: '保持平衡与适度，调和矛盾，耐心等待。', meaning_reversed: '失衡极端，缺乏耐心，需要找回平衡。' },
  { id: 16, name: '恶魔', type: 'major', number: 15, element: '土', keywords: '束缚、欲望、沉迷、物质', meaning_upright: '被欲望束缚，沉迷物质，需要摆脱枷锁。', meaning_reversed: '觉醒与解脱，摆脱不良习惯，重获自由。' },
  { id: 17, name: '高塔', type: 'major', number: 16, element: '火', keywords: '剧变、崩塌、觉醒、重建', meaning_upright: '突如其来的变故，打破旧有结构，重建新生。', meaning_reversed: '避免灾难，抗拒改变，需要提前预警。' },
  { id: 18, name: '星星', type: 'major', number: 17, element: '风', keywords: '希望、灵感、平静、治愈', meaning_upright: '充满希望与灵感，心灵得到治愈，宁静致远。', meaning_reversed: '失去希望，信心不足，需要重新点燃信念。' },
  { id: 19, name: '月亮', type: 'major', number: 18, element: '水', keywords: '幻觉、恐惧、潜意识、不安', meaning_upright: '面对内心的恐惧与幻觉，探索潜意识。', meaning_reversed: '看清真相，克服恐惧，走出迷雾。' },
  { id: 20, name: '太阳', type: 'major', number: 19, element: '火', keywords: '成功、快乐、活力、成就', meaning_upright: '光明与成功，充满活力与喜悦，一切皆美好。', meaning_reversed: '暂时的挫折，快乐被遮蔽，需要重新寻找光明。' },
  { id: 21, name: '审判', type: 'major', number: 20, element: '火', keywords: '觉醒、重生、审判、召唤', meaning_upright: '内心的觉醒，接受召唤，重新开始。', meaning_reversed: '自我怀疑，拒绝改变，需要倾听内心的声音。' },
  { id: 22, name: '世界', type: 'major', number: 21, element: '土', keywords: '完成、圆满、旅行、成就', meaning_upright: '圆满的完成，一个周期的结束，获得成就。', meaning_reversed: '未完成的任务，需要补全，拖延的结局。' },
  { id: 23, name: '宝剑二', type: 'minor', suit: '宝剑', number: 2, element: '风', keywords: '抉择、僵局、平衡、逃避', meaning_upright: '面临艰难的抉择，需要做出决定。', meaning_reversed: '信息不足，过度分析，需要放下防备。' },
  { id: 24, name: '宝剑三', type: 'minor', suit: '宝剑', number: 3, element: '风', keywords: '心痛、悲伤、失落、伤害', meaning_upright: '心碎与悲伤，情感上的痛苦需要面对。', meaning_reversed: '从伤痛中恢复，释放负面情绪，开始疗愈。' },
  { id: 25, name: '宝剑四', type: 'minor', suit: '宝剑', number: 4, element: '风', keywords: '休息、恢复、沉思、安宁', meaning_upright: '需要休息与恢复，给自己充电的时间。', meaning_reversed: '无法安宁，过度劳累，需要强制休息。' },
  { id: 26, name: '宝剑五', type: 'minor', suit: '宝剑', number: 5, element: '风', keywords: '冲突、失败、损失、屈辱', meaning_upright: '冲突与争执，即使赢了也是输家。', meaning_reversed: '和解与修复，放下过去，重新开始。' },
  { id: 27, name: '宝剑六', type: 'minor', suit: '宝剑', number: 6, element: '风', keywords: '过渡、疗愈、旅程、放下', meaning_upright: '渡过难关，走向平静，带着伤痛前行。', meaning_reversed: '无法释怀，被困在过去，需要勇敢前行。' },
  { id: 28, name: '宝剑七', type: 'minor', suit: '宝剑', number: 7, element: '风', keywords: '策略、欺骗、偷窃、计划', meaning_upright: '需要策略与计谋，小心被人欺骗。', meaning_reversed: '谎言被揭穿，计划失败，需要诚实面对。' },
  { id: 29, name: '宝剑八', type: 'minor', suit: '宝剑', number: 8, element: '风', keywords: '束缚、困境、限制、无助', meaning_upright: '感到被困住，自我设限，需要打破思维牢笼。', meaning_reversed: '获得自由，看清真相，走出困境。' },
  { id: 30, name: '宝剑九', type: 'minor', suit: '宝剑', number: 9, element: '风', keywords: '噩梦、焦虑、恐惧、失眠', meaning_upright: '深夜的焦虑与恐惧，被噩梦困扰。', meaning_reversed: '克服恐惧，寻求帮助，从焦虑中走出。' },
  { id: 31, name: '宝剑十', type: 'minor', suit: '宝剑', number: 10, element: '风', keywords: '结束、痛苦、绝望、重生', meaning_upright: '最黑暗的时刻，但也是新生的开始。', meaning_reversed: '否极泰来，从绝望中重生，看到希望。' },
  { id: 32, name: '宝剑国王', type: 'minor', suit: '宝剑', number: 11, element: '风', keywords: '理性、权威、分析、公正', meaning_upright: '理性的决策者，用智慧与公正领导。', meaning_reversed: '滥用权力，冷酷无情，需要更多同理心。' },
  { id: 33, name: '宝剑骑士', type: 'minor', suit: '宝剑', number: 12, element: '风', keywords: '冲动、快速、行动、辩论', meaning_upright: '快速行动，但容易冲动，需要三思而行。', meaning_reversed: '鲁莽行事，计划失败，需要放慢脚步。' },
  { id: 34, name: '宝剑侍者', type: 'minor', suit: '宝剑', number: 13, element: '风', keywords: '好奇、观察、沟通、警觉', meaning_upright: '保持好奇心，善于观察与沟通。', meaning_reversed: '八卦闲话，沟通不畅，需要谨慎言行。' },
  { id: 35, name: '宝剑女王', type: 'minor', suit: '宝剑', number: 14, element: '风', keywords: '独立、洞察、智慧、悲伤', meaning_upright: '独立的思考者，拥有敏锐的洞察力。', meaning_reversed: '过度批判，冷漠无情，需要打开心扉。' },
  { id: 36, name: '宝剑王牌', type: 'minor', suit: '宝剑', number: 1, element: '风', keywords: '突破、真相、胜利、清晰', meaning_upright: '新的想法与突破，真相大白，获得胜利。', meaning_reversed: '混乱与误解，计划受阻，需要重新审视。' },
  { id: 38, name: '权杖二', type: 'minor', suit: '权杖', number: 2, element: '火', keywords: '计划、决定、未来、选择', meaning_upright: '规划未来，做出重要的决定。', meaning_reversed: '犹豫不决，恐惧未知，需要勇敢迈出。' },
  { id: 39, name: '权杖三', type: 'minor', suit: '权杖', number: 3, element: '火', keywords: '远行、探索、远见、合作', meaning_upright: '展望未来，探索新的可能性。', meaning_reversed: '计划延迟，合作受阻，需要调整方向。' },
  { id: 40, name: '权杖四', type: 'minor', suit: '权杖', number: 4, element: '火', keywords: '庆祝、和谐、家园、稳定', meaning_upright: '庆祝与喜悦，家庭和谐，稳固的基础。', meaning_reversed: '不稳定的环境，庆祝被取消，需要维护和谐。' },
  { id: 41, name: '权杖五', type: 'minor', suit: '权杖', number: 5, element: '火', keywords: '竞争、冲突、挑战、分歧', meaning_upright: '竞争与挑战，需要努力争取。', meaning_reversed: '避免冲突，妥协合作，找到共同点。' },
  { id: 42, name: '权杖六', type: 'minor', suit: '权杖', number: 6, element: '火', keywords: '胜利、认可、成功、骄傲', meaning_upright: '获得胜利与认可，享受成功的喜悦。', meaning_reversed: '失败与挫折，缺乏认可，需要继续努力。' },
  { id: 43, name: '权杖七', type: 'minor', suit: '权杖', number: 7, element: '火', keywords: '防御、坚持、挑战、勇气', meaning_upright: '坚守阵地，勇敢面对挑战。', meaning_reversed: '放弃与退缩，压力过大，需要重新评估。' },
  { id: 44, name: '权杖八', type: 'minor', suit: '权杖', number: 8, element: '火', keywords: '速度、行动、进展、消息', meaning_upright: '快速进展，好消息即将到来。', meaning_reversed: '延误与阻碍，计划受阻，需要耐心等待。' },
  { id: 45, name: '权杖九', type: 'minor', suit: '权杖', number: 9, element: '火', keywords: '坚持、韧性、防御、警觉', meaning_upright: '最后的坚持，保持警惕，即将成功。', meaning_reversed: '精疲力竭，放弃抵抗，需要休息。' },
  { id: 46, name: '权杖十', type: 'minor', suit: '权杖', number: 10, element: '火', keywords: '负担、压力、责任、过度', meaning_upright: '背负过多的责任，需要学会放手。', meaning_reversed: '卸下重担，分配任务，减轻压力。' },
  { id: 47, name: '权杖国王', type: 'minor', suit: '权杖', number: 11, element: '火', keywords: '领导力、远见、企业家、冒险', meaning_upright: '充满魅力的领导者，勇敢开拓新领域。', meaning_reversed: '专横跋扈，冒险过度，需要倾听他人意见。' },
  { id: 48, name: '权杖骑士', type: 'minor', suit: '权杖', number: 12, element: '火', keywords: '热情、冒险、旅行、冲动', meaning_upright: '充满热情与冒险精神，勇敢追求目标。', meaning_reversed: '冲动鲁莽，计划不周，需要冷静思考。' },
  { id: 49, name: '权杖侍者', type: 'minor', suit: '权杖', number: 13, element: '火', keywords: '探索、热情、消息、学习', meaning_upright: '新的消息与机会，充满探索的热情。', meaning_reversed: '缺乏方向，计划延迟，需要重新定位。' },
  { id: 50, name: '权杖女王', type: 'minor', suit: '权杖', number: 14, element: '火', keywords: '自信、热情、果断、魅力', meaning_upright: '自信果断的女性，充满魅力与活力。', meaning_reversed: '缺乏自信，情绪化，需要找回内在力量。' },
  { id: 51, name: '权杖王牌', type: 'minor', suit: '权杖', number: 1, element: '火', keywords: '开始、创造、灵感、新起点', meaning_upright: '新的开始与创造，充满灵感与动力。', meaning_reversed: '缺乏动力，计划搁浅，需要重新点燃激情。' },
  { id: 52, name: '圣杯二', type: 'minor', suit: '圣杯', number: 2, element: '水', keywords: '爱情、结合、平等、友谊', meaning_upright: '平等的爱情与友谊，美好的结合。', meaning_reversed: '关系失衡，分手，需要重新评估。' },
  { id: 53, name: '圣杯三', type: 'minor', suit: '圣杯', number: 3, element: '水', keywords: '庆祝、友谊、欢乐、聚会', meaning_upright: '庆祝与欢乐，朋友相聚，分享喜悦。', meaning_reversed: '过度享乐，友谊破裂，需要节制。' },
  { id: 54, name: '圣杯四', type: 'minor', suit: '圣杯', number: 4, element: '水', keywords: '沉思、不满、冷漠、机会', meaning_upright: '对现状不满，需要审视内心真正的需求。', meaning_reversed: '新的机会，走出舒适区，接受改变。' },
  { id: 55, name: '圣杯五', type: 'minor', suit: '圣杯', number: 5, element: '水', keywords: '失落、悲伤、遗憾、失望', meaning_upright: '沉浸在失落与悲伤中，需要向前看。', meaning_reversed: '接受现实，从悲伤中走出，看到希望。' },
  { id: 56, name: '圣杯六', type: 'minor', suit: '圣杯', number: 6, element: '水', keywords: '回忆、怀旧、礼物、童年', meaning_upright: '美好的回忆与馈赠，重温过去的温暖。', meaning_reversed: '困在过去，无法前进，需要放下执念。' },
  { id: 57, name: '圣杯七', type: 'minor', suit: '圣杯', number: 7, element: '水', keywords: '幻想、选择、幻觉、梦想', meaning_upright: '面对多种选择，需要分辨幻想与现实。', meaning_reversed: '明确目标，聚焦现实，做出选择。' },
  { id: 58, name: '圣杯八', type: 'minor', suit: '圣杯', number: 8, element: '水', keywords: '放下、离开、寻找、探索', meaning_upright: '放下过去，踏上新的精神探索之旅。', meaning_reversed: '害怕改变，停滞不前，需要勇气。' },
  { id: 59, name: '圣杯九', type: 'minor', suit: '圣杯', number: 9, element: '水', keywords: '满足、愿望、幸福、享受', meaning_upright: '愿望成真，满足与幸福，享受成果。', meaning_reversed: '表面光鲜，内心空虚，需要真正的满足。' },
  { id: 60, name: '圣杯十', type: 'minor', suit: '圣杯', number: 10, element: '水', keywords: '幸福、家庭、和谐、圆满', meaning_upright: '家庭幸福，情感圆满，和谐美满。', meaning_reversed: '家庭矛盾，关系破裂，需要修复。' },
  { id: 61, name: '圣杯国王', type: 'minor', suit: '圣杯', number: 11, element: '水', keywords: '情感、成熟、慈悲、智慧', meaning_upright: '情感成熟的领导者，充满慈悲与智慧。', meaning_reversed: '情绪失控，过度敏感，需要情感管理。' },
  { id: 62, name: '圣杯骑士', type: 'minor', suit: '圣杯', number: 12, element: '水', keywords: '浪漫、追求、邀请、魅力', meaning_upright: '浪漫的追求者，充满魅力与理想。', meaning_reversed: '不切实际，情感欺骗，需要脚踏实地。' },
  { id: 63, name: '圣杯侍者', type: 'minor', suit: '圣杯', number: 13, element: '水', keywords: '直觉、消息、创意、敏感', meaning_upright: '新的消息与灵感，听从直觉的指引。', meaning_reversed: '创意受阻，情感幼稚，需要成熟面对。' },
  { id: 64, name: '圣杯女王', type: 'minor', suit: '圣杯', number: 14, element: '水', keywords: '直觉、关怀、情感、温柔', meaning_upright: '温柔关怀的女性，直觉敏锐，充满爱心。', meaning_reversed: '情感压抑，过度依赖，需要独立。' },
  { id: 65, name: '圣杯王牌', type: 'minor', suit: '圣杯', number: 1, element: '水', keywords: '爱情、新感情、直觉、灵感', meaning_upright: '新的爱情与感情，充满爱与灵感。', meaning_reversed: '情感空虚，爱意受阻，需要打开心扉。' },
  { id: 66, name: '星币二', type: 'minor', suit: '星币', number: 2, element: '土', keywords: '平衡、适应、变化、理财', meaning_upright: '在多重事务中保持平衡，灵活适应变化。', meaning_reversed: '失去平衡，财务混乱，需要调整。' },
  { id: 67, name: '星币三', type: 'minor', suit: '星币', number: 3, element: '土', keywords: '团队、合作、技能、学徒', meaning_upright: '团队合作，学习技能，共同完成目标。', meaning_reversed: '缺乏合作，技能不足，需要更多学习。' },
  { id: 68, name: '星币四', type: 'minor', suit: '星币', number: 4, element: '土', keywords: '守财、稳定、控制、吝啬', meaning_upright: '财务稳定，但过于保守，需要适度放松。', meaning_reversed: '财务损失，过度慷慨，需要平衡。' },
  { id: 69, name: '星币五', type: 'minor', suit: '星币', number: 5, element: '土', keywords: '贫困、困难、孤立、担忧', meaning_upright: '物质或精神上的匮乏，需要寻求帮助。', meaning_reversed: '走出困境，找到希望，改善状况。' },
  { id: 70, name: '星币六', type: 'minor', suit: '星币', number: 6, element: '土', keywords: '慷慨、分享、慈善、帮助', meaning_upright: '慷慨给予与接受，帮助他人，分享财富。', meaning_reversed: '自私自利，债务问题，需要平衡给予与索取。' },
  { id: 71, name: '星币七', type: 'minor', suit: '星币', number: 7, element: '土', keywords: '评估、投资、等待、收获', meaning_upright: '评估投资成果，等待收获的季节。', meaning_reversed: '投资失败，缺乏耐心，需要重新评估。' },
  { id: 72, name: '星币八', type: 'minor', suit: '星币', number: 8, element: '土', keywords: '勤奋、技能、工作、专注', meaning_upright: '勤奋工作，专注提升技能，精益求精。', meaning_reversed: '工作倦怠，缺乏动力，需要休息。' },
  { id: 73, name: '星币九', type: 'minor', suit: '星币', number: 9, element: '土', keywords: '自律、成就、独立、奢华', meaning_upright: '通过自律获得成就，享受独立与奢华。', meaning_reversed: '过度工作，忽视生活，需要平衡。' },
  { id: 74, name: '星币十', type: 'minor', suit: '星币', number: 10, element: '土', keywords: '财富、传承、家族、长久', meaning_upright: '长久的财富与传承，家族繁荣。', meaning_reversed: '财务危机，家族矛盾，需要重新整合。' },
  { id: 75, name: '星币国王', type: 'minor', suit: '星币', number: 11, element: '土', keywords: '成功、商业、财富、稳定', meaning_upright: '成功的商业领袖，财富与稳定的象征。', meaning_reversed: '财务失败，固执守旧，需要创新。' },
  { id: 76, name: '星币骑士', type: 'minor', suit: '星币', number: 12, element: '土', keywords: '务实、勤奋、可靠、责任', meaning_upright: '务实可靠的行动者，勤奋工作，负责任。', meaning_reversed: '缺乏进展，懒惰拖延，需要增加动力。' },
  { id: 77, name: '星币侍者', type: 'minor', suit: '星币', number: 13, element: '土', keywords: '学习、消息、实践、专注', meaning_upright: '新的学习机会，专注实践，脚踏实地。', meaning_reversed: '缺乏计划，学习受阻，需要更多专注。' },
  { id: 78, name: '星币女王', type: 'minor', suit: '星币', number: 14, element: '土', keywords: '务实、丰饶、关怀、自然', meaning_upright: '务实丰饶的女性，关怀他人，享受自然。', meaning_reversed: '忽视自我，过度工作，需要关爱自己。' },
  { id: 79, name: '星币王牌', type: 'minor', suit: '星币', number: 1, element: '土', keywords: '财富、新开始、机会、物质', meaning_upright: '新的财务机会，物质上的新开始。', meaning_reversed: '错失良机，财务损失，需要重新把握。' }
];
// ============ 图片映射表 ============
const PHOTO_MAP = {
  1: '01_0.愚人.jpg', 2: '02_1.魔术师.jpg', 3: '03_2.女祭司.jpg', 4: '04_3.女皇.jpg',
  5: '05_4.皇帝.jpg', 6: '06_5.教皇.jpg', 7: '07_6.恋人.jpg', 8: '08_7.战车.jpg',
  9: '09_8.力量.jpg', 10: '10_9.隐士.jpg', 11: '11_10.命运之轮.jpg', 12: '12_11.正义.jpg',
  13: '13_12.倒吊人.jpg', 14: '14_13.死神.jpg', 15: '15_14.节制.jpg', 16: '16_15.恶魔.jpg',
  17: '17_16.高塔.jpg', 18: '18_17.星星.jpg', 19: '19_18.月亮.jpg', 20: '20_19.太阳.jpg',
  21: '21_20.审判.jpg', 22: '22_21.世界.jpg', 23: '23_宝剑2.jpg', 24: '24_宝剑3.jpg',
  25: '25_宝剑4.jpg', 26: '26_宝剑5.jpg', 27: '27_宝剑6.jpg', 28: '28_宝剑7.jpg',
  29: '29_宝剑8.jpg', 30: '30_宝剑9.jpg', 31: '31_宝剑10.jpg', 32: '32_宝剑国王.jpg',
  33: '33_宝剑骑士.jpg', 34: '34_宝剑侍者.jpg', 35: '35_宝剑女王.jpg', 36: '36_宝剑王牌.jpg',
  37: '37_普及版背面.jpg', 38: '38_权杖2.jpg', 39: '39_权杖3.jpg', 40: '40_权杖4.jpg',
  41: '41_权杖5.jpg', 42: '42_权杖6.jpg', 43: '43_权杖7.jpg', 44: '44_权杖8.jpg',
  45: '45_权杖9.jpg', 46: '46_权杖10.jpg', 47: '47_权杖国王.jpg', 48: '48_权杖骑士.jpg',
  49: '49_权杖侍者.jpg', 50: '50_权杖女王.jpg', 51: '51_权杖王牌.jpg', 52: '52_圣杯2.jpg',
  53: '53_圣杯3.jpg', 54: '54_圣杯4.jpg', 55: '55_圣杯5.jpg', 56: '56_圣杯6.jpg',
  57: '57_圣杯7.jpg', 58: '58_圣杯8.jpg', 59: '59_圣杯9.jpg', 60: '60_圣杯10.jpg',
  61: '61_圣杯国王.jpg', 62: '62_圣杯骑士.jpg', 63: '63_圣杯侍者.jpg', 64: '64_圣杯女王.jpg',
  65: '65_圣杯王牌.jpg', 66: '66_星币2.jpg', 67: '67_星币3.jpg', 68: '68_星币4.jpg',
  69: '69_星币5.jpg', 70: '70_星币6.jpg', 71: '71_星币7.jpg', 72: '72_星币8.jpg',
  73: '73_星币9.jpg', 74: '74_星币10.jpg', 75: '75_星币国王.jpg', 76: '76_星币骑士.jpg',
  77: '77_星币侍者.jpg', 78: '78_星币女王.jpg', 79: '79_星币王牌.jpg'
};
// ============ 12星座特性 ============
const ZODIAC_TRAITS = {
  '白羊座': { element: '火', traits: '热情冲动、勇敢直率、行动力强', advice: '白羊座的朋友，你的热情是最大的武器，但也要学会三思而后行。' },
  '金牛座': { element: '土', traits: '稳重踏实、固执坚韧、重视物质', advice: '金牛座的朋友，你的坚持值得敬佩，但有时也需要灵活变通。' },
  '双子座': { element: '风', traits: '聪明机智、善变好奇、沟通力强', advice: '双子座的朋友，你的智慧是你的优势，但专注力需要加强。' },
  '巨蟹座': { element: '水', traits: '温柔敏感、家庭至上、情感丰富', advice: '巨蟹座的朋友，你的温柔是你的力量，但也要学会保护自己。' },
  '狮子座': { element: '火', traits: '自信骄傲、热情大方、领导力强', advice: '狮子座的朋友，你的自信光芒四射，但也要学会倾听他人。' },
  '处女座': { element: '土', traits: '追求完美、细致谨慎、理性分析', advice: '处女座的朋友，你的细致是优点，但别让完美主义拖累了你。' },
  '天秤座': { element: '风', traits: '优雅公正、社交达人、犹豫不决', advice: '天秤座的朋友，你的平衡感很好，但做决定时别太纠结。' },
  '天蝎座': { element: '水', traits: '深沉神秘、意志坚定、直觉敏锐', advice: '天蝎座的朋友，你的直觉非常准，但也要学会适当放下。' },
  '射手座': { element: '火', traits: '乐观自由、热爱冒险、直言不讳', advice: '射手座的朋友，你的乐观感染着每个人，但也要注意分寸。' },
  '摩羯座': { element: '土', traits: '务实稳重、坚韧不拔、事业心强', advice: '摩羯座的朋友，你的毅力无人能及，但别忘了享受生活。' },
  '水瓶座': { element: '风', traits: '独立创新、理性冷静、思想前卫', advice: '水瓶座的朋友，你的创意独一无二，但也要关注情感交流。' },
  '双鱼座': { element: '水', traits: '浪漫梦幻、富有同情心、直觉力强', advice: '双鱼座的朋友，你的想象力是天赋，但也要脚踏实地。' }
};
// ============ 心情回复提示词 ============
const MOOD_PROMPTS = {
  '平静': { prefix: '你此刻内心平静，这是一个很好的占卜状态。', tone: '平和' },
  '快乐': { prefix: '你带着愉悦的心情来占卜，这份喜悦会吸引美好的能量！', tone: '欢快' },
  '焦虑': { prefix: '我能感受到你内心的不安，但请放心，塔罗牌会给你指引。', tone: '安抚' },
  '悲伤': { prefix: '看到你心情低落，我很难过。让塔罗牌给你一些温暖和力量吧。', tone: '温柔' },
  '愤怒': { prefix: '愤怒是正常的情绪，但别让它蒙蔽了你的判断。深呼吸，听听塔罗想对你说什么。', tone: '冷静' },
  '期待': { prefix: '你满怀期待的心情，宇宙已经感受到了！', tone: '积极' },
  '迷茫': { prefix: '迷茫的时候，正是塔罗牌最能帮到你的时刻。', tone: '指引' },
  '感恩': { prefix: '带着感恩之心占卜，你会收到宇宙最美的回馈。', tone: '温暖' }
};
// ============ 牌阵定义 ============
const SPREADS = {
  'body-mind-spirit': { name: '身·心·灵', positions: ['身体/物质', '心理/情感', '灵性/精神'] },
  'situation-obstacle-outcome': { name: '现状·阻碍·出路', positions: ['当前状况', '面临的阻碍', '可能的出路'] },
  'you-them-us': { name: '你·TA·我们', positions: ['你的状态', '对方的状态', '你们的关系'] },
  'yesterday-today-tomorrow': { name: '昨日·今日·明日', positions: ['过去的影响', '当下的力量', '未来的指引'] }
};
// ============ 解读风格 ============
const STYLES = {
  'friend': { name: '朋友闲聊', prompt: '用亲切随和、像朋友聊天一样的语气回复，可以用一些口语化的表达，比如"我跟你说啊"、"要我说啊"、"别担心"之类的。' },
  'mentor': { name: '人生导师', prompt: '用睿智深沉、充满哲理与智慧的语气回复，可以用一些富有诗意的表达，引用一些人生哲理，像一位智者一样给出指引。' },
  'sharp': { name: '犀利直给', prompt: '用一针见血、不绕弯子的语气回复，直接点出问题核心，用词可以犀利一些，但最终目的是帮助对方看清真相。' }
};
// ============ AI 解读 ============
async function generateAIReading(question, cards, style, mode, zodiac, mood) {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: TRUSTOKEN_API_KEY,
      baseURL: TRUSTOKEN_BASE_URL
    });
    const styleInfo = STYLES[style] || STYLES['friend'];
    const spreadInfo = SPREADS['body-mind-spirit'];
    const cardsInfo = cards.map((c, i) => {
      const pos = spreadInfo.positions[i] || `位置${i+1}`;
      const orientation = c.isUpright ? '正位' : '逆位';
      return `【${pos}】${c.name}（${orientation}）
- 关键词：${c.keywords}
- 元素：${c.element}
- 正位含义：${c.meaning_upright}
- 逆位含义：${c.meaning_reversed}`;
    }).join('\n\n');
    let zodiacInfo = '';
    if (zodiac && ZODIAC_TRAITS[zodiac]) {
      const z = ZODIAC_TRAITS[zodiac];
      zodiacInfo = `\n求问者星座：${zodiac}（元素：${z.element}，性格特点：${z.traits}）`;
    }
    let moodInfo = '';
    if (mood && MOOD_PROMPTS[mood]) {
      moodInfo = `\n求问者当前心情：${mood}（回复提示：${MOOD_PROMPTS[mood].prefix}，语气：${MOOD_PROMPTS[mood].tone}）`;
    }
    let systemPrompt = '';
    let userPrompt = '';
    if (mode === 'daily') {
      systemPrompt = `你是一位精通韦特塔罗的神秘占卜师。今天是${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}。
${styleInfo.prompt}
${moodInfo}
${zodiacInfo}
请根据抽到的塔罗牌，为用户生成一份今日运势解读。格式要求：
## 🔮 今日运势
【今日整体运势】简要描述今天的能量趋势
【今日幸运色】给出一个具体的颜色
【今日宜做】列出2-3件今天适合做的事情
【今日忌做】列出2-3件今天应该避免的事情
【温馨提示】一句简短的建议`;
      userPrompt = `求问者信息：${zodiacInfo}${moodInfo}
抽到的塔罗牌：
${cardsInfo}
请为这位求问者生成今日运势解读。`;
    } else if (mode === 'quick') {
      systemPrompt = `你是一位精通韦特塔罗的神秘占卜师。请用${styleInfo.prompt}
${moodInfo}
${zodiacInfo}
用简洁的一两句话直接回答用户的问题，不要长篇大论。`;
      userPrompt = `求问者的问题：${question}
求问者信息：${zodiac ? `星座：${zodiac}` : ''}${mood ? `，心情：${mood}` : ''}
抽到的塔罗牌：
${cardsInfo}
请用一两句话直接回答用户的问题。`;
    } else {
      systemPrompt = `你是一位精通韦特塔罗的神秘占卜师。请用${styleInfo.prompt}
${moodInfo}
${zodiacInfo}
请根据用户的问题和抽到的塔罗牌，给出详细的占卜解读。要求：
1. 每张牌都要结合用户的具体问题来分析，不能只复述牌意
2. 分析牌面元素（火水土风）与问题的关联
3. 给出具体的建议和指引
4. 结合用户的星座特性给出个性化建议
5. 根据用户的心情调整回复的语气`;
      userPrompt = `求问者的问题：${question}
求问者信息：${zodiac ? `星座：${zodiac}` : ''}${mood ? `，心情：${mood}` : ''}
抽到的塔罗牌：
${cardsInfo}
请针对求问者的问题，结合每张牌的含义和位置，给出详细的占卜解读。`;
    }
    const completion = await openai.chat.completions.create({
      model: TRUSTOKEN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.8
    });
    return completion.choices[0].message.content || '解读生成失败，请重试。';
  } catch (err) {
    console.error('AI解读失败:', err.message);
    throw new Error('AI解读服务暂时不可用，请稍后重试。');
  }
}
// ============ 占卜核心逻辑 ============
function generateCards(question, number, spread, ts) {
  const spreadInfo = SPREADS[spread] || SPREADS['body-mind-spirit'];
  const positions = spreadInfo.positions;
  const numCards = positions.length;
  const cards = [];
  const usedIds = new Set();
  const seed = number + (ts || Date.now());
  for (let i = 0; i < numCards; i++) {
    let cardIndex = (seed + i * 37) % 79 + 1;
    while (usedIds.has(cardIndex)) {
      cardIndex = (cardIndex + 13) % 79 + 1;
    }
    usedIds.add(cardIndex);
    const cardData = TAROT_CARDS.find(c => c.id === cardIndex);
    if (cardData) {
      const isUpright = (seed + i * 7) % 2 === 0;
      cards.push({
        id: cardData.id,
        name: cardData.name,
        type: cardData.type,
        suit: cardData.suit,
        element: cardData.element,
        keywords: cardData.keywords,
        meaning_upright: cardData.meaning_upright,
        meaning_reversed: cardData.meaning_reversed,
        isUpright,
        position: positions[i] || `位置${i + 1}`,
        photoFile: PHOTO_MAP[cardIndex] || ''
      });
    }
  }
  return cards;
}
// ============ 自测逻辑 ============
function runSelfTest() {
  const results = [];
  let passed = 0;
  let failed = 0;
  results.push({ test: '塔罗牌数据完整性', status: TAROT_CARDS.length === 78 ? 'PASS' : 'FAIL', detail: `共${TAROT_CARDS.length}张牌` });
  if (TAROT_CARDS.length === 78) passed++; else failed++;
  const allCardsHavePhoto = TAROT_CARDS.every(c => PHOTO_MAP[c.id]);
  results.push({ test: '图片映射完整性', status: allCardsHavePhoto ? 'PASS' : 'FAIL', detail: `78张牌均有对应图片` });
  if (allCardsHavePhoto) passed++; else failed++;
  const testCards = generateCards('测试问题', 42, 'body-mind-spirit', Date.now());
  results.push({ test: '占卜生成', status: testCards.length === 3 ? 'PASS' : 'FAIL', detail: `生成${testCards.length}张牌` });
  if (testCards.length === 3) passed++; else failed++;
  results.push({ test: '牌阵定义', status: Object.keys(SPREADS).length === 4 ? 'PASS' : 'FAIL', detail: `共${Object.keys(SPREADS).length}种牌阵` });
  if (Object.keys(SPREADS).length === 4) passed++; else failed++;
  results.push({ test: '解读风格', status: Object.keys(STYLES).length === 3 ? 'PASS' : 'FAIL', detail: `共${Object.keys(STYLES).length}种风格` });
  if (Object.keys(STYLES).length === 3) passed++; else failed++;
  results.push({ test: '星座特性', status: Object.keys(ZODIAC_TRAITS).length === 12 ? 'PASS' : 'FAIL', detail: `共${Object.keys(ZODIAC_TRAITS).length}个星座` });
  if (Object.keys(ZODIAC_TRAITS).length === 12) passed++; else failed++;
  results.push({ test: '心情提示词', status: Object.keys(MOOD_PROMPTS).length === 8 ? 'PASS' : 'FAIL', detail: `共${Object.keys(MOOD_PROMPTS).length}种心情` });
  if (Object.keys(MOOD_PROMPTS).length === 8) passed++; else failed++;
  const apiOK = TRUSTOKEN_API_KEY && TRUSTOKEN_API_KEY.length > 0;
  results.push({ test: 'API配置检查', status: apiOK ? 'PASS' : 'WARN', detail: apiOK ? '已配置API密钥' : '未配置API密钥' });
  if (apiOK) passed++; else failed++;
  const photosDir = path.join(__dirname, 'photos');
  let photoFiles = [];
  try { photoFiles = fs.readdirSync(photosDir); } catch(e) {}
  results.push({ test: '图片文件存在', status: photoFiles.length >= 78 ? 'PASS' : 'FAIL', detail: `photos目录下${photoFiles.length}个文件` });
  if (photoFiles.length >= 78) passed++; else failed++;
  return { results, passed, failed, total: results.length };
}
// ============ API 路由 ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.post('/api/reading', async (req, res) => {
  try {
    const { question, number, style, spread, mood, zodiac, ts, mode, selectedCards } = req.body;
    const num = parseInt(number) || Math.floor(Math.random() * 1000) + 1;
    let cards;
    if (selectedCards && selectedCards.length > 0) {
      cards = selectedCards;
    } else {
      cards = generateCards(question || '', num, spread || 'body-mind-spirit', ts || Date.now());
    }
    const reading = await generateAIReading(question || '', cards, style || 'friend', mode || 'detailed', zodiac || '', mood || '');
    res.json({
      success: true,
      cards: cards,
      reading: reading,
      style: style || 'friend',
      spread: spread || 'body-mind-spirit',
      mode: mode || 'detailed'
    });
  } catch (err) {
    console.error('占卜失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/test', (req, res) => {
  const testResult = runSelfTest();
  res.json({ success: true, ...testResult });
});
app.post('/api/download-report', (req, res) => {
  try {
    const { reading, cards, question, style, spread } = req.body;
    const styleName = STYLES[style]?.name || '默认';
    const spreadName = SPREADS[spread]?.name || '三张牌阵';
    const cardsHtml = (cards || []).map((c, i) => {
      const orientation = c.isUpright ? '正位' : '逆位';
      return `<tr><td>${c.position}</td><td>${c.name}</td><td>${orientation}</td><td>${c.keywords}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>🔮 灵犀智者 · 塔罗占卜报告</title>
<style>
body { font-family: 'Georgia', serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #0d001a; color: #e2d5f0; }
h1 { color: #c084fc; text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px; }
h2 { color: #a78bfa; margin-top: 30px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { border: 1px solid #4a1a6e; padding: 10px; text-align: left; }
th { background: #2d1b4e; color: #c084fc; }
.reading { background: #1a0a2e; border-left: 4px solid #7c3aed; padding: 20px; margin: 20px 0; line-height: 1.8; white-space: pre-wrap; }
.footer { text-align: center; margin-top: 40px; color: #6b4a8a; font-size: 0.9em; }
</style></head><body>
<h1>🔮 灵犀智者 · 塔罗占卜报告</h1>
<p style="text-align:center;color:#a78bfa;">解读风格：${styleName} | 牌阵：${spreadName}</p>
${question ? `<p style="text-align:center;color:#e2d5f0;">求问问题：${question}</p>` : ''}
<h2>📜 牌面信息</h2>
<table><thead><tr><th>位置</th><th>牌名</th><th>方位</th><th>关键词</th></tr></thead><tbody>${cardsHtml}</tbody></table>
<h2>🔮 占卜解读</h2>
<div class="reading">${reading}</div>
<div class="footer">
<p>🕯️ 占卜时间：${new Date().toLocaleString('zh-CN')}</p>
<p>✨ 灵犀智者 · 塔罗占卜 ✨</p>
<p>宇宙的智慧与你同在 🌙</p>
</div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename=tarot-reading-report.html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ============ 启动服务器 ============
if (process.argv.includes('--test')) {
  const testResult = runSelfTest();
  console.log('\n========== 🔮 灵犀智者 · 自测报告 ==========\n');
  testResult.results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${r.test}: ${r.detail}`);
  });
  console.log(`\n📊 总计: ${testResult.total} | ✅ 通过: ${testResult.passed} | ❌ 失败: ${testResult.failed} | ⚠️ 警告: ${testResult.total - testResult.passed - testResult.failed}`);
  console.log('\n============================================\n');
  process.exit(0);
} else {
  const server = app.listen(0, () => {
    console.log(JSON.stringify({
      "type": "http_start",
      "port": server.address().port
    }));
  });
  process.on("SIGINT", () => {
    console.log("Server shutdown complete");
    process.exit(0);
  });
}