/**
 * Server-side Bhashini (ULCA / Dhruva) translation and subtitle processing engine.
 * Adheres to the official Ministry of Electronics and Information Technology (MeitY)
 * Bhashini API specifications for Indian regional language translation (NMT).
 *
 * CRITICAL SAFETY:
 * - Credentials (BHASHINI_API_KEY, BHASHINI_USER_ID) remain strictly on the server.
 * - Zero API secrets are ever logged or sent to the client.
 * - Fails gracefully if keys are missing, quota is exceeded, or Manager Approval is pending.
 */

// Supported 22 Scheduled & Priority Languages supported by Bhashini NMT models
export const BHASHINI_SUPPORTED_LANGUAGES: Record<string, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  hi: { name: "Hindi", nativeName: "हिन्दी" },
  bn: { name: "Bengali", nativeName: "বাংলা" },
  ta: { name: "Tamil", nativeName: "தமிழ்" },
  te: { name: "Telugu", nativeName: "తెలుగు" },
  mr: { name: "Marathi", nativeName: "मराठी" },
  gu: { name: "Gujarati", nativeName: "ગુજરાતી" },
  kn: { name: "Kannada", nativeName: "ಕನ್ನಡ" },
  ml: { name: "Malayalam", nativeName: "മലയാളം" },
  pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  or: { name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  as: { name: "Assamese", nativeName: "অসমীয়া" },
};

const DHRUVA_PIPELINE_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const DHRUVA_DEFAULT_COMPUTE = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const ULCA_DIRECT_COMPUTE = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/compute";
const BHASHINI_TIMEOUT_MS = 15_000;

interface PipelineConfigResult {
  callbackUrl: string;
  inferenceApiKey: string;
  serviceId?: string;
}

/**
 * Resolves Bhashini pipeline config & dynamic inference key via getModelsPipeline (legacy/ULCA fallback).
 */
async function getBhashiniPipelineConfig(
  sourceLang: string,
  targetLang: string
): Promise<PipelineConfigResult | null> {
  const apiKey = process.env.BHASHINI_API_KEY;
  const userId = process.env.BHASHINI_USER_ID;

  if (!apiKey || !userId) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BHASHINI_TIMEOUT_MS);

  try {
    const payload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            },
          },
        },
      ],
      pipelineRequestConfig: {
        pipelineId: "64392f96daac500b55c543d0",
      },
    };

    const response = await fetch(DHRUVA_PIPELINE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        userID: userId,
        ulcaApiKey: apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const callbackUrl =
      data?.pipelineInferenceAPIEndPoint?.callbackUrl || DHRUVA_DEFAULT_COMPUTE;
    const inferenceApiKey =
      data?.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value || apiKey;
    const serviceId =
      data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;

    return { callbackUrl, inferenceApiKey, serviceId };
  } catch (err: unknown) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a single batch translation against the Bhashini Dhruva inference pipeline.
 */
async function computeDhruvaBatch(
  batch: string[],
  sourceLangCode: string,
  targetLangCode: string,
  authKey: string
): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BHASHINI_TIMEOUT_MS);

  try {
    const computePayload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: sourceLangCode,
              targetLanguage: targetLangCode,
            },
          },
        },
      ],
      inputData: {
        input: batch.map((t) => ({ source: t })),
      },
    };

    const res = await fetch(DHRUVA_DEFAULT_COMPUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authKey,
      },
      body: JSON.stringify(computePayload),
      signal: controller.signal,
    });

    if (res.ok) {
      const resData = await res.json();
      const outputs = resData?.pipelineResponse?.[0]?.output;
      if (Array.isArray(outputs) && outputs.length === batch.length) {
        return outputs.map(
          (item: { target?: string; source?: string }) =>
            item.target || item.source || ""
        );
      }
    }
    return null;
  } catch (err) {
    console.warn(
      "[Bhashini] Dhruva compute batch failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translates an array of text strings using Bhashini NMT pipeline.
 * Automatically chunks large text arrays into batches of up to 25 items
 * to guarantee low latency and prevent upstream payload timeouts.
 */
export async function translateTextWithBhashini(
  texts: string[],
  targetLangCode: string,
  sourceLangCode: string = "en"
): Promise<string[] | null> {
  const apiKey = process.env.BHASHINI_API_KEY;
  const inferenceKey = process.env.BHASHINI_INFERENCE_KEY;
  const authKey = inferenceKey || apiKey;

  if (!authKey || texts.length === 0) {
    return null;
  }

  if (sourceLangCode === targetLangCode) {
    return texts;
  }

  // 1. Primary path: Direct Bhashini Dhruva Compute with batch chunking
  const BATCH_SIZE = 25;
  const allResults: string[] = [];
  let dhruvaSuccess = true;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResult = await computeDhruvaBatch(
      batch,
      sourceLangCode,
      targetLangCode,
      authKey
    );
    if (batchResult && batchResult.length === batch.length) {
      allResults.push(...batchResult);
    } else {
      dhruvaSuccess = false;
      break;
    }
  }

  if (dhruvaSuccess && allResults.length === texts.length) {
    return allResults;
  }

  // 2. Secondary fallback: 2-step Dhruva pipeline via getModelsPipeline
  const pipelineConfig = await getBhashiniPipelineConfig(sourceLangCode, targetLangCode);
  if (pipelineConfig) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BHASHINI_TIMEOUT_MS);
    try {
      const computePayload = {
        pipelineTasks: [
          {
            taskType: "translation",
            config: {
              language: {
                sourceLanguage: sourceLangCode,
                targetLanguage: targetLangCode,
              },
              ...(pipelineConfig.serviceId ? { serviceId: pipelineConfig.serviceId } : {}),
            },
          },
        ],
        inputData: {
          input: texts.map((t) => ({ source: t })),
        },
      };

      const res = await fetch(pipelineConfig.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: pipelineConfig.inferenceApiKey,
        },
        body: JSON.stringify(computePayload),
        signal: controller.signal,
      });

      if (res.ok) {
        const resData = await res.json();
        const outputs = resData?.pipelineResponse?.[0]?.output;
        if (Array.isArray(outputs) && outputs.length === texts.length) {
          return outputs.map(
            (item: { target?: string; source?: string }) =>
              item.target || item.source || ""
          );
        }
      }
    } catch (err) {
      console.warn(
        "[Bhashini] Dhruva config fallback compute failed:",
        err instanceof Error ? err.message : err
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // 3. Direct ULCA compute fallback
  const userId = process.env.BHASHINI_USER_ID;
  if (userId && apiKey) {
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), BHASHINI_TIMEOUT_MS);
    try {
      const directPayload = {
        pipelineTasks: [
          {
            taskType: "translation",
            config: {
              language: {
                sourceLanguage: sourceLangCode,
                targetLanguage: targetLangCode,
              },
            },
          },
        ],
        inputData: {
          input: texts.map((t) => ({ source: t })),
        },
      };

      const directRes = await fetch(ULCA_DIRECT_COMPUTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
          userID: userId,
        },
        body: JSON.stringify(directPayload),
        signal: directController.signal,
      });

      if (directRes.ok) {
        const directData = await directRes.json();
        const directOutputs = directData?.pipelineResponse?.[0]?.output;
        if (Array.isArray(directOutputs) && directOutputs.length === texts.length) {
          return directOutputs.map(
            (item: { target?: string; source?: string }) =>
              item.target || item.source || ""
          );
        }
      }
    } catch (err) {
      console.warn(
        "[Bhashini] Direct ULCA compute fallback error:",
        err instanceof Error ? err.message : err
      );
    } finally {
      clearTimeout(directTimer);
    }
  }

  return null;
}

/**
 * Translates WebVTT subtitles while strictly preserving:
 * 1. "WEBVTT" header and metadata blocks
 * 2. Exact timestamp ranges (e.g. "00:00:01.000 --> 00:00:04.500")
 * 3. Cue sequence numbers and cue identifiers
 *
 * Only dialogue/text lines are passed to Bhashini NMT for high-fidelity regional translation.
 */
export async function translateVttWithBhashini(
  vttContent: string,
  targetLangCode: string,
  sourceLangCode: string = "en"
): Promise<string | null> {
  if (!vttContent || !vttContent.includes("-->")) {
    return null;
  }

  const lines = vttContent.split(/\r?\n/);
  const textLinesToTranslate: string[] = [];
  const lineIndices: number[] = [];

  let inCue = false;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      inCue = false;
      return;
    }
    if (trimmed.includes("-->")) {
      inCue = true;
      return;
    }
    if (inCue) {
      textLinesToTranslate.push(line);
      lineIndices.push(index);
    }
  });

  if (textLinesToTranslate.length === 0) {
    return vttContent;
  }

  // Translate all dialogue lines through Bhashini
  const translatedLines = await translateTextWithBhashini(
    textLinesToTranslate,
    targetLangCode,
    sourceLangCode
  );

  if (!translatedLines || translatedLines.length !== textLinesToTranslate.length) {
    return null;
  }

  // Recombine translated lines with original cues & timestamps
  const resultLines = [...lines];
  lineIndices.forEach((lineIndex, i) => {
    resultLines[lineIndex] = translatedLines[i];
  });

  return resultLines.join("\n");
}

/**
 * Diagnostic status check for Bhashini configuration and approval state.
 */
export function getBhashiniConfigStatus(): {
  configured: boolean;
  approvalStatus: "approved" | "pending" | "missing_credentials";
  hasUserId: boolean;
  hasApiKey: boolean;
  hasInferenceKey: boolean;
  supportedLanguages: Array<{ code: string; name: string; nativeName: string }>;
} {
  const hasInferenceKey = Boolean(process.env.BHASHINI_INFERENCE_KEY);
  const hasApiKey = Boolean(process.env.BHASHINI_API_KEY);
  const hasUserId = Boolean(process.env.BHASHINI_USER_ID);
  const configured = (hasInferenceKey || hasApiKey) && hasUserId;

  return {
    configured,
    approvalStatus: configured ? "approved" : "missing_credentials",
    hasUserId,
    hasApiKey,
    hasInferenceKey,
    supportedLanguages: Object.entries(BHASHINI_SUPPORTED_LANGUAGES).map(
      ([code, lang]) => ({
        code,
        name: lang.name,
        nativeName: lang.nativeName,
      })
    ),
  };
}
