
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptData, GeneratorMode, NewsItem, SocialPostData, PolishStyle, Scene } from "../types";

export const ERR_INVALID_KEY = "API_KEY_INVALID";

export const notifyApiUsage = () => {
  window.dispatchEvent(new CustomEvent('gemini-api-usage'));
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found.");
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const detectLanguage = (text: string): 'Thai' | 'English' => {
  return /[ก-๙]/.test(text) ? 'Thai' : 'English';
};

const withRetry = async <T>(operation: () => Promise<T>, retries = 3, initialDelay = 3000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await operation();
      notifyApiUsage();
      return result;
    } catch (error: any) {
      lastError = error;
      const msg = (error.message || "").toLowerCase();
      if (msg.includes('requested entity was not found')) {
        const keyErr = new Error("Invalid Key or Project.");
        (keyErr as any).code = ERR_INVALID_KEY;
        throw keyErr;
      }
      if (msg.includes('429') || msg.includes('quota') || msg.includes('limit')) {
        await wait(initialDelay * Math.pow(2, i));
        continue;
      }
      if (i < retries - 1) {
        await wait(initialDelay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const STYLE_DIRECTIVES: Record<string, string> = {
  'Cinematic': 'Master-level cinematography, 35mm anamorphic lens, deep chiaroscuro shadows, Rembrandt lighting, volumetric haze, floating dust motes, 8k raw texture detail, shallow depth of field (f/1.8), cinematic color grading (teal and orange hints), epic scale, immersive atmosphere.',
  'Anime': 'Makoto Shinkai style, vibrant cel-shaded, expressive line art, stylized sky with fluffy clouds, saturated colors, hand-drawn aesthetic, high-quality modern anime.',
  'Cyberpunk': 'Neon noir, rainy streets with neon reflections, high contrast, volumetric fog, chromatic aberration, futuristic night city, aggressive teal and orange palette.',
  'Horror': 'Chiaroscuro lighting, heavy film grain, desaturated colors, eerie atmosphere, shadow play, unsettling micro-details, low-key lighting, suspenseful cinematic mood.',
  'Documentary': 'Naturalistic lighting, macro photography, realistic organic textures, neutral color palette, clean framing, high-fidelity details, authentic material realism.'
};

const augmentPromptWithStyle = (prompt: string, style: string) => {
  const directive = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES['Cinematic'];
  return `${prompt}. Technical Artistic Direction: ${directive}`;
};

const safeParseJson = (text: string) => {
  try {
    let cleanText = text.trim();
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    return JSON.parse(cleanText);
  } catch (e) {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(text.substring(start, end + 1));
      }
    } catch (e2) {}
    throw new Error("AI generated invalid JSON. Please try again.");
  }
};

/**
 * Universal Script Generator
 */
export const generateScript = async (
  topic: string,
  mode: GeneratorMode,
  aspectRatio: '9:16' | '16:9',
  languageOverride?: 'Thai' | 'English',
  durationMinutes: number = 1,
  visualModel?: string,
  style: string = 'Cinematic',
  textModel: string = 'gemini-3-flash-preview'
): Promise<ScriptData> => {
  if (mode === GeneratorMode.LONG_VIDEO) {
    return generateLongVideoScript(topic, '16:9', languageOverride, durationMinutes, style, textModel);
  }
  return generateShortsScript(topic, mode, aspectRatio, languageOverride, style, textModel);
};

/**
 * Specialized Script Generator for Shorts (Concise & Viral)
 */
export const generateShortsScript = async (
  topic: string, 
  mode: GeneratorMode, 
  aspectRatio: '9:16' | '16:9',
  languageOverride?: 'Thai' | 'English',
  style: string = 'Cinematic',
  textModel: string = 'gemini-3-flash-preview'
): Promise<ScriptData> => {
  return withRetry(async () => {
    const ai = getClient();
    const styleDirectives = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES['Cinematic'];
    
    // STRICT: Detect language from topic to ensure mirroring
    const detectedLang = detectLanguage(topic);
    const targetLang = (detectedLang === 'English') ? 'English' : (languageOverride || 'Thai');
    
    const systemInstruction = `You are a Professional Viral Content Creator.
    STRICT LANGUAGE POLICY:
    - YOU MUST MIRROR THE LANGUAGE OF THE TOPIC.
    - TOPIC: "${topic}"
    - If the topic is in ENGLISH, the 'voiceover', 'title', and 'description' MUST be in ENGLISH.
    - If the topic is in THAI, the 'voiceover', 'title', and 'description' MUST be in THAI.
    - NEVER mix languages. If the user input is English, do not respond in Thai.
    - The ONLY field that MUST remain in English is 'visual_prompt'.

    CONTENT STYLE: ${style}.
    VISUAL DNA: ${styleDirectives}.

    PRODUCTION RULES:
    1. Hook the audience in the first 3 seconds.
    2. EXACTLY 5 SCENES.
    3. MAX 15 words per scene voiceover for fast-paced viral retention.`;

    const response = await ai.models.generateContent({
      model: textModel as any,
      contents: `Generate a script in ${targetLang} about: "${topic}". Remember, if the topic is English, keep the script English.`,
      config: { 
        systemInstruction, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            seoTitle: { type: Type.STRING },
            description: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenes: {
              type: Type.ARRAY,
              minItems: 5, maxItems: 5,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  visual_prompt: { type: Type.STRING },
                  voiceover: { type: Type.STRING },
                  duration_est: { type: Type.NUMBER }
                },
                required: ["id", "visual_prompt", "voiceover", "duration_est"]
              }
            }
          },
          required: ["title", "seoTitle", "scenes"]
        }
      }
    });

    const data = safeParseJson(response.text || '{}');
    return { ...data, scenes: (data.scenes || []).map((s: any) => ({ ...s, status: 'pending' })) };
  });
};

/**
 * Specialized Script Generator for Long Video (In-depth & Educational)
 */
export const generateLongVideoScript = async (
  topic: string, 
  aspectRatio: '16:9',
  languageOverride?: 'Thai' | 'English',
  durationMinutes: number = 10,
  style: string = 'Cinematic',
  textModel: string = 'gemini-3-pro-preview' // แนะนำรุ่น Pro เพื่อความฉลาด
): Promise<ScriptData> => {
  return withRetry(async () => {
    const ai = getClient();
    const styleDirectives = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES['Cinematic'];
    
    // คำนวณเป้าหมายจำนวนคำ (พูดปกติ ~140 คำ/นาที)
    const targetWordCount = durationMinutes * 140; 
    
    const detectedLang = detectLanguage(topic);
    const targetLang = (detectedLang === 'English') ? 'English' : (languageOverride || 'Thai');
    
    // 🔥 PROMPT ที่อัปเกรดแล้วสำหรับสาย DEEP DIVE
    const systemInstruction = `You are a World-Class Documentary Filmmaker and Subject Matter Expert (History/Science/Tech).
    
    YOUR GOAL: Create a "Deep Dive" video script (Video Essay style).
    
    STRICT LANGUAGE POLICY:
    - TOPIC: "${topic}"
    - TARGET LANGUAGE: ${targetLang} (Must output in this language only).
    - 'visual_prompt' MUST remain in English (Technical description).

    CONTENT DEPTH GUIDELINES (CRITICAL):
    1. NO FLUFF: Avoid generic phrases like "In today's video..." or "Let's dive in." Start with a hook.
    2. FACT-DENSE: Every paragraph must contain specific dates, names, statistics, or scientific principles.
    3. NUANCE: Do not just state facts; explain the *implications*, *causes*, and *effects*.
    4. UNKNOWN DETAILS: Include trivia or insights that the average person doesn't know.
    5. STRUCTURE: 
       - Hook (Mystery/Paradox)
       - Historical/Contextual Background
       - The Core Analysis (The "Meat" of the video)
       - Addressing Misconceptions
       - Profound Conclusion
    
    ARTISTIC DIRECTION: ${style}.
    TECHNICAL SPECS: ${styleDirectives}.`;

    const response = await ai.models.generateContent({
      model: textModel as any,
      contents: `Generate a highly detailed, educational documentary script about: "${topic}".
      
      PARAMETERS:
      - Duration: ${durationMinutes} Minutes.
      - Target Word Count: Approximately ${targetWordCount} words (Make the script long and detailed to fit the time).
      - Tone: Intellectual, Authoritative, yet Engaging (Like 'Lemmino' or 'Veritasium').
      
      Provide 10 to 30 sequential scenes covering the topic in extreme depth.`,
      config: { 
        systemInstruction, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            seoTitle: { type: Type.STRING },
            longDescription: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenes: {
              type: Type.ARRAY,
              minItems: 10, 
              maxItems: 40, // เพิ่ม Max items เพราะบทยาวขึ้น
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  visual_prompt: { type: Type.STRING },
                  voiceover: { type: Type.STRING }, // AI จะพยายามเขียนให้ยาวขึ้นตรงนี้
                  duration_est: { type: Type.NUMBER }
                },
                required: ["id", "visual_prompt", "voiceover", "duration_est"]
              }
            }
          },
          required: ["title", "seoTitle", "scenes"]
        }
      }
    });

    const data = safeParseJson(response.text || '{}');
    return { ...data, scenes: (data.scenes || []).map((s: any) => ({ ...s, status: 'pending' })) };
  });
};

export const refineVisualPrompt = async (topic: string, style: string, voiceover: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getClient();
    const styleDirectives = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES['Cinematic'];
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Director of Photography. Enhance this scene concept into a professional 8K cinematic visual prompt in English.
      
      Scene Context: ${voiceover}
      Base Topic: ${topic}
      Technical Directives: ${styleDirectives}
      
      OUTPUT: One dense English paragraph describing lighting physics, camera lens (e.g. 35mm), specific angles, and atmospheric elements (haze, dust motes). Do not include conversational filler.`,
    });
    return response.text || "";
  });
};

/**
 * Bulk generate narratively consistent storyboards for multiple scenes.
 */
export const generateStoryboards = async (topic: string, style: string, scenes: {id: number, voiceover: string}[]): Promise<Record<number, string>> => {
  return withRetry(async () => {
    const ai = getClient();
    const styleDirectives = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES['Cinematic'];
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the Lead Concept Artist. Generate visually consistent English storyboard prompts for this narrative sequence.
      
      Topic: ${topic}
      Visual DNA: ${styleDirectives}
      
      Timeline:
      ${scenes.map(s => `ID ${s.id}: ${s.voiceover}`).join('\n')}
      
      TASK: Produce a hyper-descriptive cinematic prompt for each ID. Ensure visual continuity in lighting and environment.
      Return ONLY valid JSON: {"storyboards": [{"id": number, "prompt": string}]}`,
      config: { responseMimeType: "application/json" }
    });
    const data = safeParseJson(response.text || '{}');
    const result: Record<number, string> = {};
    (data.storyboards || []).forEach((item: any) => {
      result[item.id] = item.prompt;
    });
    return result;
  });
};

// ในไฟล์ geminiService.ts

export const generateSeoMetadata = async (topic: string, title: string, description: string): Promise<{ hashtags: string[], seoKeywords: string }> => {
  return withRetry(async () => {
    // อย่าลืมส่ง apiKey เข้ามาใน getClient() ถ้าคุณแก้ตามสเต็ปก่อนหน้า
    const ai = getClient(); 
    const lang = detectLanguage(topic);
    
    // 🔥 แก้ Prompt ตรงนี้: สั่งขอ 40-50 Tags แบบเน้นๆ
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // หรือ gemini-3-flash-preview
      contents: `You are a YouTube SEO Expert. 
      Generate a MASSIVE list of viral metadata in ${lang} for: "${topic}"
      Context Title: "${title}"
      
      REQUIREMENTS:
      1. hashtags: Generate exactly 40-50 high-volume viral hashtags. Mix broad (e.g. #fyp) and specific niche tags.
      2. seoKeywords: Generate 50 comma-separated semantic keywords for the video tags section.
      
      Output JSON only.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            seoKeywords: { type: Type.STRING }
          }
        }
      }
    });
    return safeParseJson(response.text || '{}');
  });
};

export const generateVoiceover = async (text: string, voiceName: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  });
};

export const generateVideoForScene = async (
  prompt: string, 
  aspectRatio: '16:9' | '9:16', 
  model: string = 'veo-3.1-fast-generate-preview', 
  style: string = 'Cinematic',
  onProgress?: (pollingCount: number) => void
): Promise<string> => {
  return withRetry(async () => {
    const ai = getClient();
    const augmentedPrompt = augmentPromptWithStyle(prompt, style);
    const operation = await ai.models.generateVideos({
      model: model as any,
      prompt: augmentedPrompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });
    let op = operation;
    let pollCount = 0;
    while (!op.done) {
      pollCount++;
      onProgress?.(pollCount);
      await wait(8000);
      op = await ai.operations.getVideosOperation({ operation: op });
    }
    return `${op.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`;
  });
};

export const generateImageForScene = async (prompt: string, model: string = 'gemini-2.5-flash-image', aspectRatio: string = '9:16', style: string = 'Cinematic'): Promise<string> => {
  return withRetry(async () => {
    const ai = getClient();
    const augmentedPrompt = augmentPromptWithStyle(prompt, style);
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: augmentedPrompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio as any } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image error");
  });
};

export const fetchTrendingNews = async (region: string, category: string, searchQuery: string = ''): Promise<NewsItem[]> => {
  return withRetry(async () => {
    const ai = getClient();
    const lang = region === 'thailand' ? 'Thai' : 'English';
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for 6 viral news stories in ${region}. Category: ${category}. Query: ${searchQuery}. Language: ${lang}.`,
      config: { 
        tools: [{ googleSearch: {} }], 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              category: { type: Type.STRING },
              virality_score: { type: Type.NUMBER },
              velocity: { type: Type.STRING },
              est_reach: { type: Type.STRING },
              source: { type: Type.STRING }
            },
            required: ["headline", "summary", "category"]
          }
        }
      }
    });
    
    const news = safeParseJson(response.text || '[]');
    return news.map((item: any, idx: number) => ({
      ...item,
      id: `news-${idx}-${Date.now()}`
    }));
  });
};

export const generateThumbnail = async (title: string, topic: string, style: string = 'Cinematic'): Promise<string> => {
  return generateImageForScene(`Viral high-impact YouTube thumbnail. Topic: ${topic}. Hook: ${title}. High-contrast, clickable graphic design.`, 'gemini-2.5-flash-image', '16:9', style);
};

export const generatePodcastAudio = async (text: string, voiceA: string, voiceB: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Speaker 1', voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } } },
              { speaker: 'Speaker 2', voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } } }
            ]
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  });
};

export const summarizeScript = async (script: ScriptData): Promise<string[]> => {
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize this script into clear, engaging bullet points. JSON format {bullets:[]}. Script context: ${script.scenes.map(s => s.voiceover).join("\n")}`,
      config: { responseMimeType: "application/json" }
    });
    return safeParseJson(response.text || '{}').bullets || [];
  });
};

export const generateSocialPost = async (topic: string, platform: string, lang: string): Promise<SocialPostData> => {
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a high-engagement ${platform} post for ${topic} in ${lang}. Format: JSON {caption:"", hashtags:[], image_prompt:""}`,
      config: { responseMimeType: "application/json" }
    });
    return safeParseJson(response.text || '{}');
  });
};
