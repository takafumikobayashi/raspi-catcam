require('dotenv').config();

// for AWS S3
const fs = require('fs-extra');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client({ region: process.env.AWS_REGION_NAME });

// for AWS Rekognition
const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const { URL } = require('url');

// AWS S3アップロード関数
async function uploadImageToS3(filePath, fileName, contentType) {
  try {
    const fileContent = await fs.readFile(filePath);  // 非同期でファイルを読み込む
    let key = process.env.AWS_S3_BUCKET_PATH + '/' + fileName;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType  // 画像のMIMEタイプを指定
    };
    
    await s3Client.send(new PutObjectCommand(params));
    console.log(`File uploaded successfully at ${process.env.AWS_S3_BUCKET_NAME}/${key}`);
    
    // S3のURLを生成して返す
    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    return s3Url;
    
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;  // エラーを呼び出し元に伝えるために再スロー
  }
};

//Rekognitionを使用してネコがいるのか分析
async function analyzeImageForCat(s3Url) {
  // URLからバケット名とオブジェクトキーを抽出
  const url = new URL(s3Url);
  const s3Bucket = url.hostname.split('.')[0];
  const s3Key = decodeURIComponent(url.pathname.substring(1)); // 最初のスラッシュを除外

  const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION_NAME });

  const params = {
      Image: {
          S3Object: {
              Bucket: s3Bucket,
              Name: s3Key
          }
      },
      MaxLabels: 10,  // 取得するラベルの最大数
      MinConfidence: 75  // 信頼度の閾値（75%以上の確度）
  };

  try {
      const command = new DetectLabelsCommand(params);
      const response = await rekognitionClient.send(command);

      let catDetected = false;
      for (const label of response.Labels) {
          if (label.Name.toLowerCase() === "cat") {
              catDetected = true;
              break;
          }
      }

      if (catDetected) {
          console.log("Cat detected in the image!");
          return process.env.AWS_REKOGNITION_CAT_DETECTED_MESSAGE;
      } else {
          console.log("No cat detected in the image.");
          return process.env.AWS_REKOGNITION_NO_CAT_DETECTED_MESSAGE;
      }

  } catch (error) {
      console.error("Error analyzing image:", error);
      return process.env.AWS_REKOGNITION_IMAGE_ANALYSIS_FAILED_MESSAGE;
  }
}
module.exports = {uploadImageToS3, analyzeImageForCat};