import { WebClient } from "@slack/web-api";
import * as fs from "fs";

require("dotenv").config({
  path: "./.env",
});

// Initialize
const client = new WebClient(process.env.SLACK_API_KEY);

// List channels
async function listChannels() {
  try {
    const result = await client.conversations.list({});
    const channels = result.channels!;

    channels?.forEach((channel) => {
      console.log(`Channel ID: ${channel.id} - Name: ${channel.name}`);
    });
  } catch (error) {
    if (error.data) {
      console.error(`Error listing channels: ${error.data}`);
    } else {
      console.error(`Error listing channels: ${error}`);
    }
  }
}

// Fetch messages from a channel
async function fetchMessages(channelId: string) {
  try {
    const result = await client.conversations.history({ channel: channelId });
    const messages = result.messages;
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));
  } catch (error) {
    if (error.data) {
      console.error(`Error fetching conversations: ${error.data}`);
    } else {
      console.error(`Error fetching conversations: ${error}`);
    }
  }
}

// Join a channel
async function joinChannel(channelId: string) {
  try {
    await client.conversations.join({ channel: channelId });
    console.log(`Successfully joined channel: ${channelId}`);
  } catch (error) {
    if (error.data) {
      console.error(`Error joining channel: ${error.data}`);
    } else {
      console.error(`Error joining channel: ${error}`);
    }
  }
}

// Execute functions
listChannels();
joinChannel("C06KPU8CR0C");
fetchMessages("C06KPU8CR0C");
