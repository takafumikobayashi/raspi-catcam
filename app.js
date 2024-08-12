require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const lineBotAction = require('./lineBotAction.js');
const app = express();
const port = 3000;

const sqs = new AWS.SQS({ region: process.env.AWS_REGION_NAME });
const queueUrl = process.env.AWS_SQS_QUEUE_URL;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const pollMessages = async () => {
  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20  // ロングポーリングを設定
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
        for (const message of data.Messages) {
            console.log('Received message:', message.Body);

            try {
                // メッセージをparse
                const body = JSON.parse(message.Body);
                const eventType = body.events[0].type
                if (eventType == 'message') {
                  const messageText = body.events[0].message.text;
                  // メッセージにREPLYキーワードが含まれているかをチェック
                  if (messageText.includes(process.env.LINE_REPLY_INCLUDE_KEYWORD)) {
                    // 撮影およびLINE投稿処理
                    await lineBotAction(body.events[0].replyToken, body.events[0].message.text, body.events[0].source.groupId);
                  };
                }
                
                // メッセージキューの削除
                const deleteParams = {
                    QueueUrl: queueUrl,
                    ReceiptHandle: message.ReceiptHandle
                };
                await sqs.deleteMessage(deleteParams).promise();
                console.log('Deleted message:', message.ReceiptHandle);

            } catch (actionError) {
                console.error('Error processing message:', actionError);
                // エラー時の処理（メッセージを削除しないなど）
            }
        }
    } else {
        console.log('No messages in queue');
    }
  } catch (err) {
      console.error('Error receiving message from SQS:', err);
  }
};

// サーバーの起動と同時にポーリングを開始
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  setInterval(pollMessages, 5000);  // 5秒ごとにポーリングを実施
});