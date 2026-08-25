import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    fullScript: { type: Type.STRING },
    
    // 1. Voiceover Pacing & Breathing Guide (Marker per voce reale)
    voiceoverGuide: {
      type: Type.STRING,
      description: "Script annotato con marcatori visibili per registrazione vocale: [PAUSA 1s], [ALZA IL TONO], [PARLA LENTO], [RESPIRO]."
    },

    // 2. On-Screen Graphics & Text Overlay Blueprint
    onScreenGraphics: {
      type: Type.ARRAY,
      description: "Elementi grafici 2D/3D, testi e sovrimpressioni visive da inserire sopra i B-Roll.",
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          graphicType: { type: Type.STRING, description: "Es. Pop-up Text, Barra Avanzamento, Icona 3D, Highlighter" },
          description: { type: Type.STRING, description: "Istruzioni esatte sull'elemento visivo da mostrare" },
          animationStyle: { type: Type.STRING, description: "Es. Scale Up + Bounce, Fade In, Slide Left" }
        },
        required: ["timestamp", "graphicType", "description", "animationStyle"]
      }
    },

    // 3. Screen Recording & Live Demo Action Plan
    screenRecordPlan: {
      type: Type.ARRAY,
      description: "Lista di istruzioni passo-passo sulle registrazioni schermo/software da catturare prima del montaggio.",
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.NUMBER },
          action: { type: Type.STRING, description: "Cosa registrare a schermo (es. Scroll veloce di una pagina web)" },
          zoomFocus: { type: Type.STRING, description: "Dove fare zoom/crop visivo durante l'azione" },
          duration: { type: Type.STRING }
        },
        required: ["step", "action", "zoomFocus", "duration"]
      }
    },

    // 4. Prompt Midjourney per SFONDI & Grafiche Vettoriali
    midjourneyPrompts: {
      type: Type.ARRAY,
      description: "Prompt in inglese per Midjourney/DALL-E per generare sfondi isometrici e grafiche minimal trasparenti.",
      items: {
        type: Type.OBJECT,
        properties: {
          assetName: { type: Type.STRING, description: "Nome dell'elemento (es. Sfondo Tech Minimal, Icona 3D)" },
          prompt: { type: Type.STRING, description: "Prompt esatto in INGLESE per Midjourney/DALL-E" },
          aspectRatio: { type: Type.STRING, description: "Es. --ar 9:16 o --ar 1:1" }
        },
        required: ["assetName", "prompt", "aspectRatio"]
      }
    },

    abHooks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING },
          script: { type: Type.STRING },
          visualAction: { type: Type.STRING }
        },
        required: ["angle", "script", "visualAction"]
      }
    },
    ctaStrategies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objective: { type: Type.STRING },
          scriptLine: { type: Type.STRING },
          onScreenText: { type: Type.STRING }
        },
        required: ["objective", "scriptLine", "onScreenText"]
      }
    },
    carouselSlides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          bodyText: { type: Type.STRING },
          visualIdea: { type: Type.STRING }
        },
        required: ["slideNumber", "title", "bodyText", "visualIdea"]
      }
    },
    contentCalendar: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          episode: { type: Type.NUMBER },
          title: { type: Type.STRING },
          angle: { type: Type.STRING },
          keyTakeaway: { type: Type.STRING }
        },
        required: ["episode", "title", "angle", "keyTakeaway"]
      }
    },
    aiVideoPrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          sceneContext: { type: Type.STRING },
          aiPrompt: { type: Type.STRING },
          cameraMovement: { type: Type.STRING },
          suggestedTool: { type: Type.STRING }
        },
        required: ["timestamp", "sceneContext", "aiPrompt", "cameraMovement", "suggestedTool"]
      }
    },
    timelineJsonExport: {
      type: Type.OBJECT,
      properties: {
        fps: { type: Type.NUMBER },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              startTime: { type: Type.NUMBER },
              duration: { type: Type.NUMBER },
              content: { type: Type.STRING }
            },
            required: ["id", "type", "startTime", "duration", "content"]
          }
        }
      },
      required: ["fps", "nodes"]
    }
  },
  required: [
    "fullScript",
    "voiceoverGuide",
    "onScreenGraphics",
    "screenRecordPlan",
    "midjourneyPrompts",
    "abHooks",
    "ctaStrategies",
    "carouselSlides",
    "contentCalendar",
    "aiVideoPrompts",
    "timelineJsonExport"
  ]
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chiave API Gemini non configurata nel file di ambiente (.env.local).' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { topic, targetProduct, rawScript, videoStyle } = await req.json();

    if (!topic || !rawScript) {
      return NextResponse.json(
        { error: 'Argomento e note del video sono obbligatori.' },
        { status: 400 }
      );
    }

    const systemInstruction = `
Sei un regista e produttore di video FACELESS ad altissima ritenzione. L'utente registra la PROPRIA VOCE al microfono e non mostra la propria faccia.

Genera un pacchetto completo con:
1. Script base e "voiceoverGuide" annotata con marcatori di dizione per voce reale ([PAUSA 1s], [ALZA IL TONO], [PARLA LENTO], [RESPIRO]).
2. "onScreenGraphics": Overlay visivi, rettangoli evidenziatori, barre di caricamento e testo 2D/3D a schermo.
3. "screenRecordPlan": Guida per la registrazione dello schermo/software prima del montaggio.
4. "midjourneyPrompts": Prompt in inglese per creare sfondi isometrici e asset grafici vettoriali su Midjourney/DALL-E.
5. Hook A/B, CTA Engine, Carosello IG/LinkedIn, Piano Editoriale 5 episodi e Prompt Video AI B-Roll.
`;

    const userPrompt = `
Argomento: ${topic}
Prodotto/Sponsor: ${targetProduct || 'Nessuno'}
Stile Video: ${videoStyle || 'Faceless Tech Review'}
Note Grezze: ${rawScript}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Nessuna risposta ricevuta da Gemini.');
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Errore backend:', error);
    return NextResponse.json(
      { error: error.message || 'Errore di elaborazione.' },
      { status: 500 }
    );
  }
}