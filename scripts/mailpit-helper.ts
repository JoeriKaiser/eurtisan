import { argv } from "bun";

const MAILPIT_URL = "http://mailpit:8025/api/v1";

interface MailpitMessage {
  ID: string;
  Subject: string;
  Snippet: string;
  Created: string;
}

interface MessageDetail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
  To: { Name: string; Address: string }[];
}

async function getLastMessage(): Promise<MessageDetail | null> {
  const res = await fetch(`${MAILPIT_URL}/messages?limit=1`);
  if (!res.ok) throw new Error(`Mailpit error: ${res.statusText}`);
  const data = (await res.json()) as { messages: MailpitMessage[] };
  if (!data.messages || data.messages.length === 0) return null;

  const detailRes = await fetch(`${MAILPIT_URL}/message/${data.messages[0].ID}`);
  if (!detailRes.ok) throw new Error(`Mailpit detail error: ${detailRes.statusText}`);
  return (await detailRes.json()) as MessageDetail;
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map((url) => url.replace(/&amp;/g, "&"))));
}

const action = argv[2];

try {
  if (action === "last") {
    const msg = await getLastMessage();
    if (!msg) {
      console.log(JSON.stringify({ error: "No messages found" }));
      process.exit(1);
    }
    console.log(JSON.stringify(msg, null, 2));
  } else if (action === "links") {
    const msg = await getLastMessage();
    if (!msg) {
      console.log(JSON.stringify({ error: "No messages found" }));
      process.exit(1);
    }
    const combinedText = `${msg.Text}\n${msg.HTML}`;
    const urls = extractUrls(combinedText);
    console.log(
      JSON.stringify(
        {
          subject: msg.Subject,
          to: msg.To,
          links: urls,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Usage: bun scripts/mailpit-helper.ts [last|links]");
    process.exit(1);
  }
} catch (err: any) {
  console.error("Error running mailpit-helper:", err.message);
  process.exit(1);
}
