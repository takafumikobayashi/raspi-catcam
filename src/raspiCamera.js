require('dotenv').config();
const { exec } = require('child_process');

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

// 静止画撮影からメッセージオブジェクト作成
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
    await execPromise('raspistill -w 1280 -h 960 -o ' + fileFullPath);
  
    // S3に保存
    const s3Url = await uploadImageToS3(fileFullPath, fileName, 'image/jpeg');
    console.log('S3 URL:', s3Url);
  
    // メッセージオブジェクト作成
    const columns_elements = {imageUrl: s3Url};
    const action = {type: 'uri', label: '拡大してみる', uri: s3Url};
    columns_elements['action'] = action;
    columns.push(columns_elements);
  }

  template['columns']=columns
  image_carousel['template']=template
  return image_carousel;
}

// 動画撮影からメッセージオブジェクト作成
async function captureRaspiVideo() {
  const uniqueDateString = getFormattedDate();
  const fileNamePreview = `preview_${uniqueDateString}.jpg`;
  const fileNameVideo = `video_${uniqueDateString}.h264`;
  const fileNameConverted = `video_${uniqueDateString}.mp4`;
  const fileFullPathPreview = process.env.RASPI_LOCAL_PATH + '/' + fileNamePreview;
  const fileFullPathVideo = process.env.RASPI_LOCAL_PATH + '/' + fileNameVideo;
  const fileFullPathConverted = process.env.RASPI_LOCAL_PATH + '/' + fileNameConverted;

  // まずはプレビュー用のイメージから
  await execPromise('raspistill -w 320 -h 240 -o ' + fileFullPathPreview);
  const previewImageUrl = await uploadImageToS3(fileFullPathPreview, fileNamePreview, 'image/jpeg');

  // 続けて動画を撮影
  await execPromise('raspivid -o ' + fileFullPathVideo + ' -t 10000 -fps 90 -w 640 -h 480');

  // h.264をMP4に変換してS3にアップロード
  await execPromise(`ffmpeg -i ${fileFullPathVideo} -c:v copy ${fileFullPathConverted}`);
  const originalContentUrl = await uploadImageToS3(fileFullPathConverted, fileNameConverted, 'video/mp4');

  // メッセージオブジェクトの定義
  let columns = {
    "type": "video",
    "originalContentUrl": originalContentUrl,
    "previewImageUrl": previewImageUrl
  };
  return columns;
}
module.exports = {captureRaspiImage, captureRaspiVideo};