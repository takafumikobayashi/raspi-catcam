require('dotenv').config();
const { captureRaspiImage, captureRaspiVideo } = require('./raspiCamera');
const generateText = require('./gptAction');

async function lineBotAction(replyToken, messageText, groupId) {
  // 初期設定
  const line = require('@line/bot-sdk'); 
  const client = new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
  });

  const textMessage = {
    type: 'text',
    text: '撮影するのでちょっと待ってね！'
  };

  // ランダムスタンプ配列からランダムに選択
  const targetStamps = ['446/1988', '446/1989', '789/10856', '789/10857', '6136/10551394', '6325/10979914', '6359/11069853', '6359/11069868'];
  const randomIndex = Math.floor(Math.random() * targetStamps.length);
  const randomStamp = targetStamps[randomIndex];
  const [packageId, stickerId] = randomStamp.split('/');

  const addMessage = {
    type: "sticker",
    packageId: packageId,
    stickerId: stickerId
  };

  try {
    await client.replyMessage(replyToken, [textMessage, addMessage]);
    console.log('リプライ完了！');

    //テキストの内容から何を求めているのかGPTで判断
    const requestObjects = JSON.parse(await generateText(textMessage));

    //判断結果に基づき実行
    const requestImage = 1  //静止画のみ
    const requestVideo = 2  //動画のみ
    const requestBoth = 3   //静止画と動画の両方

    switch (requestObjects.requests){
      case requestImage:
        const messageColumns = await captureRaspiImage(requestObjects.number);
        await client.pushMessage(groupId, messageColumns);
        break;

      case requestVideo:
        const videoMessageColumns = await captureRaspiVideo();
        await client.pushMessage(groupId, videoMessageColumns);
        break;

      case requestBoth:
        const messageColumnsBoth = await captureRaspiImage(requestObjects.number);
        await client.pushMessage(groupId, messageColumnsBoth);

        const videoMessageColumnsBoth = await captureRaspiVideo();
        await client.pushMessage(groupId, videoMessageColumnsBoth);
        break;
    }

    return "Success";
  } catch (err) {
    console.error('Error processing message:', err);
    return "Error";
  }
};
module.exports = lineBotAction;