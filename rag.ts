import { ChromaClient } from "chromadb";
import OpenAI from "openai";

require("dotenv").config({
  path: "./.env",
});

async function getOpenAIEmbeddings(texts: string[]) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

async function main() {
  const client = new ChromaClient();

  const collection = await client.getOrCreateCollection({
    name: "my_collection_openai",
  });
  const documents = [
    "This is a document about pineapple",
    "This is a document about oranges",
  ];

  const embeddings = await getOpenAIEmbeddings(documents);

  await collection.add({
    documents,
    embeddings,
    ids: ["id1", "id2"],
  });

  const queryText = "This is a query document about florida";

  const queryEmbedding = await getOpenAIEmbeddings([queryText]);
  console.log({ queryEmbedding });
  const results = await collection.query({
    queryEmbeddings: queryEmbedding,
    nResults: 2, // how many results to return
  });
  console.log(results);
}

main();
