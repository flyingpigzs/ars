This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
built with **Next.js 13 App Router**, **Tailwind CSS**, and **JSON file-based storage**. 

## 🧑‍💻 Getting Started

### 1. Install dependencies

npm install

### 2. Run development server
npm run dev

### 3. Open your browser and go to http://localhost:3000


## 📁 Project Structure

```
src/ 
├── page.tsx # home page / chat home page
├── app/
│ ├─ chat/[chat_Id]/page.tsx # Route to display a specific chat
│ ├─ voice/page.tsx # Voice chat home page
│ ├─ voicechat/[chat_id]/page.tsx # Route to display a specific voice chat
│ ├─ treevisualization/page.tsx # Tree visualization page
│ └─ api/ 
│  ├── chats/route.ts # API to get all chat history files
│  ├── ask-assistant/route.ts # API to get answer from backend, need to start fastapi server first.
│  ├── new-chat/route.ts # API to create a new chat JSON file 
│  └── update-chat/route.ts # API to update an existing chat JSON 
└── components/
  ├── Sidebar
  ├── Toolbar
  ├── ChatWindow # show the history and chat 
  ├── JsonVisualization.tsx # Select a file to display and call TreeVisualizer show the roadmap tree
  └── TreeVisualizer # json -> roadmap tree

public/ 
├── data/
│    ├─ chatHistory/  # Folder containing all chat history files # Each file is named with the session_id 
│    ├─ audioChatHistory/  # Folder containing all audio chat history files # Each file is named with the session_id
│    └─ audioFile/ # The voice chat record will store the file address of the voice, and all voice files will be stored in this folder
└──json # Temporarily store JSON files and obtain them from the backend later
```



## Components in pages
### Home page
frontend/src/app/page.tsx
![image](https://github.com/user-attachments/assets/3c0a9e82-028c-487a-ade9-c449e6afc06b)

### Chat page
- When a user sends a new message, a chat history file will be created, and display conversations on the chat page.
- Users clicking on the historical conversation in the sidebar will also use the chat page.

History: frontend/public/data/chatHistory\
Chat History file name is session_id.json\
Route page:
frontend/src/app/chat/[session_id]/page.tsx
![image](https://github.com/user-attachments/assets/68157744-bf4b-4148-8321-01271c067fe1)
Roagmap tree display of the current conversation
Chat history from fastapi:http://localhost:8000/get-conversation-history/${session_id}

![image](https://github.com/user-attachments/assets/6b363641-3b8a-4808-8c12-1b20100c8598)

### Tree visualization
frontend/src/app/treevisualization/page.tsx

![image](https://github.com/user-attachments/assets/93c4f0d9-ffaf-4b4f-a93b-3b341d54451b)

![image](https://github.com/user-attachments/assets/f5e3524b-657b-40d6-bb1c-298d1764f3e1)
