require('dotenv').config();
const fs = require('fs-extra');
const AWS = require('aws-sdk');
const { exec } = require('child_process');
const s3 = new AWS.S3();

// execをPromiseでラップした関数
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command failed: ${stderr}`);
        reject(error);
      } else {
        if (stderr) {
          console.warn(`Command executed with warnings: ${stderr}`);
        }
        resolve(stdout);
      }
    });
  });
};

module.exports = async function lineBotAction(replyToken, messageText, groupId) {
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

    const messageColumns = await captureRaspiImage(process.env.RASPI_NUMBER_OF_IMAGE);
    await client.pushMessage(groupId, messageColumns);

    if (messageText.includes(process.env.LINE_VIDEO_CAPTURE_KEYWORD)) {
      const videoMessageColumns = await captureRaspiVideo();
      await client.pushMessage(groupId, videoMessageColumns);
    }

    return "Success";
  } catch (err) {
    console.error('Error processing message:', err);
    return "Error";
  }
};

// ファイル名作成用関数
function getFormattedDate() {
  const now = new Date();
  
  const year = now.getFullYear(); // 年
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月（0始まりなので+1）
  const day = String(now.getDate()).padStart(2, '0'); // 日

  const hours = String(now.getHours()).padStart(2, '0'); // 時
  const minutes = String(now.getMinutes()).padStart(2, '0'); // 分
  const seconds = String(now.getSeconds()).padStart(2, '0'); // 秒

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function captureRaspiImage(imageNumber) {
  const uniqueDateString = getFormattedDate();

  // メッセージオブジェクトの定義
  let image_carousel = {type: 'template', altText: uniqueDateString + '頃の様子です！'};
  let template = {"type": "image_carousel"};
  let columns = [];

  for (let n = 0; n < imageNumber; n++) {
    const fileName = `photo_${uniqueDateString}_${n}.jpg`;
    const fileFullPath = process.env.RASPI_LOCAL_PATH + '/' + fileName;

    // 静止画撮影
    await execPromise('raspistill -vf -hf -o ' + fileFullPath);

    // S3に保存
    const s3Url = await uploadImageToS3(fileFullPath, fileName, 'image/jpeg');
    console.log('S3 URL:', s3Url);

    // メッセージオブジェクト作成
    const columns_elements = {imageUrl: s3Url};
    const action = {type: 'uri', label: fileName, uri: s3Url};
    columns_elements['action'] = action;
    columns.push(columns_elements);
  }

  template['columns']=columns
  image_carousel['template']=template
  return image_carousel;
}

async function captureRaspiVideo() {
  const uniqueDateString = getFormattedDate();
  const fileNamePreview = `preview_${uniqueDateString}.jpeg`;
  const fileNameVideo = `video_${uniqueDateString}.h264`;
  const fileFullPathPreview = process.env.RASPI_LOCAL_PATH + '/' + fileNamePreview;
  const fileFullPathVideo = process.env.RASPI_LOCAL_PATH + '/' + fileNameVideo;

  // まずはプレビュー用のイメージから
  await execPromise('raspistill -vf -hf -o ' + fileFullPathPreview);
  const previewImageUrl = await uploadImageToS3(fileFullPathPreview, fileNamePreview, 'image/jpeg');

  // 続けて動画を撮影
  await execPromise('raspivid -o ' + fileFullPathVideo + ' -t 10000');
  const originalContentUrl = await uploadImageToS3(fileFullPathVideo, fileNameVideo, 'video/mp4');

  // メッセージオブジェクトの定義
  let columns = {
    "type": "video",
    "originalContentUrl": originalContentUrl,
    "previewImageUrl": previewImageUrl
  };
  return columns;
}

// AWS S3アップロード関数
async function uploadImageToS3(filePath, fileName, contentType) {
  try {
    const fileContent = await fs.readFile(filePath);  // 非同期でファイルを読み込む
    let key = process.env.AWS_S3_BUCKET_PATH_IMAGE + '/' + fileName;
    if (ContentType === 'video/mp4') {
      key = process.env.AWS_S3_BUCKET_PATH_VIDEO + '/' + fileName;
    }
  
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType  // 画像のMIMEタイプを指定
    };

    console.log(params)
  
    await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${process.env.AWS_S3_BUCKET_NAME}/${key}`);
  
    // S3のURLを生成して返す
    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    return s3Url;
  
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;  // エラーを呼び出し元に伝えるために再スロー
  }
};