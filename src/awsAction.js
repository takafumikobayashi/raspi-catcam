require('dotenv').config();
const fs = require('fs-extra');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION_NAME });

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
module.exports = uploadImageToS3;