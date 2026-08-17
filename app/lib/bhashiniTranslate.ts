export async function translateVttWithBhashini(vtt: string, targetLangCode: string): Promise<string | null> {
  const API_KEY = process.env.BHASHINI_API_KEY;
  const USER_ID = process.env.BHASHINI_USER_ID;
  if (!API_KEY || !USER_ID) return null;

  try {
    const payload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: "en", // Simplified for this implementation
              targetLanguage: targetLangCode
            }
          }
        }
      ],
      inputData: {
        input: [
          {
            source: vtt
          }
        ]
      }
    };

    const response = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/compute', {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY,
        'userID': USER_ID
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Bhashini API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.pipelineResponse?.[0]?.output?.[0]?.target;
    
    if (result && result.startsWith("WEBVTT")) {
      return result;
    }
    return null;
  } catch (err) {
    console.error("Bhashini translation failed:", err);
    return null;
  }
}
