const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ============================================================
// 🔑 قراءة المفاتيح من .env لكل مزود
// ============================================================
function getKeys(prefix, count) {
    const keys = [];
    for (let i = 1; i <= count; i++) {
        const key = process.env[`${prefix}_${i}`];
        if (key && key.trim() !== '') keys.push(key);
    }
    return keys;
}

const GEMINI_KEYS = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
const GROQ_KEYS = getKeys('GROQ_API_KEY', 6);
const OPENROUTER_KEYS = getKeys('OPENROUTER_API_KEY', 6);
const CEREBRAS_KEYS = getKeys('CEREBRAS_API_KEY', 6);
const SAMBANOVA_KEYS = getKeys('SAMBANOVA_API_KEY', 3);
const TOGETHER_KEYS = getKeys('TOGETHER_API_KEY', 2);

// ============================================================
// 📋 نماذج OpenRouter المجانية (الـ 12 نموذج)
// ============================================================
const OPENROUTER_MODELS = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "poolside/laguna-xs-2.1:free",
    "poolside/laguna-s-2.1:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "openai/gpt-oss-20b:free",
    "cohere/north-mini-code:free",
    "inclusionai/ling-3.0-flash:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
];

// ============================================================
// 🧠 تذكر آخر مفتاح ناجح لكل مزود (في الذاكرة)
// ============================================================
const lastSuccess = {};

function getLastKey(providerId) {
    return lastSuccess[providerId] || 0;
}

function setLastKey(providerId, keyIndex) {
    lastSuccess[providerId] = keyIndex;
}

// ============================================================
// 📚 معرفة الموقع (سياق النظام)
// ============================================================
const SITE_KNOWLEDGE = `
منصة Zertiva B2: امتحانات Goethe B2 (Lesen, Hören, Sprachbausteine, Schreiben, Mündlich).
مميزات: تصحيح تلقائي، تلوين ذكي، لعبة سريعة، Memory Trainer.
`;

// ============================================================
// 📝 System Prompt شديد الصرامة
// ============================================================
function getSystemPrompt(question) {
    const siteKeywords = ['موقع', 'منصة', 'المميزات', 'امتحانات', 'المهارات', 'Goethe', 'B2'];
    const isSiteQuestion = siteKeywords.some(keyword => question.includes(keyword));
    
    let base = `أنت مساعد Zertiva B2.

قواعد إلزامية صارمة جداً (يجب تطبيقها حرفياً):
1. لا تكتب أي تحليل أو مقدمة أو شرح لتفكيرك.
2. لا تقل "The user", "The sentence", "Analysis"، إلخ.
3. إذا كان السؤال ترجمة، أعد الترجمة فقط دون أي كلمة إضافية.
4. إذا كان السؤال معلوماتياً، أجب بجملة واحدة مختصرة جداً.
5. الحد الأقصى للرد هو سطرين فقط.`;

    if (isSiteQuestion) {
        base += `\nمعرفتك بالموقع: ${SITE_KNOWLEDGE}`;
    }
    return base;
}

// ============================================================
// 🧹 دالة تنقية الرد (صارمة جداً)
// ============================================================
function cleanReply(reply) {
    if (!reply) return '';

    // 1. تقسيم إلى أسطر
    let lines = reply.split('\n');
    const filteredLines = [];

    // قائمة العبارات الممنوعة (يتم حذف السطر بالكامل إذا بدأ بها)
    const blacklist = [
        'the user', 'the sentence', 'analysis', 'reasoning',
        'sure!', 'certainly', 'here is', 'thinking', 'explanation',
        'translation of', 'i am', 'i will', 'let me', 'the meaning',
        'يطلب المستخدم', 'الجملة تعني', 'التحليل', 'سأقوم', 'سأترجم'
    ];

    for (let line of lines) {
        const trimmed = line.trim().toLowerCase();
        // تجاهل الأسطر الفارغة
        if (!trimmed) continue;
        
        // تجاهل الأسطر التي تبدأ بعبارة ممنوعة
        let isBlocked = false;
        for (const word of blacklist) {
            if (trimmed.startsWith(word)) {
                isBlocked = true;
                break;
            }
        }
        if (!isBlocked) {
            filteredLines.push(line.trim());
        }
    }

    // 2. إذا أصبح الرد فارغاً، نعيد الرد الأصلي (احتياطي) لكن نقصه
    if (filteredLines.length === 0) {
        // نأخذ أول سطر من الرد الأصلي
        const firstLine = reply.split('\n')[0]?.trim() || reply.trim();
        if (firstLine) {
            // نحاول إزالة أي عبارات ممنوعة من بداية السطر
            let cleaned = firstLine;
            for (const word of blacklist) {
                if (cleaned.toLowerCase().startsWith(word)) {
                    cleaned = cleaned.substring(word.length).trim();
                    // إزالة النقطتين أو الشرطة إن وجدت
                    cleaned = cleaned.replace(/^[:;,\-]\s*/, '');
                    break;
                }
            }
            return cleaned.substring(0, 200);
        }
        return '';
    }

    // 3. قص إلى أول سطرين فقط
    let finalReply = filteredLines.slice(0, 2).join('\n').trim();

    // 4. تحديد الحد الأقصى للحروف (200 حرف)
    if (finalReply.length > 200) {
        finalReply = finalReply.substring(0, 200) + '...';
    }

    return finalReply;
}

// ============================================================
// 💾 نظام Cache بسيط
// ============================================================
const cache = new Map();
const CACHE_TTL = 3600000; // ساعة

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) cache.delete(key);
    }
    console.log(`🧹 تم تنظيف الـ Cache. الحجم: ${cache.size}`);
}, 3600000);

// ============================================================
// ⚙️ دوال استدعاء كل مزود (بدون تغيير)
// ============================================================
async function callGemini(prompt, systemMsg, key, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemMsg}\n\n${prompt}` }] }],
                generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.candidates?.length) return data.candidates[0].content.parts[0].text;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function callGroq(prompt, systemMsg, key, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: 'mixtral-8x7b-32768',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.3
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.choices?.length) return data.choices[0].message.content;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function callOpenRouter(prompt, systemMsg, key, model, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://zertivab2.online/'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.3
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.choices?.length) return data.choices[0].message.content;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function callCerebras(prompt, systemMsg, key, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: 'gpt-oss-120b',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.3
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.choices?.length) return data.choices[0].message.content;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function callSambaNova(prompt, systemMsg, key, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch('https://api.sambanova.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: 'Meta-Llama-3.1-8B-Instruct',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.3
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.choices?.length) return data.choices[0].message.content;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function callTogether(prompt, systemMsg, key, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch('https://api.together.xyz/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
                model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.3
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.choices?.length) return data.choices[0].message.content;
        throw new Error('Empty response');
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

// ============================================================
// 🧠 تجميع المزودات
// ============================================================
const PROVIDERS = [
    { id: 'gemini', name: 'Gemini', keys: GEMINI_KEYS, call: callGemini },
    { id: 'groq', name: 'Groq', keys: GROQ_KEYS, call: callGroq },
    { id: 'openrouter', name: 'OpenRouter', keys: OPENROUTER_KEYS, call: callOpenRouter, models: OPENROUTER_MODELS },
    { id: 'cerebras', name: 'Cerebras', keys: CEREBRAS_KEYS, call: callCerebras },
    { id: 'sambanova', name: 'SambaNova', keys: SAMBANOVA_KEYS, call: callSambaNova },
    { id: 'together', name: 'Together AI', keys: TOGETHER_KEYS, call: callTogether }
];

const activeProviders = PROVIDERS.filter(p => p.keys?.length > 0);

// ============================================================
// 🚀 دالة استدعاء AI (مع التنقل بين نماذج OpenRouter)
// ============================================================
async function callAI(prompt, question) {
    const systemMsg = getSystemPrompt(question);
    let lastError = null;

    for (let pIdx = 0; pIdx < activeProviders.length; pIdx++) {
        const provider = activeProviders[pIdx];
        const keys = provider.keys;
        const startKeyIndex = getLastKey(provider.id) % keys.length;

        // 🔥 بالنسبة لـ OpenRouter، نكرر النماذج أيضاً
        const modelsToTry = (provider.id === 'openrouter' && provider.models) ? provider.models : ['default'];

        for (let k = 0; k < keys.length; k++) {
            const keyIndex = (startKeyIndex + k) % keys.length;
            const key = keys[keyIndex];

            for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
                const model = modelsToTry[mIdx];
                try {
                    console.log(`🔄 محاولة ${provider.name} | Key ${keyIndex + 1} | Model ${mIdx + 1}/${modelsToTry.length}`);
                    let reply;
                    if (provider.id === 'openrouter') {
                        reply = await provider.call(prompt, systemMsg, key, model);
                    } else {
                        reply = await provider.call(prompt, systemMsg, key);
                    }
                    console.log(`✅ ${provider.name} نجح!`);
                    setLastKey(provider.id, keyIndex);
                    return { reply, provider: provider.name };
                } catch (error) {
                    const msg = error.message || '';
                    const isFailure = msg.includes('401') || msg.includes('403') || msg.includes('429') ||
                                      msg.includes('quota') || msg.includes('rate limit') || msg.includes('credits') ||
                                      msg.includes('expired') || msg.includes('timeout') || msg.includes('network') ||
                                      msg.includes('503') || msg.includes('502') || msg.includes('500') ||
                                      msg.includes('model unavailable') || msg.includes('overloaded') ||
                                      msg.includes('no endpoints');

                    if (isFailure) {
                        console.warn(`❌ ${provider.name} (Model: ${model}) فشل: ${error.message}`);
                    } else {
                        console.warn(`⚠️ ${provider.name} (Model: ${model}) خطأ غير متوقع: ${error.message}`);
                    }
                    lastError = error;
                    // استمر في تجربة النموذج التالي أو المفتاح التالي
                }
            }
        }
        console.warn(`⏭️ انتهت جميع محاولات ${provider.name}، ننتقل إلى المزود التالي`);
    }
    throw new Error('جميع المزودات والنماذج غير متاحة حالياً');
}

// ============================================================
// 🌐 نقطة النهاية /ask
// ============================================================
app.post('/ask', async (req, res) => {
    const { question, context } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'السؤال مطلوب' });
    }

    const cacheKey = question + (context || '');
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('✅ رد من الـ Cache');
            return res.json({ reply: cached.reply, provider: cached.provider || 'cache' });
        } else {
            cache.delete(cacheKey);
        }
    }

    const prompt = `
السياق (الفقرة الحالية): "${context || 'لا يوجد سياق'}"
سؤال الطالب: "${question}"

تعليمات إضافية صارمة جداً:
- أجب مباشرة فقط، بدون تحليل أو شرح.
- إذا كانت ترجمة، أعد الترجمة فقط.
- إذا كان سؤالاً معلوماتياً، أجب بجملة واحدة مختصرة.
- الحد الأقصى: سطرين فقط.`;

    try {
        const result = await callAI(prompt, question);
        let cleanedReply = cleanReply(result.reply);
        if (!cleanedReply || cleanedReply.trim().length === 0) {
            cleanedReply = result.reply || 'لم أستطع فهم السؤال. حاول مرة أخرى.';
        }
        cache.set(cacheKey, {
            reply: cleanedReply,
            provider: result.provider,
            timestamp: Date.now()
        });
        res.json({ reply: cleanedReply, provider: result.provider });
    } catch (error) {
        console.error('❌ فشل جميع المزودات:', error.message);
        res.status(503).json({
            reply: 'تعذر الحصول على الرد حالياً. يرجى المحاولة مرة أخرى بعد قليل.',
            provider: 'none'
        });
    }
});

// ============================================================
// 🏥 نقطة نهاية للصحة
// ============================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        gemini: GEMINI_KEYS.length > 0 ? '✅' : '❌',
        groq: GROQ_KEYS.length,
        openrouter: OPENROUTER_KEYS.length,
        openrouter_models: OPENROUTER_MODELS.length,
        cerebras: CEREBRAS_KEYS.length,
        sambanova: SAMBANOVA_KEYS.length,
        together: TOGETHER_KEYS.length,
        port: PORT
    });
});

app.listen(PORT, () => {
    console.log(`🚀 الخادم شغال على http://localhost:${PORT}`);
    console.log(`📊 Gemini: ${GEMINI_KEYS.length > 0 ? '✅' : '❌'}`);
    console.log(`📊 Groq: ${GROQ_KEYS.length} مفاتيح`);
    console.log(`📊 OpenRouter: ${OPENROUTER_KEYS.length} مفاتيح, ${OPENROUTER_MODELS.length} نموذج`);
    console.log(`📊 Cerebras: ${CEREBRAS_KEYS.length} مفاتيح`);
    console.log(`📊 SambaNova: ${SAMBANOVA_KEYS.length} مفاتيح`);
    console.log(`📊 Together AI: ${TOGETHER_KEYS.length} مفاتيح`);
});
