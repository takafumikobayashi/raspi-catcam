const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// AWS SDK設定
AWS.config.update({ region: 'us-east-1' }); // 適切なリージョンを設定
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    const message = req.body.events[0].message.text;
    const params = {
        MessageBody: message,
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/your-queue-name' // 適切なキューURLに変更
    };

    sqs.sendMessage(params, (err, data) => {
        if (err) {
            console.error('Error', err);
            res.sendStatus(500);
        } else {
            console.log('Success', data.MessageId);
            res.sendStatus(200);
        }
    });
});

app.get('/', (req, res) => {
    res.send('LINE Webhook Server is running.');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});