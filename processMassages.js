const AWS = require('aws-sdk');
const { exec } = require('child_process');
const line = require('@line/bot-sdk'); // LINE Messaging API SDK

// AWS SDK設定
AWS.config.update({ region: 'us-east-1' });
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const queueURL = 'https://sqs.us-east-1.amazonaws.com/123456789012/your-queue-name';
const lineConfig = {
    channelAccessToken: 'YOUR_CHANNEL_ACCESS_TOKEN',
    channelSecret: 'YOUR_CHANNEL_SECRET'
};
const client = new line.Client(lineConfig);

const params = {
    QueueUrl: queueURL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20
};

function receiveMessages() {
    sqs.receiveMessage(params, (err, data) => {
        if (err) {
            console.error('Receive Error', err);
        } else if (data.Messages) {
            data.Messages.forEach(message => {
                const text = message.Body;

                if (text === 'photo') {
                    exec('raspistill -o /home/pi/photo.jpg', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`exec error: ${error}`);
                            return;
                        }
                        client.pushMessage('YOUR_GROUP_ID', {
                            type: 'image',
                            originalContentUrl: 'https://your-server/photo.jpg',
                            previewImageUrl: 'https://your-server/photo.jpg'
                        });
                    });
                } else if (text === 'video') {
                    exec('raspivid -o /home/pi/video.h264 -t 10000', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`exec error: ${error}`);
                            return;
                        }
                        client.pushMessage('YOUR_GROUP_ID', {
                            type: 'video',
                            originalContentUrl: 'https://your-server/video.h264',
                            previewImageUrl: 'https://your-server/video_preview.jpg'
                        });
                    });
                }

                const deleteParams = {
                    QueueUrl: queueURL,
                    ReceiptHandle: message.ReceiptHandle
                };

                sqs.deleteMessage(deleteParams, (err, data) => {
                    if (err) {
                        console.error('Delete Error', err);
                    } else {
                        console.log('Message deleted', data);
                    }
                });
            });
        }
    });
}

setInterval(receiveMessages, 5000); // 5秒ごとにポーリング