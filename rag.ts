require("dotenv").config({
  path: "./.env",
});

import OpenAI from "openai";
import { ChromaClient, Collection } from "chromadb";

import { promises as fs } from "fs";

import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse";

export class MySlackRagVectorStore {
  constructor(private client: ChromaClient, private collection: Collection) {}

  async load(): Promise<any> {
    const dataStr = await fs.readFile("./messages.json", "utf-8");
    const slackMessages: MessageElement[] = JSON.parse(dataStr);
    const formattedMessages = slackMessages
      .map((message) => {
        return {
          sender: message.user,
          text: message.text,
          id: message.client_msg_id,
        };
      })
      .filter((m) => m.id && m.sender && m.text);
    await this.collection.add({
      documents: formattedMessages.map((d) => d.text!),
      ids: formattedMessages.map((d) => d.id!),
      metadatas: formattedMessages.map((d) => {
        return { sender: d.sender! };
      }),
    });
  }

  async getClosestNeighbors(question: string): Promise<string[]> {
    const results = await this.collection.query({
      queryTexts: [question],
      nResults: 5, // how many results to return
    });
    return results.documents.flatMap((d) => d).map((d) => d ?? "");
  }
}

async function createVectorStore(): Promise<MySlackRagVectorStore> {
  const client = new ChromaClient();

  const collection = await client.getOrCreateCollection({
    name: "my_rag_slack",
  });

  return new MySlackRagVectorStore(client, collection);
}

export class ChatBot {
  constructor(private vectorStore: MySlackRagVectorStore) {}
  async query(question: string): Promise<{
    citedSlackMessages: string[];
    answer: string;
  }> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://oai.hconeai.com/v1",
      defaultHeaders: {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      },
    });

    const neighbors = await this.vectorStore.getClosestNeighbors(question);

    const myCompletions = await openai.chat.completions.create({
      messages: [
        {
          content: `You are a helpful chat bot. Answer the question given this context.
          
          HERE ARE A BUNCH OF RELEVANT SLACK MESSAGES THAT MAY OR MAY NOT ANSWER THE USER'S QUESTION!
          <START SLACK MESSAGES>
          
          ${neighbors.join("\n")}

          <END SLACK MESSAGES>
          `,
          role: "system",
        },
        {
          content: question,
          role: "user",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "answerQuestion",
            description:
              "This will answer the user's question and cite which relevant slack messages you are using to answer it",
            parameters: {
              type: "object",
              properties: {
                slackMessages: {
                  type: "array",
                  description: "A list of Slack messages.",
                  items: {
                    type: "string",
                    description: "a slack message",
                  },
                },
                answer: {
                  type: "string",
                  description:
                    "A short answer that just gets directly to the point and solves the user's query.",
                },
              },
              required: ["answer", "slackMessages"],
            },
          },
        },
      ],
      model: "gpt-4o",
    });

    const tool = JSON.parse(
      myCompletions.choices[0].message.tool_calls![0].function.arguments
    );
    return {
      citedSlackMessages: tool.slackMessages,
      answer: tool.answer,
    };
  }
}

async function main() {
  const mySlackRagDataStore = await createVectorStore();

  const chatBot = new ChatBot(mySlackRagDataStore);

  const result = await chatBot.query("What's the best way to scale jawn?");

  console.log(result);
}

main();
