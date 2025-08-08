/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
  StartSensitivity,
  ActivityHandling,
} from "@google/genai";

const backend_base_url =  process.env.REACT_APP_BACKEND_BASE_URL || "http://localhost:8000";

const handle_answer_tool: FunctionDeclaration = {
  name: "handle_answer",
  description: "Gets the next question to ask the user based on the answer",
  parameters: {
    type: Type.OBJECT,
    properties: {
      user_answer: {
        type: Type.STRING,
        description:
          "The transcript of the user's answer to the question",
      },
    },
    required: ["user_answer"],
  },
};

const get_time_tool: FunctionDeclaration = {
  name: "get_time",
  description: "Gets the current time",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};

const get_schedule_tool: FunctionDeclaration = {
  name: "get_schedule",
  description: "Gets the doctor's schedule",
  parameters: {
    type: Type.OBJECT,
    properties: {
      main_symptoms: {
        type: Type.STRING,
        description: "The summary of the pationts symptoms",
      },
    },
    required: ["main_symptoms"],
  },
};

const update_schedule_tool: FunctionDeclaration = {
  name: "update_schedule",
  description: "Updates the doctor's schedule with the patient's appointment",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointment_time: {
        type: Type.STRING,
        description: "The time of the appointment",
      },
      patient_name: {
        type: Type.STRING,
        description: "The name of the patient",
      },
      patient_phone: {
        type: Type.STRING,
        description: "The phone number of the patient",
      },
      patient_email: {
        type: Type.STRING,
        description: "The email of the patient",
      },
    },
    required: [
      "appointment_time",
      "patient_name",
      "patient_phone",
      "patient_email",
    ],
  },
};


async function handle_answer(
  args: Record<string, unknown> | undefined
  , sessionID: string | null
): Promise<string> {
  const backend_url = backend_base_url + "/handle-answer";
  const user_answer = args?.user_answer;
  // const session_id = "voicechat-session-1";
  console.log("handel_answer - User answer:", user_answer);
  console.log("handel_answer - Session ID:", sessionID);
  const requestBody = {
    user_answer,
    session_id : sessionID, // Use the session ID from the context
  };
  console.log("Request body for backend:", requestBody);
  const response = await fetch(backend_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log("Response from backend:", data);
  const question = data.question || "";
  return question;
}

function get_time(): string {
  const now = new Date();

  const options: Intl.DateTimeFormatOptions = {
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone:     "Europe/Helsinki",
    timeZoneName: "short",
  };

  return now.toLocaleString("fi-FI", options);
}

async function get_schedule(main_symptoms: string): Promise<string> {
  const backend_url = backend_base_url + "/get-schedule";
  const requestBody = {
    user_answer: main_symptoms,
    session_id: "voicechat-session-1",
  };
  return fetch(backend_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Response from backend:", data);
      return data.schedule || "Error: No schedule available.";
    });
}

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig, setModel , sessionID} = useLiveAPIContext();
  // console.log("AltairComponent - sessionID", sessionID);

  const sessionIDRef = useRef(sessionID);
  
  useEffect(() => {
    setModel("gemini-2.5-flash-preview-native-audio-dialog");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Aoede" },
      },
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        },
        activityHandling: ActivityHandling.NO_INTERRUPTION,
      },
      systemInstruction: {
      parts: [
        {
        text: `
        *** Before you speak call the handle_answer tool to get the next question ***
         After user says a greeting back: 
          Ask the user the question you received from the tool call
          And handle the answer with the tool. 
          Then repeat this until you receive a summary from the backend. 
          When you receive a summary: 
          Confirm the summary with the user. 
          If the summary is correct, then: 
          Ask the user if they want to book an appointment.
         Do not make up your own questions or say anything else. Thank you!
         *** AFTER USER HAS SAID SOMETHING USE THE handle_answer TOOL TO GET THE NEXT QUESTION ***
         *** When calling the handle_answer tool, use the transcription of the user's response as the argument ***
              `,
        },
      ],
      },
      tools: [
      {
        functionDeclarations: [
        handle_answer_tool,
        ],
      },
      ],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = async (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      console.log("Tool call received, sessionid", sessionID);
      let toolcall_result = "";
      if (toolCall.functionCalls[0].name === "handle_answer") {
        toolcall_result = await handle_answer(toolCall.functionCalls[0].args, sessionID);
      } else if (toolCall.functionCalls[0].name === "get_time") {
        toolcall_result = get_time();
      } else if (toolCall.functionCalls[0].name === "get_schedule") {
        toolcall_result = await get_schedule(
          toolCall.functionCalls[0].args?.main_symptoms as string
        );
      } else if (toolCall.functionCalls[0].name === "update_schedule") {
        toolcall_result = "Appointment successfully booked.";
      } else {
        toolcall_result = "Unknown tool call.";
      }
      console.log("Tool call result:", toolcall_result);
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { toolcall_result: toolcall_result} },
                id: fc.id,
                name: fc.name,
              })),
            }),
          300
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, sessionID]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      console.log("jsonString", jsonString);
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
