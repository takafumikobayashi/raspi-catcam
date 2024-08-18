require('dotenv').config();
const OpenAI = require('openai').OpenAI

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY 
})

// OpenAIによるリクエスト文章解析
async function generateText(message) {

  const prompt = `メッセージを解析し、画像または動画のリクエストを判断し、以下のJSONで返してください。コードブロックは不要です。

- 画像: request 1, number=枚数 (未指定1、最大5)
- 動画: request 2, number=1
- 画像と動画: request 3, number=3
- リクエストなし: request 0, number=0

メッセージ:
{${message}}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ "role": "user", "content": prompt }],
    });
    return response.data.choices[0].text;
  } catch (error) {
    console.error("Error generating text:", error);
    throw error; // エラーが発生した場合に呼び出し元にエラーを伝える
  }
}

// module.exports で関数をエクスポート
module.exports = { generateText };